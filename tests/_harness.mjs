// Shared setup for the flows / bridge / templates suites: headless Chromium on the built page, a fake
// Android shell (records notifications), a fake Ollama (chat, streaming and one-shot) and a fake Ollaya.
import pw from 'playwright';
import fs from 'node:fs';
import { autoTabs } from './_tabs.mjs';
const { chromium } = pw;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

export async function start({ settings = {}, init = '', scale = 1 } = {}) {
  const URL_ = process.argv[2] || 'file://' + process.env.JV_WEB;
  const css = fs.readFileSync('tw.css', 'utf8');
  const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
  const browser = await chromium.launch({ args: [...(process.env.JV_GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : []), ...(process.env.JV_ARGS ? process.env.JV_ARGS.split(' ') : [])] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale });
  await ctx.addInitScript((settings) => {
    try { if (window !== window.top) return; } catch {}
    if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ model: 'qwen3:8b', journalOn: false, ollayaOn: true, ollayaModel: 'judge-1', ollayaHost: 'http://localhost:9911', ...settings }));
    window.__notes = []; window.__apiWait = {};
    window.NetrunnerAndroid = {
      notify(t, b) { window.__notes.push([t, b]); }, requestNotifications() {}, keepAlive() { return true; }, batteryOptimized() { return false; }, openBatterySettings() {},
      ttsAvailable() { return false; }, speak() { return false; }, stop() {}, saveFile() {}, openTtsSettings() {},
      apiConfigure() { return '{"enabled":false,"listening":false,"addresses":[],"error":""}'; }, apiStatus() { return '{"enabled":false,"listening":false,"addresses":[],"error":""}'; },
      apiResult(id, status, body) { const w = window.__apiWait[id]; if (w) w({ status, body: JSON.parse(body) }); },
    };
  }, settings);
  if (init) await ctx.addInitScript(init);   // runs after the fake Android shell exists, before the page's own scripts
  const page = autoTabs(await ctx.newPage());
  page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
  const model = { oneShot: [], chats: [], hold: null,
    // one-shot answers (jade.ask, Ask AI steps): reply to the last user message
    answer: (msgs) => { const u = msgs.at(-1).content; if (/JSON only/.test(msgs[0]?.content || '')) return '```json\n{"topic":"' + u.slice(0, 12) + '","n":3}\n```'; if (/urgent, normal or someday/.test(u)) return /fire|asap/i.test(u) ? 'urgent' : 'normal'; return 'ANSWER: ' + u; } };
  const ollaya = { calls: [] };
  const extraRoutes = [];     // tests can add async (route) => true handlers for their own fake servers
  await page.route('**/*', async route => {
    for (const f of extraRoutes) if (await f(route) === true) return;
    const req = route.request(); const url = req.url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
    if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
    if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
    if (url === 'http://localhost:11434/api/tags') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
    if (url === 'http://localhost:11434/api/chat') {
      const b = JSON.parse(req.postData());
      if (!b.stream) { model.oneShot.push(b.messages); return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: { role: 'assistant', content: model.answer(b.messages) }, done: true }) }); }
      model.chats.push(b.messages); (model.tools ||= []).push(b.tools || []);
      if (model.hold) await model.hold;
      const userText = [...b.messages].reverse().find(m => m.role === 'user')?.content.replace(/^\[[^\]]*\]\s*/, '') || '';
      const custom = model.chatReply ? model.chatReply(b.messages, userText) : null;   // a test can script the reply
      if (custom?.status) return route.fulfill({ status: custom.status, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: custom.error || 'boom' }) });
      if (custom) return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: custom.content || '', ...(custom.tool_calls ? { tool_calls: custom.tool_calls } : {}) }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 10, eval_count: 5 }) + '\n' });
      return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: 'Agent says: ' + userText }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 10, eval_count: 5 }) + '\n' });
    }
    if (url === 'http://localhost:11434/api/embed' && model.embed) {   // a test can supply a fake embedding model: model.embed = text => number[]
      const b = JSON.parse(req.postData()); model.embedCalls = (model.embedCalls || 0) + 1;
      return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ model: b.model, embeddings: b.input.map(t => model.embed(t)) }) });
    }
    if (url.startsWith('http://localhost:9911/')) {
      if (url.endsWith('/api/tags')) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'judge-1' }] }) });
      if (url.endsWith('/v1/systemone')) {
        const b = JSON.parse(req.postData()); ollaya.calls.push(b); const q = b.questions.q;
        let a;
        if (q.type === 'choice') a = { choice: q.criteria[0], confidence: 0.91, probabilities: Object.fromEntries(q.criteria.map((c, i) => [c, i ? 0.09 / (q.criteria.length - 1) : 0.91])) };
        else if (q.type === 'score') a = { score: 2, legend: q.criteria[1], confidence: 0.7, probabilities: [0.1, 0.7, 0.2] };
        else a = { noul: /fire|asap|urgent/i.test(b.state), confidence: 0.88, probabilities: { true: 0.88, false: 0.12 } };
        return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ model: 'judge-1', answers: { q: a } }) });
      }
    }
    if (url === 'https://example.test/data.json') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ items: [1, 2, 3] }) });
    return route.abort();
  });
  await page.goto(URL_);
  await page.waitForFunction(() => typeof flowRun === 'function' && typeof userShell !== 'undefined' && S.model && typeof Sched !== 'undefined', null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const sh = (cmd, timeout = 30000) => page.evaluate(async ([cmd, timeout]) => { const s = new (Object.getPrototypeOf(userShell).constructor)({}); s.timeoutMs = timeout; const r = await s.run(cmd); return { out: r.chunks.filter(c => !c.err).map(c => c.s).join(''), err: r.chunks.filter(c => c.err).map(c => c.s).join(''), code: r.code }; }, [cmd, timeout]);
  const api = (route, params = {}) => page.evaluate(([r, p]) => new Promise(res => { const id = 't' + Math.random(); window.__apiWait[id] = res; window.__jadeApi(id, r, p); }), [route, params]);
  const write = (p, text) => page.evaluate(([p, t]) => vfs.write(p, t, { mkdirs: true }), [p, text]);
  const read = p => page.evaluate(p => vfs.isFile(p) ? vfs.read(p) : null, p);
  const done = async () => { console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS')); await browser.close(); };
  return { browser, ctx, page, ok, log, fail, sh, api, write, read, model, ollaya, done, extraRoutes };
}
