;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; dsl.jl — helpers for building small languages on Jade Lisp.   (load "dsl")
;;
;; A DSL here is: a set of verbs (ordinary Lisp functions you write) + a sandbox where programs in the DSL run.
;; Programs only see the verbs you give them (and, with :pure, the pure builtins). The verbs themselves can do
;; anything Lisp can — call tools, read files — so you decide exactly what the language is allowed to do.

;; (make-dsl {:verb fn ...})          only the verbs, plus special forms (if, let, define...)
;; (make-dsl {:verb fn ...} :pure)    the verbs plus every pure builtin (math, lists, strings, maps)
(define (make-dsl verbs . opts)
  (if (member :pure opts) (sandbox :pure verbs) (sandbox verbs)))

;; run DSL source text (or a quoted form) with a step budget; returns the last value
(define (dsl-run env program . fuel)
  (eval-in env program {:fuel (if (null? fuel) 1000000 (car fuel))}))

;; run a DSL program stored in a file
(define (dsl-load env path . fuel)
  (apply dsl-run env (read-file path) fuel))

;; collect: a verb maker for "declarative" DSLs, where each statement just records data.
;; (define rules (collector)) gives a verb ((car rules) args...) that appends args, and ((cadr rules)) returns them.
(define (collector)
  (let ((items (list)))
    (list (lambda args (set! items (append items (list args))) nil)
          (lambda () items))))

;; check a DSL program for syntax errors without running it: returns nil or the error text
(define (dsl-check text)
  (try (begin (read-all text) nil) (catch e e)))
