/* api.js — direct browser call to Anthropic with BYOK */
window.NS_API = (() => {
  const MODEL = 'claude-sonnet-4-6'; // PRD §R-P0-3
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  function systemPrompt() {
    return `You are a world-class domain specialist creating a deeply personalized goal-achievement plan.

You will produce ONLY a JSON object — no markdown fences, no prose before or after. Just JSON.

The plan must follow this exact schema:
{
  "specialist_name": "string — your full persona name",
  "specialist_title": "string — your credentials/expertise",
  "specialist_icon": "string — a single emoji",
  "identity_statement": "string — an 'I am...' affirmation for the user, 8-14 words",
  "domain": "string — short domain label",
  "timeline_weeks": number,
  "phases": [
    {
      "phase_name": "string",
      "phase_weeks": number,
      "phase_goal": "string — what the user achieves in this phase",
      "weekly_milestones": [
        { "id": "string unique id", "week": number, "description": "string — measurable" }
      ],
      "daily_tasks": [
        {
          "id": "string unique id",
          "description": "string — ULTRA-specific, written so a 10-year-old can follow",
          "estimated_minutes": number,
          "day_of_week": "daily" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
          "category": "string — e.g. training, study, practice, reflection",
          "phase_week": number
        }
      ]
    }
  ],
  "environment_tips": ["array of 3-6 specific setup actions"]
}

RULES — non-negotiable:
1. Every task description must be absurdly specific. Wrong: "practice scales". Right: "Open your guitar tuning app, tune all 6 strings, then play the C major scale ascending and descending 5 times at 60 BPM using a metronome."
2. Every task is small enough that completing it feels like a micro-win. Aim for tasks ≤ user's stated per-day time budget.
3. Account for the user's stated level, time, constraints, days/week. A beginner with 20 min gets simpler tasks than an intermediate with 60 min.
4. Include rest days where appropriate (e.g., 5 days on / 2 off for fitness).
5. Use plain language. No jargon without inline explanation.
6. Generate enough daily_tasks per phase to cover the phase_weeks at the user's stated days/week cadence — but cap total tasks at ~80 for the whole plan.
7. Task IDs must be unique strings like "p1w1d1_squats".
8. Milestone IDs unique like "p1_m1".
9. RESPOND IN JSON ONLY. No "Here is your plan:" preamble.`;
  }

  function userPrompt({ goal, quizAnswers, timelineWeeks, timelineChoice }) {
    const lines = [];
    lines.push(`GOAL: ${goal}`);
    lines.push('');
    lines.push('USER PROFILE:');
    for (const [k, v] of Object.entries(quizAnswers)) {
      lines.push(`- ${k}: ${v}`);
    }
    lines.push('');
    if (timelineChoice === 'custom') {
      lines.push(`TIMELINE: User set ${timelineWeeks} weeks`);
    } else {
      lines.push(`TIMELINE: User wants the realistic timeline you suggest. Pick what's truly realistic for their level + time budget.`);
    }
    lines.push('');
    lines.push('Now generate the JSON plan.');
    return lines.join('\n');
  }

  async function generatePlan({ apiKey, goal, quizAnswers, timelineWeeks, timelineChoice, onStatus }) {
    if (!apiKey) throw new Error('API key missing. Open Settings and add one.');

    const body = {
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt(),
      messages: [{ role: 'user', content: userPrompt({ goal, quizAnswers, timelineWeeks, timelineChoice }) }],
    };

    onStatus?.('Reaching the specialist...');

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Network error: ${e.message}`);
    }

    if (!response.ok) {
      const text = await response.text();
      let msg = `API error ${response.status}`;
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || msg;
      } catch {}
      if (response.status === 401) msg = 'Invalid API key. Check it in Settings.';
      if (response.status === 429) msg = 'Rate limited. Wait a moment and try again.';
      throw new Error(msg);
    }

    onStatus?.('Drafting your phased plan...');
    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    onStatus?.('Polishing the details...');
    return parsePlan(content);
  }

  function parsePlan(text) {
    // Strip possible code fences or stray prose
    let s = text.trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    // Find the first { and last } in case there's preamble
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Specialist returned no JSON — try again.');
    s = s.slice(start, end + 1);
    let plan;
    try { plan = JSON.parse(s); }
    catch (e) { throw new Error('Could not parse the plan JSON — try regenerating.'); }
    validate(plan);
    return plan;
  }

  function validate(plan) {
    const req = ['specialist_name', 'specialist_icon', 'identity_statement', 'timeline_weeks', 'phases'];
    for (const f of req) if (plan[f] == null) throw new Error(`Plan missing field: ${f}`);
    if (!Array.isArray(plan.phases) || plan.phases.length === 0) throw new Error('Plan has no phases.');
    for (const p of plan.phases) {
      if (!Array.isArray(p.daily_tasks)) throw new Error('Phase missing daily_tasks.');
    }
  }

  return { generatePlan, MODEL };
})();
