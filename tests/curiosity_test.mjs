// Curiosity wake-ups: the engine (learning progress vs the "noisy TV", priors, reward that is measured not self-reported,
// random schedule in a user-set range and hours) and the wake itself, run against a scripted model.
const { start } = await import('./_harness.mjs');
const { page, ok, model, read, done } = await start();
const E = (fn, arg) => page.evaluate(fn, arg);
// the vault-map skill is written shortly after start; let that happen before any wake is measured
await page.waitForFunction(() => typeof vfs !== 'undefined' && vfs.isFile('/Jade/skills/vault-map/SKILL.md'), null, { timeout: 15000 });

// ---------- engine ----------
ok(await E(() => !S.curiosityOn && !activeTools().some(t => t.function.name === 'curiosity')), 'off by default, and the tool is not offered while it is off');
ok(await E(() => { S.curiosityOn = true; const on = activeTools().some(t => t.function.name === 'curiosity') && /curiosity: your own wake-ups/.test(systemPrompt()); S.curiosityOn = false; return on; }), 'switched on, the tool is offered and described');

const lp = await E(() => {
  const t = Date.UTC(2026, 9, 1, 10); const st = cuNewState(); const out = { a: [], b: [] };
  const A = [0.2, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8], B = [0.1, 0.9, 0.9, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.9, 0.9, 0.1];
  A.forEach((r, i) => { const u = cuUpdate(st, 'explore', r, t + i * 3600e3); out.a.push(u.progress); });
  B.forEach((r, i) => { const u = cuUpdate(st, 'connect', r, t + i * 3600e3); out.b.push(u.progress); });
  return { a: out.a, b: out.b, ea: st.acts.explore.eS, eb: st.acts.connect.eS };
});
const maxA = Math.max(...lp.a), maxB = Math.max(...lp.b);
ok(maxA > 0.03 && maxB < maxA / 2, `learning progress rewards what becomes predictable, not what stays random (the noisy TV): peak ${maxA.toFixed(3)} vs ${maxB.toFixed(3)}`);
ok(lp.eb > lp.ea, 'the random activity keeps a high, flat error (' + lp.eb.toFixed(2) + ' vs ' + lp.ea.toFixed(2) + ') yet earns no curiosity bonus');
ok(lp.a.every(x => x >= 0), 'error going UP is never rewarded: progress is clamped at 0');

// priors: an activity that paid off before ranks above one that did not (same novelty), and rest is a real baseline
const pri = await E(() => {
  const now = Date.UTC(2026, 9, 2, 10), st = cuNewState();
  for (let i = 0; i < 30; i++) { cuUpdate(st, 'reflect', 0.8, now - (40 - i) * 3600e3); cuUpdate(st, 'connect', 0.05, now - (40 - i) * 3600e3); }
  const sc = cuScores(st, ['reflect', 'connect', 'rest'], now, null); return sc.map(s => [s.id, +s.score.toFixed(3)]);
});
ok(pri[0][0] === 'reflect' && pri[0][1] > 4 * pri.find(x => x[0] === 'connect')[1] && Math.abs(pri.find(x => x[0] === 'rest')[1] - pri.find(x => x[0] === 'connect')[1]) < 0.1, 'the track record steers: what paid off ranks far above what never did, which is about as attractive as resting: ' + JSON.stringify(pri));
const unt = await E(() => { const now = Date.now(), st = cuNewState(); for (let i = 0; i < 20; i++) cuUpdate(st, 'reflect', 0.3, now - 5e6); return cuScores(st, ['reflect', 'practice'], now, 'reflect').map(s => s.id); });
ok(unt[0] === 'practice', 'an untried activity gets optimism, and a repeat of the last one is penalised: ' + unt);
const dp = await E(() => { const st = cuNewState(), t = new Date(2026, 9, 2, 8).getTime(); for (let i = 0; i < 8; i++) { cuUpdate(st, 'reflect', 0.9, t); cuUpdate(st, 'reflect', 0.1, t + 9 * 3600e3); } return [cuPredict(st, 'reflect', 1), cuPredict(st, 'reflect', 3)]; });
ok(dp[0] > 0.55 && dp[0] - dp[1] > 0.15, 'priors are by time of day too: ' + dp.map(x => x.toFixed(2)));

// picking
const pk = await E(() => {
  const st = cuNewState(); const sc = [{ id: 'a', score: 1 }, { id: 'b', score: 0.5 }, { id: 'c', score: 0 }];
  const count = T => { const c = { a: 0, b: 0, c: 0 }; for (let i = 0; i < 4000; i++) c[cuPick(sc, T)]++; return c; };
  return { hot: count(1), cold: count(0.12), t0: cuTemperature(st), t1: (st.total = 400, cuTemperature(st)) };
});
ok(pk.cold.a > 3900 && pk.hot.a > pk.hot.b && pk.hot.b > pk.hot.c && pk.hot.c > 100, 'softmax pick: cold = almost always the best, hot = still explores: ' + JSON.stringify(pk.hot));
ok(pk.t0 > pk.t1 && pk.t1 >= 0.12, 'temperature falls as experience grows (' + pk.t0.toFixed(2) + ' → ' + pk.t1.toFixed(2) + ')');

// reward is measured
const rw = await E(() => ({ none: cuReward('explore', { created: 0, changed: 0, links: 0, memories: 0 }, 1), some: cuReward('explore', { created: 1, changed: 1, links: 2, memories: 1 }, null), mix: cuReward('explore', { created: 1, changed: 0, links: 0, memories: 0 }, 1), mixLow: cuReward('explore', { created: 1, changed: 0, links: 0, memories: 0 }, 0), rest: cuReward('rest', {}, 1), m1: cuMeasured({ created: 1 }), big: cuMeasured({ created: 50, changed: 50, links: 50, memories: 50 }) }));
ok(rw.none <= 0.05, 'claiming success with nothing changed earns almost nothing (' + rw.none.toFixed(3) + ')');
ok(rw.some > rw.mix && rw.mix > rw.none && rw.mix - rw.mixLow < 0.26 && rw.mix <= rw.m1 + 0.06, 'her own score counts a quarter at most and cannot lift the reward far above what was measured');
ok(rw.rest === 0.1 && rw.big <= 1, 'rest has a fixed baseline; the reward is bounded');

// schedule
const sch = await E(() => {
  const o = { min: 45, max: 180, from: '08:00', to: '22:00' }; const base = new Date(2026, 9, 2, 10, 0).getTime(); const ds = [], inWin = [];
  for (let i = 0; i < 300; i++) { const d = cuNextDelay(45, 180); ds.push(d / 60000); inWin.push(cuInWindow(cuNextAt(base, o), o.from, o.to)); }
  const soon = Array.from({ length: 200 }, () => cuNextDelay(45, 180, Math.random, 'sooner') / 60000), late = Array.from({ length: 200 }, () => cuNextDelay(45, 180, Math.random, 'later') / 60000);
  const late23 = new Date(2026, 9, 2, 23, 30).getTime(); const nx = cuNextAt(late23, o); const nd = new Date(nx);
  return { min: Math.min(...ds), max: Math.max(...ds), spread: new Set(ds.map(Math.round)).size, inWin: inWin.every(Boolean), soonMax: Math.max(...soon), lateMin: Math.min(...late), nextHour: nd.getHours(), nextDay: nd.getDate(), cross: [cuInWindow(new Date(2026, 9, 2, 23).getTime(), '22:00', '06:00'), cuInWindow(new Date(2026, 9, 2, 12).getTime(), '22:00', '06:00'), cuInWindow(Date.now(), '10:00', '10:00')] };
});
ok(sch.min >= 45 && sch.max <= 181.1 && sch.spread > 60, `wake times are random inside the set range (${sch.min.toFixed(0)}-${sch.max.toFixed(0)} min, ${sch.spread} distinct values)`);
ok(sch.inWin, 'a wake is never scheduled outside the active hours');
ok(sch.soonMax <= 113.6 && sch.lateMin >= 112, 'she can nudge the next wake to the lower or upper half of the range, never outside it');
ok(sch.nextDay === 3 && sch.nextHour === 8, 'late at night the next wake moves to the next morning: day ' + sch.nextDay + ' hour ' + sch.nextHour);
ok(sch.cross[0] === true && sch.cross[1] === false && sch.cross[2] === false, 'active hours may cross midnight; equal start and end means never');

// ---------- tool limits while awake ----------
const lim = await E(() => {
  const names = m => { S.cuTools = m; window.__curiosityRun = true; const n = activeTools().map(t => t.function.name); window.__curiosityRun = false; return n; };
  S.curiosityOn = true; const r = { notes: names('notes'), web: names('web'), all: names('all'), normal: activeTools().map(t => t.function.name) }; S.cuTools = 'web'; S.curiosityOn = false; return r;
});
ok(!lim.notes.includes('bash') && !lim.notes.includes('web_search') && lim.notes.includes('write') && lim.notes.includes('curiosity'), 'notes level: no shell, no web, but notes and her curiosity tool');
ok(lim.web.includes('web_search') && !lim.web.includes('bash') && !lim.web.includes('ssh'), 'web level: web search added, still no shell');
ok(lim.all.includes('bash') && lim.normal.includes('bash'), 'all level, and normal chat, are untouched');

// ---------- a wake, with a scripted model ----------
const script = steps => (msgs) => {
  if (!/Curiosity wake-up/.test(JSON.stringify(msgs.filter(m => m.role === 'user').slice(-1)))) return { content: 'hi' };
  const lastUser = msgs.map(m => m.role).lastIndexOf('user'); const k = msgs.slice(lastUser).filter(m => m.role === 'tool').length;
  return k < steps.length ? { content: '', tool_calls: [{ function: { name: steps[k][0], arguments: steps[k][1] } }] } : { content: 'Done for now.' };
};
await E(() => { Object.assign(S, { curiosityOn: true, cuMin: 20, cuMax: 40, cuFrom: '00:00', cuTo: '23:59', cuCap: 5, cuTools: 'web', cuActsOff: [], maxTurns: 20 }); ls.set('curiosity', null); ls.set('cuToday', { day: '', n: 0, notified: 0 }); });
model.chatReply = script([['curiosity', { action: 'choose', activity: 'explore', intent: 'learn about lentils' }], ['write', { path: '/Jade/Curiosity/Explorations/lentils.md', content: '# Lentils\nSee [[Cooking]] and [[Soups]].\n' }], ['curiosity', { action: 'report', summary: 'wrote a note on lentils', self_score: 1, next: 'sooner' }]]);
const before = Date.now();
await E(() => runCuriosity({ manual: true }));
let w = await E(async () => ({ log: cuState().log, total: cuState().total, next: ls.get('cuNext'), today: cuToday().n, run: window.__curiosityRun, turns: S.maxTurns, title: ((sessions.find(x => x.id === ls.get('cuSession', '')) || {}).title), msgs: ((await idb.get('session:' + ls.get('cuSession', ''))) || { messages: [] }).messages.length, pending: CU().pending, running: CU().running }));
const e = w.log.at(-1);
ok(w.log.length === 1 && e.id === 'explore' && e.measured.created === 1 && e.measured.links === 2 && e.self === 1, 'the wake: chose, wrote a note, reported; the harness measured 1 new note and 2 links: ' + JSON.stringify(e.measured));
ok(e.reward > 0.3 && e.reward < 0.8 && e.intent === 'learn about lentils' && typeof e.progress === 'number', 'reward is from what changed (' + e.reward + ') and the intent is kept');
ok(e.override === (e.suggested !== 'explore'), 'her choice is recorded as an override when she disagreed with the suggestion (suggested ' + e.suggested + ')');
ok(w.today === 1 && w.title === '✦ Curiosity' && w.msgs > 2 && w.run === false && w.turns === 20 && !w.running && w.pending === null, 'the wake runs in its own chat; flags and limits are restored afterwards: ' + JSON.stringify(w));
const delay = (w.next - before) / 60000;
ok(delay >= 5 && delay <= 41.2, 'next wake scheduled inside the range, and her "sooner" nudge used the lower half: ' + delay.toFixed(1) + ' min');
ok(await read('/Jade/Curiosity/Explorations/lentils.md') !== null, 'the note she wrote is in the vault');

// rest: nothing happens, the chat is pruned, baseline reward
const nMsgs = w.msgs;
model.chatReply = script([['curiosity', { action: 'choose', activity: 'rest', intent: 'nothing worth doing' }], ['curiosity', { action: 'report', summary: 'rested' }]]);
await E(() => runCuriosity({ manual: true }));
w = await E(async () => ({ log: cuState().log, msgs: ((await idb.get('session:' + ls.get('cuSession', ''))) || { messages: [] }).messages.length }));
ok(w.log.at(-1).id === 'rest' && w.log.at(-1).reward === 0.1 && w.msgs === nMsgs, 'rest is a real choice: baseline reward, and the quiet wake leaves no clutter in the chat');

// she never reports: the harness still learns from what changed
model.chatReply = script([['curiosity', { action: 'choose', activity: 'ask' }], ['write', { path: '/Jade/Curiosity/Questions.md', content: 'What is your favourite soup?\n' }]]);
await E(() => runCuriosity({ manual: true }));
w = await E(() => cuState().log.at(-1));
ok(w.id === 'ask' && w.measured.created === 1 && w.self === null && /no report/.test(w.note), 'without a report the wake is still finished and measured: ' + w.note);

// invalid use
model.chatReply = script([['curiosity', { action: 'choose', activity: 'world-domination' }], ['curiosity', { action: 'report' }]]);
const toolOut = await E(async () => { await runCuriosity({ manual: true }); return ((await idb.get('session:' + ls.get('cuSession', ''))).messages).filter(m => m.role === 'tool' && m.tool_name === 'curiosity').map(m => m.content); });
ok(toolOut.some(x => /choose one of: /.test(x)), 'choosing something that is not on the menu is refused: ' + JSON.stringify(toolOut));
ok(/only available during a curiosity wake-up/.test(await E(() => { try { curiosityTool({ action: 'choose', activity: 'explore' }); return ''; } catch (e) { return e.message; } })), 'choose and report only work during a wake-up');
const stat = await E(() => curiosityTool({ action: 'status' }));
ok(/Range 20-40 min/.test(stat) && /cannot change it/.test(stat) && /explore: Explore/.test(stat), 'status shows the user-set range, that she cannot change it, and her menu');

// disabled activities and the daily cap
await E(() => { S.cuActsOff = ['explore', 'reflect', 'connect', 'practice', 'anticipate', 'ask']; });
const menuOnly = await E(() => { const st = cuState(); return cuEnabledIds().join(); });
ok(menuOnly === 'rest', 'activities the user switched off are not on her menu');
await E(() => { S.cuActsOff = []; S.cuCap = 1; ls.set('cuToday', { day: cuDay(), n: 1, notified: 0 }); ls.set('cuNext', 1); });
const nBefore = await E(() => cuState().total);
await E(() => runCuriosity());
const capped = await E(() => { const d = new Date(); d.setHours(24, 0, 0, 0); return { total: cuState().total, next: ls.get('cuNext'), tomorrow: d.getTime() }; });
// tomorrow, not "an hour from now": with active hours from 00:00 the next wake is just after midnight, which late in the evening is under an hour away
ok(capped.total === nBefore && capped.next >= capped.tomorrow, 'at the daily cap she does not wake, and the next wake is tomorrow');
await E(() => { S.curiosityOn = false; ls.set('cuNext', 1); });
await E(() => cuTick()); await page.waitForTimeout(300);
ok((await E(() => cuState().total)) === nBefore, 'switched off, nothing wakes her');
done();
