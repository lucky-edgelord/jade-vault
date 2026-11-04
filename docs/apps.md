# Apps and Jade Link

**Jade Vault 2.9.0** · [Documentation index](README-docs.md)

## Webxdc mini apps

An `.xdc` file is a ZIP archive containing `index.html` and optional assets such as `manifest.toml` and `icon.png`. Jade Vault runs these offline mini apps in sandboxed frames. Apps exchange ordered updates through `window.webxdc`, rather than directly reading your notes or making network requests.

The Apps tab installs/opens apps. Jade's `apps` tool supports:

| Action | Purpose |
| --- | --- |
| `list` | List installed apps |
| `read` | Read updates; `since` can request only newer serials |
| `send` | Post a payload in the app's own protocol |
| `open` | Show an app |
| `files`, `source` | Inspect packaged files/code |
| `install` | Install from a vault `.xdc`, app folder, or URL |
| `export` | Save an app package as `.xdc` in the vault |

Read an app's code/protocol before sending updates. Payloads are app-specific, not a universal command schema. Installing from a URL uses host-side download facilities; the running sandboxed app itself is restricted from network access.

## Jade Link

Jade Link is the built-in messenger/shared board between `you@jade.vault` and `jade@jade.vault`. Its state is reconstructed by replaying ordered webxdc updates. User messages can wake Jade according to app wake settings while the host app is running.

Message payload:

```json
{"type":"msg","id":"message-1","text":"Please review this task."}
```

Jade can combine a reply and board action:

```json
{
  "type":"msg",
  "text":"Added it to the board.",
  "cards":[{"op":"add","id":"task-1","title":"Review budget","col":"todo"}]
}
```

Card operations can also be standalone updates:

```json
{"type":"card","op":"move","id":"task-1","col":"doing"}
```

Operations are `add`, `move`, `edit`, and `del`; columns are `todo`, `doing`, and `done`. Sender identity comes from the host update rather than an arbitrary payload `from` field. Text supports bold, italic, code, and line breaks. See the [existing protocol reference](../apps/jade-link/README.md) for details.

## Vault Loci

Vault Loci is the built-in map of the vault: a lit, top-down room with eleven places (loci) used as a memory palace. You and Jade share one avatar. You walk it with the D-pad, WASD or arrow keys, a gamepad, or a tap on the floor; Jade walks it with the `vault_map` tool (look, goto, open, close, say, move, stop, light, remember, recall, forget). Your input always wins over a walk Jade is making.

The Chat button (or T) opens a chat box: your message wakes Jade in the app's own chat, and her answer appears in the box and as a speech bubble. The app knows only what happens on the map. Its memories are separate from Jade's memory tool and are plain text, so never pin passwords or private data. The `vault-map` skill in `/Jade/skills` tells Jade how to use it. Protocol: [apps/vault-loci/README.md](../apps/vault-loci/README.md).

## Create and package an app

On your development computer:

```sh
python3 scripts/pack_xdc.py apps/jade-link dist/jade-link.xdc
```

The web build runs this command for the built-in Jade Link package. For another app, replace the source/output paths. Keep runtime assets inside the archive and use the host's supported webxdc update APIs instead of assuming ordinary internet access. The reference implementation lives in [apps/jade-link](../apps/jade-link/README.md).

## Storage and security

Apps use an opaque origin and restrictive CSP, with no direct vault access. This isolates app code, but Jade responding to app updates is a separate agent action; treat app messages as untrusted input.

Installed app records and update streams live in the separate `jade-xdc` IndexedDB database. An exported `.xdc` is an app package, **not necessarily an archive of its update history**. The ordinary full backup does not dump this database; do not assume it preserves a board or messenger history. See [backup coverage](backup-and-storage.md).

Sources: [xdc.js](../app/modules/xdc.js), [xdcwake.js](../app/modules/xdcwake.js), [pack_xdc.py](../scripts/pack_xdc.py).
