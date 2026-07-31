export const config = { maxDuration: 60 };

const BLOCKLIST = [
  'nude', 'naked', 'nsfw', 'porn', 'sex', 'sexy', 'seductive', 'topless',
  'bikini', 'lingerie', 'underwear', 'cleavage', 'erotic', 'fetish',
  'hentai', 'nudity', 'strip', 'explicit', 'xxx', 'onlyfans',
  'gore', 'blood', 'kill', 'murder', 'suicide', 'self harm', 'weapon',
  'terrorist', 'bomb', 'nazi', 'hate symbol', 'child', 'minor', 'kid',
  'teen', 'underage', 'loli', 'choot', 'gand', 'lund', 'bhosda', 'chut', 'muth', 'randi',
  'girl', 'girls', 'woman', 'women', 'lady', 'hot'
];

function isBlocked(prompt) {
  const lower = prompt.toLowerCase();
  return BLOCKLIST.some((w) => {
    const regex = new RegExp(`\\b${w}\\b`, 'i');
    return regex.test(lower);
  });
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
    return res.status(400).json({ error: 'This prompt contains restricted keywords and was blocked.' });
  }

  // Master HD Prompt Injection for Crystal Clear Quality
  let cleanPrompt = `${prompt.trim()}, ${style || 'realistic photo'}, masterpiece, ultra-detailed, sharp focus, 8k resolution, photorealistic lighting, perfect composition`;
  
  let cleanNegative = "blurry, distorted, deformed, low resolution, ugly, bad anatomy, stretched, pixelated, watermark, logo";
  if (negative_prompt && negative_prompt.trim().length > 0) {
    cleanNegative += `, ${negative_prompt.trim()}`;
  }

  // Always use 1024x1024 square native generation to prevent stretching and distortion
  let width = 1024;
  let height = 1024;
  let googleRatio = "1:1";

  if (aspect_ratio === '16:9') {
    googleRatio = "16:9";
  } else if (aspect_ratio === '9:16') {
    googleRatio = "9:16";
  }

  // -----------------------------------------------------------
  // MODEL 1: Together AI (FLUX.1 Schnell - Native Square HD)
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
          n: 1,
          response_format: "b64_json"
        })
      });

      if (togetherRes.ok) {
        const data = await togetherRes.json();
        if (data && data.data && data.data[0] && data.data[0].b64_json) {
          return res.status(200).json({ image: `data:image/png;base64,${data.data[0].b64_json}`, aspect_ratio: aspect_ratio || '1:1' });
        }
      }
    } catch (e) {
      console.warn("Together AI failed, falling back...");
    }
  }

  // -----------------------------------------------------------
  // MODEL 2: Google Imagen 3
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
            negativePrompt: cleanNegative,
            outputMimeType: "image/jpeg"
          }
        })
      });

      if (googleRes.ok) {
        const data = await googleRes.json();
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
          return res.status(200).json({ image: `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}`, aspect_ratio: aspect_ratio || '1:1' });
        }
      }
    } catch (e) {
      console.warn("Google Imagen failed, falling back...");
    }
  }

  // -----------------------------------------------------------
  // MODEL 3: Pollinations AI (Safe High-Quality Fallback)
  // -----------------------------------------------------------
  try {
    const randomSeed = Math.floor(Math.random() * 9999999);
    const safeUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + ' avoiding ' + cleanNegative)}?width=1024&height=1024&seed=${randomSeed}&nologo=true&model=flux&enhance=true`;
    
    const imgRes = await fetch(safeUrl);
    if (imgRes.ok) {
      const dataUrl = await toDataUrl(imgRes);
      return res.status(200).json({ image: dataUrl, aspect_ratio: aspect_ratio || '1:1' });
    }
  } catch (err) {
    console.warn("Pollinations Backup Failed:", err.message);
  }

  return res.status(500).json({ error: 'Image generation service temporarily busy.' });
}
