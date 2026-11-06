/* =====================================================================
   PLANS: Gantt charts for long-term projects (the gantt tool and the Plans screen)
   ===================================================================== */
// A project is /Jade/Projects/<id>.json: { id, name, description, tasks: [{ id, name, start, end, deps, owner, progress,
// milestone, notes }] }. Dates are YYYY-MM-DD; end is the last day of the task (a milestone has start == end).
// The plans stand on their own. The one link to the scheduler: with autonomous mode on, Jade's tasks that are ready
// (every dependency done, start date reached) are offered to tier 3 of the scheduler (sched.js asks ganttReady()).
const GANTT_DIR = '/Jade/Projects';
const DAY = 86400000;
const gDate = d => { const x = d instanceof Date ? d : new Date(String(d) + 'T00:00:00'); if (isNaN(x)) throw new Error(`not a date: ${d} (use YYYY-MM-DD)`); return x; };
const gIso = d => { const x = gDate(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const gToday = () => gIso(new Date());
const gAdd = (d, n) => { const x = gDate(d); x.setDate(x.getDate() + n); return gIso(x); };
const gDiff = (a, b) => Math.round((gDate(b) - gDate(a)) / DAY);   // days from a to b
const gDur = t => gDiff(t.start, t.end) + 1;
const gDone = t => (+t.progress || 0) >= 100;
const gSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'project';
const gPath = id => `${GANTT_DIR}/${gSlug(id)}.json`;

function ganttList() {
  if (!vfs.isDir(GANTT_DIR)) return [];
  const out = [];
  for (const n of vfs.list(GANTT_DIR)) { const name = typeof n === 'string' ? n : n.name; if (!/\.json$/.test(name)) continue; try { out.push(ganttLoad(name.replace(/\.json$/, ''))); } catch {} }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function ganttFind(ref) {
  const r = String(ref || '').trim(); if (!r) throw new Error('which project? Give project (its id or name). Projects: ' + (ganttList().map(p => p.id).join(', ') || 'none yet'));
  if (vfs.isFile(gPath(r))) return ganttLoad(r);
  const hit = ganttList().find(p => p.name.toLowerCase() === r.toLowerCase() || p.id === gSlug(r));
  if (!hit) throw new Error(`no project "${r}". Projects: ${ganttList().map(p => p.id).join(', ') || 'none yet'}`);
  return hit;
}
function ganttLoad(id) {
  const p = JSON.parse(vfs.read(gPath(id)));
  p.id = p.id || gSlug(id); p.name = p.name || p.id; p.tasks = Array.isArray(p.tasks) ? p.tasks : [];
  for (const t of p.tasks) { t.deps = Array.isArray(t.deps) ? t.deps.map(String) : []; t.owner = t.owner === 'user' ? 'user' : 'jade'; t.progress = Math.max(0, Math.min(100, +t.progress || 0)); t.end = t.end || t.start; }
  return p;
}
function ganttSave(p) { p.updated = new Date().toISOString(); vfs.write(gPath(p.id), JSON.stringify(p, null, 2), { mkdirs: true }); try { ganttRenderIfOpen(); } catch {} return p; }
const gTask = (p, ref) => {
  const r = String(ref ?? '').trim();
  const t = p.tasks.find(x => x.id === r) || p.tasks.find(x => x.name.toLowerCase() === r.toLowerCase());
  if (!t) throw new Error(`no task "${r}" in ${p.name}. Tasks: ${p.tasks.map(x => `${x.id} ${x.name}`).join('; ') || 'none'}`);
  return t;
};
function gNewId(p) { let i = p.tasks.length + 1; while (p.tasks.some(t => t.id === 't' + i)) i++; return 't' + i; }
function gCycle(p, from, to) {   // would from -> to (from depends on to) make a cycle?
  const seen = new Set(); const st = [to];
  while (st.length) { const x = st.pop(); if (x === from) return true; if (seen.has(x)) continue; seen.add(x); const t = p.tasks.find(y => y.id === x); if (t) st.push(...t.deps); }
  return false;
}
// order tasks so dependencies come first
function gTopo(p) {
  const out = [], mark = new Map();
  const visit = t => { if (mark.get(t.id) === 2) return; if (mark.get(t.id) === 1) throw new Error(`dependency cycle at ${t.id}`); mark.set(t.id, 1); for (const d of t.deps) { const x = p.tasks.find(y => y.id === d); if (x) visit(x); } mark.set(t.id, 2); out.push(t); };
  for (const t of p.tasks) visit(t);
  return out;
}
// push tasks later so each starts after its dependencies end (durations kept); returns what moved
function ganttPlan(p) {
  const moved = [];
  for (const t of gTopo(p)) {
    if (!t.deps.length) continue;
    const ends = t.deps.map(d => p.tasks.find(x => x.id === d)).filter(Boolean).map(x => x.end);
    const earliest = gAdd(ends.sort().at(-1), t.milestone ? 0 : 1);
    if (t.start < earliest) { const dur = gDur(t); const was = t.start; t.start = earliest; t.end = gAdd(earliest, dur - 1); moved.push(`${t.id} ${t.name}: ${was} -> ${t.start}`); }
  }
  return moved;
}
// critical path: tasks with no slack between the project start and its finish
function ganttCritical(p) {
  if (!p.tasks.length) return { ids: [], end: null };
  const order = gTopo(p); const finish = order.map(t => t.end).sort().at(-1);
  const late = new Map();   // latest end without delaying the finish
  for (const t of [...order].reverse()) {
    const succ = p.tasks.filter(x => x.deps.includes(t.id));
    let le = finish; for (const s of succ) { const ls_ = gAdd(late.get(s.id), -(gDur(s) - 1)); const cand = gAdd(ls_, s.milestone ? 0 : -1); if (cand < le) le = cand; }
    late.set(t.id, le);
  }
  return { ids: order.filter(t => late.get(t.id) <= t.end).map(t => t.id), end: finish };
}
function gState(p, t, today = gToday()) {
  if (gDone(t)) return 'done';
  const open = t.deps.map(d => p.tasks.find(x => x.id === d)).filter(x => x && !gDone(x));
  if (t.end < today) return 'late';
  if (open.length) return t.start <= today ? 'blocked' : 'waiting';
  return t.start <= today ? 'ready' : 'planned';
}
function ganttReport(p, today = gToday()) {
  const by = {}; for (const t of p.tasks) (by[gState(p, t, today)] ||= []).push(t);
  const crit = ganttCritical(p);
  const done = p.tasks.length ? Math.round(p.tasks.reduce((s, t) => s + gDur(t) * t.progress, 0) / p.tasks.reduce((s, t) => s + gDur(t), 0)) : 0;
  const line = (t) => `  ${t.id} ${t.name} (${t.owner}, ${t.start}${t.end !== t.start ? ' → ' + t.end : ''}, ${t.progress}%)`;
  const soon = p.tasks.filter(t => !gDone(t) && t.end >= today && gDiff(today, t.end) <= 3);
  return [`${p.name}: ${p.tasks.length} tasks, ${done}% done, finishes ${crit.end || '(no tasks)'}.`,
    ...['late', 'blocked', 'ready', 'waiting'].filter(k => by[k]?.length).map(k => `${k[0].toUpperCase() + k.slice(1)}:\n` + by[k].map(line).join('\n')),
    soon.length ? 'Due within 3 days:\n' + soon.map(line).join('\n') : '',
    crit.ids.length ? 'Critical path: ' + crit.ids.join(' → ') : ''].filter(Boolean).join('\n');
}
// a text Gantt chart for the model and the shell
function ganttText(p, today = gToday()) {
  if (!p.tasks.length) return `${p.name}: no tasks yet. Add some with action add.`;
  const start = p.tasks.map(t => t.start).sort()[0], end = p.tasks.map(t => t.end).sort().at(-1);
  const span = gDiff(start, end) + 1, unit = span > 120 ? 7 : span > 60 ? 2 : 1, cols = Math.ceil(span / unit);
  const W = Math.min(28, Math.max(...p.tasks.map(t => (t.id + ' ' + t.name).length)));
  const crit = new Set(ganttCritical(p).ids);
  const rows = gTopo(p).map(t => {
    const a = Math.floor(gDiff(start, t.start) / unit), b = Math.floor(gDiff(start, t.end) / unit);
    let bar = ''; for (let i = 0; i < cols; i++) bar += i < a || i > b ? '·' : t.milestone ? '◆' : (i - a) / Math.max(1, b - a + 1) < t.progress / 100 ? '█' : '░';
    const label = (t.id + ' ' + t.name).slice(0, W).padEnd(W);
    return `${label} |${bar}| ${t.owner === 'user' ? 'you ' : 'jade'} ${String(t.progress).padStart(3)}% ${gState(p, t, today)}${crit.has(t.id) ? ' *' : ''}${t.deps.length ? '  after ' + t.deps.join(',') : ''}`;
  });
  const ti = gDiff(start, today); const mark = ti >= 0 && ti < span ? ' '.repeat(W + 2 + Math.floor(ti / unit)) + '^ today' : '';
  return `${p.name}  ${start} → ${end}  (one column = ${unit} day${unit > 1 ? 's' : ''}; █ done ░ to do ◆ milestone; * critical)\n` + rows.join('\n') + (mark ? '\n' + mark : '');
}
// for the scheduler: Jade's tasks that can be worked on now
function ganttReady(today = gToday()) {
  const out = [];
  for (const p of ganttList()) for (const t of p.tasks) if (t.owner === 'jade' && !t.milestone && gState(p, t, today) === 'ready') out.push({ project: p.id, projectName: p.name, task: t });
  return out;
}
function gFields(t, a, p) {
  if (a.name !== undefined) t.name = String(a.name).slice(0, 120);
  if (a.start !== undefined) t.start = gIso(a.start);
  if (a.end !== undefined) t.end = gIso(a.end);
  else if (a.days !== undefined) t.end = gAdd(t.start, Math.max(1, +a.days | 0) - 1);
  if (a.milestone !== undefined) t.milestone = a.milestone === true || a.milestone === 'true';
  if (t.milestone) t.end = t.start;
  if (t.end < t.start) throw new Error(`${t.name}: end ${t.end} is before start ${t.start}`);
  if (a.owner !== undefined) t.owner = a.owner === 'user' || a.owner === 'you' ? 'user' : 'jade';
  if (a.progress !== undefined) t.progress = Math.max(0, Math.min(100, Math.round(+a.progress || 0)));
  if (a.notes !== undefined) t.notes = String(a.notes).slice(0, 2000);
  if (a.deps !== undefined) { const ds = [].concat(a.deps).flatMap(x => String(x).split(',')).map(x => x.trim()).filter(Boolean).map(d => gTask(p, d).id); for (const d of ds) if (d === t.id || gCycle(p, t.id, d)) throw new Error(`${t.id} cannot depend on ${d}: that makes a cycle`); t.deps = [...new Set(ds)]; }
}
const GANTT_ACTIONS = ['projects', 'create', 'show', 'add', 'update', 'link', 'unlink', 'remove', 'plan', 'report', 'ready'];
async function ganttTool(a, by = 'jade') {
  const action = String(a.action || 'projects').toLowerCase();
  if (!GANTT_ACTIONS.includes(action)) throw new Error(`unknown action ${action}: use ${GANTT_ACTIONS.join(', ')}`);
  if (action === 'projects') { const ps = ganttList(); return ps.length ? ps.map(p => `${p.id}: ${p.name} — ${p.tasks.length} tasks, ${p.tasks.filter(gDone).length} done` + (p.description ? `\n  ${p.description}` : '')).join('\n') : 'No projects yet. Make one with action create (name, description).'; }
  if (action === 'ready') { const r = ganttReady(); return r.length ? r.map(x => `${x.projectName} / ${x.task.id} ${x.task.name} (${x.task.progress}%, due ${x.task.end})`).join('\n') : 'Nothing of yours is ready right now.'; }
  if (action === 'create') {
    const name = String(a.name || a.project || '').trim(); if (!name) throw new Error('create needs a name');
    const id = gSlug(name); if (vfs.isFile(gPath(id))) throw new Error(`a project ${id} already exists`);
    ganttSave({ id, name, description: String(a.description || ''), created: new Date().toISOString(), by, tasks: [] });
    return `Made project ${id}. Add tasks with action add (project=${id}, name, start, days or end, deps, owner).`;
  }
  if (action === 'report' && !a.project) { const ps = ganttList(); return ps.length ? ps.map(p => ganttReport(p)).join('\n\n') : 'No projects yet.'; }
  const p = ganttFind(a.project);
  const mine = t => { if (by === 'jade' && t.owner === 'user' && !(a.confirm === true || a.confirm === 'true')) throw new Error(`${t.id} ${t.name} is the user's task. Ask them first; pass confirm=true only after they agreed (or they change it on the Plans screen).`); };
  if (action === 'show') return ganttText(p) + (p.description ? `\n\n${p.description}` : '') + '\n\n' + p.tasks.filter(t => t.notes).map(t => `${t.id} notes: ${t.notes}`).join('\n');
  if (action === 'report') return ganttReport(p);
  if (action === 'add') {
    const t = { id: gNewId(p), name: String(a.name || '').trim(), start: '', end: '', deps: [], owner: a.owner === 'user' || a.owner === 'you' ? 'user' : 'jade', progress: 0 };
    if (!t.name) throw new Error('add needs a name');
    const deps = a.deps !== undefined ? [].concat(a.deps).flatMap(x => String(x).split(',')).map(x => x.trim()).filter(Boolean) : [];
    t.start = a.start ? gIso(a.start) : deps.length ? gAdd(deps.map(d => gTask(p, d).end).sort().at(-1), 1) : gToday();
    t.end = t.start; p.tasks.push(t);
    try { gFields(t, { ...a, name: undefined, start: undefined, owner: undefined, days: a.days ?? (a.end ? undefined : 1) }, p); } catch (e) { p.tasks.pop(); throw e; }
    const moved = ganttPlan(p); ganttSave(p);
    return `Added ${t.id} ${t.name}: ${t.start}${t.end !== t.start ? ' → ' + t.end : ''} (${t.owner})${t.deps.length ? ', after ' + t.deps.join(', ') : ''}.` + (moved.length ? '\nMoved to keep dependencies: ' + moved.join('; ') : '');
  }
  if (action === 'update') {
    const t = gTask(p, a.task || a.id); const before = JSON.stringify(t);
    const touchesOwner = ['name', 'start', 'end', 'days', 'owner', 'progress', 'milestone', 'deps'].some(k => a[k] !== undefined);
    if (touchesOwner) mine(t);
    gFields(t, a, p); const moved = ganttPlan(p); ganttSave(p);
    return JSON.stringify(t) === before ? 'Nothing changed.' : `Updated ${t.id} ${t.name}: ${t.start}${t.end !== t.start ? ' → ' + t.end : ''}, ${t.progress}%, ${t.owner}.` + (moved.length ? '\nMoved to keep dependencies: ' + moved.join('; ') : '');
  }
  if (action === 'link' || action === 'unlink') {
    const t = gTask(p, a.task || a.id), d = gTask(p, a.dep || a.after); mine(t);
    if (action === 'link') { if (d.id === t.id || gCycle(p, t.id, d.id)) throw new Error(`${t.id} cannot depend on ${d.id}: that makes a cycle`); if (!t.deps.includes(d.id)) t.deps.push(d.id); }
    else t.deps = t.deps.filter(x => x !== d.id);
    const moved = ganttPlan(p); ganttSave(p);
    return `${t.id} ${action === 'link' ? 'now waits for' : 'no longer waits for'} ${d.id}.` + (moved.length ? '\nMoved: ' + moved.join('; ') : '');
  }
  if (action === 'remove') {
    const t = gTask(p, a.task || a.id); mine(t);
    p.tasks = p.tasks.filter(x => x !== t); for (const x of p.tasks) x.deps = x.deps.filter(d => d !== t.id);
    ganttSave(p); return `Removed ${t.id} ${t.name}.`;
  }
  const moved = ganttPlan(p); ganttSave(p);   // plan
  return (moved.length ? 'Rescheduled:\n' + moved.join('\n') : 'Every task already starts after its dependencies.') + '\n\n' + ganttText(p);
}
WORLD_TOOL_DEFS.push({
  name: 'gantt',
  description: 'Plans: Gantt charts for long-term projects in /Jade/Projects (the user sees them on the Plans screen). Actions: projects; create (name, description); show (project: text chart); add (project, name, start YYYY-MM-DD, days or end, deps: task ids, owner jade|user, milestone, notes); update (project, task, any field, progress 0-100); link / unlink (project, task, dep); remove (project, task); plan (push tasks after their dependencies); report (late, blocked, ready, due soon, critical path; all projects without project); ready (your tasks that can start now). The user\'s tasks are theirs: changing one needs confirm=true after they agreed. With autonomous mode on, your ready tasks are worked on by the scheduler.',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: GANTT_ACTIONS }, project: { type: 'string' }, task: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, days: { type: 'number' }, deps: { type: 'array', items: { type: 'string' } }, dep: { type: 'string' }, owner: { type: 'string', enum: ['jade', 'user'] }, progress: { type: 'number' }, milestone: { type: 'boolean' }, notes: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['action'] },
});

/* ---------- the Plans screen ---------- */
const GUI = { project: ls.get('ganttProject', ''), zoom: ls.get('ganttZoom', 'day'), sel: null, drag: null };
const G_ZOOM = { day: 26, week: 9, month: 3 };
function openPlans(project) { if (project) GUI.project = project; setTab('gantt'); ganttRender(); }
function ganttRenderIfOpen() { const sec = $('[data-panel="gantt"]'); if (sec && !sec.hidden && !GUI.drag) ganttRender(); }
function ganttRender() {
  const P = $('#ganttBody'); if (!P) return;
  const ps = ganttList();
  if (!ps.some(p => p.id === GUI.project)) GUI.project = ps[0]?.id || '';
  $('#ganttProj').innerHTML = ps.length ? ps.map(p => `<option value="${esc(p.id)}"${p.id === GUI.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('') : '<option value="">No projects</option>';
  $$('#ganttZoom [data-z]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.z === GUI.zoom)));
  if (!GUI.project) { P.innerHTML = `<p class="kg-help">No plans yet. Make a project with <b>+ Project</b>, or ask Jade to plan something big ("make a plan for …").</p>`; return; }
  const p = ganttLoad(GUI.project); const today = gToday();
  if (!p.tasks.length) { P.innerHTML = `<p class="kg-help">${esc(p.name)} has no tasks yet. Add one with <b>+ Task</b>.</p>` + ganttForm(p, null); ganttWireForm(p); return; }
  const order = gTopo(p); const crit = new Set(ganttCritical(p).ids);
  const s0 = gAdd([...p.tasks.map(t => t.start), today].sort()[0], -2), s1 = gAdd([...p.tasks.map(t => t.end), today].sort().at(-1), 4);
  const dw = G_ZOOM[GUI.zoom] || 26, days = gDiff(s0, s1) + 1, RH = 30, TOP = 34, LW = 0;
  const W = days * dw, H = TOP + order.length * RH + 8;
  const x = d => LW + gDiff(s0, d) * dw;
  let grid = '', heads = '';
  for (let i = 0; i < days; i++) {
    const d = gAdd(s0, i), dt = gDate(d), wk = dt.getDay();
    const major = GUI.zoom === 'day' ? true : GUI.zoom === 'week' ? wk === 1 : dt.getDate() === 1;
    if (wk === 0 || wk === 6) grid += `<rect x="${x(d)}" y="${TOP}" width="${dw}" height="${H - TOP}" class="g-wkend"/>`;
    if (major) { grid += `<line x1="${x(d)}" y1="${TOP - 6}" x2="${x(d)}" y2="${H}" class="g-grid"/>`; heads += `<text x="${x(d) + 3}" y="${TOP - 10}" class="g-head">${GUI.zoom === 'month' ? dt.toLocaleString(undefined, { month: 'short' }) + (dt.getMonth() === 0 ? ' ' + dt.getFullYear() : '') : GUI.zoom === 'week' ? dt.getDate() + '/' + (dt.getMonth() + 1) : dt.getDate()}</text>`; }
    if (GUI.zoom === 'day' && dt.getDate() === 1) heads += `<text x="${x(d) + 3}" y="11" class="g-head g-mon">${dt.toLocaleString(undefined, { month: 'long' })}</text>`;
  }
  const row = new Map(order.map((t, i) => [t.id, i]));
  let links = '', bars = '';
  for (const t of order) for (const dId of t.deps) {
    const d = p.tasks.find(y => y.id === dId); if (!d) continue;
    const x1 = x(d.end) + (d.milestone ? dw / 2 + 5 : dw), y1 = TOP + row.get(d.id) * RH + RH / 2, x2 = x(t.start) + (t.milestone ? dw / 2 - 6 : 0), y2 = TOP + row.get(t.id) * RH + RH / 2;
    const mx = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
    links += `<path d="M${x1} ${y1} H${mx} V${y2} H${x2 - 2}" class="g-link${crit.has(t.id) && crit.has(d.id) ? ' crit' : ''}" marker-end="url(#gArrow)"/>`;
  }
  order.forEach((t, i) => {
    const y = TOP + i * RH + 6, st = gState(p, t, today), bx = x(t.start), bw = Math.max(dw, gDur(t) * dw);
    const cls = `g-bar ${st}${crit.has(t.id) ? ' crit' : ''}${t.owner === 'user' ? ' user' : ''}${GUI.sel === t.id ? ' sel' : ''}`;
    if (t.milestone) bars += `<g class="g-task" data-id="${esc(t.id)}"><path d="M${bx + dw / 2} ${y} l9 9 l-9 9 l-9 -9 z" class="g-ms ${cls}"/><text x="${bx + dw / 2 + 14}" y="${y + 13}" class="g-lab">${esc(t.name)}</text></g>`;
    else bars += `<g class="g-task" data-id="${esc(t.id)}"><rect x="${bx}" y="${y}" width="${bw}" height="18" rx="2" class="${cls}"/><rect x="${bx}" y="${y}" width="${bw * t.progress / 100}" height="18" rx="2" class="g-prog" pointer-events="none"/><text x="${bx + bw + 6}" y="${y + 13}" class="g-lab">${esc(t.name)}${t.owner === 'user' ? ' · you' : ''}${t.progress ? ' · ' + t.progress + '%' : ''}</text></g>`;
  });
  const tx = x(today) + dw / 2;
  P.innerHTML = `<div class="g-sum">${esc(ganttReport(p, today).split('\n')[0])}</div>
    <div class="g-wrap" id="ganttWrap"><svg id="ganttSvg" width="${W + 240}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="gArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="g-arrowhead"/></marker></defs>
      ${grid}${heads}${links}<line x1="${tx}" y1="0" x2="${tx}" y2="${H}" class="g-today"/><text x="${tx + 4}" y="${H - 4}" class="g-head g-todayt">today</text>${bars}
    </svg></div>
    <p class="kg-help">Drag a bar to move it, tap it to edit. Green: ready · amber: blocked or waiting · red: late · outlined: yours · bright edge: critical path.</p>` + ganttForm(p, GUI.sel ? p.tasks.find(t => t.id === GUI.sel) : null);
  const wrap = $('#ganttWrap'); if (GUI.scroll == null) wrap.scrollLeft = Math.max(0, tx - wrap.clientWidth / 3); else wrap.scrollLeft = GUI.scroll;
  wrap.onscroll = () => { GUI.scroll = wrap.scrollLeft; };
  ganttWireDrag(p, dw); ganttWireForm(p);
}
function ganttForm(p, t) {
  const v = k => esc(t ? (Array.isArray(t[k]) ? t[k].join(', ') : t[k] ?? '') : '');
  return `<div class="g-form" id="ganttForm">
    <div class="pane-h">${t ? 'Edit ' + esc(t.id) : 'New task'}</div>
    <input class="field" id="gfName" placeholder="Task name" value="${v('name')}">
    <div class="kg-row"><label class="g-l">Start <input class="field" type="date" id="gfStart" value="${t ? v('start') : gToday()}"></label><label class="g-l">End <input class="field" type="date" id="gfEnd" value="${t ? v('end') : gToday()}"></label></div>
    <div class="kg-row"><label class="g-l">Owner <select class="field" id="gfOwner"><option value="user"${!t || t.owner === 'user' ? ' selected' : ''}>You</option><option value="jade"${t && t.owner === 'jade' ? ' selected' : ''}>Jade</option></select></label>
      <label class="g-l">Done % <input class="field" type="number" min="0" max="100" step="5" id="gfProg" value="${t ? v('progress') : 0}"></label>
      <label class="kg-chk"><input type="checkbox" id="gfMs"${t?.milestone ? ' checked' : ''}> Milestone</label></div>
    <input class="field" id="gfDeps" placeholder="After (task ids, like t1, t2)" value="${v('deps')}">
    <textarea class="field" id="gfNotes" rows="2" placeholder="Notes">${v('notes')}</textarea>
    <div class="kg-row"><button class="btn btn-solid cut cut-sm" id="gfSave">${t ? 'Save' : 'Add task'}</button>${t ? '<button class="btn" id="gfNew">New task</button><button class="btn" id="gfDel">Delete</button>' : ''}<span class="kg-help" id="gfMsg"></span></div>
  </div>`;
}
function ganttWireForm(p) {
  const f = $('#ganttForm'); if (!f) return;
  const msg = (m, bad) => { const e = $('#gfMsg'); e.textContent = m; e.className = 'kg-help ' + (bad ? 'bad' : 'ok'); };
  $('#gfSave').onclick = async () => {
    const a = { project: p.id, name: $('#gfName').value, start: $('#gfStart').value, end: $('#gfEnd').value, owner: $('#gfOwner').value, progress: +$('#gfProg').value, milestone: $('#gfMs').checked, deps: $('#gfDeps').value, notes: $('#gfNotes').value };
    try {
      if (GUI.sel) { a.task = GUI.sel; await ganttTool({ ...a, action: 'update' }, 'user'); }
      else { if (!a.name.trim()) throw new Error('give the task a name'); const r = await ganttTool({ ...a, action: 'add', days: undefined }, 'user'); GUI.sel = /Added (t\d+)/.exec(r)?.[1] || null; }
      ganttRender(); toast('Saved', 'ok');
    } catch (e) { msg(e.message, true); }
  };
  const nw = $('#gfNew'); if (nw) nw.onclick = () => { GUI.sel = null; ganttRender(); };
  const del = $('#gfDel'); if (del) del.onclick = async () => { try { await ganttTool({ action: 'remove', project: p.id, task: GUI.sel }, 'user'); GUI.sel = null; ganttRender(); } catch (e) { msg(e.message, true); } };
}
function ganttWireDrag(p, dw) {
  const svg = $('#ganttSvg'); if (!svg) return;
  svg.onpointerdown = e => {
    const g = e.target.closest('.g-task'); if (!g) return;
    const t = p.tasks.find(x => x.id === g.dataset.id); if (!t) return;
    GUI.drag = { id: t.id, x0: e.clientX, days: 0, g }; try { svg.setPointerCapture(e.pointerId); } catch {}
  };
  svg.onpointermove = e => {
    const d = GUI.drag; if (!d) return;
    const n = Math.round((e.clientX - d.x0) / dw); if (n === d.days) return;
    d.days = n; d.g.setAttribute('transform', `translate(${n * dw} 0)`);
  };
  const up = () => {
    const d = GUI.drag; GUI.drag = null; if (!d) return;
    const t = p.tasks.find(x => x.id === d.id);
    if (!d.days) { GUI.sel = t.id; ganttRender(); return; }
    t.start = gAdd(t.start, d.days); t.end = gAdd(t.end, d.days); ganttPlan(p); ganttSave(p); GUI.sel = t.id; ganttRender();
  };
  svg.onpointerup = up; svg.onpointercancel = () => { GUI.drag = null; ganttRender(); };
}
function ganttWire() {
  const back = $('#btnGanttBack'); if (!back) return;
  back.onclick = () => setTab('files');
  $('#ganttProj').onchange = e => { GUI.project = e.target.value; GUI.sel = null; GUI.scroll = null; ls.set('ganttProject', GUI.project); ganttRender(); };
  $$('#ganttZoom [data-z]').forEach(b => b.onclick = () => { GUI.zoom = b.dataset.z; GUI.scroll = null; ls.set('ganttZoom', GUI.zoom); ganttRender(); });
  $('#btnGanttNew').onclick = async () => {
    const name = await jvDialog({ title: 'New project', message: 'Name the project.', def: '' }); if (!name || !String(name).trim()) return;
    try { await ganttTool({ action: 'create', name }, 'user'); GUI.project = gSlug(name); GUI.sel = null; ganttRender(); } catch (e) { toast(esc(e.message), 'err'); }
  };
  $('#btnGanttPlan').onclick = async () => { if (!GUI.project) return; try { const r = await ganttTool({ action: 'plan', project: GUI.project }, 'user'); toast(esc(r.split('\n')[0]), 'ok'); ganttRender(); } catch (e) { toast(esc(e.message), 'err'); } };
  const btn = $('#btnPlans'); if (btn) btn.onclick = () => openPlans();
}
setTimeout(ganttWire, 0);
Object.assign(window, { G_ZOOM, GUI, ganttTool, ganttList, ganttLoad, ganttSave, ganttPlan, ganttCritical, ganttReport, ganttText, ganttReady, ganttRender, openPlans, gToday, gAdd, gState, GANTT_DIR });
