/* =====================================================================
   MODEL SEARCH (2.28.1): a model dropdown with many entries opens a searchable list instead of the native one.
   Type part of a name (words in any order) to narrow it; tap one to choose it. "Use …" picks a name that is
   not in the list (a model you know exists). The select stays the source of truth: choosing sets its value and
   fires its change event, so every screen keeps working as before. Keyboard users still get the native list.
   ===================================================================== */
const MS_IDS = ['modelSel', 'sModel', 'sHbModel', 'sAuxModel', 'sOllayaModel', 'sVisModel'];
const MS_MIN = 9;   // fewer options than this: the native list is fine
const msMatch = (name, q) => { const n = name.toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => n.includes(w)); };
function msOpen(sel) {
  const opts = [...sel.options].map(o => ({ v: o.value, t: o.textContent.trim() || o.value })).filter(o => o.v !== '' || o.t);
  const bg = document.createElement('div'); bg.className = 'ms-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-label', 'Search models');
  bg.innerHTML = `<div class="ms-box frame cut"><div class="flex gap-2 items-center"><input type="search" class="field ms-q" placeholder="Search ${opts.length} models…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button type="button" class="btn btn-ghost ms-x" aria-label="Close">✕</button></div><div class="ms-list" role="listbox"></div><div class="hint ms-n"></div></div>`;
  const q = bg.querySelector('.ms-q'), list = bg.querySelector('.ms-list'), note = bg.querySelector('.ms-n');
  let shown = [];
  const draw = () => {
    const s = q.value.trim(); shown = s ? opts.filter(o => msMatch(o.t + ' ' + o.v, s)) : opts;
    const extra = s && !opts.some(o => o.v === s) ? `<button type="button" class="ms-it ms-use" data-v="${esc(s)}">Use “${esc(s)}”</button>` : '';
    list.innerHTML = shown.slice(0, 300).map(o => `<button type="button" role="option" class="ms-it${o.v === sel.value ? ' ms-on' : ''}" data-v="${esc(o.v)}">${esc(o.t)}</button>`).join('') + extra;
    note.textContent = shown.length > 300 ? `${shown.length} match; showing the first 300. Type more to narrow it.` : s ? `${shown.length} of ${opts.length}` : '';
  };
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); try { sel.focus({ preventScroll: true }); } catch {} };
  const choose = v => {
    if (![...sel.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = o.textContent = v; sel.appendChild(o); }
    sel.value = v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); close();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  q.addEventListener('input', draw);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const s = q.value.trim(); if (shown.length === 1) choose(shown[0].v); else if (s && opts.some(o => o.v === s)) choose(s); else if (shown[0]) choose(shown[0].v); else if (s) choose(s); } });
  list.addEventListener('click', e => { const b = e.target.closest('.ms-it'); if (b) choose(b.dataset.v); });
  bg.querySelector('.ms-x').onclick = close;
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(bg); draw();
  list.querySelector('.ms-on')?.scrollIntoView({ block: 'center' });
  setTimeout(() => q.focus(), 30);
}
function msWire(sel) {
  if (!sel || sel.tagName !== 'SELECT' || sel.dataset.ms) return; sel.dataset.ms = '1';
  const big = () => !sel.disabled && sel.options.length >= MS_MIN;
  const grab = e => { if (!big()) return; e.preventDefault(); e.stopPropagation(); msOpen(sel); };
  sel.addEventListener('mousedown', grab);
  // a tap (not a scroll that started on the select) opens the search; cancelling touchend stops the native list
  let t0 = null;
  sel.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  sel.addEventListener('touchend', e => { const t = e.changedTouches[0]; const tap = t0 && t && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) < 10; t0 = null; if (tap) grab(e); }, { passive: false });
  sel.addEventListener('keydown', e => { if (big() && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'))) { e.preventDefault(); msOpen(sel); } });
  const tip = () => { sel.title = big() ? `Tap to search ${sel.options.length} models` : ''; };
  new MutationObserver(tip).observe(sel, { childList: true }); tip();
}
function msWireAll() { for (const id of MS_IDS) msWire(document.getElementById(id)); }
msWireAll(); setTimeout(msWireAll, 0);
Object.assign(window, { msOpen, msWire, msMatch });
