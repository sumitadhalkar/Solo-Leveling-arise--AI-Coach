# Solo Leveling: ARISE — AI Coach

A personalized strategy coach for Solo Leveling: ARISE. You tell it your exact roster, game mode, and boss — it searches the web for the latest guides and returns a strategy built specifically for your account.

> **"How do I beat this boss with my hunters?"** — not generic advice, your account.

---

## How It Works

```
You enter your roster + boss + game mode
              ↓
Backend sends request to Gemini with Google Search enabled
              ↓
Gemini searches arise.tools, Reddit, Fandom Wiki, Netmarble, Game8
              ↓
Returns personalized strategy as structured JSON
              ↓
Frontend displays team, rotation, artifacts, mistakes to avoid
```

No database. No setup scripts. Just two API keys and two terminals.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 |
| Backend | FastAPI (Python) |
| AI | Google Gemini 2.0 Flash |
| Web Search | Gemini Google Search grounding |
| API keys | 2× Gemini keys (round-robin for speed) |

---

## Knowledge Sources

Gemini is instructed to search these sites in priority order:

| Priority | Source | Used For |
|----------|--------|----------|
| 1st | [arise.tools](https://arise.tools) | Meta builds, team guides, tier lists, artifact optimization |
| 2nd | [r/SoloLevelingArise](https://reddit.com/r/SoloLevelingArise) | Real player strategies, boss tips, current meta |
| 3rd | [Fandom Wiki](https://solo-leveling-arise.fandom.com) | Hunter/boss/artifact/weapon data, skill mechanics |
| 4th | [Netmarble Official](https://sololeveling.netmarble.com/en) | Patch notes, balance changes |
| 5th | [Game8](https://game8.co/games/Solo-Leveling-Arise) | Boss walkthroughs, character builds |

---

## Project Structure

```
arise-coach/
├── backend/
│   ├── app/
│   │   ├── api/routes/coach.py     POST /api/v1/coach/strategy
│   │   ├── core/config.py          Settings (API keys, model)
│   │   ├── rag/pipeline.py         Gemini call + web search
│   │   ├── schemas/coach.py        Request / response shapes
│   │   └── main.py                 FastAPI app + CORS
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        │   ├── GameModeSelector.js  Mode + boss picker
        │   ├── RosterInput.js       Hunter roster builder
        │   └── StrategyOutput.js    Strategy display
        ├── services/api.js          API calls
        └── App.js                   Main layout
```

---

## Setup

### Requirements

- Python 3.10+
- Node.js LTS ([nodejs.org](https://nodejs.org))
- 2× Gemini API keys ([aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free)

### 1. Configure API keys

```bash
cd arise-coach/backend
copy .env.example .env
```

Open `.env` and fill in:

```env
GEMINI_API_KEY=AIza...your_first_key
GEMINI_API_KEY_2=AIza...your_second_key
LLM_MODEL=gemini-2.0-flash
```

### 2. Start the backend

```bash
cd arise-coach/backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`

### 3. Start the frontend

```bash
cd arise-coach/frontend
npm install --legacy-peer-deps
npm start
```

Opens at `http://localhost:3000`

---

## Usage

1. Select a **Game Mode** (Workshop, Guild Boss, Battlefield of Time, etc.)
2. Select the **Boss** you want to beat
3. Add your **hunters** with their advancement level, weapon rarity, and power
4. Enter your **Battle Power** and **Jin-Woo Power**
5. Click **Get Strategy**

The AI returns:

- **Recommended Team** — which of your hunters to use and why
- **Rotation** — step-by-step skill sequence
- **Artifacts & Gear** — what to equip
- **Mistakes to Avoid** — common errors for this boss
- **Expected Clear Rate** — realistic chance given your roster
- **Battle Power Assessment** — whether your BP is sufficient

---

## API

### `POST /api/v1/coach/strategy`

**Request:**
```json
{
  "game_mode": "Workshop of Brilliant Light",
  "boss": "Vulcan",
  "battle_power": 1200000,
  "jinwoo_power": 850000,
  "hunters": [
    {
      "name": "Cha Hae-In",
      "advancement": 3,
      "weapon": "SSR",
      "weapon_advancement": 2,
      "power": 50000
    }
  ],
  "artifacts": [],
  "blessing_stones": []
}
```

**Response:**
```json
{
  "recommended_team": {
    "hunters": ["Cha Hae-In", "Min Byung-Gu", "Go Gunhee"],
    "reasoning": "Light-element team exploits Vulcan's weakness..."
  },
  "why": "Vulcan is weak to water and light...",
  "rotation": {
    "steps": ["1. Open with Cha Hae-In's burst", "2. ..."]
  },
  "artifacts_advice": "Equip Rage sets for DPS hunters...",
  "mistakes_to_avoid": ["Don't stand in the fire rings", "..."],
  "expected_clear_rate": "85%",
  "battle_power_assessment": "Your BP is sufficient for Normal difficulty."
}
```

### `GET /health`
```json
{ "status": "ok", "service": "arise-coach-backend" }
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_2` | No | Second key — alternates with primary to double rate limits |
| `LLM_MODEL` | No | Gemini model (default: `gemini-2.0-flash`) |

---

## Dual API Key System

Requests rotate between both keys automatically:

```
Request 1 → Key 1
Request 2 → Key 2
Request 3 → Key 1
...
```

If only one key is set, it falls back to using that key for all requests. This doubles your effective rate limit on the free tier.
