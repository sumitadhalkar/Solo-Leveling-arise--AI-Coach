import { useState } from 'react';
import { motion } from 'framer-motion';

// ── Element colour maps ──────────────────────────────────────────────────────
const HUNTER_ELEMENT = {
  'Cha Hae-In': 'light', 'Min Byung-Gu': 'light', 'Go Gunhee': 'light',
  'Thomas Andre': 'light', 'Akari': 'light', 'Antoine Martinez': 'light',
  'Alicia': 'water', 'Emma': 'water', 'Park Heejin': 'water',
  'Elena Renault': 'water', 'Mary Lane': 'water', 'Cha Hae-In [Pure Sword]': 'water',
  'Lim Tae-Gyu': 'fire', 'Choi Jong-In': 'fire', 'Hwang Dongsuk': 'fire',
  'Tawata Kanae': 'fire', 'Liu Zhigang': 'fire', 'Christopher Reed': 'fire', 'Gina': 'fire',
  'Baek Yoonho': 'earth',
  'Woo Jinchul': 'wind', 'Lee Joohee': 'wind', 'Amamiya Mirei': 'wind',
  'Sugamoto Reggie': 'wind', 'Leonard': 'wind', 'Jenna': 'wind',
  'Sung Jin-Woo': 'dark', 'Charlotte': 'dark', 'Minnie': 'dark',
  'Seorin': 'dark', 'Sian Halat': 'dark', 'Son Kihoon': 'dark',
};

const CHIP_STYLE = {
  light:   { background: 'rgba(245,208,96,0.12)',  border: '1px solid rgba(245,208,96,0.40)',  color: 'var(--el-light)' },
  water:   { background: 'rgba(80,176,240,0.12)',  border: '1px solid rgba(80,176,240,0.40)',  color: 'var(--el-water)' },
  fire:    { background: 'rgba(240,112,80,0.12)',  border: '1px solid rgba(240,112,80,0.40)',  color: 'var(--el-fire)' },
  earth:   { background: 'rgba(112,192,96,0.12)',  border: '1px solid rgba(112,192,96,0.40)',  color: 'var(--el-earth)' },
  wind:    { background: 'rgba(96,216,208,0.12)',  border: '1px solid rgba(96,216,208,0.40)',  color: 'var(--el-wind)' },
  dark:    { background: 'rgba(144,96,240,0.12)',  border: '1px solid rgba(144,96,240,0.40)',  color: 'var(--el-dark)' },
  default: { background: 'rgba(201,162,39,0.10)',  border: '1px solid rgba(201,162,39,0.35)', color: 'var(--gold-light)' },
};

const CONFIDENCE_STYLE = {
  High:   { color: '#60e860', bg: 'rgba(96,232,96,0.10)',   border: 'rgba(96,232,96,0.30)' },
  Medium: { color: '#e8c04a', bg: 'rgba(232,192,74,0.10)',  border: 'rgba(232,192,74,0.30)' },
  Low:    { color: '#e05555', bg: 'rgba(224,85,85,0.10)',   border: 'rgba(224,85,85,0.30)' },
};

const PULL_COLOR = {
  'Pull':         '#60e860',
  'Soft Pull':    '#e8c04a',
  'Skip':         '#e05555',
  'Skip (F2P)':   '#f07050',
};

// ── Animation variants ───────────────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' } } };

// ── Helper sub-components ────────────────────────────────────────────────────
function Section({ eyebrow, children }) {
  return (
    <motion.div className="strategy-section" variants={item}>
      <div className="section-eyebrow">{eyebrow}</div>
      {children}
    </motion.div>
  );
}

function BulletList({ items, mark, markClass }) {
  return (
    <ul className="bullet-list">
      {items.map((t, i) => (
        <li key={i}>
          <span className={markClass || 'bullet-dot'}>{mark || '◈'}</span>
          <span className="strategy-text">{t}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Feedback bar ─────────────────────────────────────────────────────────────
function FeedbackBar({ coachingMode, onRegenerate, onFeedback }) {
  const [sent, setSent] = useState(null); // null | 'up' | 'down'

  function rate(val) {
    if (sent) return;
    setSent(val > 0 ? 'up' : 'down');
    onFeedback?.(val, coachingMode);
  }

  function regen() {
    onFeedback?.(0, coachingMode, true);
    onRegenerate?.();
  }

  return (
    <div className="feedback-bar">
      <div className="feedback-rating">
        <button
          className={`feedback-btn helpful${sent === 'up' ? ' active' : ''}`}
          onClick={() => rate(1)}
          disabled={!!sent}
          title="This advice was helpful"
        >
          Helpful
        </button>
        <button
          className={`feedback-btn wrong${sent === 'down' ? ' active' : ''}`}
          onClick={() => rate(-1)}
          disabled={!!sent}
          title="This advice was wrong or outdated"
        >
          Incorrect
        </button>
        {sent && <span className="feedback-thanks">Recorded — thanks</span>}
      </div>
      <button className="regen-btn" onClick={regen} title="Re-run this analysis">
        Regenerate
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function StrategyOutput({ strategy, gameMode, boss, coachingMode, onRegenerate, onFeedback }) {
  if (strategy.parse_error) {
    return (
      <div className="raw-response">
        <div className="section-eyebrow">Raw Response</div>
        <pre>{strategy.raw_response}</pre>
      </div>
    );
  }

  const {
    // Core
    recommended_team, why, rotation,
    // Gear
    artifacts_advice, artifact_optimization,
    // Avoidance + assessment
    mistakes_to_avoid, expected_clear_rate, battle_power_assessment,
    // Feature 1 – patch
    patch_version, patch_verified,
    // Feature 2 – spending tiers
    f2p_alternative, low_invest_alternative, beginner_alternative,
    // Feature 3 – progression
    progression_stage_detected,
    // Feature 4 – resource warnings
    resource_warnings,
    // Feature 6 – pull advice
    pull_advice,
    // Feature 8 – boss strategy
    boss_strategy,
    // Feature 10 – confidence
    confidence, confidence_reason,
    // Feature 11 – myth busting
    myths_busted,
    // Feature 12 – future planning
    future_planning,
    // Feature 15 – meta changes
    meta_changes,
    // Feature 5 – team builder
    missing_roles, future_pulls,
  } = strategy;

  const conf = CONFIDENCE_STYLE[confidence] || CONFIDENCE_STYLE['Medium'];
  const pullColor = PULL_COLOR[pull_advice?.recommendation] || 'var(--gold-light)';

  return (
    <motion.div className="strategy" variants={container} initial="hidden" animate="show">

      {/* ── Header bar ──────────────────────────────────────── */}
      <div className="strategy-header">
        <h2>{boss || gameMode}</h2>
        <span className="mode-label">{gameMode}</span>
        <div className="header-meta">
          {patch_version && (
            <span className="patch-badge" title={`Verified: ${patch_verified || 'unknown'}`}>
              Patch {patch_version}
            </span>
          )}
          {progression_stage_detected && (
            <span className="stage-badge">{progression_stage_detected}</span>
          )}
          {confidence && (
            <span
              className="confidence-badge"
              style={{ color: conf.color, background: conf.bg, borderColor: conf.border }}
              title={confidence_reason}
            >
              {confidence} Confidence
            </span>
          )}
        </div>
      </div>

      {/* Feature 10 – confidence reason tooltip row */}
      {confidence_reason && (
        <motion.div className="confidence-reason" variants={item}>
          <span className="conf-icon">◈</span> {confidence_reason}
        </motion.div>
      )}

      {/* ── Feature 15 – Meta Change Tracking ────────────── */}
      {meta_changes?.current_rank && (
        <Section eyebrow="Meta Change Tracking">
          <div className="meta-change-row">
            <div className="meta-rank-block">
              <span className="meta-rank-label">Previous</span>
              <span className="meta-rank prev">{meta_changes.previous_rank}</span>
            </div>
            <span className="meta-arrow">→</span>
            <div className="meta-rank-block">
              <span className="meta-rank-label">Current</span>
              <span className="meta-rank current">{meta_changes.current_rank}</span>
            </div>
          </div>
          {meta_changes.reason && (
            <p className="strategy-text" style={{ marginTop: 10 }}>{meta_changes.reason}</p>
          )}
        </Section>
      )}

      {/* ── Recommended Team ─────────────────────────────── */}
      {recommended_team?.hunters?.length > 0 && (
        <Section eyebrow="Recommended Team">
          <div className="team-chips">
            {recommended_team.hunters.map(name => {
              const el = HUNTER_ELEMENT[name] || 'default';
              return (
                <span key={name} className="team-chip" style={CHIP_STYLE[el]}>{name}</span>
              );
            })}
          </div>
          {recommended_team.reasoning && (
            <p className="strategy-text">{recommended_team.reasoning}</p>
          )}
        </Section>
      )}

      {/* ── Why This Works ───────────────────────────────── */}
      {why && (
        <Section eyebrow="Why This Works">
          <p className="strategy-text">{why}</p>
        </Section>
      )}

      {/* ── Rotation ─────────────────────────────────────── */}
      {rotation?.steps?.length > 0 && (
        <Section eyebrow="Rotation">
          <ul className="rotation-steps">
            {rotation.steps.map((step, i) => (
              <li key={i}>
                <span className="step-num">{i + 1}</span>
                <span className="strategy-text">{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Feature 2 – Spending Tier Alternatives ───────── */}
      {(f2p_alternative || low_invest_alternative || beginner_alternative) && (
        <Section eyebrow="Budget Alternatives">
          <div className="alt-tiers">
            {f2p_alternative && (
              <div className="alt-tier">
                <span className="alt-tier-label f2p">F2P</span>
                <p className="strategy-text">{f2p_alternative}</p>
              </div>
            )}
            {low_invest_alternative && (
              <div className="alt-tier">
                <span className="alt-tier-label low">Low Invest</span>
                <p className="strategy-text">{low_invest_alternative}</p>
              </div>
            )}
            {beginner_alternative && (
              <div className="alt-tier">
                <span className="alt-tier-label beginner">Beginner</span>
                <p className="strategy-text">{beginner_alternative}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Feature 4 – Resource Warnings ────────────────── */}
      {resource_warnings?.length > 0 && (
        <Section eyebrow="Resource Warnings">
          <div className="resource-warnings">
            {resource_warnings.map((w, i) => (
              <div key={i} className="resource-warning">
                <div className="rw-header">
                  <span className="rw-icon">⚠</span>
                  <span className="rw-subject">{w.subject}</span>
                </div>
                <p className="strategy-text rw-warning">{w.warning}</p>
                <p className="strategy-text rw-alt">
                  <span className="rw-alt-label">Better use: </span>{w.alternative}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Feature 7 – Artifact Optimization (detailed) ─── */}
      {artifact_optimization?.best_sets?.length > 0 ? (
        <Section eyebrow="Artifact Optimization">
          <div className="artifact-grid">
            <div className="artifact-col">
              <div className="artifact-col-label">Best Sets</div>
              <BulletList items={artifact_optimization.best_sets} />
            </div>
            <div className="artifact-col">
              <div className="artifact-col-label">Main Stats</div>
              <BulletList items={artifact_optimization.main_stats} />
            </div>
            <div className="artifact-col">
              <div className="artifact-col-label">Substats</div>
              <BulletList items={artifact_optimization.substats} />
            </div>
            {artifact_optimization.breakpoints?.length > 0 && (
              <div className="artifact-col">
                <div className="artifact-col-label">Breakpoints</div>
                <BulletList items={artifact_optimization.breakpoints} />
              </div>
            )}
          </div>
          {artifact_optimization.farming_priority && (
            <div className="artifact-farm">
              <span className="artifact-farm-label">Farming Priority:</span>{' '}
              <span className="strategy-text">{artifact_optimization.farming_priority}</span>
            </div>
          )}
          {artifact_optimization.why && (
            <div className="artifact-why">
              <span className="artifact-why-label">Why this set:</span>
              <p className="strategy-text">{artifact_optimization.why}</p>
            </div>
          )}
          {artifact_optimization.alternatives?.length > 0 && (
            <div className="artifact-alts">
              <span className="artifact-why-label">Alternatives:</span>
              <BulletList items={artifact_optimization.alternatives} />
            </div>
          )}
          {artifact_optimization.when_recommendation_changes && (
            <div className="artifact-change">
              <span className="artifact-why-label">Changes when:</span>{' '}
              <span className="strategy-text">{artifact_optimization.when_recommendation_changes}</span>
            </div>
          )}
        </Section>
      ) : artifacts_advice ? (
        <Section eyebrow="Artifacts &amp; Gear">
          <p className="strategy-text">{artifacts_advice}</p>
        </Section>
      ) : null}

      {/* ── Feature 8 – Boss Strategy ─────────────────────── */}
      {boss_strategy && (
        <Section eyebrow="Boss Strategy">
          {boss_strategy.weaknesses?.length > 0 && (
            <div className="boss-subsection">
              <div className="boss-sub-label">Weaknesses</div>
              <BulletList items={boss_strategy.weaknesses} mark="◉" markClass="bullet-weakness" />
            </div>
          )}
          {boss_strategy.attack_patterns?.length > 0 && (
            <div className="boss-subsection">
              <div className="boss-sub-label">Attack Patterns</div>
              <BulletList items={boss_strategy.attack_patterns} mark="▸" markClass="bullet-pattern" />
            </div>
          )}
          {boss_strategy.positioning_tips?.length > 0 && (
            <div className="boss-subsection">
              <div className="boss-sub-label">Positioning</div>
              <BulletList items={boss_strategy.positioning_tips} mark="⊹" markClass="bullet-position" />
            </div>
          )}
          {boss_strategy.skill_timing?.length > 0 && (
            <div className="boss-subsection">
              <div className="boss-sub-label">Skill Timing</div>
              <BulletList items={boss_strategy.skill_timing} mark="⏱" markClass="bullet-timing" />
            </div>
          )}
          {boss_strategy.common_mistakes?.length > 0 && (
            <div className="boss-subsection">
              <div className="boss-sub-label">Common Mistakes</div>
              <ul className="mistakes-list">
                {boss_strategy.common_mistakes.map((m, i) => (
                  <li key={i}>
                    <span className="mistake-mark">✕</span>
                    <span className="strategy-text">{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ── Feature 6 – Pull Advisor ─────────────────────── */}
      {pull_advice && (
        <Section eyebrow="Pull Advisor">
          <div className="pull-verdict" style={{ borderColor: pullColor, color: pullColor }}>
            {pull_advice.recommendation}
          </div>
          <p className="strategy-text" style={{ marginTop: 10 }}>{pull_advice.reasoning}</p>
          {pull_advice.resource_cost && (
            <div className="pull-cost">
              <span className="pull-cost-label">Resource cost:</span>{' '}
              <span className="strategy-text">{pull_advice.resource_cost}</span>
            </div>
          )}
          {pull_advice.f2p_verdict && (
            <div className="pull-f2p">
              <span className="pull-f2p-label">F2P verdict:</span>
              <p className="strategy-text">{pull_advice.f2p_verdict}</p>
            </div>
          )}
          {pull_advice.upcoming_banners?.length > 0 && (
            <div className="pull-upcoming">
              <div className="pull-upcoming-label">Upcoming Banners to Consider</div>
              <BulletList items={pull_advice.upcoming_banners} mark="◈" />
            </div>
          )}
        </Section>
      )}

      {/* ── Feature 5 – Team Builder Results ─────────────── */}
      {(missing_roles?.length > 0 || future_pulls?.length > 0) && (
        <Section eyebrow="Roster Analysis">
          {missing_roles?.length > 0 && (
            <div className="team-builder-block">
              <div className="tb-label">Missing Roles</div>
              <BulletList items={missing_roles} mark="✗" markClass="bullet-missing" />
            </div>
          )}
          {future_pulls?.length > 0 && (
            <div className="team-builder-block">
              <div className="tb-label">Recommended Future Pulls</div>
              <BulletList items={future_pulls} mark="★" markClass="bullet-pull" />
            </div>
          )}
        </Section>
      )}

      {/* ── Mistakes to Avoid ─────────────────────────────── */}
      {mistakes_to_avoid?.length > 0 && (
        <Section eyebrow="Mistakes to Avoid">
          <ul className="mistakes-list">
            {mistakes_to_avoid.map((m, i) => (
              <li key={i}>
                <span className="mistake-mark">✕</span>
                <span className="strategy-text">{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Feature 11 – Myth Busting ─────────────────────── */}
      {myths_busted?.length > 0 && (
        <Section eyebrow="Myth Busting">
          <div className="myth-list">
            {myths_busted.map((m, i) => (
              <div key={i} className="myth-item">
                <span className="myth-icon">🔍</span>
                <p className="strategy-text">{m}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Feature 12 – Future Planning ─────────────────── */}
      {future_planning && (
        <Section eyebrow="Progression Road Map">
          <div className="planning-grid">
            {future_planning.short_term?.length > 0 && (
              <div className="planning-col">
                <div className="planning-col-label short">Short-term (1–2 wks)</div>
                <BulletList items={future_planning.short_term} />
              </div>
            )}
            {future_planning.mid_term?.length > 0 && (
              <div className="planning-col">
                <div className="planning-col-label mid">Mid-term (1 mo)</div>
                <BulletList items={future_planning.mid_term} />
              </div>
            )}
            {future_planning.long_term?.length > 0 && (
              <div className="planning-col">
                <div className="planning-col-label long">Long-term (2–3 mo)</div>
                <BulletList items={future_planning.long_term} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Assessment ───────────────────────────────────── */}
      {(expected_clear_rate || battle_power_assessment) && (
        <Section eyebrow="Assessment">
          <div className="assessment-row">
            {expected_clear_rate && (
              <div className="assessment-card">
                <label>Expected Clear Rate</label>
                <div className="val">{expected_clear_rate}</div>
              </div>
            )}
            {battle_power_assessment && (
              <div className="assessment-card" style={{ flex: 2 }}>
                <label>Battle Power</label>
                <div className="desc">{battle_power_assessment}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Feedback + Regenerate ────────────────────────── */}
      <FeedbackBar
        coachingMode={coachingMode}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
      />

    </motion.div>
  );
}
