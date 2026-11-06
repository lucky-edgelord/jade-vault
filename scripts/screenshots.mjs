// Takes the README screenshots: the real app at phone size, filled with demo notes (never anyone's vault).
// Run from tests/.work like the tests:  JV_WEB=…/dist/jade-vault.html node ../../scripts/screenshots.mjs
// Writes docs/screenshots/*.png.
import { start } from '../tests/_harness.mjs';
import fs from 'node:fs';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const t = await start({ scale: 2, settings: { model: 'gemma3:12b' } });
const { page, model } = t;
await page.waitForFunction(() => typeof schedTool === 'function' && typeof ganttTool === 'function' && typeof knowledgeTool === 'function', null, { timeout: 90000 });
await page.waitForTimeout(2500);   // let the seeded skills and files settle
const shot = async (name, wait = 500) => { await page.waitForTimeout(wait); await page.screenshot({ path: OUT + name + '.png' }); console.log('wrote', name); };

// ---------- demo vault
await page.evaluate(async () => {
  const w = (p, c) => vfs.write(p, c, { mkdirs: true });
  w('/Projects/Garden Shed.md', '---\ntags: [project, diy]\n---\n# Garden Shed\n\nA small cedar shed by the fence. Plan in [[Shed Plan]], materials in [[Lumber List]].\n\n- [x] Pick a site\n- [ ] Pour the base\n- [ ] Frame the walls\n\nSee also [[Weekend Ideas]] #diy');
  w('/Projects/Shed Plan.md', '# Shed Plan\n\n2.4 m × 1.8 m, pent roof, one window. Budget in [[Budget 2026]].\n\n$$A = 2.4 \\times 1.8 = 4.32\\ \\text{m}^2$$\n#diy');
  w('/Projects/Lumber List.md', '# Lumber List\n\n| Part | Qty |\n|---|---|\n| 2×4 studs | 24 |\n| OSB sheets | 8 |\n| Cedar cladding | 30 m² |\n\nFor [[Garden Shed]].');
  w('/Notes/Weekend Ideas.md', '# Weekend Ideas\n\n- Finish the [[Garden Shed]] base\n- Try the [[Sourdough]] recipe again\n- Read [[Reading List]]\n#ideas');
  w('/Notes/Sourdough.md', '# Sourdough\n\n75% hydration, 18 h cold proof. Notes from [[Weekend Ideas]]. #cooking');
  w('/Notes/Reading List.md', '# Reading List\n\n- *The Timeless Way of Building*\n- *Gödel, Escher, Bach*\n\nLinked from [[Weekend Ideas]] and [[Ideas Inbox]]. #reading');
  w('/Notes/Ideas Inbox.md', '# Ideas Inbox\n\n- A memory palace for the vault → [[Reading List]]\n- Plan the shed with Jade → [[Garden Shed]]\n#ideas');
  w('/Notes/Budget 2026.md', '# Budget 2026\n\nShed: 1 400 €. Linked from [[Shed Plan]]. #money');
  // knowledge graph
  for (const f of ['parent(ada, byron)', 'parent(byron, lovelace)', 'parent(lovelace, king)', 'person(ada)', 'person(byron)'])
    await kgAdd({ fact: f }, 'user').catch(() => {});
  await knowledgeTool({ action: 'add_rule', rule: 'ancestor(X, Y) :- parent(X, Y).\nancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).' }).catch(() => {});
  // a plan
  const g = a => ganttTool(a, 'user');
  await g({ action: 'create', name: 'Garden Shed', description: 'Build a cedar shed by the fence' });
  const d = n => gAdd(gToday(), n);
  await g({ action: 'add', project: 'garden-shed', name: 'Design and permit', start: d(-6), days: 5, owner: 'jade', progress: 100 });
  await g({ action: 'add', project: 'garden-shed', name: 'Order lumber', days: 2, deps: ['t1'], owner: 'user', progress: 100 });
  await g({ action: 'add', project: 'garden-shed', name: 'Pour the base', days: 3, deps: ['t2'], owner: 'user', progress: 40 });
  await g({ action: 'add', project: 'garden-shed', name: 'Cut list and costs', days: 2, deps: ['t1'], owner: 'jade', progress: 60 });
  await g({ action: 'add', project: 'garden-shed', name: 'Frame the walls', days: 4, deps: ['t3'], owner: 'user' });
  await g({ action: 'add', project: 'garden-shed', name: 'Roof and cladding', days: 5, deps: ['t5'], owner: 'user' });
  await g({ action: 'add', project: 'garden-shed', name: 'Paint guide', days: 2, deps: ['t4'], owner: 'jade' });
  await g({ action: 'add', project: 'garden-shed', name: 'Shed done', milestone: true, deps: ['t6', 't7'] });
  // the queue
  clearInterval(AUTO.timer); AUTO.tasks = []; AUTO.hist = [];
  autoAdd({ title: 'Summarise new notes', goal: 'Summarise notes changed today into the daily note', kind: 'prompt', tier: 2, priority: 70 }, 'jade');
  autoAdd({ title: 'Reading list: find editions', goal: 'Find good editions for the reading list', tier: 3 }, 'user');
  autoAdd({ title: 'Garden Shed: Cut list and costs', goal: 'Work on the cut list', tier: 3, gantt: { project: 'garden-shed', task: 't4' } }, 'plan');
  autoAdd({ title: 'Back up the vault', kind: 'shell', command: 'backup now', tier: 2, priority: 40 }, 'user');
  const now = Date.now();
  [[3, 3, 'continue'], [2, 1, 'done'], [3, 5, 'continue'], [3, 2, 'continue'], [2, 4, 'done'], [3, 8, 'continue'], [1, 2, 'done'], [3, 4, 'done'], [2, 3, 'done'], [3, 6, 'continue']]
    .forEach(([tier, steps, outcome], i) => AUTO.hist.push({ t: now - (10 - i) * 600e3, id: 'q' + (i % 4 + 1), title: ['Summarise new notes', 'Reading list: find editions', 'Garden Shed: Cut list and costs', 'Back up the vault'][i % 4], tier, steps, outcome, note: outcome === 'done' ? 'finished' : 'next: compare prices' }));
  AUTO.tasks[1].slices = 3; AUTO.tasks[1].steps = 11; AUTO.tasks[1].level = 1;
  AUTO.cfg.on = true; AUTO.cfg.quietFrom = AUTO.cfg.quietTo = 0; autoSave();
  // schedules
  try { scheduleTool({ action: 'add', name: 'Morning brief', when: 'every weekday at 8am', prompt: 'Summarise TODO.md and today\'s calendar.' }); } catch {}
  try { scheduleTool({ action: 'add', name: 'Weekly review', when: 'every sunday at 6pm', prompt: 'Review the week\'s notes and update Plans.' }); } catch {}
});

// ---------- chat
model.chatReply = (msgs) => {
  const tools = msgs.filter(m => m.role === 'tool').length;
  if (tools === 0) return { tool_calls: [{ function: { name: 'gantt', arguments: { action: 'report', project: 'garden-shed' } } }] };
  return { content: 'The shed is on track. **Pour the base** (yours) is 40% done and on the critical path, so it sets the finish date. I\'m on **Cut list and costs** (60%) and will have the paint guide ready when it unblocks.\n\nWant me to queue a reminder to order the cladding before the framing starts?' };
};
await page.evaluate(() => setTab('chat'));
await page.fill('#input', 'How is the garden shed going?');
await page.evaluate(() => document.querySelector('#btnSend').click());
await page.waitForFunction(() => !running && cur && cur.messages.length >= 4, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^hide$/i.test(x.textContent.trim()) && x.offsetParent); b?.click(); });
await shot('chat', 800);

// ---------- screens
await page.evaluate(() => { setTab('files'); openFile('/Projects/Garden Shed.md'); });
await shot('note', 900);
await page.evaluate(() => document.querySelector('#btnGraph').click());
await shot('graph', 2500);
await page.evaluate(() => document.querySelector('#btnKnowledge').click());
await page.evaluate(() => { document.querySelector('#kgQ').value = 'ancestor(ada, king)'; document.querySelector('#kgDoVerify').click(); });
await shot('knowledge', 1200);
await page.evaluate(() => { GUI.zoom = 'week'; GUI.scroll = null; GUI.sel = 't3'; openPlans('garden-shed'); const w = document.querySelector('#ganttWrap'); if (w) w.scrollLeft = 0; });
await shot('plans', 900);
await page.evaluate(() => openQueue());
await shot('queue', 700);
await page.evaluate(() => setTab('sched'));
await shot('schedule', 700);
await page.evaluate(() => setTab('term'));
await page.evaluate(() => { const f = document.querySelector('#termCmd'); f.value = 'node /Jade/tools/lisp.js eval \'(map (lambda (x) (* x x)) (range 1 8))\''; f.form.requestSubmit(); });
await page.waitForTimeout(3500);
await page.evaluate(() => { const f = document.querySelector('#termCmd'); f.value = 'ls /Projects'; f.form.requestSubmit(); });
await shot('shell', 1500);
await page.evaluate(() => openApp('Vault Loci'));
await shot('loci', 3500);
await t.done();
