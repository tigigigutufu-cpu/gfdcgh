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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------
// 1. Replicate API Handler
// ---------------------------------------------------------------
async function generateWithReplicate(prompt, deadline) {
  if (!process.env.REPLICATE_API_TOKEN) return null;
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

  if (!createRes.ok) throw new Error(`Replicate: ${await createRes.text()}`);
  let pred = await createRes.json();

  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled' && Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    });
    pred = await pollRes.json();
  }

  if (pred.status !== 'succeeded') throw new Error('Replicate timed out or failed.');
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error('Replicate: no video URL.');
  return { videoUrl: out, provider: 'Replicate' };
}

// ---------------------------------------------------------------
// 2. Json2Video API Handler
// ---------------------------------------------------------------
async function generateWithJson2Video(prompt, deadline) {
  if (!process.env.JSON2VIDEO_API_KEY) return null;

  const createRes = await fetch('https://api.json2video.com/v2/movies', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.JSON2VIDEO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      resolution: 'sd',
      quality: 'medium',
      scenes: [{ text: prompt, duration: 5 }]
    })
  });

  if (!createRes.ok) throw new Error(`Json2Video: ${await createRes.text()}`);
  const data = await createRes.json();
  const projectUrl = data.project || data.url;
  if (!projectUrl) throw new Error('Json2Video: no project URL returned.');
  
  return { videoUrl: projectUrl, provider: 'Json2Video' };
}

// ---------------------------------------------------------------
// 3. DeepInfra API Handler
// ---------------------------------------------------------------
async function generateWithDeepInfra(prompt) {
  if (!process.env.DEEPINFRA_API_KEY) return null;
  const model = process.env.DEEPINFRA_VIDEO_MODEL || 'stabilityai/stable-video-diffusion-img2vid-xt';

  const res = await fetch(`https://api.deepinfra.com/v1/inference/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) throw new Error(`DeepInfra: ${await res.text()}`);
  const data = await res.json();
  const videoUrl = data.video_url || data.output || (data.videos && data.videos[0]);
  if (!videoUrl) throw new Error('DeepInfra: no video URL.');
  return { videoUrl, provider: 'DeepInfra' };
}

// ---------------------------------------------------------------
// 4. Runway API Handler
// ---------------------------------------------------------------
async function generateWithRunway(prompt, deadline) {
  if (!process.env.RUNWAY_API_KEY) return null;

  const createRes = await fetch('https://api.runway.team/v1/tasks', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.RUNWAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gen4-turbo',
      promptText: prompt,
      duration: 5
    })
  });

  if (!createRes.ok) throw new Error(`Runway: ${await createRes.text()}`);
  const createData = await createRes.json();
  const taskId = createData.id || createData.task_id;
  if (!taskId) throw new Error('Runway: no task id returned.');

  let status = 'PENDING';
  let videoUrl = null;

  while (status !== 'SUCCEEDED' && status !== 'FAILED' && Date.now() < deadline) {
    await sleep(4000);
    const pollRes = await fetch(`https://api.runway.team/v1/tasks/${taskId}`, {
      headers: { 'X-API-Key': process.env.RUNWAY_API_KEY }
    });
    const pollData = await pollRes.json();
    status = pollData.status;
    videoUrl = pollData.output?.[0] || pollData.url;
  }

  if (status !== 'SUCCEEDED' || !videoUrl) throw new Error('Runway timed out or failed.');
  return { videoUrl, provider: 'Runway' };
}

// ---------------------------------------------------------------
// 5. APIFrame Handler
// ---------------------------------------------------------------
async function generateWithApiFrame(prompt, deadline) {
  if (!process.env.APIFRAME_API_KEY) return null;

  const createRes = await fetch('https://api.apiframe.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.APIFRAME_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kling',
      prompt: prompt
    })
  });

  if (!createRes.ok) throw new Error(`APIFrame: ${await createRes.text()}`);
  const data = await createRes.json();
  const videoUrl = data.video_url || data.output;
  if (!videoUrl) throw new Error('APIFrame: no video URL.');
  return { videoUrl, provider: 'APIFrame' };
}

// ---------------------------------------------------------------
// 6. ShortAPI Handler
// ---------------------------------------------------------------
async function generateWithShortApi(prompt) {
  if (!process.env.SHORTAPI_API_KEY) return null;

  const res = await fetch('https://api.shortapi.com/v1/video/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SHORTAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, model: 'kling' })
  });

  if (!res.ok) throw new Error(`ShortAPI: ${await res.text()}`);
  const data = await res.json();
  const videoUrl = data.video_url || data.url;
  if (!videoUrl) throw new Error('ShortAPI: no video URL.');
  return { videoUrl, provider: 'ShortAPI' };
}

// ---------------------------------------------------------------
// 7. CometAPI Handler
// ---------------------------------------------------------------
async function generateWithCometApi(prompt) {
  if (!process.env.COMETAPI_API_KEY) return null;

  const res = await fetch('https://api.cometapi.com/v1/video/text-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COMETAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) throw new Error(`CometAPI: ${await res.text()}`);
  const data = await res.json();
  const videoUrl = data.video_url || data.output;
  if (!videoUrl) throw new Error('CometAPI: no video URL.');
  return { videoUrl, provider: 'CometAPI' };
}

// ---------------------------------------------------------------
// 8. PiAPI Handler
// ---------------------------------------------------------------
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

  if (!createRes.ok) throw new Error(`PiAPI: ${await createRes.text()}`);
  const createData = await createRes.json();
  const taskId = createData.data && createData.data.task_id;
  if (!taskId) throw new Error('PiAPI: no task_id.');

  let status = 'pending';
  let videoUrl = null;

  while (status !== 'completed' && status !== 'failed' && Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { 'x-api-key': process.env.PIAPI_API_KEY }
    });
    const pollData = await pollRes.json();
    status = pollData.data && pollData.data.status;
    videoUrl = pollData.data?.output?.video_url || pollData.data?.output?.works?.[0]?.resource;
  }

  if (status !== 'completed' || !videoUrl) throw new Error('PiAPI timed out or failed.');
  return { videoUrl, provider: 'PiAPI' };
}

// Mapping of all providers
const PROVIDERS = {
  replicate: generateWithReplicate,
  json2video: generateWithJson2Video,
  deepinfra: generateWithDeepInfra,
  runway: generateWithRunway,
  apiframe: generateWithApiFrame,
  shortapi: generateWithShortApi,
  cometapi: generateWithCometApi,
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

  const deadline = Date.now() + 50000;
  const cleanPrompt = prompt.trim();

  // Agar user ne specific engine select kiya hai toh wo chalega, warna auto-rotate me saari APIs ek-ek karke try hongi
  const order = engine && engine !== 'auto' && PROVIDERS[engine]
    ? [engine]
    : ['replicate', 'runway', 'piapi', 'json2video', 'deepinfra', 'apiframe', 'shortapi', 'cometapi'];

  const errors = [];

  for (const name of order) {
    try {
      const result = await PROVIDERS[name](cleanPrompt, deadline);
      if (result) {
        return res.status(200).json({ success: true, videoUrl: result.videoUrl, provider: result.provider });
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      if (Date.now() >= deadline) break;
    }
  }

  return res.status(502).json({
    success: false,
    error: 'All video generation providers failed or are unconfigured.',
    details: errors
  });
}
