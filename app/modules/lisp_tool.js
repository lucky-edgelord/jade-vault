/* =====================================================================
   JADE LISP: a small Lisp in the base system (the lisp tool), for DSLs and for scripting Jade's tools
   ===================================================================== */
// The interpreter is a vault file, /Jade/tools/lisp.js, so it runs in the same node sandbox as any script and reaches every
// tool through the jade.* bridge. The files below are seeded on first start and upgraded while they still carry the seed
// marker; a file whose marker line the user deleted is theirs and is left alone. LISP_SEED (path -> text) is put in by build.py.
const LISP_JS = '/Jade/tools/lisp.js', LISP_SEED_VER = 1;
function lispSeed(force) {
  const files = typeof LISP_SEED === 'object' && LISP_SEED ? LISP_SEED : {};
  let n = 0;
  for (const [p, text] of Object.entries(files)) {
    try {
      let cur = ''; try { cur = vfs.isFile(p) ? vfs.read(p) : ''; } catch {}
      if (cur && !force) { const m = /jade-lisp-seed v(\d+)/.exec(cur); if (!m || +m[1] >= LISP_SEED_VER) continue; }
      vfs.write(p, text, { mkdirs: true }); n++;
    } catch (e) { console.warn('jade lisp: could not seed ' + p, e); }
  }
  return n;
}
// run Lisp code (or a file) in the node sandbox; returns { out, code }
async function lispRun({ code, file, args = [], fuel, pure, timeoutMs = 120000, signal = null } = {}) {
  if (!vfs.isFile(LISP_JS)) lispSeed(true);
  if (!vfs.isFile(LISP_JS)) throw new Error(`${LISP_JS} is missing`);
  const argv = [LISP_JS];
  if (file) { const p = vfs.norm(String(file), '/'); if (!vfs.isFile(p)) throw new Error(`${p} is not a file`); argv.push(p, ...[].concat(args || []).map(String)); }
  else { const c = String(code ?? '').trim(); if (!c) throw new Error('lisp needs code (or a file)'); argv.push('eval', c); }
  if (fuel) argv.push('fuel=' + Math.max(1000, Math.min(2e9, +fuel | 0)));
  if (pure) argv.push('pure=yes');
  const r = await runNodeScript({ code: vfs.read(LISP_JS), argv, cwd: '/', timeoutMs, signal, via: 'lisp' });
  const out = (r.out || []).map(([, t]) => t).join('');
  return { out, code: r.code || 0 };
}
async function lispTool(a) {
  const r = await lispRun({ code: a.code, file: a.file, args: a.args, fuel: a.fuel, pure: a.pure === true || a.pure === 'true', timeoutMs: Math.max(5, Math.min(600, +a.seconds || 120)) * 1000 });
  let out = r.out.replace(/\s+$/, '');
  if (out.length > 12000) out = out.slice(0, 12000) + `\n…(${out.length - 12000} more characters cut)`;
  return (r.code ? `[exit ${r.code}]\n` : '') + (out || '(no output and no value)');
}
WORLD_TOOL_DEFS.push({
  name: 'lisp',
  description: 'Jade Lisp, your own Lisp (read the lisp-dsl skill first). code: forms to evaluate (prints the last value), or file: a .jl file to run with args (in *args*). Every tool is callable as (tool/NAME :arg v ...); also jade/ask, jade/flow, jade/shell, tflite/load, tflite/run, read-file, write-file, json-parse. Build DSLs with defmacro, or run untrusted programs with (sandbox :pure) and eval-in with a fuel limit. fuel: step limit (default 50 million); pure: no tools, files or JavaScript; seconds: time limit (default 120).',
  parameters: { type: 'object', properties: { code: { type: 'string' }, file: { type: 'string', description: 'a .jl file in the vault' }, args: { type: 'array', items: { type: 'string' } }, fuel: { type: 'number' }, pure: { type: 'boolean' }, seconds: { type: 'number' } } },
});
setTimeout(() => lispSeed(), 1900);
Object.assign(window, { lispSeed, lispRun, lispTool, LISP_JS });
