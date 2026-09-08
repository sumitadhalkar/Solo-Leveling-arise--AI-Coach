import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIER_STYLE, EL_COLOR, PULL_STYLE } from '../data/hunters';
import { useHunterCatalog } from '../services/hunterCatalog';
import Icon from '../components/Icon';
import HunterAvatar from '../components/HunterAvatar';

const TREND_ICON = { rising: 'arrowUp', falling: 'arrowDown', stable: 'minus' };

const ELEMENTS = ['all', 'dark', 'light', 'fire', 'water', 'wind', 'earth'];
const TIERS    = ['all', 'SS', 'S+', 'S', 'A', 'B'];

function StatBar({ label, value }) {
  const pct = Math.round((value / 5) * 100);
  const color = value >= 4 ? 'var(--el-light)' : value === 3 ? 'var(--el-wind)' : 'var(--text-muted)';
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track">
        <motion.div
          className="stat-bar-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="stat-bar-val">{value}/5</span>
    </div>
  );
}

function SkillBadge({ type }) {
  const colors = { Active: '#4e8ff7', Ultimate: '#c9a227', Passive: '#9060f0' };
  return (
    <span className="skill-type-badge" style={{ background: colors[type] || '#888', color: '#fff' }}>
      {type}
    </span>
  );
}

function HunterProfile({ hunter, onBack }) {
  const ts = TIER_STYLE[hunter.tier] || {};
  const ps = PULL_STYLE[hunter.pullValue] || {};
  const elColor = EL_COLOR[hunter.element] || 'var(--text)';
  const trendColor = { rising: 'var(--el-earth)', falling: 'var(--danger)', stable: 'var(--text-dim)' }[hunter.trend];

  return (
    <motion.div
      className="hunter-profile"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <button className="back-btn" onClick={onBack}><Icon name="chevronRight" size={13} /> Back to Hunters</button>

      {hunter.auto_generated && (
        <div className={`hp-auto-notice${hunter.low_confidence ? ' low-confidence' : ''}`}>
          <Icon name="search" size={13} />
          {hunter.low_confidence
            ? "Added while our live-search provider was unavailable — this profile was NOT verified against any current source and may be inaccurate or, in rare cases, mistaken entirely."
            : "Auto-discovered from a live web search after this hunter's release — details may need verification."}
        </div>
      )}

      {/* Profile header */}
      <div className="hp-header" style={{ borderColor: elColor }}>
        <div className="hp-header-left">
          <HunterAvatar name={hunter.name} element={hunter.element} size={64} />
          <div>
            <div className="hp-el-badge" style={{ color: elColor }}>
              <Icon name={hunter.element} size={13} /> {hunter.element}
            </div>
            <h2 className="hp-name">{hunter.name}</h2>
            <div className="hp-meta-row">
              <span className="hp-class">{hunter.class}</span>
              <span className="hp-rarity">{hunter.rarity}</span>
              <span className="hp-role">{hunter.role}</span>
            </div>
          </div>
        </div>
        <div className="hp-header-right">
          <div className="hp-tier-badge" style={{ color: ts.color, background: ts.bg, border: `1px solid ${ts.border}` }}>
            {hunter.tier}
          </div>
          <div className="hp-trend" style={{ color: trendColor }}>
            <Icon name={TREND_ICON[hunter.trend] || 'minus'} size={12} /> {hunter.trend}
          </div>
          <div className="hp-pull-value" style={{ color: ps.color, background: ps.bg }}>
            {hunter.pullValue}
          </div>
        </div>
      </div>

      <p className="hp-desc">{hunter.description}</p>

      <div className="hp-body">
        {/* Stats */}
        <div className="hp-section">
          <div className="hp-section-title">Combat Stats</div>
          <div className="stat-bars">
            <StatBar label="Attack"  value={hunter.stats.attack}  />
            <StatBar label="Defense" value={hunter.stats.defense} />
            <StatBar label="Speed"   value={hunter.stats.speed}   />
            <StatBar label="Utility" value={hunter.stats.utility} />
          </div>
        </div>

        {/* Playstyle */}
        <div className="hp-section">
          <div className="hp-section-title">Playstyle</div>
          <p className="hp-playstyle">{hunter.playstyle}</p>
        </div>

        {/* Skills */}
        <div className="hp-section hp-section-full">
          <div className="hp-section-title">Skills</div>
          <div className="hp-skills">
            {hunter.skills.map(skill => (
              <div key={skill.name} className="hp-skill-card">
                <div className="hp-skill-header">
                  <span className="hp-skill-name">{skill.name}</span>
                  <SkillBadge type={skill.type} />
                </div>
                <p className="hp-skill-desc">{skill.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Build */}
        <div className="hp-section">
          <div className="hp-section-title">Best Build</div>
          <div className="hp-build-list">
            <div className="hp-build-block">
              <div className="hp-build-label">Weapons</div>
              <ul>{hunter.bestWeapons.map(w => <li key={w}>{w}</li>)}</ul>
            </div>
            <div className="hp-build-block">
              <div className="hp-build-label">Artifacts</div>
              <ul>{hunter.artifacts.map(a => <li key={a}>{a}</li>)}</ul>
            </div>
            <div className="hp-build-block">
              <div className="hp-build-label">Stat Priority</div>
              <ul>{hunter.statPriority.map(s => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
          <div className="hp-f2p">
            <span className="hp-f2p-label">F2P Build:</span> {hunter.f2pBuild}
          </div>
        </div>

        {/* Synergy */}
        <div className="hp-section">
          <div className="hp-section-title">Team Synergy</div>
          <div className="hp-synergy-row">
            <div className="hp-synergy-block good">
              <div className="hp-synergy-label">Best Teammates</div>
              <div className="hp-synergy-chips">
                {hunter.bestTeammates.map(t => <span key={t} className="synergy-chip good">{t}</span>)}
              </div>
            </div>
            {hunter.antiSynergy.length > 0 && (
              <div className="hp-synergy-block bad">
                <div className="hp-synergy-label">Avoid Pairing With</div>
                <div className="hp-synergy-chips">
                  {hunter.antiSynergy.map(t => <span key={t} className="synergy-chip bad">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HunterCard({ hunter, onClick }) {
  const ts = TIER_STYLE[hunter.tier] || {};
  const ps = PULL_STYLE[hunter.pullValue] || {};
  const elColor = EL_COLOR[hunter.element] || 'var(--text)';

  return (
    <motion.button
      className="hunter-card"
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      style={{ '--el-accent': elColor }}
    >
      <HunterAvatar name={hunter.name} element={hunter.element} size={52} />
      <div className="hc-el" style={{ color: elColor }}>
        <Icon name={hunter.element} size={13} />
      </div>
      {hunter.auto_generated && (
        <span
          className={`hc-auto-badge${hunter.low_confidence ? ' low-confidence' : ''}`}
          title={hunter.low_confidence
            ? "Added without live source verification — may be inaccurate or mistaken"
            : "Auto-discovered from a live web search — not yet manually verified"}
        >
          {hunter.low_confidence ? 'NEW · unconfirmed' : 'NEW · unverified'}
        </span>
      )}
      <div className="hc-name">{hunter.name}</div>
      <div className="hc-class">{hunter.class}</div>
      <div className="hc-tier-row">
        <span className="hc-tier" style={{ color: ts.color, background: ts.bg, border: `1px solid ${ts.border}` }}>
          {hunter.tier}
        </span>
        <span className="hc-pull" style={{ color: ps.color }}>
          {hunter.pullValue}
        </span>
      </div>
      <div className="hc-role">{hunter.role}</div>
      <div className="hc-trend" style={{
        color: hunter.trend === 'rising' ? 'var(--el-earth)' : hunter.trend === 'falling' ? 'var(--danger)' : 'var(--text-muted)',
      }}>
        <Icon name={TREND_ICON[hunter.trend] || 'minus'} size={10} />
        {{ rising: 'Rising', falling: 'Falling', stable: 'Stable' }[hunter.trend]}
      </div>
    </motion.button>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const cardAnim = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1,    transition: { duration: 0.25 } },
};

export default function HuntersPage() {
  const { hunters: HUNTERS, meta } = useHunterCatalog();
  const [elFilter, setElFilter]     = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);

  const filtered = HUNTERS.filter(h => {
    if (elFilter   !== 'all' && h.element !== elFilter)  return false;
    if (tierFilter !== 'all' && h.tier    !== tierFilter) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) &&
        !h.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="hunters-page">
      <AnimatePresence mode="wait">
        {selected ? (
          <HunterProfile
            key="profile"
            hunter={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <motion.div
            key="browser"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="hunters-header">
              <h2 className="hunters-title">Hunter Database</h2>
              <p className="hunters-sub">
                {HUNTERS.length} hunters — click any card for full profile, builds, and team synergy
                {meta?.autoAdded?.length > 0 && (
                  <span className="snapshot-confidence" title="Auto-discovered from a live web search since this build shipped">
                    {meta.autoAdded.length} auto-synced
                  </span>
                )}
              </p>
            </div>

            {/* Filters */}
            <div className="hunters-filters">
              <div className="filter-row">
                {ELEMENTS.map(el => (
                  <motion.button
                    key={el}
                    className={`filter-chip el-chip${elFilter === el ? ' active' : ''}`}
                    style={elFilter === el && el !== 'all' ? { color: `var(--el-${el})`, borderColor: `var(--el-${el})` } : {}}
                    onClick={() => setElFilter(el)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {el === 'all' ? 'All Elements' : <><Icon name={el} size={11} /> {el}</>}
                  </motion.button>
                ))}
              </div>
              <div className="filter-row">
                {TIERS.map(tier => (
                  <motion.button
                    key={tier}
                    className={`filter-chip tier-chip${tierFilter === tier ? ' active' : ''}`}
                    onClick={() => setTierFilter(tier)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {tier === 'all' ? 'All Tiers' : `${tier} Tier`}
                  </motion.button>
                ))}
              </div>
              <input
                className="hunter-search"
                type="text"
                placeholder="Search by name or role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 40 }}>
                <div className="empty-glyph"><Icon name="search" size={34} /></div>
                <div className="empty-title">No hunters match your filters</div>
              </div>
            ) : (
              <motion.div
                className="hunter-grid"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {filtered.map(h => (
                  <motion.div key={h.name} variants={cardAnim}>
                    <HunterCard hunter={h} onClick={() => setSelected(h)} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
