# Jade Vault documentation

Jade Vault is a device-local Markdown vault with an AI assistant, browser-based scripting, automations, and an Android wrapper. These guides target **Jade Vault 2.9.0**; UI labels may vary slightly between releases. Config has Model, Memory, Tools, Connect, and App tabs, plus a search box.

## Version and compatibility

These guides cover **Jade Vault 2.9.0**. For platform requirements, network access, background operation, and backup coverage, see [Compatibility and limitations](compatibility-and-limitations.md).

## Start here

1. [Install and get started](getting-started.md).
2. [Configure a model provider](configuration.md).
3. [Write and organize notes](notes.md).
4. [Back up your data](backup-and-storage.md).

## User and integration guides

| Page | Contents |
| --- | --- |
| [Getting started](getting-started.md) | Browser and Android installation, first conversation, offline limits |
| [Compatibility and limitations](compatibility-and-limitations.md) | Platform requirements, network access, background work, backup coverage |
| [Configuration and providers](configuration.md) | Ollama, cloud providers, llama.cpp, AICord, fallbacks, secrets |
| [The PNGtuber avatar](pngtuber.md) | Jade's default avatar, her moods, choosing Live2D, making your own |
| [Notes and knowledge management](notes.md) | Markdown, links, tags, search, graph, images, attachments |
| [Jade, memory, and skills](jade-and-memory.md) | Chat, tools, steering files, journal, skills, context management |
| [Shell and scripting](scripting.md) | BusyBox, JavaScript bridge, MicroPython, SQLite, TensorFlow.js |
| [Note scripts and templates](note-scripts-and-templates.md) | Dataview-style queries, inline expressions, Templater syntax |
| [Flows and scheduling](automation.md) | Flow JSON reference, expressions, schedules, crontab, heartbeat |
| [MCP and HTTP integrations](integrations.md) | MCP configuration, tool exposure, resources, HTTP requests |
| [Apps and Jade Link](apps.md) | Sandboxed webxdc apps, update protocol, packaging |
| [Discord](discord.md) | Bot creation, bridge setup, permissions, shared queue, diagnostics |
| [Vector messenger](vector.md) | Bridge setup, Docker, account ownership, roles, network safety |
| [Android HTTP API](http-api.md) | Authentication, routes, parameters, examples, error handling |
| [Backups and storage](backup-and-storage.md) | Full/config exports, restore, migration, separate data stores |
| [Security and privacy](security-and-privacy.md) | Data boundaries, credentials, code execution, licenses |
| [Troubleshooting](troubleshooting.md) | Provider, storage, automation, bridge, API, build problems |

## Developer and build guides

| Page | Contents |
| --- | --- |
| [Development and architecture](development.md) | Repository map, build pipeline, local serving, tests, contribution checklist |
| [Build the Android APK](android-apk.md) | Required tools, debug build, release keystore, signing, installation, upgrades |
| [Deployment and releases](deployment-and-releases.md) | Static hosting, GitHub Pages asset, release artifacts, CI and signing secrets |

## Project references

- [Project README](../README.md), [changelog](../CHANGELOG.md), and [version](../VERSION).
- [Browser deployment README](README.md) and [browser application](index.html).
- [Security policy](../SECURITY.md), [license](../LICENSE), and [third-party notices](../THIRD_PARTY_NOTICES.md).
- [Vector bridge reference](../jade-vector/README.md).
- [Jade Link protocol](../apps/jade-link/README.md).
- [SQLite WebAssembly build reference](../sqlite-wasm/README.md).

> Paths such as `/Jade/SOUL.md` are files **inside the app's virtual vault**, rather than paths in your computer's regular filesystem. Commands in build/development guides run on your computer; commands in scripting guides run inside Jade Vault unless explicitly stated otherwise.
