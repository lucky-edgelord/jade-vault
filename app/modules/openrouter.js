/* =====================================================================
   OPENROUTER: a model provider (hundreds of models behind one key); since 2.28.1 not a decision server
   ===================================================================== */
// The OpenAI-compatible client (providers.js) with OpenRouter's address, its attribution headers and a model list cut
// to models that can call tools. It works as the main provider, a fallback, the heartbeat and compaction model and in
// the model router's list of models.
const OR_BASE = 'https://openrouter.ai/api/v1';
const OR_HEADERS = { 'HTTP-Referer': 'https://lucky-edgelord.github.io/jade-vault/', 'X-Title': 'Jade Vault' };
let orModelCache = null, orModelAt = 0;
async function orModelList() {
  if (orModelCache && Date.now() - orModelAt < 10 * 60e3) return orModelCache;
  const r = await fetch(OR_BASE + '/models', { headers: OR_HEADERS });
  if (!r.ok) throw new Error(`OpenRouter: HTTP ${r.status} listing models`);
  const j = await r.json(); orModelCache = j.data || []; orModelAt = Date.now();
  return orModelCache;
}
async function orModels(kind = 'tools') {
  const all = await orModelList();
  const want = kind === 'logprobs' ? ['logprobs', 'top_logprobs'] : ['tools'];
  return all.filter(m => !Array.isArray(m.supported_parameters) || want.every(p => m.supported_parameters.includes(p))).map(m => m.id).filter(Boolean).sort();
}
Object.assign(window, { OR_BASE, OR_HEADERS, orModels, orModelList });
// for tests and scripts (these live in the app's main script scope)
setTimeout(() => { for (const [n, f] of [['makeClientFor', () => makeClientFor], ['providerMissing', () => providerMissing], ['tryProvider', () => tryProvider], ['ollayaScan', () => ollayaScan], ['decName', () => decName], ['SECRET_KEYS', () => SECRET_KEYS]]) { try { window[n] = f(); } catch {} } }, 0);
