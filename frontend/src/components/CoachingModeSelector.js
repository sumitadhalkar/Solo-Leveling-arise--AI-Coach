import { motion } from 'framer-motion';

const MODES = [
  { key: 'strategy',           icon: '⚔',  label: 'Strategy',    desc: 'Team, rotation & builds' },
  { key: 'team_builder',       icon: '👥',  label: 'Team Builder',desc: 'Full roster analysis' },
  { key: 'pull_advisor',       icon: '💎',  label: 'Pull Advisor',desc: 'Worth pulling?' },
  { key: 'artifact_optimizer', icon: '🔮',  label: 'Artifacts',   desc: 'Deep gear optimization' },
  { key: 'boss_guide',         icon: '🏆',  label: 'Boss Guide',  desc: 'Attack patterns & tips' },
  { key: 'future_planning',    icon: '📈',  label: 'Road Map',    desc: '1–3 month goals' },
  { key: 'myth_bust',          icon: '🔍',  label: 'Myth Bust',   desc: 'Correct misconceptions' },
];

const SPENDING_OPTS = [
  { value: 'f2p',      label: 'F2P',       desc: 'Free-to-play only' },
  { value: 'low',      label: 'Low Spender',desc: 'Occasional packs' },
  { value: 'moderate', label: 'Moderate',   desc: 'Monthly passes' },
  { value: 'whale',    label: 'Whale',      desc: 'No budget limits' },
];

export default function CoachingModeSelector({
  coachingMode, setCoachingMode,
  spendingLevel, setSpendingLevel,
  question, setQuestion,
}) {
  const needsQuestion = coachingMode === 'pull_advisor' || coachingMode === 'myth_bust';

  return (
    <div className="card">
      <div className="card-title">Coaching Mode</div>

      <div className="coaching-mode-grid">
        {MODES.map(({ key, icon, label, desc }) => (
          <motion.button
            key={key}
            className={`coaching-tile${coachingMode === key ? ' active' : ''}`}
            onClick={() => setCoachingMode(key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            title={desc}
          >
            <span className="coaching-tile-icon">{icon}</span>
            <span className="coaching-tile-label">{label}</span>
          </motion.button>
        ))}
      </div>

      {needsQuestion && (
        <motion.div
          className="question-field"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <label>
            {coachingMode === 'pull_advisor'
              ? 'Which character / banner?'
              : 'What misconception to debunk?'}
          </label>
          <input
            type="text"
            value={question}
            placeholder={
              coachingMode === 'pull_advisor'
                ? 'e.g. "Should I pull Liu Zhigang?"'
                : 'e.g. "Is Charlotte still better than Minnie?"'
            }
            onChange={e => setQuestion(e.target.value)}
          />
        </motion.div>
      )}

      <div className="spending-row">
        <div className="spending-label">Spending Level</div>
        <div className="spending-chips">
          {SPENDING_OPTS.map(({ value, label }) => (
            <motion.button
              key={value}
              className={`spending-chip${spendingLevel === value ? ' active' : ''}`}
              onClick={() => setSpendingLevel(value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
