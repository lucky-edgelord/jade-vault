// Jade Lisp (app/vault/lisp/tools/lisp.js) in plain Node, with a stand-in for Jade's bridge, plus every example file.
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const calls = []; const kv = {};
globalThis.jade = {
  tool: async (n, a) => { calls.push([n, a]); if (n === 'litert') return a.action === 'load' ? JSON.stringify({ id: 'm1-abc', inputs: [[1, 224, 224, 3]] }) : JSON.stringify({ top5: [[3, 0.9]] }); if (n === 'write') return 'wrote'; return `result of ${n} ${JSON.stringify(a)}`; },
  ask: async (p, o) => 'answer to ' + p, decide: async o => ({ choice: 'a' }), agent: async m => 'agent ' + m,
  flow: async (n, i) => ({ flow: n, input: i }), flows: async () => [{ name: 'f1' }], shell: async c => ({ code: 0, stdout: 'ran ' + c, stderr: '' }),
  notify: async () => true, search: async (q, l) => `found ${q} ${l}`, list: async () => ['read'],
  kv: { get: async k => kv[k] ?? null, set: async (k, v) => { kv[k] = v; return true; } },
};
import fs0 from 'node:fs'; import os0 from 'node:os'; import path0 from 'node:path';
// the repo is an ES module package; the vault runs lisp.js as CommonJS, so test a .cjs copy
const LISPJS = path0.join(fs0.mkdtempSync(path0.join(os0.tmpdir(), 'jlisp-')), 'lisp.cjs'); fs0.copyFileSync(new URL('../app/vault/lisp/tools/lisp.js', import.meta.url), LISPJS);
const EX = new URL('../app/vault/lisp/Lisp/examples', import.meta.url).pathname;
const L = require(LISPJS);
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };
const ev = async (code, o) => { const l = L.create({ capture: true, ...o }); try { return L.show(await l.run(code)); } catch (e) { return 'ERR ' + L.errText(e); } };
const cases = [
  ['(+ 1 2 3)', '6'], ['(- 10 4 1)', '5'], ['(/ 1 4)', '0.25'], ['(modulo -7 3)', '2'], ['(expt 2 10)', '1024'],
  ['(define x 5) (set! x (* x 2)) x', '10'], ['(let ((a 1) (b 2)) (+ a b))', '3'], ['(let [a 1 b 2] (list a b))', '(1 2)'],
  ['(let* ((a 1) (b (+ a 1))) b)', '2'], ['(letrec ((ev? (lambda (n) (if (= n 0) #t (od? (- n 1))))) (od? (lambda (n) (if (= n 0) #f (ev? (- n 1)))))) (ev? 1000))', '#t'],
  ['(let loop ((i 0) (s 0)) (if (= i 200000) s (loop (+ i 1) (+ s i))))', '19999900000'],
  ['(define (count n) (if (= n 0) 0 (+ 1 (count (- n 1))))) (count 2000)', '2000'],
  ['(cond ((> 1 2) "a") ((< 1 2) "b") (else "c"))', '"b"'], ['(cond ((assoc 2 \'((1 one) (2 two))) => cadr) (else 0))', 'two'],
  ['(case 3 ((1 2) "low") ((3 4) "mid") (else "high"))', '"mid"'], ['(and 1 2 3)', '3'], ['(or #f nil 7)', '7'], ['(and)', '#t'],
  ['(when #f 1)', 'nil'], ['(unless #f 1 2)', '2'], ['(define i 0) (while (< i 5) (set! i (+ i 1))) i', '5'],
  ["'(a b . c)", '(a b . c)'], ['`(1 ,(+ 1 1) ,@(list 3 4))', '(1 2 3 4)'], ['(define-macro (swap! a b) (let ((t (gensym))) `(let ((,t ,a)) (set! ,a ,b) (set! ,b ,t)))) (define p 1) (define q 2) (swap! p q) (list p q)', '(2 1)'],
  ['(defmacro unless2 (c . body) `(if ,c nil (begin ,@body))) (unless2 #f 42)', '42'], ['(macroexpand \'(defn f (x) x))', '(define f (lambda (x) x))'],
  ['(try (error "bad" 42) (catch e e))', '"bad 42"'], ['(try (raise {:code 7}) (catch e (get e :code)))', '7'],
  ['(define log (list)) (try (try (error "x") (finally (set! log (list "fin")))) (catch e (append log (list e))))', '("fin" "x")'],
  ['(assert (= 1 2) "math broke")', 'ERR assertion failed: math broke (line 1)'], ['(car 5)', 'ERR car: expected a non-empty list, got 5 (line 1)'],
  ['(f 1)', 'ERR unbound symbol: f (line 1)'], ['((lambda (a b) a) 1)', 'ERR lambda expects 2 arguments, got 1 (line 1)'],
  ['(map + (list 1 2) (list 10 20))', '(11 22)'], ['(filter odd? (range 10))', '(1 3 5 7 9)'], ['(reduce + 0 (range 5))', '10'], ['(reduce * (list 1 2 3 4))', '24'],
  ['(sort (list 3 1 2))', '(1 2 3)'], ['(sort (list "b" "a" "c") (lambda (a b) (string<? a b)))', '("a" "b" "c")'],
  ['(sort-by (lambda (m) (get m :n)) (list {:n 2} {:n 1}))', '({:n 1} {:n 2})'], ['(group-by even? (range 5))', '{:true (0 2 4) :false (1 3)}'],
  ['(-> {:a 1} (assoc :b 2) (get :b))', '2'], ['(->> (range 5) (map inc) (filter even?) (sum))', '6'], ['(dotimes (i 3) (print i))', 'nil'],
  ['(get {:a {:b 1}} :a)', '{:b 1}'], ['(get-in {:a {:b 1}} [:a :b])', '1'], ['(:a {:a 9})', '9'], ['({:a 9} :a)', '9'], ['(assoc-in {} [:a :b] 1)', '{:a {:b 1}}'],
  ['(keys {:a 1 :b 2})', '(:a :b)'], ['(merge {:a 1} {:b 2})', '{:a 1 :b 2}'], ['(update {:n 1} :n + 10)', '{:n 11}'], ['(dissoc {:a 1 :b 2} :a)', '{:b 2}'],
  ['(json-string {:a (list 1 2) :b :kw})', '"{\\"a\\":[1,2],\\"b\\":\\"kw\\"}"'], ['(get (json-parse "{\\"x\\": [1, {\\"y\\": 2}]}") :x)', '(1 {:y 2})'],
  ['(format "~a + ~s = ~a~%" 1 "two" 3)', '"1 + \\"two\\" = 3\\n"'], ['(str "a" 1 :k nil)', '"a1:knil"'], ['(string-split "a,b,c" ",")', '("a" "b" "c")'],
  ['(string-join (list 1 2 3) "-")', '"1-2-3"'], ['(regex-match "(\\\\d+)-(\\\\d+)" "x 12-34")', '("12-34" "12" "34")'], ['(substring "hello" 1 3)', '"el"'],
  ['((compose inc inc) 1)', '3'], ['((partial + 10) 5)', '15'], ['(if-let (x (get {:a 1} :a)) (* x 10) 0)', '10'],
  ['(eval (list \'+ 1 2))', '3'], ['(read-string "(a b)")', '(a b)'], ['(type-of :k)', 'keyword'],
  ['(let loop () (loop))', 'ERR out of fuel after 2000 steps (raise --fuel, or look for an endless loop) (line 1)', { fuel: 2000 }],
  ['(define e (sandbox :pure)) (eval-in e "(+ 1 2)")', '3'], ['(define e (sandbox :pure)) (eval-in e "(read-file \\"/x\\")")', 'ERR unbound symbol: read-file (line 1)'],
  ['(define e (sandbox :pure)) (eval-in e "(jade/tool \\"x\\")")', 'ERR unbound symbol: jade/tool (line 1)'], ['(define e (sandbox :pure)) (eval-in e "(tool/write :path \\"/x\\")")', 'ERR unbound symbol: tool/write (line 1)'],
  ['(define e (sandbox (quote +))) (eval-in e "(list 1)")', 'ERR unbound symbol: list (line 1)'],
  ['(define e (sandbox :pure)) (eval-in e "(let loop () (loop))" {:fuel 500})', 'ERR out of fuel: the sandboxed program used more than 500 steps (line 1)'],
  ['(define e (sandbox {:double (lambda (x) (* 2 x))})) (eval-in e "(double 21)")', '42'],
  ['(+ 1 "a")', 'ERR +: expected a number, got "a" (line 1)'], ['(1 2)', 'ERR not a function: 1 (line 1)'],
  ['(car (quote ()))', 'ERR car: expected a non-empty list, got () (line 1)'], ['"a\\nb"', '"a\\nb"'], ['#| block |# ; line\n #;(ignored) 5', '5'],
  ['(sum (map (lambda (x) (* x x)) (range 1 1001)))', '333833500'],
  ['(tool/notes_search :query "cats" :limit 3)', '"result of notes_search {\\"query\\":\\"cats\\",\\"limit\\":3}"'],
  ['(jade/tool "read" {:path "/a.md"})', '"result of read {\\"path\\":\\"/a.md\\"}"'], ['(jade/ask "hi")', '"answer to hi"'],
  ['(get (jade/flow "f1" {:x (list 1 2)}) :input)', '{:x (1 2)}'], ['(get (jade/shell "ls") :stdout)', '"ran ls"'], ['(jade/search "dogs" 2)', '"found dogs 2"'],
  ['(jade/kv-set :n 5) (jade/kv-get :n)', '5'], ['(get (tflite/load "/m.tflite") :id)', '"m1-abc"'], ['(tflite/run "m1-abc" (list {:image "/p.jpg"}))', '{:top5 ((3 0.9))}'],
  ['(write-file "/tmp/x.txt" "hi")', '"/tmp/x.txt"'], ['(map (lambda (n) (tool/echo :n n)) (list 1 2))', '("result of echo {\\"n\\":1}" "result of echo {\\"n\\":2}")'],
  ['(js/eval "1 + 2")', '3'], ['(js/get (js/eval "({a: {b: 4}})") :a :b)', '4'], ['(js/call "abc" :toUpperCase)', '"ABC"'],
  ['(jade/tool "x")', 'ERR unbound symbol: jade/tool (line 1)', { pure: true }],
];
for (const [code, want, o] of cases) { const got = await ev(code, o); ok(got === want, `${code}\n   want ${want}\n   got  ${got}`); }
// the tool calls really went through
ok(calls.some(([n, a]) => n === 'litert' && a.action === 'load' && a.model === '/m.tflite'), 'litert load called');
ok(calls.some(([n, a]) => n === 'write' && a.path === '/tmp/x.txt' && a.content === 'hi'), 'write went through the write tool');
// printing
{ const l = L.create({ capture: true }); await l.run('(print "a" 1 :b) (display "x") (printf "~a~%" 2)'); ok(l.output() === 'a 1 :b\nx2\n', 'output: ' + JSON.stringify(l.output())); }
// JS API
{ const l = L.create({ capture: true }); l.define('twice', x => x * 2); ok(await l.run('(twice 21)') === 42, 'define from JS'); await l.run('(define (sq x) (* x x))'); ok(await l.call('sq', 7) === 49, 'call from JS'); }
// read errors
ok((await ev('(+ 1 2')).startsWith('ERR read error at line 1: ( is never closed'), 'unclosed paren: ' + await ev('(+ 1 2'));
ok((await ev('(a))')).includes('unexpected )'), 'stray paren');
// every example runs
const { execFileSync } = await import('node:child_process');
const runEx = (f, ...a) => { try { return execFileSync('node', [LISPJS, f, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return 'ERR ' + e.stdout + e.stderr; } };
let r = runEx(`${EX}/hello.jl`, 'Jade'); ok(r.includes('Hello, Jade') && r.includes('338350'), 'hello.jl: ' + r);
r = runEx(`${EX}/state-machine.jl`); ok(r.includes('final: opened') && r.includes('refused: no transition from locked on open'), 'state-machine.jl: ' + r);
r = runEx(`${EX}/rules.jl`); ok(r.includes('alerts: ((hot 31) (muggy) (weekend))') && r.includes('blocked: unbound symbol: read-file') && r.includes('stopped: out of fuel'), 'rules.jl: ' + r);
r = runEx(`${EX}/tools.jl`); ok(r.includes('Jade is not reachable here'), 'tools.jl outside the vault explains: ' + r);
r = runEx('check', `${EX}/tflite.jl`); ok(/no syntax errors/.test(r), 'tflite.jl parses: ' + r);
r = runEx('help'); ok(r.includes('Jade Lisp'), 'help');
console.log(fails ? `${fails} of ${n} FAILED` : `ALL PASS (${n} checks)`);
process.exitCode = fails ? 1 : 0;
