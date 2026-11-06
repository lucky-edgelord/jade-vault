//! Jade's knowledge graph: a small Datalog reasoner that explains itself.
//!
//! One engine for every variant: built to WebAssembly (`wasm32-unknown-unknown`) and loaded by the Jade Vault page,
//! the phone app, the Fleet client and jade-py (through wasmtime). The interface is JSON in, JSON out ([`call`]),
//! exported to the host as `kg_alloc`, `kg_free`, `kg_call` and `kg_out_len`. The shared cases in
//! `tests/kg_cases.json` pin down its behaviour.
//!
//! Language (one statement per `.`; `%` or `#` starts a comment):
//! ```text
//! works_at(alice, acme).                                   a fact: lowercase words, "quoted text" or numbers
//! chain(X, Z) :- reports_to(X, Y), chain(Y, Z).            a rule: variables start uppercase or with _
//! ! one_employer: works_at(P, A), works_at(P, B), A != B.  a constraint: every match is a violation
//! ```
//! Body literals: an atom, `not atom`, or a comparison `= != < <= > >=` (numbers by value, text by code point,
//! a number and a text are never equal or ordered). Negation must be stratified, and every variable in a head, under
//! `not` or in a comparison must be bound by a positive atom first (or by `=` with a bound side).
//!
//! Answers carry proofs. A claim is *proven* (with the facts and rules it rests on), *contradicted* (`not p` while
//! `p` holds, or adding it would break a constraint) or *unknown*: the graph is open-world, missing is not false.

use serde_json::{json, Map, Value as J};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

/// FxHash (as in rustc): much faster than the default SipHash for the small integer keys used here. The graph is the
/// user's own data, so hash flooding is not a concern.
#[derive(Default, Clone, Copy)]
struct Fx(u64);
impl std::hash::Hasher for Fx {
    fn finish(&self) -> u64 { self.0 }
    fn write(&mut self, bytes: &[u8]) { for b in bytes { self.add(*b as u64); } }
    fn write_u8(&mut self, n: u8) { self.add(n as u64) }
    fn write_u32(&mut self, n: u32) { self.add(n as u64) }
    fn write_u64(&mut self, n: u64) { self.add(n) }
    fn write_usize(&mut self, n: usize) { self.add(n as u64) }
}
impl Fx { #[inline] fn add(&mut self, w: u64) { self.0 = (self.0.rotate_left(5) ^ w).wrapping_mul(0x51_7c_c1_b7_27_22_0a_95); } }
type FxB = std::hash::BuildHasherDefault<Fx>;
type FMap<K, V> = HashMap<K, V, FxB>;
type FSet<K> = HashSet<K, FxB>;

pub const MAX_FACTS: usize = 2_000_000;
const MAX_ROUNDS: usize = 1_000_000;
const MAX_PROOF_NODES: usize = 400;
const MAX_ANSWERS: usize = 200;

/* ============================== values ============================== */

#[derive(Clone, Debug)]
pub enum Val { Num(f64), Str(Rc<str>) }

#[derive(Clone, PartialEq, Eq, Hash)]
enum VKey { N(u64), S(Rc<str>) }

fn vkey(v: &Val) -> VKey {
    match v { Val::Num(n) => VKey::N(if *n == 0.0 { 0f64.to_bits() } else { n.to_bits() }), Val::Str(s) => VKey::S(s.clone()) }
}

#[derive(Default, Clone)]
struct Interner { vals: Vec<Val>, ids: HashMap<VKey, u32> }
impl Interner {
    fn id(&mut self, v: &Val) -> u32 {
        let k = vkey(v);
        if let Some(&i) = self.ids.get(&k) { return i; }
        let i = self.vals.len() as u32; self.vals.push(v.clone()); self.ids.insert(k, i); i
    }
    fn get(&self, v: &Val) -> Option<u32> { self.ids.get(&vkey(v)).copied() }
}

fn is_ident(s: &str) -> bool {
    let mut c = s.chars();
    matches!(c.next(), Some(ch) if ch.is_ascii_lowercase()) && c.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}
pub fn fmt_num(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e21 { format!("{}", n as i128) } else { format!("{}", n) }
}
pub fn fmt_val(v: &Val) -> String {
    match v {
        Val::Num(n) => fmt_num(*n),
        Val::Str(s) if is_ident(s) && &**s != "not" => s.to_string(),
        Val::Str(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n")),
    }
}
fn val_json(v: &Val) -> J {
    match v {
        Val::Num(n) if n.fract() == 0.0 && n.abs() < 9.0e15 => json!(*n as i64),
        Val::Num(n) => json!(n),
        Val::Str(s) => json!(&**s),
    }
}
fn cmp_vals(op: &str, a: &Val, b: &Val) -> bool {
    use std::cmp::Ordering;
    let same = match (a, b) { (Val::Num(x), Val::Num(y)) => x == y, (Val::Str(x), Val::Str(y)) => x == y, _ => false };
    match op {
        "=" => same,
        "!=" => !same,
        _ => {
            let o = match (a, b) {
                (Val::Num(x), Val::Num(y)) => x.partial_cmp(y),
                (Val::Str(x), Val::Str(y)) => Some(x.as_bytes().cmp(y.as_bytes())), // UTF-8 byte order = code point order
                _ => None,
            };
            match (o, op) {
                (Some(o), "<") => o == Ordering::Less,
                (Some(o), "<=") => o != Ordering::Greater,
                (Some(o), ">") => o == Ordering::Greater,
                (Some(o), ">=") => o != Ordering::Less,
                _ => false,
            }
        }
    }
}

/* ============================== errors ============================== */

#[derive(Debug, Clone)]
pub struct KgError { pub code: &'static str, pub msg: String }
fn err<T>(code: &'static str, msg: impl Into<String>) -> Result<T, KgError> { Err(KgError { code, msg: msg.into() }) }
type R<T> = Result<T, KgError>;

/* ============================== parsing ============================== */

#[derive(Clone, Debug, PartialEq)]
enum Tok { Id(String), Str(String), Num(f64), P(&'static str), Eof }
#[derive(Clone, Debug)]
struct T { t: Tok, line: usize }

fn tokenize(src: &str) -> R<Vec<T>> {
    let c: Vec<char> = src.chars().collect();
    let (mut i, mut line, n) = (0usize, 1usize, c.len());
    let mut out = Vec::new();
    while i < n {
        let ch = c[i];
        if ch == '\n' { line += 1; i += 1; continue; }
        if ch == ' ' || ch == '\t' || ch == '\r' { i += 1; continue; }
        if ch == '%' || ch == '#' { while i < n && c[i] != '\n' { i += 1; } continue; }
        if ch == '"' {
            let mut s = String::new(); i += 1; let start = line;
            loop {
                if i >= n { return err("parse", format!("line {}: text in quotes is not closed", start)); }
                let d = c[i];
                if d == '"' { i += 1; break; }
                if d == '\\' && i + 1 < n { let e = c[i + 1]; s.push(match e { 'n' => '\n', 't' => '\t', o => o }); i += 2; continue; }
                if d == '\n' { line += 1; }
                s.push(d); i += 1;
            }
            out.push(T { t: Tok::Str(s), line }); continue;
        }
        let digit_at = |k: usize| k < n && c[k].is_ascii_digit();
        if ch.is_ascii_digit() || (ch == '-' && digit_at(i + 1)) {
            let st = i; i += 1;
            while digit_at(i) { i += 1; }
            if i + 1 < n && c[i] == '.' && digit_at(i + 1) { i += 1; while digit_at(i) { i += 1; } }
            let s: String = c[st..i].iter().collect();
            out.push(T { t: Tok::Num(s.parse().unwrap_or(0.0)), line }); continue;
        }
        if ch.is_ascii_alphabetic() || ch == '_' {
            let st = i; while i < n && (c[i].is_ascii_alphanumeric() || c[i] == '_') { i += 1; }
            out.push(T { t: Tok::Id(c[st..i].iter().collect()), line }); continue;
        }
        let two: String = c[i..(i + 2).min(n)].iter().collect();
        if let Some(p) = [":-", "!=", "<=", ">="].iter().find(|p| **p == two) { out.push(T { t: Tok::P(p), line }); i += 2; continue; }
        if let Some(p) = ["(", ")", ",", ".", ":", "!", "=", "<", ">", "?"].iter().find(|p| p.starts_with(ch)) { out.push(T { t: Tok::P(p), line }); i += 1; continue; }
        return err("parse", format!("line {}: unexpected \"{}\"", line, ch));
    }
    out.push(T { t: Tok::Eof, line }); Ok(out)
}

#[derive(Clone, Debug)]
enum PTerm { Var(String), Const(Val) }
#[derive(Clone, Debug)]
struct PAtom { p: String, args: Vec<PTerm> }
#[derive(Clone, Debug)]
enum PLit { Pos(PAtom), Neg(PAtom), Cmp(&'static str, PTerm, PTerm) }

const OPS: [&str; 6] = ["=", "!=", "<", "<=", ">", ">="];
fn is_var(s: &str) -> bool { s.starts_with(|c: char| c.is_ascii_uppercase() || c == '_') }
fn fmt_pterm(t: &PTerm) -> String { match t { PTerm::Var(v) => v.clone(), PTerm::Const(c) => fmt_val(c) } }
fn fmt_patom(a: &PAtom) -> String { if a.args.is_empty() { a.p.clone() } else { format!("{}({})", a.p, a.args.iter().map(fmt_pterm).collect::<Vec<_>>().join(", ")) } }
fn fmt_plit(l: &PLit) -> String {
    match l { PLit::Pos(a) => fmt_patom(a), PLit::Neg(a) => format!("not {}", fmt_patom(a)), PLit::Cmp(op, l, r) => format!("{} {} {}", fmt_pterm(l), op, fmt_pterm(r)) }
}
fn plit_vars(l: &PLit) -> Vec<String> {
    let tv = |t: &PTerm| if let PTerm::Var(v) = t { vec![v.clone()] } else { vec![] };
    match l { PLit::Pos(a) | PLit::Neg(a) => a.args.iter().flat_map(tv).collect(), PLit::Cmp(_, l, r) => [tv(l), tv(r)].concat() }
}

struct Parser { toks: Vec<T>, p: usize, anon: usize }
impl Parser {
    fn new(src: &str) -> R<Parser> { Ok(Parser { toks: tokenize(src)?, p: 0, anon: 0 }) }
    fn peek(&self, k: usize) -> &T { &self.toks[(self.p + k).min(self.toks.len() - 1)] }
    fn next(&mut self) -> T { let t = self.peek(0).clone(); self.p += 1; t }
    fn fail<X>(&self, line: usize, msg: impl Into<String>) -> R<X> { err("parse", format!("line {}: {}", line, msg.into())) }
    fn show(t: &Tok) -> String { match t { Tok::Eof => "the end".into(), Tok::Id(s) => format!("\"{}\"", s), Tok::Str(s) => format!("\"{}\"", s), Tok::Num(n) => fmt_num(*n), Tok::P(p) => format!("\"{}\"", p) } }
    fn is_p(&self, k: usize, p: &str) -> bool { matches!(&self.peek(k).t, Tok::P(q) if *q == p) }
    fn expect(&mut self, p: &str) -> R<()> {
        if self.is_p(0, p) { self.p += 1; return Ok(()); }
        let t = self.peek(0).clone(); self.fail(t.line, format!("expected \"{}\" but found {}", p, Self::show(&t.t)))
    }
    fn eof(&self) -> bool { self.peek(0).t == Tok::Eof }
    fn term(&mut self) -> R<PTerm> {
        let t = self.next();
        match t.t {
            Tok::Str(s) => Ok(PTerm::Const(Val::Str(s.into()))),
            Tok::Num(n) => Ok(PTerm::Const(Val::Num(n))),
            Tok::Id(s) if is_var(&s) => { if s == "_" { self.anon += 1; Ok(PTerm::Var(format!("_{}", self.anon))) } else { Ok(PTerm::Var(s)) } }
            Tok::Id(s) => Ok(PTerm::Const(Val::Str(s.into()))),
            _ => self.fail(t.line, "expected a value or a variable"),
        }
    }
    fn atom(&mut self) -> R<PAtom> {
        let t = self.next();
        let p = match t.t { Tok::Id(s) if !is_var(&s) && s != "not" => s, _ => return self.fail(t.line, "expected a predicate name (lowercase)") };
        let mut args = Vec::new();
        if self.is_p(0, "(") {
            self.p += 1;
            if !self.is_p(0, ")") { args.push(self.term()?); while self.is_p(0, ",") { self.p += 1; args.push(self.term()?); } }
            self.expect(")")?;
        }
        Ok(PAtom { p, args })
    }
    fn literal(&mut self) -> R<PLit> {
        let is_op = |t: &Tok| matches!(t, Tok::P(p) if OPS.contains(p));
        if let Tok::Id(s) = &self.peek(0).t {
            if s == "not" && matches!(self.peek(1).t, Tok::Id(_)) { self.p += 1; return Ok(PLit::Neg(self.atom()?)); }
            if !is_var(s) && !is_op(&self.peek(1).t) { return Ok(PLit::Pos(self.atom()?)); }
        }
        let l = self.term()?;
        let op = self.next();
        let op = match op.t { Tok::P(p) if OPS.contains(&p) => p, _ => return self.fail(op.line, "expected a comparison (= != < <= > >=)") };
        Ok(PLit::Cmp(op, l, self.term()?))
    }
    fn body(&mut self) -> R<Vec<PLit>> { let mut b = vec![self.literal()?]; while self.is_p(0, ",") { self.p += 1; b.push(self.literal()?); } Ok(b) }
}

struct PRule { head: PAtom, body: Vec<PLit>, line: usize }
struct PConstraint { name: String, body: Vec<PLit> }
struct Program { facts: Vec<(PAtom, usize)>, rules: Vec<PRule>, constraints: Vec<PConstraint> }

fn parse_program(src: &str) -> R<Program> {
    let mut ps = Parser::new(src)?;
    let mut prog = Program { facts: vec![], rules: vec![], constraints: vec![] };
    while !ps.eof() {
        let line = ps.peek(0).line;
        if ps.is_p(0, "!") {
            ps.p += 1;
            let mut name = String::new();
            if ps.is_p(1, ":") { if let Tok::Id(s) | Tok::Str(s) = &ps.peek(0).t { name = s.clone(); ps.p += 2; } }
            let body = ps.body()?; ps.expect(".")?;
            if name.is_empty() { name = format!("constraint_{}", prog.constraints.len() + 1); }
            prog.constraints.push(PConstraint { name, body }); continue;
        }
        let head = ps.atom()?;
        if ps.is_p(0, ":-") { ps.p += 1; let body = ps.body()?; ps.expect(".")?; prog.rules.push(PRule { head, body, line }); continue; }
        ps.expect(".")?;
        if head.args.iter().any(|t| matches!(t, PTerm::Var(_))) {
            return ps.fail(line, format!("a fact cannot have variables: {} (did you mean a rule with \":-\"?)", fmt_patom(&head)));
        }
        prog.facts.push((head, line));
    }
    Ok(prog)
}
fn parse_fact(text: &str) -> R<PAtom> {
    let t = text.trim(); let t = t.strip_suffix('.').unwrap_or(t);
    let mut ps = Parser::new(&format!("{} .", t))?;
    let a = ps.atom()?; ps.expect(".")?;
    if !ps.eof() { return ps.fail(1, "one fact at a time"); }
    if a.args.iter().any(|t| matches!(t, PTerm::Var(_))) { return err("parse", format!("a fact cannot have variables: {}", fmt_patom(&a))); }
    Ok(a)
}
fn parse_query(text: &str) -> R<Vec<PLit>> {
    let t = text.trim(); let t = t.strip_prefix('?').unwrap_or(t).trim(); let t = t.strip_suffix('.').unwrap_or(t);
    let mut ps = Parser::new(&format!("{} .", t))?;
    let b = ps.body()?; ps.expect(".")?;
    if !ps.eof() { return ps.fail(1, "a query is one list of conditions"); }
    Ok(b)
}

/* ============================== compiled program ============================== */

#[derive(Clone, Copy, Debug)]
enum Term { Var(usize), Const(u32) }
#[derive(Clone, Debug)]
struct Atom { pred: usize, args: Vec<Term> }
#[derive(Clone, Debug)]
enum Lit { Pos(Atom), Neg(Atom), Cmp(&'static str, Term, Term) }
#[derive(Clone, Debug)]
struct Clause { body: Vec<Lit>, order: Vec<usize>, vars: Vec<String> }
#[derive(Clone)]
struct Rule { head: Atom, clause: Clause, line: usize, text: String }
#[derive(Clone)]
struct Constraint { name: String, clause: Clause, text: String }

#[derive(Clone)]
pub struct BaseFact { pub id: String, pred: usize, args: Box<[u32]>, pub status: String, pub by: String, pub source: String }

/// Order body literals so a comparison or negation runs once its variables are bound.
fn plan(body: &[PLit], what: &str, pre: &HashSet<String>) -> R<(Vec<usize>, HashSet<String>)> {
    let mut bound = pre.clone();
    let mut left: Vec<usize> = (0..body.len()).collect();
    let mut order = Vec::new();
    while !left.is_empty() {
        let all_bound = |l: &PLit, b: &HashSet<String>| plit_vars(l).iter().all(|v| b.contains(v));
        let mut pick = left.iter().position(|&i| !matches!(body[i], PLit::Pos(_)) && all_bound(&body[i], &bound));
        if pick.is_none() {
            pick = left.iter().position(|&i| match &body[i] {
                PLit::Cmp("=", l, r) => {
                    let side = |t: &PTerm| match t { PTerm::Var(v) => bound.contains(v), _ => true };
                    side(l) || side(r)
                }
                _ => false,
            });
        }
        if pick.is_none() {
            let mut best: Option<(usize, usize)> = None;
            for (j, &i) in left.iter().enumerate() {
                if let PLit::Pos(a) = &body[i] {
                    let s = a.args.iter().filter(|t| match t { PTerm::Var(v) => bound.contains(v), _ => true }).count();
                    if best.map_or(true, |(_, bs)| s > bs) { best = Some((j, s)); }
                }
            }
            pick = best.map(|(j, _)| j);
        }
        let Some(j) = pick else {
            let l = &body[left[0]];
            let free: Vec<String> = plit_vars(l).into_iter().filter(|v| !bound.contains(v)).collect();
            let how = if matches!(l, PLit::Neg(_)) { "is only used under not" } else { "is not bound" };
            return err("unsafe", format!("{}: {} in \"{}\" {}; use it in a positive condition first", what, free.join(", "), fmt_plit(l), how));
        };
        let i = left.remove(j);
        for v in plit_vars(&body[i]) { bound.insert(v); }
        order.push(i);
    }
    Ok((order, bound))
}

/* ============================== relations ============================== */

#[derive(Clone)]
enum Use { Pos(usize, u32), Neg(usize, Box<[u32]>) }
#[derive(Clone)]
enum Proof { Fact(usize), Rule(usize, Vec<Use>) }

#[derive(Clone)]
struct Rel {
    arity: usize,
    tuples: Vec<Box<[u32]>>,
    proofs: Vec<Proof>,
    map: FMap<Box<[u32]>, u32>,
    idx: Vec<FMap<u32, Vec<u32>>>,
}
impl Rel {
    fn new(arity: usize) -> Rel { Rel { arity, tuples: vec![], proofs: vec![], map: FMap::default(), idx: vec![FMap::default(); arity] } }
    fn add(&mut self, args: Box<[u32]>, proof: Proof) -> bool {
        if self.map.contains_key(&args) { return false; }
        let id = self.tuples.len() as u32;
        for (k, v) in args.iter().enumerate() { self.idx[k].entry(*v).or_default().push(id); }
        self.map.insert(args.clone(), id); self.tuples.push(args); self.proofs.push(proof); true
    }
    /// Tuple ids in [lo, hi) that can match the pattern (an index on the first bound position). No allocation.
    fn candidates(&self, pat: &[Option<u32>], lo: u32, hi: u32) -> Cand<'_> {
        for (k, v) in pat.iter().enumerate() {
            if let Some(v) = v {
                return match self.idx[k].get(v) {
                    None => Cand::Slice(&[]),
                    Some(list) => { let a = list.partition_point(|&t| t < lo); let b = list.partition_point(|&t| t < hi); Cand::Slice(&list[a..b]) }
                };
            }
        }
        Cand::Range(lo..hi.min(self.tuples.len() as u32))
    }
}
enum Cand<'a> { Slice(&'a [u32]), Range(std::ops::Range<u32>) }
impl Cand<'_> { fn get(&self, i: usize) -> Option<u32> { match self { Cand::Slice(s) => s.get(i).copied(), Cand::Range(r) => { let v = r.start + i as u32; (v < r.end).then_some(v) } } } }

/* ============================== the knowledge base ============================== */

#[derive(Clone)]
pub struct Kb {
    vals: Interner,
    preds: Vec<(String, usize)>,
    pred_ids: HashMap<(String, usize), usize>,
    base: Vec<BaseFact>,
    rules: Vec<Rule>,
    constraints: Vec<Constraint>,
    strata: Vec<Vec<usize>>, // rule indexes per stratum, in order
    rels: Vec<Option<Rel>>,
    evaluated: bool,
    derived: usize,
}

pub struct FactIn { pub id: String, pub fact: String, pub status: String, pub by: String, pub source: String }

impl Kb {
    pub fn new(rules_text: &str, facts: &[FactIn], rules_source: &str) -> R<Kb> {
        let mut kb = Kb { vals: Interner::default(), preds: vec![], pred_ids: HashMap::new(), base: vec![], rules: vec![], constraints: vec![], strata: vec![], rels: vec![], evaluated: false, derived: 0 };
        let prog = parse_program(rules_text)?;
        for (a, line) in &prog.facts {
            let (pred, args) = kb.ground(a);
            kb.base.push(BaseFact { id: format!("{}:{}", rules_source, line), pred, args, status: "confirmed".into(), by: "rules".into(), source: format!("{} line {}", rules_source, line) });
        }
        for f in facts {
            if f.status == "rejected" { continue; }
            let a = parse_fact(&f.fact).map_err(|e| KgError { code: e.code, msg: format!("fact {}: {}", f.id, e.msg) })?;
            let (pred, args) = kb.ground(&a);
            kb.base.push(BaseFact { id: f.id.clone(), pred, args, status: if f.status.is_empty() { "confirmed".into() } else { f.status.clone() }, by: f.by.clone(), source: f.source.clone() });
        }
        for r in &prog.rules {
            let what = format!("rule on line {}", r.line);
            let (order, bound) = plan(&r.body, &what, &HashSet::new())?;
            let free: Vec<String> = r.head.args.iter().filter_map(|t| if let PTerm::Var(v) = t { (!bound.contains(v)).then(|| v.clone()) } else { None }).collect();
            if !free.is_empty() { return err("unsafe", format!("{}: {} in the head is not bound in the body", what, free.join(", "))); }
            let mut vars = Vec::new();
            let clause = kb.compile(&r.body, order, &mut vars);
            let head = kb.compile_atom(&r.head, &mut vars);
            let text = format!("{} :- {}.", fmt_patom(&r.head), r.body.iter().map(fmt_plit).collect::<Vec<_>>().join(", "));
            kb.rules.push(Rule { head, clause: Clause { vars, ..clause }, line: r.line, text });
        }
        for c in &prog.constraints {
            let (order, _) = plan(&c.body, &format!("constraint {}", c.name), &HashSet::new())?;
            let mut vars = Vec::new();
            let clause = kb.compile(&c.body, order, &mut vars);
            let text = format!("! {}: {}.", c.name, c.body.iter().map(fmt_plit).collect::<Vec<_>>().join(", "));
            kb.constraints.push(Constraint { name: c.name.clone(), clause: Clause { vars, ..clause }, text });
        }
        kb.stratify()?;
        Ok(kb)
    }
    fn pred(&mut self, name: &str, arity: usize) -> usize {
        if let Some(&i) = self.pred_ids.get(&(name.to_string(), arity)) { return i; }
        let i = self.preds.len(); self.preds.push((name.to_string(), arity)); self.pred_ids.insert((name.to_string(), arity), i); self.rels.push(None); i
    }
    fn ground(&mut self, a: &PAtom) -> (usize, Box<[u32]>) {
        let pred = self.pred(&a.p, a.args.len());
        let args = a.args.iter().map(|t| match t { PTerm::Const(c) => self.vals.id(c), PTerm::Var(_) => unreachable!() }).collect();
        (pred, args)
    }
    fn term(&mut self, t: &PTerm, vars: &mut Vec<String>) -> Term {
        match t {
            PTerm::Const(c) => Term::Const(self.vals.id(c)),
            PTerm::Var(v) => Term::Var(vars.iter().position(|x| x == v).unwrap_or_else(|| { vars.push(v.clone()); vars.len() - 1 })),
        }
    }
    fn compile_atom(&mut self, a: &PAtom, vars: &mut Vec<String>) -> Atom {
        let pred = self.pred(&a.p, a.args.len());
        Atom { pred, args: a.args.iter().map(|t| self.term(t, vars)).collect() }
    }
    fn compile(&mut self, body: &[PLit], order: Vec<usize>, vars: &mut Vec<String>) -> Clause {
        let body = body.iter().map(|l| match l {
            PLit::Pos(a) => Lit::Pos(self.compile_atom(a, vars)),
            PLit::Neg(a) => Lit::Neg(self.compile_atom(a, vars)),
            PLit::Cmp(op, l, r) => { let l = self.term(l, vars); let r = self.term(r, vars); Lit::Cmp(op, l, r) }
        }).collect();
        Clause { body, order, vars: vec![] }
    }
    fn stratify(&mut self) -> R<()> {
        let n = self.preds.len();
        let mut adj = vec![vec![]; n];
        let mut edges = vec![];
        for r in &self.rules {
            for l in &r.clause.body {
                if let Lit::Pos(a) | Lit::Neg(a) = l { adj[a.pred].push(r.head.pred); edges.push((a.pred, r.head.pred, matches!(l, Lit::Neg(_)))); }
            }
        }
        // Tarjan's strongly connected components (iterative), visiting predicates in name order for stable output
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|a, b| self.preds[*a].cmp(&self.preds[*b]));
        let (mut index, mut low, mut on, mut comp) = (vec![usize::MAX; n], vec![0; n], vec![false; n], vec![usize::MAX; n]);
        let (mut st, mut comps, mut ix) = (vec![], vec![], 0usize);
        for &root in &order {
            if index[root] != usize::MAX { continue; }
            let mut call: Vec<(usize, usize)> = vec![(root, 0)];
            index[root] = ix; low[root] = ix; ix += 1; st.push(root); on[root] = true;
            while let Some(&mut (v, ref mut k)) = call.last_mut() {
                if *k < adj[v].len() {
                    let w = adj[v][*k]; *k += 1;
                    if index[w] == usize::MAX { index[w] = ix; low[w] = ix; ix += 1; st.push(w); on[w] = true; call.push((w, 0)); }
                    else if on[w] { low[v] = low[v].min(index[w]); }
                } else {
                    call.pop();
                    if let Some(&(u, _)) = call.last() { low[u] = low[u].min(low[v]); }
                    if low[v] == index[v] {
                        let mut c = vec![];
                        loop { let w = st.pop().unwrap(); on[w] = false; comp[w] = comps.len(); c.push(w); if w == v { break; } }
                        comps.push(c);
                    }
                }
            }
        }
        for (a, b, neg) in edges {
            if neg && comp[a] == comp[b] {
                return err("stratify", format!("{} depends on \"not {}\" in a loop; negation cannot go through recursion", self.preds[b].0, self.preds[a].0));
            }
        }
        // Tarjan finishes a component after everything that depends on it: reverse for evaluation order
        self.strata = comps.iter().rev().map(|c| {
            let set: HashSet<usize> = c.iter().copied().collect();
            (0..self.rules.len()).filter(|&i| set.contains(&self.rules[i].head.pred)).collect::<Vec<_>>()
        }).filter(|v: &Vec<usize>| !v.is_empty()).collect();
        Ok(())
    }

    fn rel_mut(&mut self, pred: usize) -> &mut Rel { let a = self.preds[pred].1; self.rels[pred].get_or_insert_with(|| Rel::new(a)) }

    /// Compute everything that follows (once).
    pub fn evaluate(&mut self) -> R<()> {
        if self.evaluated { return Ok(()); }
        for i in 0..self.base.len() { let (p, a) = (self.base[i].pred, self.base[i].args.clone()); self.rel_mut(p).add(a, Proof::Fact(i)); }
        let mut rounds = 0usize;
        for s in 0..self.strata.len() {
            let rules = self.strata[s].clone();
            let mut pending: Vec<(usize, Box<[u32]>, Proof)> = vec![];
            let mut seen: FSet<(usize, Box<[u32]>)> = FSet::default();
            for &ri in &rules { self.fire(ri, None, &[], &mut pending, &mut seen); }
            loop {
                let mut delta: Vec<(usize, u32, u32)> = vec![];
                let mut by_pred: HashMap<usize, (u32, u32)> = HashMap::new();
                for (p, args, proof) in pending.drain(..) {
                    let rel = self.rels[p].get_or_insert_with(|| Rel::new(args.len()));
                    let before = rel.tuples.len() as u32;
                    if rel.add(args, proof) {
                        self.derived += 1;
                        let e = by_pred.entry(p).or_insert((before, before)); e.1 = before + 1;
                        if self.derived + self.base.len() > MAX_FACTS {
                            return err("limit", format!("more than {} facts follow; check your rules for one that grows without end", MAX_FACTS));
                        }
                    }
                }
                seen.clear();
                for (p, (lo, hi)) in by_pred { delta.push((p, lo, hi)); }
                if delta.is_empty() { break; }
                rounds += 1;
                if rounds > MAX_ROUNDS { return err("limit", "the rules did not settle"); }
                for &ri in &rules {
                    let n = self.rules[ri].clause.body.len();
                    for j in 0..n {
                        if let Lit::Pos(a) = &self.rules[ri].clause.body[j] {
                            if let Some(&(_, lo, hi)) = delta.iter().find(|d| d.0 == a.pred) { self.fire(ri, Some((j, lo, hi)), &delta, &mut pending, &mut seen); }
                        }
                    }
                }
            }
        }
        self.evaluated = true;
        Ok(())
    }
    fn fire(&self, ri: usize, delta_at: Option<(usize, u32, u32)>, _delta: &[(usize, u32, u32)], pending: &mut Vec<(usize, Box<[u32]>, Proof)>, seen: &mut FSet<(usize, Box<[u32]>)>) {
        let r = &self.rules[ri];
        let hp = r.head.pred;
        self.solve(&r.clause, delta_at, &mut |b, uses| {
            let args: Box<[u32]> = r.head.args.iter().map(|t| match t { Term::Var(v) => b[*v].unwrap(), Term::Const(c) => *c }).collect();
            if self.rels[hp].as_ref().map_or(false, |rel| rel.map.contains_key(&args)) { return true; }
            if seen.insert((hp, args.clone())) { pending.push((hp, args, Proof::Rule(ri, uses.to_vec()))); }
            true
        });
    }
    /// Every binding of a clause's body, in plan order. `delta_at`: the literal that must match only tuples [lo, hi).
    fn solve(&self, c: &Clause, delta_at: Option<(usize, u32, u32)>, f: &mut dyn FnMut(&[Option<u32>], &[Use]) -> bool) {
        let mut b = vec![None; c.vars.len().max(self.max_vars(c))];
        let mut uses = vec![];
        self.step(c, 0, delta_at, &mut b, &mut uses, f);
    }
    fn max_vars(&self, c: &Clause) -> usize {
        let mut m = 0;
        let mut see = |t: &Term| if let Term::Var(v) = t { m = m.max(v + 1) };
        for l in &c.body { match l { Lit::Pos(a) | Lit::Neg(a) => a.args.iter().for_each(&mut see), Lit::Cmp(_, l, r) => { see(l); see(r); } } }
        m
    }
    fn step(&self, c: &Clause, s: usize, delta_at: Option<(usize, u32, u32)>, b: &mut Vec<Option<u32>>, uses: &mut Vec<Use>, f: &mut dyn FnMut(&[Option<u32>], &[Use]) -> bool) -> bool {
        if s == c.order.len() { return f(b, uses); }
        let i = c.order[s];
        let val = |t: &Term, b: &Vec<Option<u32>>| match t { Term::Var(v) => b[*v], Term::Const(k) => Some(*k) };
        match &c.body[i] {
            Lit::Cmp(op, l, r) => {
                let (lv, rv) = (val(l, b), val(r, b));
                if *op == "=" {
                    if let (None, Term::Var(v), Some(x)) = (lv, l, rv) { b[*v] = Some(x); let go = self.step(c, s + 1, delta_at, b, uses, f); b[*v] = None; return go; }
                    if let (Some(x), None, Term::Var(v)) = (lv, rv, r) { b[*v] = Some(x); let go = self.step(c, s + 1, delta_at, b, uses, f); b[*v] = None; return go; }
                }
                let (Some(x), Some(y)) = (lv, rv) else { return true; };
                if cmp_vals(op, &self.vals.vals[x as usize], &self.vals.vals[y as usize]) { return self.step(c, s + 1, delta_at, b, uses, f); }
                true
            }
            Lit::Neg(a) => {
                let args: Box<[u32]> = a.args.iter().map(|t| val(t, b).unwrap()).collect();
                if self.rels[a.pred].as_ref().map_or(false, |r| r.map.contains_key(&args)) { return true; }
                uses.push(Use::Neg(a.pred, args));
                let go = self.step(c, s + 1, delta_at, b, uses, f);
                uses.pop(); go
            }
            Lit::Pos(a) => {
                let Some(rel) = self.rels[a.pred].as_ref() else { return true; };
                let pat: Vec<Option<u32>> = a.args.iter().map(|t| val(t, b)).collect();
                let (lo, hi) = match delta_at { Some((j, lo, hi)) if j == i => (lo, hi), _ => (0, rel.tuples.len() as u32) };
                let cand = rel.candidates(&pat, lo, hi);
                let mut ci = 0;
                while let Some(t) = cand.get(ci) {
                    ci += 1;
                    let tup = &rel.tuples[t as usize];
                    let mut newly: [usize; 16] = [0; 16]; let mut nn = 0; let mut spill: Vec<usize> = vec![];
                    let mut ok = true;
                    for (k, term) in a.args.iter().enumerate() {
                        match term {
                            Term::Const(cv) => if *cv != tup[k] { ok = false; break; },
                            Term::Var(v) => match b[*v] { None => { b[*v] = Some(tup[k]); if nn < 16 { newly[nn] = *v; nn += 1; } else { spill.push(*v); } } Some(x) => if x != tup[k] { ok = false; break; } },
                        }
                    }
                    let mut go = true;
                    if ok { uses.push(Use::Pos(a.pred, t)); go = self.step(c, s + 1, delta_at, b, uses, f); uses.pop(); }
                    for &v in &newly[..nn] { b[v] = None; } for v in spill { b[v] = None; }
                    if !go { return false; }
                }
                true
            }
        }
    }

    /* ---------- answers ---------- */
    fn fmt_ground(&self, pred: usize, args: &[u32]) -> String {
        let name = &self.preds[pred].0;
        if args.is_empty() { name.clone() } else { format!("{}({})", name, args.iter().map(|v| fmt_val(&self.vals.vals[*v as usize])).collect::<Vec<_>>().join(", ")) }
    }
    fn lookup(&self, a: &PAtom) -> Option<(usize, u32)> {
        let pred = *self.pred_ids.get(&(a.p.clone(), a.args.len()))?;
        let mut args = vec![];
        for t in &a.args { match t { PTerm::Const(c) => args.push(self.vals.get(c)?), PTerm::Var(_) => return None } }
        let rel = self.rels[pred].as_ref()?;
        rel.map.get(&args.into_boxed_slice()).map(|&t| (pred, t))
    }
    fn proof_json(&self, pred: usize, t: u32, n: &mut usize, depth: usize) -> J {
        let rel = self.rels[pred].as_ref().unwrap();
        let fact = self.fmt_ground(pred, &rel.tuples[t as usize]);
        *n += 1;
        if *n > MAX_PROOF_NODES || depth > 40 { return json!({"fact": fact, "cut": true}); }
        match &rel.proofs[t as usize] {
            Proof::Fact(i) => { let f = &self.base[*i]; json!({"fact": fact, "by": "fact", "id": f.id, "status": f.status, "source": f.source, "who": f.by}) }
            Proof::Rule(ri, uses) => {
                let r = &self.rules[*ri];
                let because: Vec<J> = uses.iter().map(|u| match u {
                    Use::Pos(p, tt) => self.proof_json(*p, *tt, n, depth + 1),
                    Use::Neg(p, args) => json!({"fact": format!("not {}", self.fmt_ground(*p, args)), "by": "absent"}),
                }).collect();
                json!({"fact": fact, "by": "rule", "rule": r.text, "line": r.line, "because": because})
            }
        }
    }
    fn rests_on(&self, uses: &[Use]) -> Vec<usize> {
        let mut out = vec![]; let mut seen_f = HashSet::new(); let mut seen = HashSet::new();
        let mut stack: Vec<(usize, u32)> = uses.iter().filter_map(|u| if let Use::Pos(p, t) = u { Some((*p, *t)) } else { None }).collect();
        while let Some((p, t)) = stack.pop() {
            if !seen.insert((p, t)) { continue; }
            match &self.rels[p].as_ref().unwrap().proofs[t as usize] {
                Proof::Fact(i) => { if seen_f.insert(*i) { out.push(*i); } }
                Proof::Rule(_, us) => for u in us { if let Use::Pos(q, tt) = u { stack.push((*q, *tt)); } },
            }
        }
        out.sort(); out
    }
    fn ids_json(&self, ix: &[usize]) -> J { J::Array(ix.iter().map(|&i| { let f = &self.base[i]; json!({"id": f.id, "status": f.status, "source": f.source}) }).collect()) }

    fn compile_query(&mut self, lits: &[PLit]) -> R<Clause> {
        let (order, _) = plan(lits, "query", &HashSet::new())?;
        let mut vars = vec![];
        let c = self.compile(lits, order, &mut vars);
        Ok(Clause { vars, ..c })
    }
    pub fn query(&mut self, q: &str, limit: usize) -> R<J> {
        self.evaluate()?;
        let lits = parse_query(q)?;
        let c = self.compile_query(&lits)?;
        let shown: Vec<usize> = (0..c.vars.len()).filter(|&i| !c.vars[i].starts_with('_')).collect();
        let mut seen = HashSet::new(); let mut rows = vec![];
        let lim = limit.min(MAX_ANSWERS);
        self.solve(&c, None, &mut |b, uses| {
            let key: Vec<u32> = shown.iter().map(|&i| b[i].unwrap()).collect();
            if !seen.insert(key) { return true; }
            rows.push((shown.iter().map(|&i| (c.vars[i].clone(), b[i].unwrap())).collect::<Vec<_>>(), uses.to_vec()));
            rows.len() < lim
        });
        let answers: Vec<J> = rows.iter().map(|(bind, uses)| {
            let mut m = Map::new(); for (k, v) in bind { m.insert(k.clone(), val_json(&self.vals.vals[*v as usize])); }
            let unconf: Vec<usize> = self.rests_on(uses).into_iter().filter(|&i| self.base[i].status == "proposed").collect();
            json!({"bindings": m, "unconfirmed": self.ids_json(&unconf)})
        }).collect();
        let vars: Vec<String> = shown.iter().map(|&i| c.vars[i].clone()).collect();
        let text = if answers.is_empty() { "No answers.".to_string() } else {
            let mut t = format!("{} answer{}:", rows.len(), if rows.len() == 1 { "" } else { "s" });
            for (bind, _) in &rows { t.push_str("\n  "); t.push_str(&if bind.is_empty() { "yes".to_string() } else { bind.iter().map(|(k, v)| format!("{} = {}", k, fmt_val(&self.vals.vals[*v as usize]))).collect::<Vec<_>>().join(", ") }); }
            if rows.len() >= lim { t.push_str(&format!("\n  (first {} only)", lim)); }
            t
        };
        Ok(json!({"vars": vars, "answers": answers, "text": text}))
    }
    fn violations(&self) -> Vec<(usize, Vec<(String, u32)>, Vec<Use>)> {
        let mut out = vec![];
        for (ci, c) in self.constraints.iter().enumerate() {
            let shown: Vec<usize> = { let mut v: Vec<usize> = (0..c.clause.vars.len()).filter(|&i| !c.clause.vars[i].starts_with('_')).collect(); v.sort_by(|a, b| c.clause.vars[*a].cmp(&c.clause.vars[*b])); v };
            // one violation per set of facts: A != B over the same two facts matches twice (A, B swapped)
            let mut seen: HashSet<Vec<(usize, u32)>> = HashSet::new();
            self.solve(&c.clause, None, &mut |b, uses| {
                let mut key: Vec<(usize, u32)> = uses.iter().filter_map(|u| if let Use::Pos(p, t) = u { Some((*p, *t)) } else { None }).collect();
                key.sort(); key.dedup();
                if seen.insert(key) { out.push((ci, shown.iter().map(|&i| (c.clause.vars[i].clone(), b[i].unwrap())).collect(), uses.to_vec())); }
                out.len() < MAX_ANSWERS
            });
            if out.len() >= MAX_ANSWERS { break; }
        }
        out
    }
    fn violation_json(&self, v: &(usize, Vec<(String, u32)>, Vec<Use>), skip: Option<usize>) -> J {
        let c = &self.constraints[v.0];
        let mut m = Map::new(); for (k, x) in &v.1 { m.insert(k.clone(), val_json(&self.vals.vals[*x as usize])); }
        let facts: Vec<String> = v.2.iter().filter_map(|u| if let Use::Pos(p, t) = u { Some(self.fmt_ground(*p, &self.rels[*p].as_ref().unwrap().tuples[*t as usize])) } else { None }).collect();
        let rests: Vec<usize> = self.rests_on(&v.2).into_iter().filter(|i| Some(*i) != skip).collect();
        json!({"constraint": c.name, "text": c.text, "bindings": m, "facts": facts, "rests_on": self.ids_json(&rests)})
    }
    pub fn check(&mut self) -> R<J> {
        self.evaluate()?;
        let vs = self.violations();
        let list: Vec<J> = vs.iter().map(|v| self.violation_json(v, None)).collect();
        let text = if list.is_empty() { format!("No contradictions: {} constraint{} hold.", self.constraints.len(), if self.constraints.len() == 1 { "" } else { "s" }) } else {
            let mut t = format!("{} contradiction{}:", list.len(), if list.len() == 1 { "" } else { "s" });
            for v in &list { t.push_str(&format!("\n✗ {}\n  with: {}{}", v["text"].as_str().unwrap(), v["facts"].as_array().unwrap().iter().map(|x| x.as_str().unwrap()).collect::<Vec<_>>().join(", "), unconf_note(&v["rests_on"]))); }
            t
        };
        Ok(json!({"violations": list, "text": text}))
    }
    fn related(&self, a: &PAtom) -> Vec<String> {
        let Some(&pred) = self.pred_ids.get(&(a.p.clone(), a.args.len())) else { return vec![] };
        let Some(rel) = self.rels[pred].as_ref() else { return vec![] };
        let want: Vec<Option<u32>> = a.args.iter().map(|t| match t { PTerm::Const(c) => self.vals.get(c), _ => None }).collect();
        let mut out: Vec<(usize, String)> = vec![];
        for tup in &rel.tuples {
            let same = tup.iter().zip(&want).filter(|(v, w)| Some(**v) == **w).count();
            if same > 0 { out.push((same + usize::from(want.first().copied().flatten() == tup.first().copied()), self.fmt_ground(pred, tup))); }
        }
        out.sort_by(|x, y| y.0.cmp(&x.0).then(x.1.cmp(&y.1)));
        out.into_iter().take(6).map(|x| x.1).collect()
    }
    pub fn why(&mut self, fact: &str) -> R<J> {
        self.evaluate()?;
        let a = parse_fact(fact)?;
        match self.lookup(&a) {
            None => Ok(json!({"holds": false, "text": format!("{} does not follow from the graph.", fmt_patom(&a))})),
            Some((p, t)) => { let pr = self.proof_json(p, t, &mut 0, 0); let text = proof_text(&pr, ""); Ok(json!({"holds": true, "proof": pr, "text": text})) }
        }
    }
    /// Check one claim: proven, contradicted or unknown.
    pub fn verify(&mut self, claim: &str) -> R<J> {
        self.evaluate()?;
        let lits = parse_query(claim)?;
        if lits.len() != 1 || matches!(lits[0], PLit::Cmp(..)) { return err("claim", "verify one claim at a time, like works_at(alice, acme) or not works_at(alice, acme)"); }
        let l = &lits[0]; let ground = plit_vars(l).is_empty(); let claim_s = fmt_plit(l);
        let out = match l {
            PLit::Neg(a) => {
                if !ground { return err("claim", "a \"not\" claim must name everything (no variables)"); }
                match self.lookup(a) {
                    Some((p, t)) => { let pr = self.proof_json(p, t, &mut 0, 0); let rests = self.rests_on(&[Use::Pos(p, t)]); json!({"claim": claim_s, "verdict": "contradicted", "why": "it holds", "proof": pr, "rests_on": self.ids_json(&rests)}) }
                    None => json!({"claim": claim_s, "verdict": "unknown", "why": "it does not follow, but nothing says it is false", "related": self.related(a)}),
                }
            }
            PLit::Pos(a) if !ground => {
                let q = self.query(claim, 5)?;
                if q["answers"].as_array().unwrap().is_empty() { json!({"claim": claim_s, "verdict": "unknown", "why": "no answers", "related": self.related(a)}) }
                else { let un = q["answers"][0]["unconfirmed"].clone(); json!({"claim": claim_s, "verdict": "proven", "why": "there are answers", "answers": q["answers"].as_array().unwrap().iter().map(|x| x["bindings"].clone()).collect::<Vec<_>>(), "rests_on": un}) }
            }
            PLit::Pos(a) => match self.lookup(a) {
                Some((p, t)) => { let pr = self.proof_json(p, t, &mut 0, 0); let rests = self.rests_on(&[Use::Pos(p, t)]); json!({"claim": claim_s, "verdict": "proven", "proof": pr, "rests_on": self.ids_json(&rests)}) }
                None => {
                    // would it break a constraint? a copy with the claim added as a hypothesis
                    let mut hyp = self.fresh();
                    let (pred, args) = hyp.ground(a);
                    let hix = hyp.base.len();
                    hyp.base.push(BaseFact { id: "__claim__".into(), pred, args, status: "hypothesis".into(), by: "claim".into(), source: "the claim".into() });
                    hyp.evaluate()?;
                    let mut seen = HashSet::new();
                    let broken: Vec<J> = hyp.violations().iter().filter(|v| hyp.rests_on(&v.2).contains(&hix) && seen.insert(v.0)).map(|v| hyp.violation_json(v, Some(hix))).collect();
                    if broken.is_empty() { json!({"claim": claim_s, "verdict": "unknown", "why": "it does not follow, and nothing contradicts it", "related": self.related(a)}) }
                    else { json!({"claim": claim_s, "verdict": "contradicted", "why": "it would break a constraint", "violations": broken}) }
                }
            },
            PLit::Cmp(..) => unreachable!(),
        };
        let mut out = out; let text = verdict_text(&out); out["text"] = json!(text); Ok(out)
    }
    /// The same program and facts, not evaluated yet.
    fn fresh(&self) -> Kb {
        let mut k = self.clone(); k.rels = vec![None; self.preds.len()]; k.evaluated = false; k.derived = 0; k
    }
    pub fn stats(&mut self) -> R<J> {
        self.evaluate()?;
        let mut rels: Vec<J> = (0..self.preds.len()).filter_map(|p| self.rels[p].as_ref().filter(|r| !r.tuples.is_empty()).map(|r| json!({"name": self.preds[p].0, "arity": r.arity, "count": r.tuples.len()}))).collect();
        rels.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()).then(a["arity"].as_u64().cmp(&b["arity"].as_u64())));
        let conf = self.base.iter().filter(|f| f.status == "confirmed").count();
        let prop = self.base.iter().filter(|f| f.status == "proposed").count();
        Ok(json!({"facts": self.base.len(), "confirmed": conf, "proposed": prop, "derived": self.derived, "rules": self.rules.len(), "constraints": self.constraints.len(), "relations": rels}))
    }
    /// Facts as edges for drawing: every derived or stated binary fact (up to `limit`).
    pub fn edges(&mut self, limit: usize, derived: bool) -> R<J> {
        self.evaluate()?;
        let mut out = vec![];
        'p: for p in 0..self.preds.len() {
            let Some(rel) = self.rels[p].as_ref() else { continue };
            if rel.arity != 2 { continue; }
            for (t, tup) in rel.tuples.iter().enumerate() {
                let is_fact = matches!(rel.proofs[t], Proof::Fact(_));
                if !derived && !is_fact { continue; }
                let status = if let Proof::Fact(i) = rel.proofs[t] { self.base[i].status.clone() } else { "derived".into() };
                out.push(json!({"s": val_json(&self.vals.vals[tup[0] as usize]), "p": self.preds[p].0, "o": val_json(&self.vals.vals[tup[1] as usize]), "status": status}));
                if out.len() >= limit { break 'p; }
            }
        }
        Ok(json!({"edges": out}))
    }
}

/* ============================== text ============================== */

fn unconf_note(rests: &J) -> String {
    let un: Vec<&str> = rests.as_array().map(|a| a.iter().filter(|f| f["status"] == "proposed").filter_map(|f| f["id"].as_str()).collect()).unwrap_or_default();
    if un.is_empty() { String::new() } else { format!(" (rests on {} unconfirmed fact{}: {})", un.len(), if un.len() == 1 { "" } else { "s" }, un.join(", ")) }
}
pub fn proof_text(p: &J, indent: &str) -> String {
    let tag = match p["by"].as_str() {
        Some("fact") => format!(" [fact {}{}{}]", p["id"].as_str().unwrap_or(""), if p["status"] == "proposed" { ", UNCONFIRMED" } else { "" }, p["source"].as_str().filter(|s| !s.is_empty()).map(|s| format!(", from {}", s)).unwrap_or_default()),
        Some("rule") => format!(" [by rule: {}]", p["rule"].as_str().unwrap_or("")),
        Some("absent") => " [nothing says otherwise]".into(),
        _ => if p["cut"] == true { " […]".into() } else { String::new() },
    };
    let mut s = format!("{}{}{}", indent, p["fact"].as_str().unwrap_or(""), tag);
    if let Some(b) = p["because"].as_array() { let deeper = format!("{}  ", indent); for c in b { s.push('\n'); s.push_str(&proof_text(c, &deeper)); } }
    s
}
pub fn verdict_text(r: &J) -> String {
    let claim = r["claim"].as_str().unwrap_or("");
    match r["verdict"].as_str() {
        Some("proven") => {
            let mut s = format!("✓ PROVEN{}: {}", unconf_note(&r["rests_on"]), claim);
            if r["proof"].is_object() { s.push('\n'); s.push_str(&proof_text(&r["proof"], "  ")); }
            if let Some(a) = r["answers"].as_array() { for b in a { s.push_str("\n  "); s.push_str(&b.as_object().unwrap().iter().map(|(k, v)| format!("{} = {}", k, fmt_val(&json_val(v)))).collect::<Vec<_>>().join(", ")); } }
            s
        }
        Some("contradicted") => {
            let mut s = format!("✗ CONTRADICTED: {} ({})", claim, r["why"].as_str().unwrap_or(""));
            if r["proof"].is_object() { s.push('\n'); s.push_str(&proof_text(&r["proof"], "  ")); }
            if let Some(vs) = r["violations"].as_array() {
                for v in vs { s.push_str(&format!("\n  breaks {}\n    with: {}{}", v["text"].as_str().unwrap_or(""), v["facts"].as_array().map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join(", ")).unwrap_or_default(), unconf_note(&v["rests_on"]))); }
            }
            s
        }
        _ => {
            let mut s = format!("? UNKNOWN: {} ({})", claim, r["why"].as_str().unwrap_or(""));
            if let Some(rel) = r["related"].as_array().filter(|a| !a.is_empty()) { s.push_str(&format!("\n  the graph has: {}", rel.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("; "))); }
            s
        }
    }
}
fn json_val(v: &J) -> Val { match v { J::Number(n) => Val::Num(n.as_f64().unwrap_or(0.0)), J::String(s) => Val::Str(s.as_str().into()), o => Val::Str(o.to_string().into()) } }

/* ============================== JSON interface ============================== */

#[derive(Default)]
struct State { kbs: HashMap<u64, Kb>, next: u64 }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); static OUT: RefCell<Vec<u8>> = RefCell::new(vec![]); }

fn facts_in(v: &J) -> Vec<FactIn> {
    v.as_array().map(|a| a.iter().map(|f| FactIn {
        id: f["id"].as_str().unwrap_or("").into(), fact: f["fact"].as_str().unwrap_or("").into(),
        status: f["status"].as_str().unwrap_or("confirmed").into(), by: f["by"].as_str().unwrap_or("").into(), source: f["source"].as_str().unwrap_or("").into(),
    }).collect()).unwrap_or_default()
}

/// One request, one answer, both JSON. Ops:
/// - `load {rules, facts: [{id, fact, status, by, source}], rules_source}` → `{handle, stats}`
/// - `query {handle, q, limit}`, `verify {handle, claim}`, `why {handle, fact}`, `check {handle}`, `stats {handle}`,
///   `edges {handle, limit, derived}`, `free {handle}`
/// - `parse_fact {fact}` → `{fact: normalized, name, arity}`; `parse_rules {rules}` → `{ok, rules, constraints, facts}`
/// - `format {values: [...]}` → each value as the language writes it
/// Errors come back as `{ok: false, code, error}`; `code` is parse, unsafe, stratify, limit, claim or request.
pub fn call(req: &str) -> String {
    let out = (|| -> R<J> {
        let r: J = serde_json::from_str(req).map_err(|e| KgError { code: "request", msg: format!("bad request: {}", e) })?;
        let op = r["op"].as_str().unwrap_or("");
        let handle = r["handle"].as_u64();
        let with = |f: &mut dyn FnMut(&mut Kb) -> R<J>| -> R<J> {
            STATE.with(|s| {
                let mut s = s.borrow_mut();
                let kb = handle.and_then(|h| s.kbs.get_mut(&h)).ok_or(KgError { code: "request", msg: "unknown handle: load the graph first".into() })?;
                f(kb)
            })
        };
        match op {
            "load" => {
                let mut kb = Kb::new(r["rules"].as_str().unwrap_or(""), &facts_in(&r["facts"]), r["rules_source"].as_str().unwrap_or("rules"))?;
                let st = kb.stats()?;
                STATE.with(|s| { let mut s = s.borrow_mut(); s.next += 1; let h = s.next; s.kbs.insert(h, kb); Ok(json!({"handle": h, "stats": st})) })
            }
            "free" => STATE.with(|s| { if let Some(h) = handle { s.borrow_mut().kbs.remove(&h); } Ok(json!({})) }),
            "query" => { let q = r["q"].as_str().unwrap_or("").to_string(); let lim = r["limit"].as_u64().unwrap_or(50) as usize; with(&mut |kb| kb.query(&q, lim)) }
            "verify" => { let c = r["claim"].as_str().unwrap_or("").to_string(); with(&mut |kb| kb.verify(&c)) }
            "why" => { let f = r["fact"].as_str().unwrap_or("").to_string(); with(&mut |kb| kb.why(&f)) }
            "check" => with(&mut |kb| kb.check()),
            "stats" => with(&mut |kb| kb.stats()),
            "edges" => { let lim = r["limit"].as_u64().unwrap_or(400) as usize; let d = r["derived"].as_bool().unwrap_or(false); with(&mut |kb| kb.edges(lim, d)) }
            "parse_fact" => {
                let a = parse_fact(r["fact"].as_str().unwrap_or(""))?;
                Ok(json!({"fact": fmt_patom(&a), "name": a.p, "arity": a.args.len(), "args": a.args.iter().map(|t| if let PTerm::Const(c) = t { val_json(c) } else { J::Null }).collect::<Vec<_>>()}))
            }
            "parse_rules" => { let k = Kb::new(r["rules"].as_str().unwrap_or(""), &[], "rules")?; Ok(json!({"rules": k.rules.len(), "constraints": k.constraints.len(), "facts": k.base.len()})) }
            "format" => Ok(json!({"values": r["values"].as_array().map(|a| a.iter().map(|v| fmt_val(&json_val(v))).collect::<Vec<_>>()).unwrap_or_default()})),
            _ => err("request", format!("unknown op \"{}\"", op)),
        }
    })();
    match out {
        Ok(mut v) => { if let Some(o) = v.as_object_mut() { o.insert("ok".into(), json!(true)); } v.to_string() }
        Err(e) => json!({"ok": false, "code": e.code, "error": e.msg}).to_string(),
    }
}

/* ---------- WebAssembly exports ---------- */
#[no_mangle]
pub extern "C" fn kg_alloc(n: usize) -> *mut u8 { let mut v: Vec<u8> = Vec::with_capacity(n.max(1)); let p = v.as_mut_ptr(); std::mem::forget(v); p }
/// # Safety
/// `p` must come from `kg_alloc(n)` with the same `n`.
#[no_mangle]
pub unsafe extern "C" fn kg_free(p: *mut u8, n: usize) { drop(Vec::from_raw_parts(p, 0, n.max(1))); }
/// Run one JSON request (UTF-8 at `p`, `n` bytes). Returns a pointer to the answer; its length is `kg_out_len()`.
/// The answer stays valid until the next call.
/// # Safety
/// `p` must point to `n` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn kg_call(p: *const u8, n: usize) -> *const u8 {
    let req = String::from_utf8_lossy(std::slice::from_raw_parts(p, n)).into_owned();
    let ans = call(&req);
    OUT.with(|o| { let mut o = o.borrow_mut(); *o = ans.into_bytes(); o.as_ptr() })
}
#[no_mangle]
pub extern "C" fn kg_out_len() -> usize { OUT.with(|o| o.borrow().len()) }

#[cfg(test)]
mod tests;
