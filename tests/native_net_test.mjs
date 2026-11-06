// The phone's network in Rust, as the page sees it: fetch() to other sites goes to NetrunnerAndroid.netStart/netPoll
// (rust/android/src/net.rs; its own tests cover the HTTP itself). Here a stand-in with the same contract fetches
// through the browser, so this checks the page side: Response objects, streaming, aborts, errors, the TLS
// fallback, web_fetch turning pages into Markdown in Rust, and web tools running at the same time.
const FAKE_NET = `(() => {
  const rf = window.fetch.bind(window);
  const st = window.__net = { reqs: [], aborted: [], live: new Map(), seq: 0, tlsFail: null };
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
  Object.assign(window.NetrunnerAndroid, {
    netStart(j) {
      const r = JSON.parse(j); st.reqs.push(r); const id = ++st.seq;
      const s = { q: [], head: null, sent: false, done: false, err: null, ctrl: new AbortController() }; st.live.set(id, s);
      (async () => {
        try {
          if (st.tlsFail && r.url.includes(st.tlsFail)) throw new Error('TLS with ' + st.tlsFail + ' failed: invalid peer certificate');
          const res = await rf(r.url, { method: r.method, headers: r.headers, body: r.body ? unb64(r.body) : undefined, signal: s.ctrl.signal });
          s.head = { status: res.status, statusText: res.statusText, url: res.url || r.url, redirected: false, headers: [...res.headers] };
          const wake = () => setTimeout(() => window.__netWake && window.__netWake(), 0); wake();
          const rd = res.body.getReader(); for (;;) { const { value, done } = await rd.read(); if (done) break; s.q.push(value); wake(); }
        } catch (e) { s.err = 'Failed to fetch: ' + String(e.message || e); }
        s.done = true; setTimeout(() => window.__netWake && window.__netWake(), 0);
      })();
      return String(id);
    },
    netPoll(id) {
      const s = st.live.get(id); if (!s) return JSON.stringify({ done: true, error: 'no such request' });
      const o = {}; if (s.head && !s.sent) { o.head = s.head; s.sent = true; }
      if (s.q.length && s.sent) { const n = s.q.reduce((a, c) => a + c.length, 0); const m = new Uint8Array(n); let k = 0; for (const c of s.q.splice(0)) { m.set(c, k); k += c.length; } o.data = b64(m); }
      o.done = s.done && !s.q.length && (s.sent || !!s.err);
      if (o.done) { if (s.err) o.error = s.err; st.live.delete(id); }
      return JSON.stringify(o);
    },
    netAbort(id) { st.aborted.push(id); const s = st.live.get(id); if (s) { s.ctrl.abort(); st.live.delete(id); } },
  });
})();`;

const { start } = await import('./_harness.mjs');
const { page, ok, done, model, extraRoutes } = await start({ init: FAKE_NET });
const E = (fn, arg) => page.evaluate(fn, arg);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Expose-Headers': '*' };
const starts = {};
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Test Page</title><script>alert(1)</script></head><body><nav>Menu</nav>
<article><h1>Big news</h1><p>Some <b>bold</b> text and <a href="/x">a link</a>.</p><ul><li>one</li><li>two</li></ul><p>${'Filler sentence. '.repeat(20)}</p></article></body></html>`;
extraRoutes.push(async route => {
  const req = route.request(); const url = req.url();
  if (!/^https:\/\/(site|tls|down|slow)\.test\//.test(url)) return false;
  if (url.startsWith('https://down.test/')) { await route.abort(); return true; }
  if (url === 'https://site.test/page') { await route.fulfill({ headers: CORS, contentType: 'text/html; charset=utf-8', body: PAGE }); return true; }
  if (url === 'https://site.test/notes.txt') { await route.fulfill({ headers: CORS, contentType: 'text/plain', body: 'plain words here' }); return true; }
  if (url === 'https://site.test/echo') { await route.fulfill({ headers: { ...CORS, 'X-Echo': req.headers()['x-a'] || '' }, contentType: 'text/plain', body: req.method() + ' ' + (req.postData() || '') }); return true; }
  if (url === 'https://tls.test/ok') { await route.fulfill({ headers: CORS, contentType: 'text/plain', body: 'via the WebView' }); return true; }
  if (url.startsWith('https://slow.test/')) {
    starts[url] = Date.now(); await new Promise(r => setTimeout(r, 900));
    await route.fulfill({ headers: CORS, contentType: 'text/html', body: `<html><head><title>${url.slice(-1)}</title></head><body><main><p>Page ${url.slice(-1)} body. ${'More text. '.repeat(12)}</p></main></body></html>` }); return true;
  }
  return false;
});
await E(async () => { await RustCore.init(); });

ok(await E(() => RustCore.net), 'the page uses the native network when the phone offers it');

// plain requests: status, headers, body both ways
const echo = await E(async () => { const r = await fetch('https://site.test/echo', { method: 'POST', headers: { 'X-A': 'one', 'Content-Type': 'text/plain' }, body: 'héllo ✓' }); return { s: r.status, h: r.headers.get('x-echo'), t: await r.text(), sent: __net.reqs.at(-1) }; });
ok(echo.s === 200 && echo.t === 'POST héllo ✓' && echo.h === 'one', 'POST with a body and headers goes through and back: ' + JSON.stringify(echo.t));
ok(echo.sent.url === 'https://site.test/echo' && echo.sent.method === 'POST', 'the request reached the native side');

// errors look like the browser's, aborts work
const err = await E(async () => { try { await fetch('https://down.test/'); return 'no error'; } catch (e) { return e.name + ': ' + e.message; } });
ok(/^TypeError: Failed to fetch/.test(err), 'an unreachable site fails like fetch does: ' + err);
const ab = await E(async () => { const c = new AbortController(); setTimeout(() => c.abort(), 150); const n = __net.aborted.length; try { await fetch('https://slow.test/a', { signal: c.signal }); return 'no error'; } catch (e) { return e.name + ' ' + (__net.aborted.length > n); } });
ok(ab === 'AbortError true', 'aborting stops the native request: ' + ab);
const tls = await E(async () => { __net.tlsFail = 'tls.test'; const r = await fetch('https://tls.test/ok'); __net.tlsFail = null; return r.text(); });
ok(tls === 'via the WebView', 'a TLS failure falls back to the WebView');
const broken = await E(async () => { const real = NetrunnerAndroid.netStart; NetrunnerAndroid.netStart = () => { throw new Error('java.lang.UnsatisfiedLinkError: no jade'); }; const t = await (await fetch('https://tls.test/ok')).text(); NetrunnerAndroid.netStart = real; return t; });
ok(broken === 'via the WebView', 'if the native library cannot load, requests still go out through the WebView');
ok(await E(() => !RustCore.net), 'and the page stops trying the native side'); await E(() => RustCore.netReset());
const big = await E(async () => { const n = __net.reqs.length; const r = await fetch(new Request('https://site.test/echo', { method: 'PUT', body: 'z'.repeat(17 * 1048576) })); const t = await r.text(); return { len: t.length, native: __net.reqs.length > n }; });
ok(big.len === 4 + 17 * 1048576 && !big.native, 'a very large upload is sent by the WebView, from a Request object whose body is still intact');
const local = await E(async () => { const n = __net.reqs.length; try { await fetch(location.href); } catch {} return __net.reqs.length === n; });
ok(local, "the page's own files are not sent to the native side");

// streaming: the model's reply arrives through the native side
const n0 = await E(() => __net.reqs.length);
const send = async (t) => { const k = await E(() => cur?.messages.length || 0); await page.fill('#input', t); await E(() => document.querySelector('#btnSend').click()); await page.waitForFunction((k) => !running && cur && cur.messages.length > k + 1, k, { timeout: 30000 }); await page.waitForTimeout(200); };
await send('hello there');
const chat = await E((n0) => ({ reply: cur.messages.at(-1).content, viaNative: __net.reqs.slice(n0).some(r => r.url.endsWith('/api/chat')) }), n0);
ok(chat.reply === 'Agent says: hello there' && chat.viaNative, 'a streamed chat reply comes through the native network: ' + chat.reply);

// web_fetch: the page itself, turned into Markdown in Rust, no reader service
const wf = await E(async () => { const n = __net.reqs.length; const t = await runTool('web_fetch', { url: 'https://site.test/page' }); return { t, urls: __net.reqs.slice(n).map(r => r.url) }; });
ok(wf.t.startsWith('# Test Page') && wf.t.includes('# Big news') && wf.t.includes('[a link](https://site.test/x)') && wf.t.includes('- one\n- two'), 'web_fetch reads the page and converts it in Rust:\n' + wf.t.slice(0, 160));
ok(!wf.t.includes('Menu') && !wf.t.includes('alert'), 'navigation and scripts are left out');
// the vault may embed newly seeded notes with the local model at the same moment (/api/embed): that is not a reader
const fetched = wf.urls.filter(u => !/\/api\/embed$/.test(u));
ok(fetched.length === 1 && !fetched.some(u => /jina|ollama\.com/.test(u)), 'no third-party reader was asked: ' + wf.urls.join(', '));
ok((await E(() => runTool('web_fetch', { url: 'https://site.test/notes.txt' }))) === 'plain words here', 'plain text pages come back as they are');

// two web_fetch calls in one round run at the same time
model.chatReply = (msgs) => msgs.at(-1).role === 'user' ? { tool_calls: [{ function: { name: 'web_fetch', arguments: { url: 'https://slow.test/1' } } }, { function: { name: 'web_fetch', arguments: { url: 'https://slow.test/2' } } }] } : { content: 'Read both.' };
const t0 = Date.now();
await send('read both pages');
const took = Date.now() - t0;
const par = await E(() => { const tools = cur.messages.filter(m => m.role === 'tool').slice(-2); return tools.map(m => m.content.split('\n')[0]); });
ok(Math.abs(starts['https://slow.test/1'] - starts['https://slow.test/2']) < 400, `both pages were requested together (${Math.abs(starts['https://slow.test/1'] - starts['https://slow.test/2'])} ms apart)`);
ok(took < 2600, `the round took ${took} ms, not two waits back to back`);
ok(par[0] === '# 1' && par[1] === '# 2', 'results are recorded in the order the model asked: ' + par.join(', '));
ok(await E(() => document.querySelectorAll('.tool').length >= 2), 'each call has its card');
await done();
