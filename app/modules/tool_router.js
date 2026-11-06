/* =====================================================================
   TOOL ROUTER: send the model only the tools that fit the message
   ===================================================================== */
// Every tool costs context on every request (its name, description and parameters, about 8,000 tokens for the full set), which on a
// 16k window and a phone's prompt-processing speed is most of the budget. The core tools are always sent. The optional ones
// (phone, ssh, screen, browser, playbook, think, …) are sent when the message points at them (words and meaning of their description
// plus a few hint words), when they were used earlier in the chat, when a skill's text names them, or when the model asks for them with
// more_tools. Calls never depend on this list: a tool the model names but was not sent still runs. activeTools() stays the full set
// (validation, flows, playbooks and scripts use it); only the model request is routed. Settings: toolRouter 'auto' | 'on' | 'off'.
const TR_CORE = new Set(['read', 'write', 'edit', 'bash', 'tasks', 'web_search', 'web_fetch', 'notes_search', 'note_links', 'open_note', 'memory', 'skill', 'find_skill', 'decide', 'codemode', 'tool_search', 'list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource', 'more_tools']);
const TR_MAX = 5, TR_MIN_SAVING = 6000;
const TR_HINTS = {
  phone: 'alarm timer clock call dial sms text message contact clipboard bluetooth volume cast chromecast tv ring sound radio brightness flashlight ringtone',
  screen: 'screen tap swipe click other app accessibility keyboard type scroll screenshot on-screen',
  ssh: 'ssh server remote machine host terminal login session raspberry vps',
  sentry: 'sentry rule trigger watch event reflex notification battery charging when happens automatically',
  browser: 'browser website web page open url click login scrape',
  playbook: 'playbook automate automation repeat routine chore deterministic ansible task recurring',
  flow: 'flow workflow chain automation steps',
  schedule: 'schedule remind reminder daily weekly cron every later alarm recurring',
  litert: 'tflite model classify classification detect inference image tensor',
  senses: 'camera microphone sensor location gps listen photo accelerometer see hear',
  look: 'look camera see photo picture',
  apps: 'app apps webxdc xdc install game widget',
  embeddings: 'embedding vector semantic similar index meaning',
  think: 'think reason deliberate tree verify hard problem puzzle plan',
  delegate: 'delegate sub-agent subagent side job helper research',
  chat_history: 'previous earlier chat conversation history said remember session',
  curiosity: 'curiosity wake explore idle',
  backup: 'backup restore server export',
  http_request: 'http api request post put get rest json endpoint download webhook',
  jade_link: 'link board jade link',
  lisp: 'lisp scheme clojure dsl domain specific language macro interpreter s-expression script program eval parse rules language',
  sched: 'schedule scheduler queue autonomous autonomy goal goals background later while away priority interrupt task tasks long running work on my own',
  gantt: 'gantt plan plans project projects milestone milestones timeline roadmap deadline dependencies critical path weeks months long term planning',
  knowledge: 'knowledge graph fact facts verify verification prove proof true false contradiction contradict consistent consistency check claim rule rules logic datalog reasoner who works relation',
  vault_map: 'vault map loci locus palace memory palace avatar walk room place show around remember at where go',
};
const trHidden = () => cur?.toolsHidden || [];
function trUsedNames() {
  const out = new Set(cur?.toolsLoaded || []);
  const ms = (cur?.messages || []).slice(-80);
  for (const m of ms) if (m.role === 'assistant') for (const c of m.tool_calls || []) out.add(c.function?.name);
  return out;
}
function trQuery() {
  const ms = cur?.messages || []; const us = ms.filter(m => m.role === 'user');
  let q = String(us.at(-1)?.display || us.at(-1)?.content || '');
  const skillText = ms.slice(-8).filter(m => m.role === 'tool' && m.tool_name === 'skill').map(m => String(m.content || '')).join('\n');
  return { q, skillText };
}
// Filler words say nothing about which tool a message needs, but every long tool description is full of them: left in,
// a plain question ("what is the capital of France?") would pull in whichever tool has the most "the" and "is".
const TR_STOP = new Set('a an and are as at be but by can could do does did for from has have how i if in into is it its me my no not of on or our please so than thanks thank that the their them then there these they this to us was we what when where which who why will with would yes you your'.split(' '));
const trContent = q => String(q).split(/\s+/).filter(w => !TR_STOP.has(w.toLowerCase().replace(/[^a-z']/g, ''))).join(' ');
function routeTools(list) {
  const mode = S.toolRouter || 'auto';
  if (mode === 'off' || !cur) return list;
  const isOpt = t => { const n = t.function.name; return !TR_CORE.has(n) && !/^mcp__/.test(n) && !mcpHandles(n); };
  const opt = list.filter(isOpt); if (!opt.length) return list;
  if (mode === 'auto' && opt.reduce((a, t) => a + JSON.stringify(t).length, 0) < TR_MIN_SAVING) return list;
  const keep = new Set(trUsedNames()); const { q, skillText } = trQuery();
  // a chat that came in through Vector or Discord must always have its channel tool (replies, Mini App frames, notify_owner)
  if (cur.vec || cur.vecScope || (cur.messages || []).some(m => m._vec)) { keep.add('vector'); keep.add('notify_owner'); }
  if (cur.dc || cur.dcScope || (cur.messages || []).some(m => m._dc)) { keep.add('discord'); keep.add('notify_owner'); }
  const lower = ' ' + q.toLowerCase().replace(/[^a-z0-9_ ]+/g, ' ') + ' ';
  for (const t of opt) { const n = t.function.name; if (lower.includes(' ' + n.toLowerCase() + ' ') || (skillText && new RegExp('\\b' + n.replace(/[^a-z0-9_]/gi, '') + '\\b', 'i').test(skillText))) keep.add(n); }
  if (q.trim()) {
    const ranked = bm25(opt.map(t => ({ name: t.function.name, text: `${t.function.name} ${TR_HINTS[t.function.name] || ''} ${TR_HINTS[t.function.name] || ''} ${t.function.description}` })), trContent(typeof searchText === 'function' ? searchText(q) : q));
    const top = ranked[0]?.s || 0;
    for (const x of ranked.filter(x => x.s >= Math.max(0.5 * top, 1.2)).slice(0, TR_MAX)) keep.add(x.d.name);
  }
  // Sticky: once a tool has been offered in this chat it stays offered. The tool list is the start of the prompt, so a list that
  // changes from turn to turn invalidates the model's prompt cache and the whole conversation is re-read (slow on a phone).
  // The set only grows, and the order is always the order of the full list.
  const optNames = new Set(opt.map(t => t.function.name));
  cur.toolsLoaded = [...new Set([...(cur.toolsLoaded || []), ...[...keep].filter(n => optNames.has(n))])];
  for (const n of cur.toolsLoaded) keep.add(n);
  const chosen = list.filter(t => !isOpt(t) || keep.has(t.function.name));
  const hidden = opt.filter(t => !keep.has(t.function.name)).map(t => t.function.name);
  cur.toolsHidden = hidden;
  if (hidden.length) chosen.push({ type: 'function', function: { name: 'more_tools', description: `More tools exist but are not loaded, to save context: ${hidden.join(', ')}. Call this with names (or a short description of the job) to load them; they are callable from your next step.`, parameters: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' }, description: 'tool names to load' }, query: { type: 'string', description: 'or describe the job, e.g. "set an alarm"' } } } } });
  return chosen;
}
function moreToolsTool(args) {
  const all = activeTools().filter(t => !TR_CORE.has(t.function.name) && !/^mcp__/.test(t.function.name) && !mcpHandles(t.function.name));
  const want = new Set((Array.isArray(args.names) ? args.names : typeof args.names === 'string' ? args.names.split(/[,\s]+/) : []).map(x => String(x).trim()).filter(Boolean));
  const q = String(args.query || '').trim();
  if (q) { const r = bm25(all.map(t => ({ name: t.function.name, text: `${t.function.name} ${TR_HINTS[t.function.name] || ''} ${t.function.description}` })), typeof searchText === 'function' ? searchText(q) : q); for (const x of r.slice(0, 4)) want.add(x.d.name); }
  const hits = all.filter(t => want.has(t.function.name));
  if (!hits.length) return `No tool matches. Not loaded: ${all.map(t => t.function.name).join(', ')}.`;
  cur.toolsLoaded = [...new Set([...(cur.toolsLoaded || []), ...hits.map(t => t.function.name)])]; saveSession();
  return `Loaded ${hits.length} tool${hits.length > 1 ? 's' : ''}; call ${hits.length > 1 ? 'them' : 'it'} from your next step:\n` + hits.map(t => `- ${t.function.name}(${schemaHint(t.function.parameters)}): ${String(t.function.description).slice(0, 220)}`).join('\n');
}
Object.assign(window, { routeTools, moreToolsTool, TR_CORE, TR_HINTS });
