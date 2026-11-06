// 2.26: the 3-tier scheduler and autonomous mode (sched), Plans (gantt) and Jade Lisp (lisp), in the real page with a
// scripted model.
import { start } from './_harness.mjs';

const t = await start();
const { page, ok, model } = t;
await page.waitForFunction(() => typeof schedTool === 'function' && typeof ganttTool === 'function' && typeof lispTool === 'function', null, { timeout: 90000 });
await page.waitForFunction(() => vfs.isFile('/Jade/tools/lisp.js') && vfs.isFile('/Jade/skills/autonomy/SKILL.md') && vfs.isFile('/Jade/skills/lisp-dsl/SKILL.md'), null, { timeout: 20000 }).catch(() => {});
const ev = (f, a) => page.evaluate(([f, a]) => window[f](a).then(r => r, e => 'ERR ' + e.message), [f, a]);
const sched = a => ev('schedTool', a), gantt = a => page.evaluate(a => ganttTool(a, 'jade').then(r => r, e => 'ERR ' + e.message), a), lisp = a => ev('lispTool', a);

// ---------- seeding and tools
ok(await page.evaluate(() => ['/Jade/tools/lisp.js', '/Jade/Lisp/lib/dsl.jl', '/Jade/Lisp/examples/rules.jl', '/Jade/skills/lisp-dsl/SKILL.md', '/Jade/skills/autonomy/SKILL.md'].every(p => vfs.isFile(p))), 'Lisp files and both skills are seeded');
ok(await page.evaluate(() => ['lisp', 'sched', 'gantt'].every(n => activeTools().some(t => t.function.name === n))), 'lisp, sched and gantt are tools');
ok(await page.evaluate(() => { vfs.write('/Jade/Lisp/lib/dsl.jl', ';; mine\n'); lispSeed(); const mine = vfs.read('/Jade/Lisp/lib/dsl.jl') === ';; mine\n'; lispSeed(true); return mine && /make-dsl/.test(vfs.read('/Jade/Lisp/lib/dsl.jl')); }), 'a seeded file the user changed (no marker) is kept');

// ---------- Jade Lisp, with real tools
let r = await lisp({ code: '(+ 1 2 3)' }); ok(r === '6', 'lisp evaluates: ' + r);
await page.evaluate(() => vfs.write('/Notes/lisp-in.md', 'hello lisp', { mkdirs: true }));
r = await lisp({ code: '(write-file "/Notes/lisp-out.md" (string-upcase (tool/read :path "/Notes/lisp-in.md"))) (read-file "/Notes/lisp-out.md")' });
ok(/HELLO LISP/.test(r) && await page.evaluate(() => /HELLO LISP/.test(vfs.read('/Notes/lisp-out.md'))), 'lisp calls the read and write tools: ' + r);
r = await lisp({ file: '/Jade/Lisp/examples/rules.jl' }); ok(/alerts: \(\(hot 31\) \(muggy\) \(weekend\)\)/.test(r) && /blocked: unbound symbol: read-file/.test(r), 'the sandboxed rules DSL example: ' + r.split('\n')[0]);
r = await lisp({ code: '(let loop () (loop))', fuel: 5000 }); ok(/out of fuel after 5000/.test(r), 'fuel limit: ' + r);
r = await lisp({ code: '(tool/read :path "/x")', pure: true }); ok(/unbound symbol: tool\/read|unbound symbol: jade\/tool/.test(r), 'pure blocks tools: ' + r);
r = await lisp({ code: '(gantt-missing)' }); ok(/^\[exit 1\]/.test(r) && /unbound symbol: gantt-missing/.test(r), 'errors come back with the exit code');
r = await lisp({ code: '(get (json-parse (tool/gantt :action "projects")) :x)' }); ok(/lisp error/.test(r) || r === 'nil', 'tool text that is not JSON gives a clear error: ' + r.slice(0, 80));

// ---------- Plans (Gantt)
r = await gantt({ action: 'create', name: 'Garden Shed', description: 'Build a shed' }); ok(/Made project garden-shed/.test(r), 'create: ' + r);
const today = await page.evaluate(() => gToday()), plus = n => page.evaluate(n => gAdd(gToday(), n), n);
r = await gantt({ action: 'add', project: 'garden-shed', name: 'Design', start: today, days: 3 }); ok(/Added t1 Design/.test(r), 'add t1: ' + r);
r = await gantt({ action: 'add', project: 'garden-shed', name: 'Buy wood', days: 2, deps: ['t1'], owner: 'user' }); ok(/Added t2 Buy wood: (\S+) → (\S+) \(user\), after t1/.test(r) && r.includes(await plus(3)), 'a dependent task starts after t1: ' + r);
r = await gantt({ action: 'add', project: 'garden-shed', name: 'Build', days: 4, deps: 't2' }); ok(/Added t3/.test(r), 'add t3');
r = await gantt({ action: 'add', project: 'garden-shed', name: 'Done', milestone: true, deps: 't3' }); ok(/Added t4 Done/.test(r), 'a milestone');
r = await gantt({ action: 'link', project: 'garden-shed', task: 't1', dep: 't3' }); ok(/cycle/.test(r), 'cycles are refused: ' + r);
r = await gantt({ action: 'update', project: 'garden-shed', task: 't1', days: 5 }); ok(/Moved to keep dependencies: t2 Buy wood/.test(r), 'longer t1 pushes t2 and the rest: ' + r);
r = await gantt({ action: 'update', project: 'garden-shed', task: 't2', progress: 50 }); ok(/is the user's task/.test(r), "Jade cannot change the user's task without confirm");
r = await gantt({ action: 'update', project: 'garden-shed', task: 't2', notes: 'pine' }); ok(/Updated t2/.test(r), 'notes on a user task are fine');
r = await gantt({ action: 'show', project: 'garden-shed' }); ok(/Garden Shed/.test(r) && /t1 Design/.test(r) && /◆/.test(r) && /\^ today/.test(r), 'text chart:\n' + r.split('\n').slice(0, 3).join('\n'));
r = await gantt({ action: 'report', project: 'garden-shed' }); ok(/Ready:\n  t1 Design/.test(r) && /Critical path: t1 → t2 → t3 → t4/.test(r), 'report with the critical path: ' + r.replace(/\n/g, ' | '));
r = await gantt({ action: 'ready' }); ok(/Garden Shed \/ t1 Design/.test(r) && !/t2/.test(r), 'ready lists only Jade\'s startable tasks: ' + r);
ok(await page.evaluate(() => vfs.isFile('/Jade/Projects/garden-shed.json')), 'saved in /Jade/Projects');
await page.evaluate(() => openPlans('garden-shed'));
ok(await page.evaluate(() => document.querySelectorAll('#ganttSvg .g-task').length === 4 && !!document.querySelector('#ganttSvg .g-today') && document.querySelectorAll('#ganttSvg .g-link').length === 3), 'the Plans screen draws bars, links and today');
// drag t3 two days later on the chart: t4 follows
const dw = await page.evaluate(() => G_ZOOM[GUI.zoom]);
const box = await page.evaluate(() => { const el = document.querySelector('#ganttSvg .g-task[data-id="t3"] rect'); el.scrollIntoView({ block: 'center', inline: 'start' }); const r = el.getBoundingClientRect(); return { x: r.x + 5, y: r.y + 5 }; });
const t3before = await page.evaluate(() => ganttLoad('garden-shed').tasks.find(t => t.id === 't3').start);
await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + dw * 2 + 2, box.y, { steps: 4 }); await page.mouse.up();
const after = await page.evaluate(() => { const p = ganttLoad('garden-shed'); return { t3: p.tasks.find(t => t.id === 't3').start, t4: p.tasks.find(t => t.id === 't4').start, t3end: p.tasks.find(t => t.id === 't3').end }; });
ok(after.t3 === await page.evaluate(([d]) => gAdd(d, 2), [t3before]) && after.t4 >= after.t3end, 'dragging a bar moves it and its dependants: ' + t3before + ' ' + JSON.stringify(after));
ok(await page.evaluate(() => document.querySelector('#gfName')?.value === 'Build'), 'a tap (or drag) selects the task for editing');

// ---------- the scheduler: picking order
await page.evaluate(() => { AUTO.tasks = []; AUTO.hist = []; AUTO.picks = 0; autoSave(); clearInterval(AUTO.timer); });
r = await sched({ action: 'status' }); ok(/Autonomous mode: OFF/.test(r), 'off by default: ' + r.split('\n')[0]);
for (const a of [{ goal: 'long A', title: 'A' }, { goal: 'long B', title: 'B' }, { kind: 'prompt', goal: 'p30', title: 'P30', priority: 30 }, { kind: 'prompt', goal: 'p80', title: 'P80', priority: 80 }])
  ok(/^Queued q\d/.test(await sched({ action: 'add', ...a })), 'queued ' + a.title);
const pick = () => page.evaluate(() => autoPick()?.title || null);
ok(await pick() === 'P80', 'tier 2 highest priority first');
await page.evaluate(() => autoAdd({ title: 'URGENT', goal: 'now', kind: 'prompt', tier: 1 }, 'user'));
ok(await pick() === 'URGENT', 'tier 1 interrupts come before everything');
await page.evaluate(() => { AUTO.tasks.find(t => t.title === 'URGENT').state = 'done'; AUTO.picks = 0; });
const seq = await page.evaluate(() => { const out = []; for (let i = 0; i < 8; i++) out.push(autoPick().tier); return out.join(''); });
ok(seq === '22232223', 'tier 3 gets every 4th pick while tier 2 is busy: ' + seq);
ok(await page.evaluate(() => { const now = Date.now(); const a = AUTO.tasks.find(t => t.title === 'P30'); a.enq = now - 120 * 60000; return autoEffPrio(a, now) === 70 && autoEffPrio({ prio: 60, enq: now }, now) < 70; }), 'aging: P30 that waited 2 hours counts as 70 (capped at +40) and outranks a fresh 60');
ok(await page.evaluate(() => { const a = AUTO.tasks.find(t => t.title === 'A'), b = AUTO.tasks.find(t => t.title === 'B'); a.level = 1; b.level = 0; AUTO.picks = 3; AUTO.tasks.filter(t => t.tier === 2).forEach(t => t.state = 'paused'); return autoPick().title === 'B'; }), 'round robin: a lower level goes first');
ok(await page.evaluate(() => { const a = AUTO.tasks.find(t => t.title === 'A'); a.enq = Date.now() - 31 * 60000; autoPick(); return a.level === 0; }), 'a goal that waited 30 minutes rises a level');
r = await sched({ action: 'add', goal: 'x', tier: 1 }); r = await sched({ action: 'add', goal: 'y', tier: 1 }); r = await sched({ action: 'add', goal: 'z', tier: 1 }); r = await sched({ action: 'add', goal: 'w', tier: 1 });
ok(/already have 3 interrupts/.test(r), 'Jade may hold at most 3 interrupts: ' + r);

// ---------- budgets, quiet hours, pauses
await page.evaluate(() => { AUTO.tasks = []; AUTO.hist = []; autoSave(); Object.assign(AUTO.cfg, { on: true, gantt: false, quietFrom: 0, quietTo: 0, pauseOnUse: true, idleSec: 90, stepsPerHour: 10, dailyCap: 100 }); AUTO.lastUse = 0; });
ok(await page.evaluate(() => autoBlocked()) === '', 'on, no quiet hours, idle user: it may run');
ok(/quiet hours/.test(await page.evaluate(() => { const h = new Date().getHours(); AUTO.cfg.quietFrom = h; AUTO.cfg.quietTo = (h + 1) % 24; const w = autoBlocked(); AUTO.cfg.quietFrom = AUTO.cfg.quietTo = 0; return w; })), 'quiet hours stop it');
ok(/using the app/.test(await page.evaluate(() => { AUTO.lastUse = Date.now(); const w = autoBlocked(); AUTO.lastUse = 0; return w; })), 'it pauses while the user uses the app');
await page.mouse.click(5, 5); ok(await page.evaluate(() => Date.now() - AUTO.lastUse < 5000), 'a tap counts as using the app');
await page.evaluate(() => { AUTO.lastUse = 0; });
ok(/hourly budget/.test(await page.evaluate(() => { AUTO.hist.push({ t: Date.now(), steps: 10 }); const w = autoBlocked(); AUTO.hist = []; return w; })), 'the hourly budget stops it');

// ---------- a goal in slices (scripted model)
let calls = 0;
model.chatReply = (msgs) => {
  const sys = msgs[0]?.content || ''; if (!/autonomous mode/.test(sys)) return null;
  const task = msgs.find(m => m.role === 'user')?.content || ''; const tools = msgs.filter(m => m.role === 'tool').length;
  calls++;
  if (/Write the poem/.test(task)) {
    if (/Your notes from the last slice/.test(task)) return tools ? { content: 'Finished the poem in /Notes/poem.md.\nSTATUS: done' } : { tool_calls: [{ function: { name: 'write', arguments: { path: '/Notes/poem.md', content: 'roses\nare red' } } }] };
    if (tools < 2) return { tool_calls: [{ function: { name: 'read', arguments: { path: '/Notes/lisp-in.md' } } }] };
    return { content: 'Read the notes; drafting next.\nSTATUS: continue — write it' };
  }
  if (/Call the user/.test(task)) return tools ? { content: 'waiting' } : { tool_calls: [{ function: { name: 'phone', arguments: { action: 'call', number: '123' } } }] };
  if (/Ask for the address/.test(task)) return { content: 'I need the address.\nSTATUS: blocked: which address?' };
  if (/Plan task/.test(task) || /from the plan/.test(task)) return { content: 'Did the design.\nSTATUS: done' };
  return { content: 'ok\nSTATUS: done' };
};
await page.evaluate(() => autoAdd({ title: 'Poem', goal: 'Write the poem' }, 'user'));
let ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, level: t.level, slices: t.slices, steps: t.steps, memo: t.memo }));
ok(ran && ran.state === 'ready' && ran.level === 1 && ran.slices === 1 && ran.steps === 3 && /drafting next/.test(ran.memo), 'slice 1: used the whole 2-step quantum (+ the wrap-up), so it drops to level 1: ' + JSON.stringify(ran));
ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, slices: t.slices }));
ok(ran && ran.state === 'done' && ran.slices === 2 && await page.evaluate(() => vfs.read('/Notes/poem.md') === 'roses\nare red'), 'slice 2 remembers the note and finishes: ' + JSON.stringify(ran));
ok(await page.evaluate(() => /q\d+ T3\.\d "Poem" · \d steps · done/.test(vfs.read('/Jade/Autonomy/log.md')) && vfs.read('/Jade/Autonomy/slices.jsonl').trim().split('\n').length === 2), 'every slice is logged in /Jade/Autonomy');
// approval
await page.evaluate(() => { AUTO.cfg.stepsPerHour = 1000; autoAdd({ title: 'Call', goal: 'Call the user', tier: 2, kind: 'goal' }, 'user'); });
ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, need: t.need?.tool }));
ok(ran && ran.state === 'waiting' && ran.need === 'phone', 'a denied tool waits for approval: ' + JSON.stringify(ran));
r = await sched({ action: 'resume', id: await page.evaluate(() => AUTO.tasks.find(t => t.title === 'Call').id) }); ok(/only they can allow it/.test(r), 'Jade cannot approve for herself');
await page.evaluate(() => openQueue());
ok(await page.evaluate(() => document.querySelector('#autoBody .aq-row.waiting [data-a="allow"]') !== null && /Wants to use/.test(document.querySelector('#autoBody').textContent)), 'the Queue screen shows the request with Allow and Deny');
await page.click('#autoBody .aq-row.waiting [data-a="allow"]', { timeout: 5000 }).catch(async e => { console.log(t.fail.join('\n')); console.log(await page.evaluate(() => JSON.stringify(AUTO.tasks.map(x => [x.title, x.state, x.need, x.error])))); throw e; });
ok(await page.evaluate(() => { const t = AUTO.tasks.find(t => t.title === 'Call'); return t.state === 'ready' && t.allow.includes('phone'); }), 'Allow lets that tool through for this task');
// blocked
await page.evaluate(() => { AUTO.tasks.find(t => t.title === 'Call').state = 'cancelled'; autoAdd({ title: 'Addr', goal: 'Ask for the address' }, 'user'); });
ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, why: t.why }));
ok(ran && ran.state === 'blocked' && ran.why === 'which address?', 'STATUS: blocked parks the task with the reason: ' + JSON.stringify(ran));
// non-model kinds
await page.evaluate(() => vfs.write('/Jade/Lisp/sum.jl', '(print (sum (range 101)))', { mkdirs: true }));
r = await sched({ action: 'add', kind: 'lisp', file: '/Jade/Lisp/sum.jl', tier: 2 }); ok(/kind|lisp/.test(r), 'a lisp task');
ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, result: t.result, steps: t.steps }));
ok(ran && ran.state === 'done' && /5050/.test(ran.result), 'a lisp task runs: ' + JSON.stringify(ran));
r = await sched({ action: 'add', kind: 'shell', command: 'echo from-shell', tier: 2 });
ran = await page.evaluate(() => autoTick().then(t => t && { state: t.state, result: t.result }));
ok(ran && ran.state === 'done' && /from-shell/.test(ran.result), 'a shell task runs: ' + JSON.stringify(ran));
// plan tasks become tier 3 goals and are marked done
await page.evaluate(() => { AUTO.cfg.gantt = true; AUTO.lastGantt = 0; AUTO.tasks.forEach(t => { if (t.state === 'blocked') t.state = 'cancelled'; }); });
ran = await page.evaluate(() => autoTick().then(t => t && { title: t.title, state: t.state, gantt: t.gantt }));
ok(ran && ran.title === 'Garden Shed: Design' && ran.state === 'done' && ran.gantt?.task === 't1', 'a ready plan task is picked up as a tier 3 goal: ' + JSON.stringify(ran));
ok(await page.evaluate(() => ganttLoad('garden-shed').tasks.find(t => t.id === 't1').progress === 100), 'finishing it marks the plan task 100%');
ok(await page.evaluate(() => { autoFromGantt(); return AUTO.tasks.filter(t => t.gantt?.task === 't1').length === 1; }), 'a finished plan task is not queued again');
// the loop and the stop button
await page.evaluate(() => { AUTO.cfg.tickMs = 300; autoStart(); autoAdd({ title: 'Loop', goal: 'anything' }, 'user'); });
await page.waitForFunction(() => AUTO.tasks.find(t => t.title === 'Loop')?.state === 'done', null, { timeout: 15000 }).catch(() => {});
ok(await page.evaluate(() => AUTO.tasks.find(t => t.title === 'Loop')?.state === 'done'), 'the loop runs tasks on its own while it is on');
await page.evaluate(() => openQueue()); await page.click('#btnAutoStop');
ok(await page.evaluate(() => !AUTO.cfg.on && !document.querySelector('#autoOn').checked && /autonomous mode OFF/.test(vfs.read('/Jade/Autonomy/log.md'))), 'Stop turns it off');
await page.evaluate(() => autoAdd({ title: 'After', goal: 'anything' }, 'user')); await page.waitForTimeout(900);
ok(await page.evaluate(() => AUTO.tasks.find(t => t.title === 'After').state === 'ready'), 'nothing runs while it is off');
ok(await page.evaluate(() => document.querySelectorAll('#autoBody .aq-tier').length === 4 && document.querySelectorAll('#autoBody .aq-s').length >= 5), 'the Queue screen shows three tiers, recent slices and the slice strip');
r = await sched({ action: 'log', limit: 3 }); ok(r.split('\n').length === 3, 'log');
ok(await page.evaluate(() => document.querySelector('#btnPlans') && document.querySelector('#btnQueue')), 'Plans and Queue buttons are in the Files bar');

await t.done();
