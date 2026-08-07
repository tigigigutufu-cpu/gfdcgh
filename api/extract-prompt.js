export const config = { maxDuration: 40 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  if (image.length > 8_000_000) {
    return res.status(400).json({ error: 'Image is too large. Please use a smaller file (under ~5MB).' });
  }

  const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Describe this image as a single, detailed AI image-generation prompt. Include the subject, art style, lighting, colors, composition, and mood. Reply with ONLY the prompt text itself -- no labels, no quotation marks, no extra commentary.'
                },
                {
                  inline_data: {
                    mime_type: safeMime,
                    data: image
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || !text.trim()) {
      throw new Error('Gemini returned an empty response.');
    }

    return res.status(200).json({ success: true, prompt: text.trim(), provider: 'Gemini 3.6 Flash' });

  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `AI Error: ${err.message}`
    });
  }
}
