// 2.28.1: the model dropdowns open a searchable list when they are long.
import { start } from './_harness.mjs';

const t = await start();
const { page, ok } = t;
await page.waitForFunction(() => typeof msOpen === 'function' && typeof openSettings === 'function', null, { timeout: 90000 });
const names = ['qwen3:8b', 'qwen3:32b', 'llama3.3:70b', 'gpt-oss:20b', 'gpt-oss:120b', 'gemma3:27b', 'deepseek-r1:14b', 'mistral-small:24b', 'phi4:14b', 'anthropic/claude-sonnet-4.5', 'openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct'];
await page.evaluate(n => { openSettings(); const sel = document.querySelector('#sModel'); sel.innerHTML = n.map(x => `<option>${x}</option>`).join(''); sel.value = 'qwen3:8b'; window.__chg = 0; sel.addEventListener('change', () => window.__chg++); }, names);
ok(await page.evaluate(() => /Tap to search 12 models/.test(document.querySelector('#sModel').title)), 'a long model list says it can be searched');
await page.locator('#sModel').click();
ok(await page.isVisible('.ms-bg .ms-q'), 'clicking it opens the search instead of the native list');
ok(await page.locator('.ms-it').count() === 12 && await page.locator('.ms-on').textContent() === 'qwen3:8b', 'all models are listed, the current one marked');
await page.fill('.ms-q', 'oss 120');
ok(await page.locator('.ms-it:not(.ms-use)').count() === 1 && await page.locator('.ms-it').first().textContent() === 'gpt-oss:120b', 'words in any order narrow it');
await page.fill('.ms-q', 'LLAMA');
ok(await page.locator('.ms-it:not(.ms-use)').count() === 2, 'case does not matter');
await page.locator('.ms-it', { hasText: 'meta-llama' }).click();
ok(await page.evaluate(() => document.querySelector('#sModel').value === 'meta-llama/llama-3.3-70b-instruct' && window.__chg === 1) && !(await page.isVisible('.ms-bg')), 'tapping one chooses it, fires change, and closes');
// Enter picks the only match; a name not in the list can be used
await page.locator('#sModel').click(); await page.fill('.ms-q', 'phi4'); await page.press('.ms-q', 'Enter');
ok(await page.evaluate(() => document.querySelector('#sModel').value) === 'phi4:14b', 'Enter picks the only match');
await page.locator('#sModel').click(); await page.fill('.ms-q', 'my-new-model:7b');
ok(/Use “my-new-model:7b”/.test(await page.locator('.ms-use').textContent()), 'a name that is not listed can be used');
await page.locator('.ms-use').click();
ok(await page.evaluate(() => document.querySelector('#sModel').value) === 'my-new-model:7b', 'and is then selected');
// Escape closes without changing anything
await page.locator('#sModel').click(); await page.keyboard.press('Escape');
ok(!(await page.isVisible('.ms-bg')) && !(await page.isHidden('#settings')), 'Escape closes the search and leaves Config open');
ok(await page.evaluate(() => document.querySelector('#sModel').value) === 'my-new-model:7b', 'and changes nothing');
// short lists keep the native dropdown
await page.evaluate(() => { document.querySelector('#sOllayaModel').innerHTML = '<option>clef</option><option>clef-flash</option>'; });
await page.locator('#sOllayaModel').click({ force: true }).catch(() => {});
ok(!(await page.isVisible('.ms-bg')), 'a short list keeps the native dropdown');
// the other model lists are wired too
ok(await page.evaluate(() => ['modelSel', 'sModel', 'sHbModel', 'sAuxModel', 'sOllayaModel'].every(id => document.getElementById(id)?.dataset.ms === '1')), 'every model dropdown has search');
// a tap on a phone
await page.evaluate(n => { const sel = document.querySelector('#modelSel'); sel.innerHTML = n.map(x => `<option>${x}</option>`).join(''); }, names);
const tapped = await page.evaluate(() => { const sel = document.querySelector('#modelSel'); const r = sel.getBoundingClientRect(); const mk = (type) => { const tt = new Touch({ identifier: 1, target: sel, clientX: r.left + 5, clientY: r.top + 5 }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [tt], changedTouches: [tt], bubbles: true, cancelable: true }); }; sel.dispatchEvent(mk('touchstart')); const e = mk('touchend'); sel.dispatchEvent(e); return e.defaultPrevented; });
ok(tapped && await page.isVisible('.ms-bg'), 'a tap opens the search and stops the native list');
await page.keyboard.press('Escape');
await t.done();
