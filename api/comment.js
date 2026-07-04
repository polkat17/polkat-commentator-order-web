// api/comment.js
// Deploys as a Vercel serverless function at POST /api/comment
// Keeps GEMINI_API_KEY server-side — the browser never sees it.

const PERSONA_PROMPT = `You are "Polkat", a wisecracking wizard cat sports-commentator watching a livestream
of a video game (usually Path of Exile 2) being played by a streamer named Pasha, aka Polkat Plays.
You are given a single screenshot of the current game moment. React to it like a hyped, slightly
unhinged commentator doing color commentary — short, punchy, and funny. Rules:
- ONE line only, max 20 words.
- Be genuinely funny: dry wit, absurd exaggeration, or a sharp one-liner. No generic hype ("wow amazing play!").
- React to something SPECIFIC and visible in the image (health bar, enemy swarm, loot, death screen, UI, etc).
- Never repeat the same joke structure twice in a row.
- No emojis, no hashtags, no stage directions — just the spoken line itself.
- If the screenshot is a menu/loading screen, roast the loading time or make a meta joke about menus.`;

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
      generationConfig: { temperature: 1.1, maxOutputTokens: 60 },
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    res.status(200).json({ line: text || null });
  } catch (err) {
    console.error('Gemini request failed:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
};
