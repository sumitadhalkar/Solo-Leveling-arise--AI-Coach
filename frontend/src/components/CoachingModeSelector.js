import { AnimatePresence, motion } from 'framer-motion';

const ANALYZE_MODES = [
  { key: 'strategy',           icon: '⚔',  label: 'Strategy',    desc: 'Team, rotation & builds' },
  { key: 'team_builder',       icon: '👥',  label: 'Team Builder',desc: 'Full roster analysis' },
  { key: 'artifact_optimizer', icon: '🔮',  label: 'Artifacts',   desc: 'Deep gear optimization' },
  { key: 'boss_guide',         icon: '🏆',  label: 'Boss Guide',  desc: 'Attack patterns & tips' },
  { key: 'future_planning',    icon: '📈',  label: 'Road Map',    desc: '1–3 month goals' },
  { key: 'myth_bust',          icon: '🔍',  label: 'Myth Bust',   desc: 'Correct misconceptions' },
];

const SPENDING_OPTS = [
  { value: 'f2p',      label: 'F2P' },
  { value: 'low',      label: 'Low Spender' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'whale',    label: 'Whale' },
];

const PULL_EXAMPLES = [
  'Should I pull Liu Zhigang?',
  'Is this banner worth it for F2P?',
  'Skip or summon decision?',
];

export default function CoachingModeSelector({
  primaryMode = 'analyze', setPrimaryMode,
  coachingMode, setCoachingMode,
  spendingLevel, setSpendingLevel,
  question, setQuestion,
  loading,
}) {
  function handlePrimarySwitch(mode) {
    setPrimaryMode(mode);
    if (mode === 'pull') {
      setCoachingMode('pull_advisor');
    } else if (coachingMode === 'pull_advisor') {
      setCoachingMode('strategy');
    }
  }

  return (
    <div className="card">
      <div className="card-title">Mode</div>

      {/* Primary toggle — only shown when not inside a dedicated page */}
      {typeof setPrimaryMode === 'function' && <div className="primary-mode-toggle">
        {[
          { key: 'analyze', icon: '🧠', label: 'Analyze Team', desc: 'Builds & strategy' },
          { key: 'pull',    icon: '🎯', label: 'Pull Advisor',  desc: 'Banner decisions' },
        ].map(({ key, icon, label, desc }) => {
          const isActive = primaryMode === key;
          const isLoading = loading && isActive;
          return (
            <motion.button
              key={key}
              className={`primary-mode-btn ${key}${isActive ? ' active' : ''}${isLoading ? ' loading-active' : ''}`}
              onClick={() => handlePrimarySwitch(key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="pmb-icon">{icon}</span>
              <span className="pmb-label">{label}</span>
              <span className="pmb-desc">{desc}</span>
            </motion.button>
          );
        })}
      </div>}

      {/* Analyze sub-modes */}
      <AnimatePresence initial={false}>
        {primaryMode === 'analyze' && (
          <motion.div
            key="analyze-submodes"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="coaching-mode-grid" style={{ marginTop: 12 }}>
              {ANALYZE_MODES.map(({ key, icon, label, desc }) => (
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

            <AnimatePresence initial={false}>
              {coachingMode === 'myth_bust' && (
                <motion.div
                  key="myth-input"
                  className="question-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginTop: 10, overflow: 'hidden' }}
                >
                  <label>What misconception to debunk?</label>
                  <input
                    type="text"
                    value={question}
                    placeholder='e.g. "Is Charlotte still better than Minnie?"'
                    onChange={e => setQuestion(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pull Advisor input */}
      <AnimatePresence initial={false}>
        {primaryMode === 'pull' && (
          <motion.div
            key="pull-input"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="question-field" style={{ marginTop: 12 }}>
              <label>Which character or banner?</label>
              <input
                type="text"
                value={question}
                placeholder='e.g. "Should I pull for Cha Hae-In?"'
                onChange={e => setQuestion(e.target.value)}
              />
              <div className="pull-examples">
                {PULL_EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    className="pull-example"
                    onClick={() => setQuestion(ex)}
                    type="button"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="spending-row" style={{ marginTop: 12 }}>
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
