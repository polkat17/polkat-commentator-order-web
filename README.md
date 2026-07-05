# AI Stream Commentator

A browser overlay that watches your gameplay and roasts it live: it screen-shares
your game, periodically sends a frame to Gemini with a color-commentator persona,
and speaks the result aloud with ElevenLabs — no install, no desktop app, just a
URL you open in a browser tab and add to OBS as a source.

This repo ships pre-configured with a working example persona ("Polkat", tuned for
Path of Exile 2), but it's built to be forked and repointed at **any game and any
streamer identity** — see [Customizing for your game](#customizing-for-your-game)
below. Most of the work is one edit to a handful of constants, not a rewrite.

## How it works

1. The page grabs a screenshot of whatever window/screen you share, on a timer.
2. That frame goes to Gemini along with a persona prompt describing the
   commentator's personality and what it knows about the game.
3. Gemini's reply — a short line, sometimes with inline delivery tags like
   `[deadpan]` or `[excited]` — is sent to ElevenLabs, which returns real generated
   audio (not the browser's robotic built-in voice).
4. The audio plays and the line shows as an on-screen caption, styled to composite
   over your gameplay as an OBS overlay.

## How it's structured

```
├── public/
│   ├── index.html      overlay UI (start button, caption bubble, avatar)
│   └── app.js           screen capture, plays TTS audio, calls the API
├── api/
│   ├── comment.js       serverless function — holds the Gemini key, generates the line
│   └── speak.js          serverless function — holds the ElevenLabs key, returns audio
├── package.json
├── .env.example
└── .gitignore
```

The split matters: `public/app.js` runs in the browser and is visible to anyone
who opens devtools, so API keys must never live there. `api/comment.js` and
`api/speak.js` run server-side (as Vercel serverless functions) and are the
only places that touch the Gemini and ElevenLabs keys respectively.

## Customizing for your game

Everything persona-specific lives in a few constants at the top of
`api/comment.js`:

```js
const COMMENTATOR_NAME = 'Polkat';
const GAME_NAME = 'Path of Exile 2';
const GAME_KNOWLEDGE = 'builds, ascendancies, currency, crafting, map juicing, boss mechanics, delirium, one-shots, community jargon';
```

Change those three lines to your commentator's name, your game, and a short list
of the terminology/mechanics that game's community actually uses — that's what
makes jokes land as specific instead of generic. Everything else in the prompt
(tone, length, safety rules, delivery tags) is already game-agnostic.

Cosmetic branding (the 🐱 avatar, page title, colors) lives in `public/index.html`
and is just placeholder styling — swap it for whatever fits your stream.

## Local development

```bash
npm install
cp .env.example .env   # add your Gemini and ElevenLabs keys
npx vercel dev
```

This serves the site at `http://localhost:3000` with `/api/comment` and
`/api/speak` working locally exactly as they will in production.

## Deploying

Simplest path is Vercel (free tier is plenty for this):

```bash
npx vercel
```

Then in the Vercel dashboard for the project: **Settings → Environment Variables**
→ add `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, and optionally `ELEVENLABS_VOICE_ID`.
Redeploy after adding them.

Any other host that supports a Node serverless function would work too — both
handlers are plain Node with no Vercel-specific APIs, so porting them to
Netlify Functions or similar is a small adaptation, not a rewrite.

## Using it while streaming

1. Open the deployed URL (or localhost) in a browser tab, click **Start watching**,
   and pick the window/screen that shows your gameplay (capture card, emulator,
   another monitor, etc).
2. Add that browser tab/window in OBS as a **Window Capture** source — the page
   is transparent except for the avatar/caption bubble, so it composites over
   your gameplay.
3. Audio: either let OBS pick up your desktop audio (which includes the
   ElevenLabs voice), or route it through a virtual audio cable / hardware
   mixer if your setup doesn't run audio through OBS directly.

## Notes for further development

- **Tune capture behaviour**: `COMMENT_INTERVAL_MS` and `JPEG_QUALITY` are at
  the top of `public/app.js`.
- **Try a different ElevenLabs voice**: set `ELEVENLABS_VOICE_ID`, no code
  changes needed. Voice Library (community) voices need a paid ElevenLabs plan
  to use via the API — free tier is limited to your account's premade/default
  voices.
- **Watch your Gemini quota**: free-tier daily request limits vary by model and
  have been tightened over time. If commentary suddenly stops mid-stream, check
  for a 429/quota error in the `api/comment` function logs before assuming
  something's broken.
- **Natural next features** (discussed but not yet built):
  - Multi-frame "burst" capture (3–4 stills a couple seconds apart in one
    Gemini call) for jokes that need to see motion/sequence, instead of a
    single still.
  - Event-triggered capture (cheap local pixel/color checks for health-bar
    drops, death screens, loot flashes) instead of a blind fixed timer —
    call `captureAndComment()` on trigger instead of only via `setInterval`.
- No secrets are committed — `.env` is gitignored. You'll need your own copies
  of `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in `.env` for local testing.

## License

MIT — see [LICENSE](LICENSE).
