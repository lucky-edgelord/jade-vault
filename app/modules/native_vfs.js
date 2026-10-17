/* =====================================================================
   NATIVE HOST — when Jade Vault is served by jaded (JadeOS-Linux and friends) the vault is the machine's real
   filesystem: this VFS has the same synchronous API as the in-browser one, but every call goes to the daemon
   (synchronous XHR on localhost), so there is no browser copy of any file. "/" is the workspace root on the machine.
   ===================================================================== */
const JADED = window.__JADED__ || null;
function nreq(method, url, body, bin) {
  const x = new XMLHttpRequest(); x.open(method, url, false); x.setRequestHeader('X-Jaded-Token', JADED.token);
  if (bin) x.overrideMimeType('text/plain; charset=x-user-defined');
  try { x.send(body ?? null); } catch (e) { throw new Error(`the Jade host is not answering (${e.message})`); }
  return x;
}
function nerr(x, p) {
  let j = null; try { j = JSON.parse(x.responseText); } catch {}
  const code = j?.code, m = j?.error || `HTTP ${x.status}`;
  const e = new Error(x.status === 404 ? `${p}: No such file or directory` : code === 'EISDIR' ? `${p}: Is a directory` : code === 'ENOTDIR' ? `${p}: Not a directory` : code === 'EEXIST' ? `${p}: File exists` : code === 'ENOTEMPTY' ? `${p}: Directory not empty` : x.status === 401 ? 'the Jade host refused the token' : `${p}: ${m}`);
  e.code = code || (x.status === 404 ? 'ENOENT' : null); return e;
}
const nget = (op, p) => { const x = nreq('GET', `/fs/${op}?p=${encodeURIComponent(p)}`); if (x.status !== 200) throw nerr(x, p); return JSON.parse(x.responseText); };
const npost = (op, p, q = '') => { const x = nreq('POST', `/fs/${op}?p=${encodeURIComponent(p)}${q}`); if (x.status !== 200) throw nerr(x, p); };
const bytesOf = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };

class NativeNodes {   // a Map-like view of the workspace tree (path → node), loaded lazily and refreshed on change
  constructor() { this.t = null; }
  reset() { this.t = null; }
  load() {
    if (this.t) return this.t;
    const rows = JSON.parse(nreq('GET', '/fs/tree?p=%2F&max=50000').responseText); const t = new Map();
    for (const [p, d, size, mtime] of rows) t.set(p, this.mk(p, !!d, size, mtime));
    if (!t.has('/')) t.set('/', { dir: true, mtime: Date.now() });
    return (this.t = t);
  }
  mk(p, dir, size, mtime) {
    if (dir) return { dir: true, mtime };
    const o = { mtime, size, _d: null };
    Object.defineProperty(o, 'data', { enumerable: true, get() { return this._d ||= vfs.readBytes(p); }, set(v) { this._d = v; } });
    return o;
  }
  get(p) { return this.load().get(p); } has(p) { return this.load().has(p); }
  set(p, v) { this.load().set(p, v); return this; } delete(p) { return this.load().delete(p); }
  keys() { return this.load().keys(); } values() { return this.load().values(); } entries() { return this.load().entries(); }
  [Symbol.iterator]() { return this.load().entries(); } forEach(f, a) { return this.load().forEach(f, a); }
  get size() { return this.load().size; }
}

class NativeVFS extends VFS {
  constructor() {
    super(); this.native = true; this.nodes = new NativeNodes(); this._memo = new Map(); this._lastWrite = 0;
    try {
      const es = new EventSource('/native/events?token=' + encodeURIComponent(JADED.token)); this.events = es;
      es.addEventListener('fs', () => { this.refresh(); if (Date.now() - this._lastWrite > 700) this.changed(); });
    } catch {}
  }
  refresh() { this.nodes.reset(); this._memo.clear(); }
  touched() { this._lastWrite = Date.now(); this._memo.clear(); this.nodes.reset(); }
  norm(p, cwd = '/') { return super.norm(p, cwd); }
  // single-path questions go straight to the machine (a short memo makes loops cheap)
  _stat(p) {
    const m = this._memo.get(p); if (m && Date.now() - m.t < 250) return m.v;
    const x = nreq('GET', `/fs/stat?p=${encodeURIComponent(p)}`); let v = null;
    if (x.status === 200) v = JSON.parse(x.responseText); else if (x.status !== 404) throw nerr(x, p);
    this._memo.set(p, { t: Date.now(), v }); if (this._memo.size > 2000) this._memo.clear(); return v;
  }
  exists(p) { return !!this._stat(p); }
  isDir(p) { return this._stat(p)?.dir === true; }
  isFile(p) { const s = this._stat(p); return !!s && !s.dir; }
  stat(p) { const s = this._stat(p); if (!s) throw new Error(`${p}: No such file or directory`); return s; }
  readBytes(p) {
    const x = nreq('GET', `/fs/read?p=${encodeURIComponent(p)}`, null, true);
    if (x.status !== 200) { if (x.status === 400) throw new Error(`${p}: Is a directory`); throw nerr(x, p); }
    return bytesOf(x.responseText);
  }
  write(p, data, { mkdirs = false } = {}) {
    if (p === '/') throw new Error('/: Is a directory');
    const b = typeof data === 'string' ? enc.encode(data) : data;
    const x = nreq('PUT', `/fs/write?p=${encodeURIComponent(p)}${mkdirs ? '&mkdirs=1' : ''}`, b);
    if (x.status !== 200) throw nerr(x, this.parent(p) === p ? p : (x.status === 404 ? this.parent(p) : p));
    this.touched(); this.changed();
  }
  append(p, data) {
    const b = typeof data === 'string' ? enc.encode(data) : data;
    const x = nreq('PUT', `/fs/write?p=${encodeURIComponent(p)}&append=1&mkdirs=1`, b); if (x.status !== 200) throw nerr(x, p);
    this.touched(); this.changed();
  }
  mkdirp(p) { if (p === '/') return; npost('mkdir', p, '&parents=1'); this.touched(); this.changed(); }
  mkdir(p) { npost('mkdir', p); this.touched(); this.changed(); }
  list(p) { return nget('list', p).map(e => e.name).sort(); }
  *walk(p) { const rows = JSON.parse(nreq('GET', `/fs/tree?p=${encodeURIComponent(p)}&max=50000`).responseText); for (const r of rows) yield r[0]; }
  rm(p, recursive = false) {
    if (p === '/') throw new Error("refusing to remove '/'");
    npost('rm', p, recursive ? '&r=1' : ''); this.touched(); this.changed();
  }
  move(a, b) {
    if (this.isDir(b)) b = (b === '/' ? '' : b) + '/' + this.base(a);
    if (b === a) return;
    const x = nreq('POST', `/fs/mv?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`); if (x.status !== 200) { if (x.status === 400) throw new Error(`cannot move '${a}' into itself`); throw nerr(x, a); }
    this.touched(); this.changed();
  }
  copy(a, b, recursive = false) {
    if (this.isDir(b)) b = (b === '/' ? '' : b) + '/' + this.base(a);
    if (this.isDir(a) && !recursive) throw new Error(`-r not specified; omitting directory '${a}'`);
    const x = nreq('POST', `/fs/cp?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`); if (x.status !== 200) throw nerr(x, a);
    this.touched(); this.changed();
  }
  persist() {}            // the disk is the only copy
  async load() { try { return nget('list', '/').some(e => !e.name.startsWith('.')); } catch { return false; } }
  entries() { return [...this.nodes.entries()]; }
  // restoring a backup writes its files over the workspace; it never deletes what is already there
  replace(entries) { for (const [p, n] of entries) { if (p === '/') continue; if (n.dir) this.mkdirp(p); else this.write(p, n.data, { mkdirs: true }); } this.touched(); this.changed(); }
}
