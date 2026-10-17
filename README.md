# Jade Vault

A mobile, Obsidian-style markdown vault with an AI agent, Jade, built in. It runs entirely in the browser
or as an Android app. Jade reads and writes your notes, runs code, uses tools, remembers you, keeps
schedules, and lives on [Vector](https://vectorapp.io) messenger as your bot and secretary.

**Get it:** download the APK from [Releases](../../releases) (Android 7+), or open `jade-vault.html`
from a release in any modern browser. Point it at Ollama on your computer, or at Ollama Cloud, Groq,
llama.cpp or any OpenAI-compatible endpoint.

## What Jade can do

- **Notes:** markdown vault with `[[links]]`, backlinks, tags, graph, KaTeX math, images (`![[photo.png|300]]`), note embeds and a split editor.
- **Agent:** read/write/edit notes, a BusyBox shell (WebAssembly), `node` with `fs`, `fetch` and `https`, MicroPython, SQLite (`sqlite3`, `node:sqlite`, Python `sqlite3`), web search and fetch, `http_request` for any API (secrets as `{{NAME}}`), MCP servers (pi-style codemode, deferred or direct), skills.
- **Memory and steering:** long-term memory, a journal of past chats, and steering through SOUL.md, AGENTS.md and SYSTEM.md.
- **Running on its own:** schedules in plain English (a prompt, a shell command or a flow), `crontab`, a heartbeat that works from HEARTBEAT.md, and a background mode on Android.
- **Flows:** n8n-style automations in their own tab: steps of Jade's tools, JavaScript, shell commands, Ollaya decisions, AI answers and logic, started by hand, on a schedule, when a note changes, from the shell, from scripts or over the API.
- **Scripting Jade:** `jade.tool()`, `jade.decide()`, `jade.ask()`, `jade.flow()` … in the shell's `node`, plus `jade` and `flow` shell commands.
- **Note scripts & templates:** Obsidian-style ```` ```dataviewjs ```` blocks, inline `` `$= …` `` and Templater templates (`<% tp.date.now() %>`).
- **Robust:** context guard (compacts, trims, learns model limits), a provider fallback chain, and timestamps so she always knows the date and time.
- **Fine-tuning data:** a trajectory log of every run as the model saw it, exported as JSONL (OpenAI chat with tools, or ShareGPT), filtered by 👍/👎.
- **Webxdc apps:** an Apps tab with sandboxed offline mini apps that Jade can read, play and build. **Jade Link**, a messenger plus shared board, is built in.
- **Vector messenger:**
  - Jade is a bot. You (the owner) get the full Jade; admins get Vector powers; everyone else gets friendly chat and Mini Apps.
  - She answers DMs and whitelisted channels by your trigger rules.
  - She reacts, replies, sends and receives files, and sees images.
  - She joins and leaves communities and plays Mini Apps.
  - Secretary: messages for you land in an inbox, or reach you at once.
- **Chat:** Copy · 👍 · 👎 · Retry under each reply; copy and edit your own messages; copy code blocks or the whole chat.
- **Avatar:** Live2D Jade, with voice (TTS).

## Flows

The **Flows** tab holds automations kept as JSON in `/Jade/Flows/<name>.flow.json`. A flow is a list of steps that run in
order; each step's output is `$json` for the next. Step types: **Tool** (any of Jade's tools), **JavaScript** (node sandbox
with `fs`, `fetch` and `jade.*`), **Shell** (a BusyBox command line → `{code, stdout, stderr}`), **Decide** (Ollaya:
`{result, confidence, probabilities}`), **Ask AI** (one answer, optionally JSON), **Jade agent** (a full chat turn),
**Note** (read / write / append / prepend), **Set fields**, **If**, **Switch**, **For each**, **Wait**, **Notify me**,
**Run flow**, **Stop**. Any text field may hold `{{ JavaScript }}` with `$json`, `$input`, `$node["Step"]`, `$vars`, `$item`,
`$index`, `$now`, `$today` and `$date(fmt, date, days)`; expressions run in a sandbox without network. Each step can retry
(0-3) or continue on error, and every run is logged step by step (input, output, log, time).

Triggers: by hand, a schedule (`every weekday at 9am`, cron, `@daily`), or a note/folder changing. Also from the shell
(`flow run Name '{"x":1}'`), from scripts (`await jade.flow('Name', input)`), from the Schedule tab or `crontab`, by Jade
(her `flow` tool: help, list, get, create, update, delete, run, runs) and over the API (`/v1/flows`, `/v1/flow?name=…`).

```json
{"name": "Inbox triage", "trigger": {"type": "note", "path": "/Inbox.md"}, "steps": [
  {"type": "note", "name": "Inbox", "action": "read", "path": "/Inbox.md"},
  {"type": "each", "items": "$json.split('\n').filter(l => l.startsWith('- '))", "steps": [
    {"type": "decide", "name": "Urgent?", "state": "{{ $item }}", "question": "Is this urgent?", "kind": "yesno"},
    {"type": "if", "condition": "$json.result === true", "then": [
      {"type": "note", "action": "append", "path": "/Urgent.md", "content": "- [ ] {{ $item }}"}]}]},
  {"type": "notify", "title": "Inbox triaged", "body": "{{ $node.Inbox.length }} characters read"}]}
```

## Scripting Jade from the shell

In `node` (the shell, a flow's JavaScript step, or Jade's own bash): `await jade.tool('notes_search', {query: 'x'})`,
`jade.tools.read({path})`, `jade.decide({state, question, type, options})`, `jade.ask(prompt, {json, system})`,
`jade.agent(message)`, `jade.flow(name, input)`, `jade.shell('ls | wc -l')`, `jade.notify(title, body)`, `jade.kv.get/set`.
Files the script writes are visible to the tools it calls and the other way round.
**TensorFlow.js 4.22** is built in for scripts: `tf` (or `import * as tf from '@tensorflow/tfjs'`) in `node`, flow
JavaScript steps and Jade's bash. It uses the GPU (WebGL) when the WebView offers it in a worker, else the CPU. Keep a
trained model with `await model.save('indexeddb://name')` and `tf.loadLayersModel('indexeddb://name')`. It is loaded only
into scripts that use it (not note scripts), and needs no download.
Shell commands: `jade tool <name> [json | key=value …]`, `jade decide`, `jade ask`, `jade agent`, `jade notify`, `jade kv`;
`flow list | run | show | runs | enable | disable | import | export`; `crontab -l | add '<when>' '<command>' | -r <id> | <file>`.

Schedules (the Schedule tab, Jade's schedule tool, `crontab`) run a **prompt** (Jade, in a chat), a **shell command**
or a **flow**. Command and flow schedules run on their own, without the model and without waiting for the chat; their
output goes to `/Jade/Logs/cron.log` and a failure sends a notification. Like the rest of the app, schedules fire while
the app is open (on Android, keep it in the background with Config → App → Background).

## Note scripts & templates

Like Obsidian's Dataview and Templater. In Read and Split view, ```` ```dataviewjs ```` (or ```` ```jade-js ````) blocks run
and show their output, with `dv.pages('#tag' | '"folder"')`, `dv.page()`, `dv.current()`, `dv.table()`, `dv.list()`,
`dv.taskList()`, `dv.header()`, `dv.paragraph()`, `dv.io.load()`; pages carry their frontmatter and `file.{name, path,
link, tags, outlinks, inlinks, tasks, mtime}`. Inline `` `$= dv.pages('#proj').length` `` shows a value.
Templates are notes in `/Templates` (configurable); the **{ }** button in the editor inserts one, filling in
`<% tp.date.now("YYYY-MM-DD") %>`, `<% tp.file.title %>`, `<% tp.frontmatter.x %>`, `<% await tp.system.prompt("?") %>`,
`<% tp.file.include("[[Note]]") %>`, `<% tp.file.cursor() %>` and `<%* code; tR += "text" %>` (`-%>` trims a line break).
Scripts run in a sandbox: they read the vault, with no network and no file changes. Calling Jade's tools from them needs
Config → Tools → "Let note scripts call Jade's tools" (off by default).

## HTTP API (Android app)

Settings → Connect → API endpoint. Off by default. When on, Jade listens on your port (default 8787) and answers
**GET** requests with **JSON**. A message sent to `/v1/chat` goes through the normal chat: it appears in the app and
she answers there. Every call except `/v1/health` needs the token (`Authorization: Bearer TOKEN` or `?token=TOKEN`).
It listens on this phone only unless you allow your Wi-Fi; the traffic is plain HTTP, so use a trusted network.

```
curl -H "Authorization: Bearer $TOKEN" "http://PHONE:8787/v1/chat?message=What%20notes%20mention%20Lisbon%3F"
```
```json
{"ok":true,"api":1,"reply":"Two notes mention Lisbon: [[Trip Ideas]] and [[Maya]].",
 "session":{"id":"k3x9a2","title":"What notes mention Lisbon?","messages":2,"updated":1791916791826},
 "tool_calls":[{"name":"notes_search","arguments":{"query":"Lisbon"},"ok":true,"result":"..."}],
 "error":null,"model":"qwen3:8b","elapsed_ms":4210}
```

| Endpoint | What it does |
|---|---|
| `/v1/chat?message=TEXT` | Send a message. Optional: `session=new` or a chat id, `new=1`, `wait=0` (answer 202 now, read the result later), `tools=0`, `timeout=SECONDS` (default 300, max 1800), or all of it as `json={"message":"hi","new":true}`. |
| `/v1/status` | `busy`, model, the open chat. |
| `/v1/history?limit=20&session=ID` | The last messages of a chat. |
| `/v1/chats` | The list of chats. |
| `/v1/flows` | The flows, their triggers and last runs. |
| `/v1/flow?name=NAME&input=JSON` | Run a flow; returns its status, output and steps (`steps=0` leaves them out). |
| `/v1/health` | Public liveness check. |

Errors are JSON too: `{"ok":false,"error":{"code":"busy","message":"..."}}` with HTTP 400 (bad request), 401 (token), 404
(unknown chat), 409 (Jade is busy; one message at a time), 502 (model error) or 504 (still working; she carries on in the app).
Slash commands other than `/skill:name` are refused. While the API is on, the app keeps running in the background
with its notification.

## Repository layout

| Path | What |
| --- | --- |
| `app/base/` | The pi-netrunner base page (Live2D Jade, BusyBox WebAssembly shell, Ollama agent loop). |
| `app/modules/` | Jade Vault's layers: vault, memory, steering, providers, MCP, Python, SQLite, context guard, trajectories, HTTP, images, webxdc, Vector … |
| `app/build.py` | Applies the layers to the base page with exact-match edits and writes `dist/jade-vault.html`. |
| `app/tools/` | Tailwind compile, and the Android page (CDN-free basics inlined). |
| `apps/jade-link/` | Source of the built-in Jade Link webxdc app. |
| `android/` | Android wrapper (WebView, foreground service, TTS, file save), built without the Android SDK. |
| `jade-vector/` | The Vector bridge: patch for Vector's vector-agent, the HTTP bridge, setup script, Docker. |
| `sqlite-wasm/` | How `app/vendor/sqlite3.min.wasm` is built. |
| `tests/` | Playwright suites (headless Chromium) and engine tests; `node tests/run.mjs`. |

## Build

Needs Node 20+, Python 3.9+, and for the APK a JDK 17+ (no Android SDK).

```sh
npm install
npx playwright install chromium     # for the tests
npm run build                       # dist/jade-vault.html, android/proj/assets/index.html
npm test                            # 15 suites, ~8 minutes
bash android/build-apk.sh           # dist/jade-vault-<version>.apk (debug key)
```

To sign a release APK:

```sh
JADE_KEYSTORE=/path/release.jks JADE_KEYSTORE_PASSWORD=… JADE_KEY_ALIAS=netrunner bash android/build-apk.sh
```

Keep the keystore out of the repository. An APK signed with a different key cannot update an
installed one.

The version comes from `VERSION`, and the Android version code from `android/VERSION_CODE`. Bump both
for a release.

## Jade on Vector

See [`jade-vector/README.md`](jade-vector/README.md): run `jade-vector/setup.sh` on a Mac or Linux box
(or `docker compose up` there), then fill in Config → Vector messenger in the app:
- Bridge URL and token.
- Your npub as **owner**.
- Optionally an admin whitelist, a channel whitelist, who may DM her, trigger words, and how messages for you are delivered.

## Releases

Publishing a GitHub release (tag `vX.Y.Z`) runs `.github/workflows/release.yml`. It builds the web page, the signed APK
(repository secrets `JADE_KEYSTORE_B64`, `JADE_KEYSTORE_PASSWORD`, `JADE_KEY_ALIAS`), Jade Link and
the bridge kit, and attaches them to the release. `.github/workflows/docker.yml` publishes the bridge
image to GHCR.

## Security and licenses

See [SECURITY.md](SECURITY.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Jade Vault's code
is MIT. BusyBox is GPL-2.0. Live2D Cubism Core is under Live2D's proprietary license. The Jade avatar
model is not covered by the MIT license.

## Native host (JadeOS-Linux)

`native/jaded.mjs` is a zero-dependency Node daemon that serves the page and gives it the machine it runs on: the vault is a
real folder (`JADED_ROOT`, default `~/jade`), the shell is the real `/bin/sh` (BusyBox on JadeOS-Linux) with real `node`,
`micropython` and `sqlite3`, and no WebAssembly or browser copy is used. Jade's own commands (`jade`, `flow`, `crontab`,
`search` …) work from that shell. It binds to 127.0.0.1 and every call needs a per-start token carried by the page it serves.

    python3 app/build.py && JADED_PAGE=dist/jade-vault.html node native/jaded.mjs      # http://127.0.0.1:8080/

Tests: `node tests/run.mjs jaded_test native_test`.
