const MODES = {
  'Workshop of Brilliant Light': ['Vulcan', 'Ice Elf King', 'Shadow Monarch', 'Steel-Fanged Lycan'],
  'Battlefield of Time':         ['Ant King', 'Iron Body Monku', 'Architect'],
  'Guild Boss':                  ['Thomas Andre', 'Christopher Reed', 'Jonas'],
  'Encore Missions':             [],
  'Simulation Gate':             [],
};

export default function GameModeSelector({ gameMode, setGameMode, boss, setBoss }) {
  const bosses = MODES[gameMode] || [];

  function handleModeChange(e) {
    const mode = e.target.value;
    setGameMode(mode);
    const newBosses = MODES[mode] || [];
    setBoss(newBosses[0] || '');
  }

  return (
    <div className="card">
      <div className="card-title">Game Mode</div>

      <div className="field">
        <label>Mode</label>
        <select value={gameMode} onChange={handleModeChange}>
          {Object.keys(MODES).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {bosses.length > 0 && (
        <div className="field">
          <label>Boss</label>
          <select value={boss} onChange={(e) => setBoss(e.target.value)}>
            {bosses.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
