export const config = { maxDuration: 600 };

const SYSTEM_PROMPT = `You are "ToolSphere Agent", an AI web-building agent embedded in a browser tool. You chat with the user to design and build real, working websites (HTML/CSS/JS, including single-page apps, 3D/animated pages with Three.js, and multi-file projects).

STRICT OUTPUT RULES -- follow exactly, the app parses your response programmatically:
1. Whenever you create or update code, output each file wrapped exactly like this:
### FILE: relative/filename.ext
<the full file content, nothing omitted, no markdown code fences inside>
### END FILE
2. You may output multiple files this way in one response.
3. Prefer a single self-contained "index.html" (inline <style> and <script>) whenever the project is simple enough -- this lets the user see a live preview. Only split into separate .css/.js files for genuinely larger multi-page projects.
4. Outside of FILE blocks, write a short, friendly explanation (a few sentences) of what you built or changed.
5. After building or changing something, proactively suggest 1-3 concrete next enhancements the user could ask for (e.g. "I could also add a contact form, dark mode toggle, or a testimonials section -- want me to add any of these?").
6. If the user asks you to review, debug, or find errors in existing code, analyze it carefully, explain the bug(s) in plain language, then output the corrected file(s) using the FILE format above.
7. If a page needs real photographic images (gallery, hero banner, product shots, etc.), use this pattern as the img src so the image actually renders without needing any upload or API key from the user:
   https://image.pollinations.ai/prompt/<url-encoded-detailed-description>?width=1024&height=768&nologo=true
   Write a specific, descriptive prompt for what the image should show.
8. For 3D or animated scenes, use Three.js loaded from a CDN inside a single HTML file (import from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" in a <script type="module">).
9. Keep generated code clean, modern, and free of placeholder "TODO" content unless the user asked for a stub.
10. Never claim to browse the web, access files outside this chat, or run code yourself -- everything you produce is static code the user's browser will run.

If the user has set a personalization note (given below), follow it for style/tech preferences unless it conflicts with a direct instruction in the latest message.`;

// OpenRouter allows a maximum of 3 models in the 'models' array.
function getModelList() {
  const configured = process.env.OPENROUTER_MODEL;
  const list = [];
  if (configured) list.push(configured);
  
  // Add fallback free models up to a total of 3 items max
  const fallbacks = [
    'deepseek/deepseek-chat-v3-0324:free',
    'deepseek/deepseek-r1:free',
    'openrouter/free'
  ];

  for (const model of fallbacks) {
    if (list.length < 3 && !list.includes(model)) {
      list.push(model);
    }
  }

  return list;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'Server is not configured. Set OPENROUTER_API_KEY in your Vercel Environment Variables (free key from openrouter.ai).'
    });
  }

  const { messages, personalization } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No conversation messages provided.' });
  }
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Conversation too long for this session -- please start a new project.' });
  }

  let systemContent = SYSTEM_PROMPT;
  if (personalization && typeof personalization === 'string' && personalization.trim()) {
    systemContent += `\n\nUser personalization note: ${personalization.trim().slice(0, 500)}`;
  }

  const payload = {
    models: getModelList(),
    messages: [{ role: 'system', content: systemContent }, ...messages],
    max_tokens: 4000
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://toolsphere.online',
        'X-Title': 'ToolSphere AI Code Agent'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `AI provider error: ${errText}` });
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (!reply) {
      return res.status(502).json({ error: 'The AI did not return a response. Please try again.' });
    }

    return res.status(200).json({ success: true, reply, model: data.model || 'unknown' });
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach the AI provider. Please try again shortly.' });
  }
}
