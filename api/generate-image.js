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

  const { prompt, style, negative_prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a valid prompt.' });
  }

  if (isBlocked(prompt)) {
    return res.status(400).json({ error: 'Restricted keywords detected in prompt.' });
  }

  // --- TUMHARA FLUX-SCHNELL WALA MODEL (500 img / 1 Pollen) ---
  // model=flux = flux.1 schnell hi hai
  const selectedModel = "flux"; // 0.002/gen wala
  // agar real human chahiye to "flux-realism" kar dena
  
  let cleanPrompt = `raw photo, ${prompt.trim()}, ${style || 'photorealistic'}, highly detailed, sharp focus, 8k resolution, professional lighting`;

  // Pollination - Free wala, bina login ka, Pollen nahi katega
  try {
    // Pollination URL - flux-schnell
    const pollinationUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=${selectedModel}&width=1024&height=1024&nologo=true&enhance=true&seed=${Math.floor(Math.random()*1000000)}${negative_prompt ? `&negative_prompt=${encodeURIComponent(negative_prompt)}` : ''}`;

    const polliRes = await fetch(pollinationUrl);
    
    if (polliRes.ok) {
      const arrayBuffer = await polliRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      // direct pollination image return
      return res.status(200).json({ 
        image: `data:image/jpeg;base64,${base64}`,
        provider: "pollinations",
        model: "flux.1-schnell (500 img / 1 pollen)"
      });
    }
  } catch (e) {
    console.log("Pollination failed, trying HuggingFace:", e.message);
  }

  // Fallback: Agar Pollination fail ho jaye to Huggingface
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const hfRes = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: cleanPrompt })
      });

      if (hfRes.ok) {
        const arrayBuffer = await hfRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return res.status(200).json({ image: `data:image/jpeg;base64,${base64}`, provider: "huggingface" });
      } else {
        const errText = await hfRes.text();
        return res.status(400).json({ error: "API Error: " + errText });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(500).json({ error: 'Image generation failed from both providers.' });
}

