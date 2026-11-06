;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; A DSL made with macros: state machines.
;; node /Jade/tools/lisp.js /Jade/Lisp/examples/state-machine.jl

;; (machine name (state NAME (on EVENT -> NEXT) ...) ...) defines name as a map of transitions
(defmacro machine (name . states)
  `(define ,name
     (hash-map ,@(mapcat (lambda (s)
                           (list (list 'quote (cadr s))
                                 (cons 'hash-map
                                       (mapcat (lambda (t) (list (list 'quote (cadr t)) (list 'quote (nth t 3))))
                                               (cddr s)))))
                         states))))

(define (step m state event)
  (let ((next (get (get m state) event)))
    (if next next (error (format "no transition from ~a on ~a" state event)))))

(define (run-machine m start events)
  (reduce (lambda (state e) (let ((n (step m state e))) (print state "--" e "->" n) n)) start events))

(machine door
  (state closed (on open -> opened) (on lock -> locked))
  (state opened (on close -> closed))
  (state locked (on unlock -> closed)))

(print "final:" (run-machine door 'closed '(open close lock unlock open)))
(print (try (step door 'locked 'open) (catch e (str "refused: " e))))
