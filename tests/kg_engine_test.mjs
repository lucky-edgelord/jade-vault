// The knowledge engine as shipped (app/vendor/jade_kg.wasm), without a browser: the shared cases in kg_cases.json
// (jade-py and the Rust unit tests run the same ones), speed, and its limits.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(here, '../app/vendor/jade_kg.wasm')), {});
const x = instance.exports, enc = new TextEncoder(), dec = new TextDecoder();
const call = req => { const b = enc.encode(JSON.stringify(req)); const p = x.kg_alloc(b.length); new Uint8Array(x.memory.buffer, p, b.length).set(b); const q = x.kg_call(p, b.length); const out = JSON.parse(dec.decode(new Uint8Array(x.memory.buffer, q, x.kg_out_len()))); x.kg_free(p, b.length); return out; };
const { cases } = JSON.parse(fs.readFileSync(path.join(here, 'kg_cases.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const norm = rows => rows.map(r => JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).sort();
const flat = p => p ? (p.by === 'fact' ? [p.fact] : (p.because || []).flatMap(flat)) : [];
for (const c of cases) {
  const l = call({ op: 'load', rules: c.rules, facts: c.facts || [] });
  if (c.op === 'error') { ok(!l.ok && l.code === c.code && (!c.message_has || l.error.includes(c.message_has)), `${c.name}: ${l.code} ${l.error || ''}`); continue; }
  if (!l.ok) { ok(false, `${c.name}: ${l.error}`); continue; }
  if (c.op === 'query') { const r = call({ op: 'query', handle: l.handle, q: c.input }); ok(JSON.stringify(norm(r.answers.map(a => a.bindings))) === JSON.stringify(norm(c.answers)), `${c.name}: ${JSON.stringify(r.answers.map(a => a.bindings))}`); }
  else if (c.op === 'check') { const r = call({ op: 'check', handle: l.handle }); const g = r.violations.map(v => JSON.stringify([v.constraint, Object.fromEntries(Object.entries(v.bindings).sort())])).sort(), w = c.violations.map(v => JSON.stringify([v[0], Object.fromEntries(Object.entries(v[1]).sort())])).sort(); ok(JSON.stringify(g) === JSON.stringify(w), `${c.name}: ${r.text.split('\n')[0]}`); }
  else {
    const r = call({ op: 'verify', handle: l.handle, claim: c.input }); let good = r.verdict === c.verdict;
    if (c.related) good &&= JSON.stringify(r.related) === JSON.stringify(c.related);
    if (c.proof_facts) good &&= JSON.stringify(flat(r.proof).sort()) === JSON.stringify([...c.proof_facts].sort());
    if (c.constraints) good &&= JSON.stringify(r.violations.map(v => v.constraint)) === JSON.stringify(c.constraints);
    if (c.rests_on_unconfirmed) good &&= JSON.stringify(r.rests_on.filter(f => f.status === 'proposed').map(f => f.id)) === JSON.stringify(c.rests_on_unconfirmed);
    ok(good, `${c.name}: ${r.verdict}`); if (!good) console.log(r.text);
  }
  call({ op: 'free', handle: l.handle });
}
// speed in WebAssembly: a 600-person chain (about 180,000 facts follow)
let lines = []; for (let i = 1; i < 600; i++) lines.push(`reports_to(p${i}, p${i - 1}).`);
let t0 = Date.now(); let l = call({ op: 'load', rules: lines.join('\n') + '\nabove(X, Y) :- reports_to(X, Y).\nabove(X, Z) :- reports_to(X, Y), above(Y, Z).' });
let r = call({ op: 'verify', handle: l.handle, claim: 'above(p599, p0)' });
ok(r.verdict === 'proven' && /✓ PROVEN: above\(p599, p0\)/.test(r.text), `600-person chain: ${l.stats.derived} facts follow, proven in ${Date.now() - t0} ms`); call({ op: 'free', handle: l.handle });
// the proof reads well and names its facts
l = call({ op: 'load', rules: 'reports_to(bob, alice).\nabove(X, Y) :- reports_to(X, Y).', facts: [{ id: 'k1', fact: 'reports_to(carl, bob)', status: 'proposed', source: 'People.md' }] });
r = call({ op: 'why', handle: l.handle, fact: 'above(bob, alice)' });
ok(/above\(bob, alice\) \[by rule: above\(X, Y\) :- reports_to\(X, Y\)\.\]\n  reports_to\(bob, alice\) \[fact rules:1, from rules line 1\]/.test(r.text), 'why: ' + r.text.replace(/\n/g, ' | '));
r = call({ op: 'verify', handle: l.handle, claim: 'above(carl, bob)' });
ok(/^✓ PROVEN \(rests on 1 unconfirmed fact: k1\)/.test(r.text) && /UNCONFIRMED, from People.md/.test(r.text), 'unconfirmed facts are named: ' + r.text.split('\n')[0]);
// runaway rules stop cleanly, and the engine keeps working after
lines = []; for (let i = 0; i < 2500; i++) lines.push(`r(p${i}, p${i + 1}).`);
l = call({ op: 'load', rules: lines.join('\n') + '\nt(X, Y) :- r(X, Y).\nt(X, Z) :- r(X, Y), t(Y, Z).' });
ok(!l.ok && l.code === 'limit', 'runaway rules stop with a clear error: ' + (l.error || '').slice(0, 50));
ok(call({ op: 'load', rules: 'a(b).' }).ok, 'the engine works after a refused load');
ok(call({ op: 'nope' }).code === 'request' && call({ op: 'query', handle: 999, q: 'a(X)' }).code === 'request', 'bad requests are errors, not crashes');
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
