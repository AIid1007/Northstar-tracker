/* timer.js — accountability timer per PRD §R-P0-5 */
window.NS_Timer = (() => {
  let state = null;
  let interval = null;
  let listeners = new Set();

  function emit() { listeners.forEach(fn => fn(getState())); }
  function getState() { return state ? { ...state } : null; }

  function start({ taskId, taskDesc, estimatedMinutes }) {
    const settings = NS_Storage.getSettings();
    stop(); // clean any prior
    state = {
      taskId, taskDesc, estimatedMinutes,
      startedAt: Date.now(),
      pausedAt: null,
      pausedTotal: 0,
      paused: false,
      phase: 'focus', // 'focus' | 'rest'
      phaseStartedAt: Date.now(),
      cycles: 0,
      focusSeconds: settings.timer_focus_minutes * 60,
      restSeconds: settings.timer_rest_minutes * 60,
      // Tasks shorter than one focus block run as a single continuous segment.
      continuous: (estimatedMinutes && estimatedMinutes < settings.timer_focus_minutes),
    };
    interval = setInterval(tick, 250);
    emit();
  }

  function tick() {
    if (!state || state.paused) return;
    const now = Date.now();
    const phaseElapsed = (now - state.phaseStartedAt) / 1000;
    if (!state.continuous) {
      if (state.phase === 'focus' && phaseElapsed >= state.focusSeconds) {
        state.phase = 'rest';
        state.phaseStartedAt = now;
        state.cycles += 1;
      } else if (state.phase === 'rest' && phaseElapsed >= state.restSeconds) {
        state.phase = 'focus';
        state.phaseStartedAt = now;
      }
    }
    emit();
  }

  function pause() {
    if (!state || state.paused) return;
    state.paused = true;
    state.pausedAt = Date.now();
    emit();
  }
  function resume() {
    if (!state || !state.paused) return;
    state.pausedTotal += (Date.now() - state.pausedAt);
    state.phaseStartedAt += (Date.now() - state.pausedAt);
    state.pausedAt = null;
    state.paused = false;
    emit();
  }
  function stop() {
    if (interval) { clearInterval(interval); interval = null; }
    state = null;
    emit();
  }

  /** finalize and return a timer log for the task */
  function finish() {
    if (!state) return null;
    const ended = Date.now();
    const totalMs = (ended - state.startedAt) - state.pausedTotal - (state.paused ? (Date.now() - state.pausedAt) : 0);
    const log = {
      task_id: state.taskId,
      started: new Date(state.startedAt).toISOString(),
      ended: new Date(ended).toISOString(),
      duration_sec: Math.max(0, Math.round(totalMs / 1000)),
      cycles: state.cycles,
    };
    stop();
    return log;
  }

  function totalElapsedSeconds() {
    if (!state) return 0;
    const baseEnd = state.paused ? state.pausedAt : Date.now();
    return Math.max(0, Math.floor((baseEnd - state.startedAt - state.pausedTotal) / 1000));
  }

  function phaseElapsedSeconds() {
    if (!state) return 0;
    const baseEnd = state.paused ? state.pausedAt : Date.now();
    return Math.max(0, Math.floor((baseEnd - state.phaseStartedAt) / 1000));
  }

  function phaseProgress() {
    if (!state) return 0;
    if (state.continuous) {
      const goal = (state.estimatedMinutes || 5) * 60;
      return Math.min(1, totalElapsedSeconds() / goal);
    }
    const target = state.phase === 'focus' ? state.focusSeconds : state.restSeconds;
    return Math.min(1, phaseElapsedSeconds() / target);
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function format(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return {
    start, pause, resume, stop, finish, subscribe, getState,
    totalElapsedSeconds, phaseElapsedSeconds, phaseProgress, format,
  };
})();
