import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';
import PortalScene from './components/portal/PortalScene';
import CoachingModeSelector from './components/CoachingModeSelector';
import GameModeSelector from './components/GameModeSelector';
import RosterInput from './components/RosterInput';
import StrategyOutput from './components/StrategyOutput';
import { getStrategy } from './services/api';
import { loadProfile, loadRoster, saveProfile } from './services/memory';

const MODE_LABEL = {
  strategy:           'Strategy',
  team_builder:       'Team Builder',
  pull_advisor:       'Pull Advisor',
  artifact_optimizer: 'Artifacts',
  boss_guide:         'Boss Guide',
  future_planning:    'Road Map',
  myth_bust:          'Myth Bust',
};

export default function App() {
  // ── Game context ──
  const [gameMode, setGameMode]   = useState('Workshop of Brilliant Light');
  const [boss, setBoss]           = useState('Vulcan');

  // ── Coaching context ──
  const savedProfile = loadProfile();
  const [coachingMode, setCoachingMode]       = useState(savedProfile.coaching_mode || 'strategy');
  const [spendingLevel, setSpendingLevel]     = useState(savedProfile.spending_level || 'f2p');
  const [progressionStage, setProgressionStage] = useState(savedProfile.progression_stage || 'midgame');
  const [question, setQuestion]               = useState('');

  // ── Roster ──
  const [hunters, setHunters]         = useState(loadRoster);
  const [battlePower, setBattlePower] = useState(0);
  const [jinwooPower, setJinwooPower] = useState(0);

  // ── UI state ──
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [isSurging, setIsSurging] = useState(false);

  // Persist profile changes to memory
  useEffect(() => {
    saveProfile({ coaching_mode: coachingMode, spending_level: spendingLevel, progression_stage: progressionStage });
  }, [coachingMode, spendingLevel, progressionStage]);

  async function handleAnalyze() {
    setIsSurging(true);
    setTimeout(() => setIsSurging(false), 1200);
    setLoading(true);
    setError(null);
    setStrategy(null);
    try {
      const result = await getStrategy({
        game_mode:        gameMode,
        boss:             boss || null,
        jinwoo_power:     jinwooPower,
        hunters,
        battle_power:     battlePower,
        spending_level:   spendingLevel,
        progression_stage: progressionStage,
        coaching_mode:    coachingMode,
        question:         question || null,
      });
      setStrategy(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const loadingDesc = {
    strategy:           'Searching arise.tools, Reddit & Netmarble for the latest strategies…',
    team_builder:       'Analyzing your roster and building optimal team compositions…',
    pull_advisor:       'Checking current & upcoming banners against your account needs…',
    artifact_optimizer: 'Calculating artifact breakpoints and farming priority…',
    boss_guide:         'Compiling attack patterns, weaknesses, and positioning tips…',
    future_planning:    'Building your personalized progression roadmap…',
    myth_bust:          'Searching official patch notes to verify or correct community claims…',
  };

  return (
    <>
      <PortalScene isActive={loading || isSurging} />
      <div className="app" style={{ position: 'relative', zIndex: 1 }}>
        <header className="app-header">
          <h1>Solo Leveling: Arise</h1>
          <span className="subtitle">AI Strategy Coach</span>
          <span className="header-mode-pill">{MODE_LABEL[coachingMode]}</span>
          <span className="header-rank">S-Rank Intelligence</span>
        </header>

        <div className="app-body">
          <motion.aside
            className="sidebar"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {/* Feature 5/6/7/8/11/12 – Coaching Mode + Spending */}
            <CoachingModeSelector
              coachingMode={coachingMode}     setCoachingMode={setCoachingMode}
              spendingLevel={spendingLevel}   setSpendingLevel={setSpendingLevel}
              question={question}             setQuestion={setQuestion}
            />

            {/* Game mode + boss */}
            <GameModeSelector
              gameMode={gameMode} setGameMode={setGameMode}
              boss={boss} setBoss={setBoss}
            />

            {/* Roster + progression stage */}
            <RosterInput
              hunters={hunters}           setHunters={setHunters}
              battlePower={battlePower}   setBattlePower={setBattlePower}
              jinwooPower={jinwooPower}   setJinwooPower={setJinwooPower}
              progressionStage={progressionStage} setProgressionStage={setProgressionStage}
            />

            <motion.button
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={loading || hunters.length === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? 'Analyzing…' : `Analyze — ${MODE_LABEL[coachingMode]}`}
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
                <motion.div
                  key="loading"
                  className="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="empty-glyph">◈</div>
                  <div className="empty-title">Consulting the Shadows</div>
                  <div className="empty-desc">{loadingDesc[coachingMode]}</div>
                </motion.div>
              )}
              {!loading && strategy && (
                <motion.div
                  key="strategy"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <StrategyOutput strategy={strategy} gameMode={gameMode} boss={boss} />
                </motion.div>
              )}
              {!loading && !strategy && (
                <motion.div
                  key="empty"
                  className="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="empty-glyph">⚔</div>
                  <div className="empty-title">Awaiting Your Roster</div>
                  <div className="empty-desc">
                    Add your hunters, select a coaching mode, then hit{' '}
                    <strong style={{ color: 'var(--gold)' }}>Analyze</strong> for
                    personalized advice built around your exact account.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}
