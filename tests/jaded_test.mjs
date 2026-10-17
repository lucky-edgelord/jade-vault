// jaded, the native host: a real file tree under a workspace root, a real shell (streamed), the page-RPC relay for `jade`/`flow`,
// the file-change event stream and the token / Host guards. No browser; run directly against the daemon.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import http from 'node:http';
import { start } from '../native/jaded.mjs';

const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaded-root-'));
const page = path.join(root, '..', 'jaded-page-' + process.pid + '.html'); fs.writeFileSync(page, '<!doctype html><html><head><title>t</title></head><body>hi</body></html>');
const d = await start({ port: 0, root, page, token: 'tok123' });
const base = `http://127.0.0.1:${d.port}`;
const H = { 'X-Jaded-Token': 'tok123' };
const call = async (p, o = {}) => { const r = await fetch(base + p, { ...o, headers: { ...H, ...(o.headers || {}) } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, text: t, json: j }; };
const put = (p, body, q = '') => call('/fs/write?p=' + encodeURIComponent(p) + q, { method: 'PUT', body });
const exec = async (cmd, extra = {}) => {
  const r = await fetch(base + '/exec', { method: 'POST', headers: H, body: JSON.stringify({ cmd, ...extra }) });
  const lines = (await r.text()).trim().split('\n').map(l => JSON.parse(l)); const x = lines.at(-1);
  return { out: lines.filter(l => l.t === 'o').map(l => l.s).join(''), err: lines.filter(l => l.t === 'e').map(l => l.s).join(''), ...x };
};

// ---- the page and the guards
let r = await fetch(base + '/'); let t = await r.text();
ok(r.status === 200 && t.includes('window.__JADED__') && t.includes('"token":"tok123"'), 'the page is served with the token');
{ const x = await fetch(base + '/native/ping'); await x.text(); ok(x.status === 401, 'no token → 401'); }
{ const x = await fetch(base + '/native/ping', { headers: { 'X-Jaded-Token': 'nope' } }); await x.text(); ok(x.status === 401, 'wrong token → 401'); }
r = await new Promise(res => { const q = http.get({ host: '127.0.0.1', port: d.port, path: '/native/ping', headers: { Host: 'evil.example', ...H } }, x => res(x.statusCode)); });
ok(r === 421, 'a foreign Host header is refused (DNS rebinding): ' + r);
r = await call('/native/ping');
ok(r.status === 200 && r.json.name === 'jaded' && r.json.root === root && r.json.tools.node, 'ping: ' + r.text.slice(0, 120));

// ---- files
ok((await put('/Notes/a.md', '# A\nhello ünï', '&mkdirs=1')).status === 200 && fs.readFileSync(root + '/Notes/a.md', 'utf8') === '# A\nhello ünï', 'write with mkdirs creates real files');
ok((await put('/nodir/x.md', 'x')).status === 404, 'write without mkdirs into a missing dir → 404');
ok((await call('/fs/read?p=/Notes/a.md')).text === '# A\nhello ünï', 'read');
await put('/Notes/a.md', '\nmore', '&append=1');
ok((await call('/fs/read?p=/Notes/a.md')).text === '# A\nhello ünï\nmore', 'append');
r = await call('/fs/stat?p=/Notes/a.md'); ok(r.json.dir === false && r.json.size === Buffer.byteLength('# A\nhello ünï\nmore'), 'stat file');
r = await call('/fs/stat?p=/Notes'); ok(r.json.dir === true, 'stat dir');
ok((await call('/fs/stat?p=/nope')).status === 404, 'stat missing → 404');
r = await call('/fs/list?p=/Notes'); ok(r.json.length === 1 && r.json[0].name === 'a.md', 'list');
await call('/fs/mkdir?p=/x/y/z&parents=1', { method: 'POST' }); ok(fs.statSync(root + '/x/y/z').isDirectory(), 'mkdir -p');
ok((await call('/fs/mkdir?p=/x', { method: 'POST' })).status === 409, 'mkdir existing → 409');
await call('/fs/mv?from=/Notes/a.md&to=/x/y/b.md', { method: 'POST' }); ok(fs.existsSync(root + '/x/y/b.md') && !fs.existsSync(root + '/Notes/a.md'), 'move');
await call('/fs/cp?from=/x&to=/x2', { method: 'POST' }); ok(fs.existsSync(root + '/x2/y/b.md'), 'copy a tree');
r = await call('/fs/tree?p=/'); ok(r.json.some(e => e[0] === '/x2/y/b.md' && e[1] === 0) && r.json.some(e => e[0] === '/x/y' && e[1] === 1), 'tree');
ok((await call('/fs/rm?p=/x', { method: 'POST' })).status === 409, 'rm of a non-empty dir without r → 409');
await call('/fs/rm?p=/x&r=1', { method: 'POST' }); ok(!fs.existsSync(root + '/x'), 'rm -r');
ok((await call('/fs/rm?p=/', { method: 'POST' })).status === 400 && fs.existsSync(root), 'the workspace root cannot be removed');
await put('/../../etc/jaded-escape', 'x', '&mkdirs=1'); ok(!fs.existsSync('/etc/jaded-escape') && fs.existsSync(root + '/etc/jaded-escape'), '.. cannot leave the workspace');

// ---- the real shell
let e = await exec('echo hi; pwd; echo $HOME');
ok(e.code === 0 && e.out === `hi\n${root}\n${root}\n`, 'shell runs in the workspace, HOME is the root: ' + JSON.stringify(e.out));
e = await exec('cat Notes/none; echo after');
ok(e.code === 0 && /No such file/.test(e.err) && e.out === 'after\n', 'stderr is separate');
e = await exec('exit 7'); ok(e.code === 7, 'exit code');
e = await exec('cd x2/y && pwd', {}); ok(e.vcwd === '/x2/y' && e.cwd === root + '/x2/y', 'cwd is reported: ' + e.vcwd);
e = await exec('pwd', { cwd: '/x2/y' }); ok(e.out.trim() === root + '/x2/y', 'cwd is honoured');
e = await exec('cd /tmp && pwd'); ok(e.cwd === '/tmp' && e.vcwd === null, 'cd outside the workspace works on the real machine');
e = await exec('pwd', { realCwd: '/tmp' }); ok(e.out.trim() === '/tmp', 'realCwd is honoured');
e = await exec('export FOO=bar; export Q="it\'s"'); ok(e.env.FOO === 'bar', 'exported variables are reported: ' + JSON.stringify(e.env.FOO));
e = await exec('echo $FOO', { env: { FOO: 'baz' } }); ok(e.out === 'baz\n', 'env is passed in');
e = await exec('cat', { stdin: 'piped in' }); ok(e.out === 'piped in', 'stdin');
e = await exec('echo a | tr a b > out.txt; cat out.txt; ls /proc | head -1 >/dev/null; uname -s');
ok(e.out === 'b\nLinux\n' && fs.readFileSync(root + '/out.txt', 'utf8') === 'b\n', 'pipes and redirects are real, and land on the real file');
e = await exec('node -e "console.log(require(\'fs\').readdirSync(\'.\').includes(\'out.txt\'), process.version)"');
ok(/^true v\d+\./.test(e.out), 'real node with real fs: ' + e.out.trim());
e = await exec('sleep 5', { timeoutMs: 600 }); ok(/timed out/.test(e.err) && e.code !== 0, 'timeout kills the command');
const t0 = Date.now(); e = await exec('echo first; sleep 0.4; echo second');
ok(e.out === 'first\nsecond\n', 'streaming output');
// output arrives while the command is still running
{
  const rr = await fetch(base + '/exec', { method: 'POST', headers: H, body: JSON.stringify({ cmd: 'echo early; sleep 0.8; echo late' }) });
  const rd = rr.body.getReader(); const first = await rd.read(); const tFirst = Date.now();
  let rest = ''; for (;;) { const { done, value } = await rd.read(); if (done) break; rest += Buffer.from(value).toString(); }
  ok(Buffer.from(first.value).toString().includes('early') && Date.now() - tFirst > 400, 'the first chunk is sent before the command ends');
}

// ---- events and the page relay
const ev = []; const evReq = http.get({ host: '127.0.0.1', port: d.port, path: '/native/events', headers: H }, res => { res.on('data', c => ev.push(c.toString())); });
await new Promise(r => setTimeout(r, 300));
fs.writeFileSync(root + '/watched.md', 'x'); await new Promise(r => setTimeout(r, 600));
ok(ev.join('').includes('event: fs'), 'a file change outside the page is announced');
// `jade tools` inside the real shell is answered by the page
const answer = setInterval(async () => {
  const m = /event: rpc\ndata: (.*)\n/.exec(ev.join(''));
  if (m) { clearInterval(answer); const q = JSON.parse(m[1]); ev.length = 0; await call('/native/rpc/' + q.id, { method: 'POST', body: JSON.stringify({ code: 3, out: `ran ${q.name} ${q.argv.join(',')} stdin=${q.stdin} cwd=${q.cwd}\n`, err: 'warn\n' }) }); }
}, 50);
e = await exec('echo piped | jade tool notes_search query=x', { cwd: '/x2' });
clearInterval(answer);
ok(e.code === 3 && e.out === 'ran jade tool,notes_search,query=x stdin=piped\n cwd=/x2\n' && e.err === 'warn\n', 'jade relays to the page: ' + JSON.stringify(e));
evReq.destroy();
e = await exec('jade tools'); ok(/page is not open/.test(e.err) && e.code !== 0, 'jade without a page says so: ' + JSON.stringify(e.err));

d.close(); fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(page, { force: true });
for (const l of log) console.log(l); for (const l of fail) console.log(l);
console.log(`jaded: ${log.length} passed, ${fail.length} failed`); if (!fail.length) console.log('ALL PASS'); if (!fail.length) console.log("ALL PASS");
process.exit(fail.length ? 1 : 0);
