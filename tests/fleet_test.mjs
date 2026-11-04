// Jade Fleet: two clients (browser pages of dist/jade-fleet.html, served by a real jade-fleet broker) share one vault on
// the broker, run real bash there, and reach the models through it. The model machine (the Xavier) is a stand-in here.
// Needs the broker binary: JF_BIN, or a built jade-fleet checkout next to this repository (cargo build). Skipped without.
import pw from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const done = (code) => { for (const l of log) console.log(l); for (const l of fail) console.log(l); console.log(fail.length ? `${fail.length} FAILED` : 'ALL PASS'); process.exit(code ?? (fail.length ? 1 : 0)); };
const BIN = [process.env.JF_BIN, path.join(ROOT, '..', 'jade-fleet', 'target', 'debug', 'jade-fleet'), path.join(ROOT, '..', '..', 'jade-fleet', 'target', 'debug', 'jade-fleet'), '/home/claude/jade-fleet/target/debug/jade-fleet'].find(p => p && fs.existsSync(p));
if (!BIN) { console.log('NOTE: no jade-fleet broker binary (set JF_BIN); the fleet test is skipped'); console.log('ALL PASS'); process.exit(0); }
const PAGE = path.join(ROOT, 'dist', 'jade-fleet.html');
if (!fs.existsSync(PAGE)) { console.log('FAIL dist/jade-fleet.html is missing: run the build'); process.exit(1); }

// ---------------------------------------------------------------- stand-in for the Xavier (chat, embeddings, decisions, vision)
const seen = { auth: [], chats: [], vision: 0, decide: 0 };
const embed = (t) => { const v = new Array(64).fill(0); for (const w of String(t).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !['search_query', 'search_document', 'search', 'query', 'document'].includes(w))) { let h = 2166136261; for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; v[h % 64] += 1; } const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
const xavier = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    seen.auth.push(req.headers.authorization || null);
    const j = (o, st = 200) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = req.url.split('?')[0];
    if (u === '/api/embed') { const b = JSON.parse(body); return j({ embeddings: b.input.map(embed) }); }
    if (u === '/api/tags') return j({ models: [{ name: 'nomic-embed-text' }, { name: 'laya' }] });
    if (u === '/v1/models') return j({ object: 'list', data: [{ id: 'gemma4-e2b-custom', object: 'model' }] });
    if (u === '/v1/systemone') { const q = JSON.parse(body).questions.q; if (q.type === 'choice') { seen.route = (seen.route || 0) + 1; const pick = /code/.test(JSON.parse(body).state) ? q.criteria[1] : q.criteria[0]; return j({ model: 'laya', answers: { q: { choice: pick, confidence: 0.8, probabilities: {} } } }); } seen.decide++; return j({ model: 'laya', answers: { q: { type: 'noul', noul: true, confidence: 0.93, probabilities: { true: 0.93, false: 0.07 } } } }); }
    if (u.startsWith('/v1/vision/')) { seen.vision++; return j({ ok: true, model: 'yolov8n', width: 640, height: 480, device: 'DLA0', ms: { total: 4.2 }, detections: [{ label: 'person', class_id: 0, confidence: 0.91, box: [10, 20, 110, 220] }], top: [{ label: 'tabby cat', class_id: 281, prob: 0.8 }] }); }
    if (u === '/v1/chat/completions') {
      const b = JSON.parse(body); seen.chats.push(b);
      const last = [...b.messages].reverse().find(m => m.role === 'user'); const text = 'Fleet reply: ' + String(typeof last.content === 'string' ? last.content : JSON.stringify(last.content)).replace(/^\[[^\]]*\]\s*/, '');
      if (!b.stream) return j({ choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const w of text.split(/(?<= )/)) res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: w } }] }) + '\n\n');
      res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'); return res.end();
    }
    j({ error: 'not here' }, 404);
  });
});
await new Promise(r => xavier.listen(0, '127.0.0.1', r));
const X = `http://127.0.0.1:${xavier.address().port}`;

// ---------------------------------------------------------------- the broker
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jadefleet-'));
const web = path.join(tmp, 'web'); fs.mkdirSync(web); fs.copyFileSync(PAGE, path.join(web, 'index.html'));
const VAULT = path.join(tmp, 'vault');
const port = 20000 + Math.floor(Math.random() * 20000);
const TOKEN = 'fleet-test-token';
const broker = spawn(BIN, [], { env: { ...process.env, FLEET_BIND: `127.0.0.1:${port}`, FLEET_DATA: path.join(tmp, 'data'), FLEET_VAULT: VAULT, FLEET_WEB: web, FLEET_TOKEN: TOKEN,
  OLLAMA_URL: X, OLLAYA_URL: X, LLM_URL: X + '/v1', VISION_URL: X, EMBED_MODEL: 'nomic-embed-text', EMBED_DIM: '64', FLEET_LOG: 'jade_fleet=warn' }, stdio: ['ignore', 'pipe', 'pipe'] });
// its own pipes: a broker that outlived the test must not keep the test runner waiting on ours
broker.stdout.on('data', d => process.stdout.write(d)); broker.stderr.on('data', d => process.stderr.write(d));
const B = `http://127.0.0.1:${port}`;
for (let i = 0; ; i++) { try { if ((await fetch(B + '/health')).ok) break; } catch {} if (i > 100) { console.log('FAIL the broker did not start'); broker.kill(); process.exit(1); } await new Promise(r => setTimeout(r, 100)); }
const cleanup = () => { try { broker.kill('SIGKILL'); } catch {} xavier.close(); };
process.on('exit', cleanup);

const browser = await pw.chromium.launch();
const open = async (device, token = TOKEN) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (token) await ctx.addInitScript(({ device, token, B }) => { if (!localStorage.getItem('jadeFleet')) localStorage.setItem('jadeFleet', JSON.stringify({ url: B, token, device })); }, { device, token, B });
  const page = await ctx.newPage();
  page.on('pageerror', e => fail.push(`[pageerror ${device}] ` + e.message));
  await page.goto(B + '/');
  return page;
};
const E = (p, fn, arg) => p.evaluate(fn, arg);
const waitFor = async (p, fn, arg, ms = 8000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

try {
  // --- connecting: no token yet → the connect screen
  const g = await open('gamma', null);
  ok(await waitFor(g, () => !!document.getElementById('fleetGate')), 'without a token the page asks to connect');
  ok(await E(g, () => location.origin === document.getElementById('fgUrl').value), 'the broker that served the page is the default address');
  await g.fill('#fgTok', 'wrong'); await g.click('#fleetForm button');
  ok(await waitFor(g, () => /not accepted/.test(document.getElementById('fgNote').textContent)), 'a wrong token is refused');
  await g.fill('#fgTok', TOKEN); await g.fill('#fgDev', 'gamma'); await g.click('#fleetForm button');
  ok(await waitFor(g, () => window.FLEET?.on && typeof vfs !== 'undefined' && vfs.nodes.size > 1 && FLEET.online, null, 15000), 'after connecting, the page loads the fleet vault');
  ok(fs.existsSync(path.join(VAULT, 'Welcome.md')) && fs.readdirSync(VAULT).length > 3, 'the first client seeded the shared vault on the broker: ' + fs.readdirSync(VAULT).join(', '));
  await g.context().close();

  // --- two phones on one vault
  const a = await open('alpha'); const b = await open('beta');
  ok(await waitFor(a, () => FLEET.online && vfs.nodes.size > 1, null, 15000) && await waitFor(b, () => FLEET.online && vfs.nodes.size > 1, null, 15000), 'two clients connected');
  ok(await E(a, () => document.getElementById('txtFleet')?.textContent.startsWith('FLEET')), 'the fleet chip shows the connection');
  await E(a, () => { vfs.write('/Trips/Lisbon.md', '# Lisbon\n\nTram 28 to Alfama, pasteis de nata in Belem.', { mkdirs: true }); vfs.flush(true); });
  ok(fs.readFileSync(path.join(VAULT, 'Trips', 'Lisbon.md'), 'utf8').startsWith('# Lisbon'), 'a note written on alpha is a file on the broker');
  ok(await waitFor(b, () => vfs.isFile('/Trips/Lisbon.md') && vfs.read('/Trips/Lisbon.md').includes('Tram 28')), 'beta sees it live, without reloading');
  await E(b, () => { vfs.write('/Trips/Lisbon.md', vfs.read('/Trips/Lisbon.md') + '\nBeta was here.'); vfs.flush(true); });
  ok(await waitFor(a, () => vfs.read('/Trips/Lisbon.md').includes('Beta was here.')), "alpha sees beta's change");
  fs.writeFileSync(path.join(VAULT, 'from-optiplex.md'), 'written on the server');
  ok(await waitFor(a, () => vfs.isFile('/from-optiplex.md') && vfs.read('/from-optiplex.md') === 'written on the server'), 'a file made on the server itself reaches the phones');
  await E(a, () => { vfs.rm('/from-optiplex.md'); vfs.flush(true); });
  ok(await waitFor(b, () => !vfs.exists('/from-optiplex.md')) && !fs.existsSync(path.join(VAULT, 'from-optiplex.md')), 'a delete reaches the server and the other phone');
  ok(await E(a, () => [...vfs.nodes.values()].filter(n => n._d).length > 3), 'notes were fetched in bulk at start');

  // --- real bash on the broker
  const out = await E(a, () => runTool('bash', { command: 'echo dev=$JADE_DEVICE; python3 -c "print(6*7)"; for i in 1 2 3; do printf %s $i; done; echo; ls Trips; echo made > bash-made.txt' }));
  ok(/dev=alpha/.test(out) && /\b42\b/.test(out) && /123/.test(out) && /Lisbon\.md/.test(out), 'the bash tool runs real bash with python3 on the broker:\n' + out.slice(0, 200));
  ok(fs.readFileSync(path.join(VAULT, 'bash-made.txt'), 'utf8') === 'made\n' && await waitFor(b, () => vfs.isFile('/bash-made.txt')), "a command's file is in the shared vault, seen by beta");
  const code = await E(a, () => runTool('bash', { command: 'echo oops >&2; exit 4' }));
  ok(/oops/.test(code) && /exited with code 4/.test(code), 'errors and exit codes come back: ' + code.replace(/\n/g, ' '));
  const nd = await E(a, () => runTool('bash', { command: `node -e "console.log(require('fs').readFileSync('Trips/Lisbon.md','utf8').split('\\n')[0])"` }));
  ok(/# Lisbon/.test(nd), 'node is the server\'s real node: ' + nd.trim());
  const cwd = await E(a, async () => { const sh = new Shell({}); await sh.run('mkdir -p proj/x && cd proj'); const r = await sh.run('cd x; ls ..'); return { cwd: sh.cwd, out: r.chunks.map(c => c.s).join('') }; });
  ok(cwd.cwd === '/proj/x' && /x/.test(cwd.out), 'the shell keeps its folder between commands: ' + JSON.stringify(cwd));
  const loc = await E(a, async () => { const sh = new Shell({}); const r = await sh.run('search Lisbon'); return r.chunks.map(c => c.s).join(''); });
  ok(/Lisbon/.test(loc), 'vault commands like search still run in the page');
  const t0 = Date.now(); const to = await E(a, () => runTool('bash', { command: 'sleep 20', timeout: 1 }));
  ok(/timed out/.test(to) && Date.now() - t0 < 8000, 'a time limit stops the command on the server');

  // --- the terminal: xterm is in the page now, so it is a real pseudo-terminal on the broker
  ok(await waitFor(a, () => FLEET.pty.live, null, 8000), 'the terminal is a live shell on the broker');
  await E(a, () => FLEET.ptyLine('echo pty-$((6*7)) && cd Trips && pwd'));
  ok(await waitFor(a, () => { const b = term._t.buffer.active; let txt = ''; for (let i = 0; i < b.length; i++) txt += (b.getLine(i)?.translateToString(true) || '') + '\n'; return /pty-42/.test(txt) && /\/Trips/.test(txt); }, null, 8000), 'typing into it runs bash there (echo, cd)');
  ok(await E(a, () => /SH/.test(document.getElementById('txtFleet').textContent)), 'the chip shows the shell is connected');

  // --- the models through the broker
  ok(await waitFor(a, () => S.provider === 'llamacpp' && S.lcppHost === location.origin && S.ollayaHost === location.origin + '/ollaya' && S.model === 'gemma4-e2b-custom'), 'the first connection points the models at the broker');
  await a.fill('#input', 'hello fleet'); await E(a, () => document.querySelector('#btnSend').click());
  ok(await waitFor(a, () => !running && cur && cur.messages.at(-1)?.role === 'assistant' && /Fleet reply: hello fleet/.test(cur.messages.at(-1).content), null, 20000), 'a chat reply comes from the Xavier through the broker');
  const dec = await E(a, async () => (await decideData({ state: 'server on fire', question: 'Urgent?', type: 'yesno' })).result);
  ok(dec === true && seen.decide === 1, 'decisions go through the broker to Ollaya');
  // the model router: laya (through the broker) picks the model for each message, the chat goes through the broker
  await E(a, () => { Object.assign(S, { routerOn: true, routerModels: [{ prov: 'llamacpp', model: 'gemma4-e2b-custom', note: 'quick chat' }, { prov: 'llamacpp', model: 'big-coder', note: 'coding' }] }); saveSettings(); });
  const c0 = seen.chats.length;
  await a.fill('#input', 'write code please'); await E(a, () => document.querySelector('#btnSend').click());
  ok(await waitFor(a, () => !running && /Fleet reply: write code/.test(cur.messages.at(-1)?.content || ''), null, 20000) && seen.chats.length === c0 + 1 && seen.chats.at(-1).model === 'big-coder' && seen.route === 1, 'the router picks the model through the broker: ' + seen.chats.at(-1)?.model);
  await E(a, () => { S.routerOn = false; saveSettings(); });
  ok(seen.auth.every(x => x == null), 'the fleet token never reaches the Xavier');

  // --- the fleet's own tools
  await new Promise(r => setTimeout(r, 1500));   // the broker indexes notes in the background
  const vs = await E(a, () => runTool('vault_search', { query: 'tram alfama' }));
  ok(/\/Trips\/Lisbon\.md/.test(vs), 'vault_search finds notes by meaning across the fleet:\n' + vs.slice(0, 160));
  await E(a, () => { vfs.write('/attachments/street.png', new Uint8Array([137, 80, 78, 71, 1, 2, 3]), { mkdirs: true }); vfs.flush(true); });
  const vi = await E(a, () => runTool('vision', { action: 'detect', path: '/attachments/street.png' }));
  ok(/person 91% at \[10, 20, 110, 220\]/.test(vi) && seen.vision === 1, 'vision sends the image to the Xavier and reads the result:\n' + vi);
  ok(await E(a, () => activeTools().some(t => t.function.name === 'vault_search') && activeTools().some(t => t.function.name === 'vision')), 'the fleet tools are offered to the model');
  ok(await E(a, () => /real bash shell on the fleet/.test(systemPrompt()) && !/BusyBox 1\.37 \(WebAssembly\)/.test(systemPrompt())), "Jade's instructions describe the fleet's shell");

  // --- the broker goes away: the page says so instead of using a local vault
  broker.kill(); await new Promise(r => setTimeout(r, 500));
  ok(await waitFor(a, () => /OFFLINE/.test(document.getElementById('txtFleet').textContent)), 'the chip shows the fleet offline');
  const c = await browser.newContext(); await c.addInitScript(({ B, TOKEN }) => localStorage.setItem('jadeFleet', JSON.stringify({ url: B, token: TOKEN, device: 'delta' })), { B, TOKEN });
  const d = await c.newPage(); await d.goto('file://' + PAGE);
  ok(await waitFor(d, () => /could not reach the fleet/.test(document.getElementById('fleetGate')?.textContent || '')), 'a client that cannot reach the broker says so and offers to retry');
} catch (e) { fail.push('[error] ' + (e.stack || e)); }
await browser.close();
cleanup();
done();
