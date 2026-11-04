/* =====================================================================
   TIME — every message carries its send time; the model sees it as a [stamp]
   ===================================================================== */
function fmtStamp(ts) {
  const p = new Intl.DateTimeFormat('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(new Date(ts));
  const g = t => p.find(x => x.type === t)?.value || '';
  return `${g('weekday')} ${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')} ${g('timeZoneName')}`;
}
function utcOffset(d = new Date()) { const m = -d.getTimezoneOffset(); const s = m >= 0 ? '+' : '-'; const a = Math.abs(m); return `UTC${s}${String(a / 60 | 0).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`; }
const longToday = () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
// what the chat shows next to each message
function fmtWhen(ts) {
  const d = new Date(ts), now = new Date(); const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Yesterday ' + t;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }) + ', ' + t;
}
const fmtDur = ms => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s` : `${Math.floor(ms / 60000)}m ${Math.round(ms % 60000 / 1000)}s`;
function setWhen(el, ts, extra) { const w = el?.querySelector?.('[data-when]'); if (!w || !ts) return; w.textContent = fmtWhen(ts) + (extra ? ' · ' + extra : ''); w.title = new Date(ts).toString(); }

/* =====================================================================
   TRAJECTORY LOG — every agent run, exactly as the model saw it, for fine-tuning.
   Stored on this device only (IndexedDB "jade-traj"), never sent anywhere. Export as JSONL
   in OpenAI chat format (messages + tools, works with Unsloth / Axolotl / TRL / OpenAI) or
   ShareGPT (LLaMA-Factory). Rate replies 👍 / 👎 in chat to filter the export, or export the ratings
   themselves (a "metadata" field per line) so 👍/👎 pairs can train with DPO / KTO.
   ===================================================================== */
const TrajDB = (() => {
  let dbp;
  const open = () => dbp ??= new Promise((res, rej) => { try { const r = indexedDB.open('jade-traj', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('runs', { keyPath: 'id' }); s.createIndex('started', 'started'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('runs', mode); const st = t.objectStore('runs'); let out; const q = fn(st); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  return {
    put: rec => tx('readwrite', st => st.put(rec)),
    get: id => tx('readonly', st => st.get(id)),
    all: () => tx('readonly', st => st.getAll()),
    count: () => tx('readonly', st => st.count()),
    clear: () => tx('readwrite', st => st.clear()),
    del: id => tx('readwrite', st => st.delete(id)),
  };
})();
const clone = x => JSON.parse(JSON.stringify(x));
// one recorder per agent run; a run that gets compacted / trimmed mid-way is split into segments,
// because each segment must be a conversation the model really saw from its first message
function trajRecorder() {
  if (S.trajOn === false) return { call() {}, reply() {}, tool() {}, end() { return Promise.resolve(null); }, id: null };
  const base = { session: cur?.id, title: cur?.title || '', source: cur?.messages?.some(m => m._hb) ? 'heartbeat' : /^⏰/.test(cur?.title || '') ? 'schedule' : 'chat' };
  let rec = null, part = 0; const saved = [];
  const fresh = (msgs, tools, req) => ({ id: uid() + '-' + Date.now().toString(36), v: 1, started: Date.now(), ended: null, part: part++, ...base, provider: activeProv, model: S.model,
    params: { temperature: req.options?.temperature, num_ctx: req.options?.num_ctx, think: !!req.think }, tools: clone(tools || []).map(t => t.function || t), messages: clone(msgs).map(m => { delete m.images; return m; }),
    steps: [], outcome: 'running', error: null, rating: null });
  const flush = async (outcome, error) => { if (!rec) return; rec.ended = Date.now(); rec.outcome = outcome; rec.error = error || null; const r = rec; rec = null; try { await TrajDB.put(r); saved.push(r.id); } catch (e) { console.warn('trajectory not saved', e); } };
  return {
    get id() { return rec?.id || saved.at(-1) || null; },
    call(msgs, tools, req) {
      // Is this the next step of the run already being recorded? The system prompt is not the thing to compare:
      // when it has to be trimmed to fit the context window, the trim moves as the conversation grows, so the
      // same run would look like a new one and be split in two. The first user turn is stable for the whole run.
      const firstUser = ms => (ms.find(m => m.role === 'user') || {}).content;
      const same = rec && msgs.length === rec.messages.length && firstUser(msgs) === firstUser(rec.messages);
      if (!same) { if (rec && rec.steps.length) flush('segment'); rec = fresh(msgs, tools, req); }   // a request that never got a reply (retried) is dropped
      rec._t0 = Date.now();
    },
    reply(asst, final, est) {
      if (!rec) return; const m = { role: 'assistant', content: asst.content || '' };
      if (asst.thinking) m.thinking = asst.thinking; if (asst.tool_calls) m.tool_calls = asst.tool_calls.map(t => ({ function: clone(t.function) }));
      rec.messages.push(m);
      rec.steps.push({ model: S.model, provider: activeProv, ms: Date.now() - (rec._t0 || Date.now()), prompt_tokens: final?.prompt_eval_count ?? null, completion_tokens: final?.eval_count ?? null, est_prompt_tokens: est || null });
      if (S.model !== rec.model) rec.models = [...new Set([...(rec.models || [rec.model]), S.model])];
    },
    tool(name, content, isErr) { if (rec) rec.messages.push({ role: 'tool', tool_name: name, content: String(content), ...(isErr ? { error: true } : {}) }); },
    async end(outcome, error) { const id = rec?.id; delete rec?._t0; await flush(outcome, error); return id || saved.at(-1) || null; },
  };
}
async function trajRate(id, rating) { if (!id) return; try { const r = await TrajDB.get(id); if (!r) return; r.rating = rating; await TrajDB.put(r); } catch {} }
function rateBar(m) {
  const d = document.createElement('div'); d.className = 'rate-bar';
  d.innerHTML = `<button type="button" data-rate="1" title="Good reply (kept in fine-tuning exports)">👍</button><button type="button" data-rate="-1" title="Bad reply (left out of exports)">👎</button>`;
  const paint = () => d.querySelectorAll('[data-rate]').forEach(b => b.classList.toggle('on', +b.dataset.rate === m.rating));
  d.onclick = e => { const b = e.target.closest('[data-rate]'); if (!b) return; const v = +b.dataset.rate; m.rating = m.rating === v ? null : v; paint(); saveSession(); trajRate(m.trajId, m.rating); };
  paint(); return d;
}
// ---- export ----
function trajToOpenAI(r, { thinking = false } = {}) {
  const msgs = toOpenAIMessages(r.messages.map(m => ({ ...m, content: m.content })));
  if (thinking) { let k = 0; const th = r.messages.filter(m => m.role === 'assistant'); for (const m of msgs) if (m.role === 'assistant') { const src = th[k++]; if (src?.thinking) m.reasoning_content = src.thinking; } }
  const out = { messages: msgs };
  if (r.tools?.length) out.tools = r.tools.map(f => ({ type: 'function', function: f }));
  return out;
}
function trajToShareGPT(r, { thinking = false } = {}) {
  const conv = []; let system = '';
  for (const m of r.messages) {
    if (m.role === 'system') { system = m.content; continue; }
    if (m.role === 'user') conv.push({ from: 'human', value: m.content });
    else if (m.role === 'assistant') {
      const think = thinking && m.thinking ? `<think>\n${m.thinking}\n</think>\n\n` : '';
      if (m.tool_calls?.length) { if (m.content || think) conv.push({ from: 'gpt', value: think + (m.content || '') }); for (const t of m.tool_calls) conv.push({ from: 'function_call', value: JSON.stringify({ name: t.function.name, arguments: t.function.arguments }) }); }
      else conv.push({ from: 'gpt', value: think + (m.content || '') });
    } else if (m.role === 'tool') conv.push({ from: 'observation', value: m.content });
  }
  // LLaMA-Factory wants human/observation at odd positions and gpt/function_call at even ones: merge neighbours that break that
  const fixed = []; for (const c of conv) { const prev = fixed.at(-1); const side = x => (x.from === 'human' || x.from === 'observation') ? 0 : 1; if (prev && side(prev) === side(c) && prev.from === c.from && c.from !== 'function_call') prev.value += '\n\n' + c.value; else fixed.push(c); }
  return { conversations: fixed, system, tools: JSON.stringify(r.tools || []) };
}
function trajKeep(r, filter) {
  if (filter === 'all') return true;
  if (!r.steps?.length || !r.messages.some(m => m.role === 'assistant')) return false;
  if (r.outcome !== 'ok' && r.outcome !== 'segment') return false;
  if (filter === 'prefs') return true;   // finished runs, 👎 too: for preference training (DPO / KTO) with ratings exported
  if (r.rating === -1) return false;
  if (filter === 'good') return r.rating === 1;
  return true;   // 'clean': finished runs, not thumbed down
}
async function exportTrajectories({ format = S.trajFormat || 'openai', filter = S.trajFilter || 'clean', thinking = !!S.trajThinking, meta = !!S.trajMeta } = {}) {
  const all = (await TrajDB.all()).sort((a, b) => a.started - b.started); const keep = all.filter(r => trajKeep(r, filter));
  if (!keep.length) { toast(all.length ? `None of the ${all.length} logged runs match that filter.` : 'Nothing logged yet: chat with Jade first.', 'err'); return null; }
  const line = r => { const o = format === 'sharegpt' ? trajToShareGPT(r, { thinking }) : trajToOpenAI(r, { thinking }); if (meta) o.metadata = { id: r.id, started: new Date(r.started).toISOString(), model: r.models?.join(',') || r.model, provider: r.provider, source: r.source, outcome: r.outcome, rating: r.rating, steps: r.steps }; return JSON.stringify(o); };
  const text = keep.map(line).join('\n') + '\n';
  const name = `jade-trajectories-${format}-${new Date().toISOString().slice(0, 10)}.jsonl`;
  await saveTextFile(name, text, 'application/x-ndjson');
  return { name, count: keep.length, of: all.length, bytes: text.length, text };
}
async function trajStats() {
  try { const all = await TrajDB.all(); const n = all.length; const good = all.filter(r => r.rating === 1).length, bad = all.filter(r => r.rating === -1).length, err = all.filter(r => r.outcome === 'error').length;
    const bytes = all.reduce((a, r) => a + JSON.stringify(r).length, 0); const steps = all.reduce((a, r) => a + r.steps.length, 0);
    return { n, good, bad, err, bytes, steps }; } catch { return { n: 0, good: 0, bad: 0, err: 0, bytes: 0, steps: 0 }; }
}
async function renderTrajSettings() {
  const box = $('#trajStats'); if (!box) return; const s = await trajStats();
  box.textContent = s.n ? `${s.n} runs · ${s.steps} model calls · ${fmtKB(s.bytes)} · 👍 ${s.good} · 👎 ${s.bad} · ${s.err} errors` : 'Nothing logged yet.';
}
// settings wiring (changes apply at once)
(() => {
  const on = $('#sTrajOn'); if (!on) return;
  const sync = () => { on.checked = S.trajOn !== false; $('#sTrajFormat').value = S.trajFormat || 'openai'; $('#sTrajFilter').value = S.trajFilter || 'clean'; $('#sTrajThink').checked = !!S.trajThinking; $('#sTrajMeta').checked = !!S.trajMeta; $('#sStampOn').checked = S.stampOn !== false; };
  sync();
  on.onchange = () => { S.trajOn = on.checked; saveSettings(); };
  $('#sTrajFormat').onchange = e => { S.trajFormat = e.target.value; saveSettings(); };
  $('#sTrajFilter').onchange = e => { S.trajFilter = e.target.value; saveSettings(); };
  $('#sTrajThink').onchange = e => { S.trajThinking = e.target.checked; saveSettings(); };
  $('#sTrajMeta').onchange = e => { S.trajMeta = e.target.checked; saveSettings(); };
  $('#sStampOn').onchange = e => { S.stampOn = e.target.checked; saveSettings(); };
  $('#btnTrajExport').onclick = async () => { const r = await exportTrajectories(); if (r) toast(`Exported ${r.count} of ${r.of} runs (${fmtKB(r.bytes)})`, 'ok'); };
  let armed = false; $('#btnTrajClear').onclick = async e => { const b = e.currentTarget; if (!armed) { armed = true; b.textContent = 'Tap again to delete all'; setTimeout(() => { armed = false; b.textContent = 'Clear log'; }, 4000); return; } armed = false; b.textContent = 'Clear log'; await TrajDB.clear(); renderTrajSettings(); toast('Trajectory log cleared', 'ok'); };
  window.__trajSync = sync;
})();
