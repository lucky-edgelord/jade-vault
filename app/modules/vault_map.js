/* =====================================================================
   VAULT MAP — Jade and the user share one avatar inside the Vault Loci app.
   Vault Loci (apps/vault-loci) is a built-in webxdc app: a top-down map of the vault used as a memory palace. The user
   walks it with the D-pad, keys or a tap, and texts Jade from its Chat box (that wakes her in the app's own chat, see
   xdcwake.js). Jade walks it with the vault_map tool, which sends a command update as jade@jade.vault and waits for
   the app's answer. A player's own input always wins over Jade's walk. The app stays sandboxed: it knows only what
   happens on the map (walks, bubbles, the memories pinned there, the chat), never the vault. Wire format:
   apps/vault-loci/README.md.
   ===================================================================== */
const VM = { name: 'Vault Loci', seq: 0, waits: new Map() };
const VM_ACTIONS = ['look', 'goto', 'open', 'close', 'say', 'move', 'stop', 'light', 'remember', 'recall', 'forget'];
const VM_LOCI = ['vault', 'agents', 'tools', 'bench', 'archive', 'stacks', 'fleet', 'comms', 'deck', 'lockers', 'gate'];
const vmSleep = ms => new Promise(r => setTimeout(r, ms));

// the app answers every command with an ack update; hand it to whoever is waiting
XDC.listeners.add((app, u) => {
  const p = u && u.payload; if (!p || p.t !== 'ack' || typeof p.id !== 'string') return;
  const w = VM.waits.get(p.id); if (!w || w.appId !== app.id) return;
  VM.waits.delete(p.id); w.res(p);
});

async function vmApp() {
  await xdcRefresh();
  let a = XDC.apps.find(x => x.name === VM.name);
  if (!a) { await seedVaultLoci(true); await xdcRefresh(); a = XDC.apps.find(x => x.name === VM.name); }
  if (!a) throw new Error(`${VM.name} is not installed and could not be installed.`);
  return a;
}
const vmIsOpen = a => XDC.session?.app.id === a.id;

async function vmSend(app, cmd, args) {
  const id = 'j' + Date.now().toString(36) + (++VM.seq);
  await xdcSendUpdate(app, { payload: { v: 1, t: 'cmd', id, cmd, args, ts: Date.now() } }, XDC_JADE);
  return id;
}
/** Send one command and wait for the app's answer (null on timeout). */
async function vmCommand(app, cmd, args, timeoutMs) {
  const id = 'j' + Date.now().toString(36) + (++VM.seq);
  const ack = new Promise(res => VM.waits.set(id, { res, appId: app.id }));
  try {
    await xdcSendUpdate(app, { payload: { v: 1, t: 'cmd', id, cmd, args, ts: Date.now() } }, XDC_JADE);
    return await Promise.race([ack, vmSleep(timeoutMs).then(() => null)]);
  } finally { VM.waits.delete(id); }
}

const vmPlural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function vmText(action, r) {
  const at = p => Array.isArray(p) ? `(${p[0]}, ${p[1]})` : '';
  if (action === 'look') {
    const lines = (r.loci || []).map(l => `- ${l.id}: ${l.name} (${l.sub}), ${l.near ? 'you are here' : `${l.dir}, ${l.walk != null ? l.walk + ' steps' : 'no path'}`}${l.found ? '' : ', not found yet'}${l.memories ? `, ${vmPlural(l.memories, 'memory', 'memories')}` : ''}`);
    return `You are at ${at(r.pos)} facing ${r.facing}${r.moving ? ', walking' : ''}${r.near ? `, at the ${r.near} locus` : ''}${r.panel ? `; the ${r.panel} panel is open` : ''}. Found ${r.found.length}/${VM_LOCI.length} loci. Light: ${r.light.on ? `${r.light.dark}% dark` : 'off'}.\n` +
      (r.textmap ? `Map (north is up, # = walls and equipment, . = floor):\n\`\`\`\n${r.textmap}\n\`\`\`\n` : '') + lines.join('\n');
  }
  if (action === 'goto') return r.arrived ? `Arrived at ${at(r.pos)}${r.near ? `, at the ${r.near} locus` : ''}.` : r.interrupted ? `Stopped at ${at(r.pos)}: the user took over the controls. Do not walk again; ask what they want.` : `Did not arrive in time; now at ${at(r.pos)}.`;
  if (action === 'open') { const p = r.panel; return `${p.name} (${p.sub}): ${p.description}\nMeant for: ${p.items.join('; ')}\nMemories here (${p.memories.length}):${p.memories.map(m => `\n- [${m.id}] ${m.text}`).join('') || ' none'}`; }
  if (action === 'recall') return r.count ? `${vmPlural(r.count, 'memory', 'memories')}:\n` + r.memories.map(m => `- ${m.locus} [${m.id}]: ${m.text}`).join('\n') : 'No memories match.';
  if (action === 'remember') return `Pinned at the ${r.locus} locus (id ${r.id}); it now holds ${vmPlural(r.count, 'memory', 'memories')}.`;
  if (action === 'say') return `Said: "${r.said}"`;
  if (action === 'forget') return r.forgotten ? 'Forgotten.' : 'No memory with that id there.';
  if (action === 'move') return `Moved ${r.moved[0]}, ${r.moved[1]}; now at ${at(r.pos)}.`;
  if (action === 'close') return 'Closed the panel.';
  if (action === 'stop') return `Stopped at ${at(r.pos)}.`;
  if (action === 'light') return `Light: ${r.on ? `${r.dark}% dark, lantern ${r.lantern}, glow ${r.glow}%, shadows ${r.shadows ? 'on' : 'off'}` : 'off'}.`;
  return JSON.stringify(r);
}

async function vaultMapTool(args) {
  const action = String(args.action || 'look').toLowerCase();
  if (!VM_ACTIONS.includes(action)) throw new Error(`unknown action ${action}: use ${VM_ACTIONS.join(', ')}`);
  const app = await vmApp();
  const cmdArgs = { ...args }; for (const k of ['action', 'show', 'timeout_s']) delete cmdArgs[k];
  if (!vmIsOpen(app)) {
    if (args.show === false) { await vmSend(app, action, cmdArgs); return `Queued: ${VM.name} is not open, so this runs when the user next opens it (within 10 minutes).`; }
    setTab('apps'); openApp(app);
    // wait for the map to boot and answer before sending the real command
    if (!(await vmCommand(app, 'ping', {}, 20000))) throw new Error(`${VM.name} opened but did not start answering. Try again in a moment.`);
  }
  const timeout = Math.min(120, Math.max(5, +args.timeout_s || (action === 'goto' || action === 'open' ? 60 : 20))) * 1000;
  const ack = await vmCommand(app, action, cmdArgs, timeout);
  if (!ack) throw new Error(`No answer from ${VM.name} within ${timeout / 1000}s${vmIsOpen(app) ? '' : ' (the user closed the map)'}.`);
  if (!ack.ok) throw new Error(ack.error || 'the map refused that');
  if (ack.result?.truncated) return 'The map answered, but the result was too big to pass on. Use look, or recall with a query.';
  return vmText(action, ack.result || {});
}

WORLD_TOOL_DEFS.push({
  name: 'vault_map',
  description: `Walk your avatar on the Vault Loci map, a top-down memory palace of this vault that you share with the user (they walk it too, and their input wins). It opens on their screen. Eleven places (loci): ${VM_LOCI.join(', ')}. look: a text map and the direction and distance to every locus. goto: walk to a locus (or x, y); waits until you arrive and says if the user took over. open: walk to a locus and show its panel and the memories pinned there. close. say: a speech bubble (text). move: one D-pad step (dir, ms). stop. light: preset lit, dim or black. remember: pin a memory at a locus (locus, text up to 240 chars). recall: list memories (locus, query, both optional). forget: remove one (locus, id). The map holds only what happens on it; its memories are separate from your memory tool, and plain text anyone with the app can read: never passwords or private data. The vault-map skill says how to use it well.`,
  parameters: { type: 'object', properties: {
    action: { type: 'string', enum: VM_ACTIONS },
    locus: { type: 'string', description: 'A locus id or name: ' + VM_LOCI.join(', ') },
    x: { type: 'number', description: 'goto: map x (0-2576); prefer locus' }, y: { type: 'number', description: 'goto: map y (0-1438); prefer locus' },
    text: { type: 'string', description: 'say: the words (160 chars). remember: the memory (240 chars)' },
    dir: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, ms: { type: 'number', description: 'move: how long to hold the direction (50-4000)' },
    preset: { type: 'string', enum: ['lit', 'dim', 'black'] }, on: { type: 'boolean', description: 'light: false turns the lighting effect off' },
    query: { type: 'string', description: 'recall: only memories containing these words' }, id: { type: 'string', description: 'forget: the memory id from recall or open' },
    show: { type: 'boolean', description: 'false: if the map is closed, queue the command for the next time the user opens it instead of opening it now' },
    timeout_s: { type: 'number', description: 'How long to wait for the answer (goto and open 60 s, the rest 20 s)' } }, required: ['action'] },
});

/* ---- installed on first run: the app (built in) and its skill ---- */
const VLOCI_VER = 1;
async function seedVaultLoci(force) {
  const el = document.getElementById('xdc-vaultloci'); if (!el) throw new Error('the Vault Loci package is missing from this build');
  const mine = (await XdcDB.apps()).find(a => a.name === VM.name);
  const ver = +ls.get('vaultLociVer', 0);
  if (!force && ver >= VLOCI_VER) return;   // current, or the user removed it on purpose (only the tool puts it back)
  // a copy the user installed from a file is upgraded in place, so its memories and chat are kept
  const bytes = Uint8Array.from(atob(el.textContent.replace(/\s+/g, '')), c => c.charCodeAt(0));
  await xdcInstallBytes(bytes, { origin: mine?.origin || 'builtin', name: VM.name }); ls.set('vaultLociVer', VLOCI_VER);
}
const VM_SKILL_PATH = '/Jade/skills/vault-map/SKILL.md', VM_SKILL_VER = 1;
const VM_SKILL = `---
name: vault-map
description: Walk the Vault Loci map (the memory palace of this vault you share with the user) with the vault_map tool, and answer the user when they text you from it. Use when the user asks you to show them around the map, go somewhere on it, remember something "in the palace" or "at" a place, recall what was left there, or when a message comes from the Vault Loci app.
---
<!-- vault-map-skill v${VM_SKILL_VER}: written by Jade Vault; delete this line to keep your own edits -->
The map is a room with eleven places (loci). You and the user share one avatar: they walk it with the D-pad, you with \`vault_map\`. They usually watch, so move with purpose and keep words short.

1. **Look first.** \`vault_map action=look\` gives a text map (north is up) and, for every locus, its direction and walking distance from you. Look once at the start of a task, and again after a walk was interrupted.
2. **Pick the place by meaning:** vault = the most important things; agents = models and helpers; tools = tools, skills, how-tos; bench = work in progress; archive = finished things, old chats; stacks = facts, notes, documents; fleet = other devices; comms = people and messages; deck = reminders and routines; lockers = past runs and ratings; gate = links and the outside world.
3. **Walk, then pin.** \`goto locus=stacks\`, then \`remember locus=stacks text="…"\`. One idea per memory, a sentence that makes sense on its own, 240 characters at most. Walking there first is what ties the place to the memory.
4. **Recall** with \`recall query="…"\` (add \`locus\` for one place), or \`open locus=…\` to walk there and show the panel with everything pinned.
5. **The user can take over.** If goto says the user took over, stop. Do not walk again: ask what they want.
6. **Speak sparingly.** \`say text="…"\` is one short line in a bubble over you.
7. **Light** (\`preset=lit|dim|black\`) only when asked, or for a moment; put it back after.

**When the user texts you from the map**, the message arrives in the map's own chat. Do what they asked with vault_map first, then answer with \`apps action=send app="Vault Loci" payload={"type":"msg","text":"…"}\`, one to three sentences. It shows in the map's chat and as a bubble over you.

The map's memories are its own: they are not your memory tool and not the vault's notes. If something matters beyond the palace, also save it with \`memory\` or in a note. They are plain text anyone with the app can read, so never pin passwords, keys or private data; the Core Vault is a place, not a lock.
`;
function vmSeedSkill() {
  try {
    let cur = ''; try { cur = vfs.isFile(VM_SKILL_PATH) ? vfs.read(VM_SKILL_PATH) : ''; } catch {}
    if (cur) {
      const m = /vault-map-skill v(\d+)/.exec(cur);
      const oldScript = !m && /node \/Jade\/tools\/vault-map\.js/.test(cur) && /^---\s*\nname: vault-map/.test(cur);   // the 2.23 demo's skill, before the tool was built in
      if (!oldScript && (!m || +m[1] >= VM_SKILL_VER)) return;   // the user's own copy, or already current
    }
    vfs.write(VM_SKILL_PATH, VM_SKILL, { mkdirs: true });
  } catch (e) { console.warn('vault-map skill not installed', e); }
}
setTimeout(() => { seedVaultLoci().catch(e => console.warn('Vault Loci not installed', e)); vmSeedSkill(); }, 1800);
Object.assign(window, { vaultMapTool, vmCommand, vmApp, seedVaultLoci, vmSeedSkill, VM, VM_SKILL, VM_ACTIONS });
