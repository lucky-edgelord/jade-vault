# Autonomy and Plans

**Jade Vault 2.26.0.** Jade can work on her own, in turns, within limits you set, and plan work that takes weeks.
Two screens, both under **Notes**: **Queue** (the scheduler and autonomous mode) and **Plans** (Gantt charts).

## Autonomous mode

Turn on **Autonomous** in Notes → Queue. Jade then works through her queue continuously:

- She stops for **quiet hours** (11pm–7am at first) and when the hour's or the day's **step budget** is used
  (60 model steps an hour and 600 a day at first). Change them under **Limits**.
- She **pauses while you use the app** (a tap or a key in the last 90 seconds) and while you chat with her.
- **Stop** turns autonomous mode off at once; the slice that is running ends at its next step.
- Tools that reach outside the vault wait for you: phone, SSH, Discord, USB, the browsers, screen, apps and MCP
  servers (edit the list under Limits). The task shows **Allow** and **Deny** in the Queue, and you get a notification.
  Allow lets that one tool through for that one task.
- Everything is logged in `/Jade/Autonomy/log.md`; the queue is `/Jade/Autonomy/queue.json`.

## The scheduler: three tiers

The scheduler works like an operating system's multilevel feedback queue.

| Tier | For | How it picks |
|---|---|---|
| 1 · Interrupts | What cannot wait | Always first, in arrival order. Jade may hold at most 3 of her own. |
| 2 · Priority queue | One-off work | Highest priority first (0–100). Waiting adds up to +40; a deadline within a day, an hour or already passed adds 10, 30 or 50. |
| 3 · Round robin | Long goals | In turns. A slice is 2, 4 or 8 steps by level. A goal that uses its whole slice drops a level; one that waits 30 minutes rises one. |

When both tier 2 and tier 3 have work, tier 3 gets every 4th turn (change it under Limits), so long goals never starve.
**Run next** moves a task to tier 1.

A goal remembers only the short note Jade left at the end of her last slice. Each slice ends with one status line:
`STATUS: done`, `STATUS: continue — next step`, or `STATUS: blocked: what she needs`. A blocked task waits for you
(Resume it after you have helped). A goal that runs 40 slices without finishing is parked as blocked too.

Tasks can be:

- **goal** (tier 3): something to achieve over several slices;
- **prompt**: a one-off request, done in one slice;
- **flow**, **playbook**, **shell** (a command) or **lisp** (code or a `.jl` file): run as they are, without the model.

Jade adds tasks with the `sched` tool (`add`, `list`, `show`, `pause`, `resume`, `cancel`, `done`, `log`, `status`).
You add one with **Add a task** in the Queue. A task can wait to start (`at` a time, or `in_minutes`).

## Plans (Gantt charts)

Notes → Plans shows a project as a Gantt chart: a bar for each task over the calendar, arrows for dependencies,
diamonds for milestones, the done part filled in, a dashed line for today, and Days, Weeks or Months.

- **Drag** a bar to move a task; the tasks that depend on it move after it.
- **Tap** a bar to edit it: name, dates, owner (you or Jade), percent done, milestone, dependencies, notes.
- **Plan** pushes every task to start after the tasks it depends on.
- Colours: green ready, amber blocked or waiting, red late; your tasks have a dashed outline; the critical path
  (the tasks that set the finish date) has a bright edge.

Each project is a file, `/Jade/Projects/<name>.json`. Jade plans with the `gantt` tool: `create`, `add`, `update`,
`link`, `unlink`, `remove`, `plan`, `show` (a text chart), `report` (late, blocked, ready, due soon, critical path) and
`ready`. Your tasks are yours: she asks before changing one.

**Plans and the scheduler** are separate. The one link: with autonomous mode on (and "Work on Jade's ready plan tasks"
under Limits), each of Jade's tasks that is ready (its dependencies done and its start date reached) becomes a tier 3
goal, and when she finishes it the plan task is marked 100%.
