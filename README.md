# Polkat Commentator (Web)

Browser version of the AI stream commentator: screen-shares your gameplay,
sends periodic frames to Gemini with a comedy-commentator persona, and speaks
the result aloud via TTS — no install, just a URL.

This replaces the earlier Electron desktop version. Same idea, same persona,
but runs as a normal web page so it's easier to iterate on and doesn't need
packaging/relaunching to test changes.

## How it's structured

```
polkat-commentator-web/
├── public/
│   ├── index.html      overlay UI (start button, caption bubble, avatar)
│   └── app.js           screen capture, TTS, calls the API
├── api/
│   └── comment.js       serverless function — holds the Gemini key, proxies requests
├── package.json
├── .env.example
└── .gitignore
```

The split matters: `public/app.js` runs in the browser and is visible to anyone
who opens devtools, so the Gemini API key must never live there. `api/comment.js`
runs server-side (as a Vercel serverless function) and is the only place that
touches the key.

## Local development

```bash
npm install
cp .env.example .env   # add your Gemini key
npx vercel dev
```

This serves the site at `http://localhost:3000` with `/api/comment` working
locally exactly as it will in production.

## Deploying

Simplest path is Vercel (free tier is plenty for this):

```bash
npx vercel
```

Then in the Vercel dashboard for the project: **Settings → Environment Variables**
→ add `GEMINI_API_KEY`. Redeploy after adding it.

Any other host that supports a Node serverless function would work too — the
`api/comment.js` handler is plain Node with no Vercel-specific APIs, so porting
it to Netlify Functions or similar is a small adaptation, not a rewrite.

## Using it while streaming

1. Open the deployed URL (or localhost) in a browser tab, click **Start watching**,
   and pick the window/screen that shows your PS5 capture feed.
2. Add that browser tab/window in OBS as a **Window Capture** source — the page
   is transparent except for the avatar/caption bubble, so it composites over
   your gameplay.
3. Audio: same as before — either let OBS pick up your desktop audio (which
   now includes the TTS voice), or route TTS through a virtual audio cable /
   hardware mixer if you're on PS5-native broadcast (no OBS in the loop). See
   earlier notes on that if needed — worth revisiting once this is working.

## Continuing development in Claude Code

This folder is a complete, self-contained project — safe to `cd` into and open
directly with Claude Code. A few pointers for that session:

- **Tune the persona**: `PERSONA_PROMPT` lives in `api/comment.js`. Rewriting
  tone/jokes only touches that one string.
- **Tune capture behaviour**: `COMMENT_INTERVAL_MS` and `JPEG_QUALITY` are at
  the top of `public/app.js`.
- **Natural next features** (discussed but not yet built):
  - Multi-frame "burst" capture (3–4 stills a couple seconds apart in one
    Gemini call) for jokes that need to see motion/sequence, instead of a
    single still.
  - Event-triggered capture (cheap local pixel/color checks for health-bar
    drops, death screens, loot flashes) instead of a blind fixed timer —
    call `captureAndComment()` on trigger instead of only via `setInterval`.
  - Swapping `speechSynthesis` for a nicer TTS voice (e.g. ElevenLabs) —
    would mean adding a second API route that returns audio instead of text,
    and playing it via an `<audio>` element instead of the Web Speech API.
- No secrets are committed — `.env` is gitignored. Claude Code will need its
  own copy of `GEMINI_API_KEY` in `.env` for local testing.
