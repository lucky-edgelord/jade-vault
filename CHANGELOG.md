# Changelog

## 2.27.0

- **OpenRouter is a model provider.** Config → Model provider → OpenRouter: one key (`sk-or-…`) for hundreds of hosted models (Claude, GPT, Gemini, Llama, Qwen, DeepSeek…). The model list shows the models that can call tools; model ids look like `anthropic/claude-sonnet-4.5`. It works as the main provider, a fallback, the heartbeat and compaction model, and in the model router (`openrouter | anthropic/claude-sonnet-4.5 | hard coding`). OpenRouter's attribution headers are sent, and the key is kept out of exports like the other keys.
- **Decisions through OpenRouter.** Config → Decision models → Server → OpenRouter: `decide`, scripts' `jade.decide()`, flow Decide steps and the model router can use an OpenRouter model. Scan lists models that report log probabilities. The options are lettered, the model answers with one letter, and the probabilities come from that token's log probabilities (a model without them is asked for probabilities as JSON). The key field may stay blank to use the provider key.

## 2.26.2

- **Plans:** on a phone the chart showed only its first two tasks (the page squeezed it); it now shows every task.
- **Queue:** the status line says how many tasks are ready instead of "Idle: nothing ready" while it waits for the next turn, and "no quiet hours" when there are none.
- The README has screenshots of the app (taken by `scripts/screenshots.mjs` on demo notes).

## 2.26.1

- **Plans** and **Queue** moved to the **Schedule** tab, next to **+ New**: they are about time, and the Notes bar was too crowded (Vault and Today overlapped on phones). Back from either returns to Schedule.
- The Notes bar no longer squeezes its title: on a phone the "Vault" label (the Notes tab already says where you are) is left out, so Vault no longer overlaps Today and **+ Note** fits; if it still does not fit, the bar scrolls sideways.

## 2.26.0

- **Autonomous mode, run by a 3-tier scheduler.** The new **Queue** screen (Schedule → Queue) has an **Autonomous** switch. When it is on, Jade works through her queue on her own, the way an operating system schedules programs (a multilevel feedback queue):
  - **Tier 1, interrupts:** urgent items, always first, in the order they came. Jade can hold at most three of her own.
  - **Tier 2, the priority queue:** one-off work with a priority (0–100) and an optional due time. Waiting raises priority (up to +40), and a near or missed deadline raises it more, so nothing waits forever.
  - **Tier 3, round robin:** long goals, worked on in short slices of 2, 4 or 8 model steps. A goal that uses its whole slice drops a level; one that waits 30 minutes rises again. Tier 3 gets at least every 4th turn even when tier 2 is busy.
  - Between slices Jade keeps only a short note, and ends each slice with `STATUS: done`, `continue` or `blocked: …` (a blocked task waits for you, with the reason).
  - Tasks can be goals, one-off prompts, flows, playbooks, shell commands or Jade Lisp programs.
- **Your limits.** Steps an hour (60 by default), a daily cap (600), quiet hours (11pm–7am), and a pause while you use the app or chat. **Stop** turns it off at once. Tools that reach outside the vault (phone, SSH, Discord, USB, browsers, screen, apps, MCP servers; you can edit the list) wait for your **Allow** in the Queue. Everything Jade does is logged in `/Jade/Autonomy/log.md`, and the Queue shows each tier, recent slices and a strip of the last 60.
- **Plans: Gantt charts for long-term projects.** The new **Plans** screen (Schedule → Plans) draws projects as a Gantt chart: tasks with dates, dependencies (arrows), milestones (diamonds), owners (you or Jade), percent done, a today line, the critical path, and days, weeks or months. Drag a bar to move a task (the tasks after it follow); tap it to edit. Plans are files in `/Jade/Projects`. Jade plans with the new `gantt` tool: she adds tasks, links them, reschedules (`plan`), and reports what is late, blocked, ready or on the critical path. Your tasks are yours: she asks before changing one. With autonomous mode on, her ready tasks go into tier 3 by themselves and are marked 100% when done.
- **Jade Lisp is part of the base system.** A small Scheme/Clojure-style Lisp (`/Jade/tools/lisp.js`) for building DSLs and scripting, with the new `lisp` tool. Every tool is callable as `(tool/NAME :arg value)`, plus `jade/ask`, `jade/flow`, `jade/shell`, `tflite/load` and `tflite/run`, files and JSON. It has macros (`defmacro`, quasiquote), tail calls, try/catch, maps and keywords; `(sandbox :pure)` with `eval-in` runs programs someone else wrote with only the verbs you give them and a step limit. A DSL library (`/Jade/Lisp/lib/dsl.jl`) and examples (a state machine, a rules language, tools, LiteRT) come with it. From the shell: `node /Jade/tools/lisp.js FILE.jl` or `node /Jade/tools/lisp.js eval '(+ 1 2)'`.
- Two new skills, **autonomy** and **lisp-dsl**, and new guides: Autonomy and Plans, and Jade Lisp.

## 2.25.0

- **The knowledge graph: facts, rules, and a reasoner that proves its answers.** Notes → Knowledge holds facts like `works_at(alice, acme)` and rules and constraints, and a reasoner (Datalog, written in Rust and run as WebAssembly) checks claims against them. Every answer is one of three:
  - ✓ **proven**, with the facts and rules it rests on;
  - ✗ **contradicted**: its opposite holds, or it would break one of your constraints (for example "a person has one employer");
  - ? **unknown**: the graph does not say. Missing is never treated as false.
- **Verify Jade's answers.** The new `knowledge` tool lets Jade verify claims, answer questions with variables (`above(bob, X)`), show why something holds, and list every contradiction in the graph. Turn on **Verify answers** in the Knowledge screen and she checks her factual claims against the graph and marks each one ✓, ✗ or ?.
- **Check your notes.** Ask Jade to read notes and propose their facts, then **Check** lists every constraint they break, with the facts involved.
- **You decide what counts.** Facts you add are confirmed. Facts Jade adds are proposed until you confirm them (the Knowledge button shows how many wait; Confirm all, or one at a time). A proof that rests on unconfirmed facts says so, and a fact you reject stays out: Jade cannot add it again.
- The Knowledge screen has Ask (verify, query, why), Facts, Rules (an editor that refuses a broken rules file and says which line), Check and Graph views. The files are `/Jade/Knowledge/facts.jsonl` and `/Jade/Knowledge/rules.dl`, plain text that syncs and backs up with the vault; jade-py 0.12 uses the same files and the same engine. A `knowledge-graph` skill tells Jade how to extract facts and report verdicts.
- The engine handles large graphs: in tests, 180,000 facts that follow from a chain of 600 people take about 0.15 s in the browser, and a graph that would grow past 2 million facts stops with a clear error.

## 2.24.0

- **Vault Loci: a map of the vault that you and Jade walk together.** A new built-in app in the Apps tab: a top-down, lit pixel-art room with eleven places (loci), used as a memory palace. Walk the avatar with the D-pad, WASD or the arrow keys (Shift or a held B runs), a gamepad, or a tap on the floor; A or E opens a place. **Jade walks the same avatar** with a new `vault_map` tool: she can look around, walk to a place, open it, speak in a speech bubble, change the lighting, and pin, recall or forget memories at places. Your own input always wins over a walk she is making, and she is told to stop and ask. `look` gives her a text map of the room and the direction and walking distance to every place, so she can find her way.
  - **Text Jade from the map.** The new Chat button (or T) opens a chat box inside the app. A message wakes Jade in the app's own chat, the same way Jade Link does; her answer shows in the box and as a bubble over the avatar, and she can walk while you talk. The chat comes back when you reopen the map.
  - The app stays sandboxed: it knows only what happens on the map (walks, bubbles, the memories pinned there, the chat), never your notes, memory or settings. Its memories are its own, separate from Jade's memory tool. A new `vault-map` skill in /Jade/skills tells Jade how to use it, including never pinning passwords or private data (the Core Vault is a place, not a lock).
  - If you installed the Vault Loci demo from a file, it is upgraded in place and keeps its memories, and the demo's skill (which used a vault script) is replaced; a skill you wrote yourself is left alone. The app has a debug log and an input self-test (Light → Debug log).
- **Fixed: a webxdc app could lose an update.** Two updates sent at the same moment (an app sending twice in a row, or the app and Jade together) could get the same number, and the second replaced the first in the app's history. Updates for an app are now stored one after another.

## 2.23.1

- **Ratings in trajectory exports.** Config → Trajectory log has a new **Include ratings (👍/👎) and run info** switch: each exported line gets a `metadata` field with the reply's rating, the run's outcome, model, provider, source, start time and per-call token counts. A new filter, **Finished runs, 👎 too (for DPO / KTO)**, keeps thumbed-down runs in the file (errors still stay out). Together they turn your ratings into preference data: 👎 a reply, tap Retry, 👍 the better one, and the export holds a pair with the same prompt. Off by default, so existing exports are unchanged. [jade-tune](https://github.com/lucky-edgelord/jade-autotuner) trains on these files (SFT, DPO, KTO). [jade-py](https://github.com/lucky-edgelord/jade-py) 0.11 logs and exports the same way, so files from both train together.
- **Fixed: Vector and Discord could show "Not connected" right after connecting.** When two connections started close together (changing the token while the start-up connection was still being made), the first one failed as the second one closed it, and its failure marked the new connection as not connected. A connection that has been replaced now leaves the newer one alone.
- **LiteRT is in the repository.** Its runtime (`@litertjs/core` 2.5.3) was only on the machine that built the releases; it is now in `app/vendor/litert` and the build copies it into the app, so every build, CI's included, runs LiteRT offline on the phone.
- The build also makes the Jade Docs app and the think-tool vault files (`npm run build`), and CI runs every test suite again: since `ubuntu-latest` moved to Ubuntu 26.04 it had stopped at installing the browser.

## 2.23.0

- **Model router.** Before each message you send, the decision model (laya, on Ollaya, Ollama 0.35+ or the fleet broker) reads it and picks which of your models answers: list them under Config → Decision models → Model router, one per line as `provider | model | what it is good at`. The choices can be on different providers (a local Ollama model for everyday chat, a Groq or OpenAI-compatible model for hard questions), each with its own key and address from Model provider. The pick holds for the whole turn, including its tool rounds, and a small line above the reply shows which model answered and how sure laya was. If the decision fails, is less sure than the threshold you set, or the picked model fails, the main model answers. "Test routing" tries a message without sending it. Only messages you send are routed; the heartbeat, curiosity, Vector and Discord turns keep their own model. It works the same in the browser page, the Jade Vault app and the Jade Fleet client.

## 2.22.1

- **Fixed: `litert status` always said `webgpu: false`** on phones where LiteRT does run on WebGPU. It checked differently from `litert load`; both now use the same answer, so `status` and the `accelerator` a model loads with agree.
- **Model files are checked before loading.** `litert` and `onnx` say what a file really is when it is not a model (an XML or HTML error page, a JSON error, a git-LFS pointer, a `.tflite` without its `TFL3` header) instead of LiteRT's "Failed to load model from buffer". A download that comes back as an error page is refused and not saved to `/models`.
- **Fixed: a setting could be lost** if it was changed while a background model call (the journal, the heartbeat, a decision) was running: saving was skipped for that moment. It is now saved, keeping the chat model.
- **Fixed: settings could be lost on a reload.** The browser (and Android's WebView) can drop localStorage writes that were not yet flushed when the page reloads or the app is killed, which reset the theme, appearance and other settings. Settings are now also kept in IndexedDB, and at start the newer copy wins. That copy is left out of backups, so keys stay out of backups as before.
- **Downloading the same model again reuses it.** `litert load` and `onnx load` with a URL no longer save `name-2.tflite`, `name-3.tflite` … when the vault already has the identical file.

## 2.22.0

- **WebGPU on phones.** Android's WebView offers WebGPU in "compatibility mode": a plain request for the GPU can come back empty there. Every request for a GPU adapter in the app now retries in compatibility mode, and asks for full WebGPU when the adapter can do it.
  - **TensorFlow.js runs on WebGPU.** The WebGPU backend (`@tensorflow/tfjs-backend-webgpu` 4.22) is embedded next to TensorFlow.js; scripts use WebGPU when the device has it, else WebGL, else the CPU (`tf.getBackend()` says which; `S.tfBackend = 'webgl'` keeps them off WebGPU).
  - **LiteRT uses WebGPU by default** when the device has it, falling back to WebAssembly. Fixed: results of a model run on WebGPU could not be read ("Cannot convert a Tensor with WebGPU memory to a TypedArray"); they are now copied back first.
- **ONNX models: the `onnx` tool.** ONNX Runtime Web 1.31.1 runs any `.onnx` model on WebGPU (layers WebGPU cannot run fall back to the CPU) or on the CPU: load from the vault or a URL, see the inputs and outputs, run with numbers, vault files or pictures, get each output summarised (with top-5 and labels) and big outputs saved to `/models/out`. The APK carries the runtime in its own files; a browser takes it from jsDelivr.
- **USB.** Android's WebView has no working WebUSB, so the app now provides `navigator.usb` itself on top of Android's USB host API: `getDevices`, `requestDevice` (Android asks once per device), `open`, `claimInterface`, control and bulk/interrupt transfers, connect/disconnect events. Ordinary WebUSB code runs unchanged. Jade gets a `usb` tool (list, request, open, claim, control and data transfers in hex or text, save what comes back). In a browser it uses the browser's own WebUSB; only a person can pick a device there, so Jade asks with an "Allow a USB device" button.
- **The terminal works offline.** xterm.js is in the phone page instead of coming from a CDN, so the terminal is a full terminal on the phone too, and the Jade Fleet client's terminal is a real shell on the broker even without internet.

## 2.21.0

- **Jade Fleet client.** A second build of the app, for a fleet: phones and browsers share one vault on a small server (the [jade-fleet](https://github.com/lucky-edgelord/jade-fleet) broker), and the models run on another machine behind it. `dist/jade-fleet.html` is the browser client (the broker serves it at its own address) and `android/build-apk.sh fleet` makes the Jade Fleet APK (`app.netrunner.fleet`, installs next to Jade Vault). In it:
  - the vault is the broker's shared folder; notes are fetched in bulk at start, and changes from other phones, from commands or from the server itself show up live;
  - `bash`, `python3` and `node` are the server's real ones, run in the shared vault (loops, network, packages installed there); the terminal is a real one on the server when xterm is available, and the shell keeps its folder between commands; vault commands (`search`, `open` …) still run in the page;
  - chat, embeddings, decisions and vision go through the broker; the first connection points every model setting at it;
  - new tools: `vault_search` (meaning-based search over the whole fleet's notes and memories) and `vision` (object detection and classification on the fleet's vision service);
  - a connect screen (address, token, device name), a FLEET chip with who else is online, `/fleet` to reconnect; when the broker cannot be reached the page says so instead of falling back to a local vault.
- **Decisions from Ollama too.** Config → Decision models has a Server choice: Ollaya, or Ollama 0.35 and newer (same `/v1/systemone` API). Each keeps its own address; a blank Ollama address uses the Ollama address above. The `decide` tool, `jade.decide()` and flow Decide steps use whichever is chosen.

## 2.20.1

- **One unreadable file no longer breaks the shell.** Before each BusyBox command the app hands it the vault's files; if one file the vault listed could not be read from storage (removed or renamed by another app, or a rename that only changed letter case), every command failed with `<applet>: no such file: <that file>`, while `pwd` and `true` still worked. Such a file is now skipped for that command and is never deleted by it, and the vault list is re-read so a file that is really gone disappears from it. `node`, `python`, scripts and backups skip it the same way.

## 2.20.0

- **A Rust core, where Rust is faster.** Same screens, same answers; measured before keeping each piece.
  - **The phone's network is native.** Every request the app makes to another site (model providers, web search, web pages, embeddings) now runs in Rust on native threads: many at once, HTTP/2 when the server offers it, gzip, kept-alive connections, TLS checked against the Mozilla roots. There are no browser CORS rules on the phone any more, so a computer running Ollama no longer needs `OLLAMA_ORIGINS`, only to listen on an address the phone can reach. If a request cannot start natively, or a server's certificate is one only the phone trusts, that request goes through the WebView as before.
  - **`web_fetch` reads pages itself on the phone.** It fetches the page directly and turns it into Markdown in Rust (title, headings, paragraphs, lists, links, code, tables; no scripts, menus or hidden parts), instead of sending the address to a third-party reader. The reader is still the fallback, and still used in the browser, where sites' CORS rules block direct reads.
  - **Web tools asked for together run at the same time.** When the model asks for several `web_search` / `web_fetch` calls in one round, they run in parallel (on the phone, each on its own native connection); results are recorded in the order the model asked.
  - **On the phone:** the vault folder, the link/tag index (parsing notes on all cores straight from storage instead of pulling each through the WebView) and note search (the same, while the notes are not already in memory) run in Rust, and so does Sentry's rules engine.
  - **Tried and left in JavaScript:** in the browser, note parsing and search, and trimming long chats to the context window, measured slower through WebAssembly than in the page's own JavaScript (copying notes or the chat history across cost more than the work), so they stay JavaScript there. The browser's WebAssembly is now 88 KB and does only the web page conversion.
  - If the native library cannot load, the app still starts: the vault falls back to the browser database, the network to the WebView, and Sentry reports why its rules are not running.
  - Sources in `rust/` (see `rust/README.md`). The Java tests for the vault folder, Sentry and the network run against the Rust library; the Rust tests start local HTTP, HTTPS and HTTP/2 servers; page tests check the native network path, web page conversion, parallel web tools, and that Rust and JavaScript give identical note parsing and search results.

## 2.18.3

- **Big vaults stay fast.** The link/tag index used to be rebuilt from every note after any write, so each chat turn that followed a write got slower the bigger the vault was (5,000 notes: about 160 ms per turn here, several times that on a phone). It now keeps what it parsed per note and re-reads only the notes that changed; link lookups are hash lookups and note names sort with a collator. After a write the system prompt now costs about 11 ms instead of 160 ms,; the cache holds only links, tags and word counts per note, never note text, so the vault stays on the phone's storage. Note search builds snippets only for the results it returns.
- **Faster replies: the tool list no longer changes between turns.** The tool router picked tools per message, and because the tool list is the start of the prompt, a list that changed every turn made the model re-read the whole conversation instead of reusing its prompt cache (slow on a phone, and on cloud models it cost cached tokens). A tool offered earlier in a chat now stays offered; the set only grows and keeps one fixed order. The page itself measures the same as 2.17 (startup, tabs, rendering, vault index).

## 2.18.2

- **Playbooks from flows and schedules.** Flows have a **Playbook** step (pick it, give vars); the Schedule tab, the `schedule` tool and `crontab` (`playbook run <name>`) can run playbooks. Only approved, unchanged playbooks run there; results go to the flow output or `/Jade/Logs/cron.log`, failures notify.
- The flow **Tool** step now lists every tool, including `playbook` and the phone/world tools (it only showed the core ones).

## 2.18.1

- **Text-to-speech and the Android bridge work again.** The 2.18.0 bridge key made the phone refuse the page's own calls on a real device (TTS showed "not ready"; notifications, phone tools, sensors, disk and the API server were affected too). It is removed; the bridge works as in 2.17. It will come back later with on-device diagnostics.

## 2.18.0

- **Playbooks replace browser scripts.** One deterministic system for everything Jade can do, shaped like Ansible and written in JSON: a list of tasks, each naming an action (`do`) and its arguments. Any tool is an action (`{"do":"notes_search","query":"inbox"}`), the old page-driving steps are `browser.goto`, `browser.click`, `browser.extract` and friends, and `set`, `assert`, `fail`, `debug`, `wait`, `save` and `playbook` (run another) are built in. Around every task: `when`, `loop`/`loop_var`, `register`, `retries`/`delay`/`until`, `failed_when`, `ignore_errors`, `timeout`, `tags`, and `block`/`rescue`/`always`. Strings take `{{ expressions }}` in a small safe language (arithmetic, `and or not in`, `is defined`, filters like `float`, `len`, `join`, `regex_find`, `default`); secrets work as before and stay out of logs. No model in the loop: `delegate`, `think`, `curiosity` and `find_skill` are refused. `allow_hosts` now covers any task with a `url`. A run returns a recap (ok, skipped, failed, ignored, rescued), the failing task and why, the variables and a log. Actions: `help`, `modules`, `save`, `run`, `plan`, `list`, `show`, `validate`, `convert`, `delete`.
- **Playbooks tab in the bottom bar.** The playbooks are plain JSON in `/Jade/Playbooks/<name>.json`. The tab lists them (approved or not, last run), opens them as JSON, checks and plans, runs them with a live task log and the variables, duplicates and deletes them, and starts from examples. Saving in the tab counts as your approval; a file changed elsewhere asks again before it runs on its own.
- **Old browser scripts convert themselves.** On first use, `/Jade/Browser/Scripts/*.json` become playbooks (`if` becomes `browser.exists` plus `when` blocks, `each` becomes `loop`, `as` becomes `register`) and are moved; they need approving again. The `browser_script` tool is gone.
- The Jade Docs app has a Playbooks page and an expression-language page; `docs/` and the tool reference are regenerated.
- **Tool router (token saving).** Only the core tools plus the few optional ones that fit the current message are sent to the model (matched by keywords, skill text and what was used earlier in the chat); `more_tools` lets Jade pull in any other tool. On plain messages the tool definitions shrink by about three quarters. Setting `toolRouter`: `auto` (default) or off. Context report shows "sent of".
- **Android bridge key (security).** `addJavascriptInterface` puts the bridge into every frame, including sandboxed app frames. The page now claims a one-time key at load and every bridge call must carry it; calls from app frames are refused. Not yet tried on a real device.
- **Backup off.** `android:allowBackup` is now false, so Android cloud/adb backup no longer copies the app's data (tokens, API key).
- **Faster vault index.** Link resolution uses hash lookups instead of scanning every note per link: rebuilding the index of a 3,000-note vault went from about 3.4 s to about 0.1 s.
- **Vector Mini Apps fixed.** The tool router could hide the `vector` tool in a Vector chat (and `discord` in Discord), so Jade could not join or answer an app; the channel tool and `notify_owner` are now always offered in those chats. Joining a Mini App now hands Jade the app's own README and manifest, so she knows its frame format.
- Playbook audit fixes: only declared variables in run scope, loop cap error, `skip_tags` on blocks, legacy backup copy, reserved names, ReDoS guard on regex/text helpers, `timeout` passthrough.

## 2.17.0

- **Skill router.** With more than 15 skills, only the ones that fit the current message are listed in Jade's instructions (found by meaning plus whole-word match over the skills' descriptions, using the vector index), and a new `find_skill` tool searches the rest. With 15 or fewer, nothing changes. Skills are counted as offered, found and used (`skillStats`), so later work can learn which ones earn their place.
- **`delegate`: a sub-agent.** Jade can hand a side job to a helper that works in its own clean context with its own short tool loop and returns one report, so pages and search results never fill her context. Read-only by default (`write:true` adds write, edit and bash), no sub-agents inside sub-agents, one at a time, hard caps on steps (8 by default, 15 at most) and time (120 s, 300 s at most). The report is framed as data. Settings → World has a switch.
- **`chat_history`: the raw record of every chat.** `list` the chats, `read` the original messages as JSON (index, timestamp, sender, raw text, tool calls and results) and `search` all of them by keywords and meaning together (BM25 + vectors, with date and session filters). It works on the original text, not the journal summaries. Keyword results are available at once; meaning search finishes in the background. Deleted chats leave the index. It goes off with memory.
- **Curiosity wake-ups.** Off by default. At random times inside a window you set (Settings → World → Curiosity), Jade wakes in her own '✦ Curiosity' chat and picks what to do (explore, reflect, connect notes, practice a skill, prepare something, ask you one question, or rest). The pick is guided by a learning-progress curiosity engine (Schmidhuber) plus her track record by time of day; reward is measured from what actually changed in the vault. `/Jade/CURIOSITY.md` is yours to steer her: topics, off-limits, things to look into. She has the same tools as in chat, limited to notes (and optionally web) unless you widen it.
- **Scheduled backup to your server**, with **Back up now**, a list and **Restore**, optional AES-GCM encryption, and `server/jade-backup-server.py` (see `docs/backup-server.md`). Jade can check and start a backup (`backup`) but never restore.
- **`browser_script`: deterministic browser automation.** Saved step lists (CSS selectors or visible text, waits, asserts, extraction, screenshots, if/each, secrets via `{{NAME}}`) that run without the model, also from schedules and flows. You approve a script when it is saved and again whenever it changes. Needs the Android app.
- Tool descriptions for phone and ssh trimmed to leave room in the default 16k context.
- The general `embeddings` search no longer mixes in skills or raw chats.

## 2.16.1

- **`think`: a tree of thoughts with verification.** Jade can branch several lines of reasoning, check each with something that can say no, and answer with the best *verified* line. Verifiers: `code` (JavaScript, read-only; throw to fail or print a number 0-1 for partial credit), `shell`, `file` (exists / contains / regex), `rubric`, `decide` (the independent decision model) and `critique`. A failed hard check (code, shell, file) is a veto that no judge can outvote; a line with no hard check can never count as verified, and `best` says so plainly. Every evaluation must carry evidence.
  - Three search modes (`beam` by default, `best_first`, `puct`) with hard budgets in nodes, seconds and tokens. `next` says whether to check or expand and why; `auto` lets the harness propose, verify and back off bad lines by itself and returns only the result, which keeps her context small. It tells the proposer what already failed at that depth so it does not retry it.
  - Trees are saved after every step and reload after a restart. `close` records an episode (`/Jade/Tot/episodes.jsonl`) with the pivotal thought (generalised advantage along the best path) and the `(state, action, reward)` tuples of the search (`/Jade/Tot/steps.jsonl`), so the learned value model and controller described in `docs/design-tree-of-thoughts.md` have data to learn from later.
  - Settings → World has a switch for it, with its context cost. The tool definition is small; the procedure is in `think help`, and a ready-made skill is in `docs/skills/think-before-acting/SKILL.md` (copy it to `/Jade/skills/think-before-acting/SKILL.md` to have her load it by name).
  - Not built yet, by design: the learned value model, the PPO controller, the strategy pool and the self-improvement lab (phases P1-P5 in the design doc).

## 2.16.0

- **Sentry: Jade reacts to things on her own.** A low-power foreground service watches whichever sources you switch on and runs a flow when a rule matches, whether or not the app is in front. Rules live in `/Jade/Config/Sentry.json` and are picked up within a couple of seconds, with no restart; Jade can write them herself with the new `sentry` tool (`help` first — it explains the shape).
  - 15 systems, each added or removed on its own line in Settings → World → Sentry, with what it costs in battery: battery, network, screen, headset, bluetooth, volume keys, light, motion (face-down, face-up, upright, shake), location and geofences, calls, texts, notifications, which app is in front, loudness from the microphone, and change in the camera's view. A system only draws power while it is ticked *and* a rule actually needs it.
  - State rules (`when`, with `for_s` and a `clear` level for hysteresis) fire once on the way in, not over and over. Event rules (`on`, with `where` matchers) cover calls, texts, notifications, the wake phrase, volume keys and the rest. Every rule has a cooldown, an hourly cap, and optional active hours.
  - Safety: Sentry is off until you turn it on. Location, calls, texts, notifications, microphone and camera each need your consent and the Android permission before they start. A flow that Sentry started may only text or call the numbers you listed in Settings, up to a limit per hour that you set — Jade cannot edit either. A notice lists the sources in use while it is working. Notification and text contents are handed to her as untrusted data. Nothing from the camera or microphone is recorded or sent anywhere; only change and loudness are measured.
  - Events that fire while the app is asleep are kept and delivered when it wakes, and expire after ten minutes by default.
- **SSH, in the new `ssh` tool.** Jade holds real interactive sessions, so she can start a build, watch it scroll, answer a prompt and carry on across turns: `open` a saved machine by name, `send` text or control keys (`ctrl-c`, arrows, tab), `read` while something runs, `run` a command (in a session, or one-shot), `resize`, `put`/`get` a file, `list` and `close`. A from-scratch SSH-2 client, no libraries: ecdh-sha2-nistp256, aes128/256-ctr, hmac-sha2-256, password, keyboard-interactive and publickey (ed25519, RSA, ECDSA; OpenSSH, PEM and PKCS8 key files).
  - You add machines in Settings → World → SSH hosts. Jade asks for one **by name**: the password or key goes straight from your settings to the connection, and is never returned in a tool result, never written into the chat and never shown to the model, so nothing printed by a remote machine can talk her into reading one back.
  - The first connection to a machine shows you its host-key fingerprint to approve, and it is pinned: after that a different key fails the connection instead of handing over your password. "Ask me before each command" is on by default per machine. A Sentry-triggered flow cannot touch a machine unless you tick it for that.
  - Saved machines are kept with your API keys, so a backup exported **with** keys contains them in the clear — treat that file like a private key.
- **The on-screen keyboard.** `screen` `type` falls back to tapping the letters out on the real keyboard when a field refuses set-text (some games, some webviews, some password fields), and the new `keyboard` action drives it directly: `read` the keys that are showing, `text` to tap a string out, `key` for enter, delete, space, shift, symbols or letters, `mode: "hide"` to close it. Give it an `id` or `target` and it taps that field first to bring the keyboard up.
- Everything above is in the one APK; the `phone`, `screen`, `sentry` and `ssh` tool packs each have a switch in Settings → World, which removes that whole set from what Jade is told, with the context cost shown on each line.

## 2.15.2

- Fixed: `screen` `screenshot` was refused by Android because the accessibility service never declared that it may take screenshots (Android 11+ requires it). It does now. After installing, turn Jade off and on once in Accessibility settings so Android picks the new permission up.
- Screenshots come back as a downscaled JPEG (long side 1400 px) instead of a full-size PNG, and a failure now says why (protected screen, too fast, not allowed) instead of a generic refusal.

## 2.15.1

- Fixed: the `screen` tool's `screenshot` action failed on the phone with "Superclass … TakeScreenshotCallback … is an interface". The screenshot callback is now built the way Android defines it. Reading the screen, tapping and typing were not affected.

## 2.15.0

- **Bluetooth, in the `phone` tool.** `bluetooth` lists paired devices and which are connected; `bt_scan` finds nearby devices in pairing mode; `bt_pair`, `bt_unpair`, `bt_connect`, `bt_disconnect` (by address or name); `bt_power`; `bt_settings`. On Android 12+ she asks for the "nearby devices" permission, on older versions location. Connecting headphones that a maker locks to their own app may still need you to tap in that app — `bt_settings` opens the right screen.
- **Media controls, in the `phone` tool.** `media` sends play/pause/next/previous/stop/fast-forward/rewind to whatever app is playing (a music app, a podcast, an internet-radio app); `now_playing` says whether something is playing.
- **Casting to a Chromecast / Google TV, in the `phone` tool.** `cast_devices` finds TVs on your Wi-Fi; `cast_play` plays a web link or a file from the vault (the file is served to the TV over the home network); `cast_pause`, `cast_resume`, `cast_stop`, `cast_seek`, `cast_volume`, `cast_mute`, `cast_status`, `cast_close`; `cast_mirror` opens Android's screen-cast list. Written from the open Cast protocol — no Google Play dependency. YouTube and other app-only services aren't castable this way; open their app and use its own Cast button.
- **`screen` tool: Jade can drive other apps on the phone.** Like a screen reader, she reads the labelled, tappable things on the current screen and can `tap`, `type`, `scroll`, `swipe`, `long_press` and press the nav keys (back, home, recents, notifications, quick settings), take a screenshot, and see which app is in front. This uses an Android accessibility service, so it does **nothing** until you turn "Jade" on in Android's Accessibility settings (she can open that screen but cannot flip the switch), there is a second on/off switch in Config → App → Voice & senses, a notification shows the whole time she is driving, your Stop button halts her, and everything she reads off the screen is given to her as untrusted data, never instructions.
- Tests: `screen_test`, Bluetooth/media/cast cases in `phone_test`, and `CastTest` (the Cast protocol and the LAN file server) in the Java tests.

## 2.14.1

- Avatar-only hands-free shows her text again: what she says, and what she is doing (thinking, using a tool), appears in a caption at the bottom of the screen, larger than in the chat.

## 2.14.0

- **`browser` tool: Jade's own web browser.** A second browser inside the app that she drives: `open` a page (the reply lists the page text and every button, link and field with an id), then `click`, `type` (with `submit`), `select`, `check`, `press`, `scroll`, `find`, `links`, `read` (long pages in parts), `wait` (for text), `back`, `forward`, `reload`, `eval` (run JavaScript in the page), `screenshot` (she sees the page), `show` / `hide` (put it on the phone's screen; the back button or a tap on its bar returns to Jade), `clear` and `desktop_site`. It keeps its own cookies, so after you sign in once she can use the site. It cannot open `file:` or app links and never asks for camera, microphone or location. Page text is marked as untrusted data. Turn it off in Config → App → Voice & senses.
- **`phone` tool.** Alarms and timers (`alarm_set`, `timer_set`, `alarms_show`: real alarms in the Clock app), `ring` (the alarm sound now, at alarm volume), sounds (`sound_play` for a vault audio file or an internet radio stream, `tone` and tone patterns, `sound_stop`), `volume`, calls (`call`, `answer`, `hangup`, `speaker`, `call_state`, `call_log`), texts (`sms_send`, `sms_read`), `contacts`, `clipboard_get` / `clipboard_set`, `open_url`, `apps` / `app_launch`, `brightness`, `keep_awake`, `radio` (cellular network, signal strength, airplane mode) and `bluetooth`. Android gives apps no access to call audio, so she can place, answer and end calls but not talk on them; there is no app access to the phone's FM tuner (internet radio streams work).
- **She asks you first before placing a call or sending a text**: a card shows the number and the whole message. Turn that off in Config → App → Voice & senses. Emergency numbers are never dialled by her.
- **Wake phrase for hands-free voice** (Config → App → Voice & senses): list phrases such as `hey jade, hey choom`. With phrases set, hands-free ignores speech until it hears one, chimes, and takes either the rest of the same sentence or the next one as the command; follow-ups within 15 seconds of her answer need no phrase. Matching tolerates "hay", and a near miss on longer words.
- **Hands-free shows only Jade.** While hands-free is on, the chat, tabs and buttons are hidden and the screen is just her avatar on her background. Tap ✕, double-tap the screen or press Back to leave; that also stops hands-free. Switch it off in Config → App → Voice & senses ("Avatar only during hands-free").
- Android permissions are asked the first time each action needs one.
- Tool descriptions for `senses`, `browser` and `phone` were shortened so a 16k context still has room for the chat.
- Tests: `browser_test`, `phone_test`, and wake-phrase and avatar-only cases in `world_test`.

## 2.13.1

- **Flashlight and vibration.** `senses` gets two actions: `torch` (`on`: true or false; `seconds` switches it off by itself; `blink` flashes it that many times) and `vibrate` (`ms` for one buzz, or `pattern: [on, off, on…]` in milliseconds, 30 seconds at most; `stop` cancels). The torch needs no permission; vibrate uses the normal VIBRATE permission. Scripts reach them with `jade.tool('senses', {action: 'torch'})`. In a plain browser vibrate works where the browser allows it and the torch reports that it needs the app.

## 2.13.0

- **The vault is no longer kept in memory.** In the Android app every note and file is now a real file in a folder on the phone, and the app keeps only the list of files (names, sizes, times) in memory. A file is read from the folder when something asks for it, a small cache (48 MB) keeps recent ones, and writes go to the folder a fraction of a second later, in order, with big files written in pieces (a temp file is renamed into place, so a crash never leaves half a note).
- **The folder is `JadeVault` on shared storage** (`/storage/emulated/0/JadeVault`) once you allow "all files access" (Config, App, Vault storage, or the prompt that button opens). Other apps (a file manager, Pydroid, a sync app) can then open and edit the same files. Until then the vault lives in the app's own folder on shared storage, and moving it later merges what is there and never overwrites a file.
- **Edits made by other apps show up** when you return to Jade, or from the Rescan button.
- **Upgrading is safe.** The old one-record vault in the browser database is copied into the folder, every copied file is checked by size, and only then is the old record deleted. If anything fails the old copy stays and the copy is tried again at the next start. A file already in the folder is never overwritten by the old copy.
- Shell commands, Python and scripts are handed files up to 16 MB (2 MB for text in Node); a bigger file is left alone by them (and never deleted by them) but Jade can still open, move and delete it.
- A write the phone refuses (storage full) stays in memory, is reported, and is retried.
- Tests: `disk_test` (fake folder), `android/test/run.sh` (the Java file layer on a plain JVM: chunked writes, path escapes, symlinks, merge). The browser build and the kiosk build keep the vault in the browser database as before.

## 2.12.2

- `litert`: **INT8 models load and run** (YOLOv8n INT8 and other int8 exports). LiteRT.js 2.5.3 only lists float32, int32 and uint8 in its JavaScript type table, so int8 models failed with "Element type INT8 is not supported"; the bundled copy now adds int8 (the WebAssembly runtime handles it already).
- Quantized models are converted for Jade: the scale and zero point are read from the `.tflite` file, outputs come back as real numbers (`(q - zero point) x scale`; `raw_output:true` keeps the integers), `{data, real:true}` quantizes real input numbers, and pictures are quantized with the input's own scale and zero point (int8 models get 0..1 pixels by default).

## 2.12.1

- `litert`: quantized (uint8) models work, and pictures can be model input. An input can be `{image: "/path.jpg"}`: Jade resizes it to the model's input shape (crop, stretch or letterbox), lays it out NHWC or NCHW and scales it (raw 0-255 for uint8 models, -1..1 for float models, or `norm`), so a `camera_snap` photo goes straight into a classifier. `labels` names the top 5. Numbers for uint8 inputs are rounded and clamped.

## 2.12.0

- **Hands-free voice**: a **Talk** button next to Voice. Jade listens, you talk, she answers out loud, then listens again, with no buttons. She stops listening while she speaks so she never hears herself. Uses the phone's speech recognizer, or a transcription model you pick.
- **Speech to text and picture understanding can use their own provider and model** (Config → App → Voice & senses): for example a local Ollama vision model describes pictures for a chat model that cannot see, and Groq or any OpenAI-compatible server transcribes speech (`/audio/transcriptions`, or an audio-capable chat model).
- **`senses` tool**: camera (photo, a few frames over time, video clip, front or back), microphone (record, loudness), GPS location, every sensor on the phone (accelerometer, gyroscope, magnetic field/EMF, light, pressure, proximity, steps…) sampled with min/max/mean/std, battery, Wi-Fi signal strength and speed, device facts, and `transcribe` for a recording in the vault. Android asks for each permission the first time; "Let Jade use the camera, microphone, location and sensors" is a master switch.
- **`look` tool**: Jade opens any image (or frames of a video) in the vault and sees it, with no need to share it again. A folder lists its pictures.
- **`litert` tool**: LiteRT.js 2.5.3 runs any `.tflite` model on the phone (load from the vault or a URL, run, inspect). The runtime ships in the app (about 19 MB) and loads on first use.
- Scripts reach all of it through `jade.tool('senses', {...})`, so Jade can build her own tools, skills and flows on top.
- Tests: `world_test` (fake sensors, fake camera and microphone, a real `.tflite` model run in Chromium, vision and speech side models, hands-free loop).

## 2.11.0

- Kiosk mode for the Android app (Config → App → Background): Jade becomes the home screen, starts at boot, runs full screen and stays in front. Built for a computer or tablet that only runs Jade, such as an x86 PC with Bliss OS.
- Without extra setup Android pins the screen to Jade. With `adb shell dpm set-device-owner app.netrunner.vault/app.netrunner.jade.AdminReceiver` it becomes a full kiosk: locked task, permanent home screen, no lock screen. Turning the switch off undoes it.

## 2.10.0
- **sqlite-vec 0.1.9 in the embedded SQLite** (3.53.4, rebuilt with `sqlite-wasm/build.sh`): `vec0` virtual tables, KNN search,
  `vec_distance_*`, `vec_f32` and friends in the `sqlite3` shell, Python's `sqlite3`, `node:sqlite` and Jade's own tools.
- **Embeddings from Ollama** (`/api/embed`, any embedding model; `nomic-embed-text` by default, with its task prefixes).
  Config → Memory → **Embeddings (sqlite-vec)**: model, address (empty = the Ollama address), key, a test-and-rebuild
  button, and an option to index all notes.
- **Hybrid memory search**: the memory tool's `search`, and the memory lines put in every chat's prompt, now rank by
  SQLite FTS5 keywords **and** sqlite-vec meaning, fused with reciprocal rank fusion. Journal entries are searched the same
  way. Falls back to keywords, then BM25, when Ollama or the model is missing. "Rank memories" is on by default.
- **`embeddings` tool** for Jade: `search` (hybrid / semantic / keyword), `add` to her own collections, `index` the vault,
  `remove`, `compare`, `status`. The index is the plain SQLite file `/Jade/.index/vectors.db` (a cache, rebuilt on demand).
- Tests: `embed_test` (fake Ollama; 40 checks).

## 2.9.0
- **Discord archive** (`--archive`, off by default): the Discord bridge keeps every message the bot can see on the
  computer it runs on, whether or not the app is open, as append-only JSON lines per channel and thread. People, bots,
  webhooks and Jade herself, edits, deletions, replies, embeds, reactions, and attachments downloaded before Discord's
  links expire. DMs only with `--archive-dms`. The reply queue is unchanged: it still drops what is older than
  10 minutes and never carries bots.
- **Backfill** (`--backfill`, or the `archive_backfill` tool): the whole history of every channel, active and archived
  thread and forum post, oldest first, resuming where it stopped.
- **Render** (`--render OUT_DIR --name … --description …`): the archive as an Obsidian-style vault under a name you
  choose, a note per channel and month and per thread, replies linked to the message they answer, images embedded.
- `archive_status` and `archive_search` tools; `./setup.sh --archive`; `JADE_DISCORD_ARCHIVE` for Docker.
- Discord bridge: `JADE_DISCORD_HOST=127.0.0.1 ./setup.sh` keeps it on the server itself (for a VPS, reached over SSH or
  Tailscale); discord.py's voice extra (PyNaCl, davey) is installed by default, with ffmpeg and opus in the Docker image.
- Tests: the gem-theme checks can see Jade (`window.Jade`); all 27 suites pass.

## 2.8.0
- **Discord bridge** (`jade-discord/`, built on discord.py) and a **Discord** section in Config. Jade lives on Discord as a bot:
  she answers DMs and channels, reacts, replies in threads, sends and receives files, sees images, reads channels, and takes
  messages for you, with the same roles as Vector (owner = the full Jade, admins = Discord powers only, everyone else =
  chat and leave a message), a channel whitelist, trigger words and a DM policy. The bot runs in a small discord.py program
  on a computer you keep on (Gateway, resume and rate limits are discord.py's job) and is served over HTTP with a bearer
  token, exactly like the Vector bridge; the app polls it. Setup script, Docker image and a README are included.
- **Runs at the same time as Vector.** Each bridge has its own port, token and chats (🎮 Discord, 💬 Vector), and the two
  share one conversation queue: Jade only ever answers one chat at a time, then wakes the other queue.
- Safety: every message the bridge sends has empty `allowed_mentions` (no @everyone, @here or roles), bots are never queued
  (no loops), stale messages (older than 10 minutes) are dropped, and the bridge token is left out of backups.
- The Message Content Intent is optional: if it is off in the Developer Portal the bridge carries on (DMs and @mentions) and
  the app says how to switch it on.
- `notify_owner` and the Discord inbox (`/Jade/Discord Inbox.md`) work like Vector's; `/discord` opens the settings.

## 2.7.3
- **AICord provider** (Config → Model provider, also in the fallback list and the compaction / heartbeat model menus). Your
  AICord characters appear as the model list; chat goes to `POST /chat` with the character UUID and the history. Replies
  arrive whole (the API does not stream) and AICord has no tool calling, so Jade cannot use the vault through it: best as a
  chat model or fallback. Jade's system prompt travels as context in the first user turn. 401 / 402 / 403 / 404 show readable
  messages. The key is stored like the other keys and left out of backups.

## 2.7.2
- **TensorFlow.js 4.22 in Jade's scripts**: `tf` and `require('@tensorflow/tfjs')` in `node` (shell, flow JavaScript steps,
  Jade's bash). Embedded (no download), unpacked only for scripts that use it. GPU (WebGL) when it works in the WebView's
  worker, otherwise the CPU backend, with TensorFlow's own probing messages kept out of the output. Models persist with
  `indexeddb://`. Not loaded into note scripts.
- node scripts understand `import * as x from '…'`, `import x from '@scope/pkg'` and side-effect imports.

## 2.7.1
- **Reply bar** under each of Jade's replies: **Copy** (everything she said in that turn, as Markdown, without tool
  output), **👍 / 👎** (now always there, not only with the trajectory log on) and **Retry** on the newest reply, which
  runs your last message again and replaces her answer (also after an error).

## 2.7.0
- **Flows**, a small n8n in its own tab: steps of Jade's tools, JavaScript, shell commands, Ollaya decisions, AI answers,
  full Jade chat turns, notes, if / switch / for-each, wait, notify and other flows, with `{{ expressions }}`, retries,
  continue-on-error and a step-by-step run log. Triggers: by hand, schedule, note or folder change. Run them from the
  shell (`flow run`), from scripts (`jade.flow`), from schedules and crontab, over the API (`/v1/flows`, `/v1/flow`), and
  Jade builds and runs them with her new `flow` tool. Kept as JSON in `/Jade/Flows`.
- **Scripting Jade**: `jade.tool()`, `jade.decide()` (structured Ollaya decisions), `jade.ask()`, `jade.agent()`,
  `jade.flow()`, `jade.shell()`, `jade.notify()` and `jade.kv` in the shell's `node`; `jade` and `flow` shell commands.
- **Schedules run shell commands and flows** (Schedule tab, the schedule tool, and a new `crontab` command with crontab
  files and `@daily` macros). They run on their own, log to `/Jade/Logs/cron.log` and notify you on failure.
- **Note scripts & templates** (Obsidian style): live `dataviewjs` / `jade-js` blocks and inline `$=` values with a
  Dataview-like `dv`, and Templater templates (`<% tp.date.now() %>`, `<%* %>`, prompts, includes, cursor) inserted with
  the { } button. Sandboxed: no network, no file changes, tools only if you allow them.
- Fix: a BusyBox command no longer undoes files written while it ran (it replaced the whole vault with its starting copy).
- Fix: notes written and opened at once are already in the link/tag index.
- The bottom bar has seven tabs; settings gain a "Note scripts & templates" section (Tools).

## 2.6.0
- **HTTP API (Android app).** Jade listens on a port you choose and answers GET requests with JSON. A message sent
  to `/v1/chat?message=...` goes through the normal chat: it shows up in the app and she answers there, and the reply
  comes back as JSON (`reply`, `session`, `tool_calls`, `model`, `elapsed_ms`, `error`). Also `/v1/status`, `/v1/history`,
  `/v1/chats` and a public `/v1/health`. Token required on every call (`Authorization: Bearer` or `?token=`); off by
  default; local only unless you allow your Wi-Fi. Input can also be one JSON object (`?json={...}`). Keeps the app
  alive in the background while on. Settings → Connect.
- **Memory retrieval with BM25.** Optional: only the memory lines that match your recent messages go into the system
  prompt (Okapi BM25, top-k adjustable). Off by default.
- **Settings are split into tabs** (Model, Memory, Tools, Connect, App) with a search box, and Save stays in view.
- Python: a corrupt or empty cached MicroPython runtime is detected and downloaded again.
- Browser build for GitHub Pages in `docs/`.

## 2.5.0
- **Jade on Vector messenger.** She runs as a Vector bot through the new Jade Vector bridge (Vector's own
  `vector-agent` plus a token-protected HTTP bridge; macOS, Linux or Docker).
  - Answers DMs and whitelisted channels: always, or only when named or replied to. Trigger words are configurable.
  - Owner / admin / public permission tiers. Each Vector chat gets its own chat in the app.
  - Reactions, typing indicator, threaded replies, files both ways; she sees the images people send.
  - Joins and leaves communities. Invites from you or admins are accepted automatically.
  - Plays Mini Apps shared on Vector, woken by new moves.
  - Secretary: `notify_owner` files messages in `/Jade/Vector Inbox.md`, or tells you at once (DM + notification), per setting.
  - `vector` tool for any task in the app: message, send a file, react, read chats, moderate, run any vector-agent tool.
- Chats save before the app switches between them (a background turn could lose the last message).
- Going back to the chat you were in after a background turn now works for a new, still-empty chat.
- Production repo: reproducible web build, APK build without the Android SDK (hash-pinned tools), test runner, CI, Docker image for the bridge.

## 2.4.0
- **Jade Link**, a built-in webxdc app: messenger plus shared board. Messages addressed to Jade (webxdc `notify`) wake her in the app's own chat; live "thinking" status over the realtime channel.
- Updates delivered to apps carry `sender` and `timestamp`.

## 2.3.0
- `http_request` tool (any method, JSON/form bodies, binary responses saved to the vault) with Config → Secrets (`{{NAME}}`).
- Node gets `fetch`, `https`/`http`, `Buffer`, and `process.env` secrets.
- Images in notes and chat (`![[img.png|300]]`, `![alt](path)`, note embeds, insert/paste with downscaling, full-screen view).
- Webxdc apps: Apps tab, `.xdc` install, sandboxed offline runtime, `apps` tool for Jade (read, send, open, build and install apps).

## 2.2.0
- Timestamps on every message; Jade gets the local date, time zone and each message's send time.
- Trajectory logger: every run, as the model saw it, exportable as JSONL (OpenAI chat with tools, or ShareGPT), filtered by 👍/👎.

## 2.1.0
- Context guard: requests are measured before sending, compacted or trimmed to fit, "prompt is too long" errors are learned and retried; `/context` shows what fills the window.

## 2.0.0
- SQLite 3.53 built in (WebAssembly): `sqlite3` shell, `node:sqlite` / `better-sqlite3` in node, `sqlite3` in Python.

## 1.x
- Jade Vault: Obsidian-style markdown vault (links, backlinks, graph, tags, KaTeX) on the pi-agent harness (Live2D Jade, BusyBox WebAssembly shell, Ollama).
- Long-term memory and journal, SOUL.md / AGENTS.md / SYSTEM.md steering, skills.
- Providers: Ollama, Ollama Cloud, Groq, llama.cpp, OpenAI-compatible, with a fallback chain and a separate compaction model.
- Background mode (Android foreground service), heartbeat (HEARTBEAT.md), schedules, file attachments, MCP (pi-style codemode/deferred/direct), MicroPython, JSON export of everything.
