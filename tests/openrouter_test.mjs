// 2.27: OpenRouter as a model provider; 2.28.1: also a fallback, and no longer a decision server (OpenRouter's API is stood in for with page.route).
import { start } from './_harness.mjs';

const t = await start();
const { page, ok } = t;
await page.waitForFunction(() => typeof orModels === 'function' && typeof makeClientFor === 'function', null, { timeout: 90000 });

const seen = [];
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
  return route.fulfill({ status: 400, json: { error: { message: 'unexpected request' } } });
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

// ---------- a fallback: the main provider is down, OpenRouter answers
await page.route('http://127.0.0.1:9/**', r => r.abort());
const fb = await page.evaluate(async () => {
  Object.assign(S, { provider: 'local', host: 'http://127.0.0.1:9', orKey: 'sk-or-test', fallbacks: ['openrouter'], modelBy: { ...(S.modelBy || {}), openrouter: 'anthropic/claude-sonnet-4.5' } });
  const order = typeof fallbackChain === 'function' ? fallbackChain() : S.fallbacks;
  return { order, missing: providerMissing('openrouter') };
});
ok(fb.missing === '' || fb.missing == null || fb.missing === false, 'with a key, OpenRouter is ready as a fallback: ' + JSON.stringify(fb));
// the fallback list in Config: tick OpenRouter, type its key, the "needs key" mark goes away
await page.evaluate(() => { S.fallbacks = []; S.orKey = ''; openSettings(); document.querySelector('[data-tab="model"]')?.click(); });
await page.evaluate(() => { const sel = document.querySelector('#sProvider'); sel.value = 'local'; sel.dispatchEvent(new Event('change')); });
const row = page.locator('#fbList .fb-row[data-p="openrouter"]');
ok(await row.count() === 1, 'OpenRouter is a row in the fallback list');
await row.locator('input[type=checkbox]').check();
ok(/needs key/.test(await row.textContent()) && await page.isVisible('#sOrKey'), 'ticking it asks for the key and shows the key field');
await page.fill('#sOrKey', 'sk-or-test');
ok(!/needs key/.test(await page.locator('#fbList .fb-row[data-p="openrouter"]').textContent()), 'typing the key clears "needs key"');
await page.click('#btnSave'); await page.waitForTimeout(500);
ok(await page.evaluate(() => S.fallbacks.includes('openrouter')), 'saving keeps OpenRouter in the fallbacks: ' + await page.evaluate(() => JSON.stringify(S.fallbacks)));

// ---------- not a decision server any more
ok(await page.evaluate(() => ![...document.querySelectorAll('#sDecideProv option')].some(o => o.value === 'openrouter')), 'OpenRouter is not offered as a decision server');
ok(await page.evaluate(() => typeof orSystemone === 'undefined' && typeof orDecideFetch === 'undefined'), 'the OpenRouter decision code is gone');

await t.done();
