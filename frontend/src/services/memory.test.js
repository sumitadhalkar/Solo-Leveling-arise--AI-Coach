import { saveRoster, loadRoster, saveProfile, loadProfile, clearMemory } from './memory';

const KEY = 'arise_coach_memory';

describe('memory (localStorage)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  test('round-trips a saved roster', () => {
    const roster = [{ name: 'Cha Hae-In', advancement: 2, weapon: 'SSR', weapon_advancement: 1, power: 5000 }];
    saveRoster(roster);
    expect(loadRoster()).toEqual(roster);
  });

  test('loadRoster returns [] when nothing has been saved', () => {
    expect(loadRoster()).toEqual([]);
  });

  test('loadRoster returns [] instead of crashing on corrupted (non-array) data', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ hunters: 'not-an-array' }));
    expect(loadRoster()).toEqual([]);
  });

  test('loadRoster returns [] on totally invalid JSON in localStorage', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    expect(loadRoster()).toEqual([]);
  });

  test('loadProfile falls back to defaults when nothing saved', () => {
    expect(loadProfile()).toEqual({
      spending_level: 'f2p',
      progression_stage: 'midgame',
      coaching_mode: 'strategy',
    });
  });

  test('saveProfile + loadProfile round-trip', () => {
    saveProfile({ spending_level: 'whale', progression_stage: 'endgame', coaching_mode: 'boss_guide' });
    expect(loadProfile()).toEqual({
      spending_level: 'whale', progression_stage: 'endgame', coaching_mode: 'boss_guide',
    });
  });

  test('saveRoster and saveProfile do not clobber each other', () => {
    saveRoster([{ name: 'A' }]);
    saveProfile({ spending_level: 'low' });
    expect(loadRoster()).toEqual([{ name: 'A' }]);
    expect(loadProfile().spending_level).toBe('low');
  });

  test('clearMemory wipes everything', () => {
    saveRoster([{ name: 'A' }]);
    clearMemory();
    expect(loadRoster()).toEqual([]);
  });

  test('does not throw when localStorage.getItem throws (privacy mode)', () => {
    const spy = jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => loadRoster()).not.toThrow();
    expect(loadRoster()).toEqual([]);
    spy.mockRestore();
  });

  test('does not throw when localStorage.setItem throws (privacy mode)', () => {
    const spy = jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveRoster([{ name: 'A' }])).not.toThrow();
    spy.mockRestore();
  });
});
