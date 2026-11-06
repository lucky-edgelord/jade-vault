#!/usr/bin/env python3
"""Build the Jade Docs webxdc app: dist/jade-docs/ (the app folder) and dist/jade-docs.xdc.

Pages come from three places:
  apps/jade-docs/content/*.md   hand-written pages (first line: <!-- id: x | parent: y | level: 1-4 | order: n | tags: a, b -->)
  docs/*.md                     the existing guides (links rewritten, 2.9.0-era ones get a note)
  generated from the code       tools (data/tools.json), modules, settings (DEFAULTS), test suites, changelog
Run after `npm run build` so dist/jade-vault.html exists (settings are read from it).
    python3 scripts/build-docs-app.py
"""
import json, os, re, shutil, subprocess, sys, glob, hashlib, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'apps', 'jade-docs'); OUT = os.path.join(ROOT, 'dist', 'jade-docs')
VERSION = open(os.path.join(ROOT, 'VERSION')).read().strip()
pages = {}          # id -> dict
def add(id, title, md, parent='', level=2, order=500, tags=None, source=''):
    if id in pages: sys.exit('duplicate page id: ' + id)
    pages[id] = dict(id=id, title=title, parent=parent, level=level, order=order, tags=tags or [], md=md.strip() + '\n', source=source)
def title_of(md, fallback):
    m = re.search(r'^#\s+(.+)$', md, re.M); return re.sub(r'[`*]', '', m.group(1)).strip() if m else fallback

# ---------- 1. hand-written ----------
for p in sorted(glob.glob(os.path.join(A, 'content', '*.md'))):
    s = open(p).read(); m = re.match(r'\s*<!--\s*(.*?)\s*-->\s*', s, re.S)
    if not m: sys.exit('no header in ' + p)
    h = {k.strip(): v.strip() for k, v in (x.split(':', 1) for x in m.group(1).split('|'))}
    body = s[m.end():]
    add(h['id'], title_of(body, h['id']), body, h.get('parent', ''), int(h.get('level', 2)), int(h.get('order', 500)), [t.strip() for t in h.get('tags', '').split(',') if t.strip()], 'apps/jade-docs/content/' + os.path.basename(p))

# ---------- 2. existing guides ----------
GUIDES = {  # stem: (parent, level, order, era)
 'getting-started': ('guides', 2, 1, 'old'), 'compatibility-and-limitations': ('guides', 2, 2, 'old'), 'configuration': ('guides', 2, 3, 'old'),
 'notes': ('guides', 2, 4, 'old'), 'jade-and-memory': ('guides', 2, 5, 'old'), 'scripting': ('guides', 2, 6, 'old'), 'note-scripts-and-templates': ('guides', 2, 7, 'old'),
 'automation': ('guides', 2, 8, 'old'), 'integrations': ('guides', 2, 9, 'old'), 'apps': ('guides', 2, 10, 'old'), 'discord': ('guides', 2, 11, 'old'), 'vector': ('guides', 2, 12, 'old'),
 'http-api': ('guides', 2, 13, 'old'), 'backup-and-storage': ('guides', 2, 14, 'old'), 'security-and-privacy': ('guides', 2, 15, 'old'), 'troubleshooting': ('guides', 2, 16, 'old'),
 'backup-server': ('guides', 2, 17, 'new'), 'knowledge-graph': ('guides', 2, 18), 'autonomy': ('guides', 2, 19, 'new'), 'jade-lisp': ('guides', 2, 20, 'new'),
 'development': ('architecture', 3, 40, 'old'), 'android-apk': ('architecture', 3, 41, 'old'), 'deployment-and-releases': ('architecture', 3, 42, 'old'), 'design-tree-of-thoughts': ('think-delegate', 3, 5, 'design'),
}
def fix_links(md):
    def f(m):
        txt, tgt = m.group(1), m.group(2)
        mm = re.match(r'^(?:\./)?([\w-]+)\.md(#[\w-]+)?$', tgt)
        if mm and mm.group(1) in GUIDES: return f'[{txt}](#doc:{mm.group(1)}{mm.group(2) or ""})'
        if re.match(r'^https?://', tgt) or tgt.startswith('#'): return m.group(0)
        return txt   # a link to a file outside the docs app: keep the words only
    return re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', f, md)
for stem, (parent, level, order, era) in GUIDES.items():
    p = os.path.join(ROOT, 'docs', stem + '.md')
    if not os.path.isfile(p): print('missing guide', stem); continue
    md = open(p).read()
    md = re.sub(r'^\*\*Jade Vault [\d.]+\*\*.*\n', '', md, count=1, flags=re.M)
    md = fix_links(md)
    note = '> Written for Jade Vault 2.9.0. It is still right about what it covers; newer features are in the pages written for 2.18.0 and in the changelog.\n\n' if era == 'old' else ''
    t = title_of(md, stem); md = re.sub(r'^#\s+.+\n', '', md, count=1)
    add(stem, t, f'# {t}\n\n{note}{md}', parent, level, order, [stem.replace('-', ' ')], 'docs/' + stem + '.md')
add('guides', 'Guides', '# Guides\n\nTask-oriented guides. The first sixteen were written for 2.9.0 (they say so); the backup-server guide is new in 2.17.0.\n\n' +
    '\n'.join(f'- [{pages[s]["title"]}](#doc:{s})' for s in GUIDES if s in pages and GUIDES[s][0] == 'guides'), 'overview', 2, 5, ['guides', 'index'])

# ---------- 3. generated: tools ----------
tj = json.load(open(os.path.join(A, 'data', 'tools.json')))
rows = []
for t in tj['tools']:
    acts = next((p['enum'] for p in t['params'] if p['name'] == 'action' and p['enum']), None)
    md = f'# Tool: `{t["name"]}`\n\n{t["description"]}\n\n'
    if acts: md += '**Actions:** ' + ', '.join(f'`{a}`' for a in acts) + '\n\n'
    ps = [p for p in t['params'] if p['name'] != 'action' or not acts]
    if ps:
        md += '| Parameter | Type | Description |\n| --- | --- | --- |\n' + '\n'.join(f'| `{p["name"]}`{" (required)" if p["name"] in t["required"] else ""} | {p["type"]}{(" · " + " / ".join(p["enum"][:8])) if p["enum"] else ""} | {p["description"].replace("|", "/")} |' for p in ps) + '\n\n'
    md += f'Call it from scripts, flows and schedules with `await jade.tool(\'{t["name"]}\', {{…}})`.\n'
    add('tool-' + t['name'], 'Tool: ' + t['name'], md, 'tools', 4, 100 + len(rows), ['tool', t['name']], 'tools.json')
    rows.append(f'| [`{t["name"]}`](#doc:tool-{t["name"]}) | {t["description"].split(". ")[0][:150].rstrip(".")}. |')
add('tools', 'Tools reference', f'# Tools reference\n\nThe {tj["count"]} tools in the full set (some appear only when their feature is switched on; `find_skill` appears when there are more than 15 skills; MCP servers add `mcp__<server>__<tool>` tools). Each tool has its own page.\n\n| Tool | What it is for |\n| --- | --- |\n' + '\n'.join(rows), 'overview', 4, 20, ['tools', 'reference', 'index'])

# ---------- 4. generated: modules ----------
mods = []
for p in sorted(glob.glob(os.path.join(ROOT, 'app', 'modules', '*.js'))):
    s = open(p).read(); n = os.path.basename(p)
    m = re.search(r'/\*\s*=*\s*\n?(.*?)\*/', s[:4000], re.S)
    head = re.sub(r'\s*\n\s*', ' ', m.group(1).strip('= \n')).strip() if m else ''
    head = re.sub(r'\s{2,}', ' ', head)
    fns = re.findall(r'^(?:async )?function (\w+)', s, re.M)[:40]
    mods.append((n, len(s), s.count('\n') + 1, head, fns))
for i, (n, size, lines, head, fns) in enumerate(mods):
    md = f'# Module: `{n}`\n\n`app/modules/{n}` · {lines} lines · {size // 1024} KB\n\n{head or "(no header comment)"}\n\n'
    if fns: md += '**Top-level functions:** ' + ', '.join(f'`{f}`' for f in fns) + '\n'
    add('module-' + n[:-3].replace('_', '-'), 'Module: ' + n, md, 'modules', 4, 200 + i, ['module', n], 'app/modules/' + n)
add('modules', 'Modules reference', f'# Modules reference\n\n{len(mods)} source modules in `app/modules/`. See [Architecture](#doc:architecture) for how build.py uses them.\n\n| Module | Lines | What |\n| --- | --- | --- |\n' +
    '\n'.join(f'| [`{n}`](#doc:module-{n[:-3].replace("_", "-")}) | {lines} | {(head.split(". ")[0][:120]).replace("|", "/")} |' for n, size, lines, head, fns in mods), 'overview', 4, 21, ['modules', 'source', 'index'])

# ---------- 5. generated: settings ----------
html = open(os.path.join(ROOT, 'dist', 'jade-vault.html')).read()
i = html.index('const DEFAULTS = {'); j = i + len('const DEFAULTS = '); depth = 0; k = j
while True:
    c = html[k]
    if c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0: break
    k += 1
lit = html[j:k + 1]
try:
    out = subprocess.run(['node', '-e', 'console.log(JSON.stringify(Function("return (" + process.argv[1] + ")")()))', lit], capture_output=True, text=True, check=True).stdout
    D = json.loads(out)
except Exception as e:
    print('settings parse failed:', e); D = {}
groups = [('Model and providers', r'^(provider|fallback|lcpp|groq|oai|host|model|temperature|numCtx|think|maxTurns|ollamaKey|auxProv|auxModel|bb|engine|search|searx)'), ('Memory, context and compaction', r'^(memory|journal|compact|embed|rank|jadeCompact)'),
          ('Heartbeat and background', r'^(hb|bg)'), ('Voice and avatar', r'^(jade|voice|wake|tts|stt|hands|avatar)'), ('Tools and senses', r'^(senses|browser|screen|phone|sentry|ssh|think|delegate|askRisky|litert|noteScripts|vision|speech)'),
          ('Curiosity and backup', r'^(cu[A-Z]|curiosity|ab[A-Z])'), ('Messengers and APIs', r'^(vec|dc|api|npub|owner|admin|ollaya)')]
def grp(k):
    for name, rx in groups:
        if re.match(rx, k): return name
    return 'Other'
by = {}
for k, v in D.items():
    val = json.dumps(v); val = val if len(val) < 70 else val[:67] + '…'
    secret = bool(re.search(r'(key|token|pass|secret)', k, re.I)) and v not in ('', None, False, [])
    by.setdefault(grp(k), []).append(f'| `{k}` | `{"(secret)" if secret else val}` |')
md = f'# Settings reference\n\nThe {len(D)} settings in the `S` object with their defaults (from the built page). Settings live in `localStorage` under `jvault:settings`. Secrets and saved SSH machines are excluded from backups unless you opt in.\n\n'
for name in [g[0] for g in groups] + ['Other']:
    if name in by: md += f'## {name}\n\n| Setting | Default |\n| --- | --- |\n' + '\n'.join(by[name]) + '\n\n'
add('settings-reference', 'Settings reference', md, 'overview', 4, 22, ['settings', 'config', 'defaults', 'reference'])

# ---------- 6. generated: tests ----------
run = open(os.path.join(ROOT, 'tests', 'run.mjs')).read(); names = re.findall(r"'(\w+)'", re.search(r'const ALL = \[(.*?)\]', run, re.S).group(1))
TESTDESC = {
 'sq_glue_test': 'the SQLite WebAssembly glue: open, exec, prepared statements, serialize', 'sq_bridge_test': 'SQLite from the shell, node and Python through the bridge', 'sq_shim_test': 'the Python sqlite3 shim against a fake bridge (CPython)',
 'vault_test': 'notes, links, tags, search, editor, settings, gem themes, avatar', 'vault_apk_test': 'the Android-page build of the vault UI', 'py_test': 'MicroPython: running files, the vault as filesystem, packages',
 'sqlite_test': 'sqlite3 shell, node:sqlite, Python sqlite3 and sqlite-vec end to end', 'mcp_test': 'MCP servers: config reload, codemode and direct exposure, tool naming', 'hb_test': 'heartbeat: empty-file skip, HEARTBEAT_OK pruning, alerts',
 'prov_test': 'providers: Ollama, Groq, OpenAI-style streaming and tool calls, fallback chain', 'ctx_test': 'context guard: compaction, trimming, learning limits, the /context report', 'memrag_test': 'memory prefetch and hybrid ranking in the prompt',
 'api_test': 'the HTTP API routes against a fake native shell', 'api_java_test': 'ApiServer.java compiled and run on a plain JDK', 'flows_test': 'flows: every step type, expressions, retries, triggers', 'bridge_test': 'the script bridge (jade.* in node), shell commands, command/flow schedules',
 'tpl_test': 'note scripts (dataviewjs) and Templater templates', 'reply_test': 'reply bar: copy, thumbs, retry', 'tf_test': 'TensorFlow.js in scripts (CPU)', 'tf_gpu_test': 'TensorFlow.js with WebGL in a worker', 'traj_test': 'trajectory log, timestamps, the system prompt contents',
 'apps_test': 'webxdc apps: install, sandbox, updates, the apps tool', 'jadelink_test': 'Jade Link: wake-up, replies, board operations', 'vector_test': 'the Vector bridge client: roles, triggers, inbox', 'embed_test': 'embeddings and hybrid search against a fake Ollama (40 checks)',
 'kiosk_test': 'kiosk mode behaviour', 'world_test': 'senses, look, litert (a real .tflite model), hands-free voice, wake phrase', 'disk_test': 'the on-disk vault layer with a fake folder', 'browser_test': 'the browser tool against a second Chromium page standing in for the WebView',
 'phone_test': 'phone tool: alarms, sound, calls, SMS, Bluetooth, media, casting', 'screen_test': 'screen tool: read, tap, type, keyboard, screenshots', 'sentry_test': 'Sentry rules, systems, cooldowns, safety limits', 'ssh_test': 'ssh tool: hosts, sessions, host-key pinning, approvals',
 'think_test': 'think: tree search, verifiers, budgets, persistence', 'think_vault_test': 'the vault-resident think.js and its skill', 'skill_router_test': 'skill router: ranking, strict mode, stats', 'delegate_test': 'sub-agent: limits, read-only default, nesting guard',
 'chat_history_test': 'raw chat list, read and hybrid search', 'curiosity_test': 'curiosity: scoring, learning progress, CURIOSITY.md, wake runs, safety', 'playbook_test': 'playbooks: expression language, validation, tool tasks, when/loop/rescue/until, browser tasks, approvals, old-script conversion, the Playbooks tab', 'backup_test': 'scheduled backup against a fake server: gzip, encryption, backoff, restore',
 'docs_app_test': 'this docs app: BM25 ranking, UI, ask and answer round trip, docs_tool.js validation', 'aicord_test': 'the AICord provider', 'discord_test': 'Discord bridge client in the app', 'discord_archive_py': 'the Discord archive, backfill and render (Python)', 'backup_server_py': 'the backup server: auth, checksums, retention (Python)',
}
rows = []
for n in names:
    ext = '.py' if os.path.isfile(os.path.join(ROOT, 'tests', n + '.py')) else '.mjs'
    rows.append(f'| `{n}{ext}` | {TESTDESC.get(n, "")} |')
add('tests', 'Test suites', f'# Test suites\n\n{len(names)} suites in `tests/run.mjs` (`ALL`). Run one with `node tests/run.mjs name`, all with `node tests/run.mjs`.\n\n| Suite | What it covers |\n| --- | --- |\n' + '\n'.join(rows), 'build-test-release', 4, 30, ['tests', 'suites'])

# ---------- 7. generated: changelog ----------
cl = open(os.path.join(ROOT, 'CHANGELOG.md')).read()
parts = re.split(r'^## ', cl, flags=re.M)[1:]; links = []
for n, part in enumerate(parts):
    ver, _, body = part.partition('\n'); ver = ver.strip(); sid = 'changelog-' + ver.replace('.', '-')
    body = re.sub(r'\n- \*\*', '\n- **', body)
    add(sid, 'Release ' + ver, f'# Release {ver}\n\n{body.strip()}', 'changelog', 4, 300 + n, ['changelog', ver, 'release'], 'CHANGELOG.md')
    first = re.search(r'\*\*(.+?)\*\*', body); links.append(f'- [{ver}](#doc:{sid}){": " + first.group(1).rstrip(".:") if first else ""}')
add('changelog', 'Changelog', '# Changelog\n\nEvery release, newest first. Each has its own page so the search can find the feature.\n\n' + '\n'.join(links), 'overview', 4, 23, ['changelog', 'history', 'index'])

# ---------- check structure ----------
for id, p in pages.items():
    if p['parent'] and p['parent'] not in pages: sys.exit(f'page {id}: unknown parent {p["parent"]}')
    for m in re.finditer(r'\(#doc:([\w.-]+)', p['md']):
        if m.group(1) not in pages: print(f'warning: {id} links to missing page {m.group(1)}')
    if len(p['md'].encode()) > 48000: print(f'warning: {id} is {len(p["md"])} bytes (over the 50 KB source-read limit)')

# ---------- write the app folder ----------
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(os.path.join(OUT, 'pages'))
for f in ('index.html', 'style.css', 'app.js', 'manifest.toml', 'README.md', 'icon.png'): shutil.copy(os.path.join(A, f), OUT)
order = sorted(pages.values(), key=lambda p: (p['order'], p['title']))
data = {'version': VERSION, 'built': datetime.date.today().isoformat(), 'pages': [dict(id=p['id'], title=p['title'], parent=p['parent'], level=p['level'], order=p['order'], tags=p['tags'], md=p['md']) for p in order]}
open(os.path.join(OUT, 'docs-data.js'), 'w').write('window.DOCS=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
def heads(md): return [re.sub(r'[`*]', '', h) for h in re.findall(r'^#{2,3}\s+(.+)$', md, re.M)][:30]
idx = {'app': 'Jade Docs', 'version': VERSION, 'built': data['built'], 'levels': {'1': 'overview', '2': 'guides', '3': 'internals', '4': 'reference'}, 'count': len(order),
       'pages': [dict(id=p['id'], title=p['title'], parent=p['parent'], level=p['level'], tags=p['tags'], headings=heads(p['md']), bytes=len(p['md'].encode()), source=p['source']) for p in order]}
open(os.path.join(OUT, 'index.json'), 'w').write(json.dumps(idx, ensure_ascii=False, separators=(',', ':')))
for p in order: open(os.path.join(OUT, 'pages', p['id'] + '.md'), 'w').write(p['md'])
# the tool and the skill travel inside the app, so Jade can install them herself (apps action=source file="vault/docs_tool.js")
os.makedirs(os.path.join(OUT, 'vault', 'skills', 'document'))
shutil.copy(os.path.join(A, 'vault', 'docs_tool.js'), os.path.join(OUT, 'vault', 'docs_tool.js'))
shutil.copy(os.path.join(A, 'skill', 'document', 'SKILL.md'), os.path.join(OUT, 'vault', 'skills', 'document', 'SKILL.md'))
print(f'{len(order)} pages; index.json {os.path.getsize(os.path.join(OUT, "index.json")) // 1024} KB; docs-data.js {os.path.getsize(os.path.join(OUT, "docs-data.js")) // 1024} KB')
subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'pack_xdc.py'), OUT, os.path.join(ROOT, 'dist', 'jade-docs.xdc')], check=True)
