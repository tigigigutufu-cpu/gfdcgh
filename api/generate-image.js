export const config = { maxDuration: 60 };

const BLOCKLIST = [
  'nude', 'naked', 'nsfw', 'porn', 'sex', 'sexy', 'seductive', 'topless',
  'bikini', 'lingerie', 'underwear', 'cleavage', 'erotic', 'fetish',
  'hentai', 'nudity', 'strip', 'explicit', 'xxx', 'onlyfans',
  'gore', 'blood', 'kill', 'murder', 'suicide', 'self harm', 'weapon',
  'terrorist', 'bomb', 'nazi', 'hate symbol', 'child', 'minor', 'kid',
  'teen', 'underage', 'loli', 'choot', 'gand', 'lund', 'bhosda', 'chut', 'muth', 'randi'
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

  const { prompt, style, negative_prompt, aspect_ratio } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a valid prompt.' });
  }

  if (isBlocked(prompt)) {
    return res.status(400).json({ error: 'This prompt was blocked by our content guidelines.' });
  }

  let cleanPrompt = `${prompt.trim()}, ${style || 'digital art'}, highly detailed, 4k`;
  if (negative_prompt && negative_prompt.trim().length > 0) {
    cleanPrompt += ` [avoid: ${negative_prompt.trim()}]`;
  }

  let width = 1024;
  let height = 1024;
  let googleRatio = "1:1";

  if (aspect_ratio === '16:9') {
    width = 1280;
    height = 720;
    googleRatio = "16:9";
  } else if (aspect_ratio === '9:16') {
    width = 720;
    height = 1280;
    googleRatio = "9:16";
  }

  // -----------------------------------------------------------
  // MODEL 1: Together AI (Flux.1 Schnell)
  // -----------------------------------------------------------
  if (process.env.TOGETHER_API_KEY) {
    try {
      const togetherRes = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell",
          prompt: cleanPrompt,
          width: width,
          height: height,
          steps: 4,
          n: 1
        })
      });

      if (togetherRes.ok) {
        const data = await togetherRes.json();
        if (data && data.data && data.data[0] && data.data[0].url) {
          const imgRes = await fetch(data.data[0].url);
          if (imgRes.ok) {
            const dataUrl = await toDataUrl(imgRes);
            return res.status(200).json({ image: dataUrl });
          }
        }
      }
    } catch (e) {
      console.warn("Together AI failed, trying next model:", e.message);
    }
  }

  // -----------------------------------------------------------
  // MODEL 2: Google Imagen 3 (via Google AI Studio)
  // -----------------------------------------------------------
  if (process.env.GOOGLE_API_KEY) {
    try {
      const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GOOGLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: cleanPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: googleRatio,
            outputMimeType: "image/jpeg"
          }
        })
      });

      if (googleRes.ok) {
        const data = await googleRes.json();
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
          const dataUrl = `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}`;
          return res.status(200).json({ image: dataUrl });
        }
      }
    } catch (e) {
      console.warn("Google Imagen API failed, trying next model:", e.message);
    }
  }

  // -----------------------------------------------------------
  // MODEL 3: Pollinations AI (Unlimited Free Fallback)
  // -----------------------------------------------------------
  const seed = Math.floor(Math.random() * 100000);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

  try {
    const imgRes = await fetch(pollinationsUrl);
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'The image provider failed to generate this image. Please try again.' });
    }
    const dataUrl = await toDataUrl(imgRes);
    return res.status(200).json({ image: dataUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error while generating the image. Please try again.' });
  }
}
