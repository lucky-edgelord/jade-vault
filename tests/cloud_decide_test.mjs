// 2.28: decisions (and the model router) on Ollama Cloud: laya, jev… at https://ollama.com/v1/systemone (stood in for with page.route).
import { start } from './_harness.mjs';

const t = await start();
const { page, ok } = t;
await page.waitForFunction(() => typeof runTool === 'function' && typeof routerAsk === 'function', null, { timeout: 90000 });
const seen = [];
await page.route('https://ollama.com/**', async route => {
  const req = route.request(); const url = new URL(req.url()); const h = req.headers(); const body = req.postData() ? JSON.parse(req.postData()) : null;
  seen.push({ path: url.pathname, auth: h.authorization, body });
  if (h.authorization !== 'Bearer cloud-key' && h.authorization !== 'Bearer override') return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
  if (url.pathname === '/api/tags') return route.fulfill({ json: { models: [{ name: 'laya' }, { name: 'jev' }, { name: 'gpt-oss:120b' }] } });
  if (url.pathname === '/v1/systemone') {
    const q = body.questions.q;
    const a = q.type === 'noul' ? { noul: true, confidence: 0.91, probabilities: { yes: 0.91, no: 0.09 } } : { choice: 1, confidence: 0.82, probabilities: q.criteria.map((_, i) => (i === 1 ? 0.82 : 0.18 / (q.criteria.length - 1))) };
    return route.fulfill({ json: { model: body.model, answers: { q: a } } });
  }
  return route.fulfill({ status: 404, json: { error: 'not found' } });
});
await page.evaluate(() => Object.assign(S, { ollamaKey: 'cloud-key', decideProv: 'cloud', ollayaOn: true, ollayaModel: 'laya', ollayaKey: '' }));
ok(await page.evaluate(() => decName()) === 'Ollama Cloud', 'the decision server is Ollama Cloud');
const models = await page.evaluate(() => ollayaScan().catch(e => 'ERR ' + e.message));
ok(Array.isArray(models) && models.includes('laya') && models.includes('jev'), 'Scan lists the cloud decision models: ' + JSON.stringify(models));
let r = await page.evaluate(() => runTool('decide', { state: 'TypeError at list.js:42', question: 'What kind of problem?', type: 'choice', options: ['bug', 'network', 'user input'] }, null)); r = String(r?.content ?? r);
ok(/^choice: 1 \| confidence 0\.820/.test(r) && /model: laya/.test(r), 'decide answers from laya on Ollama Cloud:\n' + r);
const last = seen.filter(x => x.path === '/v1/systemone').at(-1);
ok(last.auth === 'Bearer cloud-key' && last.body.model === 'laya' && last.body.questions.q.criteria.length === 3, 'it calls ollama.com/v1/systemone with the Ollama Cloud key');
const yn = await page.evaluate(() => jadeBridge('decide', { state: 'x', question: 'Is it late?', type: 'yesno' }).catch(e => 'ERR ' + e.message));
ok(yn?.answer === true && yn.confidence === 0.91, 'yes/no through scripts: ' + JSON.stringify(yn));
await page.evaluate(() => { S.ollayaKey = 'override'; });
await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null));
ok(seen.at(-1).auth === 'Bearer override', 'a key in the Decision models field wins over the provider key');
await page.evaluate(() => { S.ollayaKey = ''; S.ollamaKey = 'wrong'; });
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'yesno' }, null).then(x => String(x?.content ?? x), e => 'ERR ' + e.message));
ok(/401|rejected/.test(r), 'a bad key is reported: ' + r);
await page.evaluate(() => { S.ollamaKey = 'cloud-key'; });
// the model router decides on Ollama Cloud (jev) and can route to Ollama Cloud models
const pick = await page.evaluate(async () => { Object.assign(S, { routerOn: true, routerDecider: 'jev', routerModels: [{ prov: 'local', model: 'qwen3:8b', note: 'everyday chat' }, { prov: 'cloud', model: 'gpt-oss:120b', note: 'hard reasoning' }] }); try { return await routerAsk('Latest message: prove this lemma'); } catch (e) { return { error: e.message }; } finally { S.routerOn = false; } });
ok(pick.prov === 'cloud' && pick.model === 'gpt-oss:120b' && pick.conf === 0.82 && seen.at(-1).body.model === 'jev', 'the router asks jev on Ollama Cloud and routes to an Ollama Cloud model: ' + JSON.stringify(pick));
// settings
await page.evaluate(() => { openSettings(); const sel = document.querySelector('#sDecideProv'); sel.dispatchEvent(new Event('focus')); sel.value = 'cloud'; sel.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => [...document.querySelectorAll('#sDecideProv option')].some(o => o.value === 'cloud') && document.querySelector('#sOllayaHost').closest('div').hidden && /Ollama Cloud key/.test(document.querySelector('#sOllayaKey').placeholder)), 'Ollama Cloud is a decision server choice; no address field, the key field explains itself');
await t.done();
