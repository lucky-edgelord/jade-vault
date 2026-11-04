# Jade, memory, and skills

**Jade Vault 2.9.0** · [Documentation index](README-docs.md)

## Working safely with the agent

Jade can search, read, create, replace, and edit notes, execute scripts, access configured integrations, and run automations. Ask for inspection before changes when working with important data:

> Search my project notes and propose a reorganization. Do not write files until I approve.

Review the tool activity and resulting files. `write` replaces an existing file; `edit` uses an exact text replacement that must match once. Back up before bulk transformations. Tool availability depends on settings, provider capabilities, and the caller's role.

Replies have Copy, thumbs-up/down, and Retry controls. Ratings work even with trajectory logging off. Copy collects assistant text from the turn without thinking or tool output; Retry is offered only on the latest reply. Your messages can be copied/edited; code blocks and chats can be copied too. A retry or edited message can lead to another tool run, so do not assume external operations are idempotent.

## Memory and journal

| Vault path | Role |
| --- | --- |
| `/Jade/Memory.md` | Durable facts/preferences included in context |
| `/Jade/Journal.md` | Entry point for the journal |
| `/Jade/Journal/` | Daily notes summarizing earlier chats |

Ask `Remember that I prefer short weekly reviews` or use the memory tool's save, list, search, and forget actions. Memory is editable Markdown: review it for stale, incorrect, or sensitive facts. Journal generation is model-assisted and can use the configured provider; it is not a perfect transcript or guaranteed factual record.

### Hybrid memory search (keywords + meaning)

Jade's memory search combines two rankings and fuses them (reciprocal rank fusion, k = 60):

- **Keywords**: SQLite **FTS5** (BM25, stemmed, prefix matches).
- **Meaning**: **embeddings from Ollama** (`/api/embed`) stored and searched with **sqlite-vec** (cosine distance, `vec0` table). "Caffeinated drink" finds "Likes oat milk lattes" although they share no word.

What uses it:

- The memory tool's **search** action (memory bullets and the journal, one entry per chat).
- The **memory block in every chat**, when **Config → Memory → Long-term memory → Rank memories** is on (default **on**, top-k **8**, bounded **1–30**): only the bullets that match your last two messages are put in the prompt. They are ranked before each turn. If embeddings are unavailable it quietly uses keywords only, then the old BM25 ranking, then the five newest lines.
- The **embeddings tool** (below).

Set it up once: `ollama pull nomic-embed-text` on the Ollama Jade talks to (Config → Memory → Embeddings shows and tests the model, address and key; a different embedding model or address works too, and changing it rebuilds the index). Embedding model names that contain `nomic-embed` get the `search_document:` / `search_query:` prefixes they were trained with. Ollama Cloud does not serve embedding models, so with a cloud chat provider point the embeddings address at an Ollama you run.

The index is the ordinary SQLite file `/Jade/.index/vectors.db` (chunks, an FTS5 table and a `vec0` table). It is a cache: delete it and it is rebuilt from the notes. Memory bullets and journal entries are kept in step automatically a few seconds after they change. Nothing leaves your Ollama.

### The embeddings tool

Jade can use the vectors herself. The tool has these actions:

| Action | What it does |
| --- | --- |
| `search` | Closest texts to a `query`; `mode` hybrid (default), semantic or keyword; `collection` limits it (a comma list; default every collection); `k` results (max 30) |
| `add` | Store `text` (or `texts`) in a collection of her own, with an optional `source` and `head`; embedded straight away, never stored twice |
| `index` | Embed the vault's notes into the `notes` collection (optionally only under a `path`); notes are split by headings and paragraphs |
| `remove` | Delete by `id` (from a search result), by `source`, or a whole `collection` |
| `compare` | Cosine similarity of texts `a` and `b` |
| `status` | sqlite-vec / SQLite versions, model, vector size, the size of each collection, the last problem |

Collections: `memory` and `journal` are filled from the notes automatically, `notes` by the index action (or **Also index all my notes** in Config), and any other name is Jade's own (research, snippets, documents). Use the memory tool for facts about the user and this one for everything she wants to find by meaning.

sqlite-vec 0.1.9 is built into the embedded SQLite, so it is also available in the `sqlite3` shell, Python's `sqlite3`, and `node:sqlite` / `better-sqlite3` scripts: `create virtual table v using vec0(e float[768]); select rowid, distance from v where e match vec_f32('[...]') and k = 5;`.

## Steering files

| Path | Effect |
| --- | --- |
| `/Jade/SOUL.md` | Persona, tone, values |
| `/AGENTS.md` and `/Jade/AGENTS.md` | Standing user instructions |
| `/Jade/SYSTEM.md` | Optional replacement for the base introduction/guidelines |
| `/Jade/skills/<name>/SKILL.md` | On-demand instruction pack |

HTML comments in steering/skill content are removed before prompting. SYSTEM is a powerful override: prefer a small AGENTS addition for routine preferences rather than replacing the baseline instructions.

Example `/AGENTS.md`:

```markdown
# Working agreements
- Search for an existing note before creating one.
- Ask before deleting notes or sending external messages.
- Use YYYY-MM-DD dates and cite the note paths you used.
```

SOUL persona text can also appear in non-owner Vector/Discord prompts. Keep private facts in appropriate notes/memory rather than assuming persona text is owner-only.

These are model instructions, not a permission enforcement layer. Do not rely on a sentence in a prompt to isolate sensitive data.

## Create a skill

Create `/Jade/skills/weekly-review/SKILL.md`:

```markdown
---
name: weekly-review
description: Review active projects. Use when the user asks for a weekly review.
---
# Weekly review
1. Search notes tagged #project and read relevant notes.
2. List unfinished tasks and unresolved questions.
3. Propose three priorities; ask before changing notes.
```

Skills are listed by name/description and loaded on demand with the skill tool or `/skill:weekly-review`. Keep descriptions specific and steps compatible with available tools. A skill is guidance, not installed executable code or a new permission boundary.

## Context and trajectories

Context guard compacts/trims history when needed. Use `/context` (or `/ctx`) in the app chat to inspect context usage; those slash commands are not available over the Android HTTP API. Chat prompts include device-local date/timezone information and message timestamps, so keep the device clock correct. Important durable facts belong in memory or notes, not only a long chat.

The trajectory log records model-visible runs in a separate `jade-traj` IndexedDB database. In Config, export JSONL in OpenAI chat-with-tools or ShareGPT format and filter by reply ratings. Turn on **Include ratings (👍/👎) and run info** to add a `metadata` field to each line (rating, outcome, model, time, per-call token counts), and pick **Finished runs, 👎 too** to keep thumbed-down runs in the file: that gives preference data for DPO or KTO. The easy way to make a pair is to 👎 a reply, tap Retry, and 👍 the better one; both runs share the same prompt. [jade-tune](https://github.com/lucky-edgelord/jade-autotuner) reads these files directly. Compaction can split a run into multiple records. Exports may contain private prompt content, notes, and tool results: inspect before using them for training or sharing. Export trajectories separately from normal backups.

Sources: [memory.js](../app/modules/memory.js), [steer.js](../app/modules/steer.js), [ctxguard.js](../app/modules/ctxguard.js), [traj.js](../app/modules/traj.js).
