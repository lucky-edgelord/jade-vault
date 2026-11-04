import { autoTabs } from './_tabs.mjs';
import pw from 'playwright';
import fs from 'node:fs';
const { chromium } = pw;
const URL_ = process.argv[2] || 'file://' + process.env.JV_WEB;
const css = fs.readFileSync('tw.css', 'utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'America/Detroit' });
await ctx.addInitScript(() => { try { if (window !== window.top) return; } catch {} if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ model: 'qwen3:8b', journalOn: false })); });
const page = autoTabs(await ctx.newPage());
page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
const CAT = fs.readFileSync('xdcfix/cat.png'); const apiSeen = []; let chatStep = 0;
await ctx.route('**/*', async route => {
  const req = route.request(); const url = req.url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  if (url.startsWith('https://api.example.com/')) {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    apiSeen.push({ method: req.method(), url, auth: req.headers()['authorization'], ct: req.headers()['content-type'], body: req.postData() });
    return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: true, echo: req.headers()['authorization'] || '', got: (() => { try { return JSON.parse(req.postData()); } catch { return req.postData(); } })() }) });
  }
  if (url === 'https://img.example.com/cat.png') return route.fulfill({ headers: CORS, contentType: 'image/png', body: CAT });
  if (url === 'https://dl.example.com/test-list.xdc') return route.fulfill({ headers: CORS, contentType: 'application/octet-stream', body: fs.readFileSync('xdcfix/test-list.xdc') });
  if (url === 'http://localhost:11434/api/tags') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
  if (url === 'http://localhost:11434/api/chat') {
    const b = JSON.parse(req.postData()); if (!b.stream) return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: { role: 'assistant', content: 'SUMMARY:\n- x\nREMEMBER:\n- none' }, done: true }) });
    const n = b.messages.filter(m => m.role === 'tool').length - (b.messages.findLastIndex(m => m.role === 'user') > 0 ? 0 : 0);
    const lastUser = b.messages.findLastIndex(m => m.role === 'user'); const k = b.messages.slice(lastUser).filter(m => m.role === 'tool').length;
    const steps = [{ tool_calls: [{ function: { name: 'apps', arguments: { action: 'read', app: 'Test List' } } }] }, { tool_calls: [{ function: { name: 'apps', arguments: { action: 'send', app: 'Test List', payload: { text: 'jade was here', by: 'jade@jade.vault' }, summary: 'Jade joined' } } }] }, { content: 'Added my item. Here is a cat: ![[cat.png|50]]' }];
    const step = steps[Math.min(k, 2)]; globalThis.__lastTools = b.tools.map(t => t.function.name);
    return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: JSON.stringify({ message: { role: 'assistant', content: step.content || '', ...(step.tool_calls ? { tool_calls: step.tool_calls } : {}) }, done: false }) + '\n' + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n' });
  }
  return route.abort();
});
await page.goto(URL_);
await page.waitForFunction(() => typeof appsTool === 'function' && typeof userShell !== 'undefined', null, { timeout: 90000 });
await page.waitForTimeout(1000);
const sh = async (cmd) => page.evaluate(async (cmd) => { const s = new (Object.getPrototypeOf(userShell).constructor)({}); s.timeoutMs = 8000; const r = await s.run(cmd); return { out: r.chunks.filter(c => !c.err).map(c => c.s).join(''), err: r.chunks.filter(c => c.err).map(c => c.s).join(''), code: r.code }; }, cmd);
// ============ HTTP ============
await page.evaluate(() => openSettings()); await page.waitForTimeout(300);
await page.fill('#sSecretName', 'ALLAPI_KEY'); await page.fill('#sSecretValue', 'sk-secret-123'); await page.click('#btnSecretAdd');
ok(await page.evaluate(() => S.secrets.ALLAPI_KEY === 'sk-secret-123' && /\{\{ALLAPI_KEY\}\}/.test(document.querySelector('#secretList').textContent) && !/sk-secret/.test(document.querySelector('#secretList').textContent)), 'secret saved from Config, value hidden');
await page.evaluate(() => window.__androidBack());
let r = await page.evaluate(() => runTool('http_request', { method: 'POST', url: 'https://api.example.com/v1/compose', headers: { Authorization: 'Bearer {{ALLAPI_KEY}}' }, json: { prompt: 'hi', n: 2 } }));
ok(apiSeen[0]?.method === 'POST' && apiSeen[0].auth === 'Bearer sk-secret-123' && apiSeen[0].ct === 'application/json' && JSON.parse(apiSeen[0].body).n === 2, 'POST JSON with secret header: ' + JSON.stringify(apiSeen[0]));
ok(/^HTTP 200/.test(r) && /"ok": true/.test(r) && /Bearer \{\{ALLAPI_KEY\}\}/.test(r) && !/sk-secret/.test(r), 'result pretty JSON, secret echo redacted: ' + r.slice(0, 160).replace(/\n/g, ' | '));
r = await page.evaluate(() => runTool('http_request', { method: 'PUT', url: 'https://api.example.com/v1/form', form: { a: 'b c' } }));
ok(apiSeen[1]?.method === 'PUT' && apiSeen[1].ct === 'application/x-www-form-urlencoded' && apiSeen[1].body === 'a=b+c', 'form bodies');
r = await page.evaluate(() => runTool('http_request', { url: 'https://img.example.com/cat.png' }));
ok(/Saved .* \(image\/png\) to \/attachments\/http\/\d{4}-\d\d-\d\d\/cat\.png/.test(r) && /!\[\[/.test(r), 'binary response saved to vault: ' + r.split('\n').pop());
r = await page.evaluate(() => runTool('http_request', { method: 'GET', url: 'https://api.example.com/x', body: 'nope' }).catch(e => 'ERR ' + e.message));
ok(/ERR GET requests cannot have a body/.test(r), 'GET with body explained');
ok(await page.evaluate(() => /http_request: call APIs[^\n]*\{\{ALLAPI_KEY\}\}/.test(systemPrompt())), 'prompt lists secret names only');
// node networking
r = await sh(`node -e "const https = require('https'); const req = https.request('https://api.example.com/v1/node', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.ALLAPI_KEY } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => console.log(res.statusCode, d)); }); req.write(JSON.stringify({ a: 1 })); req.end();"`);
ok(/^200 /.test(r.out) && /\{\{ALLAPI_KEY\}\}/.test(r.out) && !/sk-secret/.test(r.out) && apiSeen.at(-1).auth === 'Bearer sk-secret-123', 'node https.request POST with process.env secret (output redacted): ' + JSON.stringify(r).slice(0, 200));
r = await sh(`node -e "fetch('https://api.example.com/v1/f', { method: 'POST', body: JSON.stringify({ q: 1 }) }).then(r => r.json()).then(j => console.log('ok=' + j.ok + ' got=' + j.got.q))"`);
ok(r.out.trim() === 'ok=true got=1', 'node global fetch (un-awaited) completes: ' + JSON.stringify(r));
r = await sh(`node -e "console.log(Buffer.from('hi').toString('base64'), Buffer.concat([Buffer.from('a'), Buffer.from('b')]).toString())"`);
ok(r.out.trim() === 'aGk= ab', 'Buffer basics');
// ============ IMAGES ============
await page.evaluate(() => {
  vfs.write('/attachments/images/cat.png', Uint8Array.from(atob(window.__cat), c => c.charCodeAt(0)), { mkdirs: true });
}).catch(() => {});
await page.evaluate((b64) => { vfs.write('/attachments/images/cat.png', Uint8Array.from(atob(b64), c => c.charCodeAt(0)), { mkdirs: true }); vfs.write('/Pics.md', '# Pics\n\n![[cat.png|120]]\n\nInline ![a cat](attachments/images/cat.png) and ![gone](nope.png).\n\n![[Inbox]]\n\n![web](https://img.example.com/cat.png)\n'); }, CAT.toString('base64'));
await page.evaluate(() => openFile('/Pics.md', { mode: 'read' })); await page.waitForTimeout(800);
const im = await page.evaluate(() => [...document.querySelectorAll('#notePrev img')].map(i => ({ src: i.src.slice(0, 5), w: i.getAttribute('width'), nat: i.naturalWidth, miss: i.classList.contains('missing') })));
ok(im.length === 4 && im[0].src === 'blob:' && im[0].w === '120' && im[0].nat === 40 && im[1].src === 'blob:' && im[1].nat === 40 && im[2].miss && im[3].src === 'https', 'note renders ![[..|width]], ![](path), missing, web: ' + JSON.stringify(im));
ok(await page.evaluate(() => /Inbox/.test(document.querySelector('#notePrev .note-embed')?.textContent || '')), '![[Note]] embeds the note');
ok(await page.evaluate(() => ![...(vaultIndex().missing.get('/Pics.md') || [])].some(x => /cat/.test(x))), 'image embeds are not counted as missing links');
await page.screenshot({ path: 'img_note.png' });
await page.evaluate(() => document.querySelector('#notePrev img').click()); await page.waitForTimeout(200);
ok(await page.evaluate(() => !!document.querySelector('.lightbox img') && window.__androidBack() && !document.querySelector('.lightbox')), 'tap opens full screen, Back closes it');
// insert a big photo: scaled down
const ins = await page.evaluate(async () => {
  setNoteMode('split'); const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); const d = g.createImageData(3000, 2000); for (let i = 0; i < d.data.length; i++) d.data[i] = (i * 2654435761) >>> 24; g.putImageData(d, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95)); const f = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  await addImagesToNote([f]); const p = '/attachments/images/photo.jpg'; const bmp = await createImageBitmap(new Blob([vfs.readBytes(p)]));
  return { big: blob.size, small: vfs.readBytes(p).length, w: bmp.width, h: bmp.height, text: document.querySelector('#fileEd').value.slice(-60), saved: vfs.read('/Pics.md').slice(-40) };
});
ok(ins.w === 1800 && ins.h === 1200 && ins.small < ins.big && /!\[\[photo\.jpg\]\]/.test(ins.text), 'inserted photo scaled to 1800px and embedded: ' + JSON.stringify(ins));
await page.evaluate(() => openFile('/attachments/images/cat.png')); await page.waitForTimeout(400);
ok(await page.evaluate(() => document.querySelector('#notePrev .image-file img')?.naturalWidth === 40), 'opening an image file shows it: ' + await page.evaluate(() => document.querySelector('#noteBody').dataset.mode + ' ' + document.querySelector('#notePrev').innerHTML.slice(0, 200)));
ok(/binary file .*cat\.png/.test(await page.evaluate(() => runTool('read', { path: '/attachments/images/cat.png' }))), 'read tool does not dump image bytes');
// ============ WEBXDC ============
await page.tap('.tab[data-tab="apps"]'); await page.waitForTimeout(300);
await page.waitForFunction(() => XDC.apps.some(a => a.name === 'Jade Link') && XDC.apps.some(a => a.name === 'Vault Loci') && document.querySelectorAll('.app-tile').length === 2, null, { timeout: 10000 }).catch(() => {}); ok(await page.evaluate(() => document.querySelectorAll('.app-tile').length === 2), 'Apps tab in the bottom bar (Jade Link and Vault Loci built in)');
await page.setInputFiles('#xdcPick', { name: 'test-list.xdc', mimeType: 'application/octet-stream', buffer: fs.readFileSync('xdcfix/test-list.xdc') });
await page.waitForFunction(() => document.querySelectorAll('.app-tile').length === 3, null, { timeout: 10000 });
ok(await page.evaluate(() => { const t = [...document.querySelectorAll('.app-tile')].find(x => /Test List/.test(x.textContent)); return /Test List/.test(t.textContent) && t.querySelector('img')?.src.startsWith('data:image/png'); }), 'installed from file: tile with name + icon');
await page.screenshot({ path: 'apps_tab.png' });
await page.click('.app-tile:has-text("Test List") .app-open'); await page.waitForSelector('#xdcOverlay iframe');
const fr = page.frameLocator('#xdcOverlay iframe');
await fr.locator('#ready').filter({ hasText: 'ready' }).waitFor({ timeout: 10000 });
const st = await fr.locator('body').evaluate(() => ({ g: document.getElementById('greeting').textContent, logo: document.getElementById('logo').naturalWidth, dyn: document.getElementById('dyn').naturalWidth, bg: getComputedStyle(document.body).backgroundImage.slice(0, 15), extra: getComputedStyle(document.getElementById('list')).minHeight, launches: document.getElementById('launches').textContent, addr: webxdc.selfAddr }));
ok(st.g === 'hello from json' && st.logo === 20 && st.dyn === 20 && st.bg.startsWith('url("data:') && st.extra === '20px' && st.launches === '1' && st.addr === 'you@jade.vault', 'app runs: module import, fetch(json), css + @import, img + dynamic img, localStorage: ' + JSON.stringify(st));
await fr.locator('#add').click(); await fr.locator('#add').click(); await page.waitForTimeout(400);
ok((await fr.locator('#list li').allTextContents()).join('|') === 'you@jade.vault: item 1|you@jade.vault: item 2', 'updates round-trip into the app');
ok(await page.evaluate(async () => (await XdcDB.updates(XDC.apps.find(a => a.name === 'Test List').id)).length === 2 && /2 items/.test(document.querySelector('#xdcOverlay .hud').textContent)), 'updates stored, summary shown in the bar');
ok(/blocked/.test(await fr.locator('body').evaluate(() => window.netTest())), 'apps have no internet');
await page.screenshot({ path: 'app_open.png' });
// Jade reads + sends while it is open (through the real agent loop)
await page.evaluate(() => closeApp()); await page.tap('.tab[data-tab="chat"]');
await page.fill('#input', 'join my list'); await page.evaluate(() => document.querySelector('#btnSend').click());
await page.waitForFunction(() => !running && /Added my item/.test(document.querySelector('#chat').textContent), null, { timeout: 30000 });
const tl = await page.evaluate(() => cur.messages.filter(m => m.role === 'tool').map(m => m.content));
ok(/#1 .* from you@jade\.vault[\s\S]*"text":"item 1"[\s\S]*#2/.test(tl[0]) && /Sent update #3/.test(tl[1]), 'agent read updates and sent its own: ' + JSON.stringify(tl).slice(0, 220));
ok(await page.evaluate(() => { const i = [...document.querySelectorAll('.msg-ai img.md-img')].at(-1); return i && i.src.startsWith('blob:') && i.getAttribute('width') === '50'; }), 'images render in chat replies');
await page.evaluate(() => openApp('Test List')); const fr2 = page.frameLocator('#xdcOverlay iframe');
await fr2.locator('#ready').filter({ hasText: 'ready' }).waitFor({ timeout: 10000 });
ok((await fr2.locator('#list li').allTextContents()).at(-1) === 'jade@jade.vault: jade was here' && (await fr2.locator('#launches').textContent()) === '2', 'reopened: Jade\'s update shows, localStorage persisted');
await page.evaluate(() => appsTool({ action: 'send', app: 'Test List', payload: { text: 'live', by: 'jade@jade.vault' } })); await page.waitForTimeout(300);
ok((await fr2.locator('#list li').allTextContents()).at(-1) === 'jade@jade.vault: live' && (await fr2.locator('#maxs').textContent()) === '4', 'Jade\'s update arrives live in an open app');
await fr2.locator('#share').click(); await page.waitForTimeout(800);
ok(await page.evaluate(() => !document.querySelector('#xdcOverlay') && document.querySelector('#input').value === 'my list' && /list\.txt/.test(document.querySelector('#attachBar, .att-bar, #attachments')?.textContent || document.body.innerText)), 'sendToChat drops the file + text into the composer');
// install a folder Jade wrote + from URL + export
await page.evaluate(() => { vfs.write('/Apps/src/hello/index.html', '<!doctype html><title>Hello</title><body><b id=h>hi</b><script>webxdc.setUpdateListener(u => { document.getElementById("h").textContent = u.payload.msg; });</script></body>', { mkdirs: true }); vfs.write('/Apps/src/hello/manifest.toml', 'name = "Hello Jade"\n'); });
r = await page.evaluate(() => appsTool({ action: 'install', path: '/Apps/src/hello' }));
ok(/Installed Hello Jade/.test(r), 'install from a vault folder: ' + r);
await page.evaluate(() => appsTool({ action: 'send', app: 'Hello Jade', payload: { msg: 'built by Jade' } }));
await page.evaluate(() => appsTool({ action: 'open', app: 'Hello Jade' })); await page.waitForTimeout(800);
ok((await page.frameLocator('#xdcOverlay iframe').locator('#h').textContent()) === 'built by Jade', 'Jade-built app runs and gets her update');
ok(await page.evaluate(() => window.__androidBack() && !document.querySelector('#xdcOverlay')), 'Back closes the app');
r = await page.evaluate(() => appsTool({ action: 'install', url: 'https://dl.example.com/test-list.xdc' }));
ok(/Installed Test List/.test(r) && await page.evaluate(() => vfs.isFile('/Apps/downloads/test-list.xdc')), 'install from URL: ' + r);
r = await page.evaluate(() => appsTool({ action: 'export', app: 'Hello Jade' }));
const rt = await page.evaluate(async () => { const f = await unzip(vfs.readBytes('/Apps/Hello Jade.xdc')); return Object.keys(f).sort().join(','); });
ok(rt === 'index.html,manifest.toml', 'export writes a valid .xdc: ' + rt);
r = await page.evaluate(() => appsTool({ action: 'source', app: 'Test List', file: 'main.js' }));
ok(/setUpdateListener/.test(r), 'Jade can read app source');
ok(await page.evaluate(() => /apps: webxdc apps in the Apps tab \(installed: [^)]*Test List/.test(systemPrompt()) && activeTools().some(t => t.function.name === 'apps')), 'prompt + tool list mention apps');
console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS'));
await browser.close();
