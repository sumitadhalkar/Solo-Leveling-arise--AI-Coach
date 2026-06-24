import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getSnapshot } from '../services/api';
import { HUNTERS, TIER_STYLE, EL_BADGE, PULL_STYLE } from '../data/hunters';

const TOP_HUNTERS = HUNTERS.filter(h => h.tier === 'SS' || h.tier === 'S+').slice(0, 6);

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function HomePage({ onNavigate }) {
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotError, setSnapshotError] = useState(null);

  useEffect(() => {
    getSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshotError('Snapshot unavailable — background worker may still be loading.'));
  }, []);

  const confidence = snapshot?.confidence ?? 0;
  const confPct = Math.round(confidence * 100);

  return (
    <div className="home-page">
      {/* Hero */}
      <motion.div
        className="home-hero"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="home-hero-glyph">◈</div>
        <h2 className="home-hero-title">Solo Leveling: Arise</h2>
        <p className="home-hero-sub">
          AI-powered meta intelligence — team analysis, pull decisions, hunter profiles.
        </p>
        <div className="home-hero-actions">
          <motion.button
            className="hero-action-btn analyze"
            onClick={() => onNavigate('analyze')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>🧠</span> Analyze Team
          </motion.button>
          <motion.button
            className="hero-action-btn pull"
            onClick={() => onNavigate('pull')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>🎯</span> Pull Advisor
          </motion.button>
          <motion.button
            className="hero-action-btn neutral"
            onClick={() => onNavigate('hunters')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>📖</span> Hunter Profiles
          </motion.button>
        </div>
      </motion.div>

      {/* Meta Snapshot */}
      <motion.section
        className="home-section"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div className="home-section-title" variants={item}>
          Meta Snapshot
          {snapshot && (
            <span className="snapshot-confidence" title="Data confidence score">
              {confPct}% confidence
            </span>
          )}
        </motion.div>

        {snapshotError && (
          <motion.div className="snapshot-notice" variants={item}>{snapshotError}</motion.div>
        )}

        {snapshot && !snapshot.error && (
          <motion.div className="snapshot-grid" variants={container}>
            {snapshot.authoritative && Object.entries(snapshot.authoritative).slice(0, 4).map(([key, val]) => (
              <motion.div key={key} className="snapshot-tile" variants={item}>
                <div className="snapshot-tile-key">{key.replace(/_/g, ' ')}</div>
                <div className="snapshot-tile-val">
                  {typeof val === 'object' ? JSON.stringify(val).slice(0, 60) : String(val).slice(0, 80)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {(!snapshot || snapshot.error) && !snapshotError && (
          <motion.div className="snapshot-loading" variants={item}>
            <span className="stream-pulse" /> Loading live meta data…
          </motion.div>
        )}
      </motion.section>

      {/* Top Hunters */}
      <motion.section
        className="home-section"
        variants={container}
        initial="hidden"
        animate="show"
        style={{ animationDelay: '0.1s' }}
      >
        <motion.div className="home-section-title" variants={item}>
          Top Hunters
          <button className="section-link" onClick={() => onNavigate('hunters')}>View all →</button>
        </motion.div>
        <motion.div className="home-hunter-row" variants={container}>
          {TOP_HUNTERS.map(h => {
            const ts = TIER_STYLE[h.tier] || {};
            const ps = PULL_STYLE[h.pullValue] || {};
            return (
              <motion.button
                key={h.name}
                className="home-hunter-card"
                variants={item}
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate('hunters')}
                title={`${h.name} — ${h.tier} tier`}
              >
                <div className="hhc-el" style={{ color: `var(--el-${h.element})` }}>
                  {EL_BADGE[h.element]}
                </div>
                <div className="hhc-name">{h.name}</div>
                <div
                  className="hhc-tier"
                  style={{ color: ts.color, background: ts.bg, border: `1px solid ${ts.border}` }}
                >
                  {h.tier}
                </div>
                <div className="hhc-role">{h.role}</div>
                <div
                  className="hhc-pull"
                  style={{ color: ps.color, background: ps.bg }}
                >
                  {h.pullValue}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.section>

      {/* Quick Actions */}
      <motion.section
        className="home-section"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div className="home-section-title" variants={item}>Quick Actions</motion.div>
        <motion.div className="home-action-grid" variants={container}>
          {[
            { icon: '⚔', label: 'Strategy Session', desc: 'Get optimal team & rotation advice for your roster', mode: 'analyze', sub: 'strategy' },
            { icon: '👥', label: 'Team Builder',     desc: 'Full composition analysis and role coverage review', mode: 'analyze', sub: 'team_builder' },
            { icon: '🔮', label: 'Artifact Guide',   desc: 'Gear priority, set bonuses, stat breakpoints', mode: 'analyze', sub: 'artifact_optimizer' },
            { icon: '🏆', label: 'Boss Guide',        desc: 'Attack patterns, weaknesses, and positioning tips', mode: 'analyze', sub: 'boss_guide' },
            { icon: '🎯', label: 'Should I Pull?',   desc: 'Banner evaluation with PULL / SKIP verdict', mode: 'pull', sub: null },
            { icon: '📈', label: 'Road Map',          desc: '1–3 month progression plan built around your account', mode: 'analyze', sub: 'future_planning' },
          ].map(({ icon, label, desc, mode }) => (
            <motion.button
              key={label}
              className={`home-action-card ${mode}`}
              variants={item}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(mode)}
            >
              <span className="hac-icon">{icon}</span>
              <div className="hac-label">{label}</div>
              <div className="hac-desc">{desc}</div>
            </motion.button>
          ))}
        </motion.div>
      </motion.section>
    </div>
  );
}
