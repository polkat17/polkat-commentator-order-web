// api/speak.js
// Deploys as a Vercel serverless function at POST /api/speak
// Keeps ELEVENLABS_API_KEY server-side — the browser never sees it.
// Takes the commentary line (with inline delivery tags like [excited]) and
// returns real generated audio, replacing the browser's built-in TTS voice.

// Voice Library voices (like "Louis") require a paid ElevenLabs plan to use
// via the API — free tier only works with premade/default voices like this one.
const DEFAULT_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server missing ELEVENLABS_API_KEY' });
    return;
  }

  const { text } = req.body || {};
  if (!text) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_v3',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.6,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('ElevenLabs request failed:', elevenRes.status, errText);
      res.status(502).json({ error: 'TTS request failed' });
      return;
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('TTS request failed:', err);
    res.status(500).json({ error: 'TTS request failed' });
  }
};
