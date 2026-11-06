;; jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
;; Run a .tflite model with LiteRT from Lisp.
;; node /Jade/tools/lisp.js /Jade/Lisp/examples/tflite.jl /models/mobilenet.tflite /photos/cat.jpg /models/labels.txt
(when (< (length *args*) 2) (error "usage: tflite.jl MODEL.tflite IMAGE [LABELS.txt]"))
(define model (nth *args* 0))
(define image (nth *args* 1))
(define labels (nth *args* 2 nil))

(define loaded (tflite/load model))
(print loaded)
;; load answers with a map: :id, :inputs and :outputs (shapes and types)
(define id (get loaded :id))
(print "inputs:" (get loaded :inputs))
(print (tflite/run id (list {:image image}) (if labels {:labels labels} {})))
(tflite/unload id)
