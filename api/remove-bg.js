export const config = { maxDuration: 60 };

// /api/remove-bg.js — tries multiple background-removal providers in order.
// Priority: Cloudflare AI (3 Rotating Keys from Vercel ENV) -> remove.bg -> RapidAPI -> Google Gemini -> fallback (client-side).

// 1. Cloudflare Workers AI with 3 Rotating Keys
async function tryCloudflareAI(imageBuffer) {
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  // Vercel Environment Variables se 3 Keys uthayega
  const API_KEYS = [
    process.env.CLOUDFLARE_TOKEN_1,
    process.env.CLOUDFLARE_TOKEN_2,
    process.env.CLOUDFLARE_TOKEN_3
  ].filter(Boolean); // Only keeps valid/non-empty keys

  if (!ACCOUNT_ID || API_KEYS.length === 0) {
    return null;
  }

  // Randomly select 1 key out of available keys (Key Rotation)
  const randomKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/briaai/rmbg-1.4`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${randomKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBuffer,
    }
  );

  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mime: 'image/png' };
}

// 2. Remove.bg Provider
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

// 3. RapidAPI Provider
async function tryRapidApi(imageBuffer, mimeType) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
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

// 4. Gemini Image Provider
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

// Main Handler
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
    // Priority 1: Cloudflare AI (Fastest & HD)
    let result = await tryCloudflareAI(buffer).catch(() => null);

    // Priority 2: Remove.bg API
    if (!result) result = await tryRemoveBg(buffer, mime).catch(() => null);

    // Priority 3: RapidAPI
    if (!result) result = await tryRapidApi(buffer, mime).catch(() => null);

    // Priority 4: Gemini AI
    if (!result) result = await tryGemini(image, mime, bg).catch(() => null);

    // Fallback trigger if no provider works
    if (!result) {
      return res.status(200).json({ 
        fallback: true, 
        reason: 'No background-removal provider is configured or all failed — use local browser fallback.' 
      });
    }

    return res.status(200).json({ image: `data:${result.mime};base64,${result.base64}` });
  } catch (err) {
    return res.status(200).json({ 
      fallback: true, 
      reason: 'Provider error — use local browser fallback.' 
    });
  }
}
