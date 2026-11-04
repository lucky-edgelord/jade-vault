/* =====================================================================
   WEBXDC APPS — https://webxdc.org
   An .xdc is a zip with index.html (+ manifest.toml, icon.png). Apps run offline in a sandboxed
   frame (no network, no access to the vault) and talk through window.webxdc: they send updates
   and receive every update in order. Here the chat is you + Jade: you use the app, Jade reads its
   updates and can send her own (apps tool), so she can play, track, coordinate and build apps.
   ===================================================================== */
const XDC_USER = () => ({ addr: 'you@jade.vault', name: (S.userName || 'You') });
const XDC_JADE = { addr: 'jade@jade.vault', name: 'Jade' };
const XDC = { session: null, apps: [], listeners: new Set() };
const XdcDB = (() => {
  let dbp;
  const open = () => dbp ??= new Promise((res, rej) => { try { const r = indexedDB.open('jade-xdc', 1); r.onupgradeneeded = () => { r.result.createObjectStore('apps', { keyPath: 'id' }); r.result.createObjectStore('updates', { keyPath: ['app', 'serial'] }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  const tx = async (store, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(store, mode); let out; const q = fn(t.objectStore(store)); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  return {
    apps: () => tx('apps', 'readonly', st => st.getAll()),
    app: id => tx('apps', 'readonly', st => st.get(id)),
    putApp: a => tx('apps', 'readwrite', st => st.put(a)),
    delApp: async id => { await tx('apps', 'readwrite', st => st.delete(id)); await tx('updates', 'readwrite', st => st.delete(IDBKeyRange.bound([id, 0], [id, Infinity]))); },
    clearUpdates: id => tx('updates', 'readwrite', st => st.delete(IDBKeyRange.bound([id, 0], [id, Infinity]))),
    updates: (id, after = 0, limit = 100000) => tx('updates', 'readonly', st => st.getAll(IDBKeyRange.bound([id, after + 1], [id, Infinity]), limit)),
    putUpdate: u => tx('updates', 'readwrite', st => st.put(u)),
  };
})();
// ---- zip (stored + deflate; no zip64) ----
async function unzip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file (.xdc files are zip archives)');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {}; const td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('broken zip directory');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const ds = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true); const raw = u8.subarray(ds, ds + csize);
    let data; if (method === 0) data = raw.slice(); else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else throw new Error(`unsupported zip compression (${method}) for ${name}`);
    out[name.replace(/^\.?\//, '')] = data;
  }
  return out;
}
function parseToml(t) { const o = {}; for (const line of String(t || '').split(/\r?\n/)) { const m = /^\s*([\w.-]+)\s*=\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|([\w.+-]+))\s*(?:#.*)?$/.exec(line); if (m) o[m[1]] = m[2] != null ? m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : m[3] != null ? m[3] : (/^-?\d+(\.\d+)?$/.test(m[4]) ? +m[4] : m[4] === 'true' ? true : m[4] === 'false' ? false : m[4]); else if (/^\s*\[/.test(line)) break; } return o; }
const XMIME = { html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml', csv: 'text/csv', toml: 'text/plain' };
const xmime = p => XMIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
// ---- install ----
async function xdcInstall(files, { origin = 'file', name: fallbackName = 'App' } = {}) {
  // a zip whose files sit in one top folder: use that folder as the root
  if (!files['index.html']) { const roots = new Set(Object.keys(files).map(k => k.split('/')[0])); if (roots.size === 1) { const r = [...roots][0] + '/'; if (files[r + 'index.html']) files = Object.fromEntries(Object.entries(files).map(([k, v]) => [k.slice(r.length), v])); } }
  if (!files['index.html']) throw new Error('this is not a webxdc app: index.html is missing');
  const manifest = files['manifest.toml'] ? parseToml(dec.decode(files['manifest.toml'])) : {};
  let name = String(manifest.name || '').trim();
  if (!name) { const m = /<title>([^<]{1,60})<\/title>/i.exec(dec.decode(files['index.html'])); name = (m && m[1].trim()) || fallbackName; }
  const iconP = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.svg', 'icon.webp'].find(k => files[k]);
  const icon = iconP ? `data:${xmime(iconP)};base64,${b64enc(files[iconP])}` : null;
  const size = Object.values(files).reduce((a, b) => a + b.length, 0);
  if (size > 40 * 1048576) throw new Error(`the app is ${fmtKB(size)}; the limit here is 40 MB`);
  const apps = await XdcDB.apps(); const same = apps.find(a => a.name === name && a.origin === origin);
  const id = same?.id || ('xdc-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + uid().slice(0, 5));
  const app = { ...(same || { serial: 0, ls: {}, installed: Date.now() }), id, name, manifest, icon, files, size, origin, updated: Date.now() };
  await XdcDB.putApp(app); await xdcRefresh(); return app;
}
async function xdcInstallBytes(bytes, opts) { return xdcInstall(await unzip(bytes), opts); }
async function xdcInstallFromVault(path) {
  if (vfs.isDir(path)) { const files = {}; const pre = path.replace(/\/$/, '') + '/'; for (const [p, n] of vfs.nodes) if (!n.dir && p.startsWith(pre)) files[p.slice(pre.length)] = n.data; return xdcInstall(files, { origin: 'vault:' + path, name: vfs.base(path) }); }
  if (!vfs.isFile(path)) throw new Error(`${path} does not exist`);
  return xdcInstall(await unzip(vfs.readBytes(path)), { origin: 'vault:' + path, name: vfs.base(path).replace(/\.xdc$/i, '') });
}
async function xdcRefresh() { XDC.apps = (await XdcDB.apps()).sort((a, b) => (b.opened || b.installed) - (a.opened || a.installed)); renderApps(); return XDC.apps; }
const xdcFind = (q) => { const s = String(q || '').toLowerCase().trim(); return XDC.apps.find(a => a.id === q) || XDC.apps.find(a => a.name.toLowerCase() === s) || XDC.apps.find(a => a.name.toLowerCase().includes(s)) || null; };
// ---- updates ----
// one send at a time per app: each send reads the app's serial and writes serial + 1, so two at once (the app and Jade,
// or an app sending twice in a row) used to get the same serial and the second overwrote the first in the store
const XSEND = new Map();
function xdcSendUpdate(app, update, who) {
  const run = (XSEND.get(app.id) || Promise.resolve()).then(() => xdcSendUpdateNow(app, update, who));
  XSEND.set(app.id, run.catch(() => {}));
  return run;
}
async function xdcSendUpdateNow(app, update, who) {
  if (!update || typeof update !== 'object' || !('payload' in update)) throw new Error('an update needs a payload');
  const json = JSON.stringify(update.payload); if (json === undefined) throw new Error('payload must be JSON');
  if (json.length > 128000) throw new Error('update payload is over 128 KB');
  const full = await XdcDB.app(app.id); if (!full) throw new Error(`${app.name} is not installed any more`);
  const serial = (full.serial || 0) + 1;
  const u = { app: app.id, serial, payload: JSON.parse(json), sender: who.addr, senderName: who.name, ts: Date.now() };
  for (const k of ['info', 'document', 'summary', 'href', 'notify']) if (update[k] != null) u[k] = update[k];
  await XdcDB.putUpdate(u);
  full.serial = serial; full.lastActive = u.ts; if (u.summary != null) full.summary = String(u.summary); if (u.document != null) full.document = String(u.document); if (u.info) full.lastInfo = String(u.info);
  await XdcDB.putApp(full);
  const lite = XDC.apps.find(a => a.id === app.id); if (lite) Object.assign(lite, { serial, summary: full.summary, document: full.document, lastInfo: full.lastInfo, lastActive: u.ts });
  if (XDC.session?.app.id === app.id) xdcDeliver(XDC.session, [u]);
  if (u.info && who.addr !== XDC_USER().addr) toast(`${esc(app.name)}: ${esc(u.info)}`);
  for (const f of XDC.listeners) try { f(app, u); } catch {}
  renderApps(); return u;
}
const xdcPublic = (u, max) => { const o = { payload: u.payload, serial: u.serial, max_serial: max, sender: u.sender, timestamp: u.ts }; for (const k of ['info', 'document', 'summary', 'href']) if (u[k] != null) o[k] = u[k]; return o; };
function xdcDeliver(sess, ups) { if (!sess.listening) return; const max = sess.app.serial = Math.max(sess.app.serial || 0, ...ups.map(u => u.serial)); for (const u of ups) if (u.serial > sess.lastSent) { sess.post({ t: 'update', update: xdcPublic(u, max) }); sess.lastSent = u.serial; } }
// ---- build the page the frame runs: everything inlined, since the frame has no server to fetch from ----
function xdcResolve(base, ref) {
  let r = String(ref || '').trim(); if (!r || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(r)) return null;
  r = r.split('#')[0].split('?')[0]; try { r = decodeURIComponent(r); } catch {}
  const parts = (r.startsWith('/') ? [] : base.split('/').slice(0, -1)); for (const s of r.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
  return parts.join('/');
}
function xdcPage(app) {
  const F = app.files; const dataUrl = p => `data:${xmime(p)};base64,${b64enc(F[p])}`; const memo = new Map();
  const css = (text, from) => text.replace(/@import\s+(?:url\()?\s*(['"]?)([^'")\s]+)\1\s*\)?/g, (m, q, ref) => { const p = xdcResolve(from, ref); return p && F[p] ? `@import url("data:text/css;base64,${b64enc(new TextEncoder().encode(css(dec.decode(F[p]), p)))}")` : m; })
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => { const p = xdcResolve(from, ref); return p && F[p] ? `url("${dataUrl(p)}")` : m; });
  const modUrl = (p, stack = []) => {
    if (memo.has(p)) return memo.get(p); if (stack.includes(p)) return null;
    const src = js(dec.decode(F[p]), p, [...stack, p]); const u = `data:text/javascript;base64,${b64enc(new TextEncoder().encode(src))}`; memo.set(p, u); return u;
  };
  const js = (text, from, stack = []) => text
    .replace(/(\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?|\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*)(['"])([^'"\n]+)\2/g, (m, pre, q, ref) => { const p = xdcResolve(from, ref); if (!p || !F[p]) return m; if (/\.(js|mjs)$/i.test(p)) { const u = modUrl(p, stack); return u ? pre + q + u + q : m; } return pre + q + dataUrl(p) + q; })
    .replace(/\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g, (m, q, ref) => { const p = xdcResolve(from, ref); if (!p || !F[p]) return m; const u = /\.(js|mjs)$/i.test(p) ? modUrl(p, stack) : dataUrl(p); return u ? `import(${q}${u}${q})` : m; })
    .replace(/new\s+URL\(\s*(['"])([^'"\n]+)\1\s*,\s*import\.meta\.url\s*\)/g, (m, q, ref) => { const p = xdcResolve(from, ref); return p && F[p] ? `new URL(${q}${dataUrl(p)}${q})` : m; });
  const doc = new DOMParser().parseFromString(dec.decode(F['index.html']), 'text/html');
  for (const s of [...doc.querySelectorAll('script')]) {
    const isMod = (s.getAttribute('type') || '').toLowerCase() === 'module'; const ref = s.getAttribute('src');
    if (ref) { const p = xdcResolve('index.html', ref); if (!p || !F[p]) { if (/webxdc\.js$/.test(ref)) s.remove(); continue; } s.removeAttribute('src'); s.textContent = isMod ? js(dec.decode(F[p]), p, [p]) : dec.decode(F[p]); }
    else if (isMod) s.textContent = js(s.textContent, 'index.html');
  }
  for (const l of [...doc.querySelectorAll('link[href]')]) {
    const rel = (l.getAttribute('rel') || '').toLowerCase(); const p = xdcResolve('index.html', l.getAttribute('href'));
    if (!p || !F[p]) continue;
    if (rel.includes('stylesheet')) { const st = doc.createElement('style'); st.textContent = css(dec.decode(F[p]), p); l.replaceWith(st); }
    else if (rel === 'modulepreload') l.remove(); else l.setAttribute('href', dataUrl(p));
  }
  for (const st of doc.querySelectorAll('style')) st.textContent = css(st.textContent, 'index.html');
  for (const el of doc.querySelectorAll('[style]')) el.setAttribute('style', css(el.getAttribute('style'), 'index.html'));
  for (const el of doc.querySelectorAll('img[src],audio[src],video[src],source[src],input[src],embed[src],track[src],image[href],use[href]')) { const a = el.hasAttribute('src') ? 'src' : 'href'; const p = xdcResolve('index.html', el.getAttribute(a)); if (p && F[p]) el.setAttribute(a, dataUrl(p)); }
  // files a script may ask for at runtime (fetch, XHR, img.src = …): small ones ride along as data URLs
  const assets = {}; let budget = 12 * 1048576;
  for (const [p, d] of Object.entries(F)) { if (p === 'index.html') continue; if (d.length > budget) continue; budget -= d.length; assets[p] = dataUrl(p); }
  const boot = doc.createElement('script'); boot.textContent = xdcBootSrc({ app, assets, files: Object.keys(F) });
  const meta = doc.createElement('meta'); meta.setAttribute('http-equiv', 'Content-Security-Policy'); meta.setAttribute('content', "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src data: blob:; img-src data: blob:; media-src data: blob:; font-src data: blob:; style-src 'unsafe-inline' data: blob:; script-src 'unsafe-inline' 'unsafe-eval' data: blob:");
  const head = doc.head || doc.documentElement.insertBefore(doc.createElement('head'), doc.body);
  head.prepend(meta, boot);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
function xdcBootSrc({ app, assets, files }) {
  const me = XDC_USER();
  const cfg = { addr: me.addr, name: me.name, ls: app.ls || {}, assets, files, android: !!window.NetrunnerAndroid };
  return `(() => {
const CFG = ${JSON.stringify(cfg).replace(/<\//g, '<\\/')};
const P = window.parent; let seq = 0; const waits = new Map(); let listener = null; const ready = [];
const post = (m) => P.postMessage(Object.assign({ __xdc: 1 }, m), '*');
const call = (t, data) => new Promise((res, rej) => { const id = ++seq; waits.set(id, { res, rej }); post({ t, id, data }); });
window.addEventListener('message', (e) => {
  if (e.source !== P || !e.data || !e.data.__xdc) return; const m = e.data;
  if (m.t === 'update') { try { listener && listener(m.update); } catch (err) { console.error(err); } }
  else if (m.t === 'listen-done') { ready.splice(0).forEach(r => r()); }
  else if (m.t === 'reply') { const w = waits.get(m.id); if (w) { waits.delete(m.id); m.error ? w.rej(new Error(m.error)) : w.res(m.data); } }
  else if (m.t === 'realtime') { rtL && rtL(new Uint8Array(m.data)); }
});
let rtL = null;
const local = (u) => { if (typeof u !== 'string') u = String(u && u.url || u); if (/^(data|blob|javascript):/i.test(u)) return null; let s = u.replace(/^about:srcdoc/, '').replace(/^https?:\\/\\/[^/]*\\.localhost\\//, '').split('#')[0].split('?')[0]; if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null; s = s.replace(/^\\.?\\//, ''); try { s = decodeURIComponent(s); } catch (e) {} return CFG.files.includes(s) ? s : null; };
window.webxdc = {
  selfAddr: CFG.addr, selfName: CFG.name, sendUpdateInterval: 1000, sendUpdateMaxSize: 128000,
  setUpdateListener(cb, serial) { listener = cb; const p = new Promise(r => ready.push(r)); post({ t: 'listen', serial: serial || 0 }); return p; },
  sendUpdate(update, descr) { post({ t: 'send', update: JSON.parse(JSON.stringify(update)), descr }); },
  getAllUpdates() { return call('all'); },
  async sendToChat(msg) {
    const out = { text: msg && msg.text || '' };
    if (msg && msg.file) { const f = msg.file; let b64 = f.base64; if (!b64 && f.plainText != null) b64 = btoa(unescape(encodeURIComponent(f.plainText))); if (!b64 && f.blob) { const u = new Uint8Array(await f.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); b64 = btoa(s); } out.file = { name: f.name || 'file', base64: b64, type: f.type || (f.blob && f.blob.type) || '' }; }
    return call('chat', out);
  },
  importFiles(filter) { return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; const f = filter || {}; i.multiple = !!f.multiple; const acc = [...(f.mimeTypes || []), ...(f.extensions || [])]; if (acc.length && !(CFG.android && !(f.mimeTypes || []).length)) i.accept = acc.join(','); i.style.display = 'none'; i.onchange = () => { res([...i.files]); i.remove(); }; document.body.appendChild(i); i.click(); }); },
  joinRealtimeChannel() { post({ t: 'rt-join' }); return { setListener(f) { rtL = f; }, send(data) { post({ t: 'rt-send', data: Array.from(data || []) }); }, leave() { rtL = null; post({ t: 'rt-leave' }); } }; },
};
// storage: the frame has no origin of its own, so localStorage is kept by the app host
const mkStore = (init, persist) => { const d = Object.assign({}, init); let t = 0; const save = () => { if (!persist) return; clearTimeout(t); t = setTimeout(() => post({ t: 'ls', data: d }), 200); };
  const s = { getItem: k => Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null, setItem: (k, v) => { d[k] = String(v); save(); }, removeItem: k => { delete d[k]; save(); }, clear: () => { for (const k in d) delete d[k]; save(); }, key: i => Object.keys(d)[i] ?? null, get length() { return Object.keys(d).length; } };
  return new Proxy(s, { get: (o, k) => k in o ? o[k] : (typeof k === 'string' ? s.getItem(k) : undefined), set: (o, k, v) => { s.setItem(k, v); return true; }, deleteProperty: (o, k) => { s.removeItem(k); return true; }, ownKeys: () => Object.keys(d), getOwnPropertyDescriptor: (o, k) => Object.prototype.hasOwnProperty.call(d, k) ? { value: d[k], enumerable: true, configurable: true } : undefined }); };
try { Object.defineProperty(window, 'localStorage', { value: mkStore(CFG.ls, true), configurable: true }); } catch (e) {}
try { Object.defineProperty(window, 'sessionStorage', { value: mkStore({}, false), configurable: true }); } catch (e) {}
// local files for fetch / XHR / src setters
const asset = (u) => { const p = local(u); return p ? (CFG.assets[p] || null) : null; };
const f0 = window.fetch && window.fetch.bind(window);
window.fetch = async (input, init) => { const p = local(input); if (p) { if (CFG.assets[p]) return f0(CFG.assets[p]); const r = await call('file', p); return new Response(new Uint8Array(r.bytes), { status: 200, headers: { 'Content-Type': r.type } }); } const u = String(input && input.url || input); if (/^(data|blob):/i.test(u)) return f0(input, init); throw new TypeError('webxdc apps have no internet access'); };
const xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u, ...rest) { const a = asset(u); return xo.call(this, m, a || u, ...rest); };
for (const C of [HTMLImageElement, HTMLMediaElement, HTMLSourceElement, HTMLScriptElement]) { const d = Object.getOwnPropertyDescriptor(C.prototype, 'src'); if (d && d.set) Object.defineProperty(C.prototype, 'src', { get: d.get, set(v) { const a = asset(v); d.set.call(this, a || v); }, configurable: true }); }
const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (k, v) { if ((k === 'src' || k === 'href') && typeof v === 'string') { const a = asset(v); if (a) v = a; } return sa.call(this, k, v); };
const A0 = window.Audio; if (A0) window.Audio = function (u) { return new A0(u ? (asset(u) || u) : u); };
window.open = (u) => { post({ t: 'open', url: String(u || '') }); return null; };
})();`;
}
// ---- the app screen ----
function openApp(idOrName) {
  const app = typeof idOrName === 'object' ? idOrName : xdcFind(idOrName); if (!app) { toast('No such app', 'err'); return null; }
  closeApp(true);
  const ov = document.createElement('div'); ov.className = 'xdc-ov'; ov.id = 'xdcOverlay';
  ov.innerHTML = `<div class="xdc-bar"><button type="button" class="btn" data-x="back" aria-label="Back">←</button>${app.icon ? `<img class="xdc-ic" alt="" src="${app.icon}">` : '<span class="xdc-ic xdc-ic-x">▣</span>'}<div class="xdc-t min-w-0"><b></b><span class="hud"></span></div><button type="button" class="btn" data-x="jade" title="Ask Jade about this app">◆</button><button type="button" class="btn" data-x="reload" aria-label="Reload">⟳</button></div><div class="xdc-frame-wrap"><iframe sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe></div>`;
  ov.querySelector('.xdc-t b').textContent = app.name; ov.querySelector('.xdc-t .hud').textContent = app.summary || '';
  document.body.appendChild(ov);
  const frame = ov.querySelector('iframe');
  const sess = XDC.session = { app, frame, ov, listening: false, lastSent: 0, post: m => frame.contentWindow?.postMessage(Object.assign({ __xdc: 1 }, m), '*') };
  const load = async () => { sess.listening = false; sess.lastSent = 0; sess.rt = false; const full = await XdcDB.app(app.id); sess.app = full; frame.srcdoc = xdcPage(full); };
  ov.onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'back') closeApp(); else if (b.dataset.x === 'reload') load(); else if (b.dataset.x === 'jade') { closeApp(); setTab('chat'); $('#input').value = `About the ${app.name} app: `; $('#input').focus(); } };
  load().catch(e => { toast(`Could not start ${esc(app.name)}: ${esc(e.message)}`, 'err'); closeApp(); });
  XdcDB.app(app.id).then(a => { if (a) { a.opened = Date.now(); XdcDB.putApp(a); } });
  return sess;
}
function closeApp(quiet) { const s = XDC.session; if (!s) return; s.ov.remove(); XDC.session = null; if (!quiet) xdcRefresh(); }
window.addEventListener('message', async (e) => {
  const s = XDC.session; if (!s || e.source !== s.frame.contentWindow || !e.data?.__xdc) return; const m = e.data;
  const reply = (data, error) => s.post({ t: 'reply', id: m.id, data, error });
  try {
    if (m.t === 'listen') { const ups = await XdcDB.updates(s.app.id, +m.serial || 0); s.listening = true; s.lastSent = +m.serial || 0; xdcDeliver(s, ups); s.post({ t: 'listen-done' }); }
    else if (m.t === 'send') { await xdcSendUpdate(s.app, m.update, XDC_USER()); s.ov.querySelector('.xdc-t .hud').textContent = XDC.apps.find(a => a.id === s.app.id)?.summary || ''; }
    else if (m.t === 'all') { const ups = await XdcDB.updates(s.app.id, 0); reply(ups.map(u => xdcPublic(u, ups.at(-1)?.serial || 0))); }
    else if (m.t === 'ls') { const a = await XdcDB.app(s.app.id); if (a) { a.ls = m.data || {}; await XdcDB.putApp(a); } }
    else if (m.t === 'file') { const d = s.app.files[m.data]; if (!d) reply(null, 'not found: ' + m.data); else reply({ bytes: d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength), type: xmime(m.data) }); }
    else if (m.t === 'chat') {
      const files = []; if (m.data.file?.base64) { const b = Uint8Array.from(atob(m.data.file.base64), c => c.charCodeAt(0)); files.push(new File([b], m.data.file.name, { type: m.data.file.type || xmime(m.data.file.name) })); }
      closeApp(); setTab('chat'); if (files.length) await addAttachments(files); if (m.data.text) $('#input').value = m.data.text; $('#input').focus();
      toast(`${esc(s.app.name)} shared ${files.length ? esc(files[0].name) : 'a message'}: press Send to pass it to Jade.`, 'ok'); reply(null);
    }
    else if (m.t === 'rt-join') { s.rt = true; if (XWAKE.cur === s.app.id) xdcRealtime(s.app.id, { jade: 'thinking' }); }
    else if (m.t === 'rt-leave') { s.rt = false; }
    else if (m.t === 'open') { if (/^https?:/i.test(m.url)) window.open(m.url, '_blank', 'noopener'); }
  } catch (err) { if (m.id) reply(null, String(err.message || err)); else toast(`${esc(s.app.name)}: ${esc(err.message || err)}`, 'err'); }
});
// ---- Apps tab ----
function renderApps() {
  const box = $('#appGrid'); if (!box) return;
  const apps = XDC.apps; $('#appsEmpty').hidden = !!apps.length;
  box.innerHTML = apps.map(a => `<div class="app-tile" data-app="${esc(a.id)}"><button type="button" class="app-open" data-open="${esc(a.id)}">${a.icon ? `<img alt="" src="${a.icon}">` : '<span class="app-noic">▣</span>'}<b>${esc(a.name)}</b><span class="hud">${esc(a.summary || (a.serial ? a.serial + ' updates' : 'not used yet'))}</span></button><button type="button" class="app-more" data-more="${esc(a.id)}" aria-label="More">⋯</button></div>`).join('');
}
async function appMenu(id) {
  const a = XDC.apps.find(x => x.id === id); if (!a) return;
  const d = document.createElement('div'); d.className = 'xdc-menu';
  d.innerHTML = `<div class="pane-h mb-2"></div><div class="mono text-xs text-dim mb-3"></div><div class="flex flex-col gap-2"><button class="btn" data-m="open">Open</button><button class="btn" data-m="ask">Ask Jade about it</button><button class="btn" data-m="wake"></button><button class="btn" data-m="export">Save .xdc to the vault</button><button class="btn" data-m="reset">Clear its data (updates + storage)</button><button class="btn btn-red" data-m="remove">Remove app</button><button class="btn btn-ghost" data-m="close">Close</button></div>`;
  d.querySelector('.pane-h').textContent = a.name; d.querySelector('.text-dim').textContent = `${fmtKB(a.size)} · ${a.serial || 0} updates · ${a.origin}${a.manifest?.source_code_url ? ' · ' + a.manifest.source_code_url : ''}`;
  const wakeBtn = d.querySelector('[data-m=wake]'); const fullA = await XdcDB.app(a.id); const paintWake = () => { wakeBtn.textContent = `Jade answers messages sent to her here: ${fullA.jadeWake === false ? 'OFF' : 'ON'}`; }; paintWake();
  const bg = document.createElement('div'); bg.className = 'xdc-menu-bg'; bg.appendChild(d); document.body.appendChild(bg);
  let armed = '';
  bg.onclick = async e => {
    if (e.target === bg) return bg.remove(); const b = e.target.closest('[data-m]'); if (!b) return; const k = b.dataset.m;
    if (k === 'close') return bg.remove();
    if (k === 'open') { bg.remove(); openApp(a); }
    if (k === 'wake') { fullA.jadeWake = fullA.jadeWake === false; await XdcDB.putApp(fullA); paintWake(); return; }
    if (k === 'ask') { bg.remove(); setTab('chat'); $('#input').value = `About the ${a.name} app: `; $('#input').focus(); }
    if (k === 'export') { const full = await XdcDB.app(a.id); const p = await xdcExportToVault(full); bg.remove(); toast(`Saved ${esc(p)}`, 'ok'); }
    if (k === 'reset' || k === 'remove') {
      if (armed !== k) { armed = k; b.textContent = 'Tap again to confirm'; return; }
      if (k === 'reset') { await XdcDB.clearUpdates(a.id); const full = await XdcDB.app(a.id); Object.assign(full, { serial: 0, ls: {}, summary: '', document: '', lastInfo: '' }); await XdcDB.putApp(full); toast(`${esc(a.name)} reset`, 'ok'); }
      else { await XdcDB.delApp(a.id); toast(`${esc(a.name)} removed`, 'ok'); }
      bg.remove(); xdcRefresh();
    }
  };
}
// zip writer (stored) so an installed app can be saved back to the vault / shared
function zipStore(files) {
  const enc_ = new TextEncoder(); const parts = [], cd = []; let off = 0;
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = u => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  for (const [name, data] of Object.entries(files)) {
    const nb = enc_.encode(name), c = crc(data); const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x800, true); lh.setUint32(14, c, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(lh.buffer), nb, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x800, true); ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    cd.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + data.length;
  }
  const cdLen = cd.reduce((a, b) => a + b.length, 0); const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true); e.setUint16(10, Object.keys(files).length, true); e.setUint32(12, cdLen, true); e.setUint32(16, off, true);
  const all = [...parts, ...cd, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0; for (const p of all) { out.set(p, o); o += p.length; } return out;
}
async function xdcExportToVault(app, path) { const p = path || `/Apps/${app.name.replace(/[^\w\- ]+/g, '_')}.xdc`; vfs.write(p, zipStore(app.files), { mkdirs: true }); return p; }
(() => {
  const grid = $('#appGrid'); if (!grid) return;
  grid.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) return openApp(o.dataset.open); const m = e.target.closest('[data-more]'); if (m) appMenu(m.dataset.more); });
  const pick = $('#xdcPick'); if (window.NetrunnerAndroid) pick.removeAttribute('accept');   // Android reads accept[0] as a MIME type; .xdc has none
  $('#btnAppInstall').onclick = () => { pick.value = ''; pick.click(); };
  pick.onchange = async () => { for (const f of pick.files) { try { const a = await xdcInstallBytes(new Uint8Array(await f.arrayBuffer()), { origin: 'file:' + f.name, name: f.name.replace(/\.xdc$/i, '') }); toast(`Installed ${esc(a.name)}`, 'ok'); } catch (e) { toast(`${esc(f.name)}: ${esc(e.message)}`, 'err'); } } };
  xdcRefresh().catch(() => {});
})();
// ---- Jade's side: the apps tool ----
const xdcBrief = a => `${a.name} (id ${a.id}) · ${a.serial || 0} updates${a.summary ? ` · summary: ${a.summary}` : ''}${a.lastInfo ? ` · last info: ${a.lastInfo}` : ''}`;
async function appsTool(args) {
  const act = String(args.action || 'list'); await xdcRefresh();
  if (act === 'list') return XDC.apps.length ? `Installed webxdc apps:\n${XDC.apps.map(a => '- ' + xdcBrief(a)).join('\n')}` : 'No apps installed. Install one with action=install path=<vault .xdc file or app folder> or url=<https link to an .xdc>.';
  if (act === 'install') {
    let app;
    if (args.url) {
      const name = (String(args.url).split(/[?#]/)[0].split('/').pop() || 'app').replace(/[^\w.\-]+/g, '_').replace(/\.xdc$/i, '') + '.xdc';
      const dest = `/Apps/downloads/${name}`; const r = await httpRequest({ url: args.url, save_to: dest });
      if (!/^HTTP 2\d\d/.test(r) || !vfs.isFile(dest)) throw new Error('download failed:\n' + r);
      app = await xdcInstallFromVault(dest);
    }
    else if (args.path) app = await xdcInstallFromVault(vfs.norm(String(args.path), '/'));
    else throw new Error('install needs path (a .xdc file or a folder with index.html) or url');
    return `Installed ${app.name} (id ${app.id}, ${Object.keys(app.files).length} files, ${fmtKB(app.size)}). The user can open it from the Apps tab, or use action=open.`;
  }
  const a = xdcFind(args.app || args.id || args.name); if (!a) throw new Error(`No app "${args.app || ''}". Installed: ${XDC.apps.map(x => x.name).join(', ') || 'none'}`);
  if (act === 'open') { setTab('apps'); openApp(a); return `Opened ${a.name} on the user's screen.`; }
  if (act === 'read') {
    const after = Math.max(0, +args.since || 0); const lim = Math.min(Math.max(1, +args.limit || 30), 200);
    const ups = await XdcDB.updates(a.id, after); const tail = args.since != null ? ups.slice(0, lim) : ups.slice(-lim);
    const full = await XdcDB.app(a.id);
    return truncateHead(`${xdcBrief(a)}${full?.document ? ` · document: ${full.document}` : ''}\nShowing ${tail.length} of ${ups.length} update(s)${after ? ` after serial ${after}` : ''}. Senders: you@jade.vault = the user, jade@jade.vault = you.\n` +
      tail.map(u => `#${u.serial} ${new Date(u.ts).toLocaleString()} from ${u.sender}${u.info ? ` · info: ${u.info}` : ''}${u.summary ? ` · summary: ${u.summary}` : ''}\n${JSON.stringify(u.payload)}`).join('\n') + (ups.length ? `\nNext time read since=${ups.at(-1).serial} for only new ones.` : ''));
  }
  if (act === 'send') {
    let payload = args.payload; if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch {} }
    if (payload === undefined) throw new Error('send needs payload (the JSON the app expects: read its updates or source first to learn the format)');
    const u = await xdcSendUpdate(a, { payload, info: args.info, summary: args.summary, document: args.document }, XDC_JADE);
    return `Sent update #${u.serial} to ${a.name} as jade@jade.vault.${XDC.session?.app.id === a.id ? ' The app is open and received it.' : ''}`;
  }
  if (act === 'files' || act === 'source') {
    const full = await XdcDB.app(a.id); const names = Object.keys(full.files);
    if (act === 'files' || !args.file) return `${a.name} files:\n${names.map(n => `- ${n} (${fmtKB(full.files[n].length)})`).join('\n')}\nRead one with action=source file=<name>.`;
    const d = full.files[String(args.file).replace(/^\.?\//, '')]; if (!d) throw new Error(`no file ${args.file}. Files: ${names.join(', ')}`);
    return isText(d.subarray(0, 4096)) ? truncateHead(dec.decode(d)) : `[binary file, ${fmtKB(d.length)}]`;
  }
  if (act === 'export') { const full = await XdcDB.app(a.id); const p = await xdcExportToVault(full, args.path ? vfs.norm(String(args.path), '/') : null); return `Saved ${a.name} as ${p}.`; }
  throw new Error(`unknown action ${act}: use list, install, open, read, send, files, source or export`);
}
