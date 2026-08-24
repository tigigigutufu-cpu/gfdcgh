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

// Vercel Environment Variables se keys uthayega
const POLLINATION_KEYS = [
  process.env.POLLINATION_API_KEY,
  process.env.POLLINATION_API_KEY_1,
].filter(Boolean);

let currentKeyIndex = 0;
function getNextApiKey() {
  if (POLLINATION_KEYS.length === 0) return null;
  const key = POLLINATION_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % POLLINATION_KEYS.length;
  return key;
}

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

  const selectedModel = "dreamshaper";
  let cleanPrompt = `raw photo, ${prompt.trim()}, ${style || 'photorealistic'}, highly detailed, sharp focus, 8k resolution, professional lighting`;
  const seed = Math.floor(Math.random() * 1000000);

  // --- STEP 1: Pehle API Key ke sath try karo ---
  const apiKey = getNextApiKey();
  if (apiKey) {
    try {
      let authUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=${selectedModel}&width=1024&height=1024&nologo=true&seed=${seed}&key=${apiKey}`;
      if (negative_prompt) authUrl += `&negative_prompt=${encodeURIComponent(negative_prompt)}`;

      const authRes = await fetch(authUrl, {
        method: 'GET',
        headers: { "Authorization": `Bearer ${apiKey}` }
      });

      if (authRes.ok) {
        const arrayBuffer = await authRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return res.status(200).json({ 
          image: `data:image/jpeg;base64,${base64}`,
          provider: "pollinations-authenticated",
          model: "dreamshaper"
        });
      }
      console.log("Authenticated Pollinations failed, falling back to public open endpoint...");
    } catch (e) {
      console.log("Auth error, trying public URL:", e.message);
    }
  }

  // --- STEP 2: Fallback - Bina API Key wala Public Open URL ---
  try {
    let publicUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=${selectedModel}&width=1024&height=1024&nologo=true&seed=${seed}`;
    if (negative_prompt) publicUrl += `&negative_prompt=${encodeURIComponent(negative_prompt)}`;

    const publicRes = await fetch(publicUrl);

    if (publicRes.ok) {
      const arrayBuffer = await publicRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return res.status(200).json({ 
        image: `data:image/jpeg;base64,${base64}`,
        provider: "pollinations-public",
        model: "dreamshaper"
      });
    }
  } catch (e) {
    console.log("Public Pollinations failed, trying HuggingFace:", e.message);
  }

  // --- STEP 3: Final Fallback - HuggingFace ---
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
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(500).json({ error: 'Image generation failed from all providers.' });
}
