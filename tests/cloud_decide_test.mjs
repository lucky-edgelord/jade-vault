// 2.28.1: decisions on Ollama Cloud, the way docs.ollama.com/api/systemone describes it (stood in for with page.route):
// POST https://ollama.com/v1/systemone with a Bearer key; choice criteria is an object { key: description }, the choice
// answer is the winning key with probabilities keyed by option, and a noul answer is the probability of true.
// A saved OpenRouter decision server (2.27) moves to Ollama Cloud.
import { start } from './_harness.mjs';

const t = await start({ settings: { decideProv: 'openrouter', ollamaKey: 'cloud-key', ollayaOn: true, ollayaModel: 'openai/gpt-4o-mini' } });
const { page, ok } = t;
await page.waitForFunction(() => typeof runTool === 'function' && typeof routerAsk === 'function' && typeof olDecideFetch === 'function', null, { timeout: 90000 });
ok(await page.evaluate(() => S.decideProv === 'cloud' && S.ollayaModel === 'clef'), 'a saved OpenRouter decision server moved to Ollama Cloud with clef: ' + await page.evaluate(() => S.decideProv + ' ' + S.ollayaModel));

const seen = []; const bad = [];
await page.route('https://ollama.com/**', async route => {
  const req = route.request(); const url = new URL(req.url()); const h = req.headers(); const body = req.postData() ? JSON.parse(req.postData()) : null;
  seen.push({ path: url.pathname, auth: h.authorization, body });
  if (h.authorization !== 'Bearer cloud-key' && h.authorization !== 'Bearer override') return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
  if (url.pathname === '/api/tags') return route.fulfill({ json: { models: [{ name: 'gpt-oss:120b' }, { name: 'clef' }, { name: 'qwen3-coder:480b' }, { name: 'clef-flash' }] } });
  if (url.pathname === '/v1/systemone') {
    if (body.model !== 'clef' && body.model !== 'clef-flash') return route.fulfill({ status: 404, json: { error: `model "${body.model}" not found` } });
    const answers = {};
    for (const [name, q] of Object.entries(body.questions)) {
      if (q.type === 'choice') {
        if (!q.criteria || Array.isArray(q.criteria) || typeof q.criteria !== 'object') { bad.push('choice criteria must be an object'); return route.fulfill({ status: 400, json: { error: `question "${name}": criteria must be an object` } }); }
        const keys = Object.keys(q.criteria); const win = keys[1];
        answers[name] = { type: 'choice', choice: win, probabilities: Object.fromEntries(keys.map(k => [k, k === win ? 0.82 : +(0.18 / (keys.length - 1)).toFixed(4)])), confidence: 0.61 };
      } else if (q.type === 'noul') answers[name] = { type: 'noul', noul: 0.91 };
      else if (q.type === 'score') {
        if (!Array.isArray(q.criteria)) return route.fulfill({ status: 400, json: { error: 'score criteria must be an array' } });
        answers[name] = { type: 'score', score: 1.4, legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])), probabilities: { 0: 0.1, 1: 0.4, 2: 0.5 }, confidence: 0.3 };
      }
    }
    return route.fulfill({ json: { model: body.model, answers, usage: { input_tokens: 50, output_tokens: 1 } } });
  }
  return route.fulfill({ status: 404, json: { error: 'not found' } });
});

ok(await page.evaluate(() => decName()) === 'Ollama Cloud', 'the decision server is Ollama Cloud');
const models = await page.evaluate(() => ollayaScan().catch(e => 'ERR ' + e.message));
ok(JSON.stringify(models) === JSON.stringify(['clef', 'clef-flash']), 'Scan lists the decision models only, not the chat models: ' + JSON.stringify(models));

let r = await page.evaluate(() => runTool('decide', { state: 'TypeError at list.js:42', question: 'What kind of problem?', type: 'choice', options: ['bug', 'network', 'user input'] }, null)); r = String(r?.content ?? r);
ok(/^choice: network \| confidence 0\.610/.test(r) && /probabilities: network 0\.820, bug 0\.090, user input 0\.090/.test(r) && /model: clef/.test(r), 'decide answers from clef on Ollama Cloud, with the option names (as Ollaya does):\n' + r);
const last = seen.filter(x => x.path === '/v1/systemone').at(-1);
ok(last.auth === 'Bearer cloud-key' && JSON.stringify(last.body.questions.q.criteria) === JSON.stringify({ bug: 'bug', network: 'network', 'user input': 'user input' }), 'the request follows the docs: Bearer key, criteria as an object: ' + JSON.stringify(last.body.questions.q));
ok(!bad.length, 'no request was refused for its shape');

const yn = await page.evaluate(() => jadeBridge('decide', { state: 'x', question: 'Is it late?', type: 'yesno' }).catch(e => 'ERR ' + e.message));
ok(yn?.answer === true && Math.abs(yn.probabilities.yes - 0.91) < 1e-6 && Math.abs(yn.confidence - 0.91) < 1e-6, 'yes/no: the probability of true becomes an answer, probabilities and a confidence: ' + JSON.stringify(yn));
const sc = await page.evaluate(() => jadeBridge('decide', { state: 'x', question: 'How urgent?', type: 'score', options: ['low', 'medium', 'high'] }).catch(e => 'ERR ' + e.message));
ok(sc?.score === 1.4 && sc.legend?.['2'] === 'high', 'scores pass through: ' + JSON.stringify(sc));
// long options get short keys and still map back
const long = 'x'.repeat(150);
r = await page.evaluate(o => runTool('decide', { state: 's', question: 'q', type: 'choice', options: ['short one', o] }, null), long); r = String(r?.content ?? r);
const lq = seen.filter(x => x.path === '/v1/systemone').at(-1).body.questions.q.criteria;
ok(r.startsWith('choice: ' + long) && lq.option_2 === long, 'an option too long for a key is sent as option_2 and maps back');
// a model typed with :cloud (the local-server name) is sent as the direct name
await page.evaluate(() => { S.ollayaModel = 'clef:cloud'; });
await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null));
ok(seen.at(-1).body.model === 'clef', 'clef:cloud is sent to ollama.com as clef');
await page.evaluate(() => { S.ollayaModel = 'clef'; S.ollayaKey = 'override'; });
await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null));
ok(seen.at(-1).auth === 'Bearer override', 'a key in the Decision models field wins over the provider key');
await page.evaluate(() => { S.ollayaKey = ''; S.ollamaKey = 'wrong'; });
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null).then(x => String(x?.content ?? x), e => 'ERR ' + e.message));
ok(/401|rejected/.test(r), 'a bad key is reported: ' + r);
await page.evaluate(() => { S.ollamaKey = 'cloud-key'; S.ollayaModel = 'laya'; });
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null).then(x => String(x?.content ?? x), e => 'ERR ' + e.message));
ok(/no decision model "laya"; try clef/.test(r), 'a model the cloud does not have says to try clef: ' + r);
await page.evaluate(() => { S.ollayaModel = 'clef'; });

// the model router decides on Ollama Cloud and routes
const pick = await page.evaluate(async () => { Object.assign(S, { routerOn: true, routerDecider: 'clef', routerModels: [{ prov: 'local', model: 'qwen3:8b', note: 'everyday chat' }, { prov: 'cloud', model: 'gpt-oss:120b', note: 'hard reasoning and long documents' }] }); try { return await routerAsk('Latest message: prove this lemma'); } catch (e) { return { error: e.message }; } finally { S.routerOn = false; } });
ok(pick.prov === 'cloud' && pick.model === 'gpt-oss:120b' && pick.conf === 0.61, 'the router asks clef on Ollama Cloud and routes to the picked model: ' + JSON.stringify(pick));

// local Ollama gets the same request shape
await page.route('http://127.0.0.1:11434/**', async route => {
  const body = JSON.parse(route.request().postData() || '{}'); seen.push({ path: 'local', body });
  const keys = Object.keys(body.questions.q.criteria || {});
  if (!keys.length) return route.fulfill({ status: 400, json: { error: 'criteria must be an object' } });
  return route.fulfill({ json: { model: body.model, answers: { q: { type: 'choice', choice: keys[0], probabilities: Object.fromEntries(keys.map((k, i) => [k, i ? 0.1 : 0.9])), confidence: 0.7 } } } });
});
await page.evaluate(() => Object.assign(S, { decideProv: 'ollama', decideOllamaHost: 'http://127.0.0.1:11434', ollayaModel: 'clef-flash' }));
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'choice', options: ['a', 'b'] }, null)); r = String(r?.content ?? r);
ok(/^choice: a \| confidence 0\.700/.test(r) && /probabilities: a 0\.900, b 0\.100/.test(r) && seen.at(-1).path === 'local', 'local Ollama gets object criteria too:\n' + r);

// settings
await page.evaluate(() => { S.decideProv = 'cloud'; openSettings(); const sel = document.querySelector('#sDecideProv'); sel.dispatchEvent(new Event('focus')); sel.value = 'cloud'; sel.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => [...document.querySelectorAll('#sDecideProv option')].map(o => o.value).join() === 'ollaya,ollama,cloud' && document.querySelector('#sOllayaHost').closest('div').hidden && /Ollama Cloud key/.test(document.querySelector('#sOllayaKey').placeholder)), 'servers: Ollaya, Ollama, Ollama Cloud; for the cloud no address field, and the key field explains itself');
await t.done();
