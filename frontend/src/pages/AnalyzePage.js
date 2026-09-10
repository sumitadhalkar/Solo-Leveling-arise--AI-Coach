import { AnimatePresence, motion } from 'framer-motion';
import CoachingModeSelector from '../components/CoachingModeSelector';
import GameModeSelector from '../components/GameModeSelector';
import StrategyOutput from '../components/StrategyOutput';
import SidebarHero from '../components/SidebarHero';
import Icon from '../components/Icon';
import heroImage from '../assets/solo2.jpg';

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
  question, setQuestion,
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
        <SidebarHero image={heroImage} theme="analyze" />

        <div className="page-mode-header analyze">
          <span className="page-mode-icon"><Icon name="insight" size={19} /></span>
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

        <motion.button
          className="analyze-btn analyze-theme"
          onClick={handleAnalyze}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Analyzing…' : <><Icon name="insight" size={16} /> Analyze — {MODE_LABEL[coachingMode] || coachingMode}</>}
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
              <div className="empty-glyph" style={{ color: '#6fa3f0' }}><Icon name="diamond" size={40} /></div>
              <div className="empty-title">Analyzing Your Team</div>
              <div className="empty-desc">{loadingDesc[coachingMode]}</div>
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
                coachingMode={coachingMode}
                onRegenerate={handleAnalyze}
                onFeedback={handleFeedback}
                onSwitchMode={(m) => onNavigate(m === 'pull' ? 'pull' : 'analyze')}
              />
            </motion.div>
          )}
          {!loading && !strategy && (
            <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="empty-glyph" style={{ color: '#6fa3f0' }}><Icon name="sword" size={38} /></div>
              <div className="empty-title">Ready to Analyze</div>
              <div className="empty-desc">
                Pick a game mode and a coaching focus, then hit{' '}
                <strong style={{ color: '#6fa3f0' }}>Analyze</strong> for a
                personalized strategy.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
