#!/usr/bin/env node
// `jade`, `flow`, `crontab`, `search` ... inside the real shell: run the command in the Jade page and print the answer.
const [name, ...argv] = process.argv.slice(2);
const url = process.env.JADED_URL, token = process.env.JADED_TOKEN;
if (!url || !token) { console.error(`${name}: not running inside Jade's shell`); process.exit(127); }
let stdin = '';
if (!process.stdin.isTTY) { try { for await (const c of process.stdin) stdin += c; } catch {} }
try {
  const r = await fetch(`${url}/rpc/${name}`, { method: 'POST', headers: { 'X-Jaded-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ argv, stdin, cwd: process.env.PWD && process.env.JADE_ROOT && process.env.PWD.startsWith(process.env.JADE_ROOT) ? process.env.PWD.slice(process.env.JADE_ROOT.length) || '/' : '/' }) });
  const o = await r.json();
  if (o.out) process.stdout.write(o.out);
  if (o.err || o.error) process.stderr.write(o.err || o.error + '\n');
  process.exit(o.code ?? (r.ok ? 0 : 1));
} catch (e) { console.error(`${name}: ${e.message}`); process.exit(1); }
