import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const KNOWN_HUNTERS = [
  'Cha Hae-In', 'Alicia', 'Min Byung-Gu', 'Go Gunhee', 'Baek Yoonho',
  'Emma', 'Lim Tae-Gyu', 'Choi Jong-In', 'Woo Jinchul', 'Sung Jin-Woo',
  'Park Heejin', 'Lee Joohee', 'Hwang Dongsuk',
];

const HUNTER_ELEMENT = {
  'Cha Hae-In': 'light', 'Min Byung-Gu': 'light', 'Go Gunhee': 'light',
  'Alicia': 'water', 'Emma': 'water', 'Park Heejin': 'water',
  'Lim Tae-Gyu': 'fire', 'Choi Jong-In': 'fire', 'Hwang Dongsuk': 'fire',
  'Baek Yoonho': 'earth',
  'Woo Jinchul': 'wind', 'Lee Joohee': 'wind',
  'Sung Jin-Woo': 'dark',
};

const EL_COLOR = {
  light: 'var(--el-light)', water: 'var(--el-water)', fire: 'var(--el-fire)',
  earth: 'var(--el-earth)', wind: 'var(--el-wind)', dark: 'var(--el-dark)',
};

const CHIP_STYLE = {
  light: { background: 'rgba(245,208,96,0.12)', border: '1px solid rgba(245,208,96,0.35)', color: 'var(--el-light)' },
  water: { background: 'rgba(80,176,240,0.12)', border: '1px solid rgba(80,176,240,0.35)', color: 'var(--el-water)' },
  fire:  { background: 'rgba(240,112,80,0.12)', border: '1px solid rgba(240,112,80,0.35)', color: 'var(--el-fire)' },
  earth: { background: 'rgba(112,192,96,0.12)', border: '1px solid rgba(112,192,96,0.35)', color: 'var(--el-earth)' },
  wind:  { background: 'rgba(96,216,208,0.12)', border: '1px solid rgba(96,216,208,0.35)', color: 'var(--el-wind)' },
  dark:  { background: 'rgba(144,96,240,0.12)', border: '1px solid rgba(144,96,240,0.35)', color: 'var(--el-dark)' },
};

const EMPTY = { name: KNOWN_HUNTERS[0], advancement: 0, weapon: 'SSR', weapon_advancement: 0, power: '' };

export default function RosterInput({ hunters, setHunters, battlePower, setBattlePower, jinwooPower, setJinwooPower }) {
  const [form, setForm] = useState(EMPTY);

  function addHunter() {
    if (!form.name) return;
    setHunters(prev => [...prev, { ...form, power: Number(form.power) || 0 }]);
    setForm(EMPTY);
  }

  function removeHunter(i) { setHunters(prev => prev.filter((_, idx) => idx !== i)); }
  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  return (
    <div className="card">
      <div className="card-title">Your Roster</div>

      <div className="metrics-row">
        <div className="metric-input">
          <label>Battle Power</label>
          <input type="number" value={battlePower || ''} placeholder="e.g. 1200000"
            onChange={e => setBattlePower(Number(e.target.value))} />
        </div>
        <div className="metric-input">
          <label>Jin-Woo Power</label>
          <input type="number" value={jinwooPower || ''} placeholder="e.g. 850000"
            onChange={e => setJinwooPower(Number(e.target.value))} />
        </div>
      </div>

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
                  <span className="hunter-el-dot" style={{ background: EL_COLOR[el] }} />
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

      <div className="add-form-label">Add Hunter</div>
      <div className="add-hunter-grid">
        <select value={form.name} onChange={e => set('name', e.target.value)}
          style={{ gridColumn: '1 / -1' }}>
          {KNOWN_HUNTERS.map(n => <option key={n} value={n}>{n}</option>)}
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

        <input type="number" value={form.power} placeholder="Hunter Power"
          onChange={e => set('power', e.target.value)} />

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
