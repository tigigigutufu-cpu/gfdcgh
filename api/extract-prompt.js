export const config = { maxDuration: 30 };

// -----------------------------------------------------------------
// Provider 1: Pollinations.ai -- free, no API key required for the
// anonymous tier (rate limited to ~1 request per 15s per IP).
// Uses their OpenAI-compatible vision endpoint.
// -----------------------------------------------------------------
async function tryPollinations(base64Image, mimeType) {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Describe this image as a single, detailed AI image-generation prompt. ' +
                'Include the subject, art style, lighting, colors, composition, and mood. ' +
                'Reply with ONLY the prompt text itself -- no labels, no quotation marks, no extra commentary.'
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  if (!res.ok) {
    throw new Error(`Pollinations: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text || !text.trim()) throw new Error('Pollinations: no description returned.');
  return { prompt: text.trim(), provider: 'Pollinations Vision AI' };
}

// -----------------------------------------------------------------
// Provider 2 (fallback): Hugging Face free Inference API.
// Works anonymously with tight rate limits; set HF_API_TOKEN in your
// environment variables for a much higher, more reliable limit
// (free at huggingface.co/settings/tokens).
// -----------------------------------------------------------------
async function tryHuggingFace(base64Image) {
  const model = process.env.HF_CAPTION_MODEL || 'Salesforce/blip-image-captioning-large';
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (process.env.HF_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.HF_API_TOKEN}`;
  }

  const buffer = Buffer.from(base64Image, 'base64');

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers,
    body: buffer
  });

  if (!res.ok) {
    throw new Error(`Hugging Face: ${await res.text()}`);
  }

  const data = await res.json();
  const caption = Array.isArray(data) ? data[0] && data[0].generated_text : data.generated_text;
  if (!caption || !caption.trim()) throw new Error('Hugging Face: no caption returned.');
  return { prompt: caption.trim(), provider: 'Hugging Face (BLIP)' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  // Rough size guard -- keep the base64 payload reasonable so the
  // function doesn't choke on very large uploads.
  if (image.length > 8_000_000) {
    return res.status(400).json({ error: 'Image is too large. Please use a smaller file (under ~5MB).' });
  }

  const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const errors = [];

  try {
    const result = await tryPollinations(image, safeMime);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    errors.push(err.message);
  }

  try {
    const result = await tryHuggingFace(image);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    errors.push(err.message);
  }

  return res.status(502).json({
    success: false,
    error: 'Both free AI providers are currently busy or rate-limited. Please wait a few seconds and try again.',
    details: errors
  });
}
