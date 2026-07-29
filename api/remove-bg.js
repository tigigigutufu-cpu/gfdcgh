export const config = { maxDuration: 60 };

// /api/remove-bg.js
// Vercel serverless function (Node.js runtime).
//
// Uses the same Google Gemini API key as /api/enhance-image.js (GOOGLE_API_KEY).
// Removes/replaces the background of an uploaded photo, keeping the main subject intact.
// Note: output is a re-rendered image with a clean solid background (not a pixel-perfect
// alpha-transparency cutout) — great for profile photos, product shots, ID-style photos etc.

const MODEL = 'gemini-2.5-flash-image-preview';
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType, bgColor } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Please upload an image first.' });
  }
  if (image.length > MAX_INPUT_BYTES * 1.4) {
    return res.status(400).json({ error: 'Image is too large. Please use an image under 8MB.' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Background removal is not configured yet. Add a GOOGLE_API_KEY environment variable in your Vercel project settings (get one from aistudio.google.com/apikey), then redeploy.'
    });
  }

  const bg = (bgColor === 'transparent-style') ? 'plain white' : (bgColor || 'plain white');
  const prompt = `Remove the background from this photo and replace it with a clean, flat, ${bg} background. Keep the main subject (person/object) exactly as it is — same pose, same details, same edges — do not alter or add anything to the subject itself.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || 'Background removal failed.';
      return res.status(geminiRes.status).json({ error: msg });
    }

    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const imagePart = parts && parts.find((p) => p.inline_data || p.inlineData);
    const inline = imagePart && (imagePart.inline_data || imagePart.inlineData);

    if (!inline || !inline.data) {
      return res.status(502).json({ error: 'No image was returned. Please try a different photo.' });
    }

    const outMime = inline.mime_type || inline.mimeType || 'image/png';
    return res.status(200).json({ image: `data:${outMime};base64,${inline.data}` });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error while removing the background. Please try again.' });
  }
}
