# Vault Loci — protocol

Vault Loci is a top-down map of Jade's vault, used as a memory palace. The user and Jade share one avatar: the user
walks it with the D-pad, WASD, a gamepad or a tap on the floor, and Jade walks it with the **vault_map** tool. A player's
own input always wins over a walk in progress. The user can also text Jade from the map's Chat box.

Eleven places (loci):

| id | name | meant for |
| --- | --- | --- |
| `vault` | Core Vault | the most important things (a place, not encryption) |
| `agents` | Agent Bay | models, the router, helpers |
| `tools` | Tool Shed | tools, skills, servers |
| `bench` | Workbench | work in progress |
| `archive` | Archive | finished things, old chats, backups |
| `stacks` | The Stacks | facts, notes, documents |
| `fleet` | Fleet Console | other devices |
| `comms` | Comms Desk | people, messages |
| `deck` | Schedule Deck | reminders, routines |
| `lockers` | Trajectory Lockers | past runs, ratings |
| `gate` | The Gate | the outside world, links |

## For Jade

- To move, look, speak, change the light or pin and recall memories, use the **vault_map** tool, not raw updates.
  `vault_map action=look` gives a text map of the room (north is up) and the direction and walking distance to every locus.
- When the user texts you from the map you get a turn in this app's own chat. Answer with
  `apps action=send app="Vault Loci" payload={"type":"msg","text":"..."}`: it shows in the map's chat and as a speech
  bubble over the avatar. Keep it short (one to three sentences). If they asked you to go somewhere or do something,
  do it with vault_map first, then answer.
- Memories are plain text that anyone with the app can read. Never pin passwords, keys or private data.

## Wire format (for anything else that drives the map)

Chat, both ways: `{"type":"msg","id":"<unique>","text":"..."}`. The app sends the user's messages with
`notify: {"jade@jade.vault": text}`, which is what wakes Jade.

Commands: `{"v":1,"t":"cmd","id":"<unique>","cmd":"<name>","args":{...},"ts":<ms>}`, answered by the app with
`{"v":1,"t":"ack","id":"<same>","cmd":"...","ok":true,"result":{...}}` or `"ok":false,"error":"..."`.

| cmd | args |
| --- | --- |
| `look` | – (the result has `textmap`, and each locus has `dir` and `walk`) |
| `goto` | `locus`, or `x` and `y` on the 2576 × 1438 map; the result says `arrived`, `interrupted` or `timedOut` |
| `open` | `locus` |
| `close`, `stop`, `ping` | – |
| `say` | `text` (160 chars), `ms` |
| `move` | `dir` up/down/left/right, `ms` 50–4000 |
| `light` | `preset` lit/dim/black, `on`, `shadows`, `dark` 0–96, `lantern` 120–700, `glow` 0–150 |
| `remember` | `locus`, `text` (240 chars); 30 per locus, the oldest drops |
| `recall` | `locus`, `query` (both optional) |
| `forget` | `locus`, `id` |

`goto`, `open` and `move` run one after another. The map must be open to answer; a command that arrives while it is
closed runs when it is next opened, if it is under 10 minutes old.

The app also writes `{"v":1,"t":"state",...}` (position and found loci) and `{"v":1,"t":"mem",...}` (memories). All of it
is replayed when the app opens, so the map, the memories and the chat come back as they were.
