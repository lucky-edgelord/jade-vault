import pw from 'playwright';
import fs from 'node:fs';
const { chromium } = pw;
const OUT = process.cwd() + '/vshots_apk'; fs.mkdirSync(OUT, { recursive: true });
const css = fs.readFileSync('tw.css', 'utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const log = []; const fail = [];
const ok = (c, m) => { (c ? log : fail).push((c ? 'PASS ' : 'FAIL ') + m); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { if (!localStorage.getItem('jvault:settings')) localStorage.setItem('jvault:settings', JSON.stringify({ model: 'qwen3:8b' })); });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${m.type()}] ${m.text().slice(0, 240)}`); });
page.on('pageerror', e => fail.push('[pageerror] ' + e.message));
const script = [
  { name: 'notes_search', arguments: { query: '' } },
  { name: 'note_links', arguments: { note: 'Inbox' } },
  { name: 'notes_search', arguments: { query: '#guide' } },
  { name: 'write', arguments: { path: '/Map of Content.md', content: '# Map of Content\n\n## #guide\n- [[Markdown Reference]]\n- [[Linking Notes]]\n- [[Graph View]]\n\n## Other\n- [[Inbox]]\n- [[Welcome]]\n' } },
  { name: 'open_note', arguments: { note: 'Map of Content' } },
];
const toolOut = []; let sentUser0 = '';
await page.route('**/*', async route => {
  const req = route.request(); const url = req.url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (url.startsWith('https://cdn.tailwindcss.com/')) return route.fulfill({ contentType: 'text/javascript', body: `window.tailwind={};(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.prepend(s);})();` });
  if (url.includes('marked.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'marked/lib/marked.umd.js', 'utf8') });
  if (url.includes('katex.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'katex/dist/katex.min.js', 'utf8') });
  if (url.includes('katex.min.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(process.env.JV_NM + 'katex/dist/katex.min.css', 'utf8') });
  if (url.includes('purify.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.JV_NM + 'dompurify/dist/purify.min.js', 'utf8') });
  if (url === 'http://localhost:11434/api/tags') return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) });
  if (url === 'http://localhost:11434/api/chat') {
    const body = JSON.parse(req.postData());
    if (/You keep Jade's diary/.test(body.messages[0].content)) { log.push('[journal call] ' + body.messages[1].content.slice(0, 60).replace(/\n/g, ' ')); return route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: { role: 'assistant', content: 'SUMMARY:\n- The user asked for a map of content; Jade built [[Map of Content]].\n\nREMEMBER:\n- The user organises notes by tag\n- none' }, done: true }) }); }
    const tools = body.tools.map(t => t.function.name);
    const tmsgs = body.messages.filter(m => m.role === 'tool'); const n = tmsgs.length;
    sentUser0 = (body.messages.find(m => m.role === 'user' && !m.content.startsWith('[Summary')) || {}).content || ''; sentUser0 = sentUser0.replace(/^\[\w{3} [^\]]+\] /, '');
    if (n) toolOut[n - 1] = tmsgs[n - 1].content;
    if (n === 0) log.push('tools offered: ' + tools.join(','));
    if (n === 0) log.push('system prompt head: ' + body.messages[0].content.slice(0, 120).replace(/\n/g, ' '));
    let lines;
    if (n < script.length) lines = [{ message: { role: 'assistant', content: '', tool_calls: [{ function: script[n] }] }, done: false }];
    else lines = ['Done. I built [[Map of Content]] linking every note, grouped by tag. ', 'Your [[Inbox]] has one unresolved link to [[Neon Plan]]. #guide'].map(c => ({ message: { role: 'assistant', content: c }, done: false }));
    lines.push({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 900, eval_count: 60, eval_duration: 1.5e9 });
    return route.fulfill({ headers: CORS, contentType: 'application/x-ndjson', body: lines.map(l => JSON.stringify(l)).join('\n') + '\n' });
  }
  return route.abort();
});
const overflow = async (label) => { const r = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(r <= 0, `no horizontal overflow on ${label} (${r})`); };
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto('file://' + process.env.JV_APK);
await page.waitForFunction(() => /BUSYBOX|JS APPLETS/.test(document.querySelector('#txtShell')?.textContent || ''), null, { timeout: 90000 });
await page.waitForTimeout(1500);
ok(await page.title() === 'Jade Vault', 'title');
ok(/second brain/.test(await page.textContent('#chat')), 'empty state hero');
ok(/\d+ notes, \d+ links/.test(await page.textContent('#chat')), 'vault boot row');
await shot('1_chat'); await overflow('chat');

// Notes tab
await page.tap('.tab[data-tab="files"]'); await page.waitForTimeout(300);
const treeTxt = await page.textContent('#tree');
ok(/Welcome/.test(treeTxt) && /guides\//.test(treeTxt) && !/Welcome\.md/.test(treeTxt), 'tree shows notes by name');
ok(await page.locator('#tree .lk-badge').count() > 3, 'link badges in tree');
ok(/\d+ notes · \d+ links/.test(await page.textContent('#fsStats')), 'stats: ' + await page.textContent('#fsStats'));
ok(await page.locator('#tagBar .tag-chip').count() >= 4, 'tag bar');
await shot('2_notes'); await overflow('notes');
await page.tap('#tree .tree-row[data-p="/guides"]'); await page.waitForTimeout(200);
await page.fill('#noteSearch', 'constellation'); await page.waitForTimeout(400);
ok(await page.locator('#searchRes .search-hit').count() >= 1 && await page.locator('#searchRes mark').count() >= 1, 'search with highlight');
await shot('3_search');
await page.tap('#tagBar .tag-chip[data-tag="guide"]'); await page.waitForTimeout(300);
ok(await page.inputValue('#noteSearch') === '#guide' && await page.locator('#searchRes .search-hit').count() === 3, 'tag filter (#guide → 3) got ' + await page.locator('#searchRes .search-hit').count());
await page.tap('#btnSearchClear'); await page.waitForTimeout(200);

// open Welcome in read mode
await page.tap('#tree .tree-row[data-p="/Welcome.md"]'); await page.waitForTimeout(400);
ok(await page.getAttribute('#noteBody', 'data-mode') === 'read', 'opens in read mode');
ok(await page.locator('#notePrev .wiki-link:not(.missing)').count() >= 4, 'resolved wiki links rendered');
ok(await page.locator('#notePrev .wiki-link.missing').count() >= 1, 'missing wiki link rendered');
await shot('4_read'); await overflow('read');
await page.tap('#btnLinks'); await page.waitForTimeout(200);
ok(/Backlinks · [1-9]/.test(await page.textContent('#linksPanel')), 'backlinks panel: ' + (await page.textContent('#linksPanel')).slice(0, 80));
await shot('5_links');
await page.tap('#btnLinks');
// follow link
await page.locator('#notePrev .wiki-link', { hasText: 'Linking Notes' }).first().tap(); await page.waitForTimeout(400);
ok(await page.textContent('#filePath') === 'Linking Notes', 'followed wiki link');
// heading link
await page.locator('#notePrev .wiki-link', { hasText: 'Tasks' }).first().tap(); await page.waitForTimeout(500);
ok(await page.textContent('#filePath') === 'Markdown Reference', 'heading link opens target note');
await page.tap('#btnFileBack'); await page.waitForTimeout(300);
ok(await page.textContent('#filePath') === 'Linking Notes', 'back pops history');
// markdown link to .md
await page.locator('#notePrev a.wiki-link', { hasText: 'the reference' }).first().tap(); await page.waitForTimeout(300);
ok(await page.textContent('#filePath') === 'Markdown Reference', 'md link to .md opens note');
await shot('6_reference');
await page.tap('#btnFileBack'); await page.waitForTimeout(200); await page.tap('#btnFileBack'); await page.waitForTimeout(300);
ok(await page.textContent('#filePath') === 'Welcome', 'back twice → Welcome');
// missing link creates note
await page.locator('#notePrev .wiki-link.missing').first().tap(); await page.waitForTimeout(400);
const created = await page.evaluate(() => editing);
ok(created === '/wiki links.md' && await page.getAttribute('#noteBody', 'data-mode') === 'edit', 'missing link created ' + created);
// type [[ autocomplete
await page.locator('#fileEd').focus();
await page.keyboard.type('See [[Mark');
await page.waitForTimeout(200);
ok(!(await page.locator('#linkSuggest').isHidden()) && /Markdown Reference/.test(await page.textContent('#linkSuggest')), 'link suggestions show');
await shot('7_suggest');
await page.locator('#linkSuggest button', { hasText: 'Markdown Reference' }).tap(); await page.waitForTimeout(100);
await page.keyboard.type(' for syntax.');
await page.waitForTimeout(1000);
const saved = await page.evaluate(() => vfs.read('/wiki links.md'));
ok(/See \[\[Markdown Reference\]\] for syntax\./.test(saved), 'autocomplete inserted + autosaved: ' + JSON.stringify(saved.slice(-60)));
ok(/Linked from \[\[Welcome\]\]/.test(saved), 'new note links back');
await page.tap('#modeSeg button[data-mode="split"]'); await page.waitForTimeout(400);
ok(await page.locator('#notePrev .wiki-link', { hasText: 'Markdown Reference' }).count() === 1, 'split preview renders');
await page.locator('#fileEd').blur(); await page.waitForTimeout(300);
await shot('8_split');
// toolbar
await page.tap('#modeSeg button[data-mode="edit"]');
await page.evaluate(() => { const t = $('#fileEd'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
await page.tap('#mdTools button[data-md="task"]'); await page.keyboard.type('buy chrome');
await page.waitForTimeout(900);
ok(/- \[ \] buy chrome/.test(await page.evaluate(() => vfs.read('/wiki links.md'))), 'task toolbar button');
// Todo List checkbox toggling
await page.evaluate(() => openFile('/Todo List.md', { mode: 'read' })); await page.waitForTimeout(300);
await page.locator('#notePrev input[type=checkbox]').nth(1).click(); await page.waitForTimeout(300);
ok(/- \[x\] Write a note/.test(await page.evaluate(() => vfs.read('/Todo List.md'))), 'checkbox toggles source');
await shot('9_todo');
// graph
await page.tap('#btnNoteGraph'); await page.waitForTimeout(1200);
ok(await page.evaluate(() => Graph.local && Graph.nodes.length >= 3), 'local graph ' + await page.evaluate(() => Graph.nodes.length));
await shot('10_graph_local');
await page.tap('#btnGraphLocal'); await page.waitForTimeout(1500);
const gn = await page.evaluate(() => [Graph.nodes.length, Graph.edges.length, Graph.nodes.filter(n => n.kind === 'missing').length]);
ok(gn[0] >= 9 && gn[1] >= 8, 'global graph nodes/edges/missing ' + gn);
await shot('11_graph');
// tap a node to open
const pos = await page.evaluate(() => { const n = Graph.byId.get('/Welcome.md'); const cv = $('#graphCv'); const r = cv.getBoundingClientRect(); return { x: r.left + cv.clientWidth / 2 + (n.x + Graph.cam.x) * Graph.cam.k, y: r.top + cv.clientHeight / 2 + (n.y + Graph.cam.y) * Graph.cam.k }; });
await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(400);
ok(await page.textContent('#filePath') === 'Welcome', 'tap graph node opens note');
// android back from note → history → files
await page.evaluate(() => { while (noteHist.length) noteHist.pop(); });
await page.evaluate(() => window.__androidBack()); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.body.dataset.screen) === 'files', 'android back from note → notes list');

// Shell
await page.tap('.tab[data-tab="term"]'); await page.waitForTimeout(300);
for (const c of ['tags', 'search neon', 'links Welcome', 'backlinks Inbox', 'node scripts/vault-stats.js', 'grep -rl "\\[\\[Inbox\\]\\]" /']) { await page.fill('#termCmd', c); await page.press('#termCmd', 'Enter'); await page.waitForTimeout(1500); }
// the whole terminal, scrollback included (xterm keeps only the visible rows in the page)
const termTxt = await page.evaluate(() => { const t = window.term?._t; if (!t) return document.querySelector('#term').innerText; const b = t.buffer.active; let x = ''; for (let i = 0; i < b.length; i++) x += (b.getLine(i)?.translateToString(true) || '') + '\n'; return x; });
ok(/#guide\s+3/.test(termTxt), 'shell tags');
ok(/Project Neon\.md/.test(termTxt), 'shell search');
ok(/-> \/guides\/Linking Notes\.md/.test(termTxt), 'shell links');
ok(/\d+ notes, \d+ words, \d+ wiki links/.test(termTxt), 'node vault-stats: ' + (termTxt.match(/.*wiki links.*/) || ['?'])[0]);
ok(/\/Welcome\.md/.test(termTxt.split('grep -rl')[1] || ''), 'busybox grep finds links');
fs.writeFileSync(OUT + '/term.txt', termTxt);
await shot('12_shell');

// Agent run
await page.tap('.tab[data-tab="chat"]'); await page.waitForTimeout(200);
await page.fill('#input', 'Make a map of content for my vault'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .tool').length >= 5, null, { timeout: 30000 });
await page.waitForTimeout(500);
ok(/notes, \d+ links/.test(toolOut[0] || ''), 'notes_search overview: ' + (toolOut[0] || '').slice(0, 70).replace(/\n/g, ' | '));
ok(/Backlinks \(\d+\)/.test(toolOut[1] || '') && /Project Neon/.test(toolOut[1] || ''), 'note_links: ' + (toolOut[1] || '').slice(0, 120).replace(/\n/g, ' | '));
ok((toolOut[2] || '').split('\n').filter(l => l.startsWith('/')).length === 3, 'notes_search #guide');
ok(await page.evaluate(() => document.body.dataset.screen) === 'file' && await page.textContent('#filePath') === 'Map of Content', 'open_note showed the note');
await page.tap('.tab[data-tab="chat"]'); await page.waitForTimeout(300);
ok(await page.locator('#chat .md a.wiki-link').count() >= 3 && await page.locator('#chat .md a.wiki-link.missing').count() === 1, 'chat wiki links (missing Neon Plan)');
await shot('13_chat_done'); await overflow('chat after run');
await page.locator('#chat .md a.wiki-link', { hasText: 'Inbox' }).last().tap(); await page.waitForTimeout(300);
ok(await page.textContent('#filePath') === 'Inbox', 'tap chat wiki link opens note');
await page.tap('.tab[data-tab="chat"]');
await page.locator('#chat .md a.tag-chip').last().tap(); await page.waitForTimeout(300);
ok(await page.inputValue('#noteSearch') === '#guide', 'tap chat tag filters notes');
// ---- v2: node fs ----
await page.tap('.tab[data-tab="term"]'); await page.waitForTimeout(200);
await page.evaluate(() => vfs.write('/scripts/lib.js', 'module.exports = { twice: x => x * 2 };\n'));
await page.evaluate(() => vfs.write('/scripts/fs-test.js', [
  "const fs = require('fs'), path = require('path'); const { twice } = require('./lib');",
  "fs.mkdirSync('/out/deep', { recursive: true }); fs.writeFileSync('/out/deep/a.md', '# A\\n'); fs.writeFileSync('out/b.txt', 'b');",
  "const ents = fs.readdirSync('/out', { withFileTypes: true }).map(d => d.name + (d.isDirectory() ? '/' : ''));",
  "let threw = ''; try { fs.readdirSync('/Welcome.md'); } catch (e) { threw = e.code; }",
  "fs.renameSync('/out/b.txt', '/out/c.txt'); fs.mkdirSync('/gone'); fs.rmSync('/gone', { recursive: true });",
  "const st = fs.statSync('/guides'); console.log('ENTS', ents.join(','), threw, st.isDirectory(), twice(21), path.relative('/a/b', '/a/c/d'), __dirname);",
  "setTimeout(() => { fs.appendFileSync('/out/c.txt', '!'); console.log('LATER'); }, 50);",
  "fs.promises.readFile('/Inbox.md', 'utf8').then(t => console.log('PROMISE', t.split('\\n')[0]));"].join('\n')));
for (const c of ['node scripts/vault-stats.js', 'node scripts/fs-test.js']) { await page.fill('#termCmd', c); await page.press('#termCmd', 'Enter'); await page.waitForTimeout(2500); }
const t2 = await page.evaluate(() => document.querySelector('#term').innerText);
const statsLine = (t2.match(/(\d+) notes, (\d+) words, (\d+) wiki links/g) || []).pop() || '';
ok(+statsLine.split(' ')[0] >= 9, 'vault-stats sees notes: ' + statsLine);
ok(/ENTS b\.txt,deep\/ ENOTDIR true 42 \.\.\/c\/d \/scripts/.test(t2), 'node fs semantics: ' + (t2.match(/ENTS.*/) || ['?'])[0]);
ok(/LATER/.test(t2) && /PROMISE # Inbox/.test(t2), 'node timers + promises');
ok(await page.evaluate(() => vfs.isFile('/out/deep/a.md') && vfs.read('/out/c.txt') === 'b!' && !vfs.exists('/out/b.txt') && !vfs.exists('/gone') && vfs.isDir('/out/deep')), 'node writes/renames/rm reach the vault');
// ---- v2: duplicate-safe tools ----
const dup = await page.evaluate(async () => { const r = {}; const t = async (n, a) => { try { return await runTool(n, a, null); } catch (e) { return 'ERR ' + e.message; } };
  r.inbox = await t('write', { path: 'inbox', content: '# Inbox\n\n- new\n' });
  r.nested = await t('write', { path: '/notes/Inbox.md', content: 'x' });
  r.under = await t('write', { path: 'Project_Neon', content: 'x' });
  r.fresh = await t('write', { path: 'New Idea', content: '# New Idea\n' });
  r.edit = await t('edit', { path: 'todo list', oldText: 'Open the vault', newText: 'Open the vault!' });
  r.read = await t('read', { path: 'Markdown Reference' });
  r.files = vfs.isFile('/inbox') || vfs.isFile('/inbox.md') || vfs.isFile('/notes/Inbox.md') || vfs.isFile('/Project_Neon.md');
  r.newIdea = vfs.isFile('/New Idea.md'); r.inboxBody = vfs.read('/Inbox.md'); return r; });
ok(/Successfully wrote .* \/Inbox\.md/.test(dup.inbox) && /- new/.test(dup.inboxBody), 'write "inbox" updates /Inbox.md: ' + dup.inbox);
ok(/^ERR A note named "Inbox" already exists/.test(dup.nested), 'nested duplicate refused');
ok(/^ERR A note named "Project Neon" already exists/.test(dup.under), 'underscore duplicate refused: ' + dup.under.slice(0, 60));
ok(/New Idea\.md/.test(dup.fresh) && dup.newIdea, 'extensionless write gets .md');
ok(/Successfully replaced text in \/Todo List\.md/.test(dup.edit), 'edit by note name: ' + dup.edit.slice(0, 60));
ok(/# Markdown Reference/.test(dup.read), 'read by note name');
ok(!dup.files, 'no duplicate files created');
// ---- v2: memory ----
const mem = await page.evaluate(async () => { const t = async (a) => { try { return await runTool('memory', a, null); } catch (e) { return 'ERR ' + e.message; } };
  const r = {}; r.s1 = await t({ action: 'save', text: 'The user loves synthwave and dark themes', section: 'preferences' });
  r.s2 = await t({ action: 'save', text: 'the user loves synthwave and dark themes.' });
  r.s3 = await t({ action: 'save', text: 'Their cat is called Byte', section: 'about' });
  r.search = await t({ action: 'search', text: 'cat' });
  r.prompt = systemPrompt(); r.f = await t({ action: 'forget', text: 'cat is called' }); r.after = vfs.read('/Jade/Memory.md'); return r; });
ok(/Saved to memory under "Preferences"/.test(mem.s1) && /Already remembered/.test(mem.s2), 'memory save + dedupe');
ok(/Byte/.test(mem.search), 'memory search');
ok(/Long-term memory/.test(mem.prompt) && /synthwave/.test(mem.prompt) && /Byte/.test(mem.prompt), 'memory in system prompt');
ok(/Forgot 1/.test(mem.f) && !/Byte/.test(mem.after) && /synthwave/.test(mem.after), 'memory forget');
// ---- v2: journal ----
await page.evaluate(() => journalSession(window.__cur || null));
await page.evaluate(async () => { const s = await (async () => { for (const k of Object.keys(window)) {} })(); });
await page.tap('.tab[data-tab="chat"]'); await page.fill('#input', '/new'); await page.tap('#btnSend'); await page.waitForTimeout(1500);
const jr = await page.evaluate(() => { const p = [...vfs.nodes.keys()].find(k => k.startsWith('/Jade/Journal/')); return { p, body: p ? vfs.read(p) : '', mem: vfs.read('/Jade/Memory.md') }; });
ok(jr.p && /Map of Content/.test(jr.body) && /organises notes by tag/.test(jr.mem), 'journal entry + learned fact: ' + jr.p);
ok(!/- none/.test(jr.mem), 'journal "none" not saved');
await shot('14_memory');
// ---- v3: LaTeX ----
await page.evaluate(() => vfs.write('/Math Test.md', '# Math\n\nEnergy $E = mc^2$ and money: costs $5 and $10 today.\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$\n\nAlso \\(a_b\\) and\n\n```math\n\\sum_{n=1}^\\infty \\frac{1}{n^2}\n```\n'));
await page.evaluate(() => openFile('/Math Test.md', { mode: 'read' })); await page.waitForTimeout(400);
const mt = await page.evaluate(() => ({ k: document.querySelectorAll('#notePrev .katex').length, disp: document.querySelectorAll('#notePrev .katex-display').length, raw: document.querySelectorAll('#notePrev .math-raw').length, txt: document.querySelector('#notePrev').innerText }));
ok(mt.k === 4 && mt.disp === 2 && !mt.raw, 'KaTeX renders inline/display/fenced: ' + JSON.stringify({ k: mt.k, d: mt.disp, r: mt.raw }));
ok(/costs \$5 and \$10 today/.test(mt.txt), 'currency dollars are not math');
await shot('15_math'); await overflow('math note');
// ---- v3: SOUL / AGENTS / SYSTEM ----
const sp = await page.evaluate(() => systemPrompt());
ok(/neon edge of Night City/.test(sp) && /Title Case/.test(sp) && !/<!--/.test(sp), 'SOUL + AGENTS in prompt, comments stripped');
ok(/Skills \(instruction packs/.test(sp) && /daily-review:/.test(sp) && /skill-creator:/.test(sp), 'skills listed in prompt');
await page.evaluate(() => vfs.write('/Jade/SYSTEM.md', '# SYSTEM\n<!-- hidden -->\nYou are Bob, a terse librarian.'));
const sp2 = await page.evaluate(() => systemPrompt());
ok(sp2.startsWith('# SYSTEM\n\nYou are Bob') || sp2.startsWith('# SYSTEM\nYou are Bob') || /^# SYSTEM\s+You are Bob/.test(sp2), 'SYSTEM.md replaces intro: ' + JSON.stringify(sp2.slice(0, 40)));
ok(!/Guidelines:/.test(sp2) && /Tools:/.test(sp2) && /neon edge/.test(sp2), 'SYSTEM.md drops guidelines, keeps tools + soul');
await page.evaluate(() => vfs.rm('/Jade/SYSTEM.md'));
// ---- v3: skills ----
await page.waitForFunction(() => vfs.isFile('/Jade/skills/vault-map/SKILL.md') && vfs.isFile('/Jade/skills/knowledge-graph/SKILL.md'), null, { timeout: 15000 });   // seeded by Vault Loci (2.24) and the knowledge graph (2.25)
const sk = await page.evaluate(async () => { const t = async (n, a) => { try { return await runTool(n, a, null); } catch (e) { return 'ERR ' + e.message; } };
  return { n: listSkills().length, tool: await t('skill', { name: 'Daily Review' }), bad: await t('skill', { name: 'nope' }),
    mk: await t('write', { path: '/Jade/skills/weekly-review/SKILL.md', content: '---\nname: weekly-review\ndescription: Weekly review. Use on Sundays.\n---\n# Weekly\n1. Do it.\n' }), n2: listSkills().length }; });
ok(sk.n === 7 && sk.n2 === 8, 'skills seeded + new skill via write (not blocked as duplicate): ' + sk.n + '→' + sk.n2 + ' ' + sk.mk.slice(0, 50));
ok(/Skill "daily-review" loaded/.test(sk.tool) && /Collect open tasks/.test(sk.tool), 'skill tool loads instructions');
ok(/No skill named "nope". Available:/.test(sk.bad), 'unknown skill error lists skills');
// slash suggest + /skill: in composer (new chat so the mock restarts its script)
await page.tap('.tab[data-tab="chat"]'); await page.fill('#input', '/new'); await page.tap('#btnSend'); await page.waitForTimeout(400);
await page.fill('#input', ''); await page.type('#input', '/sk'); await page.waitForTimeout(200);
ok(!(await page.locator('#slashSuggest').isHidden()) && /skill:daily-review/.test(await page.textContent('#slashSuggest')), 'slash suggestions show skills');
await shot('16_slash');
await page.locator('#slashSuggest button', { hasText: 'skill:atomic-notes' }).tap();
await page.type('#input', 'Inbox'); await page.tap('#btnSend');
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .tool').length >= 5, null, { timeout: 30000 });
const um = await page.evaluate(() => { const s = window.__lastSent; return null; });
await page.tap('.tab[data-tab="chat"]'); await page.waitForTimeout(200);
const first = await page.evaluate(async () => { const m = (await (async () => 0)()); return document.querySelector('#chat .msg-user .bubble').textContent; });
ok(first === '/skill:atomic-notes Inbox', 'user bubble shows the command: ' + first);
ok(/<skill name=\"atomic-notes\">/.test(sentUser0) && /Inbox$/.test(sentUser0), 'model received expanded skill');
// ---- v3: edit + resend ----
const before = await page.evaluate(() => document.querySelectorAll('#chat .msg-ai').length);
await page.tap('.tab[data-tab="chat"]'); await page.waitForTimeout(200);
await page.locator('#chat .msg-user [data-uact="edit"]').first().tap(); await page.waitForTimeout(150);
await page.fill('#chat .msg-edit textarea', 'Make a map of content, but only for guides');
await shot('17_edit');
await page.locator('#chat .msg-edit [data-x="send"]').tap();
await page.waitForFunction(() => !running && document.querySelectorAll('#chat .tool').length >= 5, null, { timeout: 30000 }); await page.waitForTimeout(400);
await page.tap('.tab[data-tab="chat"]'); await page.waitForTimeout(200);
const ed = await page.evaluate(() => ({ users: [...document.querySelectorAll('#chat .msg-user .bubble')].map(b => b.textContent), ai: document.querySelectorAll('#chat .msg-ai').length }));
ok(ed.users.length === 1 && ed.users[0] === 'Make a map of content, but only for guides' && ed.ai === 1, 'edit replaces message and re-runs: ' + JSON.stringify(ed));
ok(sentUser0 === 'Make a map of content, but only for guides', 'resend sent edited text to model');
await shot('18_after_edit');
// persistence across reload
await page.reload(); await page.waitForFunction(() => typeof vfs !== 'undefined' && vfs.isFile('/Map of Content.md'), null, { timeout: 30000 }).catch(() => {});
ok(await page.evaluate(() => vfs.isFile('/Map of Content.md') && /\[x\] Write/.test(vfs.read('/Todo List.md'))), 'vault persists across reload');
ok(await page.evaluate(() => Object.keys(localStorage).every(k => !k.startsWith('pinet:'))), 'separate storage prefix');

console.log(log.join('\n')); console.log('\n' + (fail.length ? fail.join('\n') : 'ALL PASS'));
await browser.close();
