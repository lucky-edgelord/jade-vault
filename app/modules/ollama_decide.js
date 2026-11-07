/* =====================================================================
   DECISIONS ON OLLAMA AND OLLAMA CLOUD (2.28.1)
   Ollama's /v1/systemone (docs.ollama.com/api/systemone) differs from Ollaya's in three ways, so requests and
   answers are translated here and the rest of the app (decide, jade.decide, flow Decide steps, the model router)
   keeps seeing the Ollaya shape:
   - a choice question's criteria is an object { key: description }, not a list;
   - a choice answer names the winning key, and its probabilities are keyed by option key;
   - a noul (yes/no) answer is the probability of true (a number), not a boolean.
   Ollama Cloud is POST https://ollama.com/v1/systemone with the API key as a Bearer token; there the model is
   named without the ":cloud" suffix (clef), and the decision models are listed from https://ollama.com/api/tags.
   ===================================================================== */
const OLC_BASE = 'https://ollama.com';
const OLC_DECIDERS = /^(clef|clef-flash|laya|jev|nimble|tev1|kev|winnow|largha|decider)(?=$|[:\-])/i;
const olcKey = () => S.ollayaKey || S.ollamaKey || '';
const olKeyOf = (opts, i) => {   // option keys: the option itself when short and unique, else option_N
  const o = String(opts[i]).trim(); const k = o.length && o.length <= 100 ? o : `option_${i + 1}`;
  return opts.findIndex(x => String(x).trim() === o) === i ? k : `option_${i + 1}`;
};
// Ollaya-shaped request → Ollama request (and the key ↔ index maps for the answers)
function olReq(body, cloud) {
  const maps = {}, questions = {};
  for (const [name, q] of Object.entries(body.questions || {})) {
    const nq = { ...q };
    if ((q.type || 'choice') === 'choice' && Array.isArray(q.criteria)) {
      const keys = q.criteria.map((_, i) => olKeyOf(q.criteria, i));
      nq.criteria = Object.fromEntries(keys.map((k, i) => [k, String(q.criteria[i])]));
      maps[name] = { keys, opts: q.criteria.map(String) };
    }
    questions[name] = nq;
  }
  let model = String(body.model || '');
  if (cloud) model = model.replace(/[:\-]cloud$/i, '');
  return { req: { ...body, model, questions }, maps };
}
// Ollama answer → Ollaya-shaped answer
function olAns(a, m) {
  if (!a || typeof a !== 'object') return a;
  const out = { ...a };
  if ('choice' in a && m) {   // as Ollaya answers: the chosen option's text, probabilities keyed by option
    const i = typeof a.choice === 'number' ? a.choice : m.keys.indexOf(String(a.choice));
    if (i >= 0 && i < m.opts.length) out.choice = m.opts[i];
    if (a.probabilities && !Array.isArray(a.probabilities)) out.probabilities = Object.fromEntries(m.keys.map((k, j) => [m.opts[j], +(a.probabilities[k] ?? 0)]));
  }
  if (typeof a.noul === 'number') {
    const p = Math.max(0, Math.min(1, a.noul));
    out.noul = p >= 0.5; out.p_true = p;
    out.probabilities = { no: +(1 - p).toFixed(6), yes: +p.toFixed(6) };
    if (out.confidence == null) out.confidence = +Math.max(p, 1 - p).toFixed(6);
  }
  return out;
}
const olJson = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
async function olDecideFetch(path, init = {}) {
  const cloud = S.decideProv === 'cloud';
  const base = ollayaBase(), headers = ollayaHeaders();
  if (cloud && !headers.Authorization) return olJson({ error: 'no Ollama Cloud API key (Config → Model provider → Ollama Cloud, or the key field under Decision models)' }, 401);
  let r;
  if (path === '/api/tags') {
    try { r = await fetch(base + '/api/tags', { headers }); }
    catch (e) { throw new Error(cloud ? `could not reach Ollama Cloud at ${OLC_BASE}: ${e.message || e}` : `could not reach Ollama at ${base}. Is "ollama serve" running? If it is, the browser blocked the request: restart it with OLLAMA_ORIGINS="*".`); }
    if (!r.ok) return r;
    const j = await r.json(); const all = (j.models || []).map(m => ({ name: m.name || m.model, caps: m.capabilities || m.details?.capabilities })).filter(m => m.name);
    const dec = all.filter(m => (Array.isArray(m.caps) && m.caps.includes('decision')) || OLC_DECIDERS.test(m.name));
    const names = dec.map(m => cloud ? m.name.replace(/[:\-]cloud$/i, '') : m.name);
    if (cloud && !names.includes('clef')) names.unshift('clef');   // the documented cloud decision model
    return olJson({ models: [...new Set(names)].map(name => ({ name })) });
  }
  if (path === '/v1/systemone') {
    const { req, maps } = olReq(JSON.parse(init.body || '{}'), cloud);
    try { r = await fetch(base + '/v1/systemone', { method: 'POST', headers, body: JSON.stringify(req) }); }
    catch (e) { throw new Error(cloud ? `could not reach Ollama Cloud at ${OLC_BASE}: ${e.message || e}` : `could not reach Ollama at ${base}. Is "ollama serve" running? If it is, the browser blocked the request: restart it with OLLAMA_ORIGINS="*".`); }
    if (!r.ok) {
      if (!cloud) return r;
      let m = 'HTTP ' + r.status; try { m = (await r.json()).error || m; } catch {}
      const hint = r.status === 401 ? ' (the Ollama Cloud API key was rejected)' : r.status === 402 ? ' (cloud decision models need a paid Ollama plan or usage credits)' : r.status === 404 ? ` (Ollama Cloud has no decision model "${req.model}"; try clef)` : '';
      return olJson({ error: m + hint }, r.status);
    }
    const j = await r.json();
    const answers = Object.fromEntries(Object.entries(j.answers || {}).map(([k, a]) => [k, olAns(a, maps[k])]));
    return olJson({ ...j, answers });
  }
  try { return await fetch(base + path, { ...init, headers }); }
  catch (e) { throw new Error(`could not reach ${decName()} at ${base}`); }
}
// a saved OpenRouter decision server (2.27) moves to Ollama Cloud when there is a key, else back to Ollaya
if (S.decideProv === 'openrouter') {
  S.decideProv = S.ollamaKey ? 'cloud' : 'ollaya';
  if (/\//.test(S.ollayaModel || '')) S.ollayaModel = S.decideProv === 'cloud' ? 'clef' : '';
  if (/\//.test(S.routerDecider || '')) S.routerDecider = '';
  try { saveSettings(); } catch {}
}
Object.assign(window, { olReq, olAns, olDecideFetch, OLC_BASE });
