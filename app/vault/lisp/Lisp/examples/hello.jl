;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; node /Jade/tools/lisp.js /Jade/Lisp/examples/hello.jl Jade
(define who (if (null? *args*) "world" (car *args*)))
(print "Hello," who)
(define (square x) (* x x))
(print "squares:" (map square (range 1 6)))
(print "sum of squares to 100:" (sum (map square (range 1 101))))
(print "a map:" {:name who :len (string-length who)})
