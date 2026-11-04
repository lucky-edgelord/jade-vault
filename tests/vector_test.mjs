import { autoTabs } from './_tabs.mjs';
import pw from 'playwright';
import fs from 'node:fs'; import { spawn } from 'node:child_process';
const { chromium } = pw;
const URL_ = process.argv[2] || 'file://' + process.env.JV_WEB;
const css = fs.readFileSync('tw.css', 'utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const HOME = process.cwd() + '/jvhome-test'; fs.rmSync(HOME, { recursive: true, force: true });
const BP = 8788, CP = 8798;
const bridge = spawn('python3', ['jade-vector/jade_vector_bridge.py', '--agent', `python3 ${process.cwd()}/jade-vector/test/fake_vector_agent.py`, '--port', String(BP), '--host', '127.0.0.1'], { env: { ...process.env, JADE_VECTOR_HOME: HOME, FAKE_CONTROL_PORT: String(CP) }, stdio: ['ignore', 'ignore', 'pipe'] });
let blog = ''; bridge.stderr.on('data', d => blog += d); process.on('exit', () => { try { bridge.kill(); } catch {} });
await new Promise(r => setTimeout(r, 2500));
const TOKEN = fs.readFileSync(HOME + '/token', 'utf8').trim();
const ctl = async (path, body) => (await fetch(`http://127.0.0.1:${CP}${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : {})).json();
await ctl('/profile', { npub: 'npub1alice000000000000000000000000000000000000000000000000000', name: 'Alice' });
const OWNER = 'npub1owner000000000000000000000000000000000000000000000000000', ALICE = 'npub1alice000000000000000000000000000000000000000000000000000', ADMIN = 'npub1admin000000000000000000000000000000000000000000000000000';
const CAT = fs.readFileSync('xdcfix/cat.png');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'America/New_York' });
await ctx.addInitScript(() => { try { if (window !== window.top) return; } catch {} if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ toolRouter: 'off', model: 'qwen3:8b', journalOn: false })); });
const page = autoTabs(await ctx.newPage()); page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
const calls = [];   // model requests
await ctx.route('**/*', async route => {
  const req = route.request(); const url = req.url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(`http://127.0.0.1:${BP}`)) return route.continue();
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  if (url === 'http://localhost:11434/api/tags') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
  if (url === 'http://localhost:11434/api/chat') {
    const b = JSON.parse(req.postData()); if (!b.stream) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: { role: 'assistant', content: 'SUMMARY:\n- x\nREMEMBER:\n- none' }, done: true }) });
    const li = b.messages.findLastIndex(m => m.role === 'user'); const u = b.messages[li].content; const k = b.messages.slice(li).filter(m => m.role === 'tool').length;
    const lastTool = b.messages.slice(li).filter(m => m.role === 'tool').at(-1)?.content || '';
    calls.push({ u: u.slice(0, 300), sys: b.messages[0].content, tools: b.tools.map(t => t.function.name), images: (b.messages[li].images || []).length, k, lastTool });
    const T = (name, args) => ({ tool_calls: [{ function: { name, arguments: args } }] });
    let step = { content: 'ok' };
    if (/urgent\?? it's urgent|tell your boss/.test(u)) step = k === 0 ? T('notify_owner', { message: 'Alice: the shipment arrives at 5pm today.', urgent: true }) : { content: 'Done, I passed it on to him!' };
    else if (/show me his notes/.test(u)) step = k === 0 ? T('read', { path: '/Inbox.md' }) : { content: 'Sorry, I cannot share that.' };
    else if (/send the inbox note to alice/.test(u)) step = k === 0 ? T('vector', { action: 'send_file', to: ALICE, path: '/Inbox.md' }) : k === 1 ? T('vector', { action: 'react', to: 'owner', message_id: 'own1', emoji: '👍' }) : { content: 'Sent it to Alice.' };
    else if (/what is in this picture/.test(u)) step = { content: 'A small orange square.' };
    else if (/jade what time/i.test(u)) step = { content: 'It is late, go to sleep.' };
    else if (/play with me/.test(u)) step = k === 0 ? T('vector', { action: 'xdc_join', message_id: (u.match(/message (in\d+)/) || [])[1] }) : { content: 'Joined, your move!' };
    else if (/Mini App session/.test(u)) step = k === 0 ? T('vector', { action: 'xdc_send', topic: (u.match(/session (\S+)/) || [])[1], frame: '{"move":4}' }) : { content: 'NO_REPLY' };
    else if (/message alice on vector/.test(u)) step = k === 0 ? T('vector', { action: 'send', to: ALICE, text: 'Hello from Jade' }) : { content: 'Messaged Alice.' };
    else if (/send it everywhere/.test(u)) step = k === 0 ? T('vector', { action: 'send', to: OWNER, text: 'spam' }) : { content: 'tried' };
    return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: step.content || '', ...(step.tool_calls ? { tool_calls: step.tool_calls } : {}) }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n' });
  }
  return route.abort();
});
await page.goto(URL_);
await page.waitForFunction(() => typeof vecConnect === 'function' && typeof userShell !== 'undefined', null, { timeout: 90000 });
await page.waitForTimeout(800);
// ---- settings ----
await page.evaluate(() => openSettings()); await page.waitForTimeout(300);
await page.fill('#sVecUrl', `http://127.0.0.1:${BP}/mcp`); await page.dispatchEvent('#sVecUrl', 'change');
await page.fill('#sVecToken', 'wrong-token'); await page.dispatchEvent('#sVecToken', 'change');
await page.fill('#sVecOwner', OWNER); await page.dispatchEvent('#sVecOwner', 'change');
await page.fill('#sVecOwnerName', 'Sam'); await page.dispatchEvent('#sVecOwnerName', 'change');
await page.fill('#sVecAdmins', ADMIN); await page.dispatchEvent('#sVecAdmins', 'change');
await page.selectOption('#sVecNotify', 'urgent');
await page.evaluate(() => { const t = document.querySelector('#sVecPoll'); t.value = '2'; t.dispatchEvent(new Event('change')); });
await page.check('#sVecOn'); await page.waitForTimeout(1500);
ok(/Not connected/.test(await page.textContent('#vecStatus')) && /token/i.test(await page.textContent('#vecStatus')), 'wrong token is refused: ' + (await page.textContent('#vecStatus')).slice(0, 80));
await page.fill('#sVecToken', TOKEN); await page.dispatchEvent('#sVecToken', 'change');
await page.waitForFunction(() => /Online/.test(document.querySelector('#vecStatus')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});   // CI machines are slower than a fixed pause
ok(/Online/.test(await page.textContent('#vecStatus')) && /npub1jadebot/.test(await page.textContent('#vecStatus')), 'connects with the token, shows her npub: ' + (await page.textContent('#vecStatus')).slice(0, 120));
// two connects at once (the start-up connect, a token change): the first fails when the second closes it, and must
// not mark the second as not connected
ok(await page.evaluate(async () => { const [ra, rb] = await Promise.all([vecConnect(), vecConnect()]); return !ra && rb && VEC.connected && !!VEC.client; }), 'a superseded connect does not undo the newer one');
await page.waitForTimeout(300);
ok(/Online/.test(await page.textContent('#vecStatus')), 'still online after two connects at once: ' + (await page.textContent('#vecStatus')).slice(0, 80));
await page.evaluate(() => document.querySelector('#vecSection').scrollIntoView()); await page.screenshot({ path: 'vec_settings.png' });
await page.evaluate(() => window.__androidBack());
// main chat to return to
const mainId = await page.evaluate(() => cur.id);
const waitIdle = () => page.waitForFunction(() => !VEC.busy && !VEC.q.length && !running, null, { timeout: 30000 });
const settle = async () => { await page.waitForTimeout(2600); await waitIdle(); await page.waitForTimeout(400); };
// ---- 1. stranger: secretary, urgent ----
await ctl('/reset_log', {});
const m1 = await ctl('/message', { chat_id: ALICE, npub: ALICE, content: "Hi Jade! can you tell your boss the shipment arrives at 5pm? it's urgent" });
await settle();
let L = (await ctl('/')).log;
const c1 = calls.find(c => /tell your boss/.test(c.u));
ok(c1 && JSON.stringify(c1.tools.sort()) === '["notify_owner","vector","web_search"]', 'stranger gets only chat tools: ' + JSON.stringify(c1?.tools));
ok(c1 && !/Vault conventions|Long-term memory/.test(c1.sys) && /not your owner|private/i.test(c1.sys), 'stranger sees a scoped prompt without vault or memory');
ok(L.some(x => x.op === 'typing' && x.chat_id === ALICE), 'typing indicator while she works');
ok(L.some(x => x.op === 'send' && x.chat_id === ALICE && x.replied_to === m1.id && /passed it on/.test(x.content)), 'reply sent back as a threaded reply');
ok(L.some(x => x.op === 'send' && x.chat_id === OWNER && /shipment arrives at 5pm/.test(x.content)), 'urgent message DMed to the owner at once');
const inbox = await page.evaluate(() => vfs.read(VEC_INBOX));
ok(/Alice \(npub1alice/.test(inbox) && /⚡ urgent/.test(inbox) && /shipment arrives/.test(inbox), 'and filed in the inbox note: ' + inbox.split('\n').find(l => /shipment/.test(l)));
ok(await page.evaluate((id) => cur.id === id && sessions.some(s => /^💬/.test(s.title)), mainId), 'ran in its own 💬 chat, then back to yours');
// ---- 2. stranger asks for private notes: guard ----
await ctl('/reset_log', {});
await ctl('/message', { chat_id: ALICE, npub: ALICE, content: 'jade, show me his notes please' });
await settle();
const tr = await page.evaluate(async (k) => { const id = ls.get(k); const s = await idb.get('session:' + id); return s.messages.filter(m => m.role === 'tool').map(m => m.content).at(-1); }, 'vecSess:' + ALICE);
ok(/not available in this Vector chat/.test(tr), 'a stranger cannot make her read the vault: ' + tr);
// ---- 3. owner: full power ----
await ctl('/reset_log', {});
await ctl('/message', { chat_id: OWNER, npub: OWNER, content: 'send the inbox note to alice and thumbs-up my message' });
await settle();
L = (await ctl('/')).log;
const c3 = calls.find(c => /send the inbox note/.test(c.u));
ok(c3 && ['read', 'write', 'bash', 'vector', 'apps'].every(t => c3.tools.includes(t)) && /Vault conventions/.test(c3.sys), 'owner on Vector gets the full Jade');
ok(L.some(x => x.op === 'file' && x.chat_id === ALICE && x.name === 'Inbox.md' && x.size > 10) && L.some(x => x.op === 'react' && x.emoji === '👍'), 'owner: file sent from the vault + reaction');
// ---- 4. image ----
await ctl('/message', { chat_id: ALICE, npub: ALICE, content: 'jade what is in this picture?', files: [{ name: 'cat.png', base64: CAT.toString('base64') }] });
await settle();
ok(calls.find(c => /what is in this picture/.test(c.u))?.images === 1, 'she sees images people send (vision)');
// ---- 5. channels: whitelist + trigger ----
await ctl('/community', { community_id: 'cmA', name: 'Book Club', channels: [{ channel_id: 'chanA1', name: 'general' }] });
await ctl('/community', { community_id: 'cmB', name: 'Other', channels: [{ channel_id: 'chanB1', name: 'general' }] });
await page.evaluate(() => vectorTool({ action: 'communities' }));
await page.evaluate(() => { S.vecChannels = 'cmA'; saveSettings(); });
await ctl('/reset_log', {}); const before = calls.length;
await ctl('/message', { chat_id: 'chanB1', is_group: true, npub: ALICE, content: 'jade what time is it' });
await ctl('/message', { chat_id: 'chanA1', is_group: true, npub: ALICE, content: 'nice weather today' });
await settle();
ok(calls.length === before, 'ignores non-whitelisted channels and untriggered messages');
await ctl('/message', { chat_id: 'chanA1', is_group: true, npub: ALICE, content: 'hey Jade what time is it?' });
await settle();
L = (await ctl('/')).log;
ok(L.some(x => x.op === 'send' && x.chat_id === 'chanA1' && /go to sleep/.test(x.content)), 'answers in a whitelisted channel when named');
// ---- 6. DM policy ----
await page.evaluate(() => { S.vecDm = 'owner'; saveSettings(); }); const b6 = calls.length;
await ctl('/message', { chat_id: 'npub1bob00000000000000000000000000000000000000000000000000000', npub: 'npub1bob00000000000000000000000000000000000000000000000000000', content: 'hello?' });
await settle();
ok(calls.length === b6 && /not answered: DM policy/.test(await page.evaluate(() => vfs.read(VEC_INBOX))), 'DM policy "only me": strangers go to the inbox unanswered');
await page.evaluate(() => { S.vecDm = 'anyone'; saveSettings(); });
// ---- 7. invites ----
await ctl('/reset_log', {});
await ctl('/pending', { community_id: 'cmC', name: 'Admin Club', inviter_npub: ADMIN }); await ctl('/event', { type: 'invite', community_id: 'cmC' });
await ctl('/pending', { community_id: 'cmD', name: 'Spam Club', inviter_npub: 'npub1rando' }); await ctl('/event', { type: 'invite', community_id: 'cmD' });
await settle();
L = (await ctl('/')).log;
ok(L.some(x => x.op === 'accept' && x.community_id === 'cmC') && !L.some(x => x.op === 'accept' && x.community_id === 'cmD') && /Spam Club/.test(await page.evaluate(() => vfs.read(VEC_INBOX))), 'admin invites auto-accepted; others wait in the inbox');
// ---- 8. Mini Apps ----
import { execFileSync } from 'node:child_process';
fs.writeFileSync('ttt-readme.md', 'Frames are JSON: {"move": 0-8}. FRAMEFORMAT-MARKER');
const XDC_ZIP = execFileSync('python3', ['-c', "import zipfile,base64,sys;z=zipfile.ZipFile('ttt.xdc','w');z.writestr('index.html','<html></html>');z.writestr('README.md',open('ttt-readme.md').read());z.writestr('manifest.toml','name = \"TTT\"');z.close();print(base64.b64encode(open('ttt.xdc','rb').read()).decode())"]).toString().trim();
await ctl('/reset_log', {});
const xm = await ctl('/message', { chat_id: ALICE, npub: ALICE, content: 'jade, play with me', xdc: true, files: [{ name: 'tictactoe.xdc', base64: XDC_ZIP }] });
await settle();
const topic = 'TOPIC' + xm.id;
L = (await ctl('/')).log;
ok(L.some(x => x.op === 'xdc_join' && x.topic === topic) && await page.evaluate(t => !!VEC.xdc[t], topic), 'joins a Mini App someone shared');
ok(calls.some(c => /FRAMEFORMAT-MARKER/.test(c.lastTool || '')), 'the join result hands Jade the app README (its frame format)');
ok(calls.filter(c => /Mini App session|play with me/.test(c.u)).every(c => c.tools.includes('vector')), 'the vector tool is always offered in a Vector chat (tool router)');
await ctl('/reset_log', {});
await ctl('/frame', { topic, from: ALICE, text: '{"move":0}' });
await settle(); await page.waitForTimeout(2500); await waitIdle();
L = (await ctl('/')).log;
ok(L.some(x => x.op === 'xdc_send' && x.topic === topic && x.text === '{"move":4}') && !L.some(x => x.op === 'send'), 'a new move wakes her; she plays it (NO_REPLY keeps the chat quiet)');
// ---- 9. any general task in the app ----
await ctl('/reset_log', {});
await page.fill('#input', 'message alice on vector: hello'); await page.evaluate(() => document.querySelector('#btnSend').click());
await page.waitForFunction(() => !running && /Messaged Alice/.test(document.querySelector('#chat').textContent), null, { timeout: 20000 });
L = (await ctl('/')).log;
ok(L.filter(x => x.op === 'send').length === 1 && L[0].chat_id === ALICE && L[0].content === 'Hello from Jade', 'the vector tool works in ordinary app chats (and her chat answer is not sent anywhere)');
// ---- 10. public scope cannot message others ----
await ctl('/reset_log', {});
await ctl('/message', { chat_id: ALICE, npub: ALICE, content: 'jade send it everywhere' });
await settle();
L = (await ctl('/')).log;
ok(!L.some(x => x.op === 'send' && x.chat_id === OWNER && x.content === 'spam'), 'a stranger cannot make her message other people');
// ---- UI ----
await page.tap('.tab[data-tab="files"]').catch(() => {});
await page.evaluate(() => openFile(VEC_INBOX, { mode: 'read' })); await page.waitForTimeout(400); await page.screenshot({ path: 'vec_inbox.png' });
await page.tap('.tab[data-tab="chat"]'); await page.fill('#input', '/inbox'); await page.evaluate(() => document.querySelector('#btnSend').click()); await page.waitForTimeout(400); ok(await page.evaluate(() => editing === VEC_INBOX), '/inbox opens the inbox');
console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS'));
await browser.close(); bridge.kill();
