---
name: lisp-dsl
description: Write and run Jade Lisp (the lisp tool) — scripts that call any of your tools, and small domain-specific languages (DSLs) built with macros or sandboxes. Use when the user asks for a DSL, a rules or config language, a Lisp program, or a script that strings tools together.
---
<!-- jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits -->
# Jade Lisp

A small Scheme/Clojure-style Lisp, part of your base system: `/Jade/tools/lisp.js`. Run it with the **lisp** tool (`code`, or `file` plus `args`), or from the shell with `node /Jade/tools/lisp.js FILE.jl` / `node /Jade/tools/lisp.js eval '(+ 1 2)'`. In the shell use `eval`, not `-e`, and options without dashes: `fuel=100000`, `pure=yes`.

## The language, briefly
- Data: numbers, `"strings"`, symbols, `:keywords`, lists `(list 1 2)` or `[1 2]`, maps `{:name "x" :n 1}`, `nil`, `#t`/`#f`.
- `(define x 1)` `(define (f a b) ...)` `(lambda (x) ...)` / `fn`, `let` `let*` `letrec`, named let `(let loop ((i 0)) ... (loop (+ i 1)))` (tail calls cost nothing), `if` `cond` `case` `when` `unless` `and` `or` `while` `begin` `set!`.
- Errors: `(try body... (catch e ...) (finally ...))`, `(error "msg" x)`, `(raise {:code 1})`, `(assert test "msg")`.
- Lists: `map filter reduce sort sort-by group-by find any? every? range take drop append reverse nth zip flatten distinct sum`.
- Maps: `get get-in assoc assoc-in dissoc update merge keys vals has-key?`; `(:key m)` and `(m :key)` look up too.
- Strings: `str format (~a ~s ~%) string-split string-join string-replace substring regex-match regex-replace`.
- `json-parse` / `json-string`; `print` / `display` / `printf` write output.
- Threading `->` `->>`, `dolist`, `dotimes`, `if-let`, `when-let`, `compose`, `partial`.

## Calling Jade
- Any tool: `(tool/NAME :arg value ...)` or `(jade/tool "name" {:arg value})`. Results come back as the tool gives them (usually text; `json-parse` it when it is JSON).
- `(jade/ask "question")`, `(jade/decide {...})`, `(jade/flow "name" input)`, `(jade/shell "ls /Notes")`, `(jade/notify "title" "body")`, `(jade/search "query" 5)`, `(jade/kv-get :k)` / `(jade/kv-set :k v)`, `(jade/tools)`.
- Models: `(tflite/load "/models/m.tflite")` gives a map with `:id :inputs :outputs`; `(tflite/run id (list {:image "/photo.jpg"}) {:labels "/models/labels.txt"})`; `(onnx/run :action "run" ...)`.
- Files: `read-file`, `write-file` (goes through the write tool), `list-dir`, `file-exists?`, `(load "dsl")` (searches the file's folder, then `/Jade/Lisp/lib`).
- Anything else: `(js/eval "...")`, `(js/get obj :a :b)`, `(js/call obj :method args...)`.
- `jade/agent` cannot start from inside your own chat turn; use `tool/delegate` for a sub-task instead.

## Building a DSL — pick one of three shapes
1. **Macros** (the language is Lisp with new words). `defmacro` with quasiquote: `` `(define ,name ...) `` and `,@body`. Example: `/Jade/Lisp/examples/state-machine.jl`. Check what a macro produces with `(macroexpand '(my-form ...))`.
2. **A sandbox with verbs** (programs written by the user, notes, or another model). Write the verbs as ordinary functions, then run the program text where only those verbs exist:
   ```lisp
   (load "dsl")
   (define lang (make-dsl {:fact (lambda (k) (get facts k)) :alert (lambda (m) (print "ALERT" m))} :pure))
   (dsl-run lang program-text 10000)     ; 10000 steps at most
   ```
   Inside, the program cannot read files, call tools or loop forever: it can only do what your verbs do. That is the safety model: **grant capabilities as verbs**, never hand a sandbox `jade/tool`. Example: `/Jade/Lisp/examples/rules.jl`.
3. **Data interpreted by you** (the DSL is plain lists you walk with `case` on the head). Best when the "program" is configuration. `(read-all text)` parses text into forms without running it.

## Habits
- Keep programs in files under `/Jade/Lisp` (libraries in `/Jade/Lisp/lib`), so the user can read and rerun them.
- Test small: run a form, look at the value, then build up. The error says the line.
- A runaway program stops at the fuel limit (50 million steps by default; `fuel` on the tool to change it).
- Never put passwords or keys in Lisp files or kv; they are plain text in the vault.
