export const config = { maxDuration: 60 };

// /api/enhance-image.js — tries multiple image-enhancement/upscale providers in order,
// whichever key is configured first. If NONE are configured (or all fail), it returns a
// "fallback" flag so the browser runs a free, local, client-side sharpen/enhance instead.
//
// Supported providers (set ANY ONE OR MORE as Vercel Environment Variables):
//   REPLICATE_API_TOKEN -> https://replicate.com (Real-ESRGAN upscale model)
//   DEEPAI_API_KEY        -> https://deepai.org (torch-srgan / waifu2x image upscale)
//   GOOGLE_API_KEY          -> Gemini image model (generativelanguage.googleapis.com)
//
// Order tried: Replicate -> DeepAI -> Google Gemini -> fallback (client-side).

async function tryReplicate(base64Image, mimeType) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Real-ESRGAN general upscale/enhance model
      version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46a3',
      input: { image: dataUrl, scale: 2, face_enhance: false },
    }),
  });
  if (!create.ok) return null;
  let prediction = await create.json();

  for (let i = 0; i < 25 && prediction.status !== 'succeeded' && prediction.status !== 'failed'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!poll.ok) return null;
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded' || !prediction.output) return null;

  const outUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const imgRes = await fetch(outUrl);
  if (!imgRes.ok) return null;
  const arrayBuffer = await imgRes.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mime: imgRes.headers.get('content-type') || 'image/png' };
}

async function tryDeepAI(base64Image, mimeType) {
  const key = process.env.DEEPAI_API_KEY;
  if (!key) return null;
  const form = new FormData();
  form.append('image', new Blob([Buffer.from(base64Image, 'base64')], { type: mimeType }), 'image.png');
  const r = await fetch('https://api.deepai.org/api/torch-srgan', {
    method: 'POST',
    headers: { 'api-key': key },
    body: form,
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.output_url) return null;
  const imgRes = await fetch(data.output_url);
  if (!imgRes.ok) return null;
  const arrayBuffer = await imgRes.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mime: imgRes.headers.get('content-type') || 'image/png' };
}

async function tryGemini(base64Image, mimeType) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const prompt = 'Enhance this photo: increase sharpness and clarity, improve resolution and detail, reduce noise and blur. Keep the exact same content, people, and composition.';
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

  const { image, mimeType } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid image.' });
  }
  if (image.length > 8 * 1024 * 1024 * 1.4) {
    return res.status(400).json({ error: 'Image is too large. Please use an image under 8MB.' });
  }

  const mime = mimeType || 'image/jpeg';

  try {
    let result = await tryReplicate(image, mime).catch(() => null);
    if (!result) result = await tryDeepAI(image, mime).catch(() => null);
    if (!result) result = await tryGemini(image, mime).catch(() => null);

    if (!result) {
      return res.status(200).json({ fallback: true, reason: 'No enhancement provider is configured or all failed — use local browser fallback.' });
    }

    return res.status(200).json({ image: `data:${result.mime};base64,${result.base64}` });
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: 'Provider error — use local browser fallback.' });
  }
}
