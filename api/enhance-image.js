export const config = { maxDuration: 60 };

// /api/enhance-image.js
// Vercel serverless function (Node.js runtime).
//
// Uses Google's Gemini API (image model) to enhance an uploaded photo — sharpen, reduce noise,
// improve clarity — while keeping the same content. Needs ONE simple API key (not a full OAuth/
// service-account setup), which you can get from https://aistudio.google.com/apikey (this is tied
// to a Google Cloud Console project, so your existing Google Cloud account works).
//
// SETUP (one-time):
// 1. Go to https://aistudio.google.com/apikey and create an API key (uses your Google Cloud project).
// 2. In Vercel: Settings -> Environment Variables -> add
//      Name:  GOOGLE_API_KEY
//      Value: <your key>
// 3. Redeploy. Done — this function picks up the key automatically.

const MODEL = 'gemini-2.5-flash-image-preview';
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8MB safety cap

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Please upload an image first.' });
  }
  if (image.length > MAX_INPUT_BYTES * 1.4) { // base64 is ~1.37x larger than raw bytes
    return res.status(400).json({ error: 'Image is too large. Please use an image under 8MB.' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Image enhancement is not configured yet. Add a GOOGLE_API_KEY environment variable in your Vercel project settings (get one from aistudio.google.com/apikey), then redeploy.'
    });
  }

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
                { text: 'Enhance this photo: increase sharpness and clarity, improve resolution and detail, reduce noise and blur, correct lighting slightly if needed. Keep the exact same content, people, and composition — do not add, remove or change anything in the scene.' },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || 'Image enhancement failed.';
      return res.status(geminiRes.status).json({ error: msg });
    }

    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const imagePart = parts && parts.find((p) => p.inline_data || p.inlineData);
    const inline = imagePart && (imagePart.inline_data || imagePart.inlineData);

    if (!inline || !inline.data) {
      return res.status(502).json({ error: 'No enhanced image was returned. Please try a different photo.' });
    }

    const outMime = inline.mime_type || inline.mimeType || 'image/png';
    return res.status(200).json({ image: `data:${outMime};base64,${inline.data}` });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error while enhancing the image. Please try again.' });
  }
}
