// Vault Loci (2.24): the built-in map app, the vault_map tool, its skill, and texting Jade from the map.
import { start } from './_harness.mjs';

const t = await start();
const { page, ok, model } = t;
const tool = a => page.evaluate(a => vaultMapTool(a).then(r => r, e => 'ERR ' + e.message), a);
const appId = () => page.evaluate(() => XDC.apps.find(a => a.name === 'Vault Loci').id);
const ups = () => page.evaluate(async () => (await XdcDB.updates(XDC.apps.find(a => a.name === 'Vault Loci').id, 0)).map(u => ({ s: u.serial, p: u.payload, from: u.sender })));
const mapFrame = async () => { for (let i = 0; i < 80; i++) { for (const f of page.frames()) { try { if (await f.evaluate(() => !!(window.__jade && window.__jade.HOST))) return f; } catch {} } await page.waitForTimeout(250); } return null; };

await page.waitForFunction(() => typeof vaultMapTool === 'function' && typeof appsTool === 'function', null, { timeout: 90000 });
await page.waitForFunction(() => XDC.apps.some(a => a.name === 'Vault Loci' && a.origin === 'builtin'), null, { timeout: 20000 });
ok(true, 'Vault Loci is pre-installed');
await page.waitForFunction(() => vfs.isFile('/Jade/skills/vault-map/SKILL.md'), null, { timeout: 10000 }).catch(() => {});
ok(await page.evaluate(() => /name: vault-map/.test(vfs.read('/Jade/skills/vault-map/SKILL.md'))), 'the vault-map skill is in /Jade/skills');
ok(await page.evaluate(() => activeTools().some(t => t.function.name === 'vault_map') && !TR_CORE.has('vault_map')), 'vault_map is an optional tool');

let r = await tool({ action: 'look' });
ok(/Found 0\/11 loci/.test(r) && /- vault: Core Vault/.test(r), 'look opens the map and answers: ' + r.split('\n')[0]);
ok(/```\n#+\n/.test(r) && /@ you/.test(r) && /- comms: .*(north|south|east|west).*\d+ steps/.test(r), 'look has a text map and directions');
ok(await page.evaluate(() => XDC.session?.app.name === 'Vault Loci'), 'the map is open on the user\'s screen');
const fr = await mapFrame(); ok(fr && await fr.evaluate(() => window.__jade.HOST) === 'webxdc', 'the map runs in its frame as a webxdc app');

r = await tool({ action: 'goto', locus: 'stacks' }); ok(/^Arrived/.test(r) && /stacks/.test(r), 'goto: ' + r);
r = await tool({ action: 'remember', locus: 'stacks', text: 'The jade-py tutorial is docs/TUTORIAL.md.' }); ok(/Pinned at the stacks locus/.test(r), 'remember: ' + r);
r = await tool({ action: 'say', text: 'This is where the notes live.' }); ok(/^Said/.test(r), 'say');
r = await tool({ action: 'open', locus: 'vault' }); ok(/^Core Vault \(Sealed memory\)/.test(r) && /Memories here \(0\)/.test(r), 'open walks there and returns the panel');
r = await tool({ action: 'light', preset: 'black' }); ok(/9[56]% dark/.test(r), 'light: ' + r);
r = await tool({ action: 'goto', locus: 'nowhere' }); ok(/^ERR unknown locus/.test(r), 'an unknown locus is an error the model can read');
r = await tool({ action: 'fly' }); ok(/^ERR unknown action fly/.test(r), 'an unknown action is refused');

const walking = tool({ action: 'goto', locus: 'gate' });
await page.waitForTimeout(700);
await fr.evaluate(() => { window.__jade.hold('k:a', true); setTimeout(() => window.__jade.hold('k:a', false), 300); });
r = await walking; ok(/the user took over/.test(r), 'the user\'s input wins over Jade\'s walk: ' + r);

// nothing lost: the host used to give two quick updates the same serial
let u = await ups(); ok(u.every((x, i) => x.s === i + 1), `every update kept (serials 1..${u.length})`);
await page.evaluate(() => closeApp());
r = await tool({ action: 'recall', query: 'tutorial' }); ok(/1 memory/.test(r), 'memories survive closing the map: ' + r.slice(0, 60));

await page.evaluate(() => closeApp());
r = await tool({ action: 'say', text: 'Queued hello', show: false }); ok(/^Queued/.test(r), 'show:false queues while the map is closed');
await page.evaluate(() => { setTab('apps'); openApp(XDC.apps.find(a => a.name === 'Vault Loci')); });
await page.waitForFunction(async () => (await XdcDB.updates(XDC.apps.find(a => a.name === 'Vault Loci').id, 0)).some(u => u.payload?.t === 'ack' && u.payload.result?.said === 'Queued hello'), null, { timeout: 20000 })
  .then(() => ok(true, 'the queued command ran when the map opened'), () => ok(false, 'the queued command ran when the map opened'));

// texting Jade from the map: she wakes in the app's chat, walks, and answers in the map
model.chatReply = (msgs, uText) => {
  const last = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
  if (!/\[webxdc app "Vault Loci"/.test(last)) return null;
  const k = msgs.slice(msgs.findLastIndex(m => m.role === 'user')).filter(m => m.role === 'tool').length;
  if (k === 0) return { tool_calls: [{ function: { name: 'vault_map', arguments: { action: 'goto', locus: 'comms' } } }] };
  if (k === 1) return { tool_calls: [{ function: { name: 'apps', arguments: { action: 'send', app: 'Vault Loci', payload: { type: 'msg', text: 'I am at the comms desk now.' } } } }] };
  return { content: 'Answered in the map.' };
};
const f2 = await mapFrame();
await f2.evaluate(() => document.querySelector('#bChat').click());
ok(await f2.evaluate(() => !document.querySelector('#bChat').hidden && document.querySelector('#chat').classList.contains('open')), 'the Chat box opens in the map');
await f2.fill('#cin', 'come to the comms desk'); await f2.press('#cin', 'Enter');
let gotReply = false;
for (let i = 0; i < 120 && !gotReply; i++) { const f = await mapFrame(); try { gotReply = /comms desk now/.test(await f.evaluate(() => document.querySelector('#clog').textContent)); } catch {} if (!gotReply) await page.waitForTimeout(500); }
ok(gotReply, 'Jade woke up, walked, and her answer shows in the map\'s chat');
if (!gotReply) console.log('DBG', JSON.stringify((await ups()).slice(-8)), JSON.stringify(await page.evaluate(() => ({ q: XWAKE.q.length, busy: XWAKE.busy, chats: cur?.title }))));
const near = await (await mapFrame()).evaluate(() => window.__jade.active?.id);
ok(near === 'comms', 'she walked to the comms desk: ' + near);
await page.screenshot({ path: 'vm_chat.png' });
u = await ups(); ok(u.some(x => x.p?.type === 'msg' && x.from === 'you@jade.vault'), 'the user\'s message is an update from the user');
await page.evaluate(() => closeApp());

// a copy the user installed from a file is upgraded in place (memories kept), and the 2.23 demo's skill is replaced
const before = await appId();
await page.evaluate(async () => { const a = await XdcDB.app(XDC.apps.find(x => x.name === 'Vault Loci').id); a.origin = 'file'; await XdcDB.putApp(a); ls.set('vaultLociVer', 0); await seedVaultLoci(); await xdcRefresh(); });
ok(await page.evaluate(() => XDC.apps.filter(a => a.name === 'Vault Loci').length) === 1 && await appId() === before, 'upgrading keeps one copy with the same id');
r = await tool({ action: 'recall' }); ok(/1 memory/.test(r), 'and its memories');
await page.evaluate(() => closeApp());
await page.evaluate(() => vfs.write('/Jade/skills/vault-map/SKILL.md', '---\nname: vault-map\ndescription: old\n---\nRun node /Jade/tools/vault-map.js look'));
await page.evaluate(() => vmSeedSkill());
ok(await page.evaluate(() => /vault-map-skill v1/.test(vfs.read('/Jade/skills/vault-map/SKILL.md'))), 'the old script skill is replaced by the built-in one');
await page.evaluate(() => vfs.write('/Jade/skills/vault-map/SKILL.md', '---\nname: vault-map\ndescription: mine\n---\nmy own words'));
await page.evaluate(() => vmSeedSkill());
ok(await page.evaluate(() => /my own words/.test(vfs.read('/Jade/skills/vault-map/SKILL.md'))), 'a skill the user wrote is left alone');

await t.done();
process.exit(t.fail.length ? 1 : 0);
