# Jade Lisp

**Jade Vault 2.26.0.** Jade Lisp is a small Lisp in the style of Scheme and Clojure, part of the base system. Use it
to build small languages (DSLs) for rules, configuration or workflows, and for scripts that string Jade's tools together.

It lives in the vault: the interpreter is `/Jade/tools/lisp.js`, libraries go in `/Jade/Lisp/lib` and examples are in
`/Jade/Lisp/examples`. Jade runs it with the `lisp` tool; you can run it from the shell:

```
node /Jade/tools/lisp.js /Jade/Lisp/examples/hello.jl Jade
node /Jade/tools/lisp.js eval '(+ 1 2)'
node /Jade/tools/lisp.js eval '(let loop () (loop))' fuel=10000
```

In the vault's shell, write `eval` (not `-e`) and options without dashes (`fuel=N`, `pure=yes`, `quiet=yes`).

## The language

- **Data:** numbers, `"strings"`, symbols, `:keywords`, lists `(list 1 2)` or `[1 2]`, maps `{:name "Ada" :age 36}`,
  `nil`, `#t` and `#f`.
- **Forms:** `define`, `lambda` (or `fn`), `let`, `let*`, `letrec`, named `let` for loops, `if`, `cond`, `case`,
  `when`, `unless`, `and`, `or`, `while`, `begin`, `set!`. Tail calls run in constant space.
- **Macros:** `defmacro` with quasiquote (`` ` ``, `,`, `,@`), `gensym`, `macroexpand`.
- **Errors:** `(try … (catch e …) (finally …))`, `error`, `raise`, `assert`. Errors name the line.
- **Builtins:** lists (`map filter reduce sort sort-by group-by range take drop zip`…), maps (`get get-in assoc
  update merge keys`…, and `(:key m)`), strings (`str format string-split regex-match`…), `json-parse`, `json-string`,
  threading `->` and `->>`. `node /Jade/tools/lisp.js builtins` lists them all.

## Calling Jade

| From Lisp | Does |
|---|---|
| `(tool/NAME :arg value …)` or `(jade/tool "name" {:arg value})` | runs any tool |
| `(jade/ask "question")`, `(jade/decide {…})` | one model answer, a decision |
| `(jade/flow "name" input)`, `(jade/shell "command")`, `(jade/notify "title" "body")` | flows, the shell, notifications |
| `(jade/kv-get :k)`, `(jade/kv-set :k v)`, `(jade/search "query")` | the script store, note search |
| `(tflite/load "/models/m.tflite")`, `(tflite/run id inputs)` | LiteRT models |
| `read-file`, `write-file`, `list-dir`, `file-exists?`, `(load "lib")` | files |
| `(js/eval "…")`, `(js/get o :a)`, `(js/call o :method …)` | JavaScript, for anything else |

## Building a DSL

1. **With macros:** the new language is Lisp with new words. See `examples/state-machine.jl`.
2. **In a sandbox:** for programs written by someone else (a note, the user, another model). Give the language its
   verbs as ordinary functions and run the program where only those exist, with a step limit:

   ```lisp
   (load "dsl")
   (define lang (make-dsl {:fact (lambda (k) (get facts k)) :alert print} :pure))
   (dsl-run lang program-text 10000)
   ```

   The program cannot read files, call tools or loop forever. See `examples/rules.jl`.
3. **As data:** parse the text with `read-all` and walk the forms yourself.

`pure=yes` (or `pure: true` on the tool) runs a whole program without tools, files or JavaScript.
