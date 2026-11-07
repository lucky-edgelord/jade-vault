import { autoTabs } from './_tabs.mjs';
import pw from 'playwright';
import fs from 'node:fs';
const { chromium } = pw;
const URL_ = process.argv[2] || 'file://' + process.env.JV_WEB;
const OUT = process.cwd() + '/pshots'; fs.mkdirSync(OUT, { recursive: true });
const css = fs.readFileSync('tw.css', 'utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.NetrunnerAndroid = { keepAlive(on, t) { (window.__ka ||= []).push([on, t]); }, batteryOptimized() { return true; }, openBatterySettings() {}, requestNotifications() {},
    saveFile(n, m, t) { window.__saved = [n, m, t]; setTimeout(() => window.__jadeSaved(true, n), 10); }, notify(t, b) { (window.__notes ||= []).push([t, b]); } };
});
await ctx.addInitScript(() => { if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ model: 'qwen3:8b', fallback: 'groq', groqKey: 'gsk_test', ollamaKey: 'olk_test', journalOn: false })); });
const page = autoTabs(await ctx.newPage());
page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
let localUp = false, cloudDown = false, groq429 = 0; const groqBodies = [], cloudReqs = [];
const sse = (objs) => objs.map(o => 'data: ' + JSON.stringify(o) + '\n\n').join('') + 'data: [DONE]\n\n';
await page.route('**/*', async route => {
  const req = route.request(); const url = req.url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('katex.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'katex/dist/katex.min.js', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  if (url.startsWith('http://localhost:11434/')) {
    if (!localUp) return route.abort('connectionrefused');
    if (url.endsWith('/api/tags')) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
    if (url.endsWith('/api/chat')) return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: 'Local Jade here.' }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n' });
  }
  if (url === 'https://api.groq.com/openai/v1/models') {
    ok(req.headers().authorization === 'Bearer gsk_test', 'groq models call sends key');
    return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'whisper-large-v3' }, { id: 'llama-3.1-8b-instant' }, { id: 'openai/gpt-oss-120b' }, { id: 'meta-llama/llama-guard-4-12b' }] }) });
  }
  if (url === 'https://api.groq.com/openai/v1/chat/completions') {
    const b = JSON.parse(req.postData()); groqBodies.push(b);
    if (groq429 > 0 && b.stream) { groq429--; return route.fulfill({ status: 429, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Rate limit reached for model', type: 'tokens' } }) }); }
    if (!b.stream) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'SUMMARY OF EARLIER TURNS: the user asked about the vault and Jade searched it.' } }] }) });
    const nTool = b.messages.filter(m => m.role === 'tool').length;
    const chunks = nTool === 0
      ? [{ choices: [{ delta: { role: 'assistant', reasoning: 'Let me look.' } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_g1', type: 'function', function: { name: 'notes_search', arguments: '' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"graph"}' } }] } }] }, { choices: [{ delta: {}, finish_reason: 'tool_calls' }], x_groq: { usage: { prompt_tokens: 1200, completion_tokens: 20, completion_time: 0.05 } } }]
      : [{ choices: [{ delta: { content: 'Found it: [[Graph View]] ' } }] }, { choices: [{ delta: { content: 'explains the graph.' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }], x_groq: { usage: { prompt_tokens: 1500, completion_tokens: 12, completion_time: 0.02 } } }];
    return route.fulfill({ headers: CORS, contentType: 'text/event-stream', body: sse(chunks) });
  }
  if (url.startsWith('https://ollama.com/api/')) {
    if (cloudDown) return route.fulfill({ status: 503, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: 'service unavailable' }) });
    cloudReqs.push({ url, auth: req.headers().authorization, body: req.postData() });
    if (url.endsWith('/api/tags')) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'gemma4:31b' }, { name: 'gpt-oss:120b' }] }) });
    if (url.endsWith('/api/chat')) return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: [{ message: { role: 'assistant', content: 'Cloud Jade reporting.' }, done: false }, { message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 800, eval_count: 5, eval_duration: 1e8 }].map(x => JSON.stringify(x)).join('\n') + '\n' });
  }
  return route.abort();
});
await page.goto(URL_);
await page.waitForFunction(() => /BUSYBOX|JS APPLETS/.test(document.querySelector('#txtShell')?.textContent || ''), null, { timeout: 90000 });
await page.waitForFunction(() => /GROQ|OFFLINE/.test(document.querySelector('#txtOllama')?.textContent || ''), null, { timeout: 30000 });
const st = await page.evaluate(() => ({ chip: $('#txtOllama').textContent, hdr: $('#hdrModel').textContent, p: getProv() }));
ok(st.p.activeProv === 'groq' && /GROQ LINKED/.test(st.chip), 'falls back to Groq when the Mac is unreachable: ' + st.chip);
ok(JSON.stringify(st.p.models) === '["llama-3.1-8b-instant","openai/gpt-oss-120b"]', 'Groq model list filtered: ' + JSON.stringify(st.p.models));
ok(/openai\/gpt-oss-120b · Groq/.test(st.hdr), 'picks a tool-capable model, header shows provider: ' + st.hdr);
ok(/\(fallback\)/.test(await page.textContent('#chat')), 'boot row says fallback');
await page.screenshot({ path: OUT + '/1_fallback.png' });
// agent run on Groq: tool call streamed in pieces, then answer
await page.fill('#input', 'Where is the graph explained?'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .msg-ai').length, null, { timeout: 30000 }); await page.waitForTimeout(400);
const b2 = groqBodies.filter(b => b.stream)[1];
ok(groqBodies.filter(b => b.stream).length === 2, 'two Groq calls (tool round + answer)');
const asst = b2?.messages.find(m => m.role === 'assistant' && m.tool_calls); const tool = b2?.messages.find(m => m.role === 'tool');
ok(asst && tool && tool.tool_call_id === asst.tool_calls[0].id && JSON.parse(asst.tool_calls[0].function.arguments).query === 'graph', 'history converted to OpenAI tool format with matching ids');
ok(/Graph View/.test(tool?.content || ''), 'notes_search ran on Groq args');
ok(b2?.tools?.length > 5 && b2.tools[0].type === 'function', 'tools sent in OpenAI format');
const chatTxt = await page.textContent('#chat');
ok(/Found it: Graph View explains the graph\./.test(chatTxt.replace(/\s+/g, ' ')) || /explains the graph/.test(chatTxt), 'Groq answer rendered');
ok(await page.locator('#chat details').filter({ hasText: 'NEURAL TRACE' }).count() >= 1, 'Groq reasoning shown as thinking');
ok(/^~[\d.]+k \/ /.test(await page.textContent('#hudCtx')), 'usage → context HUD: ' + await page.textContent('#hudCtx'));
await page.screenshot({ path: OUT + '/2_groq_run.png' });
// compaction uses the active provider (non-streaming)
await page.fill('#input', '/compact 0'); await page.tap('#btnSend'); await page.waitForTimeout(1500);
ok(groqBodies.some(b => !b.stream) && /Context compacted/.test(await page.textContent('#chat')), 'compaction works on Groq');
// switch to Ollama Cloud from the drawer
await page.tap('#btnDrawer'); await page.waitForTimeout(300);
await page.selectOption('#provSel', 'cloud'); await page.waitForTimeout(1500);
const st2 = await page.evaluate(() => ({ chip: $('#txtOllama').textContent, p: getProv(), hdr: $('#hdrModel').textContent }));
ok(st2.p.activeProv === 'cloud' && /OLLAMA CLOUD LINKED/.test(st2.chip) && /gpt-oss:120b/.test(st2.hdr), 'switched to Ollama Cloud: ' + st2.chip + ' / ' + st2.hdr);
ok(cloudReqs[0]?.auth === 'Bearer olk_test', 'Ollama Cloud gets the API key');
await page.tap('#drawerBg').catch(() => {}); await page.evaluate(() => document.body.classList.remove('drawer-open'));
await page.fill('#input', '/new'); await page.tap('#btnSend'); await page.waitForTimeout(300);
await page.fill('#input', 'hello cloud'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && /Cloud Jade reporting/.test(document.querySelector('#chat').textContent), null, { timeout: 20000 });
const cb = JSON.parse(cloudReqs.find(r => r.url.endsWith('/api/chat')).body);
ok(cb.model === 'gpt-oss:120b' && cb.tools?.length > 5 && cb.stream === true, 'cloud chat uses the native Ollama API with tools');
await page.screenshot({ path: OUT + '/3_cloud.png' });
// settings UI shows the right fields
await page.tap('#btnSettings'); await page.waitForTimeout(300);
const vis = async () => page.evaluate(() => [...document.querySelectorAll('[data-prov]')].filter(e => !e.hidden).map(e => e.querySelector('input').id).join(','));
ok(await vis() === 'sCloudKey,sGroqKey', 'cloud + groq fallback fields: ' + await vis());
await page.selectOption('#sProvider', 'local'); ok(await vis() === 'sHost,sGroqKey' && !(await page.isHidden('#sFallbackWrap')), 'local + groq fallback fields: ' + await vis());
await page.selectOption('#sProvider', 'openai'); ok(await vis() === 'sGroqKey,sOaiHost,sOaiKey', 'openai fields: ' + await vis());
ok(await page.locator('#fbList .fb-row').count() === 6, 'fallback list rows (OpenRouter is one of them since 2.27)');
await page.screenshot({ path: OUT + '/4_settings.png' });
// back to local as the main provider; Mac comes back → auto switch before the next prompt
await page.selectOption('#sProvider', 'local'); await page.tap('#btnSave'); await page.waitForTimeout(1500);
ok(await page.evaluate(() => getProv().activeProv) === 'groq', 'local still down → groq');
localUp = true;
await page.fill('#input', 'are you local?'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && /Local Jade here/.test(document.querySelector('#chat').textContent), null, { timeout: 20000 }).catch(() => {});
ok(await page.evaluate(() => getProv().activeProv) === 'local' && /Local Jade here/.test(await page.textContent('#chat')), 'switches back to the Mac when it returns');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('jvault:settings')).modelBy.groq) === 'openai/gpt-oss-120b', 'remembers model per provider');
// Mac drops mid-session → automatic fallback inside the agent loop
localUp = false;
await page.fill('#input', '/new'); await page.tap('#btnSend'); await page.waitForTimeout(300);
await page.fill('#input', 'still there?'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .msg-ai').length, null, { timeout: 40000 }); await page.waitForTimeout(300);
ok(await page.evaluate(() => getProv().activeProv) === 'groq' && /explains the graph|Graph View/.test(await page.textContent('#chat')), 'mid-chat drop → retried on Groq');
// ---- fallback chain order + rate-limit failover ----
await page.evaluate(() => { S.provider = 'local'; S.fallbacks = ['cloud', 'groq']; S.fallbackOrder = ['local', 'cloud', 'groq', 'openai']; });
cloudDown = true; localUp = false;
await page.evaluate(() => connect()); await page.waitForTimeout(300);
ok(await page.evaluate(() => getProv().activeProv) === 'groq', 'chain local → cloud (down) → groq');
cloudDown = false; groq429 = 1;
await page.fill('#input', '/new'); await page.tap('#btnSend'); await page.waitForTimeout(300);
await page.fill('#input', 'rate limit me'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .msg-ai').length, null, { timeout: 30000 }); await page.waitForTimeout(300);
ok(await page.evaluate(() => getProv().activeProv) === 'cloud' && /Cloud Jade reporting/.test(await page.textContent('#chat')), 'Groq 429 → continued on next provider (cloud)');
// ---- compaction model on another provider ----
await page.evaluate(() => { S.auxProv = 'groq'; S.auxModel = 'llama-3.1-8b-instant'; });
const nBefore = groqBodies.length;
await page.fill('#input', '/compact 0'); await page.tap('#btnSend'); await page.waitForTimeout(1500);
const aux = groqBodies.slice(nBefore).find(b => !b.stream);
ok(aux && aux.model === 'llama-3.1-8b-instant' && /Context compacted/.test(await page.textContent('#chat')), 'compaction used the picked model on Groq while chatting on cloud');
// settings UI for aux model
await page.tap('#btnSettings'); await page.waitForTimeout(300);
await page.waitForFunction(() => document.querySelectorAll('#sAuxModel option').length >= 2, null, { timeout: 5000 }).catch(() => {});
ok(await page.inputValue('#sAuxProv') === 'groq' && await page.inputValue('#sAuxModel') === 'llama-3.1-8b-instant', 'aux model shown in Config');
await page.screenshot({ path: OUT + '/5_settings_aux.png', fullPage: false });
// ---- background bridge ----
const ka = await page.evaluate(() => window.__ka || []);
ok(ka.some(([on]) => on === true) && ka[ka.length - 1][0] === false, 'keepAlive on while working, off when idle: ' + JSON.stringify(ka.slice(-3)));
ok(ka.some(([on, t]) => on && /thinking|using a tool|working/i.test(t)), 'service notification shows what Jade is doing');
ok(!(await page.isHidden('#bgNative')) && /Battery saver/.test(await page.textContent('#bgBattery')), 'background settings show battery state');
await page.selectOption('#sBgMode', 'always'); await page.tap('#btnSave'); await page.waitForTimeout(400);
const ka2 = await page.evaluate(() => window.__ka.slice(-1)[0]);
ok(ka2[0] === true && /Standing by/.test(ka2[1]), 'always mode keeps the service up while idle: ' + ka2[1]);
await page.evaluate(() => { window.__notes = []; S.bgMode = 'agent'; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
await page.fill('#input', 'background run'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && (window.__notes || []).length, null, { timeout: 20000 }).catch(() => {});
const notes = await page.evaluate(() => window.__notes || []);
ok(notes.length === 1 && /Jade finished/.test(notes[0][0]) && notes[0][1].length > 5, 'finish notification when hidden: ' + JSON.stringify(notes[0] || null));
await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
// ---- backup export / import ----
await page.evaluate(() => { S.groqKey = 'gsk_test'; });
await page.tap('#btnSettings').catch(() => {}); await page.waitForTimeout(200);
await page.evaluate(() => { if ($('#settings').hidden) $('#btnSettings').click(); });
await page.tap('#btnExportAll'); await page.waitForTimeout(1200);
const saved = await page.evaluate(() => window.__saved);
const bk = JSON.parse(saved[2]);
ok(/^jade-vault-backup-\d{4}-\d\d-\d\d\.json$/.test(saved[0]) && bk.kind === 'full' && bk.vault.files['/Welcome.md'] && bk.vault.files['/Jade/SOUL.md'] && bk.db.sessions?.length >= 2 && Array.isArray(bk.db.schedules ?? []), 'full export: files, chats, settings (' + Object.keys(bk.vault.files).length + ' files, ' + (bk.db.sessions || []).length + ' chats)');
ok(!('groqKey' in bk.settings) && !bk.includesKeys, 'keys left out unless asked');
ok(/Full backup: \d+ files/.test(await page.textContent('#backupNote')), 'backup summary shown');
await page.tap('#btnExportCfg'); await page.waitForTimeout(500);
const cfg = JSON.parse(await page.evaluate(() => window.__saved[2]));
ok(cfg.kind === 'config' && cfg.vault.files['/AGENTS.md'] && cfg.vault.files['/Jade/skills/daily-review/SKILL.md'] && !cfg.vault.files['/Welcome.md'] && !cfg.db, 'config export has only config files');
// import the full backup after wiping a note and changing a setting
bk.vault.files['/Restored Note.md'] = '# Restored\n';
bk.settings.temperature = 0.7;
fs.writeFileSync(OUT + '/backup.json', JSON.stringify(bk));
await page.evaluate(() => { vfs.rm('/Welcome.md'); });
page.once('dialog', d => d.accept());
await page.setInputFiles('#importBackup', OUT + '/backup.json');
await page.waitForEvent('load', { timeout: 15000 }).catch(() => {});
await page.waitForFunction(() => typeof vfs !== 'undefined' && vfs.nodes.size > 5, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ w: vfs.isFile('/Welcome.md'), r: vfs.isFile('/Restored Note.md'), t: S.temperature, key: S.groqKey, chats: document.querySelectorAll('#sessList .sess').length }));
ok(after.w && after.r && after.t === 0.7 && after.key === 'gsk_test', 'import restores files + settings, keeps existing keys: ' + JSON.stringify(after));
// a setting changed while a background model call (journal, heartbeat …) borrows the chat model is still saved, with the person's own model
const bg = await page.evaluate(async () => {
  const own = S.model; window.__modelOverride = { model: own }; S.model = 'background-model:1b';   // what withModel does while it runs
  const during = S.model; S.temperature = 0.33; saveSettings();
  const stored = JSON.parse(localStorage.getItem('jvault:settings')); S.model = own; window.__modelOverride = false;
  return { own, during, temp: stored.temperature, model: stored.model, after: S.model };
});
ok(bg.during === 'background-model:1b' && bg.temp === 0.33 && bg.model === bg.own && bg.after === bg.own, 'settings changed during a background model call are saved, keeping the chat model: ' + JSON.stringify(bg));
// localStorage can lose its writes when the page reloads (or Android kills the app) before they are flushed; the
// settings are kept in IndexedDB too, and the newer copy wins at boot
await page.evaluate(async () => { S.temperature = 0.44; S.jadeTheme = 'ruby'; saveSettings(); await new Promise(r => setTimeout(r, 300)); localStorage.clear(); });
await page.reload(); await page.waitForFunction(() => typeof vfs !== 'undefined' && vfs.nodes.size > 5, null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(800);
const lost = await page.evaluate(() => ({ t: S.temperature, theme: S.jadeTheme, label: document.querySelector('#btnTheme')?.textContent, ls: JSON.parse(localStorage.getItem('jvault:settings') || '{}').temperature }));
ok(lost.t === 0.44 && lost.theme === 'ruby' && /ruby/i.test(lost.label || '') && lost.ls === 0.44, 'settings lost from localStorage come back from the IndexedDB copy at boot (theme applied too): ' + JSON.stringify(lost));
console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS'));
await browser.close();
