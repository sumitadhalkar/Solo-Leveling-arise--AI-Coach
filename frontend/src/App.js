import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';
import GameModeSelector from './components/GameModeSelector';
import RosterInput from './components/RosterInput';
import StrategyOutput from './components/StrategyOutput';
import { getStrategy } from './services/api';

export default function App() {
  const [gameMode, setGameMode] = useState('Workshop of Brilliant Light');
  const [boss, setBoss] = useState('Vulcan');
  const [hunters, setHunters] = useState([]);
  const [battlePower, setBattlePower] = useState(0);
  const [jinwooPower, setJinwooPower] = useState(0);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setStrategy(null);
    try {
      const result = await getStrategy({
        game_mode: gameMode,
        boss: boss || null,
        jinwoo_power: jinwooPower,
        hunters,
        battle_power: battlePower,
      });
      setStrategy(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Solo Leveling: Arise</h1>
        <span className="subtitle">AI Strategy Coach</span>
        <span className="header-rank">S-Rank Intelligence</span>
      </header>

      <div className="app-body">
        <motion.aside
          className="sidebar"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <GameModeSelector
            gameMode={gameMode} setGameMode={setGameMode}
            boss={boss} setBoss={setBoss}
          />
          <RosterInput
            hunters={hunters} setHunters={setHunters}
            battlePower={battlePower} setBattlePower={setBattlePower}
            jinwooPower={jinwooPower} setJinwooPower={setJinwooPower}
          />
          <motion.button
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={loading || hunters.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Analyzing...' : 'Analyze Roster'}
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
                <div className="empty-desc">
                  Searching arise.tools, Reddit, and the Fandom Wiki for the latest strategies…
                </div>
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
                  Add hunters from your account, choose a game mode and boss, then hit{' '}
                  <strong style={{ color: 'var(--gold)' }}>Analyze Roster</strong> for
                  a strategy built around your exact lineup.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
