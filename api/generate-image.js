export const config = { maxDuration: 60 };

// /api/generate-image.js
// Vercel serverless function (Node.js runtime).
//
// Uses Pollinations.ai — a free, public text-to-image endpoint that needs NO API key and NO billing setup.
// The server (this function) validates and filters every prompt before generating, then streams the image
// back through our own domain so the frontend never talks to a third party directly.
//
// WANT BETTER QUALITY LATER? Swap this for a paid provider (Stability AI, Replicate, OpenAI) —
// just replace the fetch() call below with that provider's endpoint + your API key stored in a
// Vercel Environment Variable (Settings -> Environment Variables), and keep returning
// { image: "data:image/png;base64,..." } so the frontend keeps working unchanged.

const BLOCKLIST = [
  'nude', 'naked', 'nsfw', 'porn', 'sex', 'sexy', 'seductive', 'topless',
  'bikini', 'lingerie', 'underwear', 'cleavage', 'erotic', 'fetish',
  'hentai', 'nudity', 'strip', 'explicit', 'xxx', 'onlyfans',
  'gore', 'blood', 'kill', 'murder', 'suicide', 'self harm', 'weapon',
  'terrorist', 'bomb', 'nazi', 'hate symbol', 'child', 'minor', 'kid',
  'teen', 'underage', 'loli'
];

function isBlocked(prompt) {
  const lower = prompt.toLowerCase();
  return BLOCKLIST.some((w) => lower.includes(w));
}

async function toDataUrl(res) {
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${base64}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, style } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide a valid prompt.' });
  }
  if (isBlocked(prompt)) {
    return res.status(400).json({ error: 'This prompt was blocked by our content guidelines.' });
  }

  const safePrompt = `${prompt.trim()}, ${style || 'digital art'}, modest clothing, fully covered, respectful and tasteful, family friendly, highly detailed, sharp focus, professional quality, 4k`;
  const seed = Math.floor(Math.random() * 100000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux&enhance=true`;

  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'The image provider failed to generate this image. Please try again.' });
    }
    const dataUrl = await toDataUrl(imgRes);
    return res.status(200).json({ image: dataUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error while generating the image. Please try again.' });
  }
}
