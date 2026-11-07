/* ---------- model providers: local Ollama, Ollama Cloud, Groq, any OpenAI-compatible endpoint ----------
   Every client exposes the ollama-js surface the agent loop uses: list(), chat(req) → async iterator of
   Ollama-shaped chunks, abort(). Cloud providers are tried as a fallback when the local Ollama is unreachable. */
const PROVIDERS = {
  local: { label: 'Ollama', chip: 'OLLAMA' },
  cloud: { label: 'Ollama Cloud', chip: 'OLLAMA CLOUD' },
  groq: { label: 'Groq', chip: 'GROQ' },
  llamacpp: { label: 'llama.cpp', chip: 'LLAMA.CPP' },
  openrouter: { label: 'OpenRouter', chip: 'OPENROUTER' },
  openai: { label: 'OpenAI-compatible', chip: 'API' },
  aicord: { label: 'AICord', chip: 'AICORD' },
};
class FetchOllama { // minimal ollama-js compatible surface (also used for ollama.com with an API key)
  constructor({ host, headers = {} }) { this.host = host.replace(/\/+$/, ''); this.headers = headers; this.ctrls = new Set(); this._base = this.host; }
  abort() { for (const c of this.ctrls) c.abort(); this.ctrls.clear(); }
  async list() { const r = await fetch(this.host + '/api/tags', { headers: this.headers }); if (!r.ok) throw new Error(r.status === 401 ? 'the API key was rejected (401)' : `HTTP ${r.status}`); return r.json(); }
  async chat(req) {
    const ctrl = new AbortController(); this.ctrls.add(ctrl);
    const r = await fetch(this.host + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.headers }, body: JSON.stringify(req), signal: ctrl.signal });
    if (!r.ok) { let m = `HTTP ${r.status}`; try { m = (await r.json()).error || m; } catch {} if (r.status === 401) m = 'the API key was rejected (401)'; throw new Error(m); }
    const reader = r.body.getReader(); const self = this;
    return { abort: () => ctrl.abort(), async *[Symbol.asyncIterator]() { let buf = ''; try { for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; const j = JSON.parse(line); if (j.error) throw new Error(j.error); yield j; } } if (buf.trim()) yield JSON.parse(buf); } finally { self.ctrls.delete(ctrl); } } };
  }
}
// Ollama-style history → OpenAI chat messages (tool calls need ids that tool results point back to)
function toOpenAIMessages(msgs) {
  const out = []; let seq = 0; let pending = [];
  const flush = () => { for (const p of pending) out.push({ role: 'tool', tool_call_id: p.id, content: '(no result: the run was interrupted)' }); pending = []; };
  for (const m of msgs) {
    if (m.role === 'tool') {
      let k = pending.findIndex(p => p.name === m.tool_name); if (k < 0) k = 0;
      if (pending.length) { const p = pending.splice(k, 1)[0]; out.push({ role: 'tool', tool_call_id: p.id, content: String(m.content ?? '') }); }
      else out.push({ role: 'user', content: `[Result of ${m.tool_name || 'a tool'}]\n${m.content ?? ''}` });
      continue;
    }
    flush();
    if (m.role === 'assistant' && m.tool_calls?.length) {
      const calls = m.tool_calls.map(t => { const id = 'call_' + (++seq) + '_' + Math.random().toString(36).slice(2, 7); pending.push({ id, name: t.function?.name }); return { id, type: 'function', function: { name: t.function?.name, arguments: typeof t.function?.arguments === 'string' ? t.function.arguments : JSON.stringify(t.function?.arguments || {}) } }; });
      out.push({ role: 'assistant', content: m.content || null, tool_calls: calls });
    } else if (m.role === 'user' && m.images?.length) out.push({ role: 'user', content: [{ type: 'text', text: String(m.content ?? '') }, ...m.images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } }))] });
    else out.push({ role: m.role, content: String(m.content ?? '') });
  }
  flush();
  return out;
}
class OpenAICompat {
  constructor({ base, key, name, headers = {} }) { this.base = String(base || '').replace(/\/+$/, ''); this.key = key; this.name = name; this.extra = headers; this.ctrls = new Set(); }
  get headers() { const h = { 'Content-Type': 'application/json', ...this.extra }; if (this.key) h.Authorization = 'Bearer ' + this.key; return h; }
  abort() { for (const c of this.ctrls) c.abort(); this.ctrls.clear(); }
  async err(r) { let m = `HTTP ${r.status}`; try { const j = await r.json(); m = j.error?.message || j.error || j.message || m; if (j.error?.failed_generation) m += ` (model output: ${String(j.error.failed_generation).slice(0, 200)})`; } catch {} if (r.status === 401) m = `${this.name} rejected the API key (401)`; if (r.status === 429) m = `${this.name} rate limit: ${m}`; return new Error(m); }
  async list() {
    const r = await fetch(this.base + '/models', { headers: this.headers }); if (!r.ok) throw await this.err(r);
    const j = await r.json(); const ids = (j.data || j.models || []).filter(m => !Array.isArray(m.supported_parameters) || m.supported_parameters.includes('tools')).map(m => m.id || m.name).filter(Boolean)   // OpenRouter says which models take tools
      .filter(id => !/whisper|tts|-guard|guard-|playai|orpheus|embed|distil|moderation|dall-e|image|audio|transcri/i.test(id));
    return { models: ids.map(name => ({ name })) };
  }
  body(req, stream) {
    const b = { model: req.model, messages: toOpenAIMessages(req.messages), stream, temperature: req.options?.temperature ?? 0.2 };
    if (req.tools?.length) { b.tools = req.tools; b.tool_choice = 'auto'; }
    if (stream && this.name !== 'Groq') b.stream_options = { include_usage: true };
    return b;
  }
  async once(req) { // non-streaming, for compaction and journal
    const r = await fetch(this.base + '/chat/completions', { method: 'POST', headers: this.headers, body: JSON.stringify(this.body(req, false)) });
    if (!r.ok) throw await this.err(r);
    const j = await r.json(); return { message: { role: 'assistant', content: j.choices?.[0]?.message?.content || '' } };
  }
  async chat(req) {
    const ctrl = new AbortController(); this.ctrls.add(ctrl); const self = this;
    const r = await fetch(this.base + '/chat/completions', { method: 'POST', headers: this.headers, body: JSON.stringify(this.body(req, true)), signal: ctrl.signal });
    if (!r.ok) { self.ctrls.delete(ctrl); throw await this.err(r); }
    const reader = r.body.getReader(); const t0 = performance.now();
    return { abort: () => ctrl.abort(), async *[Symbol.asyncIterator]() {
      let buf = '', usage = null, calls = [];
      const take = (j) => { const out = []; if (j.error) throw new Error(j.error.message || String(j.error)); if (j.usage) usage = j.usage; if (j.x_groq?.usage) usage = j.x_groq.usage;
        const d = j.choices?.[0]?.delta || {};
        const th = d.reasoning || d.reasoning_content; if (th) out.push({ message: { role: 'assistant', content: '', thinking: th } });
        if (d.content) out.push({ message: { role: 'assistant', content: d.content } });
        for (const tc of d.tool_calls || []) { const i = tc.index ?? calls.length; const c = calls[i] ||= { id: tc.id, name: '', args: '' }; if (tc.id) c.id = tc.id; if (tc.function?.name) c.name += tc.function.name; if (tc.function?.arguments) c.args += tc.function.arguments; }
        return out; };
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue; const data = line.slice(5).trim(); if (data === '[DONE]') continue;
            let j; try { j = JSON.parse(data); } catch { continue; }
            for (const part of take(j)) yield part;
          }
        }
        if (calls.length) yield { message: { role: 'assistant', content: '', tool_calls: calls.filter(c => c.name).map(c => ({ function: { name: c.name, arguments: safeJson(c.args || '{}') } })) } };
        const secs = usage?.completion_time || (performance.now() - t0) / 1000;
        yield { message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: usage?.prompt_tokens || 0, eval_count: usage?.completion_tokens || 0, eval_duration: usage?.completion_tokens ? Math.round(secs * 1e9) : 0 };
      } finally { self.ctrls.delete(ctrl); }
    } };
  }
}
// AICord (https://docs.aicordapp.com/api/aicord-chat-api): character chat, one JSON reply per call, no streaming and no tool
// calling. The "model" list is the account's characters (GET /characters); a chat goes to POST /chat with the character's UUID
// and the history as {role: user|character, content: [{type: text|image_url, ...}]}. The key goes in Authorization as given.
class AICordClient {
  constructor({ key, base }) { this.key = (key || '').trim(); this.base = (base || 'https://aicordapp.com/api/v1').replace(/\/+$/, ''); this.ctrls = new Set(); this.chars = new Map(); }
  get headers() { return { 'Content-Type': 'application/json', Authorization: this.key }; }
  abort() { for (const c of this.ctrls) c.abort(); this.ctrls.clear(); }
  async err(r) {
    const m = { 401: 'AICord rejected the API key (401)', 402: 'AICord: no credits left (402)', 403: 'AICord: this account is banned (403)', 404: 'AICord: character not found (404)' }[r.status];
    if (m) return new Error(m);
    let t = `HTTP ${r.status}`; try { const j = await r.json(); t = j.error?.message || j.error || j.message || t; } catch {}
    return new Error('AICord: ' + t);
  }
  async list() {
    const r = await fetch(this.base + '/characters', { headers: this.headers }); if (!r.ok) throw await this.err(r);
    const j = await r.json(); this.chars = new Map(); const seen = new Set();
    for (const c of Array.isArray(j) ? j : []) {
      if (!c?.id) continue; let n = String(c.name || c.id), k = 2; while (seen.has(n)) n = `${c.name} (${k++})`; seen.add(n); this.chars.set(n, c.id);
    }
    return { models: [...this.chars.keys()].map(name => ({ name })) };
  }
  // Jade's history (system prompt, tool turns) → AICord's user/character turns. Characters have a persona of their own, so the
  // system prompt travels as context at the top of the first user turn; tool calls and results become plain user text.
  messages(msgs) {
    const out = []; let sys = '';
    const push = (role, parts) => { const last = out[out.length - 1]; if (last && last.role === role) last.content.push(...parts); else out.push({ role, content: parts }); };
    for (const m of msgs) {
      const text = String(m.content ?? '');
      if (m.role === 'system') { sys += (sys ? '\n\n' : '') + text; continue; }
      if (m.role === 'tool') { push('user', [{ type: 'text', text: `[Result of ${m.tool_name || 'a tool'}]\n${text}` }]); continue; }
      if (m.role === 'assistant') { if (text.trim()) push('character', [{ type: 'text', text }]); continue; }
      const parts = [{ type: 'text', text }];
      for (const b of m.images || []) parts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } });
      push('user', parts);
    }
    if (sys) { const first = out.find(x => x.role === 'user'); const note = { type: 'text', text: `[Context from Jade Vault]\n${sys}\n\n[Message]\n` }; if (first) { const t = first.content[0]; first.content[0] = { type: 'text', text: note.text + t.text }; } else out.unshift({ role: 'user', content: [note] }); }
    if (!out.length) out.push({ role: 'user', content: [{ type: 'text', text: '' }] });
    return out;
  }
  idFor(model) {
    const id = this.chars.get(model) || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model || '') ? model : '');
    if (!id) throw new Error('AICord: pick a character first (Config → Model provider)');
    return id;
  }
  async send(req, signal) {
    const r = await fetch(this.base + '/chat', { method: 'POST', headers: this.headers, body: JSON.stringify({ character: this.idFor(req.model), messages: this.messages(req.messages) }), signal });
    if (!r.ok) throw await this.err(r);
    return r.json();
  }
  async once(req) { const j = await this.send(req); return { message: { role: 'assistant', content: j.text || '' } }; }
  async chat(req) {
    const ctrl = new AbortController(); this.ctrls.add(ctrl); const self = this; const t0 = performance.now();
    let j; try { j = await this.send(req, ctrl.signal); } catch (e) { this.ctrls.delete(ctrl); throw e; }
    return { abort: () => ctrl.abort(), async *[Symbol.asyncIterator]() {
      try {
        if (j.text) yield { message: { role: 'assistant', content: j.text } };
        yield { message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 0, eval_count: 0, eval_duration: Math.round((performance.now() - t0) * 1e6) };
      } finally { self.ctrls.delete(ctrl); }
    } };
  }
}
var aicordClient = null; // kept so the character → UUID map survives re-creating the client
function makeClientFor(p, c = S) {
  const c0 = c;
  if (p === 'cloud') return new FetchOllama({ host: 'https://ollama.com', headers: c.ollamaKey ? { Authorization: 'Bearer ' + c.ollamaKey } : {} });
  if (p === 'groq') return new OpenAICompat({ base: 'https://api.groq.com/openai/v1', key: c.groqKey, name: 'Groq' });
  if (p === 'llamacpp') return new OpenAICompat({ base: (c.lcppHost || 'http://localhost:8080').replace(/\/+$/, '').replace(/(\/v1)?$/, '/v1'), key: c.lcppKey, name: 'llama.cpp' });
  if (p === 'aicord') { const old = aicordClient; const c = new AICordClient({ key: c0.aicKey }); if (old && old.key === c.key) c.chars = old.chars; return aicordClient = c; }
  if (p === 'openrouter') return new OpenAICompat({ base: OR_BASE, key: c.orKey, name: 'OpenRouter', headers: OR_HEADERS });
  if (p === 'openai') return new OpenAICompat({ base: c.oaiHost, key: c.oaiKey, name: (() => { try { return new URL(c.oaiHost).host; } catch { return 'the API'; } })() });
  const host = c.host || DEFAULTS.host; const cl = OllamaLib ? new OllamaLib({ host }) : new FetchOllama({ host }); cl._lib = !!OllamaLib; cl._base = host.replace(/\/+$/, ''); cl.headers = {}; return cl;
}
function providerMissing(p, c = S) {
  if (p === 'cloud' && !c.ollamaKey) return 'no Ollama API key set (Config → Model provider)';
  if (p === 'groq' && !c.groqKey) return 'no Groq API key set (Config → Model provider)';
  if (p === 'llamacpp' && c.lcppHost && !/^https?:\/\//.test(c.lcppHost)) return 'the llama.cpp address must start with http:// or https://';
  if (p === 'aicord' && !c.aicKey) return 'no AICord API key set (Config → Model provider)';
  if (p === 'openrouter' && !c.orKey) return 'no OpenRouter API key set (Config → Model provider)';
  if (p === 'openai' && !/^https?:\/\//.test(c.oaiHost || '')) return 'no base URL set for the OpenAI-compatible endpoint';
  return '';
}
const withTimeout = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} did not answer within ${ms / 1000}s`)), ms))]);
async function tryProvider(p, cfg = S) {
  const miss = providerMissing(p, cfg); if (miss) throw new Error(miss);
  const c = makeClientFor(p, cfg);
  const r = await withTimeout(c.list(), p === 'local' || p === 'llamacpp' ? 6000 : 15000, PROVIDERS[p].label);
  return { c, models: (r.models || []).map(m => m.name || m.model).filter(Boolean).sort() };
}
var activeProv = 'local'; let client = null, lastConnErr = null;
const providerName = () => activeProv === 'local' ? `Ollama at ${S.host || DEFAULTS.host}` : PROVIDERS[activeProv]?.label || activeProv;
let models = [];
const PREF_ORDER = [/gpt-oss.?120b/i, /gpt-oss/i, /qwen3/i, /kimi-k2/i, /llama-?3\.3|llama-?4/i, /deepseek/i, /glm-4/i, /mistral|devstral/i, /llama-?3\.[12]/i, /granite|qwen2\.5-coder/i];
const pickModel = list => { for (const re of PREF_ORDER) { const m = list.find(x => re.test(x)); if (m) return m; } return list[0] || ''; };
const providerChain = () => { const prim = S.provider || 'local'; return [prim, ...(Array.isArray(S.fallbacks) ? S.fallbacks : []).filter((p, i, a) => p !== prim && PROVIDERS[p] && a.indexOf(p) === i)]; };
function activateProvider(p, res) {
  client = res.c; activeProv = p; models = res.models;
  S.modelBy ||= {};
  const want = S.modelBy[p] || (p === (S.provider || 'local') ? S.model : '');
  S.model = models.includes(want) ? want : pickModel(models);
  saveSettings(); fillModelSelects();
  setOllamaChip('ok', activeProv === 'local' ? `${new URL(S.host || DEFAULTS.host).host}${client._lib ? '' : ' · fetch'}` : 'LINKED');
}
// try the main provider, then each fallback in order; `skip` = providers already tried in this run
async function connect({ skip = null, quiet = false } = {}) {
  setOllamaChip('busy', 'LINKING…');
  const chain = providerChain(); const errs = [];
  for (const p of chain) {
    if (skip?.has(p)) continue;
    try {
      const res = await tryProvider(p); activateProvider(p, res); lastConnErr = null;
      if (p !== chain[0] && !quiet) toast(`${esc(PROVIDERS[chain[0]].label)} is unreachable. Using ${esc(PROVIDERS[p].label)}${errs.length > 1 ? ` (after ${errs.length} failed)` : ''}.`, 'ok');
      renderEmpty(); return true;
    } catch (e) { errs.push(`${PROVIDERS[p].label}: ${e.message || e}`); }
  }
  lastConnErr = new Error(errs.join(' · ') || 'no provider configured');
  if (!skip) { activeProv = chain[0]; client = makeClientFor(activeProv); models = []; fillModelSelects(); }
  setOllamaChip('bad', 'OFFLINE'); renderEmpty(lastConnErr); return false;
}
// mid-run failover: move to the next provider in the chain that has not been tried yet
async function failover(tried) { tried.add(activeProv); return (await connect({ skip: tried })) && !tried.has(activeProv); }
// when running on a fallback, quietly check whether the main provider is back before each prompt
async function maybeRestorePrimary() {
  const prim = S.provider || 'local';
  if (activeProv === prim || running) return;
  try { const res = await withTimeout(tryProvider(prim), 3000, PROVIDERS[prim].label); activateProvider(prim, res); renderEmpty(); toast(`${esc(PROVIDERS[prim].label)} is back: switched to it.`, 'ok'); } catch {}
}
// one-shot (non-streaming) completion for compaction and the journal, on whatever provider is active
async function postWith(c, body, init) {
  if (c instanceof OpenAICompat) {
    try { const j = await c.once(body); return { ok: true, status: 200, json: async () => j }; }
    catch (e) { return { ok: false, status: 0, json: async () => ({ error: e.message }) }; }
  }
  const base = c?._base || c?.host || (S.host || DEFAULTS.host).replace(/\/+$/, '');
  return fetch(base + '/api/chat', { ...init, body: JSON.stringify(body), headers: { ...(init.headers || {}), ...(c?.headers || {}) } });
}
// one-shot (non-streaming) completion for compaction and the journal. Uses the model picked under
// Config → History compaction when set, and falls back to the chat model if that fails.
async function llmPost(init) {
  const body = JSON.parse(init.body);
  if (S.auxProv && PROVIDERS[S.auxProv] && !providerMissing(S.auxProv)) {
    try {
      const c = S.auxProv === activeProv ? client : makeClientFor(S.auxProv);
      const m = S.auxModel || S.modelBy?.[S.auxProv]; if (!m) throw new Error('no model picked');
      const r = await postWith(c, { ...body, model: m }, init); if (r.ok) return r;
      console.warn('compaction model failed, using the chat model', await r.json().catch(() => ({})));
    } catch (e) { console.warn('compaction model failed, using the chat model', e); }
  }
  return postWith(client, body, init);
}
