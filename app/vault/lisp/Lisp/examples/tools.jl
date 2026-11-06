;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; Calling Jade from Lisp. Every tool is tool/NAME; arguments are :key value pairs or one map.
;; node /Jade/tools/lisp.js /Jade/Lisp/examples/tools.jl "weekly review"

(define topic (if (null? *args*) "todo" (car *args*)))

;; search notes (the same as (tool/notes_search :query topic :limit 5))
(define hits (jade/search topic 5))
(print "Notes about" topic ":")
(print hits)

;; read a file through the read tool, or directly
(print "lisp.js is" (string-length (read-file "/Jade/tools/lisp.js")) "characters long")

;; remember something between runs
(define runs (or (jade/kv-get :lisp-example-runs) 0))
(jade/kv-set :lisp-example-runs (+ runs 1))
(print "This example has run" (+ runs 1) "times.")

;; ask the model one question (no tools, one answer)
;; (print (jade/ask (str "In one sentence, what is " topic "?")))

;; anything not wrapped: (jade/tool "tool_name" {:arg 1}) or (js/eval "...")
