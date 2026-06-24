import { AnimatePresence, motion } from 'framer-motion';
import CoachingModeSelector from '../components/CoachingModeSelector';
import GameModeSelector from '../components/GameModeSelector';
import RosterInput from '../components/RosterInput';
import StrategyOutput from '../components/StrategyOutput';

const MODE_LABEL = {
  strategy:           'Strategy',
  team_builder:       'Team Builder',
  artifact_optimizer: 'Artifacts',
  boss_guide:         'Boss Guide',
  future_planning:    'Road Map',
  myth_bust:          'Myth Bust',
};

const loadingDesc = {
  strategy:           'Searching arise.tools, Reddit & Netmarble for the latest strategies…',
  team_builder:       'Analyzing your roster and building optimal team compositions…',
  artifact_optimizer: 'Calculating artifact breakpoints and farming priority…',
  boss_guide:         'Compiling attack patterns, weaknesses, and positioning tips…',
  future_planning:    'Building your personalized progression roadmap…',
  myth_bust:          'Searching official patch notes to verify or correct community claims…',
};

export default function AnalyzePage({
  gameMode, setGameMode, boss, setBoss,
  coachingMode, setCoachingMode,
  spendingLevel, setSpendingLevel,
  progressionStage, setProgressionStage,
  question, setQuestion,
  hunters, setHunters,
  battlePower, setBattlePower,
  jinwooPower, setJinwooPower,
  strategy, loading, error, streamChars,
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
        <div className="page-mode-header analyze">
          <span className="page-mode-icon">🧠</span>
          <div>
            <div className="page-mode-title">Analyze Team</div>
            <div className="page-mode-sub">Builds, strategy & progression</div>
          </div>
        </div>

        {/* Mode selector — no primary toggle in page context */}
        <CoachingModeSelector
          coachingMode={coachingMode}     setCoachingMode={setCoachingMode}
          spendingLevel={spendingLevel}   setSpendingLevel={setSpendingLevel}
          question={question}             setQuestion={setQuestion}
          loading={loading}
        />

        <GameModeSelector
          gameMode={gameMode} setGameMode={setGameMode}
          boss={boss} setBoss={setBoss}
        />

        <RosterInput
          hunters={hunters}           setHunters={setHunters}
          battlePower={battlePower}   setBattlePower={setBattlePower}
          jinwooPower={jinwooPower}   setJinwooPower={setJinwooPower}
          progressionStage={progressionStage} setProgressionStage={setProgressionStage}
        />

        <motion.button
          className="analyze-btn analyze-theme"
          onClick={handleAnalyze}
          disabled={loading || hunters.length === 0}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Analyzing…' : `🧠 Analyze — ${MODE_LABEL[coachingMode] || coachingMode}`}
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
              <div className="empty-glyph" style={{ color: '#4e8ff7' }}>◈</div>
              <div className="empty-title">Analyzing Your Team</div>
              <div className="empty-desc">{loadingDesc[coachingMode]}</div>
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
                coachingMode={coachingMode}
                onRegenerate={handleAnalyze}
                onFeedback={handleFeedback}
                onSwitchMode={(m) => onNavigate(m === 'pull' ? 'pull' : 'analyze')}
              />
            </motion.div>
          )}
          {!loading && !strategy && (
            <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="empty-glyph" style={{ color: '#4e8ff7' }}>⚔</div>
              <div className="empty-title">Ready to Analyze</div>
              <div className="empty-desc">
                Add your hunters, pick a coaching focus, then hit{' '}
                <strong style={{ color: '#4e8ff7' }}>Analyze</strong> for
                personalized strategy built around your exact roster.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
