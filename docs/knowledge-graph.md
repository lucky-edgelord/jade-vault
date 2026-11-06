# The knowledge graph

**Jade Vault 2.25.0.** The knowledge graph holds facts, rules and constraints, and a reasoner that checks claims against
them and shows its proof. Use it to verify Jade's answers, to check your notes for contradictions, and to ask questions
whose answers follow from what you know.

Open it from **Notes → Knowledge**.

## Facts

A fact is a relation between things:

```text
works_at(alice, acme)
reports_to(bob, alice)
born_on(alice, "1990-04-02")
team_size(acme, 12)
```

- Relation names and simple names are lowercase words (letters, digits, `_`).
- Anything with spaces, capitals or punctuation goes in quotes: `"Acme Corp"`.
- Numbers are plain numbers. Write dates as `"YYYY-MM-DD"` text so they compare correctly.

Each fact has a status:

| status | meaning |
| --- | --- |
| confirmed | you added it, or you approved it |
| proposed | Jade added it; it waits for you |
| rejected | you turned it down; it is ignored, and Jade cannot add it again |

Proposed facts still count, but every proof that rests on one says so. The Knowledge button shows how many wait;
**Facts → Confirm all**, or confirm and reject one at a time.

## Rules and constraints

The **Rules** view edits `/Jade/Knowledge/rules.dl`.

A **rule** adds facts that follow from others. Variables start with a capital letter:

```text
above(X, Y) :- reports_to(X, Y).
above(X, Z) :- reports_to(X, Y), above(Y, Z).
```

A **constraint** names something that must never happen. Any match is a contradiction:

```text
! one_employer: works_at(P, A), works_at(P, B), A != B.
! ends_after_start: starts(T, S), ends(T, E), E < S.
```

Conditions can be a fact pattern, `not` a fact pattern, or a comparison: `=`, `!=`, `<`, `<=`, `>`, `>=`. Numbers
compare by value, text alphabetically, and a number never equals a text.

Two rules keep the reasoner sound, and the editor refuses a file that breaks them (and says which line):

- every variable in a rule's head, after `not`, or in a comparison must first appear in an ordinary condition;
- `not` cannot go round a loop (a relation cannot depend on its own absence).

## Asking

The **Ask** view (and Jade's `knowledge` tool) has three questions:

- **Verify** a claim: `above(carol, alice)` or `not works_at(alice, globex)`. The answer is one of:
  - ✓ **proven**, with the facts and rules it rests on;
  - ✗ **contradicted**: the opposite holds, or the claim would break a constraint (the answer names it);
  - ? **unknown**: nothing in the graph says either way. The graph is open-world: something missing is not false.
- **Query** with variables: `above(carol, X)` lists every `X`; `above(X, alice), works_at(X, C)` joins two conditions.
- **Why** shows the full proof of one fact.

**Check** lists every constraint the facts break, with the facts involved. **Graph** draws facts between two things;
tick *Show what follows from rules* to include derived ones.

## With Jade

- Ask her to verify something ("does carol report up to alice? verify it"). She translates the claim into the
  graph's terms, shows you the exact claim she checked, and reports the verdict.
- Turn on **Verify answers** (top right of the Knowledge screen) and she checks the factual claims in her answers
  and marks each one ✓, ✗ or ?.
- Ask her to read a note and add its facts: they arrive as proposals with the note as their source. Then **Check**
  finds contradictions between notes.
- She can suggest rules and constraints for your domain and add them when you agree.

## Files and limits

- `/Jade/Knowledge/facts.jsonl`: one fact per line, `{"id","fact","status","by","source","ts"}`.
- `/Jade/Knowledge/rules.dl`: rules and constraints (facts written there count as confirmed).

Both are plain text in the vault: they sync and back up with your notes, and jade-py 0.12 reads the same files with
the same engine. The reasoner is written in Rust and runs as WebAssembly. A graph that would grow past 2 million facts
stops with an error (usually a rule that feeds itself without end). It does no arithmetic beyond comparisons, and no
probabilities: what it proves follows strictly from what is in the graph, so the quality of the facts is the quality
of the answers.
