import { useState } from 'react';
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
        <h1>Solo Leveling: ARISE</h1>
        <span className="subtitle">AI Coach — personalized strategy for your account</span>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <GameModeSelector
            gameMode={gameMode} setGameMode={setGameMode}
            boss={boss} setBoss={setBoss}
          />
          <RosterInput
            hunters={hunters} setHunters={setHunters}
            battlePower={battlePower} setBattlePower={setBattlePower}
            jinwooPower={jinwooPower} setJinwooPower={setJinwooPower}
          />
          <button
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={loading || hunters.length === 0}
          >
            {loading ? 'Analyzing...' : 'Get Strategy'}
          </button>
          {error && <div className="error-msg">{error}</div>}
        </aside>

        <main className="main-content">
          {strategy ? (
            <StrategyOutput strategy={strategy} />
          ) : (
            <div className="empty-state">
              <div className="glyph">⚔</div>
              <p>
                Add hunters from your roster, select a game mode and boss,
                then hit <strong style={{ color: 'var(--accent-gold)' }}>Get Strategy</strong> for
                personalized advice tailored to your account.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
