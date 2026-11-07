// 2.27: OpenRouter as a model provider and as a decision server (OpenRouter's API is stood in for with page.route).
import { start } from './_harness.mjs';

const t = await start();
const { page, ok } = t;
await page.waitForFunction(() => typeof orSystemone === 'function' && typeof makeClientFor === 'function', null, { timeout: 90000 });

const seen = [];
let logprobs = true;
await page.route('https://openrouter.ai/api/v1/**', async route => {
  const req = route.request(); const url = req.url(); const h = req.headers();
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  seen.push({ url, h, body });
  if (url.endsWith('/models')) return route.fulfill({ json: { data: [
    { id: 'anthropic/claude-sonnet-4.5', supported_parameters: ['tools', 'temperature'] },
    { id: 'openai/gpt-4o-mini', supported_parameters: ['tools', 'logprobs', 'top_logprobs'] },
    { id: 'some/base-model', supported_parameters: ['temperature'] },
  ] } });
  if (h.authorization !== 'Bearer sk-or-test') return route.fulfill({ status: 401, json: { error: { message: 'No auth credentials found' } } });
  if (body.stream) {   // the chat
    const ev = o => `data: ${JSON.stringify(o)}\n\n`;
    const tools = body.messages.some(m => m.role === 'tool');
    const sse = tools ? ev({ choices: [{ delta: { content: 'Done: ' + body.messages.at(-1).content } }] }) + ev({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } }) + 'data: [DONE]\n\n'
      : ev({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'read', arguments: '{"path":' } }] } }] }) + ev({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"/or.md"}' } }] } }] }) + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: sse });
  }
  if (body.response_format) return route.fulfill({ json: { choices: [{ message: { content: '{"probabilities": {"A": 0.2, "B": 0.6, "C": 0.2}}' } }] } });
  // a decision: one letter, with log probabilities
  const top = [{ token: 'B', logprob: Math.log(0.7) }, { token: 'A', logprob: Math.log(0.2) }, { token: ' C', logprob: Math.log(0.05) }, { token: 'The', logprob: Math.log(0.05) }];
  return route.fulfill({ json: { choices: [{ message: { content: 'B' }, logprobs: logprobs ? { content: [{ token: 'B', logprob: Math.log(0.7), top_logprobs: top }] } : null }] } });
});

// ---------- the provider
ok(await page.evaluate(() => PROVIDERS.openrouter?.label === 'OpenRouter' && S.fallbackOrder.includes('openrouter')), 'OpenRouter is a provider and in the fallback order');
ok(await page.evaluate(() => /no OpenRouter API key/.test(providerMissing('openrouter', { ...S, orKey: '' }))), 'a missing key is named');
const listed = await page.evaluate(async () => (await tryProvider('openrouter', { ...S, orKey: 'sk-or-test' })).models);
ok(JSON.stringify(listed) === JSON.stringify(['anthropic/claude-sonnet-4.5', 'openai/gpt-4o-mini']), 'the model list keeps models that can call tools: ' + JSON.stringify(listed));
await page.evaluate(() => vfs.write('/or.md', 'from openrouter', { mkdirs: true }));
const chat = await page.evaluate(async () => {
  const c = makeClientFor('openrouter', { ...S, orKey: 'sk-or-test' }); const parts = [];
  for await (const p of await c.chat({ model: 'anthropic/claude-sonnet-4.5', messages: [{ role: 'user', content: 'read /or.md' }], tools: activeTools().slice(0, 3) })) parts.push(p);
  const calls = parts.flatMap(p => p.message?.tool_calls || []);
  const parts2 = [];
  for await (const p of await c.chat({ model: 'anthropic/claude-sonnet-4.5', messages: [{ role: 'user', content: 'read /or.md' }, { role: 'assistant', content: '', tool_calls: calls }, { role: 'tool', tool_name: 'read', content: 'from openrouter' }] })) parts2.push(p);
  return { call: calls[0]?.function, text: parts2.map(p => p.message?.content || '').join(''), done: parts2.at(-1) };
});
ok(chat.call?.name === 'read' && chat.call.arguments.path === '/or.md', 'streamed tool calls come back whole: ' + JSON.stringify(chat.call));
ok(chat.text === 'Done: from openrouter' && chat.done.done && chat.done.prompt_eval_count === 12, 'the answer and the token counts: ' + JSON.stringify(chat.text));
const sent = seen.find(x => x.body?.stream);
ok(sent.h['http-referer'] && sent.h['x-title'] === 'Jade Vault' && sent.h.authorization === 'Bearer sk-or-test', 'OpenRouter attribution headers and the key are sent');
ok(await page.evaluate(() => { const o = [...document.querySelectorAll('#sProvider option')].map(x => x.value); return o.includes('openrouter') && !!document.querySelector('#sOrKey') && ['#sAuxProv', '#sHbProv', '#provSel'].every(sel => !document.querySelector(sel) || [...document.querySelectorAll(sel + ' option')].some(x => x.value === 'openrouter')); }), 'OpenRouter is offered in every provider list, with its key field');
ok(await page.evaluate(() => SECRET_KEYS.includes('orKey')), 'the key is kept out of exports like the other keys');

// ---------- decisions
await page.evaluate(() => Object.assign(S, { orKey: 'sk-or-test', decideProv: 'openrouter', ollayaOn: true, ollayaModel: 'openai/gpt-4o-mini', ollayaKey: '' }));
ok(await page.evaluate(() => decName()) === 'OpenRouter', 'the decision server is named OpenRouter');
const scanned = await page.evaluate(() => ollayaScan());
ok(JSON.stringify(scanned) === JSON.stringify(['openai/gpt-4o-mini']), 'Scan lists the models that report log probabilities: ' + JSON.stringify(scanned));
let r = await page.evaluate(() => runTool('decide', { state: 'TypeError at list.js:42', question: 'What kind of problem?', type: 'choice', options: ['bug', 'network', 'user input'] }, null));
r = String(r?.content ?? r);
ok(/^choice: 1 \| confidence 0\.737/.test(r) && /probabilities: 1 0\.737, 0 0\.211, 2 0\.053/.test(r) && /model: openai\/gpt-4o-mini/.test(r), 'decide picks from the letter probabilities (normalised over the options):\n' + r);
const dreq = seen.filter(x => x.body && !x.body.stream).at(-1).body;
ok(dreq.logprobs === true && dreq.top_logprobs === 20 && dreq.max_tokens === 1 && dreq.temperature === 0 && /A\. bug\nB\. network\nC\. user input/.test(dreq.messages[1].content), 'it asks for one letter with log probabilities');
const yn = await page.evaluate(() => jadeBridge('decide', { state: 'x', question: 'Is it late?', type: 'yesno' }).catch(e => 'ERR ' + e.message));
ok(yn && yn.answer === true && yn.type === 'yesno' && Math.abs(yn.probabilities.yes - 0.778) < 0.01, 'yes/no through scripts\' jade.decide: ' + JSON.stringify(yn));
const sc = await page.evaluate(() => jadeBridge('decide', { state: 'x', question: 'How urgent?', type: 'score', options: ['low', 'medium', 'high'] }).catch(e => 'ERR ' + e.message));
ok(sc && sc.score === 1 && sc.legend === 'medium', 'scores: ' + JSON.stringify(sc));
logprobs = false;
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'choice', options: ['a', 'b', 'c'] }, null)); r = String(r?.content ?? r);
ok(/^choice: 1 \| confidence 0\.600/.test(r), 'a model without log probabilities is asked for them as JSON:\n' + r);
logprobs = true;
await page.evaluate(() => { S.orKey = 'wrong'; });
r = await page.evaluate(() => runTool('decide', { state: 's', question: 'q', type: 'choice', options: ['a', 'b'] }, null).then(x => String(x?.content ?? x), e => 'ERR ' + e.message));
ok(/rejected the API key/.test(r), 'a bad key is a clear error: ' + r);
await page.evaluate(() => { S.orKey = 'sk-or-test'; });
// the model router can decide through OpenRouter too
const pick = await page.evaluate(async () => { S.routerOn = true; S.routerModels = [{ prov: 'local', model: 'qwen3:8b', note: 'everyday chat' }, { prov: 'openrouter', model: 'anthropic/claude-sonnet-4.5', note: 'hard coding' }, { prov: 'groq', model: 'llama-3.3-70b', note: 'quick facts' }]; S.routerDecider = ''; try { return await routerAsk('Latest message: fix this race condition'); } catch (e) { return { error: e.message }; } finally { S.routerOn = false; } });
ok(pick.prov === 'openrouter' && pick.model === 'anthropic/claude-sonnet-4.5' && Math.abs(pick.conf - 0.737) < 0.01, 'the model router decides through OpenRouter and can route to it: ' + JSON.stringify(pick));
// settings: the address field is hidden for OpenRouter
await page.evaluate(() => { openSettings(); const sel = document.querySelector('#sDecideProv'); sel.dispatchEvent(new Event('focus')); sel.value = 'openrouter'; sel.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => document.querySelector('#sOllayaHost').closest('div').hidden && /OpenRouter key/.test(document.querySelector('#sOllayaKey').placeholder)), 'choosing OpenRouter hides the address and explains the key field');
await page.evaluate(() => { const sel = document.querySelector('#sDecideProv'); sel.dispatchEvent(new Event('focus')); sel.value = 'ollaya'; sel.dispatchEvent(new Event('change')); });
ok(await page.evaluate(() => !document.querySelector('#sOllayaHost').closest('div').hidden), 'and switching back shows it again');

await t.done();
