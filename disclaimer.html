// ToolSphere — image prompt safety filter
// Blocks explicit / nude / sexualized / violent prompt requests client-side
// before the prompt is ever sent to the generation endpoint.

const TS_BLOCKLIST = [
  'nude', 'naked', 'nsfw', 'porn', 'sex', 'sexy', 'seductive', 'topless',
  'bikini', 'lingerie', 'underwear', 'cleavage', 'erotic', 'fetish',
  'hentai', 'nudity', 'strip', 'explicit', 'xxx', 'onlyfans',
  'gore', 'blood', 'kill', 'murder', 'suicide', 'self harm', 'weapon',
  'terrorist', 'bomb', 'nazi', 'hate symbol', 'child', 'minor', 'kid',
  'teen', 'underage', 'loli'
];

const TS_MODEST_SUFFIX = ', modest clothing, fully covered, respectful and tasteful, family friendly, high quality, professional';

function tsCheckPrompt(raw) {
  const lower = raw.toLowerCase();
  const hit = TS_BLOCKLIST.find(w => lower.includes(w));
  if (hit) {
    return { ok: false, reason: 'This prompt was blocked by our content guidelines. Please describe a respectful, fully-clothed, non-violent scene.' };
  }
  if (raw.trim().length < 3) {
    return { ok: false, reason: 'Please describe what you want to see in a bit more detail.' };
  }
  return { ok: true };
}

function tsBuildSafePrompt(raw) {
  return raw.trim() + TS_MODEST_SUFFIX;
}
