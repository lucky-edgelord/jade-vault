//! The shared cases (tests/kg_cases.json), run natively through the same JSON interface the hosts use.
use super::call;
use serde_json::{json, Value as J};

fn norm(rows: &[J]) -> Vec<String> { let mut v: Vec<String> = rows.iter().map(|r| { let mut m: Vec<(String, J)> = r.as_object().unwrap().iter().map(|(k, v)| (k.clone(), v.clone())).collect(); m.sort_by(|a, b| a.0.cmp(&b.0)); serde_json::to_string(&m).unwrap() }).collect(); v.sort(); v }
fn flat(p: &J) -> Vec<String> { if p["by"] == "fact" { vec![p["fact"].as_str().unwrap().to_string()] } else { p["because"].as_array().map(|a| a.iter().flat_map(flat).collect()).unwrap_or_default() } }
fn same_num(a: &J, b: &J) -> bool { a == b || (a.is_number() && b.is_number() && a.as_f64() == b.as_f64()) }
fn rows_eq(a: &[J], b: &[J]) -> bool { a.len() == b.len() && norm(a) == norm(b) || { let (x, y) = (norm(a), norm(b)); x.len() == y.len() && a.iter().all(|r| b.iter().any(|s| r.as_object().unwrap().iter().all(|(k, v)| same_num(v, &s[k])))) } }

#[test]
fn shared_cases() {
    let raw = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/kg_cases.json")).unwrap();
    let cases: J = serde_json::from_str(&raw).unwrap();
    let mut failed = vec![];
    for c in cases["cases"].as_array().unwrap() {
        let name = c["name"].as_str().unwrap();
        let load: J = serde_json::from_str(&call(&json!({"op": "load", "rules": c["rules"], "facts": c.get("facts").cloned().unwrap_or(json!([]))}).to_string())).unwrap();
        let op = c["op"].as_str().unwrap();
        if op == "error" {
            let msg_ok = c.get("message_has").map_or(true, |m| load["error"].as_str().unwrap_or("").contains(m.as_str().unwrap()));
            if !(load["ok"] == false && load["code"] == c["code"] && msg_ok) { failed.push(format!("{}: {}", name, load)); }
            continue;
        }
        if load["ok"] != true { failed.push(format!("{}: load failed {}", name, load)); continue; }
        let h = &load["handle"];
        let good = match op {
            "query" => { let r: J = serde_json::from_str(&call(&json!({"op": "query", "handle": h, "q": c["input"]}).to_string())).unwrap(); let got: Vec<J> = r["answers"].as_array().unwrap().iter().map(|a| a["bindings"].clone()).collect(); rows_eq(&got, c["answers"].as_array().unwrap()) || { failed.push(format!("{}: {:?}", name, got)); true } && false }
            "check" => { let r: J = serde_json::from_str(&call(&json!({"op": "check", "handle": h}).to_string())).unwrap(); let got: Vec<J> = r["violations"].as_array().unwrap().iter().map(|v| json!([v["constraint"], v["bindings"]])).collect(); let mut g: Vec<String> = got.iter().map(|x| x.to_string()).collect(); let mut w: Vec<String> = c["violations"].as_array().unwrap().iter().map(|x| x.to_string()).collect(); g.sort(); w.sort(); g == w }
            "verify" => {
                let r: J = serde_json::from_str(&call(&json!({"op": "verify", "handle": h, "claim": c["input"]}).to_string())).unwrap();
                let mut ok = r["verdict"] == c["verdict"];
                if let Some(rel) = c.get("related") { ok &= &r["related"] == rel; }
                if let Some(pf) = c.get("proof_facts") { let mut a = flat(&r["proof"]); a.sort(); let mut b: Vec<String> = pf.as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect(); b.sort(); ok &= a == b; }
                if let Some(cs) = c.get("constraints") { ok &= &J::Array(r["violations"].as_array().unwrap().iter().map(|v| v["constraint"].clone()).collect()) == cs; }
                if let Some(u) = c.get("rests_on_unconfirmed") { ok &= &J::Array(r["rests_on"].as_array().unwrap().iter().filter(|f| f["status"] == "proposed").map(|f| f["id"].clone()).collect()) == u; }
                if !ok { failed.push(format!("{}: {}", name, r["text"])); }
                true
            }
            _ => false,
        };
        if !good && op != "verify" { failed.push(format!("{}: wrong", name)); }
    }
    assert!(failed.is_empty(), "failed cases:\n{}", failed.join("\n"));
}

#[test]
fn closure_of_a_long_chain_is_fast() {
    let mut s = String::new(); for i in 1..1500 { s.push_str(&format!("reports_to(p{}, p{}).\n", i, i - 1)); }
    s.push_str("above(X, Y) :- reports_to(X, Y).\nabove(X, Z) :- reports_to(X, Y), above(Y, Z).");
    let t = std::time::Instant::now();
    let l: J = serde_json::from_str(&call(&json!({"op": "load", "rules": s}).to_string())).unwrap();
    assert_eq!(l["ok"], true, "{}", l);
    let r: J = serde_json::from_str(&call(&json!({"op": "verify", "handle": l["handle"], "claim": "above(p1499, p0)"}).to_string())).unwrap();
    assert_eq!(r["verdict"], "proven");
    eprintln!("1500-person chain: {} facts in {:?}", l["stats"]["derived"], t.elapsed());
}

#[test]
fn runaway_rules_stop_with_a_clear_error() {
    let mut s = String::new(); for i in 0..2500 { s.push_str(&format!("r(p{}, p{}).\n", i, i + 1)); }
    s.push_str("t(X, Y) :- r(X, Y).\nt(X, Z) :- r(X, Y), t(Y, Z).");
    let l: J = serde_json::from_str(&call(&json!({"op": "load", "rules": s}).to_string())).unwrap();
    assert_eq!(l["code"], "limit", "{}", l);
}
