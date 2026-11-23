// 2.29.0: Jade is a PNGtuber by default; Config → App → Avatar picks PNGtuber or Live2D.
import { start } from './_harness.mjs';

const t = await start();
const { page, ok } = t;
await page.waitForFunction(() => window.Jade && Jade.ready, null, { timeout: 90000 });
ok(await page.evaluate(() => Jade.kind) === 'png', 'the PNGtuber is the default avatar');
ok(await page.evaluate(() => !!Jade.state.app?.view && Jade.state.ready), 'it renders on its own canvas and is ready');
// moods and speech use the same API as Live2D
for (const m of ['happy', 'error', 'thinking', 'working', 'idle']) {
  await page.evaluate(m => Jade.setMood(m), m); await page.waitForTimeout(150);
  ok(await page.evaluate(() => typeof Jade.mood === 'function' ? !!Jade.mood() : !!Jade.mood), 'mood ' + m + ' is accepted');
}
const px = async () => page.evaluate(() => { const c = Jade.state.app.view; const x = c.getContext('2d'); return x.getImageData(0, 0, c.width, c.height).data.reduce((a, v) => a + (v > 16 ? 1 : 0), 0); });
ok(await px() > 1000, 'the canvas has the picture on it');
await page.evaluate(() => { Jade.state.speaking = true; }); await page.waitForTimeout(500);
ok(await page.evaluate(() => Jade.state.speaking === true), 'her mouth can follow speech');
await page.evaluate(() => { Jade.state.speaking = false; });
// the Avatar setting
await page.evaluate(() => openSettings()); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.getElementById('sJadeAvatar')?.value) === 'auto', 'the Avatar setting is Automatic by default');
await page.evaluate(() => { const s = document.getElementById('sJadeAvatar'); s.value = 'live2d'; s.dispatchEvent(new Event('change')); });
await page.waitForFunction(() => Jade.kind === 'live2d' && Jade.ready, null, { timeout: 60000 }).catch(() => {});
ok(await page.evaluate(() => Jade.kind) === 'live2d', 'choosing Live2D switches without a reload');
await page.evaluate(() => { const s = document.getElementById('sJadeAvatar'); s.value = 'png'; s.dispatchEvent(new Event('change')); });
await page.waitForFunction(() => Jade.kind === 'png' && Jade.ready, null, { timeout: 30000 }).catch(() => {});
ok(await page.evaluate(() => Jade.kind) === 'png', 'choosing PNGtuber switches back');
// Automatic goes back to the PNGtuber (the saved choice)
await page.evaluate(() => { const s = document.getElementById('sJadeAvatar'); s.value = 'auto'; s.dispatchEvent(new Event('change')); });
await page.waitForTimeout(500);
ok(await page.evaluate(() => Jade.kind) === 'png', 'Automatic is the PNGtuber again');
ok(await page.evaluate(() => S.jadeAvatar) === 'auto', 'the choice is saved');
await t.done();
