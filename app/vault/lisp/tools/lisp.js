#!/usr/bin/env node
// jade-lisp-seed v1: written by Jade Vault; delete this line to keep your own edits
/* Jade Lisp — a small Scheme/Clojure-style Lisp for building DSLs, written in JavaScript.
   Runs inside the vault with the shell's node. Everything Jade can do from JavaScript works from Lisp:
   every tool (tool/NAME or jade/tool), ask, decide, agent, flows, shell, notify, kv, LiteRT (tflite), files.

     node /Jade/tools/lisp.js FILE.jl [args...]     run a file (args are in *args*)
     node /Jade/tools/lisp.js eval '(+ 1 2)'        evaluate code and print the result (in the vault use eval, not -e:
                                                    the vault's node takes -e for itself)
     node /Jade/tools/lisp.js check FILE.jl         read a file and report syntax errors only
     node /Jade/tools/lisp.js help                  this text and the list of builtins
   Options (write them as fuel=N or --fuel=N; in the vault use the form without dashes, the vault's node keeps
   --options for itself): fuel=N (evaluation steps, default 50,000,000), pure=yes (no tools, files or JavaScript),
   quiet=yes (do not print the result), print=yes (print a file's last value).

   From JavaScript:  const L = require('/Jade/tools/lisp.js');
                     const lisp = L.create();                  // or L.create({ pure: true, globals: {...} })
                     const v = await lisp.run('(+ 1 2)');      // last value; lisp.output() has what it printed
*/
'use strict';
const fs = require('fs');
const VERSION = '1.0.0';
const J = (typeof jade !== 'undefined') ? jade : (globalThis.jade || null);

// ------------------------------------------------------------------ values
class Sym { constructor(n) { this.name = n; } toString() { return this.name; } }
class Kw { constructor(n) { this.name = n; } toString() { return ':' + this.name; } }
const SYMS = new Map(), KWS = new Map();
const sym = n => { let s = SYMS.get(n); if (!s) SYMS.set(n, s = new Sym(n)); return s; };
const kw = n => { let s = KWS.get(n); if (!s) KWS.set(n, s = new Kw(n)); return s; };
class Fn { constructor(name, params, rest, body, env) { this.name = name; this.params = params; this.rest = rest; this.body = body; this.env = env; } }
class Macro extends Fn {}
class Env {
  constructor(parent = null) { this.v = new Map(); this.parent = parent; }
  get(s) { let e = this; while (e) { if (e.v.has(s)) return e.v.get(s); e = e.parent; } return undefined; }
  has(s) { let e = this; while (e) { if (e.v.has(s)) return true; e = e.parent; } return false; }
  def(s, x) { this.v.set(s, x); return x; }
  set(s, x) { let e = this; while (e) { if (e.v.has(s)) { e.v.set(s, x); return true; } e = e.parent; } return false; }
}
class LispError extends Error { constructor(msg, value, kind = 'error') { super(msg); this.value = value === undefined ? msg : value; this.kind = kind; } }
const isMap = v => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Sym) && !(v instanceof Kw) && !(v instanceof Fn) && !(v instanceof Env) && Object.getPrototypeOf(v) === Object.prototype;
const truthy = v => v !== null && v !== false && v !== undefined;
const S = (x, n) => x instanceof Sym && x.name === n;
const LINES = new WeakMap();   // list form -> source line, for error messages
const BRACKET = new WeakSet();   // [a b c] written with brackets: a list literal when evaluated (bindings and parameters still read it as a list)

// ------------------------------------------------------------------ reader
function read(src, file = '') {
  const out = []; let i = 0, line = 1; const n = src.length;
  const where = () => (file ? file + ':' : 'line ') + line;
  const fail = m => { throw new LispError(`read error at ${where()}: ${m}`, undefined, 'read'); };
  const ws = () => {
    for (;;) {
      const c = src[i];
      if (c === '\n') { line++; i++; }
      else if (c === ' ' || c === '\t' || c === '\r') i++;
      else if (c === ';') { while (i < n && src[i] !== '\n') i++; }
      else if (c === '#' && src[i + 1] === '|') { const l0 = line; i += 2; while (i < n && !(src[i] === '|' && src[i + 1] === '#')) { if (src[i] === '\n') line++; i++; } if (i >= n) { line = l0; fail('#| comment is never closed with |#'); } i += 2; }
      else if (c !== undefined && /\s/.test(c)) i++;
      else return;
    }
  };
  const DELIM = /[\s()\[\]{}"';`,]/;
  const seq = (close, open) => {
    const l0 = line, v = [];
    for (;;) {
      ws();
      if (i >= n) { line = l0; fail(`${open} is never closed (add ${close})`); }
      const c = src[i];
      if (c === close) { i++; LINES.set(v, l0); return v; }
      if (c === ')' || c === ']' || c === '}') fail(`expected ${close} to close the ${open} from line ${l0}, found ${c}`);
      const f = form(); if (f !== SKIP) v.push(f);
    }
  };
  const SKIP = {};
  const must = () => { for (;;) { ws(); if (i >= n || /[)\]}]/.test(src[i])) fail('a quote needs a form after it'); const f = form(); if (f !== SKIP) return f; } };
  const form = () => {
    ws(); if (i >= n) fail('unexpected end of input');
    const c = src[i], l0 = line;
    const tag = (h, x) => { const v = [sym(h), x]; LINES.set(v, l0); return v; };
    if (c === '(') { i++; return seq(')', '('); }
    if (c === '[') { i++; const v = seq(']', '['); BRACKET.add(v); return v; }
    if (c === '{') { i++; const v = seq('}', '{'); v.unshift(sym('hash-map')); LINES.set(v, l0); return v; }
    if (c === ')' || c === ']' || c === '}') fail(`unexpected ${c}`);
    if (c === '#' && src[i + 1] === ';') { i += 2; must(); return SKIP; }
    if (c === "'") { i++; return tag('quote', must()); }
    if (c === '`') { i++; return tag('quasiquote', must()); }
    if (c === ',') { i++; if (src[i] === '@') { i++; return tag('unquote-splicing', must()); } return tag('unquote', must()); }
    if (c === '"') {
      i++; let s = '';
      for (;;) {
        if (i >= n) { line = l0; fail('string is never closed'); }
        const ch = src[i++];
        if (ch === '"') return s;
        if (ch === '\n') line++;
        if (ch !== '\\') { s += ch; continue; }
        const e = src[i++];
        if (e === 'n') s += '\n'; else if (e === 't') s += '\t'; else if (e === 'r') s += '\r'; else if (e === '0') s += '\0';
        else if (e === 'u') { const h = src.slice(i, i + 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) fail('\\u needs 4 hex digits'); s += String.fromCharCode(parseInt(h, 16)); i += 4; }
        else if (e === '\n') { line++; while (src[i] === ' ' || src[i] === '\t') i++; }
        else s += e;
      }
    }
    const st = i; while (i < n && !DELIM.test(src[i])) i++;
    return atom(src.slice(st, i));
  };
  for (;;) { ws(); if (i >= n) break; const f = form(); if (f !== SKIP) out.push(f); }
  return out;
}
function atom(t) {
  if (t === '#t' || t === 'true') return true;
  if (t === '#f' || t === 'false') return false;
  if (t === 'nil' || t === 'null') return null;
  if (/^[+-]?(\d[\d_]*\.?[\d_]*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(t)) return Number(t.replace(/_/g, ''));
  if (/^[+-]?0x[0-9a-fA-F]+$/.test(t)) return Number(t.replace(/^([+-]?)0x/, '$10x')) ;
  if (t.length > 1 && t[0] === ':') return kw(t.slice(1));
  return sym(t);
}

// ------------------------------------------------------------------ printer
function show(v, w = true, d = 0) {
  if (d > 200) return '...';
  if (v === null || v === undefined) return 'nil';
  if (v === true) return '#t'; if (v === false) return '#f';
  if (typeof v === 'number') return Number.isInteger(v) || !Number.isFinite(v) ? (Number.isNaN(v) ? '+nan.0' : v === Infinity ? '+inf.0' : v === -Infinity ? '-inf.0' : String(v)) : String(v);
  if (typeof v === 'string') return w ? JSON.stringify(v) : v;
  if (v instanceof Sym) return v.name;
  if (v instanceof Kw) return ':' + v.name;
  if (Array.isArray(v)) {
    if (v.length === 2 && v[0] instanceof Sym && w) { const q = { quote: "'", quasiquote: '`', unquote: ',', 'unquote-splicing': ',@' }[v[0].name]; if (q) return q + show(v[1], w, d + 1); }
    return '(' + v.map(x => show(x, w, d + 1)).join(' ') + ')';
  }
  if (v instanceof Macro) return `#<macro ${v.name}>`;
  if (v instanceof Fn) return `#<fn ${v.name}>`;
  if (v instanceof Env) return '#<env>';
  if (typeof v === 'function') return `#<builtin ${v.lispName || v.name || '?'}>`;
  if (isMap(v)) return '{' + Object.entries(v).map(([k, x]) => ':' + k + ' ' + show(x, w, d + 1)).join(' ') + '}';
  if (v instanceof Map) return '{' + [...v].map(([k, x]) => show(k, true, d + 1) + ' ' + show(x, w, d + 1)).join(' ') + '}';
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return `#<${v.constructor.name} ${v.length}>`;
  try { return `#<js ${JSON.stringify(v).slice(0, 80)}>`; } catch { return `#<js ${Object.prototype.toString.call(v)}>`; }
}
const typeOf = v => v === null || v === undefined ? 'nil' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'float') : typeof v === 'string' ? 'string' : v instanceof Sym ? 'symbol' : v instanceof Kw ? 'keyword' : Array.isArray(v) ? 'list' : v instanceof Macro ? 'macro' : (v instanceof Fn || typeof v === 'function') ? 'function' : v instanceof Env ? 'env' : isMap(v) ? 'map' : 'js';

// ------------------------------------------------------------------ data helpers
function equal(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (isMap(a) && isMap(b)) { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && equal(a[k], b[k])); }
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  return false;
}
const keyName = k => k instanceof Kw || k instanceof Sym ? k.name : typeof k === 'string' ? k : k === null ? 'nil' : String(k);
// Lisp value -> plain JSON-able JavaScript (keywords and symbols become their names)
function toJS(v, d = 0) {
  if (d > 200) throw new LispError('value is nested too deeply');
  if (v === undefined) return null;
  if (v instanceof Kw || v instanceof Sym) return v.name;
  if (Array.isArray(v)) return v.map(x => toJS(x, d + 1));
  if (isMap(v)) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = toJS(x, d + 1); return o; }
  if (v instanceof Fn || typeof v === 'function') throw new LispError(`a ${typeOf(v)} cannot be passed as data`);
  return v;
}
function kwargs(args) {
  const o = {}; let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (isMap(a)) { Object.assign(o, toJS(a)); i++; continue; }
    if (a === null) { i++; continue; }
    if (a instanceof Kw || a instanceof Sym || typeof a === 'string') { if (i + 1 >= args.length) throw new LispError(`:${keyName(a)} has no value after it`); o[keyName(a)] = toJS(args[i + 1]); i += 2; continue; }
    throw new LispError(`arguments must be :key value pairs or a map, found ${show(a)}`);
  }
  return o;
}
const seqOf = (v, who) => {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return [...v];
  if (isMap(v)) return Object.entries(v).map(([k, x]) => [kw(k), x]);
  throw new LispError(`${who}: expected a list, got ${show(v)}`);
};
const num = (v, who) => { if (typeof v !== 'number') throw new LispError(`${who}: expected a number, got ${show(v)}`); return v; };
const str = (v, who) => { if (typeof v === 'string') return v; if (v instanceof Sym || v instanceof Kw) return v.name; throw new LispError(`${who}: expected a string, got ${show(v)}`); };
const get = (m, k, d = null) => {
  if (m === null || m === undefined) return d;
  if (Array.isArray(m) || typeof m === 'string') { const x = typeof k === 'number' ? m[k] : undefined; return x === undefined ? d : x; }
  if (m instanceof Map) return m.has(k) ? m.get(k) : d;
  if (typeof m === 'object') { const n = keyName(k); return Object.prototype.hasOwnProperty.call(m, n) ? m[n] : d; }
  return d;
};
function cmp(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if ((a instanceof Kw && b instanceof Kw) || (a instanceof Sym && b instanceof Sym)) return cmp(a.name, b.name);
  if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; } return a.length - b.length; }
  if (a === null && b === null) return 0;
  throw new LispError(`cannot compare ${show(a)} with ${show(b)}`);
}

// ------------------------------------------------------------------ the interpreter
const SPECIAL = new Set(['quote', 'quasiquote', 'if', 'define', 'def', 'set!', 'lambda', 'fn', 'begin', 'do', 'let', 'let*', 'letrec', 'cond', 'case', 'when', 'unless', 'and', 'or', 'while', 'defmacro', 'define-macro', 'try', 'assert', 'macroexpand']);

function create(opts = {}) {
  const st = { steps: 0, fuel: opts.fuel || 50_000_000, out: [], echo: opts.echo !== false && !opts.capture, gensym: 0, depth: 0, maxDepth: opts.maxDepth || 10000, file: opts.file || '' };
  const G = new Env();
  const emit = s => { st.out.push(s); if (st.echo && typeof process !== 'undefined' && process.stdout) process.stdout.write(s); };

  async function apply(f, args) {
    if (f instanceof Macro) throw new LispError(`${f.name} is a macro: it can only be used in code, not called as a function`);
    if (f instanceof Fn) { const env = bind(f, args); return evalBody(f.body, env); }
    if (typeof f === 'function') return f(...args);
    if (f instanceof Kw) return get(args[0], f, args.length > 1 ? args[1] : null);
    if (isMap(f)) return get(f, args[0], args.length > 1 ? args[1] : null);
    throw new LispError(`not a function: ${show(f)}`);
  }
  function bind(f, args) {
    const np = f.params.length;
    if (args.length < np || (!f.rest && args.length > np)) throw new LispError(`${f.name} expects ${np}${f.rest ? ' or more' : ''} argument${np === 1 && !f.rest ? '' : 's'}, got ${args.length}`);
    const env = new Env(f.env);
    for (let i = 0; i < np; i++) env.v.set(f.params[i], args[i]);
    if (f.rest) env.v.set(f.rest, args.slice(np));
    return env;
  }
  async function evalBody(body, env) { let r = null; for (let i = 0; i < body.length - 1; i++) await ev(body[i], env); if (body.length) r = await ev(body[body.length - 1], env); return r; }
  function lambda(name, ps, body, env) {
    const params = []; let rest = null;
    if (ps instanceof Sym) rest = ps;
    else if (Array.isArray(ps)) {
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (S(p, '.') || S(p, '&') || S(p, '&rest')) { if (!(ps[i + 1] instanceof Sym) || i + 2 !== ps.length) throw new LispError(`${name}: ${p.name} must be followed by exactly one name`); rest = ps[i + 1]; break; }
        if (!(p instanceof Sym)) throw new LispError(`${name}: parameters must be names, not ${show(p)}`);
        params.push(p);
      }
    } else if (ps !== null) throw new LispError(`${name}: the parameter list must be a list`);
    return new Fn(name, params, rest, body, env);
  }
  const lookup = (s, env) => {
    const v = env.get(s);
    if (v !== undefined) return v;
    if (s.name.startsWith('tool/') && s.name.length > 5 && env.get(sym('jade/tool')) !== undefined) { const t = s.name.slice(5); const f = (...a) => G.get(sym('jade/tool'))(t, ...a); f.lispName = s.name; return f; }
    throw new LispError(`unbound symbol: ${s.name}`);
  };
  function bindings(b, who) {
    if (!Array.isArray(b)) throw new LispError(`${who}: bindings must be a list`);
    if (b.length && b[0] instanceof Sym) {   // Clojure style [a 1 b 2]
      if (b.length % 2) throw new LispError(`${who}: [name value ...] needs an even number of forms`);
      const r = []; for (let i = 0; i < b.length; i += 2) r.push([b[i], b[i + 1]]); return r;
    }
    return b.map(x => { if (!Array.isArray(x) || !(x[0] instanceof Sym)) throw new LispError(`${who}: a binding must be (name value), not ${show(x)}`); return [x[0], x.length > 1 ? x[1] : null]; });
  }
  async function qq(x, env, d) {
    if (!Array.isArray(x)) return x;
    if (S(x[0], 'unquote')) return d === 1 ? ev(x[1], env) : [x[0], await qq(x[1], env, d - 1)];
    if (S(x[0], 'quasiquote')) return [x[0], await qq(x[1], env, d + 1)];
    const out = [];
    for (const e of x) {
      if (d === 1 && Array.isArray(e) && S(e[0], 'unquote-splicing')) { const v = await ev(e[1], env); out.push(...seqOf(v, 'unquote-splicing')); }
      else out.push(await qq(e, env, d));
    }
    return out;
  }
  const isElse = t => S(t, 'else') || t === true || (t instanceof Kw && t.name === 'else');

  async function ev(x, env) {
    if (++st.depth > st.maxDepth) { st.depth = 0; throw new LispError(`recursion is too deep (more than ${st.maxDepth} nested calls)`, undefined, 'limit'); }
    try {
      for (;;) {
        if (++st.steps > st.fuel) throw new LispError(`out of fuel after ${st.fuel} steps (raise --fuel, or look for an endless loop)`, undefined, 'fuel');
        if (x instanceof Sym) return lookup(x, env);
        if (!Array.isArray(x)) return x;
        if (x.length === 0) return [];
        if (BRACKET.has(x)) { const out = new Array(x.length); for (let i = 0; i < x.length; i++) out[i] = await ev(x[i], env); return out; }
        const h = x[0];
        if (h instanceof Sym && SPECIAL.has(h.name) && !env.has(h)) {
          switch (h.name) {
            case 'quote': return x[1] === undefined ? null : x[1];
            case 'quasiquote': return qq(x[1], env, 1);
            case 'if': x = truthy(await ev(x[1], env)) ? x[2] : (x.length > 3 ? x[3] : null); if (x === undefined) return null; continue;
            case 'define': case 'def': {
              const t = x[1];
              if (Array.isArray(t)) { const f = lambda(t[0].name, t.slice(1), x.slice(2), env); env.def(t[0], f); return t[0]; }
              if (!(t instanceof Sym)) throw new LispError(`define: cannot define ${show(t)}`);
              const v = await ev(x[2] === undefined ? null : x[2], env);
              if (v instanceof Fn && v.name === 'lambda') v.name = t.name;
              env.def(t, v); return t;
            }
            case 'set!': { const v = await ev(x[2], env); if (!env.set(x[1], v)) throw new LispError(`set!: ${show(x[1])} is not defined (use define first)`); return v; }
            case 'lambda': case 'fn': return lambda('lambda', x[1], x.slice(2), env);
            case 'begin': case 'do': if (x.length === 1) return null; for (let i = 1; i < x.length - 1; i++) await ev(x[i], env); x = x[x.length - 1]; continue;
            case 'let': case 'let*': case 'letrec': {
              if (x[1] instanceof Sym) {   // named let: (let loop ((i 0)) ... (loop (+ i 1)))
                const bs = bindings(x[2], 'let'); const le = new Env(env);
                const f = lambda(x[1].name, bs.map(b => b[0]), x.slice(3), le); le.def(x[1], f);
                const args = []; for (const [, init] of bs) args.push(await ev(init, env));
                env = bind(f, args); const body = f.body; if (!body.length) return null;
                for (let i = 0; i < body.length - 1; i++) await ev(body[i], env); x = body[body.length - 1]; continue;
              }
              const bs = bindings(x[1], h.name); const e2 = new Env(env);
              if (h.name === 'let') { const vals = []; for (const [, init] of bs) vals.push(await ev(init, env)); bs.forEach(([n], i) => e2.def(n, vals[i])); }
              else for (const [n, init] of bs) { const v = await ev(init, e2); if (v instanceof Fn && v.name === 'lambda') v.name = n.name; e2.def(n, v); }
              env = e2; const body = x.slice(2); if (!body.length) return null;
              for (let i = 0; i < body.length - 1; i++) await ev(body[i], env); x = body[body.length - 1]; continue;
            }
            case 'cond': {
              let next = null, found = false;
              for (let i = 1; i < x.length; i++) {
                const cl = x[i]; if (!Array.isArray(cl) || !cl.length) throw new LispError(`cond: a clause must be (test body...), not ${show(cl)}`);
                const t = isElse(cl[0]) ? true : await ev(cl[0], env);
                if (truthy(t)) {
                  found = true;
                  if (cl.length === 1) return t;
                  if (S(cl[1], '=>')) return apply(await ev(cl[2], env), [t]);
                  for (let j = 1; j < cl.length - 1; j++) await ev(cl[j], env); next = cl[cl.length - 1]; break;
                }
              }
              if (!found) return null; x = next; continue;
            }
            case 'case': {
              const v = await ev(x[1], env); let next, found = false;
              for (let i = 2; i < x.length; i++) {
                const cl = x[i]; const ds = cl[0];
                if (isElse(ds) || (Array.isArray(ds) ? ds.some(d => equal(d, v)) : equal(ds, v))) { found = true; for (let j = 1; j < cl.length - 1; j++) await ev(cl[j], env); next = cl.length > 1 ? cl[cl.length - 1] : null; break; }
              }
              if (!found) return null; x = next; continue;
            }
            case 'when': case 'unless': {
              const t = truthy(await ev(x[1], env)); if (t === (h.name === 'unless') || x.length < 3) return null;
              for (let i = 2; i < x.length - 1; i++) await ev(x[i], env); x = x[x.length - 1]; continue;
            }
            case 'and': { if (x.length === 1) return true; for (let i = 1; i < x.length - 1; i++) { const v = await ev(x[i], env); if (!truthy(v)) return v; } x = x[x.length - 1]; continue; }
            case 'or': { if (x.length === 1) return false; for (let i = 1; i < x.length - 1; i++) { const v = await ev(x[i], env); if (truthy(v)) return v; } x = x[x.length - 1]; continue; }
            case 'while': { while (truthy(await ev(x[1], env))) for (let i = 2; i < x.length; i++) await ev(x[i], env); return null; }
            case 'defmacro': case 'define-macro': {
              let name, ps, body;
              if (h.name === 'defmacro') { name = x[1]; ps = x[2]; body = x.slice(3); } else { name = x[1][0]; ps = x[1].slice(1); body = x.slice(2); }
              if (!(name instanceof Sym)) throw new LispError(`${h.name}: needs a name`);
              const f = lambda(name.name, ps, body, env); const m = new Macro(f.name, f.params, f.rest, f.body, f.env);
              env.def(name, m); return name;
            }
            case 'try': {
              let body = x.slice(1), handler = null, fin = null;
              const last = body[body.length - 1];
              if (Array.isArray(last) && S(last[0], 'finally')) { fin = last.slice(1); body = body.slice(0, -1); }
              const l2 = body[body.length - 1];
              if (Array.isArray(l2) && S(l2[0], 'catch')) { handler = l2; body = body.slice(0, -1); }
              try { return await evalBody(body, env); }
              catch (e) {
                if (!handler || (e instanceof LispError && (e.kind === 'fuel' || e.kind === 'limit'))) throw e;
                const he = new Env(env); he.def(handler[1], e instanceof LispError ? e.value : String(e && e.message || e));
                return await evalBody(handler.slice(2), he);
              } finally { if (fin) await evalBody(fin, env); }
            }
            case 'assert': { const v = await ev(x[1], env); if (truthy(v)) return v; throw new LispError('assertion failed: ' + (x.length > 2 ? show(await ev(x[2], env), false) : show(x[1]))); }
            case 'macroexpand': { let f = await ev(x[1], env); for (let k = 0; k < 100 && Array.isArray(f) && f[0] instanceof Sym && env.get(f[0]) instanceof Macro; k++) f = await expand(env.get(f[0]), f); return f; }
          }
        }
        const f = h instanceof Sym ? lookup(h, env) : await ev(h, env);
        if (f instanceof Macro) { x = await expand(f, x); continue; }
        const args = new Array(x.length - 1);
        for (let i = 1; i < x.length; i++) { const a = x[i]; args[i - 1] = a instanceof Sym ? lookup(a, env) : Array.isArray(a) ? await ev(a, env) : a; }
        if (f instanceof Fn) { env = bind(f, args); const b = f.body; if (!b.length) return null; for (let i = 0; i < b.length - 1; i++) await ev(b[i], env); x = b[b.length - 1]; continue; }
        try { return await apply(f, args); }
        catch (e) {
          if (e instanceof LispError) throw e;
          const nm = h instanceof Sym ? h.name : show(h);
          throw new LispError(`${nm}: ${e && e.message || e}`);
        }
      }
    } catch (e) {
      if (e instanceof LispError && !e.line && Array.isArray(x) && LINES.has(x)) { e.line = LINES.get(x); e.file = st.file; }
      throw e;
    } finally { st.depth--; }
  }
  async function expand(m, form) { const env = bind(m, form.slice(1)); return evalBody(m.body, env); }

  // ---------------------------------------------------------------- builtins
  const def = (name, f) => { f.lispName = name; G.def(sym(name), f); };
  const fold = (name, f, init) => def(name, (...a) => { if (!a.length) return init; let r = num(a[0], name); if (a.length === 1) return f(init, r); for (let i = 1; i < a.length; i++) r = f(r, num(a[i], name)); return r; });
  fold('+', (a, b) => a + b, 0); fold('*', (a, b) => a * b, 1);
  def('-', (...a) => { if (a.length === 1) return -num(a[0], '-'); let r = num(a[0], '-'); for (let i = 1; i < a.length; i++) r -= num(a[i], '-'); return r; });
  def('/', (...a) => { if (a.length === 1) a.unshift(1); let r = num(a[0], '/'); for (let i = 1; i < a.length; i++) { const d = num(a[i], '/'); if (d === 0) throw new LispError('/: division by zero'); r /= d; } return r; });
  const intOp = (n, f) => def(n, (a, b) => { num(a, n); num(b, n); if (b === 0) throw new LispError(`${n}: division by zero`); return f(a, b); });
  intOp('quotient', (a, b) => Math.trunc(a / b)); intOp('remainder', (a, b) => a % b); intOp('modulo', (a, b) => ((a % b) + b) % b); intOp('mod', (a, b) => ((a % b) + b) % b);
  for (const [n, f] of Object.entries({ abs: Math.abs, floor: Math.floor, ceiling: Math.ceil, ceil: Math.ceil, truncate: Math.trunc, sqrt: Math.sqrt, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, tanh: Math.tanh, sign: Math.sign })) def(n, x => f(num(x, n)));
  def('round', (x, d) => d === undefined ? Math.round(num(x, 'round')) : Math.round(x * 10 ** d) / 10 ** d);
  def('expt', (a, b) => num(a, 'expt') ** num(b, 'expt'));
  def('log', (x, b) => b === undefined ? Math.log(x) : Math.log(x) / Math.log(b));
  def('atan', (y, x) => x === undefined ? Math.atan(y) : Math.atan2(y, x));
  def('min', (...a) => Math.min(...a.map(x => num(x, 'min')))); def('max', (...a) => Math.max(...a.map(x => num(x, 'max'))));
  def('inc', x => num(x, 'inc') + 1); def('dec', x => num(x, 'dec') - 1);
  def('random', n => n === undefined ? Math.random() : Number.isInteger(n) ? Math.floor(Math.random() * n) : Math.random() * n);
  def('int', x => Math.trunc(num(x, 'int'))); def('float', x => num(x, 'float'));
  const chain = (n, ok) => def(n, (...a) => { for (let i = 0; i + 1 < a.length; i++) if (!ok(cmp(a[i], a[i + 1]))) return false; return true; });
  chain('<', c => c < 0); chain('>', c => c > 0); chain('<=', c => c <= 0); chain('>=', c => c >= 0);
  def('=', (...a) => a.every((x, i) => i === 0 || equal(a[i - 1], x))); def('==', G.get(sym('=')));
  def('!=', (a, b) => !equal(a, b)); def('not=', (a, b) => !equal(a, b));
  def('compare', (a, b) => Math.sign(cmp(a, b)));
  def('not', x => !truthy(x));
  def('eq?', (a, b) => a === b); def('eqv?', (a, b) => a === b); def('equal?', equal);
  for (const [n, p] of Object.entries({ 'nil?': v => v === null || v === undefined, 'null?': v => v === null || v === undefined || (Array.isArray(v) && !v.length), 'number?': v => typeof v === 'number', 'integer?': v => Number.isInteger(v), 'string?': v => typeof v === 'string', 'symbol?': v => v instanceof Sym, 'keyword?': v => v instanceof Kw, 'list?': Array.isArray, 'pair?': v => Array.isArray(v) && v.length > 0, 'map?': isMap, 'boolean?': v => typeof v === 'boolean', 'fn?': v => v instanceof Fn && !(v instanceof Macro) || typeof v === 'function', 'procedure?': v => v instanceof Fn && !(v instanceof Macro) || typeof v === 'function', 'zero?': v => v === 0, 'positive?': v => v > 0, 'negative?': v => v < 0, 'even?': v => v % 2 === 0, 'odd?': v => Math.abs(v % 2) === 1, 'empty?': v => v === null || (v.length !== undefined ? v.length === 0 : isMap(v) && !Object.keys(v).length) })) def(n, p);
  def('type-of', v => sym(typeOf(v)));
  // lists
  def('list', (...a) => a);
  def('cons', (a, l) => [a, ...seqOf(l, 'cons')]);
  def('car', l => { if (!Array.isArray(l) || !l.length) throw new LispError(`car: expected a non-empty list, got ${show(l)}`); return l[0]; });
  def('cdr', l => { if (!Array.isArray(l) || !l.length) throw new LispError(`cdr: expected a non-empty list, got ${show(l)}`); return l.slice(1); });
  def('first', l => { const s = seqOf(l, 'first'); return s.length ? s[0] : null; });
  def('rest', l => seqOf(l, 'rest').slice(1));
  def('second', l => get(l, 1)); def('third', l => get(l, 2)); def('cadr', l => get(l, 1)); def('caddr', l => get(l, 2)); def('cddr', l => seqOf(l, 'cddr').slice(2)); def('caar', l => get(get(l, 0), 0));
  def('last', l => { const s = seqOf(l, 'last'); return s.length ? s[s.length - 1] : null; });
  def('butlast', l => seqOf(l, 'butlast').slice(0, -1));
  def('length', l => l === null ? 0 : isMap(l) ? Object.keys(l).length : seqOf(l, 'length').length); def('count', G.get(sym('length')));
  def('append', (...ls) => [].concat(...ls.map(l => seqOf(l, 'append'))));
  def('concat', G.get(sym('append')));
  def('reverse', l => [...seqOf(l, 'reverse')].reverse());
  def('nth', (l, i, d) => { const s = seqOf(l, 'nth'); if (i >= 0 && i < s.length) return s[i]; if (d !== undefined) return d; throw new LispError(`nth: index ${i} is past the end of a list of ${s.length}`); });
  def('list-ref', G.get(sym('nth')));
  def('take', (n, l) => seqOf(l, 'take').slice(0, n)); def('drop', (n, l) => seqOf(l, 'drop').slice(n));
  def('slice', (l, a, b) => typeof l === 'string' ? l.slice(a, b === null ? undefined : b) : seqOf(l, 'slice').slice(a, b === null ? undefined : b));
  def('range', (a, b, s = 1) => { if (b === undefined || b === null) { b = a; a = 0; } if (!s) throw new LispError('range: step must not be 0'); const r = []; for (let i = a; s > 0 ? i < b : i > b; i += s) { r.push(i); if (r.length > 1e7) throw new LispError('range: more than 10 million items'); } return r; });
  def('iota', (n, a = 0, s = 1) => Array.from({ length: n }, (_, i) => a + i * s));
  def('repeat', (n, v) => Array.from({ length: n }, () => v));
  def('member', (x, l) => { const s = seqOf(l, 'member'); const i = s.findIndex(e => equal(e, x)); return i < 0 ? false : s.slice(i); });
  def('contains?', (c, x) => isMap(c) ? Object.prototype.hasOwnProperty.call(c, keyName(x)) : typeof c === 'string' ? c.includes(str(x, 'contains?')) : seqOf(c, 'contains?').some(e => equal(e, x)));
  def('index-of', (c, x) => { const i = typeof c === 'string' ? c.indexOf(x) : seqOf(c, 'index-of').findIndex(e => equal(e, x)); return i < 0 ? null : i; });
  def('assoc', (a, ...r) => {
    if (r.length === 1 && Array.isArray(r[0]) && !isMap(a)) { const e = r[0].find(p => Array.isArray(p) && equal(p[0], a)); return e || false; }   // Scheme alist lookup
    if (r.length % 2) throw new LispError('assoc: (assoc map key value ...) needs a value for every key');
    const o = Array.isArray(a) ? [...a] : { ...(a || {}) }; for (let i = 0; i < r.length; i += 2) o[Array.isArray(o) ? r[i] : keyName(r[i])] = r[i + 1]; return o;
  });
  def('flatten', l => seqOf(l, 'flatten').flat(Infinity));
  def('distinct', l => { const out = []; for (const x of seqOf(l, 'distinct')) if (!out.some(y => equal(x, y))) out.push(x); return out; });
  def('sum', l => seqOf(l, 'sum').reduce((a, b) => a + num(b, 'sum'), 0));
  def('product', l => seqOf(l, 'product').reduce((a, b) => a * num(b, 'product'), 1));
  def('zip', (...ls) => { const s = ls.map(l => seqOf(l, 'zip')); const n = Math.min(...s.map(x => x.length)); return Array.from({ length: n }, (_, i) => s.map(x => x[i])); });
  def('apply', (f, ...a) => { const last = a.pop(); return apply(f, [...a, ...seqOf(last, 'apply')]); });
  def('map', async (f, ...ls) => { const s = ls.map(l => seqOf(l, 'map')); const n = Math.min(...s.map(x => x.length)); const out = new Array(n); for (let i = 0; i < n; i++) out[i] = await apply(f, s.map(x => x[i])); return out; });
  def('for-each', async (f, ...ls) => { const s = ls.map(l => seqOf(l, 'for-each')); const n = Math.min(...s.map(x => x.length)); for (let i = 0; i < n; i++) await apply(f, s.map(x => x[i])); return null; });
  def('map-indexed', async (f, l) => { const s = seqOf(l, 'map-indexed'); const out = []; for (let i = 0; i < s.length; i++) out.push(await apply(f, [i, s[i]])); return out; });
  def('filter', async (f, l) => { const out = []; for (const x of seqOf(l, 'filter')) if (truthy(await apply(f, [x]))) out.push(x); return out; });
  def('remove', async (f, l) => { const out = []; for (const x of seqOf(l, 'remove')) if (!truthy(await apply(f, [x]))) out.push(x); return out; });
  def('reduce', async (f, init, l) => { let s, acc; if (l === undefined) { s = seqOf(init, 'reduce'); if (!s.length) return null; acc = s[0]; s = s.slice(1); } else { s = seqOf(l, 'reduce'); acc = init; } for (const x of s) acc = await apply(f, [acc, x]); return acc; });
  def('foldl', async (f, init, l) => { let acc = init; for (const x of seqOf(l, 'foldl')) acc = await apply(f, [x, acc]); return acc; });
  def('find', async (f, l) => { for (const x of seqOf(l, 'find')) if (truthy(await apply(f, [x]))) return x; return null; });
  def('any?', async (f, l) => { for (const x of seqOf(l, 'any?')) if (truthy(await apply(f, [x]))) return true; return false; });
  def('every?', async (f, l) => { for (const x of seqOf(l, 'every?')) if (!truthy(await apply(f, [x]))) return false; return true; });
  def('mapcat', async (f, l) => { const out = []; for (const x of seqOf(l, 'mapcat')) out.push(...seqOf(await apply(f, [x]), 'mapcat')); return out; });
  def('group-by', async (f, l) => { const o = {}; for (const x of seqOf(l, 'group-by')) { const k = keyName(await apply(f, [x])); (o[k] ||= []).push(x); } return o; });
  def('sort', async (l, f) => {   // merge sort, so the comparator may be any Lisp function (and may call Jade)
    const s = [...seqOf(l, 'sort')];
    const less = f === undefined ? async (a, b) => cmp(a, b) < 0 : async (a, b) => truthy(await apply(f, [a, b]));
    const ms = async a => { if (a.length < 2) return a; const m = a.length >> 1; const L = await ms(a.slice(0, m)), R = await ms(a.slice(m)); const o = []; let i = 0, j = 0; while (i < L.length && j < R.length) o.push(await less(R[j], L[i]) ? R[j++] : L[i++]); return o.concat(L.slice(i), R.slice(j)); };
    return ms(s);
  });
  def('sort-by', async (kf, l) => { const s = seqOf(l, 'sort-by'); const ks = []; for (const x of s) ks.push([await apply(kf, [x]), x]); return ks.sort((a, b) => cmp(a[0], b[0])).map(p => p[1]); });
  // strings
  def('str', (...a) => a.map(x => show(x, false)).join(''));
  def('string-append', (...a) => a.map(x => str(x, 'string-append')).join(''));
  def('string-length', s => str(s, 'string-length').length);
  def('substring', (s, a, b) => str(s, 'substring').slice(a, b === undefined || b === null ? undefined : b));
  def('string-upcase', s => str(s, 'string-upcase').toUpperCase()); def('string-downcase', s => str(s, 'string-downcase').toLowerCase());
  def('string-trim', s => str(s, 'string-trim').trim());
  def('string-split', (s, sep) => sep === undefined ? str(s, 'string-split').split(/\s+/).filter(Boolean) : str(s, 'string-split').split(sep instanceof RegExp ? sep : str(sep, 'string-split')));
  def('string-join', (l, sep = '') => seqOf(l, 'string-join').map(x => show(x, false)).join(sep));
  def('string-contains?', (s, t) => str(s, 'string-contains?').includes(str(t, 'string-contains?')));
  def('string-starts-with?', (s, t) => str(s, 'string-starts-with?').startsWith(t)); def('string-ends-with?', (s, t) => str(s, 'string-ends-with?').endsWith(t));
  def('string-replace', (s, a, b) => str(s, 'string-replace').split(str(a, 'string-replace')).join(str(b, 'string-replace')));
  def('string-pad-left', (s, n, c = ' ') => show(s, false).padStart(n, c)); def('string-pad-right', (s, n, c = ' ') => show(s, false).padEnd(n, c));
  def('string=?', (...a) => a.every(x => str(x, 'string=?') === str(a[0], 'string=?')));
  def('string<?', (a, b) => str(a, 'string<?') < str(b, 'string<?'));
  def('string->number', s => { const v = atom(String(s).trim()); return typeof v === 'number' ? v : false; });
  def('number->string', (n, r) => num(n, 'number->string').toString(r || 10));
  def('string->symbol', s => sym(str(s, 'string->symbol'))); def('symbol', G.get(sym('string->symbol')));
  def('symbol->string', s => str(s, 'symbol->string')); def('name', s => str(s, 'name'));
  def('keyword', s => kw(str(s, 'keyword').replace(/^:/, '')));
  def('string->list', s => [...str(s, 'string->list')]); def('list->string', l => seqOf(l, 'list->string').map(x => show(x, false)).join(''));
  def('format', (f, ...a) => { let i = 0; return str(f, 'format').replace(/~([asdn%~])/gi, (_, d) => { d = d.toLowerCase(); if (d === '%' || d === 'n') return '\n'; if (d === '~') return '~'; if (i >= a.length) throw new LispError('format: more directives than arguments'); return show(a[i++], d === 's'); }); });
  def('regex-match', (re, s) => { const m = String(s).match(new RegExp(str(re, 'regex-match'))); return m ? [...m].map(x => x === undefined ? null : x) : null; });
  def('regex-match-all', (re, s) => [...String(s).matchAll(new RegExp(str(re, 'regex-match-all'), 'g'))].map(m => [...m].map(x => x === undefined ? null : x)));
  def('regex-replace', (re, s, r) => String(s).replace(new RegExp(str(re, 'regex-replace'), 'g'), r));
  def('regex-test', (re, s) => new RegExp(str(re, 'regex-test')).test(String(s)));
  // maps
  def('hash-map', (...a) => { if (a.length % 2) throw new LispError('hash-map: needs key value pairs'); const o = {}; for (let i = 0; i < a.length; i += 2) o[keyName(a[i])] = a[i + 1]; return o; });
  def('get', (m, k, d = null) => get(m, k, d));
  def('get-in', (m, ks, d = null) => { let c = m; for (const k of seqOf(ks, 'get-in')) { c = get(c, k, undefined); if (c === undefined) return d; } return c; });
  def('assoc-in', (m, ks, v) => { const path = seqOf(ks, 'assoc-in'); const go = (o, i) => { if (i === path.length) return v; const k = keyName(path[i]); const base = isMap(o) ? o : {}; return { ...base, [k]: go(base[k], i + 1) }; }; return go(m, 0); });
  def('dissoc', (m, ...ks) => { const o = { ...(m || {}) }; for (const k of ks) delete o[keyName(k)]; return o; });
  def('keys', m => Object.keys(m || {}).map(kw)); def('vals', m => Object.values(m || {}));
  def('entries', m => Object.entries(m || {}).map(([k, v]) => [kw(k), v]));
  def('has-key?', (m, k) => !!m && Object.prototype.hasOwnProperty.call(m, keyName(k)));
  def('merge', (...ms) => Object.assign({}, ...ms.filter(Boolean)));
  def('zipmap', (ks, vs) => { const o = {}; const a = seqOf(ks, 'zipmap'), b = seqOf(vs, 'zipmap'); a.forEach((k, i) => { if (i < b.length) o[keyName(k)] = b[i]; }); return o; });
  def('update', async (m, k, f, ...a) => ({ ...(m || {}), [keyName(k)]: await apply(f, [get(m, k), ...a]) }));
  // output
  def('display', (...a) => { emit(a.map(x => show(x, false)).join('')); return null; });
  def('write', x => { emit(show(x, true)); return null; });
  def('newline', () => { emit('\n'); return null; });
  def('print', (...a) => { emit(a.map(x => show(x, false)).join(' ') + '\n'); return null; }); def('println', G.get(sym('print')));
  def('printf', (f, ...a) => { emit(G.get(sym('format'))(f, ...a)); return null; });
  def('pr-str', (...a) => a.map(x => show(x, true)).join(' '));
  // code, errors, JSON
  def('error', (...a) => { throw new LispError(a.map((x, i) => i === 0 && typeof x === 'string' ? x : show(x, true)).join(' ')); });
  def('raise', v => { throw new LispError(typeof v === 'string' ? v : show(v), v); }); def('throw', G.get(sym('raise')));
  def('gensym', (p = 'g') => sym(`${keyName(p)}__${++st.gensym}`));
  def('eval', (form, env) => ev(form, env instanceof Env ? env : G));
  def('read-string', s => { const f = read(str(s, 'read-string')); return f.length ? f[0] : null; });
  def('read-all', s => read(str(s, 'read-all')));
  def('identity', x => x);
  def('steps', () => st.steps);
  def('defined?', s => G.has(s instanceof Sym ? s : sym(str(s, 'defined?'))));
  def('json-parse', s => JSON.parse(str(s, 'json-parse')));
  def('json-string', (v, pretty) => JSON.stringify(toJS(v), null, truthy(pretty) ? 2 : undefined));
  def('now', () => Date.now());
  // sandboxes: a fresh environment with only the names you list (special forms always work), for running
  // DSL programs you did not write. (sandbox :pure) gives every builtin except Jade, files and JavaScript.
  def('sandbox', (...names) => {
    const e = new Env();
    for (const n of names.flatMap(x => Array.isArray(x) ? x : [x])) {
      if (n instanceof Kw && n.name === 'pure') { for (const [k, v] of G.v) if (!UNSAFE.test(k.name)) e.def(k, v); continue; }
      if (isMap(n)) { for (const [k, v] of Object.entries(n)) e.def(sym(k), v); continue; }
      const s = n instanceof Sym ? n : sym(str(n, 'sandbox')); const v = G.get(s); if (v === undefined) throw new LispError(`sandbox: ${s.name} is not defined`); e.def(s, v);
    }
    return e;
  });
  def('env-define', (e, n, v) => { if (!(e instanceof Env)) throw new LispError('env-define: expected an env'); e.def(n instanceof Sym ? n : sym(str(n, 'env-define')), v); return e; });
  def('eval-in', async (e, form, o) => {
    if (!(e instanceof Env)) throw new LispError('eval-in: expected an env from (sandbox ...)');
    const fuel = o && get(o, 'fuel'); const saved = st.fuel;
    if (fuel) st.fuel = Math.min(saved, st.steps + fuel);
    try { const forms = typeof form === 'string' ? read(form) : [form]; let r = null; for (const f of forms) r = await ev(f, e); return r; }
    catch (err) { if (err.kind === 'fuel' && st.fuel !== saved) throw new LispError(`out of fuel: the sandboxed program used more than ${fuel} steps`); throw err; }
    finally { st.fuel = saved; }
  });

  // ---------------------------------------------------------------- Jade, files, JavaScript (left out with pure)
  if (!opts.pure) {
    const need = (op) => { if (!J) throw new LispError(`${op}: Jade is not reachable here (run this inside the vault with node)`); return J; };
    const unwrap = v => v;   // tool results come back as Jade gives them (usually text); json-parse what is JSON
    const jsonish = v => { if (typeof v === 'string' && /^\s*[{[]/.test(v)) { try { return JSON.parse(v); } catch {} } return v; };
    def('jade/tool', async (name, ...a) => unwrap(await need('jade/tool').tool(str(name, 'jade/tool'), kwargs(a))));
    def('jade/tools', async () => need('jade/tools').list());
    def('jade/ask', async (prompt, ...a) => need('jade/ask').ask(str(prompt, 'jade/ask'), kwargs(a)));
    def('jade/decide', async (...a) => need('jade/decide').decide(kwargs(a)));
    def('jade/agent', async (msg, ...a) => need('jade/agent').agent(str(msg, 'jade/agent'), kwargs(a)));
    def('jade/flow', async (name, input = null) => need('jade/flow').flow(str(name, 'jade/flow'), toJS(input)));
    def('jade/flows', async () => need('jade/flows').flows());
    def('jade/shell', async (cmd) => need('jade/shell').shell(str(cmd, 'jade/shell')));
    def('jade/notify', async (t, b = '') => need('jade/notify').notify(show(t, false), show(b, false)));
    def('jade/search', async (q, limit) => need('jade/search').search(str(q, 'jade/search'), limit));
    def('jade/kv-get', async k => need('jade/kv-get').kv.get(keyName(k)));
    def('jade/kv-set', async (k, v) => need('jade/kv-set').kv.set(keyName(k), toJS(v)));
    def('jade/sleep', ms => new Promise(r => setTimeout(r, Math.max(0, +ms || 0))));
    // LiteRT (.tflite) and ONNX: thin wrappers over the litert and onnx tools
    def('tflite/load', async (model, ...a) => jsonish(await need('tflite/load').tool('litert', { action: 'load', model: str(model, 'tflite/load'), ...kwargs(a) })));
    def('tflite/run', async (id, inputs, ...a) => jsonish(await need('tflite/run').tool('litert', { action: 'run', id: str(id, 'tflite/run'), inputs: toJS(inputs), ...kwargs(a) })));
    def('tflite/info', async (id) => jsonish(await need('tflite/info').tool('litert', { action: 'info', ...(id ? { id: str(id, 'tflite/info') } : {}) })));
    def('tflite/unload', async (id) => need('tflite/unload').tool('litert', { action: 'unload', id: str(id, 'tflite/unload') }));
    def('onnx/run', async (...a) => jsonish(await need('onnx/run').tool('onnx', kwargs(a))));
    // files
    def('read-file', p => fs.readFileSync(str(p, 'read-file'), 'utf8'));
    def('file-exists?', p => fs.existsSync(str(p, 'file-exists?')));
    def('list-dir', p => fs.readdirSync(str(p, 'list-dir')));
    def('write-file', async (p, content) => { const path = str(p, 'write-file'), c = typeof content === 'string' ? content : show(content, false); if (J) await J.tool('write', { path, content: c }); else fs.writeFileSync(path, c); return path; });
    def('load', async (p) => {
      let path = str(p, 'load'); const dir = st.file ? st.file.replace(/\/[^/]*$/, '') || '/' : '/Jade/Lisp';
      const cands = path.startsWith('/') ? [path, path + '.jl'] : [dir + '/' + path, dir + '/' + path + '.jl', dir.replace(/\/[^/]*$/, '') + '/lib/' + path + '.jl', '/Jade/Lisp/lib/' + path, '/Jade/Lisp/lib/' + path + '.jl'];
      const hit = cands.find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } });
      if (!hit) throw new LispError(`load: ${path} not found (looked in ${cands.join(', ')})`);
      const saved = st.file; st.file = hit;
      try { let r = null; for (const f of read(fs.readFileSync(hit, 'utf8'), hit)) r = await ev(f, G); return r; } finally { st.file = saved; }
    });
    // JavaScript, for anything not covered above
    def('js/eval', async (code) => { const r = await (new Function('jade', 'require', 'return (async () => (' + str(code, 'js/eval') + '))()'))(J, typeof require !== 'undefined' ? require : null); return r === undefined ? null : r; });
    def('js/get', (o, ...ks) => { let c = o; for (const k of ks) { if (c === null || c === undefined) return null; c = c[keyName(k)]; } return c === undefined ? null : c; });
    def('js/call', async (o, m, ...a) => { const f = o && o[keyName(m)]; if (typeof f !== 'function') throw new LispError(`js/call: ${keyName(m)} is not a method`); const r = await f.apply(o, a.map(x => x instanceof Fn ? (...y) => apply(x, y) : x)); return r === undefined ? null : r; });
    def('js/fn', f => (...a) => apply(f, a));   // a Lisp function as a JavaScript function
    def('->js', toJS);
  }
  const UNSAFE = /^(jade\/|tflite\/|onnx\/|js\/|->js$|read-file$|write-file$|file-exists\?$|list-dir$|load$|eval$|sandbox$|eval-in$|env-define$|display$|print$|println$|printf$|write$|newline$)/;

  // the prelude: macros written in Lisp
  const PRELUDE = `
(defmacro defn (name params . body) \`(define ,name (lambda ,params ,@body)))
(defmacro -> (x . forms) (if (null? forms) x (let ((f (car forms))) \`(-> ,(if (list? f) \`(,(car f) ,x ,@(cdr f)) \`(,f ,x)) ,@(cdr forms)))))
(defmacro ->> (x . forms) (if (null? forms) x (let ((f (car forms))) \`(->> ,(if (list? f) \`(,@f ,x) \`(,f ,x)) ,@(cdr forms)))))
(defmacro dolist (spec . body) \`(for-each (lambda (,(car spec)) ,@body) ,(cadr spec)))
(defmacro dotimes (spec . body) (let ((n (gensym "n"))) \`(let ((,n ,(cadr spec))) (let loop ((,(car spec) 0)) (when (< ,(car spec) ,n) ,@body (loop (+ ,(car spec) 1)))))))
(defmacro if-let (b then . else) \`(let ((,(car b) ,(cadr b))) (if ,(car b) ,then ,@else)))
(defmacro when-let (b . body) \`(let ((,(car b) ,(cadr b))) (when ,(car b) ,@body)))
(defmacro inc! (v . n) \`(set! ,v (+ ,v ,(if (null? n) 1 (car n)))))
(defmacro push! (v x) \`(set! ,v (append ,v (list ,x))))
(define (compose . fs) (if (null? fs) identity (let ((f (car fs)) (g (apply compose (cdr fs)))) (lambda args (f (apply g args))))))
(define (partial f . a) (lambda b (apply f (append a b))))
(define (complement f) (lambda args (not (apply f args))))
(define (constantly v) (lambda args v))
`;
  const ready = (async () => { for (const f of read(PRELUDE)) await ev(f, G); })();
  if (opts.globals) for (const [k, v] of Object.entries(opts.globals)) G.def(sym(k), v);

  const api = {
    env: G, version: VERSION,
    async run(code, file) { await ready; const saved = st.file; if (file) st.file = file; try { let r = null; for (const f of read(String(code), file || '')) r = await ev(f, G); return r; } finally { st.file = saved; } },
    async call(name, ...args) { await ready; return apply(G.get(sym(name)), args); },
    define(name, v) { G.def(sym(name), typeof v === 'function' && !(v instanceof Fn) ? Object.assign(v, { lispName: name }) : v); },
    output() { return st.out.join(''); },
    clearOutput() { st.out.length = 0; },
    steps() { return st.steps; },
    setFuel(n) { st.fuel = st.steps + n; },
    show, toJS,
  };
  return api;
}

function errText(e) {
  if (e instanceof LispError) return e.message + (e.line ? ` (${e.file ? e.file + ':' : 'line '}${e.line})` : '');
  return String(e && e.stack || e);
}

const HELP = `Jade Lisp ${VERSION}: a small Lisp for DSLs, with all of Jade's tools.

  node /Jade/tools/lisp.js FILE.jl [args...]   run a file; args are in *args*
  node /Jade/tools/lisp.js eval '(+ 1 2)'      evaluate code and print the result (not -e: node takes that)
  node /Jade/tools/lisp.js check FILE.jl       syntax check only
  node /Jade/tools/lisp.js builtins            list every builtin and macro
  options: fuel=N  pure=yes (no Jade, files or JS)  quiet=yes  print=yes (print a file's last value)

Language: (define x 1) (define (f a b) ...) (lambda (x) ...) (let ((a 1)) ...) named let, let*, if, cond, case,
when, unless, and, or, while, begin, set!, quote ' quasiquote \` , ,@  defmacro, try/catch/finally, assert.
Data: numbers, "strings", symbols, :keywords, lists (list 1 2) or [1 2], maps {:a 1}, nil, #t/#f.
Jade: (tool/NAME :arg value ...)  (jade/tool "name" {:arg v})  jade/ask jade/decide jade/agent jade/flow
jade/shell jade/notify jade/search jade/kv-get jade/kv-set; tflite/load tflite/run tflite/info; read-file,
write-file, list-dir, load; js/eval js/get js/call for anything else.
DSLs: defmacro, (sandbox :pure) or (sandbox '(+ - list)) and (eval-in env form {:fuel 10000}).
Guide: /Jade/skills/lisp-dsl/SKILL.md   Examples: /Jade/Lisp/examples`;

async function main() {
  const argv = (typeof process !== 'undefined' ? process.argv : []).slice(2);
  const flags = {}; const pos = [];
  for (const a of argv) { const m = /^--(fuel|pure|quiet|print)(?:=(.*))?$/.exec(a) || (!pos.length || pos[0] !== '-e' && pos[0] !== 'eval' || pos.length >= 2 ? /^(fuel|pure|quiet|print)=(.*)$/.exec(a) : null); if (m) flags[m[1]] = m[2] === undefined ? true : /^(0|no|false)$/i.test(m[2]) ? false : m[2]; else pos.push(a); }
  const cmd = pos[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(HELP); return; }
  const lisp = create({ fuel: flags.fuel ? +flags.fuel : undefined, pure: !!flags.pure });
  try {
    if (cmd === 'builtins') { await lisp.run('nil'); const names = [...lisp.env.v.keys()].map(s => s.name).sort(); console.log(names.join('  ')); return; }
    if (cmd === 'check') { const p = pos[1]; if (!p) throw new LispError('check needs a file'); const forms = read(fs.readFileSync(p, 'utf8'), p); console.log(`${p}: ${forms.length} form${forms.length === 1 ? '' : 's'}, no syntax errors`); return; }
    if (cmd === '-e' || cmd === 'eval') {
      const code = pos[1]; if (code === undefined) throw new LispError('eval needs code, like: eval \'(+ 1 2)\'');
      lisp.define('*args*', pos.slice(2));
      const v = await lisp.run(code);
      if (!flags.quiet && v !== null && v !== undefined) { const o = lisp.output(); if (o && !o.endsWith('\n')) process.stdout.write('\n'); console.log(show(v, true)); }
      return;
    }
    const file = cmd === 'run' ? pos[1] : cmd; const args = cmd === 'run' ? pos.slice(2) : pos.slice(1);
    if (!file) throw new LispError('run needs a file');
    if (!fs.existsSync(file)) throw new LispError(`${file} not found`);
    lisp.define('*args*', args); lisp.define('*file*', file);
    const v = await lisp.run(fs.readFileSync(file, 'utf8'), file);
    if (flags.print && v !== null && v !== undefined) console.log(show(v, true));
  } catch (e) {
    const o = lisp.output(); if (o && !o.endsWith('\n')) process.stdout.write('\n');
    console.error('lisp error: ' + errText(e));
    process.exitCode = 1;
  }
}

module.exports = { create, read, show, toJS, sym, kw, Sym, Kw, Fn, Env, LispError, errText, VERSION };
const isMain = (typeof require !== 'undefined' && require.main === module) || (typeof process !== 'undefined' && typeof __filename !== 'undefined' && process.argv && process.argv[1] === __filename);
if (isMain) main();
