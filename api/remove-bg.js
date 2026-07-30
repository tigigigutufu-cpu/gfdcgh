export const config = { maxDuration: 60 };

// /api/remove-bg.js — tries multiple background-removal providers in order, whichever
// key is configured first. If NONE are configured (or all fail), it returns a clear
// "fallback" flag so the browser can run a free, local, client-side removal instead.
//
// Supported providers (set ANY ONE OR MORE as Vercel Environment Variables):
//   REMOVE_BG_API_KEY   -> https://www.remove.bg              (api.remove.bg)
//   RAPIDAPI_KEY         -> any "Remove Background" API on RapidAPI (also set RAPIDAPI_HOST)
//   GOOGLE_API_KEY        -> Gemini image model (generativelanguage.googleapis.com)
//
// Order tried: remove.bg -> RapidAPI -> Google Gemini -> fallback (client-side).

async function tryRemoveBg(imageBuffer, mimeType) {
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) return null;
  const form = new FormData();
  form.append('image_file', new Blob([imageBuffer], { type: mimeType }), 'image.png');
  form.append('size', 'auto');
  const r = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: form,
  });
  if (!r.ok) return null;
  const arrayBuffer = await r.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mime: 'image/png' };
}

async function tryRapidApi(imageBuffer, mimeType) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST; // e.g. "background-removal6.p.rapidapi.com" (set to match your subscribed API)
  if (!key || !host) return null;
  const form = new FormData();
  form.append('image', new Blob([imageBuffer], { type: mimeType }), 'image.png');
  const r = await fetch(`https://${host}/image`, {
    method: 'POST',
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
    body: form,
  });
  if (!r.ok) return null;
  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await r.json();
    const b64 = data.image || data.result || (data.data && data.data.image);
    if (!b64) return null;
    return { base64: b64.replace(/^data:.*;base64,/, ''), mime: 'image/png' };
  }
  const arrayBuffer = await r.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mime: contentType || 'image/png' };
}

async function tryGemini(base64Image, mimeType, bg) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const prompt = `Remove the background from this photo and replace it with a clean, flat, ${bg} background. Keep the main subject exactly as it is.`;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Image } }] }],
      }),
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const imagePart = parts && parts.find((p) => p.inline_data || p.inlineData);
  const inline = imagePart && (imagePart.inline_data || imagePart.inlineData);
  if (!inline || !inline.data) return null;
  return { base64: inline.data, mime: inline.mime_type || inline.mimeType || 'image/png' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType, bgColor } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Please upload an image first.' });
  }
  if (image.length > 8 * 1024 * 1024 * 1.4) {
    return res.status(400).json({ error: 'Image is too large. Please use an image under 8MB.' });
  }

  const bg = bgColor || 'plain white';
  const buffer = Buffer.from(image, 'base64');
  const mime = mimeType || 'image/jpeg';

  try {
    let result = await tryRemoveBg(buffer, mime).catch(() => null);
    if (!result) result = await tryRapidApi(buffer, mime).catch(() => null);
    if (!result) result = await tryGemini(image, mime, bg).catch(() => null);

    if (!result) {
      return res.status(200).json({ fallback: true, reason: 'No background-removal provider is configured or all failed — use local browser fallback.' });
    }

    return res.status(200).json({ image: `data:${result.mime};base64,${result.base64}` });
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: 'Provider error — use local browser fallback.' });
  }
}
