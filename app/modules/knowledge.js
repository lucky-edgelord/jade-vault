/* =====================================================================
   KNOWLEDGE GRAPH — facts, rules and a reasoner that shows its proofs, for verification.
   The reasoner is Rust (rust/kg → app/vendor/jade_kg.wasm), the same engine jade-py runs; JSON in, JSON out.
   Files (plain text, synced and backed up like notes):
     /Jade/Knowledge/facts.jsonl   one fact per line: {"id","fact","status","by","source","ts"}
                                   status: confirmed (the user's, or approved), proposed (Jade's, until approved), rejected
     /Jade/Knowledge/rules.dl      rules and constraints in the same language; the user's to edit
   Jade's facts are always proposed: only the user confirms (Notes → Knowledge). Every answer says when it rests on
   unconfirmed facts. Verify mode (off by default) asks Jade to check her factual claims against the graph.
   ===================================================================== */
const KG_DIR = '/Jade/Knowledge', KG_FACTS = KG_DIR + '/facts.jsonl', KG_RULES = KG_DIR + '/rules.dl';
const KG_RULES_SEED = `% Rules and constraints for Jade's knowledge graph. Facts live in facts.jsonl (Notes → Knowledge).
%
%   rule:        head :- condition, condition.        (variables start with a capital letter)
%   constraint:  ! name: condition, condition.         (any match is a contradiction)
%   conditions:  relation(a, X)   not relation(a, X)   X = Y   X != Y   X < Y   X <= Y   X > Y   X >= Y
%
% Examples, switched off (delete the % to use one):
% knows(X, Y) :- knows(Y, X).
% above(X, Y) :- reports_to(X, Y).
% above(X, Z) :- reports_to(X, Y), above(Y, Z).
% ! one_birthday: born_on(P, A), born_on(P, B), A != B.
% ! no_self_report: reports_to(P, P).
% ! ends_after_start: starts(T, S), ends(T, E), E < S.
`;

/* ---------- the engine (WebAssembly) ---------- */
const KGW = { p: null, x: null, enc: new TextEncoder(), dec: new TextDecoder() };
function kgWasm() {
  return KGW.p ||= (async () => {
    const bytes = await gunzipB64('jade-kg-wasm');
    const { instance } = await WebAssembly.instantiate(bytes, {});
    KGW.x = instance.exports;
  })().catch(e => { KGW.p = null; throw new Error('the knowledge engine could not start: ' + (e?.message || e)); });
}
/** One JSON request to the engine. Throws on {ok:false} with the engine's message. */
async function kgCall(req) {
  await kgWasm(); const x = KGW.x;
  const inp = KGW.enc.encode(JSON.stringify(req)); const p = x.kg_alloc(inp.length);
  let out;
  try {
    new Uint8Array(x.memory.buffer, p, inp.length).set(inp);
    const q = x.kg_call(p, inp.length); out = JSON.parse(KGW.dec.decode(new Uint8Array(x.memory.buffer, q, x.kg_out_len())));
  } catch (e) { KGW.p = null; KG.h = 0; throw new Error('the knowledge engine stopped: ' + (e?.message || e)); }   // a trap: start a fresh instance next time
  finally { try { x.kg_free(p, inp.length); } catch {} }
  if (!out.ok) { const e = new Error(out.error); e.code = out.code; throw e; }
  return out;
}

/* ---------- files ---------- */
const KG = { h: 0, sig: '', stats: null, err: null };
const kgRead = p => { try { return vfs.isFile(p) ? vfs.read(p) : ''; } catch { return ''; } };
function kgFacts() {
  return kgRead(KG_FACTS).split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => { try { return JSON.parse(l); } catch { return { id: 'bad' + i, fact: '', status: 'rejected', bad: l }; } }).filter(f => f.id);
}
function kgSaveFacts(list) { vfs.write(KG_FACTS, list.map(f => JSON.stringify({ id: f.id, fact: f.fact, status: f.status, by: f.by || '', source: f.source || '', ts: f.ts || new Date().toISOString() })).join('\n') + (list.length ? '\n' : ''), { mkdirs: true }); KG.sig = ''; }
function kgEnsure() { try { if (!vfs.isFile(KG_RULES)) vfs.write(KG_RULES, KG_RULES_SEED, { mkdirs: true }); if (!vfs.isFile(KG_FACTS)) vfs.write(KG_FACTS, '', { mkdirs: true }); } catch (e) { console.warn('knowledge files', e); } }
/** The loaded graph (reloaded when the files change). */
async function kgLoad() {
  kgEnsure();
  const rules = kgRead(KG_RULES), factsTxt = kgRead(KG_FACTS), sig = rules.length + ':' + factsTxt.length + ':' + rules + '\u0000' + factsTxt;
  if (KG.h && KG.sig === sig) return KG.h;
  if (KG.h) { kgCall({ op: 'free', handle: KG.h }).catch(() => {}); KG.h = 0; }
  try {
    const r = await kgCall({ op: 'load', rules, facts: kgFacts().filter(f => f.fact), rules_source: 'rules.dl' });
    KG.h = r.handle; KG.sig = sig; KG.stats = r.stats; KG.err = null; return KG.h;
  } catch (e) { KG.err = e.message; KG.sig = ''; throw new Error(`the knowledge graph has a problem: ${e.message}. Fix it in ${e.message.startsWith('fact ') ? KG_FACTS : KG_RULES}.`); }
}
const kgNewId = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const kgRel = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'r_$1') || 'related_to';
async function kgFactText(a) {
  if (a.fact) return (await kgCall({ op: 'parse_fact', fact: String(a.fact) })).fact;
  if (a.subject == null || a.relation == null || a.object == null) throw new Error('add needs "fact", like works_at(alice, acme), or subject, relation and object');
  const v = x => (typeof x === 'number' ? x : String(x).trim());
  const f = await kgCall({ op: 'format', values: [v(a.subject), v(a.object)] });
  return (await kgCall({ op: 'parse_fact', fact: `${kgRel(a.relation)}(${f.values[0]}, ${f.values[1]})` })).fact;
}
/** Add a fact. by: 'user' (confirmed) or 'jade' (proposed). Returns {fact, id, status, note}. */
async function kgAdd(a, by) {
  const fact = await kgFactText(a); const list = kgFacts(); const old = list.find(f => f.fact === fact);
  if (old) {
    if (by === 'user' && old.status !== 'confirmed') { old.status = 'confirmed'; old.by = 'user'; kgSaveFacts(list); return { ...old, note: 'confirmed' }; }
    return { ...old, note: old.status === 'rejected' ? 'the user rejected this fact before; it stays out' : 'already in the graph' };
  }
  const f = { id: kgNewId(), fact, status: by === 'user' ? 'confirmed' : 'proposed', by, source: String(a.source || (by === 'user' ? 'entered' : 'chat')).slice(0, 200), ts: new Date().toISOString() };
  list.push(f); kgSaveFacts(list);
  try { await kgLoad(); } catch (e) { const l2 = kgFacts().filter(x => x.id !== f.id); kgSaveFacts(l2); throw e; }
  kgBadge(); return { ...f, note: 'added' };
}
function kgSetStatus(ids, status) { const set = new Set(ids); const list = kgFacts(); let n = 0; for (const f of list) if (set.has(f.id) && f.status !== status) { f.status = status; n++; } if (n) kgSaveFacts(list); kgBadge(); return n; }
function kgRemove(ids) { const set = new Set(ids); const list = kgFacts(); const keep = list.filter(f => !set.has(f.id)); if (keep.length !== list.length) kgSaveFacts(keep); kgBadge(); return list.length - keep.length; }

/* ---------- the tool ---------- */
const KG_ACTIONS = ['verify', 'query', 'why', 'check', 'add', 'facts', 'rules', 'add_rule', 'remove', 'stats'];
async function knowledgeTool(a) {
  const action = String(a.action || 'stats').toLowerCase();
  if (!KG_ACTIONS.includes(action)) throw new Error(`unknown action ${action}: use ${KG_ACTIONS.join(', ')}`);
  if (action === 'add') {
    const items = Array.isArray(a.facts) ? a.facts.slice(0, 50) : [a]; const out = [];
    for (const it of items) { try { const r = await kgAdd(typeof it === 'string' ? { fact: it, source: a.source } : { source: a.source, ...it }, 'jade'); out.push(`${r.fact}: ${r.note === 'added' ? `proposed (id ${r.id})` : r.note}`); } catch (e) { out.push(`${it.fact || it.subject || it}: not added (${e.message})`); } }
    return out.join('\n') + '\nYour facts are proposed until the user confirms them in Notes → Knowledge; answers say when they rest on unconfirmed facts.';
  }
  if (action === 'facts') {
    const st = a.status, q = String(a.match || '').toLowerCase(); const list = kgFacts().filter(f => f.fact && (!st || f.status === st) && (!q || f.fact.toLowerCase().includes(q) || (f.source || '').toLowerCase().includes(q)));
    const lim = Math.min(200, +a.limit || 60);
    return list.length ? `${list.length} fact${list.length > 1 ? 's' : ''}${list.length > lim ? ` (first ${lim})` : ''}:\n` + list.slice(0, lim).map(f => `- [${f.id}] ${f.fact} (${f.status}${f.source ? ', ' + f.source : ''})`).join('\n') : 'No facts match.';
  }
  if (action === 'rules') return '```\n' + (kgEnsure(), kgRead(KG_RULES)) + '\n```';
  if (action === 'add_rule') {
    const text = String(a.rule || a.text || '').trim(); if (!text) throw new Error('add_rule needs "rule", like  above(X, Z) :- reports_to(X, Y), above(Y, Z).  or  ! one_birthday: born_on(P, A), born_on(P, B), A != B.');
    kgEnsure(); const cur = kgRead(KG_RULES); const next = cur.replace(/\n*$/, '\n') + (a.comment ? `% ${String(a.comment).replace(/\n/g, ' ')}\n` : '') + (text.endsWith('.') ? text : text + '.') + '\n';
    const r = await kgCall({ op: 'parse_rules', rules: next });
    vfs.write(KG_RULES, next); KG.sig = ''; await kgLoad();
    return `Saved to ${KG_RULES}. Now ${r.rules} rule${r.rules === 1 ? '' : 's'} and ${r.constraints} constraint${r.constraints === 1 ? '' : 's'}. Run check to see whether the facts break any constraint.`;
  }
  if (action === 'remove') {
    const ids = [].concat(a.id || a.ids || []).map(String); const list = kgFacts();
    const mine = ids.filter(id => { const f = list.find(x => x.id === id); return f && f.by === 'jade' && f.status === 'proposed'; });
    const n = kgRemove(mine); const refused = ids.filter(id => !mine.includes(id));
    return `Removed ${n}.` + (refused.length ? ` Not removed: ${refused.join(', ')} (only your own unconfirmed facts; the user removes the rest in Notes → Knowledge).` : '');
  }
  const h = await kgLoad();
  if (action === 'stats') { const s = await kgCall({ op: 'stats', handle: h }); return `${s.facts} facts (${s.confirmed} confirmed, ${s.proposed} proposed), ${s.derived} more follow from ${s.rules} rule${s.rules === 1 ? '' : 's'}; ${s.constraints} constraint${s.constraints === 1 ? '' : 's'}.\nRelations: ${s.relations.map(r => `${r.name}/${r.arity} (${r.count})`).join(', ') || 'none yet'}`; }
  if (action === 'check') return (await kgCall({ op: 'check', handle: h })).text;
  if (action === 'why') return (await kgCall({ op: 'why', handle: h, fact: String(a.fact || a.claim || '') })).text;
  if (action === 'query') return (await kgCall({ op: 'query', handle: h, q: String(a.q || a.query || ''), limit: +a.limit || 50 })).text;
  // verify: one claim or several
  const claims = Array.isArray(a.claims) ? a.claims.slice(0, 30).map(String) : [String(a.claim || a.fact || '')];
  const out = [];
  for (const c of claims) { try { out.push((await kgCall({ op: 'verify', handle: h, claim: c })).text); } catch (e) { out.push(`! ${c}: ${e.message}`); } }
  return out.join('\n\n');
}

WORLD_TOOL_DEFS.push({
  name: 'knowledge',
  description: 'The knowledge graph: facts (relation(a, b)), rules and constraints, and a reasoner that proves answers. verify: check a claim (claim) or several (claims): ✓ PROVEN with the facts and rules it rests on, ✗ CONTRADICTED (with what it conflicts with), or ? UNKNOWN (the graph is open-world: missing is not false). Say which facts were unconfirmed. query: answers to conditions with variables, e.g. q="above(bob, X), works_at(X, C)". why: the proof of one fact. check: every constraint violation in the graph. add: propose a fact (fact="works_at(alice, acme)", or subject, relation, object; or facts=[...]) with source (a note path, or "chat"); your facts stay proposed until the user confirms them. facts: list (status, match). rules / add_rule (rule, comment): read or add a rule or constraint. remove: your own unconfirmed facts (id). stats. Names: lowercase words with _, or "quoted text"; variables start with an uppercase letter. The knowledge-graph skill explains how to extract facts and verify answers.',
  parameters: { type: 'object', properties: {
    action: { type: 'string', enum: KG_ACTIONS },
    claim: { type: 'string', description: 'verify: one claim, e.g. works_at(alice, acme) or not works_at(alice, acme)' },
    claims: { type: 'array', items: { type: 'string' }, description: 'verify: several claims' },
    q: { type: 'string', description: 'query: conditions, e.g. above(bob, X), works_at(X, C)' },
    fact: { type: 'string', description: 'add / why: one fact, e.g. works_at(alice, acme)' },
    facts: { type: 'array', items: { type: 'string' }, description: 'add: several facts' },
    subject: { type: 'string' }, relation: { type: 'string' }, object: { type: 'string' },
    source: { type: 'string', description: 'add: where the fact comes from: a note path or "chat"' },
    rule: { type: 'string', description: 'add_rule: a rule or a constraint (! name: …)' }, comment: { type: 'string' },
    status: { type: 'string', enum: ['confirmed', 'proposed', 'rejected'] }, match: { type: 'string' },
    id: { type: 'string' }, limit: { type: 'number' } }, required: ['action'] },
});
/** Verify mode: a line in the system prompt asking Jade to check her claims. */
const kgVerifyOn = () => !!ls.get('kgVerify', false);
const kgPromptExtra = () => kgVerifyOn() ? ' (VERIFY MODE IS ON: before you state facts the graph could cover, check them with knowledge verify, and mark each such claim in your answer ✓ proven, ✗ contradicted or ? unknown; say when a proof rests on unconfirmed facts)' : '';

/* ---------- the skill ---------- */
const KG_SKILL_PATH = '/Jade/skills/knowledge-graph/SKILL.md', KG_SKILL_VER = 1;
const KG_SKILL = `---
name: knowledge-graph
description: Use the knowledge tool to verify claims against the user's knowledge graph with proofs, to check notes for contradictions, and to extract facts from notes or chat as proposals. Use when the user asks to verify, fact-check, prove or explain something, to check their notes for consistency, to "add to the graph", or when verify mode is on.
---
<!-- knowledge-graph-skill v${KG_SKILL_VER}: written by Jade Vault; delete this line to keep your own edits -->
The knowledge graph is facts like \`works_at(alice, acme)\` plus rules and constraints, and a reasoner that proves answers. The point is verification: the reasoner decides, not you, and every answer comes with the facts and rules it rests on.

**Verify a claim.** Translate the claim into the graph's terms first: look at the relations it uses (\`knowledge action=stats\`) and use those names. Then \`knowledge action=verify claim="works_at(alice, acme)"\` (or \`claims=[…]\` for several). Report what came back, faithfully:
- ✓ **proven**: give the proof in one line (the facts it rests on). If it rests on unconfirmed facts, say so.
- ✗ **contradicted**: say what it conflicts with.
- ? **unknown**: the graph does not know. Never turn unknown into false or true. You may say what related facts the graph has.
Always show the user the exact claim you checked, so they can see your translation was right.

**Check consistency.** \`knowledge action=check\` lists every constraint the facts break, with the facts involved. To check notes, extract their facts first (below), then check.

**Extract facts** from a note or from what the user tells you: \`knowledge action=add facts=["works_at(alice, acme)", …] source="People/Alice.md"\`. Rules for good facts:
- One relation per fact; short snake_case relation names, reused across the graph (\`works_at\`, not \`is_employed_by\` one day and \`works_for\` the next). Check \`stats\` for the names already in use.
- Lowercase names for things (\`alice\`, \`acme\`); "quoted text" for anything with spaces or capitals; plain numbers for numbers; dates as "YYYY-MM-DD" text, so they compare correctly.
- Only what the text actually says. No guesses, no opinions.
- Your facts are **proposed** until the user confirms them in Notes → Knowledge. Tell them how many you proposed.

**Rules and constraints** make the graph useful: \`knowledge action=add_rule rule="above(X, Z) :- reports_to(X, Y), above(Y, Z)."\` or a constraint \`rule="! one_birthday: born_on(P, A), born_on(P, B), A != B."\`. Suggest one when the user's domain has an obvious rule, explain it in a sentence, and add it if they agree.

**Verify mode** (the user turns it on in Notes → Knowledge): before stating facts the graph could cover, verify them and mark each claim ✓, ✗ or ? in your answer.
`;
function kgSeedSkill() {
  try {
    const cur = kgRead(KG_SKILL_PATH);
    if (cur) { const m = /knowledge-graph-skill v(\d+)/.exec(cur); if (!m || +m[1] >= KG_SKILL_VER) return; }
    vfs.write(KG_SKILL_PATH, KG_SKILL, { mkdirs: true });
  } catch (e) { console.warn('knowledge-graph skill not installed', e); }
}

/* ---------- the Knowledge screen (Notes → Knowledge) ---------- */
const KGUI = { view: 'ask', filter: '', status: 'all', raf: 0, nodes: [], edges: [], cam: { x: 0, y: 0, k: 1 }, derived: false };
function kgBadge() { const n = kgFacts().filter(f => f.status === 'proposed').length; const b = $('#kgBadge'); if (b) { b.hidden = !n; b.textContent = n; } }
function openKnowledge(view) { if (view) KGUI.view = view; kgEnsure(); setTab('kg'); kgRender(); }
function kgRender() {
  const P = $('#kgPanel'); if (!P) return;
  $$('#kgViews [data-v]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === KGUI.view)));
  $('#kgVerify').checked = kgVerifyOn();
  cancelAnimationFrame(KGUI.raf);
  const v = KGUI.view;
  if (v === 'ask') {
    P.innerHTML = `<p class="kg-help">Check a claim, ask with variables, or see why something holds. Example: <code>works_at(alice, acme)</code>, <code>above(bob, X)</code>.</p>
      <input class="field mono" id="kgQ" placeholder="works_at(alice, acme)" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Claim or query">
      <div class="kg-row"><button class="btn btn-solid cut cut-sm" id="kgDoVerify">Verify</button><button class="btn btn-ghost" id="kgDoQuery">Query</button><button class="btn btn-ghost" id="kgDoWhy">Why</button></div>
      <pre class="kg-out" id="kgOut" aria-live="polite"></pre>`;
    const run = async op => { const q = $('#kgQ').value.trim(); if (!q) return; const o = $('#kgOut'); o.className = 'kg-out'; o.textContent = '…';
      try { const t = await knowledgeTool(op === 'verify' ? { action: 'verify', claim: q } : op === 'query' ? { action: 'query', q } : { action: 'why', fact: q }); o.textContent = t; o.classList.add(t.startsWith('✓') ? 'ok' : t.startsWith('✗') ? 'bad' : t.startsWith('?') ? 'unk' : 'plain'); }
      catch (e) { o.textContent = e.message; o.classList.add('bad'); } };
    $('#kgDoVerify').onclick = () => run('verify'); $('#kgDoQuery').onclick = () => run('query'); $('#kgDoWhy').onclick = () => run('why');
    $('#kgQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); run(/[A-Z_]\w*\s*[,)]/.test($('#kgQ').value) ? 'query' : 'verify'); } };
    return;
  }
  if (v === 'facts') {
    const list = kgFacts().filter(f => f.fact); const prop = list.filter(f => f.status === 'proposed').length;
    const q = KGUI.filter.toLowerCase(); const shown = list.filter(f => (KGUI.status === 'all' ? f.status !== 'rejected' : f.status === KGUI.status) && (!q || f.fact.toLowerCase().includes(q) || (f.source || '').toLowerCase().includes(q))).reverse();
    P.innerHTML = `<div class="kg-row"><input class="field mono flex-1" id="kgNew" placeholder="Add a fact: works_at(alice, acme)" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="New fact"><button class="btn btn-solid cut cut-sm" id="kgAddBtn">Add</button></div>
      <div class="kg-row"><input class="field flex-1" id="kgFilter" placeholder="Filter" value="${esc(KGUI.filter)}" aria-label="Filter facts">
        <select class="field" id="kgStatus" aria-label="Which facts">${['all', 'proposed', 'confirmed', 'rejected'].map(s => `<option value="${s}"${s === KGUI.status ? ' selected' : ''}>${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
      ${prop ? `<div class="kg-row kg-prop">${prop} proposed by Jade, waiting for you <button class="btn btn-ghost" id="kgConfAll">Confirm all</button><button class="btn btn-ghost" id="kgShowProp">Review</button></div>` : ''}
      <div class="kg-list">${shown.slice(0, 400).map(f => `<div class="kg-fact" data-id="${esc(f.id)}"><div class="kg-ft"><code>${esc(f.fact)}</code><span class="kg-st ${f.status}">${f.status}</span></div><div class="kg-src">${esc(f.source || '')}${f.by ? ' · ' + esc(f.by) : ''}</div>
        <div class="kg-acts">${f.status !== 'confirmed' ? '<button class="btn btn-ghost" data-a="confirm">Confirm</button>' : ''}${f.status !== 'rejected' ? '<button class="btn btn-ghost" data-a="reject">Reject</button>' : ''}<button class="btn btn-ghost" data-a="why">Why</button><button class="btn btn-ghost" data-a="del" aria-label="Delete">Delete</button></div></div>`).join('') || '<p class="kg-help">No facts here yet. Add one above, or ask Jade to read a note and propose facts from it.</p>'}</div>`;
    const add = async () => { const t = $('#kgNew').value.trim(); if (!t) return; try { const r = await kgAdd({ fact: t }, 'user'); toast(r.note === 'added' ? 'Added' : r.note); kgRender(); } catch (e) { toast(e.message, 'err'); } };
    $('#kgAddBtn').onclick = add; $('#kgNew').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    $('#kgFilter').oninput = e => { KGUI.filter = e.target.value; clearTimeout(KGUI.ft); KGUI.ft = setTimeout(() => { kgRender(); const i = $('#kgFilter'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    $('#kgStatus').onchange = e => { KGUI.status = e.target.value; kgRender(); };
    if ($('#kgConfAll')) { $('#kgConfAll').onclick = () => { const n = kgSetStatus(kgFacts().filter(f => f.status === 'proposed').map(f => f.id), 'confirmed'); toast(`Confirmed ${n}`); kgRender(); }; $('#kgShowProp').onclick = () => { KGUI.status = 'proposed'; kgRender(); }; }
    P.querySelectorAll('.kg-fact button').forEach(b => b.onclick = async () => {
      const id = b.closest('.kg-fact').dataset.id, act = b.dataset.a;
      if (act === 'confirm') kgSetStatus([id], 'confirmed'); else if (act === 'reject') kgSetStatus([id], 'rejected'); else if (act === 'del') kgRemove([id]);
      else { KGUI.view = 'ask'; kgRender(); $('#kgQ').value = kgFacts().find(f => f.id === id)?.fact || ''; $('#kgDoWhy').click(); return; }
      kgRender();
    });
    return;
  }
  if (v === 'rules') {
    kgEnsure();
    P.innerHTML = `<p class="kg-help">Rules add facts that follow; constraints (<code>! name: …</code>) flag contradictions. Saved to <code>${KG_RULES}</code>.</p>
      <textarea class="field mono kg-rules" id="kgRulesEd" spellcheck="false" autocapitalize="off" aria-label="Rules and constraints">${esc(kgRead(KG_RULES))}</textarea>
      <div class="kg-row"><button class="btn btn-solid cut cut-sm" id="kgRulesSave">Save</button><span class="kg-help" id="kgRulesMsg"></span></div>`;
    $('#kgRulesSave').onclick = async () => { const t = $('#kgRulesEd').value, m = $('#kgRulesMsg');
      try { const r = await kgCall({ op: 'parse_rules', rules: t }); vfs.write(KG_RULES, t, { mkdirs: true }); KG.sig = ''; m.textContent = `Saved: ${r.rules} rules, ${r.constraints} constraints.`; m.className = 'kg-help ok'; }
      catch (e) { m.textContent = e.message; m.className = 'kg-help bad'; } };
    return;
  }
  if (v === 'check') {
    P.innerHTML = '<pre class="kg-out" id="kgOut">Checking…</pre>';
    knowledgeTool({ action: 'check' }).then(t => { const o = $('#kgOut'); o.textContent = t; o.className = 'kg-out ' + (t.startsWith('No contradictions') ? 'ok' : 'bad'); }, e => { const o = $('#kgOut'); o.textContent = e.message; o.className = 'kg-out bad'; });
    return;
  }
  // graph
  P.innerHTML = `<div class="kg-row"><label class="kg-chk"><input type="checkbox" id="kgDerived"${KGUI.derived ? ' checked' : ''}> Show what follows from rules</label><span class="kg-help" id="kgGInfo"></span></div><canvas id="kgCv" class="kg-cv" aria-label="Graph of facts with two values"></canvas>`;
  $('#kgDerived').onchange = e => { KGUI.derived = e.target.checked; kgRender(); };
  kgGraph().catch(e => { $('#kgGInfo').textContent = e.message; });
}
async function kgGraph() {
  const h = await kgLoad(); const r = await kgCall({ op: 'edges', handle: h, limit: 600, derived: KGUI.derived });
  const old = new Map(KGUI.nodes.map(n => [n.id, n])); const nodes = new Map(); const edges = [];
  const node = v => { const id = typeof v === 'number' ? 'n:' + v : 's:' + v; if (!nodes.has(id)) { const o = old.get(id); const a = Math.random() * 6.28, d = 40 + Math.random() * 160; nodes.set(id, { id, label: String(v), x: o?.x ?? Math.cos(a) * d, y: o?.y ?? Math.sin(a) * d, vx: 0, vy: 0, deg: 0 }); } return nodes.get(id); };
  for (const e of r.edges) { const s = node(e.s), t = node(e.o); s.deg++; t.deg++; edges.push({ s, t, p: e.p, st: e.status }); }
  KGUI.nodes = [...nodes.values()]; KGUI.edges = edges; KGUI.alpha = 1;
  $('#kgGInfo').textContent = `${KGUI.nodes.length} things, ${edges.length} links${r.edges.length >= 600 ? ' (first 600)' : ''}`;
  const cv = $('#kgCv'); let drag = null;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, cx: KGUI.cam.x, cy: KGUI.cam.y }; };
  cv.onpointermove = e => { if (drag) { KGUI.cam.x = drag.cx + (e.clientX - drag.x) / KGUI.cam.k; KGUI.cam.y = drag.cy + (e.clientY - drag.y) / KGUI.cam.k; } };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; };
  cv.onwheel = e => { e.preventDefault(); KGUI.cam.k = Math.max(0.3, Math.min(3, KGUI.cam.k * (e.deltaY < 0 ? 1.1 : 0.9))); };
  const step = () => {
    const N = KGUI.nodes, a = KGUI.alpha;
    if (a > 0.003) {
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const n = N[i], m = N[j]; let dx = n.x - m.x, dy = n.y - m.y; const d2 = dx * dx + dy * dy + 0.01; if (d2 > 160000) continue; const f = 4000 / d2 * a, d = Math.sqrt(d2); dx /= d; dy /= d; n.vx += dx * f; n.vy += dy * f; m.vx -= dx * f; m.vy -= dy * f; }
      for (const { s, t } of KGUI.edges) { const dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 110) * 0.03 * a; s.vx += dx / d * f; s.vy += dy / d * f; t.vx -= dx / d * f; t.vy -= dy / d * f; }
      for (const n of N) { n.vx -= n.x * 0.005 * a; n.vy -= n.y * 0.005 * a; n.vx *= 0.8; n.vy *= 0.8; n.x += n.vx; n.y += n.vy; }
      KGUI.alpha *= 0.985;
    }
  };
  for (let i = 0; i < 220; i++) step();   // settle before the first frame
  const tick = () => {
    if ($('[data-panel="kg"]').hidden || !document.getElementById('kgCv')) return;
    step();
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, hh = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
    const { x: cx, y: cy, k } = KGUI.cam, X = n => w / 2 + (n.x + cx) * k, Y = n => hh / 2 + (n.y + cy) * k;
    g.font = '10px "JetBrains Mono", monospace'; g.textAlign = 'center';
    for (const e of KGUI.edges) {
      g.strokeStyle = e.st === 'proposed' ? 'rgba(255,200,80,.6)' : e.st === 'derived' ? 'rgba(140,170,255,.45)' : 'rgba(31,229,165,.5)';
      g.setLineDash(e.st === 'confirmed' ? [] : [4, 3]); g.beginPath(); g.moveTo(X(e.s), Y(e.s)); g.lineTo(X(e.t), Y(e.t)); g.stroke();
      if (k > 0.8 && KGUI.edges.length < 150) { g.fillStyle = 'rgba(227,242,237,.55)'; g.fillText(e.p, (X(e.s) + X(e.t)) / 2, (Y(e.s) + Y(e.t)) / 2 - 2); }
    }
    g.setLineDash([]);
    for (const n of KGUI.nodes) { const r = 3 + Math.min(7, Math.sqrt(n.deg) * 1.6); g.beginPath(); g.arc(X(n), Y(n), r, 0, 6.283); g.fillStyle = '#1fe5a5'; g.fill(); if (k > 0.6 || n.deg > 2 || KGUI.nodes.length < 40) { g.fillStyle = 'rgba(227,242,237,.9)'; g.fillText(n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label, X(n), Y(n) + r + 11); } }
    KGUI.raf = requestAnimationFrame(tick);
  };
  KGUI.raf = requestAnimationFrame(tick);
}
$$('#kgViews [data-v]').forEach(b => b.onclick = () => { KGUI.view = b.dataset.v; kgRender(); });
$('#btnKnowledge').onclick = () => openKnowledge();
$('#btnKgBack').onclick = () => setTab('files');
$('#kgVerify').onchange = e => { ls.set('kgVerify', e.target.checked); toast(e.target.checked ? 'Verify mode on: Jade checks her claims against the graph' : 'Verify mode off'); };
vfs.listeners.add(() => { clearTimeout(KGUI.bt); KGUI.bt = setTimeout(kgBadge, 400); });
setTimeout(() => { kgEnsure(); kgSeedSkill(); kgBadge(); }, 1700);
Object.assign(window, { knowledgeTool, kgCall, kgLoad, kgAdd, kgFacts, kgSetStatus, kgRemove, kgSeedSkill, openKnowledge, kgVerifyOn, KG, KG_SKILL });
