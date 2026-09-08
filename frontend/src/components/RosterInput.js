import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { saveRoster } from '../services/memory';
import Icon from './Icon';

// ── Complete hunter roster (June 2026) ──────────────────────────────────────
const HUNTER_ELEMENT = {
  // Light
  'Cha Hae-In':               'light',
  'Min Byung-Gu':             'light',
  'Go Gunhee':                'light',
  'Thomas Andre':             'light',
  'Akari':                    'light',
  'Antoine Martinez':         'light',
  // Water
  'Alicia':                   'water',
  'Emma':                     'water',
  'Park Heejin':              'water',
  'Elena Renault':            'water',
  'Mary Lane':                'water',
  'Cha Hae-In [Pure Sword]':  'water',
  // Fire
  'Lim Tae-Gyu':              'fire',
  'Choi Jong-In':             'fire',
  'Hwang Dongsuk':            'fire',
  'Tawata Kanae':             'fire',
  'Liu Zhigang':              'fire',
  'Christopher Reed':         'fire',
  'Gina':                     'fire',
  // Earth
  'Baek Yoonho':              'earth',
  // Wind
  'Woo Jinchul':              'wind',
  'Lee Joohee':               'wind',
  'Amamiya Mirei':            'wind',
  'Sugamoto Reggie':          'wind',
  'Leonard':                  'wind',
  'Jenna':                    'wind',
  // Dark
  'Sung Jin-Woo':             'dark',
  'Charlotte':                'dark',
  'Minnie':                   'dark',
  'Seorin':                   'dark',
  'Sian Halat':               'dark',
  'Son Kihoon':               'dark',
};

const KNOWN_HUNTERS = Object.keys(HUNTER_ELEMENT).sort();

const EL_COLOR = {
  light: 'var(--el-light)',
  water: 'var(--el-water)',
  fire:  'var(--el-fire)',
  earth: 'var(--el-earth)',
  wind:  'var(--el-wind)',
  dark:  'var(--el-dark)',
};

const EL_BADGE = {
  light: '☀', water: '💧', fire: '🔥', earth: '🌿', wind: '🌀', dark: '🌑',
};

const STAGE_OPTS = [
  { value: 'new',         label: 'New Account' },
  { value: 'midgame',     label: 'Midgame' },
  { value: 'endgame',     label: 'Endgame' },
  { value: 'competitive', label: 'Competitive' },
];

const EMPTY = {
  name: KNOWN_HUNTERS[0],
  advancement: 0,
  weapon: 'SSR',
  weapon_advancement: 0,
  power: '',
};

export default function RosterInput({
  hunters, setHunters,
  battlePower, setBattlePower,
  jinwooPower, setJinwooPower,
  progressionStage, setProgressionStage,
}) {
  const [form, setForm] = useState(EMPTY);

  function addHunter() {
    if (!form.name) return;
    const updated = [...hunters, { ...form, power: Number(form.power) || 0 }];
    setHunters(updated);
    saveRoster(updated);
    setForm(EMPTY);
  }

  function removeHunter(i) {
    const updated = hunters.filter((_, idx) => idx !== i);
    setHunters(updated);
    saveRoster(updated);
  }

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  return (
    <div className="card">
      <div className="card-title">Your Roster</div>

      {/* Battle Power + Jin-Woo */}
      <div className="metrics-row">
        <div className="metric-input">
          <label>Battle Power</label>
          <input
            type="number"
            value={battlePower || ''}
            placeholder="e.g. 1200000"
            onChange={e => setBattlePower(Number(e.target.value))}
          />
        </div>
        <div className="metric-input">
          <label>Jin-Woo Power</label>
          <input
            type="number"
            value={jinwooPower || ''}
            placeholder="e.g. 850000"
            onChange={e => setJinwooPower(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Progression stage override */}
      <div className="stage-row">
        <span className="stage-label">Progression Stage</span>
        <div className="stage-chips">
          {STAGE_OPTS.map(({ value, label }) => (
            <motion.button
              key={value}
              className={`stage-chip${progressionStage === value ? ' active' : ''}`}
              onClick={() => setProgressionStage(value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Owned hunters list */}
      <AnimatePresence initial={false}>
        {hunters.length > 0 && (
          <div className="hunter-list">
            {hunters.map((h, i) => {
              const el = HUNTER_ELEMENT[h.name] || 'light';
              return (
                <motion.div
                  key={`${h.name}-${i}`}
                  className="hunter-row"
                  style={{ borderLeftColor: EL_COLOR[el] }}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="hunter-el-badge" style={{ color: EL_COLOR[el] }}>
                    <Icon name={el} size={13} />
                  </span>
                  <span className="hunter-name">{h.name}</span>
                  <span className="hunter-badge">A{h.advancement}</span>
                  <span className="hunter-badge">{h.weapon}+{h.weapon_advancement}</span>
                  {h.power > 0 && (
                    <span className="hunter-power">{Number(h.power).toLocaleString()}</span>
                  )}
                  <button className="remove-btn" onClick={() => removeHunter(i)}>×</button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Add hunter form */}
      <div className="add-form-label">Add Hunter</div>
      <div className="add-hunter-grid">
        <select
          value={form.name}
          onChange={e => set('name', e.target.value)}
          style={{ gridColumn: '1 / -1' }}
        >
          {KNOWN_HUNTERS.map(n => (
            <option key={n} value={n}>
              {EL_BADGE[HUNTER_ELEMENT[n]]} {n}
            </option>
          ))}
        </select>

        <select value={form.advancement} onChange={e => set('advancement', Number(e.target.value))}>
          {Array.from({ length: 11 }, (_, i) => (
            <option key={i} value={i}>A{i}</option>
          ))}
        </select>

        <select value={form.weapon} onChange={e => set('weapon', e.target.value)}>
          {['R', 'SR', 'SSR'].map(w => <option key={w} value={w}>{w} Weapon</option>)}
        </select>

        <select value={form.weapon_advancement} onChange={e => set('weapon_advancement', Number(e.target.value))}>
          {Array.from({ length: 6 }, (_, i) => (
            <option key={i} value={i}>+{i} Weapon Adv.</option>
          ))}
        </select>

        <input
          type="number"
          value={form.power}
          placeholder="Hunter Power"
          onChange={e => set('power', e.target.value)}
        />

        <motion.button
          className="add-hunter-btn"
          onClick={addHunter}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          + Add to Roster
        </motion.button>
      </div>
    </div>
  );
}
