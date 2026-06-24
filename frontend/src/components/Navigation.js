import { motion } from 'framer-motion';

const TABS = [
  { key: 'home',    icon: '🏠', label: 'Home'         },
  { key: 'analyze', icon: '🧠', label: 'Analyze Team'  },
  { key: 'pull',    icon: '🎯', label: 'Pull Advisor'  },
  { key: 'hunters', icon: '📖', label: 'Hunters'       },
];

export default function Navigation({ view, onNavigate }) {
  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <span className="nav-brand-title">Solo Leveling: Arise</span>
        <span className="nav-brand-sub">AI Companion</span>
      </div>
      <div className="nav-tabs">
        {TABS.map(({ key, icon, label }) => (
          <motion.button
            key={key}
            className={`nav-tab${view === key ? ' active' : ''}${key === 'analyze' ? ' analyze' : key === 'pull' ? ' pull' : ''}`}
            onClick={() => onNavigate(key)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="nav-tab-icon">{icon}</span>
            <span className="nav-tab-label">{label}</span>
            {view === key && (
              <motion.div
                className="nav-tab-indicator"
                layoutId="nav-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </motion.button>
        ))}
      </div>
      <div className="nav-rank">S-Rank Intelligence</div>
    </nav>
  );
}
