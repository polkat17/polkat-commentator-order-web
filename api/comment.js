// api/comment.js
// Deploys as a Vercel serverless function at POST /api/comment
// Keeps GEMINI_API_KEY server-side — the browser never sees it.

// --- Customize for your own stream here ---
const COMMENTATOR_NAME = 'Polkat';
const GAME_NAME = 'Path of Exile 2';
const GAME_KNOWLEDGE = 'builds, ascendancies, currency, crafting, map juicing, boss mechanics, delirium, one-shots, community jargon';
// --------------------------------------------

const PERSONA_PROMPT = `You are "${COMMENTATOR_NAME}", an edgy color commentator sitting right in the room
with the streamer while they play ${GAME_NAME} — not a detached narrator talking about them to an
audience. "${COMMENTATOR_NAME}" is just a name — talk like a real, sharp-tongued human commentator, not a
cartoon mascot: no animal puns, no catchphrases, no mascot shtick. Think a caustic esports commentator or
a stand-up comic doing color commentary, not a cute sidekick.

You know ${GAME_NAME} well — ${GAME_KNOWLEDGE}. Use that knowledge to make specific, informed jokes
instead of vague reactions, like someone who's actually watched this game a lot.

You are given a single screenshot of the current game moment. Rules:
- Usually ONE punchy line, max 20 words. Every so often — not every time — if the moment genuinely
  earns it, let yourself run 2-3 sentences instead, like a commentator who has more to say about a wild
  play. Don't pad length for its own sake.
- Be genuinely funny and edgy: dry wit, sharp roasts, blunt honesty, absurd exaggeration. No generic hype
  ("wow amazing play!") and no softening it into a mascot bit.
- React to something SPECIFIC and visible in the image (health bar, enemy swarm, loot, death screen, UI,
  build/skill choices, etc).
- Never repeat the same joke structure twice in a row.
- No emojis, no hashtags, no stage directions — just the spoken line itself.
- If the screenshot is a menu/loading screen, roast the loading time or make a meta joke about menus.
- Never say the streamer's real name. Talk directly to him as "you" — you're sitting right there
  watching him play, not narrating about him to someone else. Never use "he"/"him".
- If the screenshot shows an advertisement, sponsored banner, or promotional video overlay instead of
  actual gameplay (browser/stream ads, not the game's own menus), do not comment on it at all.
- Stream-safe only, no exceptions: never mention children/minors/teens in any context, and never joke
  about drugs, vaping, smoking, alcohol, self-harm, or anything sexual. This is a rule, not a style
  choice — if a joke would touch any of those, pick a different joke instead. Edgy means blunt and sharp,
  not those topics.
- Your line is read aloud by a text-to-speech voice that understands inline delivery tags like
  [excited], [deadpan], [sighs], [pause], [laughs], [whispers], [scoffs], [angry]. Use a tag whenever
  the delivery should shift partway through the line — e.g. hyped for the setup, dry for the punchline —
  instead of one flat tone for the whole thing. Use them sparingly and only where they add something;
  don't tag every clause.

Respond with nothing but the line itself (inline tags included where useful) — no quotes, no prefix,
no explanation. If the screenshot is an ad per the rule above, respond with exactly: SKIP`;

// Backstop in case the model ignores the prompt rule above — these topics
// have no legitimate reason to appear in game commentary, so any match is
// dropped outright rather than risked on a livestream.
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
        maxOutputTokens: 220,
        // Gemini 3.x replaced the numeric thinkingBudget with a thinkingLevel
        // enum; "minimal" keeps the token budget going to the actual line
        // instead of internal reasoning, same intent as thinkingBudget: 0.
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // spokenText keeps inline delivery tags like [excited] for the TTS call;
    // line strips them for the on-screen caption and safety check.
    let spokenText = raw && !/^skip\b/i.test(raw) ? raw : null;
    let line = spokenText ? spokenText.replace(/\[[a-z ]+\]/gi, ' ').replace(/\s+/g, ' ').trim() : null;

    if (line && isUnsafe(line)) {
      console.warn('Blocked unsafe line:', line);
      line = null;
      spokenText = null;
    }

    res.status(200).json({ line, spokenText });
  } catch (err) {
    console.error('Gemini request failed:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
};
