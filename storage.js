/* storage.js — localStorage wrapper matching PRD §8.4 schema */
window.NS_Storage = (() => {
  const K = {
    GOAL: 'northstar_goal',
    PROGRESS: 'northstar_progress',
    SETTINGS: 'northstar_settings',
    API_KEY: 'northstar_api_key',
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const defaults = {
    progress: {
      completed_tasks: [],          // array of task ids
      completed_per_day: {},        // { 'YYYY-MM-DD': [task_id, ...] }
      task_ratings: {},
      timer_logs: {},
      streak: { current: 0, best: 0, last_completed_date: null },
      points: 0,
      badges: [],
      milestones_completed: [],
      plan_start_date: todayISO(),
      current_day_index: 0,         // which day of the plan we're on
      last_open_date: todayISO(),
    },
    settings: {
      tough_love_mode: false,
      timer_focus_minutes: 25,
      timer_rest_minutes: 5,
    },
  };

  const get = (k, fallback = null) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  };
  const set = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { console.error('storage set failed', e); return false; }
  };
  const del = (k) => localStorage.removeItem(k);

  return {
    getGoal: () => get(K.GOAL),
    setGoal: (g) => set(K.GOAL, g),
    clearGoal: () => del(K.GOAL),

    getProgress: () => ({ ...defaults.progress, ...(get(K.PROGRESS) || {}) }),
    setProgress: (p) => set(K.PROGRESS, p),
    updateProgress: (patch) => {
      const p = { ...defaults.progress, ...(get(K.PROGRESS) || {}), ...patch };
      set(K.PROGRESS, p);
      return p;
    },

    getSettings: () => ({ ...defaults.settings, ...(get(K.SETTINGS) || {}) }),
    setSettings: (s) => set(K.SETTINGS, s),

    getApiKey: () => get(K.API_KEY) || '',
    setApiKey: (k) => set(K.API_KEY, k),
    clearApiKey: () => del(K.API_KEY),

    todayISO,

    resetAll: () => {
      Object.values(K).forEach(del);
    },

    exportAll: () => ({
      goal: get(K.GOAL),
      progress: get(K.PROGRESS),
      settings: get(K.SETTINGS),
      exported_at: new Date().toISOString(),
    }),
  };
})();
