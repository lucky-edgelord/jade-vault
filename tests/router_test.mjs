// The model router (2.23): before each main-chat turn the decision model picks which listed model answers.
import { start } from './_harness.mjs';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const MODELS = [{ prov: 'local', model: 'qwen3:8b', note: 'quick everyday chat' }, { prov: 'openai', model: 'big-coder', note: 'coding and hard reasoning' }];
const t = await start({ settings: { routerOn: true, routerModels: MODELS, oaiHost: 'http://localhost:9922/v1', oaiKey: 'k' } });
const { page, ok, extraRoutes } = t;

const seen = { decide: [], oai: [], ollamaModels: [], oaiFail: false, decideFail: false };
extraRoutes.push(async route => {
  const req = route.request(); const url = req.url();
  if (url === 'http://localhost:11434/api/chat') { const b = JSON.parse(req.postData()); if (b.stream) seen.ollamaModels.push(b.model); return false; }
  if (url === 'http://localhost:9911/v1/systemone') {
    const b = JSON.parse(req.postData()); seen.decide.push(b);
    if (seen.decideFail) return route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: 'laya is loading' }) }), true;
    const q = b.questions.q; const pick = /code|parser/i.test(b.state) ? q.criteria[1] : q.criteria[0];
    await route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ model: b.model, answers: { q: { choice: pick, confidence: 0.83, probabilities: Object.fromEntries(q.criteria.map(c => [c, c === pick ? 0.83 : 0.17])) } } }) });
    return true;
  }
  if (url.startsWith('http://localhost:9922/v1/')) {
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return true; }
    if (url.endsWith('/models')) { await route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'big-coder' }] }) }); return true; }
    if (url.endsWith('/chat/completions')) {
      const b = JSON.parse(req.postData()); seen.oai.push(b);
      if (seen.oaiFail) { await route.fulfill({ status: 503, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { message: 'overloaded' } }) }); return true; }
      const ev = o => `data: ${JSON.stringify(o)}\n\n`;
      await route.fulfill({ headers: { ...CORS, 'Content-Type': 'text/event-stream' }, body: ev({ choices: [{ index: 0, delta: { content: 'Big model here.' } }] }) + ev({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 3 } }) + 'data: [DONE]\n\n' });
      return true;
    }
  }
  return false;
});

const say = async text => { await page.evaluate(t => send(t), text); await page.waitForFunction(() => !running, null, { timeout: 30000 }); await page.waitForTimeout(200); };
const lastTag = () => page.evaluate(() => [...document.querySelectorAll('.router-tag')].at(-1)?.textContent || '');
const lastAsst = () => page.evaluate(() => cur.messages.filter(m => m.role === 'assistant').at(-1));

// everyday message: the quick model on the main provider
await say('hello there');
ok(seen.decide.length === 1 && seen.decide[0].model === 'judge-1', 'the decision model (ollayaModel) was asked once: ' + seen.decide.length);
ok(JSON.stringify(seen.decide[0].questions.q.criteria) === JSON.stringify(['quick everyday chat', 'coding and hard reasoning']), 'the notes are the choices');
ok(/hello there/.test(seen.decide[0].state), 'laya reads the message');
ok(seen.ollamaModels.at(-1) === 'qwen3:8b' && /qwen3:8b · 83%/.test(await lastTag()), 'quick model answered, tag shows it: ' + await lastTag());

// coding message: the big model on another provider (its own client, key and address)
await say('write code for a parser');
ok(seen.oai.length === 1 && seen.oai[0].model === 'big-coder', 'the big model on the OpenAI-compatible endpoint answered');
ok((await lastAsst()).content === 'Big model here.' && (await lastAsst()).model === 'big-coder', 'its reply is saved with its model');
ok(/OpenAI-compatible · big-coder/.test(await lastTag()), 'tag names the provider: ' + await lastTag());
ok(/Previous reply/.test(seen.decide.at(-1).state), 'the previous reply goes along for context');
ok(await page.evaluate(() => (S.provider || 'local') === 'local' && S.model === 'qwen3:8b'), 'the main provider and model are unchanged');

// the picked model fails: the main model answers instead
seen.oaiFail = true; const n0 = seen.ollamaModels.length;
await say('more code please');
ok(seen.ollamaModels.length === n0 + 1 && /Agent says/.test((await lastAsst()).content), 'picked model failed, main model answered');
seen.oaiFail = false;

// the decision fails: the main model answers, the tag says why
seen.decideFail = true;
await say('write code again');
ok(/main model \(router: .*laya is loading/.test(await lastTag()) && seen.ollamaModels.at(-1) === 'qwen3:8b', 'decision failed, main model: ' + await lastTag());
seen.decideFail = false;

// unsure (below routerMin): main model
await page.evaluate(() => { S.routerMin = 0.9; });
const o0 = seen.oai.length;
await say('code me a parser');
ok(seen.oai.length === o0 && /unsure \(83%\)/.test(await lastTag()), 'unsure decision: main model');
await page.evaluate(() => { S.routerMin = 0; });

// background turns (heartbeat, bridges, curiosity) call agentLoop() without route: no decision
const d0 = seen.decide.length;
await page.evaluate(async () => { cur.messages.push({ role: 'user', content: 'write code (from a bridge)' }); await agentLoop(); });
ok(seen.decide.length === d0, 'background turns are not routed');

// off: no decision
await page.evaluate(() => { S.routerOn = false; });
await say('write code once more');
ok(seen.decide.length === d0, 'router off: no decision');

// Config: the text box parses "provider | model | note" lines; Test routing asks the decision model
const cfg = await page.evaluate(async () => {
  openSettings();
  $('#sRouterOn').checked = true;
  $('#sRouterModels').value = 'local | qwen3:8b | quick chat\n# a comment\ngroq | openai/gpt-oss-120b | hard reasoning, coding\nllama3.2:3b | tiny';
  $('#sRouterModels').dispatchEvent(new Event('change'));
  $('#sRouterTry').value = 'write code for me';
  $('#btnRouterTest').click();
  await new Promise(r => setTimeout(r, 600));
  return { models: S.routerModels, on: S.routerOn, note: $('#routerNote').textContent, saved: JSON.parse(localStorage.getItem('jvault:settings')).routerModels };
});
ok(cfg.on && cfg.models.length === 3 && cfg.models[1].prov === 'groq' && cfg.models[1].model === 'openai/gpt-oss-120b' && cfg.models[2].prov === '' && cfg.models[2].model === 'llama3.2:3b' && cfg.models[2].note === 'tiny', 'models parse: ' + JSON.stringify(cfg.models));
ok(cfg.saved?.length === 3, 'saved');
ok(/Groq · openai\/gpt-oss-120b \(83% sure\)/.test(cfg.note), 'test routing shows the pick: ' + cfg.note);
const back = await page.evaluate(() => { S.routerModels = [{ prov: 'cloud', model: 'gpt-oss:120b', note: 'big' }, { prov: '', model: 'qwen3:8b', note: 'small' }]; routerFill(); return $('#sRouterModels').value; });
ok(back === 'cloud | gpt-oss:120b | big\nqwen3:8b | small', 'settings fill the text box: ' + JSON.stringify(back));

await t.done();
process.exit(t.fail.length ? 1 : 0);
