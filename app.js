/* app.js — controller, router, state */
(() => {
  const app = document.getElementById('app');
  const nav = document.getElementById('site-nav');

  // --- transient state across views ---
  let session = {
    goalDraft: '',
    quiz: null,            // { domain, steps }
    quizStep: 0,
    quizAnswers: {},
    timelineWeeks: null,
    timelineChoice: 'auto',
    scheduled: null,
    activeTaskId: null,
    currentDayIndex: null, // for navigating yesterday/tomorrow
    viewCleanup: null,
  };

  // ---- utilities ----
  function setView(node) {
    if (session.viewCleanup) { session.viewCleanup(); session.viewCleanup = null; }
    app.innerHTML = '';
    if (node) app.appendChild(node);
    if (node?._cleanup) session.viewCleanup = node._cleanup;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function toast(message, kind = 'default', ms = 2600) {
    const stack = document.getElementById('toast-stack');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = message;
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, ms - 280);
    setTimeout(() => t.remove(), ms);
  }

  function confetti() {
    const colors = ['#FF8C42', '#C44569', '#5B8C5A', '#6FAEDB', '#FFD7B5'];
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2500);
    }
  }

  // ---- router ----
  function navTo(hash) { location.hash = hash; }

  function updateNavActive() {
    document.querySelectorAll('#site-nav [data-view]').forEach(a => {
      const want = a.getAttribute('data-view');
      a.classList.toggle('active', location.hash === '#/' + want);
    });
  }

  function showNav(show) { nav.hidden = !show; }

  function router() {
    updateNavActive();
    const goal = NS_Storage.getGoal();
    const hash = location.hash || '#/';

    if (!goal) {
      showNav(false);
      if (hash === '#/quiz') return renderQuiz();
      if (hash === '#/timeline') return renderTimeline();
      if (hash === '#/generating') return renderGenerating();
      return renderWelcome();
    }

    showNav(true);
    if (hash === '#/plan') return renderPlan();
    if (hash === '#/stats') return renderStats();
    if (hash.startsWith('#/timer/')) return renderTimer(hash.split('/')[2]);
    return renderDashboard();
  }

  // ---- VIEWS ----

  function renderWelcome() {
    const view = NS_Views.welcomeView();
    setView(view);
    const form = view.querySelector('#goal-form');
    const input = view.querySelector('#goal-input');
    input.value = session.goalDraft;
    input.addEventListener('input', e => session.goalDraft = e.target.value);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    view.querySelectorAll('[data-suggest]').forEach(b => {
      b.addEventListener('click', () => {
        input.value = b.dataset.suggest;
        session.goalDraft = input.value;
        input.focus();
      });
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const g = input.value.trim();
      if (g.length < 3) { toast('Tell me a real goal — even a vague one works.', 'error'); return; }
      session.goalDraft = g;
      session.quiz = NS_Quiz.buildQuiz(g);
      session.quizStep = 0;
      session.quizAnswers = {};
      navTo('#/quiz');
    });
    input.focus();
  }

  function renderQuiz() {
    if (!session.quiz) { navTo('#/'); return; }
    const steps = session.quiz.steps;
    const view = NS_Views.quizView({ steps, currentStep: session.quizStep, answers: session.quizAnswers });
    setView(view);

    const step = steps[session.quizStep];
    if (step.type === 'options') {
      view.querySelectorAll('.option').forEach(opt => {
        opt.addEventListener('click', () => {
          view.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          session.quizAnswers[step.id] = opt.dataset.value;
        });
      });
    } else if (step.type === 'slider') {
      const slider = view.querySelector('#slider');
      const val = view.querySelector('#slider-value');
      slider.addEventListener('input', () => {
        val.textContent = `${slider.value} ${step.unit || ''}`;
        session.quizAnswers[step.id] = Number(slider.value);
      });
      // initialize default
      if (session.quizAnswers[step.id] == null) session.quizAnswers[step.id] = Number(slider.value);
    }

    view.querySelector('#back-btn').addEventListener('click', () => {
      if (session.quizStep > 0) { session.quizStep--; renderQuiz(); }
    });
    view.querySelector('#next-btn').addEventListener('click', () => {
      if (session.quizAnswers[step.id] == null) {
        toast('Pick one to continue.', 'error');
        return;
      }
      if (session.quizStep < steps.length - 1) {
        session.quizStep++;
        renderQuiz();
      } else {
        navTo('#/timeline');
      }
    });
  }

  function renderTimeline() {
    if (!session.quiz) { navTo('#/'); return; }
    const view = NS_Views.timelineView({ goal: session.goalDraft, quizAnswers: session.quizAnswers });
    setView(view);
    view.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        const v = opt.dataset.value;
        if (v === 'auto') { session.timelineChoice = 'auto'; session.timelineWeeks = null; }
        else { session.timelineChoice = 'custom'; session.timelineWeeks = Number(v); }
        navTo('#/generating');
      });
    });
  }

  async function renderGenerating() {
    const view = NS_Views.generatingView();
    setView(view);

    const apiKey = NS_Storage.getApiKey();
    if (!apiKey) {
      // Prompt for the key inline
      setView(NS_Views.errorBanner('You need an Anthropic API key to generate your plan. Open Settings (⚙ top right) to add one, then try again.'));
      // open settings dialog
      openSettings();
      const retry = document.createElement('div');
      retry.style.textAlign = 'center';
      retry.style.marginTop = '20px';
      retry.innerHTML = '<button class="btn primary" id="retry-gen">Retry generation</button>';
      app.appendChild(retry);
      retry.querySelector('#retry-gen').addEventListener('click', () => renderGenerating());
      return;
    }

    try {
      const plan = await NS_API.generatePlan({
        apiKey,
        goal: session.goalDraft,
        quizAnswers: session.quizAnswers,
        timelineWeeks: session.timelineWeeks,
        timelineChoice: session.timelineChoice,
        onStatus: () => {},
      });

      const goalObj = {
        id: 'goal_' + Date.now(),
        text: session.goalDraft,
        created_at: new Date().toISOString(),
        deadline: null,
        quiz_answers: session.quizAnswers,
        timeline_choice: session.timelineChoice,
        plan,
        specialist: {
          name: plan.specialist_name,
          title: plan.specialist_title,
          icon: plan.specialist_icon,
        },
      };
      NS_Storage.setGoal(goalObj);
      NS_Storage.updateProgress({ plan_start_date: NS_Storage.todayISO(), current_day_index: 0 });
      session.scheduled = NS_Views.buildScheduledTasks(plan, Number(session.quizAnswers.days_per_week) || 5);
      toast('Your plan is ready ✨', 'celebration', 2400);
      navTo('#/plan');
    } catch (err) {
      console.error(err);
      setView(NS_Views.errorBanner(err.message || 'Something went wrong.'));
      const retry = document.createElement('div');
      retry.style.textAlign = 'center';
      retry.style.marginTop = '20px';
      retry.innerHTML = `
        <button class="btn primary" id="retry-gen">Try again</button>
        <button class="btn ghost" id="back-home" style="margin-left:8px;">Back to start</button>`;
      app.appendChild(retry);
      retry.querySelector('#retry-gen').addEventListener('click', () => renderGenerating());
      retry.querySelector('#back-home').addEventListener('click', () => {
        NS_Storage.clearGoal();
        navTo('#/');
      });
    }
  }

  function ensureScheduled() {
    const goal = NS_Storage.getGoal();
    if (!goal) return null;
    if (!session.scheduled) {
      const dpw = Number(goal.quiz_answers?.days_per_week) || 5;
      session.scheduled = NS_Views.buildScheduledTasks(goal.plan, dpw);
    }
    return goal;
  }

  function getDayIndex() {
    if (session.currentDayIndex != null) return session.currentDayIndex;
    const progress = NS_Storage.getProgress();
    const start = new Date(progress.plan_start_date + 'T00:00:00');
    const today = new Date(NS_Storage.todayISO() + 'T00:00:00');
    const diff = Math.max(0, Math.round((today - start) / 86400000));
    return diff;
  }

  function renderPlan() {
    const goal = ensureScheduled();
    if (!goal) { navTo('#/'); return; }
    const view = NS_Views.planView({
      goal: goal.text,
      plan: goal.plan,
      daysPerWeek: Number(goal.quiz_answers?.days_per_week) || 5,
    });
    setView(view);
    view.querySelector('#start-day-one')?.addEventListener('click', () => {
      session.currentDayIndex = null; // reset to real day
      navTo('#/dashboard');
    });
  }

  function dayDateFor(dayIndex) {
    const progress = NS_Storage.getProgress();
    const start = new Date(progress.plan_start_date + 'T00:00:00');
    const d = new Date(start);
    d.setDate(d.getDate() + dayIndex);
    return d.toISOString().slice(0, 10);
  }

  function renderDashboard() {
    const goal = ensureScheduled();
    if (!goal) { navTo('#/'); return; }
    const progress = NS_Storage.getProgress();
    const settings = NS_Storage.getSettings();

    const dayIndex = getDayIndex();
    const dayDate = dayDateFor(dayIndex);
    const todayTasks = NS_Views.tasksForDay(session.scheduled, dayIndex);
    const dayDoneSet = new Set(progress.completed_per_day[dayDate] || []);
    const doneToday = todayTasks.filter(t => dayDoneSet.has(t.id)).length;
    const totalToday = todayTasks.length;

    const trigger = NS_Nudges.chooseTrigger({
      progress, dayIndex, totalDoneToday: doneToday, totalToday,
    });
    const firstTask = todayTasks.find(t => !dayDoneSet.has(t.id));
    const nudge = NS_Nudges.get({
      trigger,
      tough: settings.tough_love_mode,
      tasksLeft: totalToday - doneToday,
      firstMins: firstTask?.estimated_minutes || 10,
      firstTask: firstTask?.description?.split('.')[0] || '',
      streak: progress.streak.current,
      behindCount: Math.max(0, totalToday - doneToday),
    });

    const view = NS_Views.dashboardView({
      goal: goal.text, plan: goal.plan, progress,
      scheduled: session.scheduled, dayIndex, dayDate, nudge,
    });
    setView(view);

    view.querySelectorAll('.task-card').forEach(card => {
      const taskId = card.dataset.taskId;
      card.querySelector('[data-action=toggle]')?.addEventListener('click', () => toggleTask(taskId, dayDate));
      card.querySelector('[data-action=timer]')?.addEventListener('click', () => {
        session.activeTaskId = taskId;
        navTo('#/timer/' + encodeURIComponent(taskId));
      });
    });

    view.querySelector('[data-nav=prev-day]')?.addEventListener('click', () => {
      session.currentDayIndex = Math.max(0, dayIndex - 1); renderDashboard();
    });
    view.querySelector('[data-nav=next-day]')?.addEventListener('click', () => {
      session.currentDayIndex = dayIndex + 1; renderDashboard();
    });
  }

  function toggleTask(taskId, dayDate) {
    let progress = NS_Storage.getProgress();
    const dayList = progress.completed_per_day[dayDate] || [];
    if (dayList.includes(taskId)) {
      // un-complete for this specific day
      progress.completed_per_day[dayDate] = dayList.filter(id => id !== taskId);
      // also remove one occurrence from completed_tasks
      const idx = progress.completed_tasks.indexOf(taskId);
      if (idx >= 0) progress.completed_tasks.splice(idx, 1);
      NS_Storage.setProgress(progress);
      renderDashboard();
      return;
    }
    completeTask(taskId);
  }

  function completeTask(taskId, timerLog = null) {
    let progress = NS_Storage.getProgress();
    if (timerLog) {
      progress.timer_logs = { ...progress.timer_logs, [taskId]: timerLog };
    }
    const { progress: p1, awarded, newBadges } = NS_Game.awardTaskCompletion(progress, taskId);
    progress = p1;

    // milestone check: any milestones whose tasks for that week are all done?
    const goal = NS_Storage.getGoal();
    const milestonesNew = [];
    if (goal?.plan?.phases) {
      const completed = new Set(progress.completed_tasks);
      goal.plan.phases.forEach((phase, pi) => {
        (phase.weekly_milestones || []).forEach((m) => {
          if (progress.milestones_completed.includes(m.id)) return;
          // milestone marker: count all phase tasks completed at >= (m.week/phase.phase_weeks)
          const phaseTasks = phase.daily_tasks || [];
          const phaseDone = phaseTasks.filter(t => completed.has(t.id)).length;
          const threshold = Math.max(1, Math.floor(phaseTasks.length * (m.week / Math.max(phase.phase_weeks, 1))));
          if (phaseDone >= threshold) {
            const r = NS_Game.awardMilestone(progress, m.id);
            progress = r.progress;
            milestonesNew.push(m);
            r.newBadges.forEach(b => newBadges.push(b));
          }
        });
      });
    }

    // progress badges
    const total = (session.scheduled || []).length;
    const pb = NS_Game.checkProgressBadges(progress, total);
    progress = pb.progress;
    pb.newBadges.forEach(b => newBadges.push(b));

    NS_Storage.setProgress(progress);

    if (awarded > 0) toast(`+${awarded} pts`, 'success', 1600);
    newBadges.forEach((b, i) => setTimeout(() => {
      toast(`${b.icon} ${b.name} unlocked!`, 'celebration', 3000);
      confetti();
    }, 400 + i * 600));
    milestonesNew.forEach(m => setTimeout(() => {
      toast(`🏔 Milestone: ${m.description}`, 'celebration', 3400);
      confetti();
    }, 200));
  }

  function renderTimer(taskId) {
    const goal = ensureScheduled();
    if (!goal) { navTo('#/'); return; }
    taskId = decodeURIComponent(taskId);
    // find task object
    let task = null;
    for (const p of goal.plan.phases) {
      task = (p.daily_tasks || []).find(t => t.id === taskId);
      if (task) break;
    }
    if (!task) { toast('Task not found.', 'error'); navTo('#/dashboard'); return; }

    const view = NS_Views.timerView({ task });
    setView(view);

    const clock = view.querySelector('#clock');
    const phaseLabel = view.querySelector('#phase-label');
    const ringFg = view.querySelector('#ring-fg');
    const stage = view.querySelector('#timer-stage');
    const pauseBtn = view.querySelector('#pause-btn');

    NS_Timer.start({ taskId, taskDesc: task.description, estimatedMinutes: task.estimated_minutes });

    const unsub = NS_Timer.subscribe(state => {
      if (!state) return;
      const total = NS_Timer.totalElapsedSeconds();
      clock.textContent = NS_Timer.format(total);
      phaseLabel.textContent = state.phase === 'rest' ? 'Rest' : 'Focus';
      stage.classList.toggle('resting', state.phase === 'rest');
      const progress = NS_Timer.phaseProgress();
      const circ = 339.292;
      ringFg.style.strokeDashoffset = circ - (circ * progress);
      pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    });

    pauseBtn.addEventListener('click', () => {
      const s = NS_Timer.getState();
      if (!s) return;
      if (s.paused) NS_Timer.resume(); else NS_Timer.pause();
    });

    view.querySelector('#complete-btn').addEventListener('click', () => {
      const log = NS_Timer.finish();
      unsub();
      completeTask(taskId, log);
      navTo('#/dashboard');
    });

    view.querySelector('#cancel-btn').addEventListener('click', () => {
      NS_Timer.stop();
      unsub();
      navTo('#/dashboard');
    });

    view._cleanup = () => { unsub(); };
  }

  function renderStats() {
    const goal = ensureScheduled();
    if (!goal) { navTo('#/'); return; }
    const progress = NS_Storage.getProgress();
    const view = NS_Views.statsView({ progress, scheduled: session.scheduled, plan: goal.plan });
    setView(view);
  }

  // ---- settings dialog ----
  function openSettings() {
    const dlg = document.getElementById('settings-dialog');
    const settings = NS_Storage.getSettings();
    dlg.querySelector('#api-key-input').value = NS_Storage.getApiKey();
    dlg.querySelector('#tough-love-toggle').checked = !!settings.tough_love_mode;
    dlg.querySelector('#focus-mins').value = settings.timer_focus_minutes;
    dlg.querySelector('#rest-mins').value = settings.timer_rest_minutes;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function wireSettings() {
    const dlg = document.getElementById('settings-dialog');
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    dlg.querySelector('#save-settings').addEventListener('click', () => {
      NS_Storage.setApiKey(dlg.querySelector('#api-key-input').value.trim());
      NS_Storage.setSettings({
        tough_love_mode: dlg.querySelector('#tough-love-toggle').checked,
        timer_focus_minutes: Number(dlg.querySelector('#focus-mins').value) || 25,
        timer_rest_minutes: Number(dlg.querySelector('#rest-mins').value) || 5,
      });
      toast('Settings saved.', 'success');
    });
    dlg.querySelector('#export-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(NS_Storage.exportAll(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `northstar-export-${NS_Storage.todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    dlg.querySelector('#reset-btn').addEventListener('click', () => {
      if (confirm('This wipes your plan, progress, and settings. Sure?')) {
        NS_Storage.resetAll();
        session = { goalDraft: '', quiz: null, quizStep: 0, quizAnswers: {}, timelineWeeks: null, timelineChoice: 'auto', scheduled: null, activeTaskId: null, currentDayIndex: null, viewCleanup: null };
        dlg.close();
        navTo('#/');
      }
    });
  }

  // ---- boot ----
  window.addEventListener('hashchange', router);
  window.addEventListener('load', () => {
    wireSettings();
    router();
  });
  // also fire now in case load already happened
  if (document.readyState !== 'loading') {
    wireSettings();
    router();
  }
})();
