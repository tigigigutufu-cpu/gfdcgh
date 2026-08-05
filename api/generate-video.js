export const config = { maxDuration: 60 };

// Same restricted-content blocklist used by generate-image.js, kept
// consistent across all AI generation tools on the site.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------
// Each provider function returns { videoUrl, provider } on success,
// throws an Error on failure, or returns null if that provider's
// API key isn't configured (so auto-rotate can skip it silently).
// ---------------------------------------------------------------

async function generateWithReplicate(prompt, deadline) {
  if (!process.env.REPLICATE_API_TOKEN) return null;

  // Override with your preferred Replicate video model via env var.
  // Default is a commonly used open text-to-video model on Replicate.
  const model = process.env.REPLICATE_VIDEO_MODEL || 'wavespeedai/wan-2.1-t2v-480p';

  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=50'
    },
    body: JSON.stringify({ input: { prompt } })
  });

  if (!createRes.ok) {
    throw new Error(`Replicate: ${await createRes.text()}`);
  }

  let pred = await createRes.json();

  while (
    pred.status !== 'succeeded' &&
    pred.status !== 'failed' &&
    pred.status !== 'canceled' &&
    Date.now() < deadline
  ) {
    await sleep(3000);
    const pollRes = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    pred = await pollRes.json();
  }

  if (pred.status !== 'succeeded') {
    throw new Error('Replicate: video generation timed out or failed.');
  }

  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error('Replicate: no video URL returned.');
  return { videoUrl: out, provider: 'Replicate' };
}

async function generateWithAlibaba(prompt, deadline) {
  if (!process.env.DASHSCOPE_API_KEY) return null;

  // Override with your Model Studio Wan model name/region if different.
  const model = process.env.ALIBABA_VIDEO_MODEL || 'wan2.2-t2v-plus';
  const baseUrl = process.env.ALIBABA_DASHSCOPE_URL || 'https://dashscope-intl.aliyuncs.com/api/v1';

  const createRes = await fetch(`${baseUrl}/services/aigc/text2video/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({
      model,
      input: { prompt },
      parameters: { size: '1280*720' }
    })
  });

  if (!createRes.ok) {
    throw new Error(`Alibaba Wan: ${await createRes.text()}`);
  }

  const createData = await createRes.json();
  const taskId = createData.output && createData.output.task_id;
  if (!taskId) throw new Error('Alibaba Wan: no task_id returned.');

  let status = 'PENDING';
  let videoUrl = null;

  while (status !== 'SUCCEEDED' && status !== 'FAILED' && Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(`${baseUrl}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` }
    });
    const pollData = await pollRes.json();
    status = pollData.output && pollData.output.task_status;
    videoUrl = pollData.output && pollData.output.video_url;
  }

  if (status !== 'SUCCEEDED' || !videoUrl) {
    throw new Error('Alibaba Wan: video generation timed out or failed.');
  }

  return { videoUrl, provider: 'Alibaba Cloud Wan' };
}

async function generateWithDeepInfra(prompt) {
  if (!process.env.DEEPINFRA_API_KEY) return null;
  if (!process.env.DEEPINFRA_VIDEO_MODEL) {
    // No safe default here -- DeepInfra's text-to-video model catalog
    // changes over time. Set DEEPINFRA_VIDEO_MODEL in your environment
    // to the exact model slug you enabled on your DeepInfra dashboard.
    throw new Error('DeepInfra: set DEEPINFRA_VIDEO_MODEL in your environment variables.');
  }

  const res = await fetch(`https://api.deepinfra.com/v1/inference/${process.env.DEEPINFRA_VIDEO_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    throw new Error(`DeepInfra: ${await res.text()}`);
  }

  const data = await res.json();
  const videoUrl = data.video_url || data.output || (data.videos && data.videos[0]);
  if (!videoUrl) throw new Error('DeepInfra: no video URL returned.');
  return { videoUrl, provider: 'DeepInfra' };
}

async function generateWithPiapi(prompt, deadline) {
  if (!process.env.PIAPI_API_KEY) return null;

  const createRes = await fetch('https://api.piapi.ai/api/v1/task', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.PIAPI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kling',
      task_type: 'video_generation',
      input: { prompt, duration: 5, aspect_ratio: '16:9', mode: 'std' }
    })
  });

  if (!createRes.ok) {
    throw new Error(`PiAPI: ${await createRes.text()}`);
  }

  const createData = await createRes.json();
  const taskId = createData.data && createData.data.task_id;
  if (!taskId) throw new Error('PiAPI: no task_id returned.');

  let status = 'pending';
  let videoUrl = null;

  while (status !== 'completed' && status !== 'failed' && Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { 'x-api-key': process.env.PIAPI_API_KEY }
    });
    const pollData = await pollRes.json();
    status = pollData.data && pollData.data.status;
    videoUrl =
      pollData.data &&
      pollData.data.output &&
      (pollData.data.output.video_url || pollData.data.output.works?.[0]?.resource);
  }

  if (status !== 'completed' || !videoUrl) {
    throw new Error('PiAPI: video generation timed out or failed.');
  }

  return { videoUrl, provider: 'PiAPI' };
}

const PROVIDERS = {
  replicate: generateWithReplicate,
  alibaba: generateWithAlibaba,
  deepinfra: generateWithDeepInfra,
  piapi: generateWithPiapi
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, engine } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide a valid video prompt.' });
  }

  if (isBlocked(prompt)) {
    return res.status(400).json({ error: 'Restricted keywords detected in prompt.' });
  }

  // Leave a small buffer before Vercel's own function timeout kills us.
  const deadline = Date.now() + 50000;
  const cleanPrompt = prompt.trim();

  const order =
    engine && engine !== 'auto' && PROVIDERS[engine]
      ? [engine]
      : ['replicate', 'alibaba', 'deepinfra', 'piapi'];

  const errors = [];

  for (const name of order) {
    try {
      const result = await PROVIDERS[name](cleanPrompt, deadline);
      if (result) {
        return res.status(200).json({ success: true, videoUrl: result.videoUrl, provider: result.provider });
      }
      // result === null means that provider's API key isn't configured; try the next one.
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      if (Date.now() >= deadline) break;
    }
  }

  if (errors.length === 0) {
    return res.status(500).json({
      error: 'No video provider API keys are configured. Set REPLICATE_API_TOKEN, DASHSCOPE_API_KEY, DEEPINFRA_API_KEY, and/or PIAPI_API_KEY in your Vercel Environment Variables.'
    });
  }

  return res.status(502).json({
    success: false,
    error: 'All video generation providers are currently busy or unavailable. Please try again shortly.',
    details: errors
  });
}
