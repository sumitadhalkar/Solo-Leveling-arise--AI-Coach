import { useEffect, useRef, useState } from 'react';
import './App.css';
import AppBackground from './components/AppBackground';
import Navigation from './components/Navigation';
import AnalyzePage from './pages/AnalyzePage';
import PullAdvisorPage from './pages/PullAdvisorPage';
import HomePage from './pages/HomePage';
import HuntersPage from './pages/HuntersPage';
import { getStrategyStream, postFeedback } from './services/api';
import { loadProfile, loadRoster, saveProfile } from './services/memory';

export default function App() {
  // ── Navigation ──
  const [view, setView] = useState('home'); // 'home' | 'analyze' | 'pull' | 'hunters'

  // ── Game context ──
  const [gameMode, setGameMode] = useState('Workshop of Brilliant Light');
  const [boss, setBoss]         = useState('Vulcan');

  // ── Coaching context ──
  const savedProfile = loadProfile();
  const [coachingMode, setCoachingMode]         = useState(savedProfile.coaching_mode || 'strategy');
  const [spendingLevel, setSpendingLevel]       = useState(savedProfile.spending_level || 'f2p');
  const [progressionStage, setProgressionStage] = useState(savedProfile.progression_stage || 'midgame');
  const [question, setQuestion]                 = useState('');
  // Pull Advisor only — lightweight roster-gap signal without the full roster builder.
  const [ownsAlternative, setOwnsAlternative]    = useState(null); // null | 'yes' | 'no' | 'unsure'

  // ── Roster ──
  const [hunters, setHunters]         = useState(loadRoster);
  const [battlePower, setBattlePower] = useState(0);
  const [jinwooPower, setJinwooPower] = useState(0);

  // ── UI state ──
  const [strategy, setStrategy]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [isSurging, setIsSurging] = useState(false);
  const [streamChars, setStreamChars] = useState(0);
  const [statusMessage, setStatusMessage] = useState(null);
  const streamCharsRef = useRef(0);

  useEffect(() => {
    saveProfile({ coaching_mode: coachingMode, spending_level: spendingLevel, progression_stage: progressionStage });
  }, [coachingMode, spendingLevel, progressionStage]);

  function navigate(v) {
    setView(v);
    setStrategy(null);
    setError(null);
    setStatusMessage(null);
    if (v === 'pull') setCoachingMode('pull_advisor');
    if (v === 'analyze' && coachingMode === 'pull_advisor') setCoachingMode('strategy');
  }

  async function handleAnalyze() {
    setIsSurging(true);
    setTimeout(() => setIsSurging(false), 1200);
    setLoading(true);
    setError(null);
    setStrategy(null);
    setStreamChars(0);
    setStatusMessage(null);
    streamCharsRef.current = 0;

    // Pull Advisor skips the roster builder, so fold its one extra signal
    // (whether the player already covers this hunter's role) into the question
    // text at submit time — the visible input box stays exactly what the user typed.
    let finalQuestion = question || null;
    if (coachingMode === 'pull_advisor' && finalQuestion && ownsAlternative) {
      const context = {
        yes:    'Player already owns this hunter or a strong alternative in the same role.',
        no:     'Player does NOT own this hunter or any strong alternative in that role.',
        unsure: 'Player is unsure whether they already have a strong alternative for this role.',
      }[ownsAlternative];
      finalQuestion = `${finalQuestion}\n\n(${context})`;
    }

    const payload = {
      game_mode:         gameMode,
      boss:              boss || null,
      jinwoo_power:      jinwooPower,
      hunters,
      battle_power:      battlePower,
      spending_level:    spendingLevel,
      progression_stage: progressionStage,
      coaching_mode:     coachingMode,
      question:          finalQuestion,
    };

    await getStrategyStream(payload, {
      onChunk: (text) => {
        streamCharsRef.current += text.length;
        if (streamCharsRef.current % 200 < text.length) {
          setStreamChars(streamCharsRef.current);
        }
      },
      onStatus: (msg)  => setStatusMessage(msg),
      onResult: (data) => { setStrategy(data); setStatusMessage(null); setLoading(false); },
      onError:  (e)    => { setError(e.message); setStatusMessage(null); setLoading(false); },
    });
  }

  async function handleFeedback(rating, mode, regenerated = false) {
    try {
      await postFeedback({ rating, coaching_mode: mode, regenerated });
    } catch { /* non-critical */ }
  }

  const coachProps = {
    gameMode, setGameMode, boss, setBoss,
    coachingMode, setCoachingMode,
    spendingLevel, setSpendingLevel,
    progressionStage, setProgressionStage,
    question, setQuestion,
    ownsAlternative, setOwnsAlternative,
    hunters, setHunters,
    battlePower, setBattlePower,
    jinwooPower, setJinwooPower,
    strategy, loading, error, streamChars, statusMessage,
    handleAnalyze, handleFeedback,
    onNavigate: navigate,
  };

  return (
    <>
      <AppBackground isActive={loading || isSurging} />
      <div className="app" style={{ position: 'relative', zIndex: 1 }}>
        <Navigation view={view} onNavigate={navigate} />

        {view === 'home'    && <HomePage onNavigate={navigate} />}
        {view === 'analyze' && <AnalyzePage {...coachProps} />}
        {view === 'pull'    && <PullAdvisorPage {...coachProps} />}
        {view === 'hunters' && <HuntersPage />}
      </div>
    </>
  );
}
