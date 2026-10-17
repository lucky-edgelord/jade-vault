/* =====================================================================
   NATIVE HOST — the shell is the machine's real BusyBox sh (through jaded): pipes, redirects, globbing, node,
   micropython, sqlite3 and everything else installed are the real programs. Jade's own commands (jade, flow,
   crontab, search …) are shims in that shell that call back into this page.
   ===================================================================== */
if (JADED) {
  Shell.prototype.run = async function nativeRun(src, { stdin = '' } = {}) {
    const chunks = []; const emit = (s, err = false) => { if (!s) return; chunks.push({ s, err }); this.onOutput?.(s, err); };
    this.aborted = false; const ctl = new AbortController();
    const poll = setInterval(() => { if (this.aborted) ctl.abort(); }, 150);
    let code = 1;
    try {
      const res = await fetch('/exec', { method: 'POST', signal: ctl.signal, headers: { 'X-Jaded-Token': JADED.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: String(src), cwd: this.cwd, realCwd: this.realCwd || null, env: Object.fromEntries(Object.entries(this.env || {}).filter(([k]) => !['HOME', 'USER', 'SHELL', 'PATH', 'PWD', 'OLDPWD'].includes(k))), stdin: stdin || '', timeoutMs: this.timeoutMs || 60000 }) });
      if (!res.ok) { emit(`sh: the Jade host answered ${res.status}\n`, true); }
      else {
        const rd = res.body.getReader(); const td = new TextDecoder(); let buf = '';
        const handle = l => {
          if (!l) return; let m; try { m = JSON.parse(l); } catch { return; }
          if (m.t === 'o') emit(m.s); else if (m.t === 'e') emit(m.s, true);
          else if (m.t === 'x') {
            code = m.code ?? 1;
            if (m.vcwd) { this.cwd = m.vcwd; this.realCwd = null; } else if (m.cwd) this.realCwd = m.cwd;
            if (m.env) { this.env ||= {}; Object.assign(this.env, m.env); }
          }
        };
        for (;;) { const { done, value } = await rd.read(); if (done) break; buf += td.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); } }
        handle(buf.trim());
      }
    } catch (e) {
      if (this.aborted) { emit('^C\n', true); code = 130; } else { emit(`sh: ${e.message}\n`, true); code = 1; }
    } finally { clearInterval(poll); }
    this.lastCode = code;
    return { chunks, code };
  };

  // the real shell asked for one of Jade's commands (jade, flow, crontab, search …): run it here and answer
  const nativeRpc = async q => {
    let out = '', err = '', code = 127;
    try {
      const fn = BUILTINS[q.name];
      if (!fn) err = `${q.name}: not available\n`;
      else {
        const sh = new Shell({ cwd: q.cwd || '/' }); sh.timeoutMs = 600000;
        const ctx = { argv: q.argv || [], stdin: q.stdin || '', sh, outS: '', errS: '', o(s) { this.outS += s; }, e(s) { this.errS += s; }, P: p => vfs.norm(p, sh.cwd), name: q.name };
        code = (await fn(ctx)) ?? 0; out = ctx.outS; err = ctx.errS;
      }
    } catch (e) { err = `${q.name}: ${e.message}\n`; code = 1; }
    try { await fetch('/native/rpc/' + q.id, { method: 'POST', headers: { 'X-Jaded-Token': JADED.token }, body: JSON.stringify({ code, out, err }) }); } catch {}
  };
  try { vfs.events?.addEventListener('rpc', ev => { try { nativeRpc(JSON.parse(ev.data)); } catch {} }); } catch {}
  window.JADED_NATIVE = { nativeRpc };
}
