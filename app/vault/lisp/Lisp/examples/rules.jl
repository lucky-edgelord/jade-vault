;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; A sandboxed rules DSL. Users (or Jade) write rules as plain text; they run with only the verbs given here.
;; node /Jade/tools/lisp.js /Jade/Lisp/examples/rules.jl
(load "dsl")

(define facts {:temperature 31 :humidity 80 :day "saturday"})
(define fired (collector))

(define triage
  (make-dsl {:fact (lambda (k) (get facts k))
             :alert (car fired)}
            :pure))

;; this text could come from a note: it cannot read files, call tools or loop forever
(define program "
  (when (> (fact :temperature) 30) (alert \"hot\" (fact :temperature)))
  (when (and (> (fact :humidity) 70) (> (fact :temperature) 25)) (alert \"muggy\"))
  (when (member (fact :day) '(\"saturday\" \"sunday\")) (alert \"weekend\"))
")

(dsl-run triage program 10000)
(print "alerts:" ((cadr fired)))

;; what the sandbox refuses
(print (try (dsl-run triage "(read-file \"/Jade/Self/README.md\")") (catch e (str "blocked: " e))))
(print (try (dsl-run triage "(let loop () (loop))" 5000) (catch e (str "stopped: " e))))
