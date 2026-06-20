/* gamification.js — rule-based, no AI. PRD §R-P0-7 */
window.NS_Game = (() => {
  const BADGES = [
    { id: 'first_step',     icon: '👣', name: 'First Step',     desc: 'Complete your first task' },
    { id: 'week_warrior',   icon: '🔥', name: 'Week Warrior',   desc: 'Hit tasks 7 days running' },
    { id: 'milestone_master', icon: '🏔', name: 'Milestone Master', desc: 'Reach your first weekly milestone' },
    { id: 'halfway_there',  icon: '⛰', name: 'Halfway There',  desc: 'Cross 50% of your plan' },
    { id: 'finisher',       icon: '🏆', name: 'Finisher',       desc: 'Complete the entire goal' },
    { id: 'early_bird',     icon: '🌅', name: 'Early Bird',     desc: 'Complete a task before 9am' },
    { id: 'night_owl',      icon: '🌙', name: 'Night Owl',      desc: 'Complete a task after 10pm' },
  ];

  const POINTS = {
    TASK: 10,
    MILESTONE: 50,
    STREAK_DAY: 5, // *current streak
  };

  function awardTaskCompletion(progress, taskId) {
    const newProgress = { ...progress };
    const today = NS_Storage.todayISO();
    const todayList = newProgress.completed_per_day[today] || [];
    // Already completed THIS task TODAY? no-op
    if (todayList.includes(taskId)) return { progress: newProgress, awarded: 0, newBadges: [] };

    // record (allow same task to be completed on different days — daily tasks)
    newProgress.completed_tasks = [...newProgress.completed_tasks, taskId];
    newProgress.completed_per_day = { ...newProgress.completed_per_day, [today]: [...todayList, taskId] };

    let awarded = POINTS.TASK;

    // streak update
    const last = newProgress.streak.last_completed_date;
    if (last !== today) {
      if (last) {
        const diff = Math.round((new Date(today) - new Date(last)) / 86400000);
        if (diff === 1) newProgress.streak = { ...newProgress.streak, current: newProgress.streak.current + 1 };
        else newProgress.streak = { ...newProgress.streak, current: 1 };
      } else {
        newProgress.streak = { ...newProgress.streak, current: 1 };
      }
      newProgress.streak.last_completed_date = today;
      newProgress.streak.best = Math.max(newProgress.streak.best, newProgress.streak.current);
      awarded += POINTS.STREAK_DAY * newProgress.streak.current;
    }

    newProgress.points = (newProgress.points || 0) + awarded;

    // badges
    const newBadges = [];
    const have = new Set(newProgress.badges);
    const earn = (id) => { if (!have.has(id)) { newBadges.push(BADGES.find(b => b.id === id)); have.add(id); } };

    if (newProgress.completed_tasks.length === 1) earn('first_step');
    if (newProgress.streak.current >= 7) earn('week_warrior');

    const hour = new Date().getHours();
    if (hour < 9) earn('early_bird');
    if (hour >= 22) earn('night_owl');

    newProgress.badges = [...have];
    return { progress: newProgress, awarded, newBadges };
  }

  function awardMilestone(progress, milestoneId) {
    if (progress.milestones_completed.includes(milestoneId)) {
      return { progress, awarded: 0, newBadges: [] };
    }
    const newProgress = {
      ...progress,
      milestones_completed: [...progress.milestones_completed, milestoneId],
      points: (progress.points || 0) + POINTS.MILESTONE,
    };
    const newBadges = [];
    const have = new Set(newProgress.badges);
    if (!have.has('milestone_master')) { newBadges.push(BADGES.find(b => b.id === 'milestone_master')); have.add('milestone_master'); }
    newProgress.badges = [...have];
    return { progress: newProgress, awarded: POINTS.MILESTONE, newBadges };
  }

  function checkProgressBadges(progress, totalTasks) {
    const newProgress = { ...progress };
    const have = new Set(newProgress.badges);
    const newBadges = [];
    const pct = totalTasks > 0 ? newProgress.completed_tasks.length / totalTasks : 0;
    if (pct >= 0.5 && !have.has('halfway_there')) {
      newBadges.push(BADGES.find(b => b.id === 'halfway_there'));
      have.add('halfway_there');
    }
    if (pct >= 1 && !have.has('finisher')) {
      newBadges.push(BADGES.find(b => b.id === 'finisher'));
      have.add('finisher');
    }
    newProgress.badges = [...have];
    return { progress: newProgress, newBadges };
  }

  return { BADGES, POINTS, awardTaskCompletion, awardMilestone, checkProgressBadges };
})();
