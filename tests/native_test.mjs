// Native host: Jade Vault served by jaded on a real machine. The vault is real files, the shell is the real sh
// (real node, real pipes), Jade's own commands (jade, search, …) work from that shell, and nothing is kept in the browser.
import pw from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { start } from '../native/jaded.mjs';
const { chromium } = pw;
const css = fs.readFileSync('tw.css', 'utf8');
const log = [], fail = []; const ok = (c, m) => (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaded-ws-'));
const d = await start({ port: 0, root, page: process.env.JV_WEB, token: 'native-tok' });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(d.url.slice(0, -1)) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})()` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  return route.abort();
});
await page.goto(d.url);
await page.waitForFunction(() => typeof vfs !== 'undefined' && vfs.native && document.querySelector('#tree')?.children.length > 0, null, { timeout: 30000 });

// ---- first boot seeds the real workspace
ok(await page.evaluate(() => vfs.native === true && typeof window.__JADED__ === 'object'), 'the page is in native mode');
ok(fs.existsSync(root + '/Welcome.md') && /Welcome/.test(fs.readFileSync(root + '/Welcome.md', 'utf8')), 'the seed notes are real files on disk');
ok(await page.evaluate(() => [...document.querySelectorAll('#tree *')].some(e => /Welcome/.test(e.textContent))), 'the file tree shows them');
ok(!(await page.evaluate(async () => (await idb.get('vfs'))?.length || 0)), 'nothing is stored in the browser');

// ---- the VFS API against the disk, both directions
await page.evaluate(() => { vfs.write('/Projects/Garden.md', '# Garden\nPlant tomatoes ünï #todo\n', { mkdirs: true }); vfs.mkdirp('/a/b'); });
ok(fs.readFileSync(root + '/Projects/Garden.md', 'utf8') === '# Garden\nPlant tomatoes ünï #todo\n' && fs.statSync(root + '/a/b').isDirectory(), 'vfs.write / mkdirp land on disk');
fs.writeFileSync(root + '/Outside.md', '# Outside\nwritten by another program\n');
await page.waitForTimeout(900);
ok(await page.evaluate(() => vfs.isFile('/Outside.md') && vfs.read('/Outside.md').includes('another program') && vfs.nodes.has('/Outside.md')), 'files written by other programs are seen');
ok(await page.evaluate(() => [...document.querySelectorAll('#tree *')].some(e => /Outside/.test(e.textContent))), 'and the tree refreshes by itself');
const r1 = await page.evaluate(() => { const o = {}; o.list = vfs.list('/Projects'); o.stat = vfs.stat('/Projects/Garden.md'); try { vfs.read('/none'); } catch (e) { o.err = e.message; }
  vfs.move('/Projects/Garden.md', '/a/b/Garden.md'); vfs.copy('/a', '/a2', true); o.n = [...vfs.walk('/a2')]; vfs.rm('/a2', true); try { vfs.rm('/a'); } catch (e) { o.rmerr = e.message; } return o; });
ok(r1.list.join() === 'Garden.md' && !r1.stat.dir && r1.stat.size > 10 && /No such file/.test(r1.err), 'list / stat / read errors');
ok(fs.existsSync(root + '/a/b/Garden.md') && !fs.existsSync(root + '/Projects/Garden.md') && !fs.existsSync(root + '/a2') && r1.n.includes('/a2/b/Garden.md') && /not empty/i.test(r1.rmerr), 'move / copy / walk / rm');
ok(await page.evaluate(() => { const b = new Uint8Array([0, 255, 1, 128, 7]); vfs.write('/bin.dat', b); const r = vfs.readBytes('/bin.dat'); return r.length === 5 && r[1] === 255 && r[3] === 128; }), 'binary files round-trip');
ok(fs.readFileSync(root + '/bin.dat').equals(Buffer.from([0, 255, 1, 128, 7])), 'binary bytes are exact on disk');

// ---- the shell is the real sh
const sh = async cmd => page.evaluate(async c => { const s = userShell; const r = await s.run(c); return { code: r.code, out: r.chunks.filter(x => !x.err).map(x => x.s).join(''), err: r.chunks.filter(x => x.err).map(x => x.s).join(''), cwd: s.cwd, real: s.realCwd }; }, cmd);
let r = await sh('echo hello | tr a-z A-Z > up.txt; cat up.txt; uname -s; echo $HOME');
ok(r.code === 0 && r.out === `HELLO\nLinux\n${root}\n` && fs.readFileSync(root + '/up.txt', 'utf8') === 'HELLO\n', 'pipes, redirects and uname are the machine: ' + JSON.stringify(r.out));
r = await sh('cd a/b'); r = await sh('pwd; ls');
ok(r.cwd === '/a/b' && r.out === `${root}/a/b\nGarden.md\n`, 'cd persists between commands: ' + JSON.stringify(r.out));
r = await sh('cd /tmp'); ok(r.real === '/tmp', 'cd outside the workspace goes to the real machine'); r = await sh('pwd'); ok(r.out.trim() === '/tmp', 'and stays there');
r = await sh('cd ~ && pwd'); ok(r.out.trim() === root && r.cwd === '/' && r.real === null, 'cd ~ returns to the workspace');
r = await sh('export FOO=bar'); r = await sh('echo $FOO'); ok(r.out === 'bar\n', 'exported variables persist');
r = await sh('node -e "const fs=require(\'fs\');console.log(process.version, fs.readFileSync(\'Welcome.md\',\'utf8\').length>0, typeof fetch)"');
ok(/^v\d+\.\d+\.\d+ true function/.test(r.out), 'real node with real fs and fetch: ' + r.out.trim());
r = await sh('ls /etc | head -3; ls /proc/self >/dev/null && echo proc'); ok(r.code === 0 && /proc/.test(r.out), 'the whole machine is reachable, not a sandbox');
r = await sh('grep -rl tomatoes . | head'); ok(/Garden\.md/.test(r.out), 'grep -r over the real tree');
r = await sh('false'); ok(r.code === 1, 'exit codes'); r = await sh('nosuchcmd'); ok(r.code === 127 && /not found/.test(r.err), 'unknown command: ' + r.err.trim());
const t0 = Date.now(); r = await page.evaluate(async () => { const s = new userShell.constructor({}); s.timeoutMs = 700; const r = await s.run('sleep 5; echo no'); return { code: r.code, err: r.chunks.map(c => c.s).join('') }; });
ok(Date.now() - t0 < 4000 && /timed out/.test(r.err), 'a runaway command is killed: ' + r.err.trim());
const abortR = await page.evaluate(async () => { const s = new userShell.constructor({}); const p = s.run('sleep 20; echo no'); setTimeout(() => { s.aborted = true; }, 300); const t = Date.now(); const r = await p; return { ms: Date.now() - t, code: r.code }; });
ok(abortR.ms < 3000 && abortR.code === 130, 'Ctrl-C stops it: ' + JSON.stringify(abortR));
ok(await page.evaluate(async () => { const r = await runShellLine('echo from-tool'); return r.out === 'from-tool\n' && r.code === 0; }), "the agent's shell tool runs the real shell");

// ---- Jade's own commands from the real shell
r = await sh('jade tools | head -50'); ok(r.code === 0 && /notes_search/.test(r.out), '`jade tools` works inside the real shell: ' + r.out.slice(0, 80));
r = await sh('echo \'{"query":"tomatoes"}\' | jade tool notes_search'); ok(r.code === 0 && /Garden/.test(r.out), 'jade tool … with piped JSON: ' + r.out.slice(0, 120));
r = await sh('search tomatoes'); ok(/Garden/.test(r.out), '`search` works from the real shell');
r = await sh('jade nope'); ok(r.code !== 0, 'jade errors carry a status');
r = await sh('crontab -l'); ok(r.code === 0, 'crontab works from the real shell');
r = await sh(`node -e "console.log(JSON.stringify(process.env.JADED_URL.startsWith('http://127.0.0.1')))"`); ok(r.out.trim() === 'true', 'scripts can find the host');

// ---- the host does not answer strangers
const open = await page.evaluate(async () => { const a = await fetch('/exec', { method: 'POST', body: '{"cmd":"id"}' }); const b = await fetch('/fs/read?p=/Welcome.md'); return [a.status, b.status]; });
ok(open[0] === 401 && open[1] === 401, 'requests without the token are refused: ' + open);

for (const l of log) console.log(l); for (const l of fail) console.log(l);
console.log(`native: ${log.length} passed, ${fail.length} failed`); if (!fail.length) console.log("ALL PASS");
await browser.close(); d.close(); fs.rmSync(root, { recursive: true, force: true });
process.exit(fail.length ? 1 : 0);
