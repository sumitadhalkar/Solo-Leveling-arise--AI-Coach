import { useState } from 'react';

const KNOWN_HUNTERS = [
  'Cha Hae-In', 'Alicia', 'Min Byung-Gu', 'Go Gunhee', 'Baek Yoonho',
  'Emma', 'Lim Tae-Gyu', 'Choi Jong-In', 'Woo Jinchul', 'Sung Jin-Woo',
  'Park Heejin', 'Lee Joohee', 'Hwang Dongsuk',
];

const WEAPON_RARITIES = ['R', 'SR', 'SSR'];

const EMPTY_FORM = { name: KNOWN_HUNTERS[0], advancement: 0, weapon: 'SSR', weapon_advancement: 0, power: 0 };

export default function RosterInput({
  hunters, setHunters, battlePower, setBattlePower, jinwooPower, setJinwooPower,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  function addHunter() {
    if (!form.name) return;
    setHunters((prev) => [...prev, { ...form }]);
    setForm(EMPTY_FORM);
  }

  function removeHunter(index) {
    setHunters((prev) => prev.filter((_, i) => i !== index));
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="card">
      <div className="card-title">Your Roster</div>

      <div className="field">
        <label>Battle Power</label>
        <input
          type="number"
          value={battlePower || ''}
          placeholder="e.g. 1200000"
          onChange={(e) => setBattlePower(Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>Jin-Woo Power</label>
        <input
          type="number"
          value={jinwooPower || ''}
          placeholder="e.g. 850000"
          onChange={(e) => setJinwooPower(Number(e.target.value))}
        />
      </div>

      {hunters.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {hunters.map((h, i) => (
            <div className="hunter-row" key={i}>
              <span className="hunter-name">{h.name}</span>
              <span className="adv-badge">A{h.advancement}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {h.weapon}+{h.weapon_advancement}
              </span>
              <button className="remove-btn" onClick={() => removeHunter(i)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        ADD HUNTER
      </div>

      <div className="add-hunter-form">
        <select value={form.name} onChange={(e) => set('name', e.target.value)}
          style={{ gridColumn: '1 / -1' }}>
          {KNOWN_HUNTERS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            ADVANCEMENT
          </label>
          <select value={form.advancement} onChange={(e) => set('advancement', Number(e.target.value))}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i}>A{i}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            WEAPON
          </label>
          <select value={form.weapon} onChange={(e) => set('weapon', e.target.value)}>
            {WEAPON_RARITIES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            WEAPON ADV.
          </label>
          <select value={form.weapon_advancement} onChange={(e) => set('weapon_advancement', Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i}>+{i}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            POWER
          </label>
          <input
            type="number"
            value={form.power || ''}
            placeholder="0"
            onChange={(e) => set('power', Number(e.target.value))}
          />
        </div>

        <button className="add-hunter-btn" onClick={addHunter}>
          + Add to Roster
        </button>
      </div>
    </div>
  );
}
