/* =====================================================================
   PROVIDER FALLBACK LIST · COMPACTION MODEL · BACKUP (JSON) · BACKGROUND MODE
   ===================================================================== */
// migrate the single fallback from v1.3 to the ordered list
if (!Array.isArray(S.fallbacks)) S.fallbacks = [];
if (S.fallback && !S.fallbacks.length) { S.fallbacks = [S.fallback]; delete S.fallback; }
S.fallbackOrder = [...new Set([...(Array.isArray(S.fallbackOrder) ? S.fallbackOrder : []), ...S.fallbacks, 'local', 'llamacpp', 'cloud', 'groq', 'openrouter', 'openai', 'aicord'])].filter(p => PROVIDERS[p]);

/* ---------- fallback list editor (Config → Model provider) ---------- */
const fbDraft = { order: [], on: new Set() };
function loadFbDraft() { fbDraft.order = [...S.fallbackOrder]; fbDraft.on = new Set(S.fallbacks); }
function renderFbList() {
  const prim = $('#sProvider').value; const rows = fbDraft.order.filter(p => p !== prim);
  $('#fbList').innerHTML = rows.map((p, i) => {
    const miss = providerMissing(p, formCfg());
    return `<div class="fb-row" data-p="${p}"><label class="flex items-center gap-2 flex-1 min-w-0"><input type="checkbox" class="accent-emerald-400 w-4 h-4" ${fbDraft.on.has(p) ? 'checked' : ''}><span class="text-sm">${fbDraft.on.has(p) ? `<b class="text-yl">${rows.filter(q => fbDraft.on.has(q)).indexOf(p) + 1}.</b> ` : ''}${esc(PROVIDERS[p].label)}${p === 'local' ? ` <span class="text-dim text-[12px]">${esc(S.host || DEFAULTS.host)}</span>` : ''}</span>${fbDraft.on.has(p) && miss && p !== 'local' ? '<span class="text-rd text-[11px]">needs key</span>' : ''}</label><button type="button" class="icon-btn" data-mv="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="icon-btn" data-mv="1" aria-label="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>▼</button></div>`;
  }).join('');
}
$('#fbList').addEventListener('change', e => { const r = e.target.closest('.fb-row'); if (!r) return; e.target.checked ? fbDraft.on.add(r.dataset.p) : fbDraft.on.delete(r.dataset.p); renderFbList(); showProvFields(); });
$('#fbList').addEventListener('click', e => {
  const b = e.target.closest('[data-mv]'); if (!b) return; const p = b.closest('.fb-row').dataset.p, prim = $('#sProvider').value;
  const vis = fbDraft.order.filter(q => q !== prim); const i = vis.indexOf(p), j = i + +b.dataset.mv; if (j < 0 || j >= vis.length) return;
  [vis[i], vis[j]] = [vis[j], vis[i]]; fbDraft.order = [prim, ...vis].filter((q, k, a) => a.indexOf(q) === k); renderFbList();
});
for (const id of ['#sCloudKey', '#sGroqKey', '#sOaiHost', '#sLcppHost', '#sAicKey']) $(id).addEventListener('input', () => renderFbList());

/* ---------- compaction / journal model ---------- */
async function fillAuxModels(scan) {
  const p = $('#sAuxProv').value; const sel = $('#sAuxModel'); $('#sAuxModelWrap').hidden = !p;
  if (!p) return;
  let list = p === activeProv ? models : [];
  if (scan || !list.length) {
    sel.innerHTML = '<option value="">scanning…</option>';
    try { list = (await tryProvider(p, formCfg())).models; } catch (e) { sel.innerHTML = `<option value="">${esc(String(e.message || e).slice(0, 60))}</option>`; return; }
  }
  const curM = sel.dataset.want || S.auxModel || S.modelBy?.[p] || '';
  sel.innerHTML = list.map(m => `<option ${m === curM ? 'selected' : ''}>${esc(m)}</option>`).join('') || '<option value="">no models</option>';
  if (!list.includes(curM)) { const small = list.find(m => /8b|7b|mini|small|instant|flash|3b|4b|e2b|e4b/i.test(m)); if (small) sel.value = small; }
}
const pick = (o, ks) => Object.fromEntries(ks.map(k => [k, o[k]]));
$('#sAuxProv').onchange = () => { $('#sAuxModel').dataset.want = ''; fillAuxModels(true); };
$('#btnAuxScan').onclick = () => fillAuxModels(true);

/* ---------- backup: export / import everything as JSON ---------- */
const SECRET_KEYS = ['ollamaKey', 'groqKey', 'oaiKey', 'lcppKey', 'ollayaKey', 'mcpSecrets'];
const b64enc = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64dec = b => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
function rawDb() { return new Promise((res, rej) => { const r = indexedDB.open('jade-vault', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
// settingsMirror and pendingSettings hold keys, so backups leave them out (backups carry settings their own way)
async function dbDump() {
  const db = await rawDb();
  return new Promise((res, rej) => { const st = db.transaction('kv').objectStore('kv'); const out = {}; const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return res(out); if (c.key !== 'vfs' && c.key !== 'settingsMirror' && c.key !== 'pendingSettings') out[c.key] = c.value; c.continue(); }; q.onerror = () => rej(q.error); });
}
async function dbRestore(obj, wipe) {
  const db = await rawDb();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); const st = t.objectStore('kv'); if (wipe) st.clear(); for (const [k, v] of Object.entries(obj)) st.put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
const isText = u8 => { if (u8.length > 4e6) return false; try { new TextDecoder('utf-8', { fatal: true }).decode(u8); return !/[\x00-\x08\x0e-\x1f]/.test(dec.decode(u8.subarray(0, 4000))); } catch { return false; } };
const isConfigPath = p => /^\/jade\/(soul|system|agents|memory|heartbeat|curiosity)\.md$/i.test(p) || /^\/jade\/mcp\.json$/i.test(p) || /^\/jade\/skills\//i.test(p) || /^\/agents\.md$/i.test(p);
async function buildBackup(kind, withKeys) {
  const settings = JSON.parse(JSON.stringify(S)); if (!withKeys) for (const k of SECRET_KEYS) delete settings[k];
  const storage = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('jvault:') && k !== 'jvault:settings') { try { storage[k.slice(7)] = JSON.parse(localStorage.getItem(k)); } catch {} } }
  const files = {}, dirs = [];
  for (const [p, n] of vfs.nodes) {
    if (p === '/') continue; if (kind === 'config' && !isConfigPath(p)) continue;
    if (n.dir) { if (kind === 'full') dirs.push(p); continue; }
    files[p] = isText(n.data) ? dec.decode(n.data) : { base64: b64enc(n.data) };
  }
  const out = { app: 'jade-vault', format: 1, kind, exportedAt: new Date().toISOString(), includesKeys: !!withKeys, settings, storage, vault: { files, dirs: dirs.sort() } };
  if (kind === 'full') { saveSession(); await new Promise(r => setTimeout(r, 450)); out.db = await dbDump(); }
  return out;
}
// file saving: Android app → native "Save as"; claude.ai viewer → its downloads capability; plain browser → download link
let downloadsP = null;
const getDownloads = () => (downloadsP ||= (window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null)));
if (window.claude?.use) getDownloads();
async function saveTextFile(name, text, mime = 'application/json') {
  if (typeof window.NetrunnerAndroid?.saveFile === 'function') { try { window.NetrunnerAndroid.saveFile(name, mime, text); return; } catch (e) { console.warn(e); } }
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename: name, data: new Blob([text], { type: mime }) }); toast(`Saved ${esc(name)}`, 'ok'); return; }
    catch (e) { if (e?.code === 'declined') { toast('Save cancelled'); return; } if (e?.code === 'rate_limited') { toast('A save prompt is already open.', 'err'); return; } if (!/unavailable|not_granted|capability_/.test(e?.code || '')) { toast('Could not save: ' + esc(e?.message || e), 'err'); return; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  toast(`Downloading ${esc(name)} (if nothing happens, use Copy JSON)`, 'ok');
}
window.__jadeSaved = (ok, msg) => toast(ok ? `Saved ${esc(msg || 'backup')}` : `Not saved${msg ? ': ' + esc(msg) : ''}`, ok ? 'ok' : 'err');
let lastBackupText = '';
async function exportBackup(kind) {
  const withKeys = $('#sBackupKeys')?.checked; const data = await buildBackup(kind, withKeys);
  lastBackupText = JSON.stringify(data, null, 1);
  const name = `jade-vault-${kind === 'full' ? 'backup' : 'config'}-${todayStr()}.json`;
  $('#backupNote').textContent = `${kind === 'full' ? 'Full backup' : 'Config'}: ${Object.keys(data.vault.files).length} files${data.db ? `, ${(data.db.sessions || []).length} chats, ${(data.db.schedules || []).length} schedules` : ''} · ${fmtSize(lastBackupText.length)}${withKeys ? ' · includes API keys' : ''}`;
  $('#btnBackupCopy').hidden = false;
  await saveTextFile(name, lastBackupText);
}
async function importBackup(file) {
  let data; try { data = typeof abReadBackup === 'function' ? await abReadBackup(file) : JSON.parse(await file.text()); } catch (e) { toast(e && e.message && !/JSON/.test(e.message) ? esc(e.message) : 'That file is not valid JSON.', 'err'); return; }
  if (data?.app !== 'jade-vault' || !data.vault) { toast('That is not a Jade Vault backup.', 'err'); return; }
  const full = data.kind === 'full';
  const msg = full ? `Replace EVERYTHING here (notes, chats, schedules, settings) with the backup from ${String(data.exportedAt || '').slice(0, 10)}?` : `Merge config from ${String(data.exportedAt || '').slice(0, 10)} (settings, SOUL/AGENTS/SYSTEM, memory, skills)? Your other notes and chats stay.`;
  if (!confirm(msg)) return;
  const keep = pick(S, SECRET_KEYS);
  const next = { ...DEFAULTS, ...(full ? {} : S), ...data.settings }; for (const k of SECRET_KEYS) if (!data.settings?.[k]) next[k] = keep[k];
  window.__restoring = true;   // stop pending autosaves from overwriting the restore
  for (const k of Object.keys(S)) delete S[k]; Object.assign(S, next); ls.set('settings', next);
  for (const [k, v] of Object.entries(data.storage || {})) ls.set(k, v);
  const toBytes = v => typeof v === 'string' ? enc.encode(v) : v?.base64 ? b64dec(v.base64) : enc.encode(JSON.stringify(v));
  if (full) {
    const entries = [['/', { dir: true, mtime: Date.now() }]];
    for (const d of data.vault.dirs || []) entries.push([d, { dir: true, mtime: Date.now() }]);
    for (const [p, v] of Object.entries(data.vault.files)) { let q = vfs.parent(p); while (q !== '/' && !entries.some(e => e[0] === q)) { entries.push([q, { dir: true, mtime: Date.now() }]); q = vfs.parent(q); } entries.push([p, { data: toBytes(v), mtime: Date.now() }]); }
    await dbRestore({ ...(data.db || {}), vfs: entries, pendingSettings: next }, true);   // settings ride along in IndexedDB (durable before reload)
    ls.set('lastSession', null);
  } else {
    for (const [p, v] of Object.entries(data.vault.files)) vfs.write(p, toBytes(v), { mkdirs: true });
    await new Promise(r => setTimeout(r, 300)); await dbRestore({ vfs: [...vfs.nodes.entries()], pendingSettings: next }, false);
  }
  toast('Backup restored. Reloading…', 'ok'); setTimeout(() => location.reload(), 400);
}
$('#btnExportAll').onclick = () => exportBackup('full').catch(e => toast('Export failed: ' + esc(e.message), 'err'));
$('#btnExportCfg').onclick = () => exportBackup('config').catch(e => toast('Export failed: ' + esc(e.message), 'err'));
$('#btnBackupCopy').onclick = e => copyText(lastBackupText, e.currentTarget);
$('#importBackup').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); };

/* ---------- background mode (Android app: foreground service + wake lock) ---------- */
function nativeBG() { return typeof window.NetrunnerAndroid?.keepAlive === 'function'; }
var bgOn = false, bgText = '';
function bgSync(text) {
  if (!nativeBG()) return;
  const want = S.bgMode === 'always' || (S.bgMode !== 'off' && running);
  const t = text || (running ? 'Jade is working…' : `Standing by${Sched?.list?.filter?.(x => x.enabled !== false).length ? ` · ${Sched.list.filter(x => x.enabled !== false).length} schedules armed` : ''}`);
  try {
    if (want && (!bgOn || t !== bgText)) { window.NetrunnerAndroid.keepAlive(true, t); bgOn = true; bgText = t; }
    else if (!want && bgOn) { window.NetrunnerAndroid.keepAlive(false, ''); bgOn = false; bgText = ''; }
  } catch (e) { console.warn('keepAlive failed', e); }
}
var BG_LABEL = { THINKING: 'Jade is thinking…', 'RUNNING TOOL': 'Jade is using a tool…', COMPACTING: 'Compacting the chat…' };
function bgState(s) { if (running && BG_LABEL) bgSync(BG_LABEL[s] || (s && s !== 'IDLE' ? `Jade: ${String(s).toLowerCase()}` : 'Jade is working…')); }
function bgFinished() {
  bgSync();
  if (!document.hidden || !S.bgNotify || !cur) return;
  const last = [...cur.messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
  const body = last ? last.content.replace(/```[\s\S]*?```/g, '[code]').replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a).replace(/[*_#>`$]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) : 'Done.';
  schedNotify(`Jade finished: ${cur.title || 'chat'}`.slice(0, 60), body);
}
function renderBgSettings() {
  $('#sBgMode').value = S.bgMode || 'agent'; $('#sBgNotify').checked = !!S.bgNotify;
  const native = nativeBG(); $('#bgNative').hidden = !native; $('#bgWeb').hidden = native;
  if (native) { let opt = true; try { opt = window.NetrunnerAndroid.batteryOptimized(); } catch {} $('#bgBattery').innerHTML = opt ? '<span class="dot bad"></span>Battery saver may pause Jade in the background.' : '<span class="dot ok"></span>Unrestricted battery: Jade can keep working in the background.'; $('#btnBattery').hidden = !opt; }
}
$('#btnBattery').onclick = () => { try { window.NetrunnerAndroid.openBatterySettings(); } catch {} setTimeout(renderBgSettings, 4000); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#settings').hidden) renderBgSettings(); });

// applied at boot: settings restored from a backup, or the IndexedDB copy of the settings when it is newer than
// localStorage's (localStorage writes are not always flushed before a reload, or before Android kills the app)
async function applyPendingSettings() {
  const ps = await idb.get('pendingSettings');
  if (ps) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, DEFAULTS, ps, { _savedAt: Date.now() }); settingsStore(S); await idb.del('pendingSettings'); return; }
  const m = await idb.get('settingsMirror');
  if (m && (m._savedAt || 0) > (S._savedAt || 0)) {
    for (const k of Object.keys(S)) delete S[k]; Object.assign(S, DEFAULTS, m); ls.set('settings', S);
    try { applyJadeTheme(S.jadeTheme); } catch {}
    console.warn('settings: restored the newer copy from IndexedDB (localStorage had lost it)');
  }
}
