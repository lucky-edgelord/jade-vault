// Run Jade Vault's test suites: headless Chromium (Playwright) against the built pages, plus the
// SQLite engine tests. Each suite runs in tests/.work with its fixtures next to it.
//   node tests/run.mjs                 all suites
//   node tests/run.mjs vector_test     just these
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const NM = (process.env.JV_NODE_MODULES || path.join(ROOT, 'node_modules')) + '/';
const WEB = path.join(ROOT, 'dist', 'jade-vault.html');
const APK = path.join(ROOT, 'android', 'proj', 'assets', 'index.html');
const ALL = ['sq_glue_test', 'sq_bridge_test', 'sq_shim_test', 'vault_test', 'vault_apk_test', 'py_test', 'sqlite_test', 'mcp_test', 'hb_test', 'prov_test', 'ctx_test', 'memrag_test', 'api_test', 'api_java_test', 'flows_test', 'bridge_test', 'tpl_test', 'reply_test', 'tf_test', 'tf_gpu_test', 'traj_test', 'apps_test', 'jadelink_test', 'vector_test', 'aicord_test', 'discord_test', 'jaded_test', 'native_test'];
const pick = process.argv.slice(2).map(a => a.replace(/\.(mjs|py)$/, ''));
const suites = pick.length ? ALL.filter(s => pick.includes(s)) : ALL;

for (const f of [WEB, APK, path.join(ROOT, 'dist', 'tw.css')]) if (!fs.existsSync(f)) { console.error(`Missing ${path.relative(ROOT, f)}: run npm run build first.`); process.exit(1); }
const W = path.join(ROOT, 'tests', '.work');
fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(path.join(W, 'sq', 'build'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'dist', 'tw.css'), path.join(W, 'tw.css'));
for (const d of ['mpymock', 'xdcfix', 'hbfiles']) fs.symlinkSync(path.join(ROOT, 'tests', 'fixtures', d), path.join(W, d));
fs.symlinkSync(path.join(ROOT, 'jade-vector'), path.join(W, 'jade-vector'));
fs.symlinkSync(path.join(ROOT, 'jade-discord'), path.join(W, 'jade-discord'));
fs.symlinkSync(path.join(ROOT, 'app', 'modules'), path.join(W, 'vault'));
fs.copyFileSync(path.join(ROOT, 'app', 'vendor', 'sqlite3.min.wasm'), path.join(W, 'sq', 'build', 'sqlite3.min.wasm'));

const env = { ...process.env, JV_NM: NM, JV_WEB: WEB, JV_APK: APK, NODE_PATH: NM };
const run = (name) => new Promise(resolve => {
  const py = name.endsWith('_py') || name === 'sq_shim_test';
  const cmd = py ? ['python3', [path.join(ROOT, 'tests', name + '.py')]] : [process.execPath, [path.join(ROOT, 'tests', name + '.mjs')]];
  const t0 = Date.now(); let out = '';
  const p = spawn(cmd[0], cmd[1], { cwd: W, env });
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  const timer = setTimeout(() => { out += '\n[timeout after 8 minutes]'; p.kill('SIGKILL'); }, 8 * 60 * 1000);
  p.on('close', code => {
    clearTimeout(timer);
    const fails = out.split('\n').filter(l => /^FAIL |\[pageerror\]|\[timeout/.test(l));
    const browser = !py && !name.startsWith('sq_');
    const ok = code === 0 && !fails.length && (!browser || /ALL PASS/.test(out));
    resolve({ name, ok, ms: Date.now() - t0, fails, out, code });
  });
});

let bad = 0;
for (const s of suites) {
  process.stdout.write(`${s.padEnd(16)} `);
  const r = await run(s);
  console.log(`${r.ok ? 'pass' : 'FAIL'}  ${(r.ms / 1000).toFixed(0)}s`);
  if (!r.ok) { bad++; console.log((r.fails.length ? r.fails : r.out.split('\n').slice(-15)).map(l => '    ' + l.slice(0, 300)).join('\n')); }
}
console.log(`\n${suites.length - bad}/${suites.length} suites passed`);
process.exit(bad ? 1 : 0);
