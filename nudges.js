/* nudges.js — pre-stored messages, contextual selection */
window.NS_Nudges = (() => {
  const sets = {
    welcome_back: {
      kind: [
        "Welcome back. Today's plan is ready when you are.",
        "Good to see you. {tasksLeft} tasks today — the first only takes {firstMins} minutes.",
        "You showed up. That's already the hard part. Let's roll.",
      ],
      tough: [
        "Stop scrolling. Your goal won't chase itself.",
        "{tasksLeft} tasks. No one else is doing them for you.",
        "You're back. Now do the thing.",
      ],
    },
    all_done: {
      kind: [
        "You crushed it today. {streak}-day streak and counting.",
        "Today: done. That's how it adds up.",
        "Day complete. Future-you is grinning.",
      ],
      tough: [
        "Good. Now do it again tomorrow.",
        "Today: handled. Don't get cocky — tomorrow is still coming.",
        "{streak} days in a row. Don't break it.",
      ],
    },
    missed_yesterday: {
      kind: [
        "Yesterday is gone. Today is fresh. One task. That's all. Start with: {firstTask}.",
        "You missed a day. That's life. Reset the streak, not the goal.",
        "No shame, no spiral. Just one task today to get rolling.",
      ],
      tough: [
        "You skipped yesterday. The plan doesn't care. Pick up and move.",
        "Excuses don't move the needle. Start with one task: {firstTask}.",
        "Streak reset. So what. Build a new one starting now.",
      ],
    },
    behind: {
      kind: [
        "You're {behindCount} tasks behind. Not the end of the world. Knock out one extra today.",
        "A small backlog isn't failure — it's a signal. Pick the easiest one and start.",
      ],
      tough: [
        "Behind by {behindCount}. The math isn't going to fix itself.",
        "You're falling behind. Less thinking, more doing.",
      ],
    },
    first_day: {
      kind: [
        "Day one. The plan is set. All you have to do is start.",
        "Welcome to your first day. Pick a task. Press the timer. That's the whole trick.",
      ],
      tough: [
        "Day one. No more talking about it. Open a task.",
      ],
    },
    streak_warning: {
      kind: [
        "Don't break the chain. {streak} days strong — one task keeps it alive.",
      ],
      tough: [
        "{streak}-day streak on the line. Don't waste it.",
      ],
    },
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function fill(tpl, ctx) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
  }

  /**
   * Choose a nudge based on current state.
   * ctx: { trigger, tough, tasksLeft, firstMins, firstTask, streak, behindCount }
   */
  function get(ctx) {
    const set = sets[ctx.trigger];
    if (!set) return '';
    const pool = ctx.tough ? set.tough : set.kind;
    return fill(pick(pool), ctx);
  }

  /**
   * Decide which trigger applies given progress + today.
   */
  function chooseTrigger({ progress, dayIndex, totalDoneToday, totalToday, expectedByNow }) {
    const today = NS_Storage.todayISO();
    const last = progress.streak.last_completed_date;
    if (dayIndex === 0 && totalDoneToday === 0) return 'first_day';
    if (totalDoneToday === totalToday && totalToday > 0) return 'all_done';
    if (last && last !== today) {
      const lastDate = new Date(last);
      const diffDays = Math.round((new Date(today) - lastDate) / 86400000);
      if (diffDays > 1) return 'missed_yesterday';
    }
    if (expectedByNow != null && totalDoneToday < expectedByNow - 1) return 'behind';
    if (progress.streak.current >= 5) return 'streak_warning';
    return 'welcome_back';
  }

  return { get, chooseTrigger };
})();
