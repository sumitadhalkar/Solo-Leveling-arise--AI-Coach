import { AnimatePresence, motion } from 'framer-motion';
import RosterInput from '../components/RosterInput';
import StrategyOutput from '../components/StrategyOutput';
import Icon from '../components/Icon';

const PULL_EXAMPLES = [
  'Should I pull Liu Zhigang?',
  'Is the current banner worth it for F2P?',
  'Should I save for the next banner instead?',
  'Is Cha Hae-In worth pulling as a new player?',
];

export default function PullAdvisorPage({
  spendingLevel, setSpendingLevel,
  question, setQuestion,
  hunters, setHunters,
  battlePower, setBattlePower,
  jinwooPower, setJinwooPower,
  progressionStage, setProgressionStage,
  gameMode, setGameMode, boss, setBoss,
  coachingMode, setCoachingMode,
  strategy, loading, error, streamChars, statusMessage,
  handleAnalyze, handleFeedback,
  onNavigate,
}) {
  return (
    <div className="app-body">
      <motion.aside
        className="sidebar"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="page-mode-header pull">
          <span className="page-mode-icon"><Icon name="target" size={19} /></span>
          <div>
            <div className="page-mode-title">Pull Advisor</div>
            <div className="page-mode-sub">Banner decisions & resource management</div>
          </div>
        </div>

        {/* Pull input — directly embedded, no mode grid */}
        <div className="card">
          <div className="card-title">Which character or banner?</div>
          <div className="question-field">
            <input
              type="text"
              value={question}
              placeholder='e.g. "Should I pull for Charlotte?"'
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading && hunters.length > 0) handleAnalyze(); }}
            />
            <div className="pull-examples">
              {PULL_EXAMPLES.map(ex => (
                <button key={ex} className="pull-example" onClick={() => setQuestion(ex)} type="button">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spending level */}
        <div className="card">
          <div className="card-title">Spending Level</div>
          <div className="spending-chips" style={{ marginTop: 0 }}>
            {[
              { value: 'f2p',      label: 'F2P'         },
              { value: 'low',      label: 'Low Spender'  },
              { value: 'moderate', label: 'Moderate'     },
              { value: 'whale',    label: 'Whale'        },
            ].map(({ value, label }) => (
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

        <RosterInput
          hunters={hunters}           setHunters={setHunters}
          battlePower={battlePower}   setBattlePower={setBattlePower}
          jinwooPower={jinwooPower}   setJinwooPower={setJinwooPower}
          progressionStage={progressionStage} setProgressionStage={setProgressionStage}
        />

        <motion.button
          className="analyze-btn pull-theme"
          onClick={handleAnalyze}
          disabled={loading || hunters.length === 0}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Consulting Shadows…' : <><Icon name="target" size={16} /> Get Pull Advice</>}
        </motion.button>

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-msg"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="empty-glyph" style={{ color: 'var(--gold)' }}><Icon name="diamond" size={40} /></div>
              <div className="empty-title">Consulting the Shadows</div>
              <div className="empty-desc">
                Checking current &amp; upcoming banners against your account needs…
              </div>
              {statusMessage && (
                <motion.div
                  className="status-msg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {statusMessage}
                </motion.div>
              )}
              {streamChars > 0 && (
                <motion.div className="stream-indicator" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="stream-pulse" />
                  <span className="stream-label">Receiving live data</span>
                  <span className="stream-count">{streamChars.toLocaleString()} chars</span>
                </motion.div>
              )}
            </motion.div>
          )}
          {!loading && strategy && (
            <motion.div key="strategy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <StrategyOutput
                strategy={strategy}
                gameMode={gameMode}
                boss={boss}
                coachingMode="pull_advisor"
                onRegenerate={handleAnalyze}
                onFeedback={handleFeedback}
                onSwitchMode={(m) => onNavigate(m === 'analyze' ? 'analyze' : 'pull')}
              />
            </motion.div>
          )}
          {!loading && !strategy && (
            <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="empty-glyph" style={{ color: 'var(--gold)' }}><Icon name="target" size={38} /></div>
              <div className="empty-title">Pull Advisor Ready</div>
              <div className="empty-desc">
                Add your roster, type the hunter or banner name in the left panel, then hit{' '}
                <strong style={{ color: 'var(--gold)' }}>Get Pull Advice</strong>. You'll get a{' '}
                <strong style={{ color: 'var(--gold)' }}>PULL / SKIP</strong> verdict with
                pros, cons, F2P sustainability, and alternatives.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
