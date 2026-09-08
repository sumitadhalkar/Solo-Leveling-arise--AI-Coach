import { motion } from 'framer-motion';
import Icon from './Icon';

const MODES = {
  'Workshop of Brilliant Light': { icon: 'zap',       short: 'Workshop',    bosses: ['Vulcan', 'Ice Elf King', 'Shadow Monarch', 'Steel-Fanged Lycan'] },
  'Battlefield of Time':          { icon: 'hourglass', short: 'Battlefield', bosses: ['Ant King', 'Iron Body Monku', 'Architect'] },
  'Guild Boss':                   { icon: 'temple',    short: 'Guild Boss',  bosses: ['Thomas Andre', 'Christopher Reed', 'Jonas'] },
  'Encore Missions':              { icon: 'repeat',    short: 'Encore',      bosses: [] },
  'Simulation Gate':              { icon: 'spiral',    short: 'Simulation',  bosses: [] },
};

export default function GameModeSelector({ gameMode, setGameMode, boss, setBoss }) {
  const bosses = MODES[gameMode]?.bosses || [];

  function handleMode(mode) {
    setGameMode(mode);
    const newBosses = MODES[mode]?.bosses || [];
    setBoss(newBosses[0] || '');
  }

  return (
    <div className="card">
      <div className="card-title">Game Mode</div>
      <div className="mode-grid">
        {Object.entries(MODES).map(([mode, { icon, short }]) => (
          <motion.button
            key={mode}
            className={`mode-tile${gameMode === mode ? ' active' : ''}`}
            onClick={() => handleMode(mode)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="mode-tile-icon"><Icon name={icon} size={18} /></span>
            <span className="mode-tile-name">{short}</span>
          </motion.button>
        ))}
      </div>
      {bosses.length > 0 && (
        <div className="boss-chips">
          {bosses.map((b) => (
            <motion.button
              key={b}
              className={`boss-chip${boss === b ? ' active' : ''}`}
              onClick={() => setBoss(b)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {b}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
