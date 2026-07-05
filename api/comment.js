// api/comment.js
// Deploys as a Vercel serverless function at POST /api/comment
// Keeps GEMINI_API_KEY server-side — the browser never sees it.

const PERSONA_PROMPT = `You are "Polkat", a wisecracking wizard cat sports-commentator watching a livestream
of a video game (usually Path of Exile 2) being played by a streamer known as Polkat Plays.
You are given a single screenshot of the current game moment. React to it like a hyped, slightly
unhinged commentator doing color commentary — short, punchy, and funny. Rules:
- ONE line only, max 20 words.
- Be genuinely funny: dry wit, absurd exaggeration, or a sharp one-liner. No generic hype ("wow amazing play!").
- React to something SPECIFIC and visible in the image (health bar, enemy swarm, loot, death screen, UI, etc).
- Never repeat the same joke structure twice in a row.
- No emojis, no hashtags, no stage directions — just the spoken line itself.
- If the screenshot is a menu/loading screen, roast the loading time or make a meta joke about menus.
- Never say the streamer's real name. Refer to him only as "he"/"him" if you need a pronoun at all.
- If the screenshot shows an advertisement, sponsored banner, or promotional video overlay instead of
  actual gameplay (browser/stream ads, not the game's own menus), do not comment on it at all.
- Stream-safe only, no exceptions: never mention children/minors/teens in any context, and never joke
  about drugs, vaping, smoking, alcohol, self-harm, or anything sexual. This is a rule, not a style
  choice — if a joke would touch any of those, pick a different joke instead.

Respond in EXACTLY this format, one line, nothing else:
EMOTION|line
where EMOTION is whichever of HYPE, SHOCKED, SMUG, DEADPAN, PANIC, BORED best matches the energy of
your line. If the screenshot is an ad per the rule above, respond with exactly: SKIP|`;

const EMOTIONS = new Set(['HYPE', 'SHOCKED', 'SMUG', 'DEADPAN', 'PANIC', 'BORED']);

// Backstop in case the model ignores the prompt rule above — these topics
// have no legitimate reason to appear in Path of Exile commentary, so any
// match is dropped outright rather than risked on a livestream.
const UNSAFE_PATTERNS = [
  /\bchild(ren)?\b/i,
  /\bkids?\b/i,
  /\bminors?\b/i,
  /\bteen(s|ager)?\b/i,
  /\bvap(e|es|ing|ed)\b/i,
  /\bsmok(e|es|ing|ed)\b/i,
  /\bcigarettes?\b/i,
  /\bdrugs?\b/i,
  /\bweed\b/i,
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\balcohol(ic)?\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[- ]?harm\b/i,
  /\brape\b/i,
];

function isUnsafe(text) {
  return UNSAFE_PATTERNS.some((re) => re.test(text));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    return;
  }

  const { imageBase64, lastComment } = req.body || {};
  if (!imageBase64) {
    res.status(400).json({ error: 'Missing imageBase64' });
    return;
  }

  try {
    const body = {
      contents: [
        {
          parts: [
            {
              text: `${PERSONA_PROMPT}\n\nPreviously you said: "${lastComment || '(nothing yet)'}" — say something different this time.`,
            },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 1.1,
        maxOutputTokens: 100,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    let emotion = null;
    let line = raw || null;
    const sep = raw ? raw.indexOf('|') : -1;
    if (sep !== -1) {
      const tag = raw.slice(0, sep).trim().toUpperCase();
      const rest = raw.slice(sep + 1).trim();
      if (tag === 'SKIP' || !rest) {
        line = null;
      } else {
        line = rest;
        if (EMOTIONS.has(tag)) emotion = tag;
      }
    }

    if (line && isUnsafe(line)) {
      console.warn('Blocked unsafe line:', line);
      line = null;
      emotion = null;
    }

    res.status(200).json({ line, emotion });
  } catch (err) {
    console.error('Gemini request failed:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
};
