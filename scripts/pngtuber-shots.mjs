// Takes the PNGtuber screenshots and demo GIF for docs/pngtuber.md from the built page.
// Run:  CHROME=/usr/bin/google-chrome node scripts/pngtuber-shots.mjs   (needs dist/jade-vault.html and ffmpeg)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname, OUT = ROOT + 'docs/screenshots/';
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + ROOT + 'dist/jade-vault.html'); await p.waitForTimeout(3500);
const kind = () => p.evaluate(() => Jade.kind);
const out = { default: await kind() };
const clip = { x: 0, y: 54, width: 430, height: 215 };      // the avatar strip
for (const [m, name] of [['idle', 'neutral'], ['happy', 'happy'], ['error', 'sad'], ['working', 'mad'], ['thinking', 'shy']]) {
  await p.evaluate(m => Jade.setMood(m), m); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'pngtuber-' + name + '.png', clip });
}
await p.evaluate(() => Jade.setMood('idle')); await p.waitForTimeout(500);
await p.screenshot({ path: OUT + 'pngtuber-chat.png' });
// demo GIF: mood cycle with her speaking
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-')); let n = 0;
const cyc = ['idle', 'happy', 'thinking', 'working', 'error', 'happy', 'idle'];
await p.evaluate(() => { Jade.state.speaking = true; });
for (const m of cyc) {
  await p.evaluate(m => Jade.setMood(m), m);
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(110); await p.screenshot({ path: `${tmp}/f${String(n++).padStart(3, '0')}.png`, clip }); }
}
await p.evaluate(() => { Jade.state.speaking = false; });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '9', '-i', `${tmp}/f%03d.png`, '-vf', 'scale=430:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', OUT + 'pngtuber-moods.gif']);
// settings: the Avatar option
await p.evaluate(() => openSettings()); await p.waitForTimeout(600);
await p.getByRole('tab', { name: 'App', exact: true }).or(p.locator('button', { hasText: /^App$/i })).first().click(); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('sJadeAvatar')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + 'pngtuber-settings.png' });
out.setting = await p.evaluate(() => document.getElementById('sJadeAvatar')?.value);
await p.selectOption('#sJadeAvatar', 'live2d'); await p.waitForTimeout(4000); out.afterLive2D = await kind();
await p.selectOption('#sJadeAvatar', 'png'); await p.waitForTimeout(2000); out.back = await kind();
console.log(out, errs.filter(e => !/ERR_CONN/.test(e))); await b.close();
