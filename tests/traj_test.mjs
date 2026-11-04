import pw from 'playwright';
import fs from 'node:fs';
const { chromium } = pw;
const URL_ = process.argv[2] || 'file://' + process.env.JV_WEB;
const css = fs.readFileSync('tw.css', 'utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Detroit', locale: 'en-US' });
await ctx.addInitScript(() => { if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ model: 'qwen3:8b', journalOn: false })); });
const page = await ctx.newPage();
page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
let mode = 'ok'; const seen = [];
await page.route('**/*', async route => {
  const req = route.request(); const url = req.url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  if (url === 'http://localhost:11434/api/tags') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
  if (url === 'http://localhost:11434/api/chat') {
    const b = JSON.parse(req.postData()); if (b.stream) seen.push(b);
    if (!b.stream) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: { role: 'assistant', content: 'SUMMARY: - x\nREMEMBER:\n- none' }, done: true }) });
    if (mode === 'err') return route.fulfill({ status: 400, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: 'model exploded' }) });
    const last = b.messages.at(-1);
    const step = last.role === 'user' ? { thinking: 'I should list the daily folder.', tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls /' } } }] } : { content: 'Here is your vault.' };
    return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: step.content || '', thinking: step.thinking, ...(step.tool_calls ? { tool_calls: step.tool_calls } : {}) }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 900, eval_count: 30 }) + '\n' });
  }
  return route.abort();
});
await page.goto(URL_);
await page.waitForFunction(() => typeof TrajDB !== 'undefined' && typeof userShell !== 'undefined', null, { timeout: 90000 });
await page.waitForTimeout(1200);
const send = async (t) => { const n0 = await page.evaluate(() => cur?.messages.length || 0); await page.fill('#input', t); await page.evaluate(() => document.querySelector('#btnSend').click()); await page.waitForFunction((n0) => !running && cur && cur.messages.length > n0 + 1, n0, { timeout: 30000 }); await page.waitForTimeout(400); };
await send('what is in my vault?');
const first = seen[0]; const u = first.messages.find(m => m.role === 'user');
ok(/^\[(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{4}-\d\d-\d\d \d\d:\d\d E[DS]T\] what is in my vault\?$/.test(u.content), 'model sees the send time on the user message: ' + u.content);
ok(/Today is \w+day, \w+ \d+, \d{4} \(time zone America\/Detroit, UTC-0[45]:00\)/.test(first.messages[0].content), 'system prompt has local date + zone: ' + /Today is[^\n]*/.exec(first.messages[0].content)?.[0].slice(0, 90));
ok(seen[1].messages.find(m => m.role === 'user').content === u.content, 'stamp stays identical on later calls (prompt cache friendly)');
const ui = await page.evaluate(() => ({ user: document.querySelector('.msg-user [data-when]')?.textContent, ai: [...document.querySelectorAll('.msg-ai [data-when]')].at(-1)?.textContent, rate: !!document.querySelector('.msg-ai .rate-bar') }));
ok(/^\d{1,2}:\d\d [AP]M$/.test(ui.user || ''), 'your message shows its time: ' + ui.user);
ok(/^\d{1,2}:\d\d [AP]M · \d/.test(ui.ai || '') && ui.rate, 'Jade\'s reply shows time + duration + rating: ' + ui.ai);
await page.screenshot({ path: 'traj_chat.png' });
let recs = await page.evaluate(() => TrajDB.all());
ok(recs.length === 1, 'one trajectory per run: ' + recs.length);
const r0 = recs[0];
ok(JSON.stringify(r0.messages.map(m => m.role)) === '["system","user","assistant","tool","assistant"]' && r0.steps.length === 2 && r0.outcome === 'ok' && r0.tools.length > 5 && r0.model === 'qwen3:8b', 'record holds the full run: ' + JSON.stringify({ roles: r0.messages.map(m => m.role), steps: r0.steps.length, outcome: r0.outcome, tools: r0.tools.length }));
ok(r0.messages[2].thinking === 'I should list the daily folder.' && r0.steps[0].prompt_tokens === 900, 'thinking + token counts kept');
// rating
await page.evaluate(() => [...document.querySelectorAll('.msg-ai .rate-bar [data-rate="1"]')].at(-1).click()); await page.waitForTimeout(300);
ok((await page.evaluate(() => TrajDB.all()))[0].rating === 1, '👍 saved on the trajectory');
// export: OpenAI
let ex = await page.evaluate(() => exportTrajectories({ format: 'openai', filter: 'clean' }).then(r => r && { count: r.count, text: r.text }));
const o = JSON.parse(ex.text.trim());
const asstCall = o.messages.find(m => m.tool_calls); const toolMsg = o.messages.find(m => m.role === 'tool');
ok(ex.count === 1 && o.tools[0].type === 'function' && typeof asstCall.tool_calls[0].function.arguments === 'string' && toolMsg.tool_call_id === asstCall.tool_calls[0].id && o.messages.at(-1).content === 'Here is your vault.', 'OpenAI JSONL: tools + paired tool_call ids');
ok(!('reasoning_content' in asstCall), 'thinking left out by default');
ex = await page.evaluate(() => exportTrajectories({ format: 'openai', thinking: true }).then(r => r.text));
ok(JSON.parse(ex).messages.find(m => m.tool_calls).reasoning_content === 'I should list the daily folder.', 'thinking as reasoning_content when asked');
ex = await page.evaluate(() => exportTrajectories({ format: 'sharegpt' }).then(r => r.text));
const sg = JSON.parse(ex);
ok(JSON.stringify(sg.conversations.map(c => c.from)) === '["human","function_call","observation","gpt"]' && sg.system.length > 100 && JSON.parse(sg.tools).length > 5, 'ShareGPT: ' + JSON.stringify(sg.conversations.map(c => c.from)));
// error run + filters
mode = 'err'; await send('break please'); mode = 'ok';
recs = await page.evaluate(() => TrajDB.all());
ok(recs.length === 2 && recs.some(r => r.outcome === 'error' && r.error), 'failed run logged as error');
let c = await page.evaluate(async () => [(await exportTrajectories({ filter: 'clean' })).count, (await exportTrajectories({ filter: 'all' })).count]);
ok(c[0] === 1 && c[1] === 2, 'errors excluded unless "Everything": ' + c);
await send('again'); 
await page.evaluate(() => [...document.querySelectorAll('.msg-ai .rate-bar [data-rate="-1"]')].at(-1).click()); await page.waitForTimeout(300);
c = await page.evaluate(async () => [(await exportTrajectories({ filter: 'clean' })).count, (await exportTrajectories({ filter: 'good' })).count]);
ok(c[0] === 1 && c[1] === 1, '👎 excluded, "only 👍" works: ' + c);
// persistence of time + rating after reload
await page.reload(); await page.waitForFunction(() => typeof TrajDB !== 'undefined' && typeof userShell !== 'undefined', null, { timeout: 90000 }); await page.waitForFunction(() => cur?.messages?.length > 3, null, { timeout: 15000 }); await page.waitForTimeout(500);
await page.evaluate(() => renderChat()); await page.waitForTimeout(200);
const after = await page.evaluate(() => ({ whens: [...document.querySelectorAll('[data-when]')].map(x => x.textContent).filter(Boolean).length, on: [...document.querySelectorAll('.rate-bar button.on')].map(b => b.dataset.rate) }));
ok(after.whens >= 6 && JSON.stringify(after.on) === '["1","-1"]', 'times and ratings survive a reload: ' + JSON.stringify(after));
// settings panel
await page.evaluate(() => openSettings()); await page.waitForTimeout(500);
const st = await page.textContent('#trajStats');
ok(/3 runs · 4 model calls/.test(st) && /👍 1 · 👎 1 · 1 errors/.test(st), 'settings show log stats: ' + st);
await page.evaluate(() => document.querySelector('#trajSection').scrollIntoView()); await page.screenshot({ path: 'traj_settings.png' });
// ratings in the export (for DPO / KTO): 👎 a reply, Retry, 👍 the new one -> a pair with the same prompt
ok(!('metadata' in JSON.parse((await page.evaluate(() => exportTrajectories({ filter: 'all' }))).text.split('\n')[0])), 'no ratings in the export by default');
await page.evaluate(() => { const t = document.querySelector('#sTrajMeta'); t.checked = true; t.dispatchEvent(new Event('change')); const f = document.querySelector('#sTrajFilter'); f.value = 'prefs'; f.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => S.trajMeta === true && S.trajFilter === 'prefs' && JSON.parse(localStorage.getItem('jvault:settings')).trajMeta === true), '"Include ratings" and the 👎-too filter are saved');
await page.evaluate(() => document.querySelector('#btnCloseSettings, [data-close-settings]')?.click());
await page.evaluate(() => newSession()); await send('rate me');
await page.evaluate(() => [...document.querySelectorAll('.msg-ai [data-rate="-1"]')].at(-1).click()); await page.waitForTimeout(300);
const nRetry = await page.evaluate(() => cur.messages.length);
await page.evaluate(() => [...document.querySelectorAll('.reply-bar [data-ract="retry"]')].filter(b => !b.hidden).at(-1).click());
await page.waitForFunction(n => !running && cur.messages.length >= n, nRetry, { timeout: 30000 }); await page.waitForTimeout(500);
await page.evaluate(() => [...document.querySelectorAll('.msg-ai [data-rate="1"]')].at(-1).click()); await page.waitForTimeout(300);
const pref = await page.evaluate(() => exportTrajectories().then(r => r.text.trim().split('\n').map(l => JSON.parse(l))));
const rateMe = pref.filter(o => o.messages.some(m => m.role === 'user' && /rate me$/.test(m.content)));
const promptOf = o => JSON.stringify(o.messages.slice(0, -1).map(m => [m.role, m.content, (m.tool_calls || []).map(t => t.function)]));   // tool-call ids differ per run
ok(pref.every(o => o.metadata && 'rating' in o.metadata && o.metadata.outcome !== 'error'), 'with ratings on, every line has metadata (rating, outcome) and errors stay out: ' + pref.length);
ok(rateMe.length === 2 && JSON.stringify(rateMe.map(o => o.metadata.rating).sort()) === '[-1,1]' && promptOf(rateMe[0]) === promptOf(rateMe[1]), '👎 + Retry + 👍 exports a pair with the same prompt: ' + JSON.stringify(rateMe.map(o => o.metadata.rating)));
ok(pref.some(o => o.metadata.rating === -1) && (await page.evaluate(() => exportTrajectories({ filter: 'clean' }))).text.trim().split('\n').every(l => JSON.parse(l).metadata.rating !== -1), '"👎 too" keeps 👎 runs, "minus 👎" still drops them');
await page.evaluate(() => openSettings()); await page.waitForTimeout(300);
// switches
await page.evaluate(() => { const t = document.querySelector('#sTrajOn'); t.checked = false; t.dispatchEvent(new Event('change')); const s2 = document.querySelector('#sStampOn'); s2.checked = false; s2.dispatchEvent(new Event('change')); });
await page.evaluate(() => document.querySelector('#btnCloseSettings, [data-close-settings]')?.click());
seen.length = 0; await page.evaluate(() => newSession()); await send('no log now');
ok((await page.evaluate(() => TrajDB.count())) === 5, 'logging can be turned off');
ok(seen[0].messages.find(m => m.role === 'user').content === 'no log now' && !/Each user message starts with the time/.test(seen[0].messages[0].content), 'stamps can be turned off');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('jvault:settings')).trajOn === false), 'switch saved');
console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS'));
await browser.close();
