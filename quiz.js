/* quiz.js — adaptive intake quiz, button/slider UI per PRD §R-P0-2 */
window.NS_Quiz = (() => {
  // Lightweight client-side domain inference
  function inferDomain(goalText) {
    const t = (goalText || '').toLowerCase();
    const tests = [
      { d: 'fitness', re: /\b(fit|gym|muscle|weight|run|marathon|push.?up|squat|cardio|strength|abs|calf|lose|gain|body|workout|exercise|yoga|stretch)\b/ },
      { d: 'learning', re: /\b(learn|study|read|book|language|spanish|french|japanese|german|chinese|math|history|science|degree|exam|certification|course)\b/ },
      { d: 'coding', re: /\b(code|coding|program|python|javascript|react|app|software|developer|engineer|leetcode|algorithm|build a|website)\b/ },
      { d: 'music', re: /\b(guitar|piano|drum|sing|music|song|instrument|violin|bass|melody|chord|scale)\b/ },
      { d: 'creative', re: /\b(draw|paint|art|write|novel|story|poem|design|photo|video|edit|illustration)\b/ },
      { d: 'business', re: /\b(business|startup|launch|customer|revenue|sales|marketing|product|saas|side hustle|freelance)\b/ },
      { d: 'finance', re: /\b(save|saving|invest|budget|debt|money|finance|retire|stock|wealth)\b/ },
      { d: 'mindfulness', re: /\b(meditat|mindful|anxiety|stress|calm|sleep|journal|gratitude|habit)\b/ },
    ];
    for (const t1 of tests) if (t1.re.test(t)) return t1.d;
    return 'general';
  }

  // Common questions for all goals
  const common = [
    {
      id: 'level',
      title: 'Where are you starting from?',
      help: 'Be honest. The plan adjusts.',
      type: 'options',
      options: [
        { v: 'absolute_beginner', label: 'Absolute beginner', emoji: '🌱' },
        { v: 'some_experience', label: 'I\'ve dabbled', emoji: '🌿' },
        { v: 'intermediate', label: 'Intermediate', emoji: '🌳' },
        { v: 'advanced', label: 'Advanced — pushing limits', emoji: '🏔' },
      ],
    },
    {
      id: 'time_per_day',
      title: 'How much time can you realistically give this each day?',
      help: 'A realistic small number beats an ambitious one you won\'t keep.',
      type: 'slider',
      min: 5, max: 180, step: 5, default: 30, unit: 'min',
    },
    {
      id: 'days_per_week',
      title: 'How many days a week?',
      help: '',
      type: 'options',
      cols: 2,
      options: [
        { v: 3, label: '3 days', emoji: '📅' },
        { v: 4, label: '4 days', emoji: '📅' },
        { v: 5, label: '5 days', emoji: '📅' },
        { v: 7, label: 'Every day', emoji: '🔥' },
      ],
    },
    {
      id: 'past_attempt',
      title: 'Have you tried this before?',
      help: '',
      type: 'options',
      options: [
        { v: 'first_time', label: 'First serious attempt', emoji: '✨' },
        { v: 'lost_motivation', label: 'Tried, lost motivation', emoji: '🪫' },
        { v: 'too_overwhelming', label: 'Tried, got overwhelmed', emoji: '🌀' },
        { v: 'progress_then_stopped', label: 'Made progress, then stopped', emoji: '⏸' },
      ],
    },
    {
      id: 'motivation',
      title: 'Why does this matter to you?',
      help: 'Your real reason — the plan uses it later when you wobble.',
      type: 'options',
      options: [
        { v: 'health', label: 'Health and longevity', emoji: '❤️' },
        { v: 'confidence', label: 'Confidence in myself', emoji: '⚡' },
        { v: 'career', label: 'Career or income', emoji: '💼' },
        { v: 'curiosity', label: 'Pure curiosity / love it', emoji: '🌟' },
        { v: 'someone_else', label: 'Someone I care about', emoji: '💛' },
        { v: 'prove_myself', label: 'Prove I can do hard things', emoji: '🦁' },
      ],
    },
  ];

  // Domain-specific question
  const domainQ = {
    fitness: {
      id: 'constraints',
      title: 'Any injuries or physical constraints?',
      type: 'options',
      options: [
        { v: 'none', label: 'None — green light', emoji: '🟢' },
        { v: 'minor', label: 'Minor (knees, back, etc)', emoji: '🟡' },
        { v: 'significant', label: 'Significant — be careful', emoji: '🔴' },
      ],
    },
    learning: {
      id: 'style',
      title: 'How do you learn best?',
      type: 'options',
      options: [
        { v: 'reading', label: 'Reading and notes', emoji: '📖' },
        { v: 'video', label: 'Video walkthroughs', emoji: '📺' },
        { v: 'doing', label: 'Doing — projects, practice', emoji: '🛠' },
        { v: 'mixed', label: 'Mix of everything', emoji: '🎨' },
      ],
    },
    coding: {
      id: 'environment',
      title: 'What\'s your setup like?',
      type: 'options',
      options: [
        { v: 'nothing', label: 'No setup yet', emoji: '🆕' },
        { v: 'basic', label: 'Editor installed, basic comfort', emoji: '💻' },
        { v: 'fluent', label: 'Comfortable in my IDE', emoji: '⌨️' },
      ],
    },
    music: {
      id: 'instrument_access',
      title: 'Do you have your instrument ready?',
      type: 'options',
      options: [
        { v: 'yes_owned', label: 'Yes, I own it', emoji: '🎸' },
        { v: 'borrowing', label: 'Borrowing / renting', emoji: '🎵' },
        { v: 'need_to_get', label: 'Need to get one', emoji: '🛒' },
      ],
    },
    creative: {
      id: 'tools',
      title: 'What tools do you have?',
      type: 'options',
      options: [
        { v: 'basics', label: 'The basics — pencil/paper/free apps', emoji: '✏️' },
        { v: 'decent', label: 'Decent setup', emoji: '🎨' },
        { v: 'pro', label: 'Pro-level tools', emoji: '💎' },
      ],
    },
    business: {
      id: 'stage',
      title: 'Where are you in the journey?',
      type: 'options',
      options: [
        { v: 'idea', label: 'Just an idea', emoji: '💡' },
        { v: 'building', label: 'Building / pre-launch', emoji: '🔨' },
        { v: 'launched', label: 'Launched, finding traction', emoji: '🚀' },
      ],
    },
    finance: {
      id: 'situation',
      title: 'What best describes you right now?',
      type: 'options',
      options: [
        { v: 'tight', label: 'Money is tight', emoji: '🪙' },
        { v: 'getting_by', label: 'Getting by, want better habits', emoji: '⚖️' },
        { v: 'stable', label: 'Stable, ready to optimize', emoji: '📊' },
      ],
    },
    mindfulness: {
      id: 'when',
      title: 'When do you usually have the most quiet?',
      type: 'options',
      options: [
        { v: 'morning', label: 'Morning', emoji: '🌅' },
        { v: 'midday', label: 'Midday', emoji: '☀️' },
        { v: 'evening', label: 'Evening', emoji: '🌆' },
        { v: 'before_bed', label: 'Before bed', emoji: '🌙' },
      ],
    },
  };

  function buildQuiz(goalText) {
    const domain = inferDomain(goalText);
    const steps = [...common];
    if (domainQ[domain]) {
      steps.splice(1, 0, domainQ[domain]); // insert after "level"
    }
    return { domain, steps };
  }

  return { buildQuiz, inferDomain };
})();
