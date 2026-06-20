/* views.js — pure render functions for each view */
window.NS_Views = (() => {
  // --- helpers ---
  const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dayOfWeekShort = ['sun','mon','tue','wed','thu','fri','sat'];

  /** Flatten plan into a per-day task list across the timeline */
  function buildScheduledTasks(plan, daysPerWeek) {
    // We'll lay out tasks one phase at a time. Each phase has phase_weeks weeks.
    // For each phase week, we put 'daily' tasks every day, and weekday-tagged tasks on those weekdays.
    // For simplicity in v1: ignore weekday strictness if user picks <7 days/week; we just take active days.
    const scheduled = []; // [{ dayIndex, weekIndex, phaseIndex, task, milestone? }]
    let dayIndex = 0;
    let weekIndexAbs = 0;
    plan.phases.forEach((phase, pi) => {
      // group tasks by phase_week (fallback to spreading them across weeks if not specified)
      const weeks = phase.phase_weeks || 1;
      const byWeek = {};
      (phase.daily_tasks || []).forEach((t, idx) => {
        const w = (t.phase_week && t.phase_week >= 1 && t.phase_week <= weeks) ? t.phase_week : ((idx % weeks) + 1);
        (byWeek[w] = byWeek[w] || []).push(t);
      });
      for (let w = 1; w <= weeks; w++) {
        const weekTasks = byWeek[w] || [];
        const active = (daysPerWeek === 7) ? 7 : daysPerWeek;
        // distribute weekTasks across active days
        for (let d = 0; d < 7; d++) {
          const isActiveDay = d < active; // first N days of the week are active
          if (!isActiveDay) {
            dayIndex++;
            continue;
          }
          // pick subset for this day: either tasks tagged daily, or those mapped by index
          const dayTasks = weekTasks.filter(t => t.day_of_week === 'daily');
          // also add the i-th non-daily task to day i
          const nonDaily = weekTasks.filter(t => t.day_of_week !== 'daily');
          const indexedTask = nonDaily[d % Math.max(nonDaily.length, 1)];
          if (indexedTask && !dayTasks.includes(indexedTask)) dayTasks.push(indexedTask);

          dayTasks.forEach(task => scheduled.push({
            dayIndex, weekIndexAbs, phaseIndex: pi, task,
          }));
          dayIndex++;
        }
        weekIndexAbs++;
      }
    });
    return scheduled;
  }

  /** Get unique tasks scheduled for a specific dayIndex */
  function tasksForDay(scheduled, dayIndex) {
    const out = [];
    const seen = new Set();
    for (const s of scheduled) {
      if (s.dayIndex === dayIndex && !seen.has(s.task.id)) {
        out.push(s.task);
        seen.add(s.task.id);
      }
    }
    return out;
  }

  function totalTaskInstances(scheduled) {
    return scheduled.length;
  }

  // --- views ---

  function welcomeView() {
    const view = el(`
      <section class="welcome">
        <span class="eyebrow">Goals, broken into footsteps.</span>
        <h1>What do you actually want to <span class="accent">get good at</span>?</h1>
        <p class="lede">Tell NorthStar your goal. We'll have an expert design a path so specific that "where do I start" stops being a question.</p>
        <form class="goal-form" id="goal-form">
          <textarea class="goal-input" id="goal-input" maxlength="240" rows="2"
            placeholder="e.g. learn to play guitar / run a 5k / launch my side project"></textarea>
          <button type="submit" class="btn primary large" id="goal-submit">Map my path →</button>
          <div class="goal-suggestions">
            ${['learn Spanish in 6 months','build my first iOS app','add 10kg to my deadlift','read 24 books this year','meditate every day for 60 days']
              .map(s => `<button type="button" class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
        </form>
      </section>
    `);
    return view;
  }

  function quizView({ steps, currentStep, answers }) {
    const step = steps[currentStep];
    const total = steps.length;
    const dots = Array.from({ length: total }, (_, i) =>
      `<span class="${i < currentStep ? 'done' : i === currentStep ? 'current' : ''}"></span>`
    ).join('');

    let body = '';
    if (step.type === 'options') {
      const colsClass = step.cols === 2 ? 'cols-2' : '';
      body = `
        <div class="option-grid ${colsClass}">
          ${step.options.map(o => `
            <button class="option ${answers[step.id] === o.v ? 'selected' : ''}" data-value="${esc(o.v)}">
              ${o.emoji ? `<span class="option-emoji">${o.emoji}</span>` : ''}
              <span>${esc(o.label)}</span>
            </button>
          `).join('')}
        </div>`;
    } else if (step.type === 'slider') {
      const val = answers[step.id] ?? step.default;
      body = `
        <div class="slider-wrap">
          <div class="slider-value" id="slider-value">${val} ${step.unit || ''}</div>
          <input type="range" id="slider" min="${step.min}" max="${step.max}" step="${step.step}" value="${val}" />
          <div class="slider-marks"><span>${step.min} ${step.unit || ''}</span><span>${step.max} ${step.unit || ''}</span></div>
        </div>`;
    }

    const view = el(`
      <section class="quiz-step">
        <div class="quiz-progress">${dots}</div>
        <h2>${esc(step.title)}</h2>
        ${step.help ? `<p class="helper">${esc(step.help)}</p>` : ''}
        ${body}
        <div class="step-nav">
          <button class="btn ghost" id="back-btn" ${currentStep === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn primary" id="next-btn">${currentStep === total - 1 ? 'Set timeline' : 'Next →'}</button>
        </div>
      </section>
    `);
    return view;
  }

  function timelineView({ goal, quizAnswers }) {
    return el(`
      <section class="quiz-step">
        <h2>How long do you want to give this?</h2>
        <p class="helper">A realistic horizon. You can always adjust later.</p>
        <div class="option-grid">
          ${[
            { v: 'auto', label: 'Let the specialist pick what\'s realistic', emoji: '🌟' },
            { v: '4', label: '4 weeks (sprint)', emoji: '⚡' },
            { v: '12', label: '12 weeks (quarter)', emoji: '🌱' },
            { v: '24', label: '24 weeks (half-year)', emoji: '🏔' },
          ].map(o => `
            <button class="option" data-value="${o.v}">
              <span class="option-emoji">${o.emoji}</span><span>${esc(o.label)}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `);
  }

  function generatingView() {
    const lines = [
      'Sizing up your goal...',
      'Choosing the right specialist...',
      'Breaking it into footsteps...',
      'Calibrating to your level...',
      'Sequencing the phases...',
      'Final polish...',
    ];
    const view = el(`
      <section class="generating">
        <svg class="big-star" viewBox="0 0 40 40"><path d="M20 2 L23 17 L38 20 L23 23 L20 38 L17 23 L2 20 L17 17 Z" fill="currentColor"/></svg>
        <h2>Crafting your path</h2>
        <p class="specialist-line" id="gen-status">${lines[0]}</p>
        <div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>
    `);
    // cycle messages
    let i = 0;
    const status = view.querySelector('#gen-status');
    const cycle = setInterval(() => {
      i = (i + 1) % lines.length;
      status.textContent = lines[i];
    }, 2400);
    view._cleanup = () => clearInterval(cycle);
    return view;
  }

  function planView({ goal, plan, daysPerWeek }) {
    const scheduled = buildScheduledTasks(plan, daysPerWeek);
    const totalTasks = totalTaskInstances(scheduled);
    return el(`
      <section>
        <div class="specialist-card">
          <span class="specialist-icon" aria-hidden="true">${esc(plan.specialist_icon || '✨')}</span>
          <h2>Meet ${esc(plan.specialist_name)}</h2>
          <p class="specialist-title">${esc(plan.specialist_title || '')}</p>
          <p class="identity-statement">"${esc(plan.identity_statement)}"</p>
        </div>

        <div class="card">
          <div class="card-head"><h3>Your goal</h3></div>
          <p style="font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); font-variation-settings: 'SOFT' 80; margin: 0;">${esc(goal)}</p>
          <p style="margin-top: 14px; color: var(--ink-mute); font-size: .9rem;">
            ${plan.timeline_weeks} weeks · ${plan.phases.length} phase${plan.phases.length === 1 ? '' : 's'} · ${totalTasks} task moments
          </p>
        </div>

        <h3 style="margin: 24px 0 12px;">The phases</h3>
        <div class="phase-list">
          ${plan.phases.map((p, i) => `
            <div class="phase">
              <span class="phase-num">Phase ${i + 1}</span>
              <h3>${esc(p.phase_name)}</h3>
              <p style="margin: 6px 0;">${esc(p.phase_goal)}</p>
              <p class="phase-meta">${p.phase_weeks} week${p.phase_weeks === 1 ? '' : 's'} · ${(p.daily_tasks || []).length} task types · ${(p.weekly_milestones || []).length} milestone${(p.weekly_milestones || []).length === 1 ? '' : 's'}</p>
            </div>
          `).join('')}
        </div>

        ${plan.environment_tips?.length ? `
          <div class="env-tips">
            <h3>Set up your environment</h3>
            <ul>${plan.environment_tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          </div>
        ` : ''}

        <div style="margin-top: 28px; text-align: center;">
          <button class="btn primary large" id="start-day-one">Start day 1 →</button>
        </div>
      </section>
    `);
  }

  function dashboardView({ goal, plan, progress, scheduled, dayIndex, dayDate, nudge }) {
    const todayTasks = tasksForDay(scheduled, dayIndex);
    const dayDoneList = progress.completed_per_day[dayDate] || [];
    const dayDoneSet = new Set(dayDoneList);
    const doneToday = todayTasks.filter(t => dayDoneSet.has(t.id)).length;
    // Overall progress: count completed (taskId, day) pairs against total scheduled instances
    const totalTasks = scheduled.length;
    let completedTotal = 0;
    Object.values(progress.completed_per_day || {}).forEach(arr => completedTotal += (arr || []).length);
    const pct = totalTasks ? Math.min(100, Math.round((completedTotal / totalTasks) * 100)) : 0;

    const greetingHour = new Date().getHours();
    const greeting = greetingHour < 5 ? 'Late night, friend' : greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

    return el(`
      <section>
        <div class="dash-head">
          <div class="dash-greeting">
            <h2>${greeting}.</h2>
            <p>Day ${dayIndex + 1} of ${Math.max(scheduled.length ? scheduled[scheduled.length-1].dayIndex + 1 : 1, 1)} · ${todayTasks.length - doneToday} task${(todayTasks.length - doneToday) === 1 ? '' : 's'} left today</p>
          </div>
          <div class="dash-meta">
            <span class="pill streak">🔥 ${progress.streak.current}-day streak</span>
            <span class="pill points">${progress.points} pts</span>
          </div>
        </div>

        <div class="progress-track" aria-label="Overall progress ${pct}%">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>

        ${nudge ? `<div class="nudge">${esc(nudge)}</div>` : ''}

        ${todayTasks.length === 0 ? `
          <div class="empty-day">
            <div class="big">🌿</div>
            <h3>Rest day</h3>
            <p>Nothing scheduled — but feel free to revisit yesterday or peek at tomorrow.</p>
          </div>
        ` : `
          <ul class="task-list">
            ${todayTasks.map(t => `
              <li class="task-card ${dayDoneSet.has(t.id) ? 'done' : ''}" data-task-id="${esc(t.id)}">
                <button class="task-check" aria-label="${dayDoneSet.has(t.id) ? 'Mark incomplete' : 'Mark complete'}" data-action="toggle"></button>
                <div class="task-body">
                  <p class="task-desc">${esc(t.description)}</p>
                  <div class="task-meta">
                    ${t.category ? `<span class="cat">${esc(t.category)}</span>` : ''}
                    <span>⏱ ${t.estimated_minutes || 10} min</span>
                  </div>
                </div>
                <div class="task-actions">
                  <button class="timer-btn" aria-label="Start timer" data-action="timer" title="Start timer">▶</button>
                </div>
              </li>
            `).join('')}
          </ul>
        `}

        <div style="display: flex; gap: 10px; margin-top: 24px; justify-content: center; flex-wrap: wrap;">
          ${dayIndex > 0 ? '<button class="btn ghost" data-nav="prev-day">← Yesterday</button>' : ''}
          ${dayIndex < scheduled.length - 1 ? '<button class="btn ghost" data-nav="next-day">Tomorrow →</button>' : ''}
        </div>
      </section>
    `);
  }

  function timerView({ task }) {
    return el(`
      <section class="timer-stage" id="timer-stage">
        <p class="timer-est">⏱ Estimated ${task.estimated_minutes || 10} min</p>
        <p class="timer-task-desc">${esc(task.description)}</p>

        <div class="rest-banner">🌿 Time for a 5-minute break. Stretch. Sip water. Come back fresh.</div>

        <div class="timer-ring-wrap">
          <svg class="timer-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke-width="8" class="ring-bg"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke-width="8" class="ring-fg"
              stroke-dasharray="339.292" stroke-dashoffset="339.292" id="ring-fg"/>
          </svg>
          <div class="timer-readout">
            <div class="clock" id="clock">00:00</div>
            <div class="phase-label" id="phase-label">Focus</div>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn ghost" id="pause-btn">Pause</button>
          <button class="btn primary" id="complete-btn">Mark complete</button>
          <button class="btn ghost" id="cancel-btn">Cancel</button>
        </div>
      </section>
    `);
  }

  function statsView({ progress, scheduled, plan }) {
    const totalTasks = scheduled.length;
    const completed = progress.completed_tasks.length;
    const earned = new Set(progress.badges);
    const completionPct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

    return el(`
      <section>
        <h2 style="margin-bottom: 18px;">Your stats</h2>
        <div class="stat-grid">
          <div class="stat-tile"><div class="big">${completionPct}%</div><div class="label">Overall progress</div></div>
          <div class="stat-tile"><div class="big">${progress.streak.current}</div><div class="label">Current streak</div></div>
          <div class="stat-tile"><div class="big">${progress.streak.best}</div><div class="label">Best streak</div></div>
          <div class="stat-tile"><div class="big">${progress.points}</div><div class="label">Total points</div></div>
          <div class="stat-tile"><div class="big">${completed}</div><div class="label">Tasks done</div></div>
          <div class="stat-tile"><div class="big">${progress.milestones_completed.length}</div><div class="label">Milestones</div></div>
        </div>

        <h3 style="margin: 28px 0 12px;">Badges</h3>
        <div class="badge-grid">
          ${NS_Game.BADGES.map(b => `
            <div class="badge ${earned.has(b.id) ? 'earned' : 'locked'}">
              <span class="b-icon">${b.icon}</span>
              <div class="b-name">${esc(b.name)}</div>
              <div class="b-desc">${esc(b.desc)}</div>
            </div>
          `).join('')}
        </div>

        <h3 style="margin: 28px 0 12px;">Your specialist</h3>
        <div class="specialist-card">
          <span class="specialist-icon">${esc(plan.specialist_icon || '✨')}</span>
          <h2>${esc(plan.specialist_name)}</h2>
          <p class="specialist-title">${esc(plan.specialist_title || '')}</p>
        </div>
      </section>
    `);
  }

  function errorBanner(message) {
    return el(`<div class="error-card"><h3>Something snagged</h3><p>${esc(message)}</p></div>`);
  }

  return {
    welcomeView, quizView, timelineView, generatingView, planView,
    dashboardView, timerView, statsView, errorBanner,
    buildScheduledTasks, tasksForDay,
  };
})();
