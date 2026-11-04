/* =====================================================================
   MODEL ROUTER (2.23): before each main-chat turn the decision model (laya on Ollaya, Ollama 0.35+ or the
   fleet broker's /v1/systemone) reads the message and picks which listed model answers it. Each model has a
   note saying what it is good at; laya chooses between the notes with calibrated probabilities. If the
   decision fails, is unsure, or the picked model cannot be reached, the main model answers.
   ===================================================================== */
const ROUTER_Q = "Which model should answer the user's latest message? Each option describes what a model is good at. Pick the cheapest option that can answer this message well; pick a stronger one only when the message needs it.";
const routerProvOf = x => { const k = String(x || '').trim().toLowerCase(); if (!k) return ''; if (PROVIDERS[k]) return k; if (k === 'ollama') return 'local'; return Object.keys(PROVIDERS).find(p => PROVIDERS[p].label.toLowerCase() === k) || ''; };
function routerOpts(c = S) {
  return (Array.isArray(c.routerModels) ? c.routerModels : []).filter(o => o && String(o.model || '').trim())
    .map(o => ({ prov: routerProvOf(o.prov) || c.provider || 'local', model: String(o.model).trim(), note: String(o.note || '').trim() || String(o.model).trim() }));
}
const routerDecider = (c = S) => c.routerDecider || c.ollayaModel || '';
const routerReady = (c = S) => !!(c.routerOn && routerDecider(c) && routerOpts(c).length >= 2);
// "provider | model | note" per line ("model | note" uses the main provider; a # starts a comment)
function routerParse(text) {
  return String(text || '').split('\n').map(l => l.replace(/^\s*#.*$/, '').trim()).filter(Boolean).map(l => {
    const p = l.split('|').map(x => x.trim());
    if (p.length >= 3 || (p.length === 2 && routerProvOf(p[0]) && !/[:/]/.test(p[0]))) { const [prov, model, ...rest] = p; return { prov: routerProvOf(prov) || prov, model, note: rest.join(' | ') }; }
    return { prov: '', model: p[0], note: p.slice(1).join(' | ') };
  }).filter(o => o.model);
}
const routerFormat = list => (list || []).map(o => [o.prov, o.model, o.note].map(x => x || '').join(' | ').replace(/^ \| /, '')).join('\n');
function routerState(msgs) {
  const users = msgs.map((m, i) => [m, i]).filter(([m]) => m.role === 'user' && !m._auto && !m.auto);
  if (!users.length) return '';
  const [last, i] = users[users.length - 1];
  const txt = m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
  const prev = msgs.slice(0, i).reverse().find(m => m.role === 'assistant' && m.content);
  const s = (prev ? `Previous reply (end): ${txt(prev).slice(-600)}\n\n` : '') + `Latest message: ${txt(last)}`;
  return s.slice(-4000);
}
async function routerAsk(state, c = S) {
  const opts = routerOpts(c); const t0 = performance.now();
  const body = { model: routerDecider(c), state, questions: { q: { type: 'choice', instructions: ROUTER_Q, criteria: opts.map(o => o.note) } } };
  const r = await withTimeout(ollayaFetch('/v1/systemone', { method: 'POST', body: JSON.stringify(body) }), 15000, decName());
  if (!r.ok) throw new Error(await ollayaErr(r));
  const a = (await r.json()).answers?.q; if (!a) throw new Error(`${decName()} returned no answer`);
  const ch = a.choice; let idx = typeof ch === 'number' || /^\d+$/.test(String(ch)) ? +ch : opts.findIndex(o => o.note === ch);
  if (!(idx >= 0 && idx < opts.length)) throw new Error(`${decName()} answered ${JSON.stringify(ch)}`);
  const conf = a.confidence != null ? +a.confidence : null;
  return { ...opts[idx], conf, ms: Math.round(performance.now() - t0) };
}
// the model for this turn: { prov, model, note, conf, client } (client null: the active one), { error } (main model), or null (router off)
async function routeTurn() {
  if (!routerReady() || !cur) return null;
  const t0 = performance.now();
  try {
    const pick = await routerAsk(routerState(cur.messages));
    if (pick.conf != null && pick.conf < (+S.routerMin || 0)) return { error: `unsure (${Math.round(pick.conf * 100)}%)`, ms: pick.ms };
    const miss = providerMissing(pick.prov); if (miss) throw new Error(`${pick.model}: ${miss}`);
    const same = pick.prov === activeProv;
    if (same && pick.model === S.model) return { ...pick, client: null, main: true };
    return { ...pick, client: same ? null : makeClientFor(pick.prov) };
  } catch (e) { return { error: String(e.message || e), ms: Math.round(performance.now() - t0) }; }
}
function routerTag(RT) {
  const d = document.createElement('div'); d.className = 'hud router-tag'; d.style.cssText = 'opacity:.7;font-size:11px;margin:0 0 4px';
  d.textContent = RT.error ? `↳ main model (router: ${RT.error})` : `↳ ${RT.prov === (S.provider || 'local') ? '' : PROVIDERS[RT.prov].label + ' · '}${RT.model}${RT.conf != null ? ` · ${Math.round(RT.conf * 100)}%` : ''}`;
  d.title = RT.error ? 'The decision model could not pick, so the main model answers.' : `Picked for: ${RT.note}`;
  return d;
}
// Config → Decision models → Model router
function routerFill() {
  const on = $('#sRouterOn'); if (!on) return;
  on.checked = !!S.routerOn; $('#sRouterModels').value = routerFormat(S.routerModels); $('#sRouterDecider').value = S.routerDecider || ''; $('#sRouterMin').value = S.routerMin ?? 0;
  $('#sRouterDecider').placeholder = S.ollayaModel ? `${S.ollayaModel} (the decision model above)` : 'laya';
}
function routerSave() {
  Object.assign(S, { routerOn: $('#sRouterOn').checked, routerModels: routerParse($('#sRouterModels').value), routerDecider: $('#sRouterDecider').value.trim(), routerMin: Math.max(0, Math.min(1, +$('#sRouterMin').value || 0)) });
  saveSettings();
  const n = routerOpts().length, note = $('#routerNote');
  if (note) note.textContent = S.routerOn ? (n < 2 ? 'List at least two models.' : !routerDecider() ? 'Pick a decision model above (for example laya).' : `${n} models; ${routerDecider()} picks one for each message.`) : '';
}
function routerWire() {
  if (!$('#sRouterOn')) return;
  ['sRouterOn', 'sRouterModels', 'sRouterDecider', 'sRouterMin'].forEach(id => $('#' + id).addEventListener('change', routerSave));
  $('#btnRouterTest').onclick = async () => {
    routerSave(); const note = $('#routerNote'); const msg = $('#sRouterTry').value.trim() || 'Write a Rust function that parses RFC 3339 timestamps, with tests.';
    if (routerOpts().length < 2) return note.textContent = 'List at least two models first.';
    if (!routerDecider()) return note.textContent = 'Pick a decision model first.';
    note.textContent = 'Asking ' + routerDecider() + '…';
    try { const p = await routerAsk(`Latest message: ${msg}`); note.textContent = `→ ${PROVIDERS[p.prov]?.label || p.prov} · ${p.model}${p.conf != null ? ` (${Math.round(p.conf * 100)}% sure)` : ''} · ${p.ms} ms`; }
    catch (e) { note.textContent = 'Failed: ' + e.message; }
  };
  routerFill();
}
routerWire();
Object.assign(window, { routeTurn, routerAsk, routerOpts, routerParse, routerFill, agentLoop });
