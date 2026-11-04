/* =====================================================================
   STEERING + SKILLS
   /Jade/SOUL.md     who Jade is: persona, voice, values (added to every prompt)
   /AGENTS.md        the user's standing instructions (also /Jade/AGENTS.md)
   /Jade/SYSTEM.md   optional: replaces Jade's base intro + guidelines
   /Jade/skills/<name>/SKILL.md   pi-style skills: frontmatter name + description,
                     listed in the prompt; loaded on demand with the skill tool
                     or by the user with /skill:name
   HTML comments (<!-- -->) in these files are notes for you and never reach the model.
   ===================================================================== */
const SOUL_PATH = '/Jade/SOUL.md', AGENTS_PATH = '/AGENTS.md', SYSTEM_PATH = '/Jade/SYSTEM.md', SKILLS_DIR = '/Jade/skills';
const STEER_SEED = {
  [SOUL_PATH]: `---
name: Jade
---
# SOUL

<!-- Jade's personality. Everything outside these comments is added to every chat.
     Rewrite it however you like: voice, attitude, quirks, what she cares about. -->

I'm Jade: a netrunner from the neon edge of Night City who now guards your second brain.
I treat your vault like a city I patrol: I know its streets, keep the lights on, and connect
the places that ought to be connected.

## Voice
- Warm, quick and a little playful. Short sentences. A dash of netrunner slang in chat
  ("choom", "preem", "jacking in"), never inside your notes.
- Plain and precise when it matters: facts, steps, numbers.

## Values
- Your notes are yours. I never delete or rewrite your words without asking; I move and link.
- I'd rather ask one sharp question than guess wrong on something that can't be undone.
- I say so when I don't know.
`,
  [AGENTS_PATH]: `# AGENTS

<!-- Standing instructions Jade follows in every chat (like AGENTS.md in pi).
     Edit, add or delete lines. Comments like this one are not sent to her.
     Advanced: create /Jade/SYSTEM.md to replace her whole base prompt.
     Her personality lives in /Jade/SOUL.md, her memory in /Jade/Memory.md. -->

- Name new notes in Title Case. Put them in the vault root unless a folder clearly fits
  (projects/, guides/, daily/).
- End new notes with a "Related:" line of [[links]] to the closest existing notes.
- Prefer short bullet points over long paragraphs.
- Write math in LaTeX: $inline$ and $$display$$.
`,
  [`${SKILLS_DIR}/daily-review/SKILL.md`]: `---
name: daily-review
description: Run the user's daily review. Use when they ask for a daily review, a plan for today, or "what's on my plate".
---
# Daily review

1. Open today's daily note /daily/YYYY-MM-DD.md (today's date). If it is missing, write it with
   the sections "## Notes" and "## Tasks" and a link to [[Inbox]].
2. Collect open tasks: run bash \`grep -rn -- "- \\[ \\]" / --include=*.md\` and group them by note.
3. Read /Inbox.md. For each item, suggest where it belongs (an existing note, or a new one).
4. Append to today's note a "## Plan" section: at most 5 tasks, most important first, each with a
   [[link]] to the note it came from.
5. Reply with a short summary and ask whether to file the Inbox items as suggested.
`,
  [`${SKILLS_DIR}/atomic-notes/SKILL.md`]: `---
name: atomic-notes
description: Split a long or messy note into small single-idea notes linked together (Zettelkasten style). Use when the user asks to break up, atomise, split or refactor a note.
---
# Atomic notes

1. read the note. List its distinct ideas, one line each, and show the list to the user first if
   there are more than 8.
2. For each idea, notes_search for an existing note on it. Edit that note if one exists; otherwise
   write a new note named after the idea (Title Case) with:
   - "# Title", 2 to 6 sentences or bullets in the user's own words,
   - a "Related:" line linking the sibling ideas and the original note.
3. Replace the moved text in the original note with a bulleted list of [[links]] to the new notes,
   keeping any text that did not move. Never drop content.
4. Reply with the list of notes created or changed, as [[links]].
`,
  [`${SKILLS_DIR}/literature-note/SKILL.md`]: `---
name: literature-note
description: Turn a web page, article or paper into a literature note with summary, key ideas, quotes and source. Use when the user shares a URL or asks to make notes on an article.
---
# Literature note

1. web_fetch the URL (web_search first if you only have a title).
2. notes_search for the title so you do not duplicate an existing note.
3. Write the note "/sources/<Short Title>.md":
   ---
   source: <url>
   author: <if known>
   read: <today>
   ---
   # <Title>
   ## Summary
   3 to 5 sentences in plain words.
   ## Key ideas
   - one bullet per idea; link related notes with [[...]]
   ## Quotes
   > at most 3 short quotes, exactly as written
   ## My thoughts
   (leave empty for the user)
   #source
4. Add "- [[<Short Title>]]" to /Inbox.md and open_note the new note.
`,
  [`${SKILLS_DIR}/math-notes/SKILL.md`]: `---
name: math-notes
description: Write or tidy math, physics or statistics notes with LaTeX formulas. Use for equations, proofs, derivations, formula sheets or when the user asks for LaTeX.
---
# Math notes

The vault renders LaTeX with KaTeX.
- Inline: $E = mc^2$. Display: put $$ on its own lines around the formula.
- Also allowed: \\( inline \\) and \\[ display \\], or a fenced block with the language "math".
- Do not put math inside backticks, or it shows as code.
- Escape a literal dollar sign as \\$.
- One idea per display block; explain each symbol right after it in a bullet list.
- For derivations, number the steps and keep each step to one transformation.
- KaTeX supports most of amsmath (aligned, cases, pmatrix, \\frac, \\sum, \\int, \\mathbb).
  It has no \\newcommand across blocks: define macros inside each block.
`,
  [`${SKILLS_DIR}/skill-creator/SKILL.md`]: `---
name: skill-creator
description: Create or improve one of Jade's skills. Use when the user asks for a new skill, workflow, routine or recipe that Jade should follow, or wants to change an existing skill.
---
# Skill creator

A skill is a folder /Jade/skills/<kebab-case-name>/ containing SKILL.md, plus optional extra files
(templates, examples) that SKILL.md refers to by relative path.

1. Ask what the skill should do and when it should trigger, unless the user already said.
2. notes_search or ls /Jade/skills so you do not duplicate an existing skill; edit it instead if it is close.
3. Write /Jade/skills/<name>/SKILL.md:
   ---
   name: <name>
   description: <what it does>. Use when <the situations or phrases that should trigger it>.
   ---
   # <Title>
   Numbered, concrete steps using your real tools (read, write, edit, bash, notes_search, web_fetch,
   memory, schedule...). Name exact paths and note formats.
4. The description decides when the skill is used, so make it specific.
5. Tell the user they can run it any time with /skill:<name>.
`,
};
function stripComments(t) { return String(t).replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
function parseFront(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text || ''); const meta = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
  return { meta, body: m ? text.slice(m[0].length) : (text || '') };
}
function ensureSteering() {
  if (ls.get('steerSeeded', 0) >= 1) return;
  for (const [p, c] of Object.entries(STEER_SEED)) if (!vfs.exists(p)) vfs.write(p, c, { mkdirs: true });
  ls.set('steerSeeded', 1);
}
const readCap = (p, cap = 8000) => { if (!vfs.isFile(p)) return ''; let t = stripComments(vfs.read(p)); if (t.length > cap) t = t.slice(0, cap) + '\n…(truncated)'; return t; };
function agentsFiles() { const out = []; for (const k of vfs.nodes.keys()) if (/^\/(jade\/)?agents\.md$/i.test(k) && vfs.isFile(k)) out.push(k); return out.sort((a, b) => a.length - b.length); }
function listSkills() {
  const off = new Set(ls.get('skillsOff', [])); const out = [];
  for (const k of vfs.nodes.keys()) {
    const m = /^\/jade\/skills\/([^/]+)\/skill\.md$/i.exec(k); if (!m || !vfs.isFile(k)) continue;
    const { meta, body } = parseFront(vfs.read(k)); const name = (meta.name || m[1]).trim();
    out.push({ name, description: meta.description || (body.split('\n').find(l => l.trim() && !l.startsWith('#')) || '').trim().slice(0, 200), path: k, dir: vfs.parent(k), off: off.has(name) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function findSkill(name) {
  const n = String(name || '').trim().replace(/^\/?skill:/i, '').toLowerCase(); if (!n) return null;
  const all = listSkills(); const k = s => s.toLowerCase().replace(/[\s_-]+/g, '-');
  return all.find(s => s.name.toLowerCase() === n) || all.find(s => k(s.name) === k(n)) || all.find(s => vfs.base(s.dir).toLowerCase() === n) || null;
}
function steering() {
  const sys = vfs.isFile(SYSTEM_PATH) ? stripComments(parseFront(vfs.read(SYSTEM_PATH)).body) : '';
  return { system: sys, soul: readCap(SOUL_PATH, 6000).replace(/^---[\s\S]*?---\s*/, '').replace(/^# SOUL\s*/i, ''), agents: agentsFiles().map(p => ({ p, t: readCap(p, 6000).replace(/^# AGENTS\s*/i, '') })).filter(a => a.t), skills: listSkills().filter(s => !s.off) };
}
function steeringContext(st) {
  let out = '';
  if (st.soul) out += `\n\nYour persona (from /Jade/SOUL.md; this is who you are, keep this voice in chat):\n${st.soul}`;
  for (const a of st.agents) out += `\n\nStanding instructions from the user (${a.p}; always follow them):\n${a.t}`;
  if (st.skills.length) out += `\n\nSkills (instruction packs in ${SKILLS_DIR}). When a request matches a skill's description, FIRST call the skill tool with its name, then follow the instructions it returns step by step:\n${st.skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}\nTo create a skill, write ${SKILLS_DIR}/<kebab-name>/SKILL.md beginning with frontmatter ("---", "name: …", "description: … Use when …", "---") followed by numbered steps.`;
  return out;
}
function skillTool(args) {
  const s = findSkill(args.name || args.skill);
  if (!s) { const all = listSkills().filter(x => !x.off); throw new Error(`No skill named "${args.name}". Available: ${all.map(x => x.name).join(', ') || 'none'}`); }
  if (s.off) throw new Error(`The skill "${s.name}" is turned off in Config.`);
  try { if (typeof skillStat === 'function') skillStat(s.name, 'used'); } catch {}
  const { body } = parseFront(vfs.read(s.path));
  const extra = [...vfs.walk(s.dir)].filter(p => p !== s.path && vfs.isFile(p));
  return `Skill "${s.name}" loaded from ${s.path}. Follow these instructions now.${extra.length ? `\nOther files in this skill (read them when the steps refer to them): ${extra.join(', ')}` : ''}${args.input ? `\nInput: ${args.input}` : ''}\n\n${stripComments(body)}`;
}
function expandSkillCommand(text) {
  const m = /^\/skill:([^\s]+)\s*([\s\S]*)$/i.exec(text.trim()); if (!m) return null;
  const s = findSkill(m[1]);
  if (!s) { toast(`No skill called “${esc(m[1])}”. Skills: ${esc(listSkills().map(x => x.name).join(', ') || 'none')}`, 'err'); return null; }
  const { body } = parseFront(vfs.read(s.path));
  return `Use the "${s.name}" skill for this request. Its instructions (from ${s.path}):\n\n<skill name="${s.name}">\n${stripComments(body)}\n</skill>\n\n${m[2].trim() || '(The user gave no extra input: start the skill.)'}`;
}

/* ---------- settings UI for steering + skills ---------- */
function renderSkillsSettings() {
  const box = $('#skillList'); if (!box) return; const all = listSkills();
  box.innerHTML = all.map(s => `<label class="skill-row"><input type="checkbox" data-skill="${esc(s.name)}" ${s.off ? '' : 'checked'} class="accent-emerald-400 w-4 h-4 mt-1 flex-none"><span class="min-w-0"><b class="text-yl">${esc(s.name)}</b> <a href="#" class="text-cy text-[12px]" data-open="${esc(s.path)}">edit</a><span class="block text-[12.5px] text-dim leading-snug">${esc(s.description || 'no description')}</span></span></label>`).join('') || '<div class="hint">No skills yet.</div>';
}
$('#skillList')?.addEventListener('change', e => { const c = e.target.closest('[data-skill]'); if (!c) return; const off = new Set(ls.get('skillsOff', [])); c.checked ? off.delete(c.dataset.skill) : off.add(c.dataset.skill); ls.set('skillsOff', [...off]); });
$('#skillList')?.addEventListener('click', e => { const a = e.target.closest('[data-open]'); if (!a) return; e.preventDefault(); closeSettings(); openFile(a.dataset.open, { mode: 'edit' }); });
function openSteer(p, tmpl) { closeSettings(); if (!vfs.isFile(p)) vfs.write(p, tmpl, { mkdirs: true }); openFile(p, { mode: 'edit' }); }
$('#btnOpenSoul') && ($('#btnOpenSoul').onclick = () => openSteer(SOUL_PATH, STEER_SEED[SOUL_PATH]));
$('#btnOpenAgents') && ($('#btnOpenAgents').onclick = () => openSteer(agentsFiles()[0] || AGENTS_PATH, STEER_SEED[AGENTS_PATH]));
$('#btnOpenSystem') && ($('#btnOpenSystem').onclick = () => openSteer(SYSTEM_PATH, `# SYSTEM\n\n<!-- Replaces Jade's built-in intro and guidelines. The vault conventions, tool list, memory,\n     SOUL.md, AGENTS.md and skills are still added. Delete this file to go back to the default. -->\n\nYou are Jade, `));
$('#btnNewSkill') && ($('#btnNewSkill').onclick = () => {
  let n = 'new-skill', i = 2; while (vfs.exists(`${SKILLS_DIR}/${n}`)) n = `new-skill-${i++}`;
  openSteer(`${SKILLS_DIR}/${n}/SKILL.md`, `---\nname: ${n}\ndescription: What this skill does. Use when …\n---\n# ${n}\n\n1. First step, using Jade's tools (read, write, edit, bash, notes_search, web_fetch, memory…).\n2. …\n`);
});

/* ---------- edit a sent message and re-run from there ---------- */
async function resendFrom(i, text) {
  text = String(text || '').trim(); if (!text || !cur) return;
  if (running) return toast('The agent is still working. Abort it first.', 'err');
  if (!S.model) return toast('Pick a model first (Config → Ollama link).', 'err');
  let content = text; if (/^\/skill:/i.test(text)) { content = expandSkillCommand(text); if (!content) return; }
  cur.messages = cur.messages.slice(0, i);
  const mk = ls.get('journaled', {}); if ((mk[cur.id] || 0) > i) { mk[cur.id] = i; ls.set('journaled', mk); }
  if (i === 0 && !cur._named) cur.title = text.slice(0, 60);
  cur.messages.push(content === text ? { role: 'user', content } : { role: 'user', content, display: text });
  saveSession(); renderChat(); try { renderSessions(); } catch {}
  await agentLoop({ route: true });
}
chatEl.addEventListener('click', e => {
  const b = e.target.closest('[data-uact]'); if (!b) return; const el = b.closest('.msg-user'); const i = +el.dataset.i;
  const m = cur?.messages[i]; if (!m || m.role !== 'user') return;
  if (b.dataset.uact === 'copy') return copyText(m.display || m.content, b);
  if (b.dataset.uact === 'edit') {
    if (running) return toast('The agent is still working. Abort it first.', 'err');
    if (el.querySelector('.msg-edit')) return;
    const box = document.createElement('div'); box.className = 'msg-edit flex flex-col gap-2';
    box.innerHTML = `<textarea class="field" rows="4" aria-label="Edit your message"></textarea><div class="flex justify-end gap-2"><button class="btn" data-x="cancel">Cancel</button><button class="btn btn-solid cut cut-sm" data-x="send">Send</button></div><div class="hint text-right">Everything after this message is replaced by the new reply.</div>`;
    const ta = box.querySelector('textarea'); ta.value = m.display || m.content;
    el.querySelector('.bubble').hidden = true; el.querySelector('.msg-actions').hidden = true; el.appendChild(box);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.style.height = Math.min(320, ta.scrollHeight + 4) + 'px';
    box.addEventListener('click', ev => { const x = ev.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'cancel') { box.remove(); el.querySelector('.bubble').hidden = false; el.querySelector('.msg-actions').hidden = false; } else resendFrom(i, ta.value); });
  }
});

/* ---------- "/" suggestions above the composer ---------- */
const SLASH_CMDS = [['/new', 'new chat'], ['/compact', 'summarise old turns'], ['/remember ', 'save a memory'], ['/memory', 'open memory'], ['/journal', 'journal this chat'], ['/skills', 'list skills'], ['/rename ', 'rename chat'], ['/copy', 'copy as Markdown'], ['/schedule', 'scheduled prompts'], ['/voice', 'toggle speech'], ['/model ', 'switch model'], ['/clear', 'clear messages'], ['/config', 'settings'], ['/help', 'all commands']];
function updateSlashSuggest() {
  const box = $('#slashSuggest'); const v = input.value;
  if (!/^\/\S*$/.test(v)) { box.hidden = true; return; }
  const q = v.toLowerCase();
  const items = [...listSkills().filter(s => !s.off).map(s => [`/skill:${s.name} `, s.description]), ...SLASH_CMDS].filter(([c]) => c.toLowerCase().startsWith(q) || (q.length > 1 && c.toLowerCase().includes(q.slice(1)))).slice(0, 14);
  box.innerHTML = items.map(([c, h]) => `<button data-cmd="${esc(c)}"><span>${esc(c.trim())}</span><small>${esc(String(h).slice(0, 60))}</small></button>`).join('');
  box.hidden = !items.length;
}
input.addEventListener('input', updateSlashSuggest);
$('#slashSuggest').addEventListener('mousedown', e => e.preventDefault());
$('#slashSuggest').addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (!b) return; input.value = b.dataset.cmd; autosize(); $('#slashSuggest').hidden = true; input.focus(); });
