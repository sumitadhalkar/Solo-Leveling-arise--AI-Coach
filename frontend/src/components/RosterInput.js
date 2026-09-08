import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EL_COLOR, EL_BADGE } from '../data/hunters';
import { useHunterCatalog } from '../services/hunterCatalog';
import { saveRoster } from '../services/memory';
import Icon from './Icon';

const STAGE_OPTS = [
  { value: 'new',         label: 'New Account' },
  { value: 'midgame',     label: 'Midgame' },
  { value: 'endgame',     label: 'Endgame' },
  { value: 'competitive', label: 'Competitive' },
];

export default function RosterInput({
  hunters, setHunters,
  battlePower, setBattlePower,
  jinwooPower, setJinwooPower,
  progressionStage, setProgressionStage,
  title = 'Your Roster',
}) {
  // Aliased — this hook's `hunters` (the full catalog) and this component's
  // `hunters` prop (the player's *owned* roster) are different things.
  const { hunters: catalog } = useHunterCatalog();

  // Same catalog that powers the Hunters Database page, so a hunter the
  // roster_sync worker discovers is selectable here too — no separate,
  // easily-stale hardcoded list to maintain.
  const { knownHunters, hunterElement } = useMemo(() => {
    const elementMap = {};
    for (const h of catalog) elementMap[h.name] = h.element;
    return {
      knownHunters: catalog.map(h => h.name).sort(),
      hunterElement: elementMap,
    };
  }, [catalog]);

  const emptyForm = () => ({
    name: knownHunters[0] || '',
    advancement: 0,
    weapon: 'SSR',
    weapon_advancement: 0,
    power: '',
  });

  const [form, setForm] = useState(emptyForm);

  function addHunter() {
    if (!form.name) return;
    const updated = [...hunters, { ...form, power: Number(form.power) || 0 }];
    setHunters(updated);
    saveRoster(updated);
    setForm(emptyForm());
  }

  function removeHunter(i) {
    const updated = hunters.filter((_, idx) => idx !== i);
    setHunters(updated);
    saveRoster(updated);
  }

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  return (
    <div className="card">
      <div className="card-title">{title}</div>

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
              const el = hunterElement[h.name] || 'light';
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
          {knownHunters.map(n => (
            <option key={n} value={n}>
              {EL_BADGE[hunterElement[n]]} {n}
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
