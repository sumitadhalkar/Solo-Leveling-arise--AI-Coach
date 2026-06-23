# Solo Leveling: ARISE — AI Coach

A personalized strategy coach for Solo Leveling: ARISE, powered by Google Gemini 2.0 Flash, live web search, an automated meta-snapshot system, TTL response caching, and real-time SSE streaming. You supply your exact roster, game mode, boss, and coaching mode — the system decides whether to search live or reason from its cached meta context, then streams a structured JSON response personalized to your account.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Core Features](#3-core-features)
4. [Snapshot System](#4-snapshot-system)
5. [Caching System](#5-caching-system)
6. [Streaming System](#6-streaming-system)
7. [Search Strategy](#7-search-strategy)
8. [Analytics](#8-analytics)
9. [API Reference](#9-api-reference)
10. [Project Structure](#10-project-structure)
11. [Setup](#11-setup)
12. [Design Philosophy](#12-design-philosophy)
13. [Future Improvements](#13-future-improvements)

---

## 1. Project Overview

This is not a generic chatbot. It is a game-specific coaching system built around three pillars:

- **Personalization** — every response is generated against the user's exact hunter roster, advancement levels, battle power, spending level, and progression stage.
- **Freshness** — a background worker refreshes game meta every 30 minutes from official and community sources, injecting that context into every prompt as a lightweight warm cache. Live web search is reserved for queries where that snapshot is insufficient.
- **Speed** — identical queries are served from a TTL response cache in milliseconds. Streaming starts immediately, eliminating the perceived 8–15 second blank wait.

**Tech stack:**

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.10+), asyncio |
| AI | Google Gemini 2.0 Flash (`google-genai` SDK) |
| Web Search | Gemini Google Search grounding (conditional) |
| Response Cache | `cachetools.TTLCache` (in-memory) |
| Streaming | FastAPI `StreamingResponse` (SSE) |
| Frontend | React 18, framer-motion |
| Persistence | `localStorage` (roster + profile only) |

---

## 2. System Architecture

### Request Pipeline

```
POST /api/v1/coach/stream
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  Cache check                             │
   │  key = sha256(mode + hunters + question  │
   │               + boss + spending)         │
   └──────────────┬──────────────────────────┘
                  │
          HIT ◄───┤──► MISS
           │              │
           ▼              ▼
   Return cached    Load meta_snapshot.json
   JSON instantly   (inject as warm context)
   (~5ms)                 │
                          ▼
                  ┌───────────────────┐
                  │  _should_search() │
                  │  decision logic   │
                  └────────┬──────────┘
                           │
               NO ◄────────┤────────► YES
                │                      │
                ▼                      ▼
         Snapshot context        Snapshot context
         + Gemini reasoning      + Gemini + Google Search
                │                      │
                └──────────┬───────────┘
                           ▼
                  ┌────────────────────┐
                  │  Stream response   │
                  │  SSE token chunks  │
                  │  → frontend        │
                  └────────┬───────────┘
                           ▼
                  ┌────────────────────┐
                  │  Extract JSON      │
                  │  (3-pass fallback) │
                  └────────┬───────────┘
                           ▼
                  Write to TTLCache
                  Return result event
```

### Background Workers

```
Server startup
     │
     ▼
asyncio.create_task(snapshot_worker())
     │
     └── Every 30 minutes:
           Search Netmarble + arise.tools + Reddit
                    │
                    ▼
           Write meta_snapshot.json
           {
             "authoritative":    { patch, new_hunters, active_banners },
             "meta_reference":   { tier_ss, tier_splus, tier_s, upcoming_banners },
             "community_opinion":{ hot_topics },
             "confidence": 0.95,
             "last_updated": "2026-06-23T..."
           }
```

### Key Routing

```
Rate-limit failover (not round-robin):

Request → _get_best_pair()
               │
               └── For each key in pool:
                     Is key in cooldown? → skip
                     First available key wins
                     │
                     On 429/quota error:
                     _mark_rate_limited(key, 60s)
                     Retry with next available key
```

---

## 3. Core Features

### 3.1 Coaching Modes

Seven distinct modes, each with a mode-specific system prompt injected before the roster context:

| Mode | Description |
|---|---|
| `strategy` | Optimal team, rotation, BiS + F2P alternatives |
| `team_builder` | Full roster analysis, missing roles per element, future pulls |
| `pull_advisor` | Pull / Soft Pull / Skip / Skip (F2P) verdict with F2P sustainability |
| `artifact_optimizer` | Breakpoints, main stats, substats, farming priority, when advice changes |
| `boss_guide` | Attack patterns, tells, weaknesses, positioning, timing windows |
| `future_planning` | Short / mid / long-term progression roadmap |
| `myth_bust` | Correct outdated community beliefs against current patch evidence |

### 3.2 Progression Stage Auto-Detection

Battle Power is used to auto-detect progression stage if not explicitly set:

```python
def _detect_stage(bp: int, stated: str) -> str:
    if bp == 0:        return stated           # trust explicit input
    if bp < 200_000:   return "new"
    if bp < 800_000:   return "midgame"
    if bp < 2_000_000: return "endgame"
    return "competitive"
```

The detected stage gates what depth of advice is given — competitive players get exact artifact breakpoints and frame-perfect rotations; new players get reroll targets and story progression tips.

### 3.3 Spending-Tier Advice

Every response includes four spending tiers simultaneously:
- **BiS** — optimal regardless of cost
- **F2P alternative** — using only free resources
- **Low-invest** — one or two key units
- **Beginner** — safe for new accounts

### 3.4 Meta Change Tracking

When a character is ranked, the response includes `meta_changes`:

```json
{
  "meta_changes": {
    "current_rank": "SS",
    "previous_rank": "S+",
    "reason": "June 2026 patch buffed her passive by 30%, elevating her to SS tier."
  }
}
```

### 3.5 Confidence Ratings

Every response carries:
```json
{
  "confidence": "High",
  "confidence_reason": "Verified against official Netmarble patch notes + arise.tools tier list (June 2026)"
}
```

`High` = official patch + widely tested. `Medium` = recent community testing. `Low` = theorycrafting or older data.

### 3.6 Resource Warnings

The system flags poor-ROI investments in the user's roster:

```json
{
  "resource_warnings": [
    {
      "subject": "Hwang Dongsuk",
      "warning": "Power-crept by Liu Zhigang in the June 2026 patch. Investing in weapon advancement provides poor returns.",
      "alternative": "Direct those Essence Stones toward the Liu Zhigang banner instead."
    }
  ]
}
```

---

## 4. Snapshot System

### Purpose

The snapshot system solves the cold-start problem: instead of every request waiting for a live Gemini search to discover current patch info, a background worker maintains a compact JSON file of current game state. This file is injected into every prompt as warm context, making even search-suppressed responses patch-aware.

### Structure

`meta_snapshot.json` (written to `arise-coach/backend/`):

```json
{
  "last_updated": "2026-06-23T14:30:00+00:00",
  "confidence": 0.95,
  "authoritative": {
    "patch": "2.1.0",
    "new_hunters": ["Character A", "Character B"],
    "active_banners": ["Summer Limited Banner"]
  },
  "meta_reference": {
    "upcoming_banners": ["Character C — confirmed via arise.tools"],
    "tier_ss": ["Sung Jin-Woo", "Cha Hae-In", "Thomas Andre"],
    "tier_splus": ["Alicia", "Choi Jong-In"],
    "tier_s": ["Min Byung-Gu", "Go Gunhee", "Elena Renault"]
  },
  "community_opinion": {
    "hot_topics": [
      "Debate over artifact farming efficiency after patch 2.1.0",
      "New boss mechanics discussion for Guild Boss Season 8"
    ]
  }
}
```

### Source Weighting

The snapshot prompt explicitly separates sources and labels them for Gemini:

| Section | Source | Weight |
|---|---|---|
| `authoritative` | `sololeveling.netmarble.com` only | Facts — treated as ground truth |
| `meta_reference` | `arise.tools` only | Strong reference — community-verified builds |
| `community_opinion` | `reddit.com/r/SoloLevelingArise` only | Context only — never treated as facts |

This prevents Reddit opinions from leaking into authoritative coaching advice.

### Confidence Score

After each refresh, a confidence score is computed and stored:

```python
def _compute_confidence(data: dict) -> float:
    score = 0.0
    auth = data.get("authoritative", {})
    meta = data.get("meta_reference", {})
    if auth.get("patch"):            score += 0.30
    if auth.get("new_hunters"):      score += 0.20
    if auth.get("active_banners"):   score += 0.10
    if meta.get("tier_ss"):          score += 0.25
    if meta.get("upcoming_banners"): score += 0.15
    return round(score, 2)
```

If `confidence < 0.5`, the pipeline automatically enables live search for all requests until the next successful refresh.

### Compactness Enforcement

Arrays are hard-capped post-generation to keep the snapshot small and token-cheap to inject:
- Tier lists: max 8 entries each
- `hot_topics`: max 5, each ≤ 10 words
- No patch notes text, no history, no banner schedules beyond current + upcoming

### Admin Endpoint

Force an immediate refresh after a major patch without waiting 30 minutes:

```
POST /api/v1/admin/refresh-snapshot
```

Returns:
```json
{
  "success": true,
  "patch": "2.1.0",
  "confidence": 0.95,
  "updated_at": "2026-06-23T14:30:00+00:00"
}
```

---

## 5. Caching System

### Implementation

`cachetools.TTLCache` — in-memory, no external infrastructure required.

```python
_response_cache: TTLCache = TTLCache(maxsize=500, ttl=1800)  # 500 items, 30 min
```

### Cache Key

The key is a `sha256` hash of the semantically meaningful request fields:

```python
def _cache_key(request: CoachRequest) -> str:
    payload = {
        "game_mode":        request.game_mode,
        "boss":             request.boss,
        "coaching_mode":    request.coaching_mode,
        "spending_level":   request.spending_level,
        "progression_stage": request.progression_stage,
        "question":         request.question,
        "hunters": sorted(
            (h.name, h.advancement, h.weapon, h.weapon_advancement)
            for h in request.hunters
        ),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
```

Battle power and Jin-Woo power are intentionally excluded — they affect stage detection but not the advice itself once the stage is resolved.

### Cache Behavior

- **Cache hit** — returns the stored dict immediately, no Gemini call, no prompt build. Typical latency: < 100ms.
- **Cache miss** — full pipeline runs. On successful parse, result is written to cache before returning.
- **Parse failure** — `{"parse_error": "..."}` responses are never cached. The next identical request will retry.
- **Streaming hits** — the cached result is emitted as a single `result` SSE event, bypassing the stream entirely.

### Target Latencies

| Request type | Target |
|---|---|
| Cache hit | < 100ms |
| Snapshot-only (no search) | < 4,000ms |
| Live search | < 8,000ms |

---

## 6. Streaming System

### How It Works

The streaming endpoint uses a thread-bridge pattern: the synchronous Gemini streaming API runs in a thread pool executor and communicates back to the async event loop via `asyncio.Queue` and `loop.call_soon_threadsafe`.

**Backend — `pipeline.py`:**

```python
def _sync_stream(client, model, prompt, use_search, queue: asyncio.Queue, loop):
    config = types.GenerateContentConfig(
        system_instruction=_SYSTEM_PROMPT,
        tools=[types.Tool(google_search=types.GoogleSearch())] if use_search else None
    )
    try:
        for chunk in client.models.generate_content_stream(model=model, contents=prompt, config=config):
            if chunk.text:
                loop.call_soon_threadsafe(queue.put_nowait, ("chunk", chunk.text))
    except Exception as e:
        loop.call_soon_threadsafe(queue.put_nowait, ("error", str(e)))
    finally:
        loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
```

The async generator yields SSE-formatted strings:

```
data: {"type": "chunk",  "text": "{\n  \"patch"}
data: {"type": "chunk",  "text": "_version\": \"2.1.0\""}
...
data: {"type": "result", "data": { ...full parsed JSON... }}
```

**Route — `routes/coach.py`:**

```python
@router.post("/stream")
async def strategy_stream(request: CoachRequest):
    return StreamingResponse(
        stream_strategy(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

**Frontend — `services/api.js`:**

```javascript
export async function getStrategyStream(payload, { onChunk, onResult, onError }) {
  const res = await fetch(`${BASE}/coach/stream`, { method: 'POST', ... });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();  // keep incomplete trailing line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const msg = JSON.parse(line.slice(6));
      if (msg.type === 'chunk')  onChunk?.(msg.text);
      if (msg.type === 'result') onResult(msg.data);
      if (msg.type === 'error')  onError(new Error(msg.message));
    }
  }
}
```

### UI Behavior

- While loading and no chunks received yet: shows "Consulting the Shadows" + mode-specific description.
- Once chunks arrive: shows a pulsing "Receiving live data — N chars" indicator.
- On `result` event: switches to `StrategyOutput` structured render.
- On `error` event: shows inline error message.

---

## 7. Search Strategy

### Decision Logic

```python
_SEARCH_KEYWORDS = frozenset({
    "patch", "update", "buff", "nerf", "latest", "new hunter",
    "when", "banner", "release", "hotfix", "rework",
})

def _should_search(request: CoachRequest) -> bool:
    if _snapshot_age_minutes() > 45:
        return True   # snapshot too stale
    if _get_snapshot_confidence() < 0.5:
        return True   # snapshot data incomplete
    if request.coaching_mode == "pull_advisor":
        return True   # banner schedules change daily
    q = (request.question or "").lower()
    if any(kw in q for kw in _SEARCH_KEYWORDS):
        return True   # user asking about volatile info
    if request.hunters:
        known = _get_snapshot_known_hunters()
        if known and request.hunters[0].name not in known:
            return True  # primary hunter not in snapshot tier list
    return False       # use snapshot + Gemini reasoning
```

### Rationale

Search adds 2–5 seconds of latency and consumes quota. For stable queries like "best Cha Hae-In build", a fresh snapshot plus Gemini's reasoning over that context produces equivalent quality without the overhead. Search is only enabled when the question is genuinely about information that changes faster than the 30-minute snapshot interval.

### Observed Impact

With a warm snapshot at ~94% confidence:
- ~72% of requests skip live search
- Latency for those requests drops from ~6s to ~2s
- Gemini API search quota is reserved for high-value volatile queries

---

## 8. Analytics

### Endpoint

```
GET /api/v1/coach/stats
```

Returns (all in-memory, resets on server restart):

```json
{
  "total_requests": 1243,
  "cache_hits": 537,
  "cache_misses": 706,
  "cache_hit_rate": "43.2%",
  "search_calls": 198,
  "no_search_calls": 508,
  "search_rate": "28.0%",
  "json_parse_failures": 2,
  "rate_limit_hits": 1,
  "latency": {
    "cache_hit_avg":  "12ms",
    "no_search_avg":  "2340ms",
    "search_avg":     "5820ms",
    "targets": {
      "cache_hit":  "<100ms",
      "no_search":  "<4000ms",
      "search":     "<8000ms"
    }
  },
  "feedback": {
    "helpful":      89,
    "wrong":        14,
    "regenerates":  22,
    "quality_rate": "86.4%"
  },
  "top_hunters": [
    ["Cha Hae-In", 234],
    ["Sung Jin-Woo", 198],
    ["Thomas Andre", 121]
  ],
  "cache_size": 47,
  "cache_maxsize": 500,
  "recent_requests": [
    {
      "mode": "strategy",
      "searched": false,
      "cache_hit": false,
      "hunters": ["Cha Hae-In", "Min Byung-Gu"],
      "q_len": 0,
      "ms": 2180,
      "ts": 1719148200.42
    }
  ]
}
```

### Interpreting the Numbers

| Metric | Healthy | Investigate if |
|---|---|---|
| `cache_hit_rate` | 40–60% | < 20% (key too granular?) |
| `search_rate` | 20–35% | > 60% (snapshot stale/low confidence?) |
| `no_search_avg` | < 4,000ms | > 6,000ms |
| `search_avg` | < 8,000ms | > 12,000ms |
| `quality_rate` | > 80% | < 70% (accuracy problem) |

### Request Log

The last 200 requests are stored in a `deque(maxlen=200)`. The `/stats` endpoint surfaces the 20 most recent. When a user reports bad advice, check `recent_requests` to see: was it a search or snapshot-only call? Which hunters were in the roster? How long did it take?

### Feedback Tracking

User feedback from the frontend "Helpful" / "Incorrect" / "Regenerate" buttons posts to:

```
POST /api/v1/coach/feedback
{
  "rating": 1,              // 1=helpful, -1=wrong, 0=regenerate
  "coaching_mode": "strategy",
  "regenerated": false
}
```

Stored in-memory (`_feedback_log`, max 500 entries). `quality_rate` in `/stats` is computed as `helpful / (helpful + wrong)`.

---

## 9. API Reference

### `POST /api/v1/coach/stream` — Streaming (primary)

Real-time SSE stream. Recommended for all frontend use.

**Request:**
```json
{
  "game_mode": "Workshop of Brilliant Light",
  "boss": "Vulcan",
  "battle_power": 1200000,
  "jinwoo_power": 850000,
  "spending_level": "f2p",
  "progression_stage": "endgame",
  "coaching_mode": "strategy",
  "question": null,
  "hunters": [
    { "name": "Cha Hae-In", "advancement": 3, "weapon": "SSR", "weapon_advancement": 2, "power": 50000 }
  ],
  "artifacts": [],
  "blessing_stones": []
}
```

**`coaching_mode` values:** `strategy` | `team_builder` | `pull_advisor` | `artifact_optimizer` | `boss_guide` | `future_planning` | `myth_bust`

**`spending_level` values:** `f2p` | `low` | `moderate` | `whale`

**`progression_stage` values:** `new` | `midgame` | `endgame` | `competitive`

**SSE events:**
```
data: {"type": "chunk",  "text": "partial JSON text..."}
data: {"type": "result", "data": { ...full response object... }}
data: {"type": "error",  "message": "error description"}
```

**Full response object shape:**
```json
{
  "patch_version": "2.1.0",
  "patch_verified": "June 2026",
  "confidence": "High",
  "confidence_reason": "Verified against official Netmarble patch notes + arise.tools",
  "progression_stage_detected": "endgame",
  "recommended_team": { "hunters": ["Cha Hae-In", "Min Byung-Gu", "Go Gunhee"], "reasoning": "..." },
  "why": "...",
  "rotation": { "steps": ["1. ...", "2. ...", "3. ..."] },
  "f2p_alternative": "...",
  "low_invest_alternative": "...",
  "beginner_alternative": "...",
  "artifacts_advice": "...",
  "artifact_optimization": {
    "best_sets": ["..."],
    "main_stats": ["..."],
    "substats": ["..."],
    "breakpoints": ["..."],
    "farming_priority": "...",
    "why": "...",
    "alternatives": ["..."],
    "when_recommendation_changes": "..."
  },
  "mistakes_to_avoid": ["..."],
  "expected_clear_rate": "85%",
  "battle_power_assessment": "...",
  "resource_warnings": [{ "subject": "...", "warning": "...", "alternative": "..." }],
  "pull_advice": { "recommendation": "Skip", "reasoning": "...", "upcoming_banners": ["..."], "resource_cost": "...", "f2p_verdict": "..." },
  "boss_strategy": { "attack_patterns": ["..."], "weaknesses": ["..."], "positioning_tips": ["..."], "skill_timing": ["..."], "common_mistakes": ["..."] },
  "future_planning": { "short_term": ["..."], "mid_term": ["..."], "long_term": ["..."] },
  "myths_busted": ["Myth: ... Reality: ... because ..."],
  "meta_changes": { "current_rank": "SS", "previous_rank": "S+", "reason": "..." },
  "missing_roles": ["Fire — Breaker"],
  "future_pulls": ["Choi Jong-In — fills critical Fire Breaker gap"]
}
```

### `POST /api/v1/coach/strategy` — Non-streaming (fallback)

Same request/response as above but returns the full JSON object synchronously when the stream completes. Useful for server-to-server calls or testing.

### `GET /api/v1/coach/stats`

Returns live analytics. See [Analytics](#8-analytics) section.

### `POST /api/v1/coach/feedback`

```json
{ "rating": 1, "coaching_mode": "strategy", "regenerated": false }
```

### `POST /api/v1/admin/refresh-snapshot`

Forces an immediate meta snapshot refresh. Returns patch version, confidence score, and timestamp.

### `GET /health`

```json
{ "status": "ok", "service": "arise-coach-backend" }
```

---

## 10. Project Structure

```
arise-coach/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py                    Route registration
│   │   │   └── routes/
│   │   │       ├── coach.py                 /strategy, /stream, /stats, /feedback
│   │   │       └── admin.py                 /admin/refresh-snapshot
│   │   ├── core/
│   │   │   └── config.py                    Settings (Pydantic BaseSettings, .env)
│   │   ├── rag/
│   │   │   └── pipeline.py                  Cache, search suppression, prompt builder,
│   │   │                                    streaming generator, analytics, rate-limit failover
│   │   ├── schemas/
│   │   │   └── coach.py                     CoachRequest, CoachResponse, FeedbackRequest
│   │   ├── services/
│   │   │   └── coach_service.py             Thin service layer over pipeline
│   │   ├── workers/
│   │   │   └── snapshot.py                  Background meta refresh worker
│   │   └── main.py                          FastAPI app, lifespan (starts snapshot worker), CORS
│   ├── meta_snapshot.json                   Auto-generated — do not edit manually
│   ├── .env                                 API keys (gitignored)
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        │   ├── CoachingModeSelector.js       7-mode tile grid + spending level chips + question input
        │   ├── GameModeSelector.js           Game mode + boss picker
        │   ├── RosterInput.js               Hunter roster (32 hunters, element badges, stage chips)
        │   ├── StrategyOutput.js            All 15 feature sections + FeedbackBar
        │   └── portal/
        │       └── PortalScene.js           Background portal animation
        ├── services/
        │   ├── api.js                       getStrategyStream(), postFeedback(), getStrategy()
        │   └── memory.js                    localStorage: saveRoster(), loadProfile(), etc.
        ├── App.js                           State management, streaming wiring, handleFeedback
        └── App.css                          Full design system (~1200 lines)
```

---

## 11. Setup

### Requirements

- Python 3.10+
- Node.js LTS
- 1–2 Gemini API keys ([aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free tier available)

### 1. Configure API keys

```bash
cd arise-coach/backend
copy .env.example .env
```

`.env`:
```env
GEMINI_API_KEY=AIza...your_first_key
GEMINI_API_KEY_2=AIza...your_second_key   # optional but recommended
LLM_MODEL=gemini-2.0-flash
```

### 2. Start the backend

```bash
cd arise-coach/backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`. On startup, the snapshot worker fires immediately (first refresh) then every 30 minutes.

### 3. Start the frontend

```bash
cd arise-coach/frontend
npm install --legacy-peer-deps
npm start
```

Opens at `http://localhost:3000`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_2` | No | Second key — used on rate-limit failover |
| `LLM_MODEL` | No | Gemini model (default: `gemini-2.0-flash`) |

---

## 12. Design Philosophy

**No SQL database.** Game meta changes too fast for manually maintained tables. The snapshot system auto-generates structured JSON from live sources every 30 minutes — zero human maintenance required.

**No vector database.** The prompt context is compact enough (roster + snapshot + mode instruction) that embedding search adds latency and complexity without meaningful accuracy gains at this scale.

**No LangChain or agent frameworks.** The pipeline is a single async generator with a synchronous Gemini call bridged to the event loop. Frameworks add abstraction without benefit here; the data flow is deterministic and straightforward.

**Cache first, search last.** The TTL cache is checked before anything else. The snapshot is injected before the search decision. Search is only enabled when neither the cache nor the snapshot is sufficient. This ordering minimizes API cost and latency without sacrificing accuracy.

**Explicit source weighting.** The snapshot prompt hard-codes which source populates which JSON section. Mixing Netmarble data, arise.tools tier lists, and Reddit opinions into a single unweighted blob degrades answer quality. Source separation lets Gemini apply the correct epistemic weight to each piece of context.

**Streaming before structure.** The frontend shows visible progress within ~500ms of submitting. Users perceive a streaming response as significantly faster than an identical wall-clock time spent waiting silently — even though the total time to a structured response is the same.

---

## 13. Future Improvements

These are identified gaps, not planned features:

**Accuracy tracking** — the feedback system captures `helpful` / `wrong` signals, but not *what* was wrong. A follow-up field asking "what was incorrect" (banner recommendation, build advice, boss strategy) would let you identify which coaching modes or game modes have accuracy problems.

**Smarter snapshot compression** — the current snapshot includes all three tier tiers (SS, S+, S). For low-BP players who will never interact with S-tier considerations, injecting the full tier list wastes tokens. Stage-aware snapshot injection (only inject tiers relevant to the detected stage) would reduce prompt size by ~30%.

**Rate-limit aware key rotation** — the current system cools a key for 60 seconds on any 429 error. Gemini's actual quota reset window varies by plan. Parsing the `Retry-After` header from the error response (when present) would give a more accurate cooldown duration.

**Evaluation dataset** — currently there is no ground truth to measure coaching quality against. Building even a small set of 20–30 manually verified (question, correct answer) pairs per coaching mode would allow automated regression testing after prompt changes.

**Cache warming** — the most-asked hunters (visible in `/stats`) could be pre-warmed on server startup or after a snapshot refresh, converting predictable first-request misses into hits.
