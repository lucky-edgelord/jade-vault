/* =====================================================================
   OPENROUTER: a model provider (hundreds of models behind one key) and a decision server
   ===================================================================== */
// As a provider it is the OpenAI-compatible client (providers.js) with OpenRouter's address, its attribution headers and
// a model list cut to models that can call tools. As a decision server it answers the same /v1/systemone requests as
// Ollaya and Ollama, so the decide tool, scripts' jade.decide and the model router work unchanged: the options are
// lettered A, B, C…, the model answers with one letter, and the probabilities are read from that token's log
// probabilities (only models that report them are offered). A model that returns none falls back to asking for
// probabilities as JSON.
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
// for the chat: models that can call tools; for decisions: models that report log probabilities
async function orModels(kind = 'tools') {
  const all = await orModelList();
  const want = kind === 'logprobs' ? ['logprobs', 'top_logprobs'] : ['tools'];
  return all.filter(m => !Array.isArray(m.supported_parameters) || want.every(p => m.supported_parameters.includes(p))).map(m => m.id).filter(Boolean).sort();
}
const orKeyFor = () => (S.decideProv === 'openrouter' && S.ollayaKey) || S.orKey || '';
async function orPost(path, body, key) {
  let r;
  try { r = await fetch(OR_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...OR_HEADERS }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('could not reach OpenRouter: ' + (e.message || e)); }
  const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch {}
  if (!r.ok || j.error) {
    const m = j.error?.message || j.error || text.slice(0, 300) || 'HTTP ' + r.status;
    const e = new Error(r.status === 401 ? 'OpenRouter rejected the API key (401)' : r.status === 402 ? 'OpenRouter: no credits left (402)' : `OpenRouter: ${m}`); e.status = r.status || 502; throw e;
  }
  return j;
}
const OR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// one /v1/systemone question, answered by an OpenRouter model: { model, answers: { q: { choice | score | noul, probabilities, confidence } } }
async function orSystemone(body) {
  const key = orKeyFor(); if (!key) { const e = new Error('no OpenRouter API key set (Config → Model provider → OpenRouter, or the key field under Decision models)'); e.status = 401; throw e; }
  const model = body.model; const out = {};
  for (const [name, q] of Object.entries(body.questions || {})) {
    const t = q.type || 'choice';
    const opts = t === 'noul' ? ['no', 'yes'] : (q.criteria || []).map(String);
    if (opts.length < 2) throw Object.assign(new Error(`question ${name}: needs at least 2 options`), { status: 400 });
    if (opts.length > OR_LETTERS.length) throw Object.assign(new Error(`question ${name}: OpenRouter decisions take at most ${OR_LETTERS.length} options`), { status: 400 });
    const L = opts.map((_, i) => OR_LETTERS[i]);
    const ask = t === 'noul' ? `${q.instructions}\n\nA. no\nB. yes` : t === 'score' ? `${q.instructions}\n\nLevels, lowest first:\n${opts.map((o, i) => `${L[i]}. ${o}`).join('\n')}` : `${q.instructions}\n\nOptions:\n${opts.map((o, i) => `${L[i]}. ${o}`).join('\n')}`;
    const messages = [
      { role: 'system', content: 'You are a careful, calibrated classifier. Read the text, then answer the question with the letter of the best option and nothing else.' },
      { role: 'user', content: `Text:\n${String(body.state ?? '').slice(0, 24000)}\n\nQuestion: ${ask}\n\nAnswer with one letter (${L[0]}-${L[L.length - 1]}).` },
    ];
    const j = await orPost('/chat/completions', { model, messages, temperature: 0, max_tokens: 1, logprobs: true, top_logprobs: 20 }, key);
    const ch = j.choices?.[0] || {};
    let probs = orProbsFromLogprobs(ch.logprobs, L);
    if (!probs) probs = await orProbsFromJson(model, messages, L, key, String(ch.message?.content || ''));
    let best = 0; probs.forEach((p, i) => { if (p > probs[best]) best = i; });
    const a = { type: t, probabilities: Object.fromEntries(opts.map((o, i) => [t === 'noul' ? o : String(i), +probs[i].toFixed(6)])), confidence: +probs[best].toFixed(6) };
    if (t === 'choice') a.choice = best;
    else if (t === 'score') { a.score = best; a.legend = opts[best]; }
    else a.noul = best === 1;
    out[name] = a;
  }
  return { model, answers: out, via: 'openrouter' };
}
function orProbsFromLogprobs(lp, L) {
  const first = lp?.content?.[0]; if (!first) return null;
  const cands = [...(first.top_logprobs || []), { token: first.token, logprob: first.logprob }];
  const p = L.map(() => 0); let seen = false; const used = new Set();
  for (const c of cands) {
    const tok = String(c.token || '').trim().replace(/[.):\s]+$/, '').toUpperCase(); const i = L.indexOf(tok);
    if (i < 0 || used.has(tok + '|' + c.logprob) || typeof c.logprob !== 'number') continue;
    used.add(tok + '|' + c.logprob); p[i] += Math.exp(c.logprob); seen = true;
  }
  if (!seen) return null;
  const s = p.reduce((a, b) => a + b, 0); return p.map(x => x / s);
}
async function orProbsFromJson(model, messages, L, key, said) {
  try {
    const j = await orPost('/chat/completions', { model, temperature: 0, max_tokens: 400, response_format: { type: 'json_object' }, messages: [...messages.slice(0, 1), { role: 'user', content: messages[1].content.replace(/\n\nAnswer with one letter[\s\S]*$/, '') + `\n\nReply with JSON only: {"probabilities": {${L.map(l => `"${l}": number`).join(', ')}}}, your probability for each option, summing to 1.` }] }, key);
    const txt = String(j.choices?.[0]?.message?.content || '').replace(/^```(json)?|```$/g, '');
    const o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)).probabilities || {};
    const p = L.map(l => Math.max(0, +o[l] || 0)); const s = p.reduce((a, b) => a + b, 0);
    if (s > 0) return p.map(x => x / s);
  } catch {}
  const i = L.indexOf(said.trim().charAt(0).toUpperCase());   // only the letter: all of the weight on it
  return L.map((_, k) => (i < 0 ? 1 / L.length : k === i ? 1 : 0));
}
// what ollayaFetch returns when the decision server is OpenRouter: a Response, as if from Ollaya
async function orDecideFetch(path, init = {}) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    if (path === '/api/tags') return json({ models: (await orModels('logprobs')).map(name => ({ name })) });
    if (path === '/v1/systemone') return json(await orSystemone(JSON.parse(init.body || '{}')));
    return json({ error: `OpenRouter has no ${path}` }, 404);
  } catch (e) { return json({ error: String(e.message || e) }, e.status || 502); }
}
Object.assign(window, { OR_BASE, OR_HEADERS, orModels, orModelList, orSystemone, orDecideFetch, orProbsFromLogprobs });
// for tests and scripts (these live in the app's main script scope)
setTimeout(() => { for (const [n, f] of [['makeClientFor', () => makeClientFor], ['providerMissing', () => providerMissing], ['tryProvider', () => tryProvider], ['ollayaScan', () => ollayaScan], ['decName', () => decName], ['SECRET_KEYS', () => SECRET_KEYS]]) { try { window[n] = f(); } catch {} } }, 0);
