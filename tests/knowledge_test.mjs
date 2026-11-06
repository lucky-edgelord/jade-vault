// The knowledge graph in the app (2.25): the Rust engine as WebAssembly, the knowledge tool, its files, the Knowledge
// screen, verify mode, the skill, and a model turn that verifies a claim.
import { start } from './_harness.mjs';

const t = await start();
const { page, ok, model } = t;
const tool = a => page.evaluate(a => knowledgeTool(a).then(r => r, e => 'ERR ' + e.message), a);
const facts = () => page.evaluate(() => kgFacts());

await page.waitForFunction(() => typeof knowledgeTool === 'function', null, { timeout: 90000 });
await page.waitForFunction(() => vfs.isFile('/Jade/Knowledge/rules.dl') && vfs.isFile('/Jade/skills/knowledge-graph/SKILL.md'), null, { timeout: 15000 }).catch(() => {});
ok(await page.evaluate(() => vfs.isFile('/Jade/Knowledge/rules.dl') && vfs.isFile('/Jade/Knowledge/facts.jsonl')), 'the knowledge files are created in /Jade/Knowledge');
ok(await page.evaluate(() => /name: knowledge-graph/.test(vfs.read('/Jade/skills/knowledge-graph/SKILL.md'))), 'the knowledge-graph skill is in /Jade/skills');
ok(await page.evaluate(() => activeTools().some(t => t.function.name === 'knowledge') && !TR_CORE.has('knowledge')), 'knowledge is an optional tool');
ok(await page.evaluate(() => kgCall({ op: 'stats', handle: 0 }).then(() => false, e => e.code === 'request')), 'the Rust engine runs in the page (WebAssembly)');

let r = await tool({ action: 'stats' }); ok(/^0 facts/.test(r), 'empty at first: ' + r.split('\n')[0]);
r = await tool({ action: 'add', facts: ['reports_to(bob, alice)', 'reports_to(carol, bob)', 'works_at(alice, acme)'], source: 'People.md' });
ok((r.match(/proposed \(id/g) || []).length === 3, 'Jade\'s facts are proposed: ' + r.split('\n')[0]);
ok((await facts()).every(f => f.status === 'proposed' && f.by === 'jade' && f.source === 'People.md'), 'saved with status, author and source');
r = await tool({ action: 'add', subject: 'Carol', relation: 'Works at', object: 'Acme Corp' });
ok(/works_at\("Carol", "Acme Corp"\): proposed/.test(r), 'subject, relation, object become a fact: ' + r.split('\n')[0]);
r = await tool({ action: 'add', fact: 'reports_to(bob, alice)' }); ok(/already in the graph/.test(r), 'no duplicates');
r = await tool({ action: 'add', fact: 'reports_to(X, alice)' }); ok(/not added \(a fact cannot have variables/.test(r), 'a bad fact is refused with the reason');

r = await tool({ action: 'add_rule', rule: 'above(X, Y) :- reports_to(X, Y).' }); ok(/^Saved/.test(r), 'add_rule: ' + r.split('\n')[0]);
r = await tool({ action: 'add_rule', rule: 'above(X, Z) :- reports_to(X, Y), above(Y, Z)', comment: 'chain of command' });
r = await tool({ action: 'add_rule', rule: 'bad(X) :- not good(X).' }); ok(/^ERR .*not/.test(r), 'an unsafe rule is refused before it is saved: ' + r.slice(0, 80));
ok(await page.evaluate(() => !/bad\(X\)/.test(vfs.read('/Jade/Knowledge/rules.dl'))), 'and the rules file is unchanged');

r = await tool({ action: 'verify', claim: 'above(carol, alice)' });
ok(/^✓ PROVEN \(rests on 2 unconfirmed facts/.test(r) && /\[by rule: above\(X, Z\)/.test(r), 'verify proves through rules and names unconfirmed facts: ' + r.split('\n')[0]);
r = await tool({ action: 'verify', claim: 'above(alice, carol)' }); ok(/^\? UNKNOWN/.test(r), 'missing is unknown, not false');
r = await tool({ action: 'query', q: 'above(carol, X)' }); ok(/2 answers/.test(r) && /X = bob/.test(r) && /X = alice/.test(r), 'query: ' + r.replace(/\n/g, ' '));

// the user confirms in the Knowledge screen
await page.evaluate(() => openKnowledge('facts'));
ok(await page.evaluate(() => document.body.dataset.screen === 'kg' && !!document.querySelector('#kgConfAll')), 'the Knowledge screen lists proposals with Confirm all');
ok(await page.evaluate(() => document.querySelector('#kgBadge').textContent === '4' && !document.querySelector('#kgBadge').hidden), 'the Knowledge button shows how many wait');
await page.click('#kgConfAll'); await page.waitForTimeout(200);
ok((await facts()).every(f => f.status === 'confirmed'), 'Confirm all confirms them');
r = await tool({ action: 'verify', claim: 'above(carol, alice)' }); ok(/^✓ PROVEN: above\(carol, alice\)/.test(r), 'now proven without the unconfirmed note');
await page.fill('#kgNew', 'works_at(alice, globex)'); await page.click('#kgAddBtn'); await page.waitForTimeout(200);
ok((await facts()).some(f => f.fact === 'works_at(alice, globex)' && f.status === 'confirmed' && f.by === 'user'), 'facts the user adds are confirmed');

// constraints catch contradictions
await page.evaluate(() => vfs.write('/Jade/Knowledge/rules.dl', vfs.read('/Jade/Knowledge/rules.dl') + '! one_employer: works_at(P, A), works_at(P, B), A < B.\n'));
r = await tool({ action: 'check' }); ok(/^1 contradiction/.test(r) && /works_at\(alice, acme\), works_at\(alice, globex\)/.test(r), 'check finds the contradiction: ' + r.split('\n')[0]);
r = await tool({ action: 'verify', claim: 'works_at(bob, initech)' }); ok(/^\? UNKNOWN/.test(r), 'unrelated claims stay unknown');
await page.evaluate(() => { const l = kgFacts(); kgSetStatus(l.filter(f => f.fact === 'works_at(alice, globex)').map(f => f.id), 'rejected'); });
r = await tool({ action: 'verify', claim: 'works_at(alice, globex)' }); ok(/^✗ CONTRADICTED.*would break a constraint/.test(r) && /one_employer/.test(r), 'a claim that breaks a constraint is contradicted: ' + r.split('\n')[0]);
r = await tool({ action: 'add', fact: 'works_at(alice, globex)' }); ok(/the user rejected this fact before/.test(r), 'Jade cannot bring back a rejected fact');
r = await tool({ action: 'remove', id: (await facts())[0].id }); ok(/Not removed/.test(r), 'Jade cannot remove the user\'s confirmed facts');

// screen views
await page.evaluate(() => openKnowledge('ask'));
await page.fill('#kgQ', 'above(carol, alice)'); await page.click('#kgDoVerify'); await page.waitForFunction(() => /PROVEN/.test(document.querySelector('#kgOut').textContent));
ok(await page.evaluate(() => document.querySelector('#kgOut').classList.contains('ok')), 'Ask → Verify shows the proof');
await page.evaluate(() => openKnowledge('check')); await page.waitForFunction(() => document.querySelector('#kgOut')?.textContent !== 'Checking…');
ok(await page.evaluate(() => /No contradictions/.test(document.querySelector('#kgOut').textContent)), 'Check view (the rejected fact no longer counts)');
await page.evaluate(() => openKnowledge('rules'));
await page.fill('#kgRulesEd', 'broken(X :- y.'); await page.click('#kgRulesSave'); await page.waitForTimeout(200);
ok(await page.evaluate(() => /line 1/.test(document.querySelector('#kgRulesMsg').textContent) && !/broken/.test(vfs.read('/Jade/Knowledge/rules.dl'))), 'the rules editor refuses a broken file and says where');
await page.evaluate(() => openKnowledge('graph')); await page.waitForTimeout(800);
ok(await page.evaluate(() => /things, \d+ links/.test(document.querySelector('#kgGInfo').textContent)), 'Graph view draws: ' + await page.evaluate(() => document.querySelector('#kgGInfo').textContent));
await page.screenshot({ path: 'kg_graph.png' });

// a broken file is reported, not hidden
await page.evaluate(() => vfs.write('/Jade/Knowledge/facts.jsonl', vfs.read('/Jade/Knowledge/facts.jsonl') + JSON.stringify({ id: 'kx', fact: 'oops(', status: 'confirmed' }) + '\n'));
r = await tool({ action: 'verify', claim: 'above(carol, alice)' }); ok(/^ERR the knowledge graph has a problem: fact kx/.test(r) && /facts\.jsonl/.test(r), 'a broken fact names itself and the file: ' + r.slice(0, 90));
await page.evaluate(() => kgRemove(['kx']));

// verify mode puts the instruction in Jade's prompt
ok(await page.evaluate(() => !/VERIFY MODE IS ON/.test(systemPrompt())), 'verify mode is off by default');
await page.evaluate(() => { const c = document.querySelector('#kgVerify'); c.checked = true; c.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => /VERIFY MODE IS ON/.test(systemPrompt())), 'verify mode on: Jade is asked to mark her claims');

// a model turn: Jade verifies a claim with the tool
model.chatReply = (msgs) => {
  const u = [...msgs].reverse().find(m => m.role === 'user')?.content || ''; if (!/does carol report up to alice/i.test(u)) return null;
  return msgs.at(-1).role === 'tool' ? { content: '✓ Yes: carol → bob → alice.' } : { tool_calls: [{ function: { name: 'knowledge', arguments: { action: 'verify', claim: 'above(carol, alice)' } } }] };
};
await page.evaluate(() => setTab('chat'));
await page.fill('#input', 'Does carol report up to alice? Verify it.'); await page.evaluate(() => document.querySelector('#btnSend').click());
await page.waitForFunction(() => !running && cur.messages.some(m => m.role === 'tool' && m.tool_name === 'knowledge'), null, { timeout: 60000 }).catch(() => {});
const res = await page.evaluate(() => String(cur.messages.find(m => m.role === 'tool' && m.tool_name === 'knowledge')?.content || ''));
ok(/^✓ PROVEN: above\(carol, alice\)/.test(res), 'a model turn verifies with the tool: ' + res.split('\n')[0]);
ok((model.tools.at(-2) || []).some(x => x.function?.name === 'knowledge'), 'the tool router offers knowledge for a verification question');

await t.done();
process.exit(t.fail.length ? 1 : 0);
