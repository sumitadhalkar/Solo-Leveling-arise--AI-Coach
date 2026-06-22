import { motion } from 'framer-motion';

const HUNTER_ELEMENT = {
  'Cha Hae-In': 'light', 'Min Byung-Gu': 'light', 'Go Gunhee': 'light',
  'Alicia': 'water', 'Emma': 'water', 'Park Heejin': 'water',
  'Lim Tae-Gyu': 'fire', 'Choi Jong-In': 'fire', 'Hwang Dongsuk': 'fire',
  'Baek Yoonho': 'earth', 'Woo Jinchul': 'wind', 'Lee Joohee': 'wind',
  'Sung Jin-Woo': 'dark',
};

const CHIP_STYLE = {
  light: { background: 'rgba(245,208,96,0.12)', border: '1px solid rgba(245,208,96,0.40)', color: 'var(--el-light)' },
  water: { background: 'rgba(80,176,240,0.12)', border: '1px solid rgba(80,176,240,0.40)', color: 'var(--el-water)' },
  fire:  { background: 'rgba(240,112,80,0.12)', border: '1px solid rgba(240,112,80,0.40)', color: 'var(--el-fire)' },
  earth: { background: 'rgba(112,192,96,0.12)', border: '1px solid rgba(112,192,96,0.40)', color: 'var(--el-earth)' },
  wind:  { background: 'rgba(96,216,208,0.12)', border: '1px solid rgba(96,216,208,0.40)', color: 'var(--el-wind)' },
  dark:  { background: 'rgba(144,96,240,0.12)', border: '1px solid rgba(144,96,240,0.40)', color: 'var(--el-dark)' },
  default: { background: 'rgba(201,162,39,0.10)', border: '1px solid rgba(201,162,39,0.35)', color: 'var(--gold-light)' },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

export default function StrategyOutput({ strategy, gameMode, boss }) {
  if (strategy.parse_error) {
    return (
      <div className="raw-response">
        <div className="section-eyebrow">Raw Response</div>
        <pre>{strategy.raw_response}</pre>
      </div>
    );
  }

  const { recommended_team, why, rotation, artifacts_advice, mistakes_to_avoid, expected_clear_rate, battle_power_assessment } = strategy;

  return (
    <motion.div className="strategy" variants={container} initial="hidden" animate="show">

      <div className="strategy-header">
        <h2>{boss || gameMode}</h2>
        <span className="mode-label">{gameMode}</span>
      </div>

      {recommended_team && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Recommended Team</div>
          <div className="team-chips">
            {(recommended_team.hunters || []).map(name => {
              const el = HUNTER_ELEMENT[name] || 'default';
              return (
                <span key={name} className="team-chip" style={CHIP_STYLE[el]}>{name}</span>
              );
            })}
          </div>
          {recommended_team.reasoning && (
            <p className="strategy-text">{recommended_team.reasoning}</p>
          )}
        </motion.div>
      )}

      {why && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Why This Works</div>
          <p className="strategy-text">{why}</p>
        </motion.div>
      )}

      {rotation?.steps?.length > 0 && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Rotation</div>
          <ul className="rotation-steps">
            {rotation.steps.map((step, i) => (
              <li key={i}>
                <span className="step-num">{i + 1}</span>
                <span className="strategy-text">{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {artifacts_advice && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Artifacts &amp; Gear</div>
          <p className="strategy-text">{artifacts_advice}</p>
        </motion.div>
      )}

      {mistakes_to_avoid?.length > 0 && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Mistakes to Avoid</div>
          <ul className="mistakes-list">
            {mistakes_to_avoid.map((m, i) => (
              <li key={i}>
                <span className="mistake-mark">✕</span>
                <span className="strategy-text">{m}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {(expected_clear_rate || battle_power_assessment) && (
        <motion.div className="strategy-section" variants={item}>
          <div className="section-eyebrow">Assessment</div>
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
        </motion.div>
      )}

    </motion.div>
  );
}
