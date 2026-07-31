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
    return res.status(400).json({ error: 'This prompt contains restricted keywords and was blocked by our content guidelines.' });
  }

  // Pure High-Quality Prompt & Negative Prompt Injection
  let cleanPrompt = `raw photo, ${prompt.trim()}, ${style || 'photorealistic'}, masterful artistry, ultra high definition, highly detailed, sharp focus, 8k resolution, cinematic lighting`;
  
  let cleanNegative = "blurry, lowres, ugly, bad anatomy, deformed face, stretched, pixelated, watermark, logo, bad hands";
  if (negative_prompt && negative_prompt.trim().length > 0) {
    cleanNegative += `, ${negative_prompt.trim()}`;
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
  // MODEL 1: Together AI (Flux 1 Schnell HD)
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
          return res.status(200).json({ image: `data:image/png;base64,${data.data[0].b64_json}` });
        }
      } else {
        // Together API key error or quota error
        const errText = await togetherRes.text();
        console.error("Together API Failed:", errText);
        return res.status( togetherRes.status ).json({ error: `Together API is available but returned an error. Check if your API key is valid.`, details: errText });
      }
    } catch (e) {
      console.error("Together AI fetch exception:", e.message);
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
          return res.status(200).json({ image: `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}` });
        }
      } else {
        const errText = await googleRes.text();
        console.error("Google Imagen API Failed:", errText);
      }
    } catch (e) {
      console.error("Google Imagen fetch exception:", e.message);
    }
  }

  // No backend APIs are configured/working properly
  return res.status(500).json({ error: 'Image generation APIs are currently unavailable. Please verify your Together AI or Google API key status.' });
          }
        
