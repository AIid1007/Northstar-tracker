# NorthStar ✨

> Turn any goal into tiny, expert-crafted footsteps. Built for people who get stuck at *"where do I start?"*

A static, single-page web app that:
- Takes any free-text goal
- Runs a short adaptive intake quiz (5–6 questions, button/slider UI)
- Calls Claude to generate a phased plan with ultra-specific daily micro-tasks, weekly milestones, and environment-design tips, written by a domain-specialist persona
- Schedules tasks across your timeline based on your stated days-per-week cadence
- Tracks streaks, points, badges, and milestone celebrations (all rule-based, no extra API calls)
- Includes a built-in focus/rest timer (Pomodoro-style, count-up, never punishes you)
- Works fully offline after the initial plan is generated (Service Worker + localStorage)
- Installable as a PWA

Single file structure, zero build step. Drops into GitHub Pages as-is.

## Quick start (local)

```bash
# Any static server. e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `northstar`).
2. Push everything in this folder to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "NorthStar v1"
   git branch -M main
   git remote add origin https://github.com/<you>/northstar.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / root**.
4. Your site goes live at `https://<you>.github.io/northstar/` within ~1 minute.

## Using it

1. Open the site, click the ⚙ (top right), paste your Anthropic API key. [Get one here](https://console.anthropic.com/settings/keys). The key is stored only in your browser's localStorage — never sent anywhere except `api.anthropic.com`.
2. Type your goal on the welcome screen.
3. Answer the quiz (~90 seconds).
4. Pick a timeline (or let the specialist pick).
5. Wait ~15–30 seconds for plan generation.
6. Daily dashboard appears. Tap a task → ▶ to start the timer, or tap the circle to mark it done.

## Architecture

| Layer | Tech |
|---|---|
| Hosting | GitHub Pages (static) |
| UI | Vanilla JS, no framework, no build step |
| Styling | CSS custom properties + Google Fonts (Fraunces / Inter / JetBrains Mono) |
| AI | Anthropic Claude Sonnet 4.5 via direct browser call (`anthropic-dangerous-direct-browser-access`) |
| State | `localStorage` (schema in `js/storage.js`, matches PRD §8.4) |
| Offline | Service Worker (`sw.js`) caches the app shell |
| Auth | None — Bring-Your-Own-Key |

## File map

```
index.html        — shell, header, settings dialog, script tags
styles.css        — all visual styling (warm cream / coral / cocoa palette)
manifest.json     — PWA manifest
sw.js             — Service Worker (cache-first for shell, never caches API)
js/
  storage.js      — localStorage wrapper, schema, defaults
  nudges.js       — pre-stored motivational + tough-love messages
  gamification.js — points, badges, streak logic
  quiz.js         — adaptive question flow + domain inference
  api.js          — Anthropic API client, prompt, JSON parsing/validation
  timer.js        — focus/rest count-up timer with subscribe()
  views.js        — pure render functions for each screen
  app.js          — router, state, event wiring
```

## Security notes

This app is **single-user, BYOK**. The Anthropic API key is stored in `localStorage` and sent directly from the browser to `api.anthropic.com`. This is fine for personal use on your own device. **Do not** share your deployed URL with others while your key is loaded — anyone with browser access could inspect it. For a multi-user version, swap to the Firebase Cloud Function proxy described in the PRD.

## Customizing

- **Tone of nudges** — `js/nudges.js`. Toggle tough-love mode in Settings.
- **Quiz questions** — `js/quiz.js`. Add domain-specific questions in `domainQ`.
- **Plan prompt** — `js/api.js`, `systemPrompt()`. The shape of the generated plan is enforced here.
- **Colors / type** — `:root` CSS variables at the top of `styles.css`.
- **Focus/rest interval** — Settings dialog, persisted in localStorage.

## Known v1 scope

Per the PRD §4 non-goals: no accounts, no cloud sync, no social, no multi-goal dashboard, no push notifications, English only. Clearing browser storage (or using a different browser) means starting fresh — there's an **Export data** button in Settings as a manual backup.

## License

MIT. Build whatever you want with it.
