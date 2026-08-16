export const config = { maxDuration: 45 };

const SYSTEM_PROMPT = `You are "ToolSphere Bug Fixer", an expert code reviewer. The user will paste a block of code (any language). Carefully analyze it for bugs, logic errors, security issues, and bad practices.

STRICT OUTPUT FORMAT -- follow exactly, the app parses your response programmatically:

### BUGS
- <one bug per line, plain description, mention the approximate line or function if possible>
- <if there are truly no bugs, write a single line: "No bugs found -- the code looks correct.">

### FIXED CODE
<the complete corrected version of the code, preserving the user's original structure and style as much as possible. If no bugs were found, repeat the original code unchanged.>

### END

Do not add any text before "### BUGS" or after "### END". Do not wrap the fixed code in markdown triple-backtick fences -- output the raw code only.`;

function getModelList() {
  const configured = process.env.OPENROUTER_MODEL;
  const list = [];
  if (configured) list.push(configured);
  list.push(
    'deepseek/deepseek-chat-v3-0324:free',
    'deepseek/deepseek-r1:free',
    'qwen/qwen3-coder:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openrouter/free'
  );
  return [...new Set(list)];
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

  const { code, language } = req.body || {};

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Please paste some code to check.' });
  }
  if (code.length > 30000) {
    return res.status(400).json({ error: 'Code is too long. Please paste under 30,000 characters at a time.' });
  }

  const safeLanguage = typeof language === 'string' && language.trim() ? language.trim() : 'auto-detect';

  const payload = {
    models: getModelList(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Language: ${safeLanguage}\n\nCode to review:\n\n${code}` }
    ],
    max_tokens: 4000
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://toolsphere.online',
        'X-Title': 'ToolSphere Bug Fixer'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `AI provider error: ${errText}` });
    }

    const data = await response.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (!raw) {
      return res.status(502).json({ error: 'The AI did not return a response. Please try again.' });
    }

    const bugsMatch = raw.match(/### BUGS\s*([\s\S]*?)### FIXED CODE/);
    const codeMatch = raw.match(/### FIXED CODE\s*([\s\S]*?)### END/);

    const bugsText = bugsMatch ? bugsMatch[1].trim() : raw.trim();
    const fixedCode = codeMatch ? codeMatch[1].trim() : '';

    return res.status(200).json({
      success: true,
      bugs: bugsText,
      fixedCode: fixedCode || code,
      model: data.model || 'unknown'
    });
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach the AI provider. Please try again shortly.' });
  }
}
