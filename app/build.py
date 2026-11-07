#!/usr/bin/env python3
"""Build Jade Vault: apply the Jade Vault layers (v2 … v16) to the pi-netrunner base page and
write dist/jade-vault.html. Every edit is an exact-match replacement that must hit exactly once,
so a drifted base fails loudly instead of building something half-patched.

    python3 app/build.py            (run from anywhere; paths are relative to the repo)
"""
import re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(D)
NM = os.environ.get('JV_NODE_MODULES', os.path.join(ROOT, 'node_modules')) + '/'
DIST = os.path.join(ROOT, 'dist'); os.makedirs(DIST, exist_ok=True)
src = open(os.path.join(D, 'base', 'pi-netrunner-mobile.html')).read()
s = src
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n < 1: sys.exit(f'MISSING: {old[:90]!r}')
    if count == 1 and n != 1: sys.exit(f'AMBIGUOUS ({n}): {old[:90]!r}')
    s = s.replace(old, new)
def rep_between(start, end, new, keep_end=True):
    global s
    i = s.find(start); j = s.find(end, i + 1)
    if i < 0 or j < 0: sys.exit(f'RANGE MISSING: {start[:60]!r} .. {end[:60]!r}')
    s = s[:i] + new + (s[j:] if keep_end else s[j + len(end):])
def rd(n): return open(os.path.join(D, 'modules', n)).read()

# ---------- branding + storage ----------
rep('<title>Pi Netrunner Mobile</title>', '<title>Jade Vault</title>')
rep('data-text="NETRUNNER">NETRUNNER<', 'data-text="JADE VAULT">JADE VAULT<')
rep('PI NETRUNNER MOBILE · JADE CAT EDITION', 'JADE VAULT · MARKDOWN KNOWLEDGE DECK')
rep("localStorage.getItem('pinet:' + k)", "localStorage.getItem('jvault:' + k)")
rep("localStorage.setItem('pinet:' + k,", "localStorage.setItem('jvault:' + k,")
rep("indexedDB.open('pi-netrunner', 1)", "indexedDB.open('jade-vault', 1)")
rep("c.o(`Pi Netrunner shell — ", "c.o(`Jade Vault shell — ")
rep("<span>π Netrunner</span>", "<span>◆ Jade</span>")
rep("out.push('## Netrunner', '', m.content, '')", "out.push('## Jade', '', m.content, '')")
rep('placeholder="Read TODO.md and summarise what is left, then suggest the next step."', 'placeholder="Read Inbox.md and file each item into its own linked note."')

# ---------- Jade's gemstone color themes ----------
rep("jadeFrame: 'portrait',", "jadeFrame: 'portrait', jadeTheme: 'jade', jadeSpectrum: '#bd72f3', jadeGradientStart: '#f34b68', jadeGradientEnd: '#62a4ff', jadeGradientDirection: 'vertical', jadeHairMode: 'original', jadeHairColor: '#342c3c', jadeHairEnd: '#b58af4', jadeHairDirection: 'vertical', jadeClothesMode: 'original', jadeClothesColor: '#382f47', jadeClothesEnd: '#62a4ff', jadeClothesDirection: 'vertical', jadeStockingsMode: 'original', jadeStockingsColor: '#252330', jadeStockingsEnd: '#9c86bc', jadeStockingsDirection: 'vertical', jadeBootsMode: 'original', jadeBootsColor: '#20212a', jadeBootsEnd: '#f4c95d', jadeBootsDirection: 'vertical', jadeSkinMode: 'original', jadeSkinTone: 'fair', jadeSkinColor: '#d29b7c', jadeSkinEnd: '#f1d0c5', jadeSkinDirection: 'vertical',")
JADE_THEMES_JS = r'''const JADE_THEMES = Object.freeze({
  jade:      { name: 'Jade',      accent: '#1fe5a5', rgb: [31, 229, 165],  highlight: '#ffb8c6', highlightRgb: [255, 184, 198], line: '#1d6b52', ink: '#00140c' },
  ruby:      { name: 'Ruby',      accent: '#f34b68', rgb: [243, 75, 104], highlight: '#ffb7c2', highlightRgb: [255, 183, 194], line: '#792a3d', ink: '#25050b' },
  amethyst:  { name: 'Amethyst',  accent: '#b58af4', rgb: [181, 138, 244], highlight: '#e5c9ff', highlightRgb: [229, 201, 255], line: '#5e477d', ink: '#160b25' },
  gold:      { name: 'Gold',      accent: '#f4c95d', rgb: [244, 201, 93], highlight: '#ffe3a3', highlightRgb: [255, 227, 163], line: '#79602c', ink: '#211800' },
  sapphire:  { name: 'Sapphire',  accent: '#62a4ff', rgb: [98, 164, 255], highlight: '#b9d6ff', highlightRgb: [185, 214, 255], line: '#365a89', ink: '#061426' },
  diamond:   { name: 'Diamond',   accent: '#9cecf4', rgb: [156, 236, 244], highlight: '#d9fbff', highlightRgb: [217, 251, 255], line: '#3f747d', ink: '#061619' },
  'rose-gold': { name: 'Rose Gold', accent: '#e7a0a5', rgb: [231, 160, 165], highlight: '#ffd0c7', highlightRgb: [255, 208, 199], line: '#785052', ink: '#261011' },
  emerald:   { name: 'Emerald',   accent: '#24d18b', rgb: [36, 209, 139], highlight: '#a6f1d1', highlightRgb: [166, 241, 209], line: '#176d4b', ink: '#001a10' },
  obsidian:  { name: 'Obsidian',  accent: '#aebbd0', rgb: [174, 187, 208], highlight: '#d6dfec', highlightRgb: [214, 223, 236], line: '#515e72', ink: '#111722' },
  quartz:    { name: 'Quartz',    accent: '#e3b5ed', rgb: [227, 181, 237], highlight: '#f5dcfb', highlightRgb: [245, 220, 251], line: '#705478', ink: '#211224' },
  spectrum:  { name: 'Spectrum', accent: '#bd72f3', rgb: [189, 114, 243], highlight: '#e1c0fa', highlightRgb: [225, 192, 250], line: '#57366f', ink: '#160d1c' },
  'custom-gradient': { name: 'Custom Gradient', accent: '#f34b68', rgb: [243, 75, 104], highlight: '#62a4ff', highlightRgb: [98, 164, 255], line: '#792a3d', ink: '#160a1d' },
});'''
JADE_THEME_UTILS_JS = r'''const JADE_APPEARANCE_PARTS = Object.freeze([
  { id: 'hair', label: 'Hair' }, { id: 'clothes', label: 'Clothes' }, { id: 'stockings', label: 'Stockings' }, { id: 'boots', label: 'Boots' }, { id: 'skin', label: 'Skin' },
]);
const JADE_SKIN_TONES = Object.freeze({
  porcelain: { label: 'Porcelain', color: '#f2d6d1' }, fair: { label: 'Fair', color: '#e9c1ac' }, light: { label: 'Light', color: '#d8a181' },
  medium: { label: 'Medium', color: '#bd805f' }, tan: { label: 'Tan', color: '#9b654a' }, deep: { label: 'Deep', color: '#704533' },
});
// Source-texture rectangles for the bundled 2048×2048 atlas; keep these in sync with l2d-tex.
const JADE_APPEARANCE_REGIONS = Object.freeze({
  skin: [[0, 0, 220, 280], [0, 270, 320, 510], [600, 250, 850, 500], [560, 560, 820, 700], [850, 600, 1180, 1060], [0, 730, 920, 1120], [0, 1080, 700, 1400]],
  hair: [[0, 460, 520, 750], [900, 0, 1200, 570], [1140, 240, 1340, 850]],
  clothes: [[240, 0, 700, 650], [650, 0, 950, 760], [0, 280, 300, 510], [870, 620, 1160, 1040], [0, 1080, 700, 1370]],
  stockings: [[160, 740, 920, 1110]], boots: [[0, 740, 180, 1110]],
});
function jadeHexRgb(hex, fallback = '#1fe5a5') {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex || ''));
  const h = m ? m[1] : fallback.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function jadeRgbHex(rgb) { return '#' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join(''); }
function jadeMixHex(a, b, amount) {
  const x = jadeHexRgb(a), y = jadeHexRgb(b);
  return jadeRgbHex(x.map((c, i) => c * (1 - amount) + y[i] * amount));
}
function jadeContrastInk(rgb) {
  const luminance = rgb.reduce((sum, c, i) => sum + (c / 255) * [0.2126, 0.7152, 0.0722][i], 0);
  return luminance > 0.48 ? '#07100d' : '#f5f7ff';
}
function resolveJadeTheme(name) {
  const preset = JADE_THEMES[name] || JADE_THEMES.jade;
  if (name === 'spectrum') {
    const accent = /^#[\da-f]{6}$/i.test(String(S.jadeSpectrum)) ? S.jadeSpectrum : JADE_THEMES.spectrum.accent;
    const rgb = jadeHexRgb(accent), highlight = jadeMixHex(accent, '#ffffff', 0.48), highlightRgb = jadeHexRgb(highlight);
    return { ...preset, accent, rgb, highlight, highlightRgb, line: jadeMixHex(accent, '#000000', 0.58), ink: jadeContrastInk(rgb), avatarStartRgb: rgb, avatarEndRgb: rgb, isGradient: false, direction: 'vertical', cssGradient: `linear-gradient(90deg, ${accent}, ${highlight})` };
  }
  if (name === 'custom-gradient') {
    const start = /^#[\da-f]{6}$/i.test(String(S.jadeGradientStart)) ? S.jadeGradientStart : JADE_THEMES['custom-gradient'].accent;
    const end = /^#[\da-f]{6}$/i.test(String(S.jadeGradientEnd)) ? S.jadeGradientEnd : JADE_THEMES['custom-gradient'].highlight;
    const direction = ['vertical', 'horizontal', 'diagonal'].includes(S.jadeGradientDirection) ? S.jadeGradientDirection : 'vertical';
    const rgb = jadeHexRgb(start), highlightRgb = jadeHexRgb(end), midpoint = rgb.map((c, i) => (c + highlightRgb[i]) / 2);
    const angle = direction === 'vertical' ? '180deg' : direction === 'horizontal' ? '90deg' : '135deg';
    return { ...preset, accent: start, rgb, highlight: end, highlightRgb, line: jadeMixHex(start, '#000000', 0.58), ink: jadeContrastInk(midpoint), avatarStartRgb: rgb, avatarEndRgb: highlightRgb, isGradient: true, direction, cssGradient: `linear-gradient(${angle}, ${start}, ${end})` };
  }
  return { ...preset, avatarStartRgb: preset.rgb, avatarEndRgb: preset.rgb, isGradient: false, direction: 'vertical', cssGradient: `linear-gradient(90deg, ${preset.accent}, ${preset.highlight})` };
}'''
rep('const Jade = (() => {', JADE_THEMES_JS + '\n' + JADE_THEME_UTILS_JS + '\nconst Jade = (() => {')
rep("    cur: {}, frame: 'portrait', onStatus: () => {}, onSpeak: () => {},", "    cur: {}, frame: 'portrait', theme: 'jade', tintFilter: null, appearanceCanvas: null, appearanceContext: null, appearanceData: null, appearanceOriginal: null, appearanceMasks: null, appearanceTexture: null, onStatus: () => {}, onSpeak: () => {},")
rep("  const EXPR_KEYS = [P.BROW_LY, P.BROW_RY, P.BROW_LA, P.BROW_RA, P.BROW_LF, P.BROW_RF, P.MOUTH_FORM, P.SMILE_L, P.SMILE_R, P.CHEEK];", """  const EXPR_KEYS = [P.BROW_LY, P.BROW_RY, P.BROW_LA, P.BROW_RA, P.BROW_LF, P.BROW_RF, P.MOUTH_FORM, P.SMILE_L, P.SMILE_R, P.CHEEK];
  // Theme filter recolors emerald accents; the canvas texture handles separate appearance modes.
  const GEM_TINT_FRAGMENT = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uGradient;
    uniform float uDirection;
    void main(void) {
      vec4 source = texture2D(uSampler, vTextureCoord);
      vec3 rgb = source.rgb;
      float high = max(rgb.r, max(rgb.g, rgb.b));
      float low = min(rgb.r, min(rgb.g, rgb.b));
      float green = smoothstep(0.02, 0.18, rgb.g - max(rgb.r, rgb.b));
      float saturation = smoothstep(0.04, 0.25, high - low);
      float mask = green * saturation;
      float luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      float gradientT = vTextureCoord.y;
      if (uDirection > 0.5) gradientT = vTextureCoord.x;
      if (uDirection > 1.5) gradientT = clamp((vTextureCoord.x + 1.0 - vTextureCoord.y) * 0.5, 0.0, 1.0);
      vec3 targetColor = mix(uColor, uColor2, gradientT * uGradient);
      float gemLuminance = max(dot(targetColor, vec3(0.2126, 0.7152, 0.0722)), 0.08);
      vec3 gem = targetColor * clamp(luminance / gemLuminance, 0.08, 1.35);
      gl_FragColor = vec4(mix(rgb, gem, mask), source.a);
    }
  `;""")
rep("    app.stage.addChild(model);\n    const core = model.internalModel.coreModel;", """    app.stage.addChild(model);
    try {
      state.tintFilter = new PIXI.Filter(undefined, GEM_TINT_FRAGMENT, { uColor: JADE_THEMES.jade.rgb.map(c => c / 255), uColor2: JADE_THEMES.jade.rgb.map(c => c / 255), uGradient: 0, uDirection: 0 });
      state.tintFilter.padding = 2; model.filters = [state.tintFilter];
    } catch (e) { state.tintFilter = null; console.warn('Jade gem-color filter unavailable', e); }
    setTheme(S.jadeTheme);
    const core = model.internalModel.coreModel;""")
rep("  async function init({ host, onStatus, onSpeak } = {}) {", r"""  const JADE_APPEARANCE_ORDER = ['boots', 'stockings', 'hair', 'clothes'];
  const JADE_APPEARANCE_FALLBACKS = { hair: '#342c3c', clothes: '#382f47', stockings: '#252330', boots: '#20212a', skin: '#d29b7c' };
  function jadeIsSkinPixel(r, g, b) {
    const rg = r - g, rb = r - b;
    return r > 90 && rg > 4 && rg < 105 && rb > 12 && rb < 112 && g > b * 0.88;
  }
  function jadeBuildAppearanceMasks(width, height, source) {
    const sx = width / 2048, sy = height / 2048, masks = {}, claimed = new Uint8Array(width * height);
    for (const [part, boxes] of Object.entries(JADE_APPEARANCE_REGIONS)) {
      masks[part] = boxes.map(([x0, y0, x1, y1]) => ({ box: [x0 * sx, y0 * sy, x1 * sx, y1 * sy], indices: [] }));
    }
    const collect = (part, skinOnly) => {
      for (const region of masks[part]) {
        const [x0, y0, x1, y1] = region.box;
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(height, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(width, Math.ceil(x1)); x++) {
          const pixel = y * width + x;
          if (claimed[pixel]) continue;
          const offset = pixel * 4;
          if (source[offset + 3] < 16) continue;
          const skin = jadeIsSkinPixel(source[offset], source[offset + 1], source[offset + 2]);
          if (skinOnly ? !skin : skin) continue;
          claimed[pixel] = 1; region.indices.push(offset);
        }
      }
    };
    collect('skin', true);
    for (const part of JADE_APPEARANCE_ORDER) collect(part, false);
    for (const regions of Object.values(masks)) for (const region of regions) region.indices = new Uint32Array(region.indices);
    return masks;
  }
  function jadeAppearanceSettings(part) {
    const cap = part[0].toUpperCase() + part.slice(1), modeKey = `jade${cap}Mode`;
    let mode = S[modeKey] || 'original';
    const validModes = part === 'skin' ? ['original', 'natural', 'spectrum', 'gradient'] : ['original', 'spectrum', 'gradient'];
    if (!validModes.includes(mode)) mode = 'original';
    let start = S[`jade${cap}Color`], end = S[`jade${cap}End`];
    if (part === 'skin' && mode === 'natural') start = JADE_SKIN_TONES[S.jadeSkinTone]?.color || JADE_SKIN_TONES.fair.color;
    const fallback = JADE_APPEARANCE_FALLBACKS[part];
    if (!/^#[\da-f]{6}$/i.test(String(start || ''))) start = fallback;
    if (!/^#[\da-f]{6}$/i.test(String(end || ''))) end = fallback;
    const direction = ['vertical', 'horizontal', 'diagonal'].includes(S[`jade${cap}Direction`]) ? S[`jade${cap}Direction`] : 'vertical';
    return { mode, start, end, direction };
  }
  function jadeGradientAmount(x, y, box, direction) {
    const nx = Math.max(0, Math.min(1, (x - box[0]) / Math.max(1, box[2] - box[0])));
    const ny = Math.max(0, Math.min(1, (y - box[1]) / Math.max(1, box[3] - box[1])));
    return direction === 'horizontal' ? nx : direction === 'diagonal' ? (nx + ny) * 0.5 : ny;
  }
  function setAppearance() {
    if (!state.appearanceData || !state.appearanceContext) return;
    const configs = Object.fromEntries(JADE_APPEARANCE_PARTS.map(({ id }) => [id, jadeAppearanceSettings(id)]));
    if (Object.values(configs).every(config => config.mode === 'original') && !state.appearanceMasks) return;
    if (!state.appearanceMasks) state.appearanceMasks = jadeBuildAppearanceMasks(state.appearanceCanvas.width, state.appearanceCanvas.height, state.appearanceOriginal);
    const data = state.appearanceData.data, original = state.appearanceOriginal, width = state.appearanceCanvas.width;
    data.set(original);
    for (const [part, config] of Object.entries(configs)) {
      if (config.mode === 'original') continue;
      const start = jadeHexRgb(config.start), end = jadeHexRgb(config.end), skin = part === 'skin';
      for (const { box, indices } of state.appearanceMasks[part]) for (const offset of indices) {
        const pixel = offset >>> 2, x = pixel % width, y = (pixel / width) | 0;
        const t = config.mode === 'gradient' ? jadeGradientAmount(x, y, box, config.direction) : 0;
        const tr = start[0] * (1 - t) + end[0] * t, tg = start[1] * (1 - t) + end[1] * t, tb = start[2] * (1 - t) + end[2] * t;
        const sourceLuma = (original[offset] * 0.2126 + original[offset + 1] * 0.7152 + original[offset + 2] * 0.0722) / 255;
        const targetLuma = Math.max((tr * 0.2126 + tg * 0.7152 + tb * 0.0722) / 255, 0.08);
        const shade = skin ? Math.max(0.48, Math.min(1.3, sourceLuma / 0.78)) : Math.max(0.08, Math.min(1.35, sourceLuma / targetLuma));
        data[offset] = Math.max(0, Math.min(255, Math.round(tr * shade)));
        data[offset + 1] = Math.max(0, Math.min(255, Math.round(tg * shade)));
        data[offset + 2] = Math.max(0, Math.min(255, Math.round(tb * shade)));
      }
    }
    state.appearanceContext.putImageData(state.appearanceData, 0, 0);
    state.appearanceTexture?.baseTexture?.update();
  }
  function prepareAppearanceTexture(img, url) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas support is required for Jade appearance colors');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    state.appearanceData = context.getImageData(0, 0, canvas.width, canvas.height);
    state.appearanceOriginal = new Uint8ClampedArray(state.appearanceData.data);
    state.appearanceCanvas = canvas; state.appearanceContext = context;
    state.appearanceTexture = PIXI.Texture.from(canvas);
    PIXI.Texture.addToCache(state.appearanceTexture, url);
    setAppearance();
  }

  async function init({ host, onStatus, onSpeak } = {}) {""")
rep("    if (!PIXI.utils.TextureCache[texUrl]) PIXI.Texture.addToCache(PIXI.Texture.from(img), texUrl);", "    try { prepareAppearanceTexture(img, texUrl); } catch (e) { console.warn('Jade appearance color setup unavailable', e); if (!PIXI.utils.TextureCache[texUrl]) PIXI.Texture.addToCache(PIXI.Texture.from(img), texUrl); }")
rep("  function setFrame(f) { state.frame = f === 'full' ? 'full' : 'portrait'; layout(); }", """  function setTheme(name) {
    state.theme = Object.prototype.hasOwnProperty.call(JADE_THEMES, name) ? name : 'jade';
    const config = resolveJadeTheme(state.theme), uniforms = state.tintFilter?.uniforms;
    if (!uniforms) return;
    const set = (key, value) => {
      const current = uniforms[key];
      if (current?.set && Array.isArray(value)) current.set(value);
      else uniforms[key] = Array.isArray(value) ? new Float32Array(value) : value;
    };
    set('uColor', config.avatarStartRgb.map(c => c / 255));
    set('uColor2', config.avatarEndRgb.map(c => c / 255));
    set('uGradient', config.isGradient ? 1 : 0);
    set('uDirection', config.direction === 'horizontal' ? 1 : config.direction === 'diagonal' ? 2 : 0);
  }
  function setFrame(f) { state.frame = f === 'full' ? 'full' : 'portrait'; layout(); }""")
rep("const api = { init, setMood, nod, setFrame, speak, stop,", "const api = { init, setMood, nod, setFrame, setTheme, setAppearance, speak, stop,")
rep("$('#btnFrame').onclick = () => { S.jadeFrame = S.jadeFrame === 'full' ? 'portrait' : 'full'; saveSettings(); Jade.setFrame(S.jadeFrame); $('#btnFrame').textContent = S.jadeFrame === 'full' ? 'Portrait' : 'Full'; };\n$('#btnHideJade').onclick", "$('#btnFrame').onclick = () => { S.jadeFrame = S.jadeFrame === 'full' ? 'portrait' : 'full'; saveSettings(); Jade.setFrame(S.jadeFrame); $('#btnFrame').textContent = S.jadeFrame === 'full' ? 'Portrait' : 'Full'; };\n$('#btnTheme').onclick = () => { openSettings(); setTimeout(() => showSettingsSection('#jadeThemePicker'), 60); };\n$('#btnHideJade').onclick")

JADE_THEME_UI_JS = r'''function renderJadeThemePicker() {
  const host = $('#jadeThemePicker'); if (!host) return;
  host.innerHTML = Object.entries(JADE_THEMES).map(([id, theme]) => {
    const kind = id === 'spectrum' ? ' spectrum' : id === 'custom-gradient' ? ' custom-gradient' : '';
    return `<button type="button" class="gem-theme" data-jade-theme="${esc(id)}" aria-pressed="${String(id === S.jadeTheme)}" title="Use the ${esc(theme.name)} theme"><span class="gem-theme-swatch${kind}" style="--swatch:${theme.accent}" aria-hidden="true"></span><span>${esc(theme.name)}</span></button>`;
  }).join('');
  host.querySelectorAll('[data-jade-theme]').forEach(button => {
    button.onclick = () => applyJadeTheme(button.dataset.jadeTheme, true);
  });
  const bindColor = (selector, key, mode) => {
    const input = $(selector); if (!input) return;
    input.value = S[key];
    input.oninput = () => { S[key] = input.value; if (S.jadeTheme === mode) applyJadeTheme(mode); };
    input.onchange = () => { S[key] = input.value; if (S.jadeTheme === mode) applyJadeTheme(mode, true); else saveSettings(); };
  };
  bindColor('#jadeSpectrumColor', 'jadeSpectrum', 'spectrum');
  bindColor('#jadeGradientStart', 'jadeGradientStart', 'custom-gradient');
  bindColor('#jadeGradientEnd', 'jadeGradientEnd', 'custom-gradient');
  const direction = $('#jadeGradientDirection');
  if (direction) { direction.value = S.jadeGradientDirection || 'vertical'; direction.onchange = () => { S.jadeGradientDirection = direction.value; applyJadeTheme('custom-gradient', true); }; }
}
function applyJadeTheme(name, persist = false) {
  const id = Object.prototype.hasOwnProperty.call(JADE_THEMES, name) ? name : 'jade';
  S.jadeTheme = id;
  const theme = resolveJadeTheme(id), root = document.documentElement;
  root.style.setProperty('--yl', theme.accent);
  root.style.setProperty('--cy', theme.highlight);
  root.style.setProperty('--line-hot', theme.line);
  root.style.setProperty('--theme-rgb', theme.rgb.join(','));
  root.style.setProperty('--theme-highlight-rgb', theme.highlightRgb.join(','));
  root.style.setProperty('--theme-ink', theme.ink);
  root.style.setProperty('--theme-gradient', theme.cssGradient);
  document.body.dataset.jadeTheme = id;
  $('#jadeSpectrumControls').hidden = id !== 'spectrum';
  $('#jadeGradientControls').hidden = id !== 'custom-gradient';
  const label = $('#btnTheme'); if (label) label.textContent = theme.name;
  $('#jadeThemePicker')?.querySelectorAll('[data-jade-theme]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.jadeTheme === id));
  });
  Jade.setTheme(id);
  if (persist) saveSettings();
}
function renderJadeAppearancePicker() {
  const host = $('#jadeAppearancePicker'); if (!host) return;
  const modes = [['original', 'Original'], ['spectrum', 'Spectrum color'], ['gradient', 'Gradient']];
  host.innerHTML = JADE_APPEARANCE_PARTS.map(({ id, label }) => {
    const cap = id[0].toUpperCase() + id.slice(1), skin = id === 'skin';
    const options = skin ? [['original', 'Original'], ['natural', 'Natural tone'], ...modes.slice(1)] : modes;
    return `<fieldset class="jade-appearance-card" data-appearance-card="${id}"><legend>${label}</legend>
      <label class="appearance-field" for="jadeAppearance${cap}Mode"><span class="lbl">Color mode</span><select class="field" id="jadeAppearance${cap}Mode" data-appearance-mode="${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>
      ${skin ? `<label class="appearance-field" data-appearance-natural hidden for="jadeSkinTone"><span class="lbl">Natural tone</span><select class="field" id="jadeSkinTone" data-appearance-tone>${Object.entries(JADE_SKIN_TONES).map(([value, tone]) => `<option value="${value}">${tone.label}</option>`).join('')}</select></label>` : ''}
      <label class="appearance-field" data-appearance-start hidden for="jadeAppearance${cap}Color"><span class="lbl">Spectrum color</span><input type="color" class="theme-color-input" id="jadeAppearance${cap}Color" data-appearance-input="jade${cap}Color"></label>
      <div class="appearance-gradient-fields" data-appearance-gradient hidden><label class="appearance-field" for="jadeAppearance${cap}End"><span class="lbl">Gradient end</span><input type="color" class="theme-color-input" id="jadeAppearance${cap}End" data-appearance-input="jade${cap}End"></label><label class="appearance-field" for="jadeAppearance${cap}Direction"><span class="lbl">Direction</span><select class="field" id="jadeAppearance${cap}Direction" data-appearance-direction="${id}"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="diagonal">Diagonal</option></select></label></div>
      <p class="hint appearance-help">Shading and texture detail are preserved.</p></fieldset>`;
  }).join('');
  const sync = card => {
    const part = card.dataset.appearanceCard, mode = card.querySelector('[data-appearance-mode]').value;
    const natural = card.querySelector('[data-appearance-natural]'), start = card.querySelector('[data-appearance-start]'), gradient = card.querySelector('[data-appearance-gradient]');
    if (natural) natural.hidden = mode !== 'natural';
    if (start) { start.hidden = mode !== 'spectrum' && mode !== 'gradient'; start.querySelector('.lbl').textContent = mode === 'gradient' ? 'Gradient start' : 'Spectrum color'; }
    if (gradient) gradient.hidden = mode !== 'gradient';
  };
  host.querySelectorAll('[data-appearance-card]').forEach(card => {
    const part = card.dataset.appearanceCard, cap = part[0].toUpperCase() + part.slice(1), mode = card.querySelector('[data-appearance-mode]');
    mode.value = S[`jade${cap}Mode`] || 'original';
    card.querySelectorAll('[data-appearance-input]').forEach(input => { input.value = S[input.dataset.appearanceInput];
      input.oninput = () => { S[input.dataset.appearanceInput] = input.value; if (mode.value === 'spectrum' || mode.value === 'gradient') Jade.setAppearance(); };
      input.onchange = () => { S[input.dataset.appearanceInput] = input.value; Jade.setAppearance(); saveSettings(); };
    });
    const tone = card.querySelector('[data-appearance-tone]');
    if (tone) { tone.value = S.jadeSkinTone || 'fair'; tone.onchange = () => { S.jadeSkinTone = tone.value; if (mode.value === 'natural') Jade.setAppearance(); saveSettings(); }; }
    const direction = card.querySelector('[data-appearance-direction]');
    if (direction) { direction.value = S[`jade${cap}Direction`] || 'vertical'; direction.onchange = () => { S[`jade${cap}Direction`] = direction.value; if (mode.value === 'gradient') Jade.setAppearance(); saveSettings(); }; }
    mode.onchange = () => { S[`jade${cap}Mode`] = mode.value; sync(card); Jade.setAppearance(); saveSettings(); };
    sync(card);
  });
}
renderJadeThemePicker();
renderJadeAppearancePicker();
applyJadeTheme(S.jadeTheme);
Jade.setAppearance();'''
rep("})();\n\n/* =====================================================================\n   CRON —", "})();\n\n" + JADE_THEME_UI_JS + "\n\n/* =====================================================================\n   CRON —")

# ---------- markup ----------
rep('<div class="jade-label"><span class="dot busy" id="jadeDot"></span><span class="jade-mood" id="jadeMood">booting</span></div>', '<div class="jade-label"><span class="dot busy" id="jadeDot"></span><button type="button" class="jade-theme-label" id="btnTheme" aria-label="Choose Jade\'s gemstone theme" title="Choose Jade\'s gemstone colors">Jade</button><span class="jade-mood" id="jadeMood">booting</span></div>')
rep('<div class="pane-h">Jade companion</div>\n        <div class="grid gap-3"', '<div class="pane-h">Jade companion</div>\n        <div><div class="lbl">Jade\'s gemstone theme</div><p class="hint leading-relaxed mt-1">Choose a color for Jade\'s outfit accents and the app highlights.</p><div class="gem-theme-grid mt-2" id="jadeThemePicker" role="group" aria-label="Choose Jade\'s gemstone theme"></div></div>\n        <div class="grid gap-3"')
rep("""<div class="gem-theme-grid mt-2" id="jadeThemePicker" role="group" aria-label="Choose Jade's gemstone theme"></div></div>""", """<div class="gem-theme-grid mt-2" id="jadeThemePicker" role="group" aria-label="Choose Jade's gemstone theme"></div>
          <div class="theme-custom-controls mt-2" id="jadeSpectrumControls" hidden><div class="theme-color-fields"><label class="theme-color-field" for="jadeSpectrumColor"><span class="lbl">Spectrum color</span><input type="color" id="jadeSpectrumColor" class="theme-color-input" value="#bd72f3" aria-describedby="jadeSpectrumHint"></label></div><p class="hint mt-2" id="jadeSpectrumHint">Choose any hue with the full spectrum color picker.</p></div>
          <div class="theme-custom-controls mt-2" id="jadeGradientControls" hidden><div class="theme-color-fields"><label class="theme-color-field" for="jadeGradientStart"><span class="lbl">Gradient start</span><input type="color" id="jadeGradientStart" class="theme-color-input" value="#f34b68"></label><label class="theme-color-field" for="jadeGradientEnd"><span class="lbl">Gradient end</span><input type="color" id="jadeGradientEnd" class="theme-color-input" value="#62a4ff"></label><div><label class="lbl" for="jadeGradientDirection">Direction</label><select id="jadeGradientDirection" class="field mt-1"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="diagonal">Diagonal</option></select></div></div><p class="hint mt-2">Blend Jade's accents between your two colors.</p></div><div class="jade-appearance-panel mt-3"><div class="lbl">Customize Jade's appearance</div><p class="hint leading-relaxed mt-1">Choose independent colors for hair, clothes, stockings, boots, and skin.</p><div id="jadeAppearancePicker" class="jade-appearance-grid mt-2"></div></div></div>""")
NOTES_MARKUP = r'''<!-- NOTES (vault) -->
    <section class="m-screen" data-panel="files" hidden>
      <div class="m-sub">
        <div class="pane-h">Vault</div>
        <button class="btn btn-ghost" id="btnToday" title="Today's daily note">Today</button>
        <button class="btn btn-ghost" id="btnGraph" title="Graph view">Graph</button>
        <button class="btn btn-solid cut cut-sm" id="btnNewFile" title="New note">+ Note</button>
      </div>
      <div class="vault-search">
        <label for="noteSearch" class="sr-only">Search notes</label>
        <input id="noteSearch" type="text" class="field" placeholder="Search notes or #tag" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">
        <button class="icon-btn" id="btnSearchClear" aria-label="Clear search" hidden style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="tag-bar" id="tagBar" hidden></div>
      <div id="newEntry" class="px-3 py-2" hidden><input id="newEntryInput" class="field" placeholder="note name" autocapitalize="sentences" autocorrect="off" spellcheck="false" enterkeyhint="done"></div>
      <div id="searchRes" class="flex-1 overflow-y-auto min-h-0" hidden></div>
      <div id="tree" class="flex-1 overflow-y-auto min-h-0 py-1" tabindex="-1"></div>
      <div class="m-sub" style="border-top:1px solid var(--line);border-bottom:0">
        <div class="hud flex-1 min-w-0 truncate" id="fsStats">—</div>
        <button class="btn btn-ghost" id="btnNewDir" title="New folder">+ Folder</button>
        <label class="btn btn-ghost" title="Import markdown files" for="upload">Import</label>
        <input type="file" id="upload" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>
      </div>
    </section>

    <!-- NOTE: edit / read / split -->
    <section class="m-screen" data-panel="file" hidden>
      <div class="m-sub">
        <button class="icon-btn" id="btnFileBack" aria-label="Back" style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="flex-1 min-w-0 leading-tight"><div class="disp text-yl font-bold text-[15px] truncate" id="filePath">No note open</div><div class="mono text-[10px] text-dim truncate" id="fileDir"></div></div>
        <span class="save-state mono" id="saveState" aria-live="polite"></span>
        <div class="seg" id="modeSeg" role="group" aria-label="View mode">
          <button data-mode="edit" aria-pressed="false">Edit</button><button data-mode="split" aria-pressed="false">Split</button><button data-mode="read" aria-pressed="true">Read</button>
        </div>
      </div>
      <div class="note-body" id="noteBody" data-mode="read">
        <label for="fileEd" class="sr-only">Note text</label>
        <textarea id="fileEd" spellcheck="true" autocapitalize="sentences" class="mono leading-relaxed p-3 outline-none resize-none" placeholder="Start writing. Type [[ to link a note."></textarea>
        <div id="notePrev" class="note-prev"></div>
      </div>
      <div class="link-suggest" id="linkSuggest" hidden></div>
      <div class="qk md-tools" id="mdTools" aria-label="Formatting">
        <button data-md="link" aria-label="Insert link">[[ ]]</button><button data-md="h" aria-label="Heading">H</button><button data-md="b" aria-label="Bold"><b>B</b></button><button data-md="i" aria-label="Italic"><i>I</i></button>
        <button data-md="task" aria-label="Task">☐</button><button data-md="ul" aria-label="Bullet list">•</button><button data-md="tag" aria-label="Tag">#</button><button data-md="quote" aria-label="Quote">❝</button>
        <button data-md="code" aria-label="Code">&lt;/&gt;</button><button data-md="s" aria-label="Strikethrough"><s>S</s></button><button data-md="date" aria-label="Insert today's date">date</button>
      </div>
      <div class="links-panel" id="linksPanel" hidden></div>
      <div class="m-sub" style="border-top:1px solid var(--line);border-bottom:0">
        <button class="btn btn-ghost" id="btnLinks" hidden>Links</button>
        <button class="btn btn-ghost" id="btnNoteGraph" title="Local graph">Graph</button>
        <span class="hud flex-1 min-w-0 truncate text-right" id="noteStats"></span>
        <button class="btn btn-ghost" id="btnFileCopy">Copy</button>
        <button class="btn btn-ghost" id="btnFileDel">Delete</button>
      </div>
    </section>

    '''
rep_between('<!-- FILES -->', '<!-- TASKS -->', NOTES_MARKUP)
GRAPH_MARKUP = r'''<!-- GRAPH -->
    <section class="m-screen" data-panel="graph" hidden>
      <div class="m-sub">
        <button class="icon-btn" id="btnGraphBack" aria-label="Back" style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="disp text-yl font-bold text-[14px] truncate flex-1 min-w-0" id="graphTitle">Graph</span>
        <button class="btn btn-ghost" id="btnGraphLocal" aria-pressed="false">Local</button>
        <button class="btn btn-ghost" id="btnGraphFit">Center</button>
      </div>
      <canvas id="graphCv" class="flex-1 min-h-0 w-full" style="touch-action:none;display:block" aria-label="Graph of notes and links. Tap a node to open it."></canvas>
      <div class="hud px-3 py-2 border-t border-line">tap a node to open · drag to pan · pinch to zoom · <span class="text-rd">pink</span> = not written yet</div>
    </section>
  </main>'''
rep_between('<!-- PREVIEW -->', '</main>', GRAPH_MARKUP, keep_end=False)
rep('<path d="M3 6h7l2 2h9v11H3z"/></svg>Files</button>', '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>Notes</button>')
rep('<button data-c="ls -la">ls</button><button data-c="tree">tree</button><button data-c="help">help</button>',
    '<button data-c="ls -la">ls</button><button data-c="tree">tree</button><button data-c="tags">tags</button><button data-c="links">links</button><button data-c="help">help</button>')

# ---------- CSS ----------
CSS = r'''
/* ---------- vault ---------- */
.vault-search{flex:none;display:flex;gap:6px;align-items:center;padding:8px 10px 4px}
.vault-search .field{flex:1;min-width:0;margin:0}
.tag-bar{flex:none;display:flex;gap:6px;overflow-x:auto;padding:6px 10px 8px;scrollbar-width:none;border-bottom:1px solid var(--line)}
.tag-bar::-webkit-scrollbar{display:none}
.tag-chip{display:inline-flex;align-items:center;gap:4px;flex:none;font-family:var(--f-mono);font-size:12px;color:var(--cy);border:1px solid rgba(255,184,198,.35);background:rgba(255,184,198,.07);padding:3px 8px;text-decoration:none!important;white-space:nowrap}
.tag-chip.on{background:var(--cy);color:#1a0509;border-color:var(--cy)}
.tag-bar .tag-chip{min-height:32px}
.lk-badge{font-family:var(--f-mono);font-size:10px;color:var(--yl);border:1px solid rgba(31,229,165,.35);padding:0 4px;line-height:16px}
.lk-badge.out{color:var(--cy);border-color:rgba(255,184,198,.35)}
.search-hit{display:block;width:100%;text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
.search-hit:active,.link-item:active{background:rgba(31,229,165,.08)}
mark{background:rgba(31,229,165,.25);color:var(--fg);padding:0 1px}
.save-state{font-size:10px;letter-spacing:.08em;color:var(--dim);flex:none}
.save-state[data-s="editing…"]{color:var(--cy)}
.seg{display:flex;flex:none;border:1px solid var(--line)}
.seg button{font-family:var(--f-disp);font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;padding:0 9px;min-height:34px;color:var(--dim)}
.seg button[aria-pressed="true"]{background:var(--yl);color:#00140c}
.note-body{flex:1;min-height:0;display:flex;flex-direction:column}
.note-body textarea{flex:1;min-height:0;background:#030705;color:#dceee7;tab-size:2;font-size:14px!important;border:0}
.note-prev{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 40px;overscroll-behavior:contain}
.note-body[data-mode="edit"] .note-prev{display:none}
.note-body[data-mode="read"] textarea{display:none}
.note-body[data-mode="split"] textarea{flex:1 1 45%;border-bottom:1px solid var(--line-hot)}
.note-body[data-mode="split"] .note-prev{flex:1 1 55%}
body.kb .note-body[data-mode="split"] .note-prev{display:none}
.md-tools button{min-width:40px}
.link-suggest{flex:none;display:flex;gap:6px;overflow-x:auto;padding:6px 8px;border-top:1px solid var(--line-hot);background:rgba(9,16,14,.98);scrollbar-width:none}
.link-suggest button{flex:none;display:flex;flex-direction:column;align-items:flex-start;max-width:200px;padding:5px 10px;border:1px solid var(--line);background:rgba(31,229,165,.06);text-align:left}
.link-suggest button span{font-size:13px;color:var(--yl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
.link-suggest button small{font-family:var(--f-mono);font-size:9.5px;color:var(--dim)}
.link-suggest button.new span{color:var(--cy)}
.links-panel{flex:none;max-height:42%;overflow-y:auto;padding:10px 12px;border-top:1px solid var(--line-hot);background:var(--panel)}
.link-item{display:block;width:100%;text-align:left;padding:7px 0;border-bottom:1px dashed var(--line);font-size:14px}
.note-props{display:grid;gap:2px;margin:0 0 12px;padding:8px 10px;border:1px solid var(--line);background:rgba(15,26,23,.6);font-family:var(--f-mono);font-size:11.5px}
.note-props div{display:flex;gap:10px}.note-props span{color:var(--dim);min-width:72px}.note-props b{color:var(--fg);font-weight:500}
/* markdown note styling (taken from the NeuroRead look, recoloured jade) */
.note-md{max-width:72ch;margin:0 auto;font-size:15.5px;line-height:1.7}
.note-md h1{font-size:25px;padding-bottom:6px;border-bottom:1px solid var(--line-hot);text-shadow:2px 0 rgba(255,61,79,.35),-2px 0 rgba(255,184,198,.3)}
.note-md h2{font-size:19px;border-left:3px solid var(--yl);padding-left:10px}
.note-md h3{font-size:16px;color:var(--cy)}
.note-md h4,.note-md h5,.note-md h6{font-family:var(--f-disp);font-weight:700;color:var(--ok);margin:.8em 0 .3em}
.note-md hr{border:0;height:1px;margin:1.4em 0;background:linear-gradient(90deg,transparent,var(--yl),var(--cy),transparent)}
.note-md img{max-width:100%;border:1px solid var(--line)}
.note-md li.md-task{list-style:none;margin-left:-1.2em}
.note-md li.md-task input{accent-color:var(--yl);width:17px;height:17px;vertical-align:-3px;margin-right:6px}
.note-md li.md-task.done{color:var(--dim);text-decoration:line-through}
.note-md .flash{animation:hflash 1.2s ease}
@keyframes hflash{from{background:rgba(31,229,165,.25)}to{background:transparent}}
.md a.wiki-link{color:var(--yl);text-decoration:none;border-bottom:1px dashed rgba(31,229,165,.6);padding:0 1px}
.md a.wiki-link::before{content:'⟦';opacity:.45;font-size:.85em}
.md a.wiki-link::after{content:'⟧';opacity:.45;font-size:.85em}
.md a.wiki-link.missing{color:var(--cy);border-bottom-color:rgba(255,61,79,.7);opacity:.85}
.md a.tag-chip{padding:0 6px;font-size:.85em;vertical-align:1px}
#graphCv{background:radial-gradient(circle at 50% 45%,rgba(31,229,165,.06),transparent 70%)}
/* ---------- gemstone themes ---------- */
:root{--theme-rgb:31,229,165;--theme-highlight-rgb:255,184,198;--theme-ink:#00140c;--theme-gradient:linear-gradient(90deg,#1fe5a5,#ffb8c6)}
body::before{background:
  linear-gradient(transparent 0 calc(100% - 1px),rgba(var(--theme-rgb),.035) 0) 0 0/100% 32px,
  linear-gradient(90deg,transparent 0 calc(100% - 1px),rgba(var(--theme-rgb),.035) 0) 0 0/32px 100%,
  radial-gradient(1200px 600px at 85% -10%,rgba(var(--theme-rgb),.10),transparent 60%),
  radial-gradient(900px 500px at -10% 110%,rgba(var(--theme-highlight-rgb),.06),transparent 60%)}
.jade-stage{background:radial-gradient(ellipse 70% 62% at 50% 30%,rgba(var(--theme-rgb),.20),transparent 70%),linear-gradient(180deg,#07150f 0%,#030806 100%)}
.jade-stage::before{background:linear-gradient(transparent 0 calc(100% - 1px),rgba(var(--theme-rgb),.16) 0) 0 0/100% 18px,linear-gradient(90deg,transparent 0 calc(100% - 1px),rgba(var(--theme-rgb),.12) 0) 0 0/36px 100%}
.jade-label{text-shadow:0 0 10px rgba(var(--theme-rgb),.5)}
.jade-theme-label{display:inline-flex;align-items:center;justify-content:center;min-height:27px;pointer-events:auto;cursor:pointer;font-family:var(--f-disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:1.2;color:var(--cy);border:1px solid rgba(var(--theme-highlight-rgb),.35);padding:2px 7px;background:rgba(3,7,5,.52)}
.jade-theme-label::before{content:"";width:6px;height:6px;flex:none;border-radius:50%;margin-right:5px;background:var(--yl);box-shadow:0 0 7px var(--yl)}
.jade-theme-label:hover{color:var(--yl);border-color:var(--yl);background:rgba(var(--theme-rgb),.08)}
.jade-theme-label:focus-visible{outline:2px solid var(--yl);outline-offset:2px}
@media(max-width:360px){.jade-mood{display:none}}
.jade-bubble{border-color:rgba(var(--theme-rgb),.42)}
.jade-bubble .who{color:var(--yl)}
.text-yl{color:var(--yl)!important}.bg-yl{background-color:var(--yl)!important}.border-yl{border-color:var(--yl)!important}
.text-cy{color:var(--cy)!important}.bg-cy{background-color:var(--cy)!important}.border-cy{border-color:var(--cy)!important}
.accent-emerald-400,.accent-emerald-500{accent-color:var(--yl)!important}
.btn-solid{color:var(--theme-ink)}
.seg button[aria-pressed="true"]{color:var(--theme-ink)}
.tag-chip.on{color:var(--theme-ink);background:var(--cy);border-color:var(--cy)}
.gem-theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:7px}
.gem-theme{display:flex;align-items:center;gap:8px;min-height:38px;padding:6px 9px;border:1px solid var(--line);background:rgba(5,10,8,.55);color:var(--dim);font-family:var(--f-disp);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:left;transition:background .15s,border-color .15s,color .15s}
.gem-theme:hover{border-color:var(--yl);color:var(--fg);background:rgba(var(--theme-rgb),.07)}
.gem-theme[aria-pressed="true"]{border-color:var(--yl);color:var(--fg);background:rgba(var(--theme-rgb),.12);box-shadow:inset 0 0 0 1px rgba(var(--theme-rgb),.3)}
.gem-theme:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
.gem-theme-swatch{width:14px;height:14px;flex:none;border-radius:50%;background:var(--swatch);box-shadow:0 0 9px var(--swatch);border:1px solid rgba(255,255,255,.38)}
.gem-theme-swatch.spectrum{background:conic-gradient(#f34b68,#ffd15c,#54d78b,#54c8e8,#607df1,#b46bed,#f34b68);box-shadow:0 0 9px rgba(189,114,243,.55)}
.gem-theme-swatch.custom-gradient{background:linear-gradient(135deg,#f34b68,#62a4ff);box-shadow:0 0 9px rgba(154,116,239,.55)}
body[data-jade-theme="custom-gradient"] .gem-theme-swatch.custom-gradient{background:var(--theme-gradient)}
.theme-custom-controls{padding:9px 10px;border:1px solid var(--line);background:rgba(5,10,8,.45)}
.jade-appearance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.jade-appearance-card{min-width:0;padding:8px 9px;border:1px solid var(--line);background:rgba(3,8,6,.55)}
.jade-appearance-card legend{padding:0 5px;color:var(--yl);font-family:var(--f-disp);font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.appearance-field{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}
.appearance-field .field{width:112px;min-width:0;flex:none}
.appearance-gradient-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.appearance-gradient-fields .appearance-field{align-items:flex-start;flex-direction:column}
.appearance-help{margin-top:8px;font-size:10px;line-height:1.4}
.theme-color-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;align-items:end}
.theme-color-field{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:38px}
.theme-color-input{width:48px;height:36px;flex:none;padding:3px;border:1px solid var(--line-hot);background:var(--panel);cursor:pointer}
.theme-color-input:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
body[data-jade-theme="custom-gradient"] .btn-solid{background:var(--theme-gradient);border-color:transparent;color:var(--theme-ink)}
body[data-jade-theme="custom-gradient"] .jade-theme-label{background:var(--theme-gradient);border-color:transparent;color:var(--theme-ink)}
'''
rep('@media (prefers-reduced-motion:reduce){ .drawer,.drawer-bg,.jade-stage{transition:none} }',
    '@media (prefers-reduced-motion:reduce){ .drawer,.drawer-bg,.jade-stage{transition:none} }' + CSS)

# ---------- seed + vault core ----------
rep_between('const SEED = {', '\n/* =====', rd('seed.js') + '\n' + rd('rust_core.js').replace('/*JADE_CORE_GLUE*/', open(os.path.join(D, 'vendor', 'jade_core.js')).read()) + '\n' + rd('vault_core.js'))

# ---------- shell builtins ----------
OLD_PREV = s[s.index("  preview(c) { const p = c.P(c.argv[0] || 'index.html');"):s.index("  get open() { return this.preview; },") + len("  get open() { return this.preview; },")]
NEW_BI = r'''  open(c) {
    const a = c.argv.find(x => !x.startsWith('-')); if (!a) { c.e('usage: open <note name or path> [-e|-r]\n'); return 1; }
    const p = vfs.isFile(c.P(a)) ? c.P(a) : resolveNote(a, null);
    if (!p) { c.e(`open: ${a}: no such note (create it with: touch "${a}.md")\n`); return 1; }
    openFile(p, { mode: c.argv.includes('-e') ? 'edit' : c.argv.includes('-r') ? 'read' : undefined }); c.o(`Opened ${p}\n`); return 0;
  },
  get preview() { return this.open; },
  links(c) {
    const a = c.argv[0]; const p = a ? (vfs.isFile(c.P(a)) ? c.P(a) : resolveNote(a, null)) : null;
    const idx = vaultIndex();
    if (!a) { let n = 0; for (const [q, set] of idx.out) for (const t of set) { c.o(`${q} -> ${t}\n`); n++; } for (const [q, set] of idx.missing) for (const m of set) c.o(`${q} -> [[${m}]] (missing)\n`); if (!n) c.o('no links yet\n'); return 0; }
    if (!p) { c.e(`links: ${a}: no such note\n`); return 1; }
    for (const t of idx.out.get(p) || []) c.o(`-> ${t}\n`); for (const m of idx.missing.get(p) || []) c.o(`-> [[${m}]] (missing)\n`);
    for (const t of idx.back.get(p) || []) c.o(`<- ${t}\n`); return 0;
  },
  backlinks(c) {
    const a = c.argv[0]; if (!a) { c.e('usage: backlinks <note>\n'); return 1; }
    const p = vfs.isFile(c.P(a)) ? c.P(a) : resolveNote(a, null); if (!p) { c.e(`backlinks: ${a}: no such note\n`); return 1; }
    for (const t of vaultIndex().back.get(p) || []) c.o(t + '\n'); return 0;
  },
  tags(c) {
    const idx = vaultIndex(); const a = (c.argv[0] || '').replace(/^#/, '').toLowerCase();
    if (a) { for (const p of [...(idx.tags.get(a) || [])].sort()) c.o(p + '\n'); return idx.tags.has(a) ? 0 : 1; }
    for (const [t, set] of [...idx.tags].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]))) c.o(`#${t}\t${set.size}\n`); return 0;
  },
  search(c) {
    const q = c.argv.join(' '); if (!q) { c.e('usage: search <words | #tag>\n'); return 1; }
    const r = searchNotes(q, 30); for (const h of r) c.o(`${h.path}\n  ${h.snippet}\n`); if (!r.length) c.o('no matches\n'); return r.length ? 0 : 1;
  },
  today(c) { openToday(); c.o(`Opened /daily/${todayStr()}.md\n`); return 0; },'''
s = s.replace(OLD_PREV, NEW_BI)
rep("const JS_ONLY = new Set(['node', 'js', 'preview', 'clear', 'help', 'sh', 'bash', 'xargs', 'open']);",
    "const JS_ONLY = new Set(['node', 'js', 'preview', 'clear', 'help', 'sh', 'bash', 'xargs', 'open', 'links', 'backlinks', 'tags', 'search', 'today']);")
rep("`No loops/if blocks: use node for scripting. Extra: node, preview <file.html>, xargs.\\n\\n`",
    "`No loops/if blocks: use node for scripting. Extra: node, xargs.\\nVault: open <note>, links [note], backlinks <note>, tags [tag], search <words|#tag>, today.\\n\\n`")
rep(r"for applets, \x1b[0m\x1b[33mpreview index.html\x1b[0m\x1b[2m to render HTML.", r"for applets, \x1b[0m\x1b[33msearch\x1b[0m\x1b[2m / \x1b[0m\x1b[33mtags\x1b[0m\x1b[2m / \x1b[0m\x1b[33mopen <note>\x1b[0m\x1b[2m for the vault.")

# ---------- tools ----------
rep("Use `node file.js` for scripting and `preview file.html` to show a page to the user.'", "Use `node file.js` for scripting. Vault commands: search <words|#tag>, tags, links <note>, backlinks <note>.'")
rep("""  { name: 'decide', description:""", """  { name: 'notes_search', description: 'Search the markdown vault. Ranked by note name and text matches. A query like "#project" lists notes with that tag. An empty query returns a vault overview (note count, folders, tags, most-linked notes). Use this before creating a note to avoid duplicates.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Words to find, or #tag. Empty for an overview.' }, limit: { type: 'number', description: 'Max results (default 10, max 30)' } } } },
  { name: 'note_links', description: 'Show the link graph around one note: backlinks (with the line that links), outgoing links, unresolved [[links]] to notes that do not exist yet, and tags.',
    parameters: { type: 'object', properties: { note: { type: 'string', description: 'Note name (e.g. "Inbox") or path (e.g. /projects/Plan.md)' } }, required: ['note'] } },
  { name: 'open_note', description: 'Show a note on the user\\'s screen. Use when the user asks to see or open a note, or after writing a note they asked for.',
    parameters: { type: 'object', properties: { note: { type: 'string', description: 'Note name or path' }, mode: { type: 'string', enum: ['read', 'edit', 'split'], description: 'View mode (default read)' } }, required: ['note'] } },
  { name: 'decide', description:""")
TOOLS_IMPL = r'''    case 'notes_search': {
      const q = String(args.query || '').trim(); const idx = vaultIndex();
      if (!q) {
        const folders = {}; for (const p of idx.notes) { const d = vfs.parent(p); folders[d] = (folders[d] || 0) + 1; }
        const top = [...idx.back].sort((a, b) => b[1].size - a[1].size).slice(0, 8).filter(x => x[1].size).map(([p, s]) => `${noteName(p)} (${s.size})`);
        let links = 0; for (const s of idx.out.values()) links += s.size;
        return `${idx.notes.length} notes, ${links} links, ${idx.words} words.\nFolders: ${Object.entries(folders).map(([d, n]) => `${d} (${n})`).join(', ')}\nTags: ${[...idx.tags].map(([t, s]) => `#${t} (${s.size})`).join(', ') || 'none'}\nMost linked: ${top.join(', ') || 'none'}\nNotes:\n${idx.notes.slice(0, 200).join('\n')}${idx.notes.length > 200 ? `\n… ${idx.notes.length - 200} more` : ''}`;
      }
      const res = searchNotes(q, Math.min(+args.limit || 10, 30));
      return res.length ? res.map(r => `${r.path}  →  [[${linkName(r.path)}]]\n  ${r.snippet}`).join('\n') : `No notes match "${q}".`;
    }
    case 'note_links': {
      const a = String(args.note || args.path || ''); const p = vfs.isFile(P(a)) ? P(a) : resolveNote(a, null);
      if (!p) throw new Error(`No note named "${a}". Use notes_search to find it.`);
      const idx = vaultIndex(); const back = [...(idx.back.get(p) || [])], out = [...(idx.out.get(p) || [])], miss = [...(idx.missing.get(p) || [])];
      return `${p}  ([[${linkName(p)}]])\nBacklinks (${back.length}):\n${back.map(q => `- ${q}: ${linkContext(q, p).slice(0, 160)}`).join('\n') || '- none'}\nOutgoing (${out.length}):\n${out.map(q => '- ' + q).join('\n') || '- none'}\nUnresolved (${miss.length}):\n${miss.map(m => `- [[${m}]]`).join('\n') || '- none'}\nTags: ${noteTags(p).map(t => '#' + t).join(' ') || 'none'}`;
    }
    case 'open_note': {
      const a = String(args.note || args.path || ''); const p = vfs.isFile(P(a)) ? P(a) : resolveNote(a, null);
      if (!p) throw new Error(`No note named "${a}". Write it first, then open it.`);
      openFile(p, { mode: ['read', 'edit', 'split'].includes(args.mode) ? args.mode : 'read' });
      return `Opened ${p} on the user's screen.`;
    }
    case 'decide': return await ollayaDecide(args);'''
rep("    case 'decide': return await ollayaDecide(args);", TOOLS_IMPL)
rep("  decide: a => `${a.type || 'choice'}: ${a.question || ''}`,", "  decide: a => `${a.type || 'choice'}: ${a.question || ''}`, notes_search: a => a.query ? `\"${a.query}\"` : 'overview', note_links: a => a.note || a.path || '', open_note: a => a.note || a.path || '',")
rep("schedule: () => `Scheduling: ${short(a.name || a.action)}` }", "schedule: () => `Scheduling: ${short(a.name || a.action)}`, notes_search: () => a.query ? `Searching notes: ${short(a.query)}` : 'Surveying the vault', note_links: () => `Tracing links: ${short(a.note || a.path)}`, open_note: () => `Opening ${short(a.note || a.path)}` }")

# ---------- md(): internal links stay in-app ----------
rep("  for (const a of div.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }",
    r"""  for (const a of div.querySelectorAll('a')) {
    if (a.classList.contains('wiki-link') || a.classList.contains('tag-chip')) continue;
    const h = a.getAttribute('href') || '';
    if (h.startsWith('#')) { a.classList.add('wiki-link'); a.dataset.wiki = ''; a.dataset.heading = decodeURIComponent(h.slice(1)).replace(/-/g, ' '); continue; }
    if (!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(h) && /\.(md|markdown)(#.*)?$/i.test(h)) { let t = h.split('#')[0]; try { t = decodeURIComponent(t); } catch {} a.classList.add('wiki-link'); a.dataset.wiki = t; if (h.includes('#')) a.dataset.heading = h.split('#')[1]; if (!resolveNote(t, Vault.renderFrom)) a.classList.add('missing'); continue; }
    a.target = '_blank'; a.rel = 'noopener noreferrer';
  }""")

# ---------- empty state ----------
rep('<div class="mono text-[11px] tracking-[.3em] text-rd">// JACK IN</div>', '<div class="mono text-[11px] tracking-[.3em] text-rd">// JACK INTO THE VAULT</div>')
rep('text-wrap:balance">A coding agent that lives in this tab.</h1>', 'text-wrap:balance">A second brain that lives in this tab.</h1>')
rep('Your local Ollama model gets four core tools (read, write, edit, bash) plus tasks and web search. Files live in a virtual filesystem in your browser. Commands run in a BusyBox shell compiled to WebAssembly.',
    'Markdown notes with [[wiki links]], backlinks, tags and a graph, stored on this device. Jade (your local Ollama model) searches, writes and links them with her tools, and still has the full BusyBox shell.')
rep("""      <div class="check-row"><span class="dot ${bb.module ? 'ok' : 'busy'} mt-1.5"></span>""",
    """      <div class="check-row"><span class="dot ok mt-1.5"></span><div><b>Vault</b> — ${(() => { const i = vaultIndex(); let l = 0; for (const x of i.out.values()) l += x.size; return `${i.notes.length} notes, ${l} links`; })()} · <a href="#" class="text-cy underline" data-act="notes">open Notes</a></div></div>
      <div class="check-row"><span class="dot ${bb.module ? 'ok' : 'busy'} mt-1.5"></span>""")
rep_between("        ${[['Neon snake',", "          .map(([t, p]) =>",
    """        ${[['Sort my Inbox', 'Read Inbox.md and turn each item into its own short note with [[links]] back to the Inbox. Then tidy the Inbox.'],
           ['Daily review', "Open today's daily note (create it if needed), list my open tasks from every note, and add a short plan for today."],
           ['Map of content', 'Build a note called "Map of Content" that links every note in the vault, grouped by tag, and open it.'],
           ['Research note', 'Search the web for spaced repetition techniques and write a note with sources, tagged #learning and linked from Project Neon.']]
""")
rep("  if (a.dataset.act === 'retry') connect(); else openSettings();", "  e.preventDefault(); if (a.dataset.act === 'retry') connect(); else if (a.dataset.act === 'notes') setTab('files'); else openSettings();")

# ---------- system prompt ----------
SYS = r'''const systemPrompt = () => { const vi = vaultIndex(); const vl = vi.notes.length; return `You are Jade, a cyberpunk netrunner who keeps the user's personal knowledge vault: a folder of markdown notes linked together like Obsidian. Your main job is helping the user capture, find, organise, connect and think with their notes. You run entirely inside the user's browser and can also read, write, edit and run code in the same filesystem.

Vault conventions:
- Every note is a .md file. Folders are optional. Link notes with [[Note Name]] (no .md and no folder needed), [[Note Name|label]] or [[Note Name#Heading]]. Tags are #words.
- New notes start with "# Title". Add [[links]] to related notes, and add a link back where it helps. Search first so you do not create duplicates.
- Daily notes live at /daily/YYYY-MM-DD.md. Quick captures go in /Inbox.md. Tasks are "- [ ] item" lines.
- When you mention a note in a reply, write it as [[Note Name]] so the user can tap it.
- Vault now: ${vl} notes, tags: ${[...vi.tags.keys()].slice(0, 25).map(t => '#' + t).join(' ') || 'none'}.${vl && vl <= 60 ? `\nNotes: ${vi.notes.join(', ')}` : ''}

Environment:
- Virtual filesystem rooted at /, persisted in the browser. Work relative to /.
- bash runs a ${bb.module ? `BusyBox 1.37 (WebAssembly) shell. BusyBox applets: ${[...bb.applets].filter(a => !JS_ONLY.has(a)).join(' ')}. Also: node, diff, xargs, sh -c, and vault commands search, tags, links, backlinks, open` : 'BusyBox-compatible shell (JS applets) with vault commands search, tags, links, backlinks, open'}: pipes, redirects, &&, ||, ;, $VAR, $(...) and globs work. There are no loops or if blocks, no network access and no package managers. Each bash call starts at /; cd does not persist between calls. Quote paths with spaces.
- "node file.js" or node -e "code" runs JavaScript in a sandboxed worker with require('fs') (readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, unlinkSync) and require('path'). Use node for bulk edits across many notes.
- Today's date: ${new Date().toISOString().slice(0, 10)}.

Tools:
- notes_search: find notes by words or #tag; empty query = vault overview
- note_links: backlinks, outgoing and unresolved links and tags of one note
- open_note: show a note on the user's screen
- read / write / edit: read, create or change notes and other files (write creates folders)
- bash: shell commands (ls, find, grep, sed, wc, node, search, tags, ...)
- tasks: maintain a visible task list for multi-step work
- schedule: create/list/pause/delete scheduled prompts and reminders. "when" is plain English ("every day at 9am", "in 20 minutes", "tomorrow at 7pm") in the user's time zone ${TZ}; never ask the user for cron. They run only while the app is open
- web_search / web_fetch: look things up on the web${S.ollayaOn && S.ollayaModel ? '\n- decide: ask the local Ollaya decision model to classify, score or answer yes/no about a piece of text (returns probabilities)' : ''}

Guidelines:
- Look before you change things: notes_search or read the note first. Use edit for small changes (oldText must match exactly), write for new notes or full rewrites.
- Keep the user's words. When reorganising, move or link content rather than deleting it.
- For work with three or more steps, add tasks first, set each to in_progress when you start it and done when finished.
- Be concise. When finished, say which notes changed, as [[links]].`; };'''
i = s.index('const systemPrompt = () => `You are Pi Netrunner')
j = s.index('When finished, summarize what changed and where in a few short lines.`;', i) + len('When finished, summarize what changed and where in a few short lines.`;')
s = s[:i] + SYS + s[j:]

# ---------- notes UI replaces file tree / editor / preview ----------
i = s.index('/* =====================================================================\n   FILE TREE / EDITOR / PREVIEW')
j = s.index('/* =====================================================================\n   UI WIRING')
s = s[:i] + rd('vault_ui.js') + '\n' + s[j:]

# ---------- tabs, back button ----------
rep("  const navFor = { file: 'files', preview: 'files' }[name] || name;", "  if (name !== 'file') flushSave();\n  const navFor = { file: 'files', graph: 'files' }[name] || name;")
rep("  if (name === 'preview') schedulePreview();\n", "  if (name !== 'graph') cancelAnimationFrame(Graph.raf);\n  if (name === 'files') renderTree();\n")
rep("  if (scr === 'file') { setTab('files'); return true; }\n  if (scr === 'preview') { setTab(editing ? 'file' : 'files'); return true; }",
    "  if (scr === 'file') { if (!$('#linksPanel').hidden) { $('#linksPanel').hidden = true; return true; } noteBack(); return true; }\n  if (scr === 'graph') { $('#btnGraphBack').click(); return true; }\n  if (scr === 'files' && $('#noteSearch').value) { $('#noteSearch').value = ''; runVaultSearch(); return true; }")
rep("$('#btnFileBack').onclick = () => setTab('files');\n$('#btnPrevBack').onclick = () => setTab(editing ? 'file' : 'files');\n", "")

# ---------- speech: read [[links]] as their names ----------
rep("      .replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g, '').replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1')",
    "      .replace(/\\[\\[([^\\]|#]+)(?:#[^\\]|]*)?(?:\\|([^\\]]+))?\\]\\]/g, (m, a, b) => b || a)\n      .replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g, '').replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1')")

rep("  setTab('chat');\n})();\n</script>", "  setTab('chat');\n})();\n// console/test hook\nObject.assign(window, { vfs, openFile, Graph, noteHist, term, vaultIndex, $ }); Object.defineProperty(window, 'editing', { get: () => editing }); Object.defineProperty(window, 'running', { get: () => running });\n</script>")
rep("const plain = String(text).replace(/```[\\s\\S]*?```/g, ' ')", "const plain = String(text).replace(/```[\\s\\S]*?```/g, ' ').replace(/\\[\\[([^\\]|#]+)(?:#[^\\]|]*)?(?:\\|([^\\]]+))?\\]\\]/g, (m, a, b) => b || a)")
# ================= v2: node fs, duplicate-safe file tools, long-term memory =================
i = s.index('const NODE_PRELUDE = `'); j = s.index('async function runNode(c) {')
import json as _json
s = s[:i] + 'const NODE_PRELUDE = ' + _json.dumps(rd('node_prelude.js')) + ';\n' + s[j:]
rep("  const files = {}; for (const [p, n] of vfs.nodes) if (!n.dir && n.data.length < 2e6) files[p] = dec.decode(n.data);",
    "  const files = {}, dirs = []; for (const [p, n] of vfs.nodes) { if (n.dir) dirs.push(p); else if (n.data.length < 2e6) files[p] = dec.decode(n.data); }")
rep("    w.postMessage({ files, cwd: c.sh.cwd, argv });", "    w.postMessage({ files, dirs, cwd: c.sh.cwd, argv });")
rep("  for (const [p, d] of Object.entries(r.writes)) { if (d === null) { if (vfs.exists(p)) vfs.rm(p); } else vfs.write(p, d, { mkdirs: true }); }",
    "  const W = Object.entries(r.writes || {});\n  for (const [p, d] of W) if (d === null && vfs.isFile(p)) vfs.rm(p);\n  for (const p of r.rmdirs || []) if (vfs.isDir(p) && p !== '/') vfs.rm(p, true);\n  for (const p of r.mkdirs || []) { try { vfs.mkdirp(p); } catch {} }\n  for (const [p, d] of W) if (d !== null) { try { vfs.write(p, d, { mkdirs: true }); } catch (e) { c.e(`node: could not save ${p}: ${e.message}\\n`); } }")
rep("      const p = P(args.path); const text = vfs.read(p); const L = text.split('\\n');", "      const p = readPath(args.path); const text = vfs.read(p); const L = text.split('\\n');")
rep("    case 'write': { const p = P(args.path);", "    case 'write': { const p = writePath(args.path);")
rep("      const p = P(args.path); const text = vfs.read(p); const oldT = String(args.oldText ?? '')", "      const p = readPath(args.path); const text = vfs.read(p); const oldT = String(args.oldText ?? '')")
rep("Use `node file.js` for scripting. Vault commands:", "For scripts longer than a line, write a .js file and run `node file.js` (fs and path work on the vault). Vault commands:")

# memory module after the notes UI
s = s.replace('/* =====================================================================\n   UI WIRING', rd('memory.js') + '\n' + rd('embed.js') + '\n/* =====================================================================\n   UI WIRING', 1)
rep("const DEFAULTS = { compactAuto: true,", "const DEFAULTS = { memoryOn: true, memoryRag: true, memoryRagK: 8, journalOn: true, embedOn: true, embedModel: 'nomic-embed-text', embedHost: '', embedKey: '', embedNotes: false, compactAuto: true,")
rep("""  { name: 'notes_search', description:""", """  { name: 'memory', description: 'Your long-term memory across chats, kept in the note /Jade/Memory.md (you see it in your instructions every chat). save: remember one durable fact (who the user is, preferences, projects, people, decisions, or anything they ask you to remember). search: look through memory and your journal of past chats. forget: delete remembered lines containing text. list: show all of memory.',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['save', 'search', 'forget', 'list'] }, text: { type: 'string', description: 'save: the fact, as one short sentence. search: words to look for. forget: text of the memory to delete.' }, section: { type: 'string', enum: ['about', 'preferences', 'projects', 'notes'], description: 'save: where it belongs (default notes)' } }, required: ['action'] } },
  { name: 'notes_search', description:""")
rep("const activeTools = () => OLLAMA_TOOLS.filter(t => t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel));",
    "const activeTools = () => OLLAMA_TOOLS.filter(t => (t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel)) && (t.function.name !== 'memory' || S.memoryOn));")
rep("    case 'notes_search': {", "    case 'memory': return memoryTool(args);\n    case 'notes_search': {")
rep("notes_search: a => a.query ?", "memory: a => `${a.action || ''}${a.text ? ' “' + String(a.text).slice(0, 60) + '”' : ''}`, notes_search: a => a.query ?")
rep("notes_search: () => a.query ?", "memory: () => ({ save: 'Remembering', search: 'Recalling', forget: 'Forgetting', list: 'Reading her memory' }[a.action] || 'Memory') + (a.text ? ': ' + short(a.text, 50) : ''), notes_search: () => a.query ?")
rep("- Vault now: ${vl} notes, tags:", "- Vault now: ${vl} notes, tags:")
rep("${vl && vl <= 60 ? `\\nNotes: ${vi.notes.join(', ')}` : ''}\n", "${vl && vl <= 60 ? `\\nNotes: ${vi.notes.join(', ')}` : ''}${memoryContext()}\n")
rep("- notes_search: find notes by words or #tag; empty query = vault overview\n", "- notes_search: find notes by words or #tag; empty query = vault overview\n${S.memoryOn ? '- memory: your long-term memory across chats (save / search / forget / list)\\n' : ''}")
rep("- Keep the user's words. When reorganising, move or link content rather than deleting it.", "- Keep the user's words. When reorganising, move or link content rather than deleting it.\n- Never create a second note with the same name as an existing one; edit the existing note. Paths may omit .md.${S.memoryOn ? '\\n- Memory: when the user tells you something lasting about themselves, a preference, a project or person, or says \"remember\", call memory save with one short fact. When they mention an earlier conversation or ask what you know, use memory search. Memory is for facts about the user; notes are for their content.' : ''}")
# journal triggers
rep("function newSession() { cur = {", "function newSession() { if (cur?.messages?.length) journalSession(cur); cur = {")
rep("async function openSession(id) { const s = await idb.get('session:' + id);", "async function openSession(id) { if (cur?.messages?.length && cur.id !== id) journalSession(cur); const s = await idb.get('session:' + id);")
rep("  if (!v) setState('IDLE');\n}", "  if (!v) { setState('IDLE'); scheduleJournal(); } else clearTimeout(journalT);\n}")
rep("  if (cmd === 'config') return openSettings();", """  if (cmd === 'remember') { if (!arg) return toast('Usage: /remember something worth keeping'); try { toast(esc(memorySave(arg, 'notes').msg), 'ok'); } catch (e) { toast(esc(e.message), 'err'); } return; }
  if (cmd === 'memory') { ensureMemory(); openFile(MEM_PATH, { mode: 'read' }); return; }
  if (cmd === 'journal') { if (!cur?.messages.length) return toast('Nothing to journal in this chat yet.'); toast('Writing the journal…'); journalSession(cur); return; }
  if (cmd === 'config') return openSettings();""")
rep("<b>/schedule</b> scheduled prompts · <b>/config</b>", "<b>/schedule</b> scheduled prompts · <b>/remember text</b> · <b>/memory</b> open memory · <b>/journal</b> journal this chat now · <b>/config</b>")
# settings
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">History compaction</div>""", """      <section class="flex flex-col gap-3">
        <div class="pane-h">Long-term memory</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Jade keeps what she learns about you in the note <span class="text-yl">Jade/Memory</span> and reads it at the start of every chat. When you leave a chat (or after a few quiet minutes) she writes a short entry in her journal under <span class="text-yl">Jade/Journal</span> and adds new facts to memory. Both are plain notes you can edit or delete.</p>
        <label class="flex items-center gap-2 text-sm" for="sMemoryOn"><input type="checkbox" id="sMemoryOn" class="accent-emerald-400 w-4 h-4"> Use long-term memory (memory tool + memory in every chat)</label>
        <label class="flex items-center gap-2 text-sm" for="sMemoryRag"><input type="checkbox" id="sMemoryRag" class="accent-emerald-400 w-4 h-4"> Rank memories: put only the lines that match your message in the prompt (keywords + meaning when embeddings are on, BM25 otherwise)</label>
        <label class="flex items-center gap-2 text-sm" for="sMemoryRagK"><span>Memories to inject (BM25)</span><input type="number" id="sMemoryRagK" class="field" min="1" max="30" step="1" style="width:5rem"></label>
        <label class="flex items-center gap-2 text-sm" for="sJournalOn"><input type="checkbox" id="sJournalOn" class="accent-emerald-400 w-4 h-4"> Journal finished chats and learn facts from them</label>
        <div><button type="button" class="btn btn-ghost" id="btnOpenMemory">Open memory note</button></div>
      </section>

      <section class="flex flex-col gap-3" id="embedSection">
        <div class="pane-h">Embeddings (sqlite-vec)</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Jade's memory search uses <b>hybrid search</b>: the words you used (SQLite FTS5) and what you meant (embeddings from Ollama, stored and searched with <span class="text-yl">sqlite-vec</span>), fused into one ranking. She also gets an <span class="text-yl">embeddings</span> tool for her own collections and your notes. The index is the file <span class="text-yl">Jade/.index/vectors.db</span>; delete it and it is rebuilt. It needs an embedding model on your Ollama: <span class="text-yl">ollama pull nomic-embed-text</span>. Without one she falls back to keyword search.</p>
        <label class="flex items-center gap-2 text-sm" for="sEmbedOn"><input type="checkbox" id="sEmbedOn" class="accent-emerald-400 w-4 h-4"> Use embeddings (memory search, ranking and the embeddings tool)</label>
        <label class="flex flex-col gap-1 text-sm" for="sEmbedModel"><span>Embedding model</span><input type="text" id="sEmbedModel" class="field" placeholder="nomic-embed-text" autocomplete="off" spellcheck="false"></label>
        <label class="flex flex-col gap-1 text-sm" for="sEmbedHost"><span>Ollama address for embeddings (empty = the Ollama address above)</span><input type="text" id="sEmbedHost" class="field" placeholder="http://localhost:11434" autocomplete="off" spellcheck="false"></label>
        <label class="flex flex-col gap-1 text-sm" for="sEmbedKey"><span>API key for that address (only if it needs one)</span><input type="password" id="sEmbedKey" class="field" autocomplete="off"></label>
        <label class="flex items-center gap-2 text-sm" for="sEmbedNotes"><input type="checkbox" id="sEmbedNotes" class="accent-emerald-400 w-4 h-4"> Also index all my notes (so the embeddings tool can search the whole vault by meaning)</label>
        <div class="flex items-center gap-3 flex-wrap"><button type="button" class="btn btn-ghost" id="btnEmbedRebuild">Test and rebuild the index</button><span class="text-sm text-dim" id="embedStatus"></span></div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">History compaction</div>""")
rep("  $('#sCompactAuto').checked = !!S.compactAuto;", "  $('#sMemoryOn').checked = !!S.memoryOn; $('#sJournalOn').checked = !!S.journalOn; $('#sMemoryRag').checked = !!S.memoryRag; $('#sMemoryRagK').value = S.memoryRagK || 8;\n  $('#sEmbedOn').checked = S.embedOn !== false; $('#sEmbedModel').value = S.embedModel || ''; $('#sEmbedHost').value = S.embedHost || ''; $('#sEmbedKey').value = S.embedKey || ''; $('#sEmbedNotes').checked = !!S.embedNotes;\n  $('#sCompactAuto').checked = !!S.compactAuto;")
rep("  Object.assign(S, { jadeShow: $('#sJadeShow').checked,", "  Object.assign(S, { memoryOn: $('#sMemoryOn').checked, journalOn: $('#sJournalOn').checked, memoryRag: $('#sMemoryRag').checked, memoryRagK: Math.max(1, Math.min(30, parseInt($('#sMemoryRagK').value) || 8)), embedOn: $('#sEmbedOn').checked, embedModel: $('#sEmbedModel').value.trim() || 'nomic-embed-text', embedHost: $('#sEmbedHost').value.trim(), embedKey: $('#sEmbedKey').value.trim(), embedNotes: $('#sEmbedNotes').checked });\n  Object.assign(S, { jadeShow: $('#sJadeShow').checked,")
rep("const closeSettings = () => $('#settings').hidden = true;", "const closeSettings = () => $('#settings').hidden = true;\n$('#btnOpenMemory').onclick = () => { closeSettings(); ensureMemory(); openFile(MEM_PATH, { mode: 'read' }); };\n$('#btnEmbedRebuild').onclick = async () => {\n  const st = $('#embedStatus'); st.textContent = 'Working…';\n  Object.assign(S, { embedOn: $('#sEmbedOn').checked, embedModel: $('#sEmbedModel').value.trim() || 'nomic-embed-text', embedHost: $('#sEmbedHost').value.trim(), embedKey: $('#sEmbedKey').value.trim(), embedNotes: $('#sEmbedNotes').checked });\n  try {\n    const r = await vmemRebuild(n => { st.textContent = `Embedded ${n} texts…`; }); const x = await vmemStatus();\n    st.textContent = (r.error ? 'Problem: ' + r.error + '. ' : 'Works. ') + `sqlite-vec ${x.vec} · ${x.model}${x.dim ? ' (' + x.dim + ')' : ''} · ` + (x.collections.map(c => `${c.name} ${c.embedded}/${c.chunks}`).join(', ') || 'nothing to index yet');\n  } catch (e) { st.textContent = 'Failed: ' + e.message; }\n};")
rep("  if (!(await vfs.load())) seedFs();", "  if (!(await vfs.load())) seedFs();\n  ensureMemory();")
rep("Object.assign(window, { vfs, openFile, Graph, noteHist, term, vaultIndex, $ });", "Object.assign(window, { vfs, openFile, Graph, noteHist, term, vaultIndex, $, memoryContext, journalSession, S, systemPrompt, runTool, userShell, Jade });")

# ================= v3: LaTeX, edit + resend, SOUL/AGENTS/SYSTEM, skills =================
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" id="katex-css">\n<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" id="katex-js"></script>')
rep("  for (const pre of div.querySelectorAll('pre')) {",
    """  for (const code of div.querySelectorAll('pre > code.language-math, pre > code.language-latex, pre > code.language-tex, pre > code.language-katex')) { const d = document.createElement('div'); d.className = 'math-tex'; d.dataset.display = '1'; d.dataset.tex = code.textContent.trim(); code.parentElement.replaceWith(d); }
  for (const el of div.querySelectorAll('.math-tex')) renderTex(el);
  for (const pre of div.querySelectorAll('pre')) {""")
# user messages: index, display text, edit/copy
rep("""function userBlock(text) {
  const el = document.createElement('div'); el.className = 'msg-user flex flex-col gap-1';
  el.innerHTML = `<div class="who">You</div><div class="bubble cut cut-sm"></div>`; el.querySelector('.bubble').textContent = text; return el;
}""", """function userBlock(text, idx) {
  const el = document.createElement('div'); el.className = 'msg-user flex flex-col gap-1'; el.dataset.i = idx ?? '';
  el.innerHTML = `<div class="who">You</div><div class="bubble cut cut-sm"></div><div class="msg-actions"><button type="button" data-uact="edit">Edit</button><button type="button" data-uact="copy">Copy</button></div>`; el.querySelector('.bubble').textContent = text; return el;
}""")
rep("    if (m.role === 'user') { ai = null; chatEl.appendChild(userBlock(m.content)); continue; }", "    if (m.role === 'user') { ai = null; chatEl.appendChild(userBlock(m.display || m.content, i)); continue; }")
rep("  if (text.startsWith('/')) return slash(text);\n  if (running) { queue.push(text); updateQueueNote(); return; }",
    "  if (running) { queue.push(text); updateQueueNote(); return; }\n  let content = text;\n  if (/^\\/skill:/i.test(text)) { content = expandSkillCommand(text); if (!content) return; }\n  else if (text.startsWith('/')) return slash(text);")
rep("  cur.messages.push({ role: 'user', content: text }); chatEl.appendChild(userBlock(text)); scrollDown(true); saveSession();",
    "  cur.messages.push(content === text ? { role: 'user', content } : { role: 'user', content, display: text }); chatEl.appendChild(userBlock(text, cur.messages.length - 1)); scrollDown(true); saveSession();")
rep("    if (m.role === 'user') return `USER: ${m.content}`;", "    if (m.role === 'user') return `USER: ${m.display || m.content}`;")
# composer suggestion row
rep('        <div id="queueNote" class="hint mb-1" hidden></div>', '        <div id="queueNote" class="hint mb-1" hidden></div>\n        <div class="link-suggest slash-suggest" id="slashSuggest" hidden></div>')
# tools: skill
rep("""  { name: 'memory', description:""", """  { name: 'skill', description: 'Load one of your skills (instruction packs listed in your instructions under Skills) by name, and get its step-by-step instructions to follow.',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'Skill name, e.g. daily-review' }, input: { type: 'string', description: 'Optional: what to apply it to' } }, required: ['name'] } },
  { name: 'memory', description:""")
rep("    case 'memory': return memoryTool(args);", "    case 'memory': return memoryTool(args);\n    case 'skill': return skillTool(args);")
rep("memory: a => `${a.action || ''}", "skill: a => a.name || '', memory: a => `${a.action || ''}")
rep("memory: () => ({ save: 'Remembering',", "skill: () => `Loading skill: ${short(a.name)}`, memory: () => ({ save: 'Remembering',")
# system prompt: SYSTEM.md override, persona, AGENTS.md, skills
INTRO = "return `You are Jade, a cyberpunk netrunner who keeps the user's personal knowledge vault: a folder of markdown notes linked together like Obsidian. Your main job is helping the user capture, find, organise, connect and think with their notes. You run entirely inside the user's browser and can also read, write, edit and run code in the same filesystem.\n\nVault conventions:"
rep(INTRO, "const steer = steering(); return `${steer.system || `You are Jade, the keeper of the user's personal knowledge vault: a folder of markdown notes linked together like Obsidian. Your main job is helping the user capture, find, organise, connect and think with their notes. You run entirely inside the user's browser and can also read, write, edit and run code in the same filesystem.`}\n\nVault conventions:")
END = "- Be concise. When finished, say which notes changed, as [[links]].`; };"
i = s.index('\n\nGuidelines:\n- Look before you change things'); j = s.index(END, i)
s = s[:i] + "${steer.system ? '' : `" + s[i:j + len(END) - len('`; };')] + "`}${steeringContext(steer)}`; };" + s[j + len(END):]
rep("- Daily notes live at /daily/YYYY-MM-DD.md.", "- Math renders with KaTeX: write $inline$ or $$display$$ LaTeX (never inside backticks).\\n- Daily notes live at /daily/YYYY-MM-DD.md.")
rep("${S.memoryOn ? '- memory: your long-term memory across chats (save / search / forget / list)\\n' : ''}", "${S.memoryOn ? '- memory: your long-term memory across chats (save / search / forget / list)\\n' : ''}- skill: load a skill's instructions by name\\n")
# slash commands
rep("  if (cmd === 'config') return openSettings();", """  if (cmd === 'skills') { const all = listSkills(); toast(all.length ? all.map(x => `<b>/skill:${esc(x.name)}</b>${x.off ? ' (off)' : ''}`).join(' · ') : 'No skills yet. Ask Jade to create one.'); return; }
  if (cmd === 'soul') { ensureSteering(); openFile(SOUL_PATH, { mode: 'edit' }); return; }
  if (cmd === 'agents') { ensureSteering(); openFile(agentsFiles()[0] || AGENTS_PATH, { mode: 'edit' }); return; }
  if (cmd === 'config') return openSettings();""")
rep("<b>/journal</b> journal this chat now ·", "<b>/journal</b> journal this chat now · <b>/skill:name</b> run a skill · <b>/skills</b> · <b>/soul</b> · <b>/agents</b> ·")
# settings
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Long-term memory</div>""", """      <section class="flex flex-col gap-3">
        <div class="pane-h">Persona, instructions & skills</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]"><span class="text-yl">SOUL.md</span> is who Jade is. <span class="text-yl">AGENTS.md</span> holds your standing instructions. <span class="text-yl">SYSTEM.md</span> (optional) replaces her base prompt. All three are notes, read fresh on every message; text inside &lt;!-- comments --&gt; is not sent.</p>
        <div class="flex flex-wrap gap-2"><button type="button" class="btn btn-ghost" id="btnOpenSoul">SOUL.md</button><button type="button" class="btn btn-ghost" id="btnOpenAgents">AGENTS.md</button><button type="button" class="btn btn-ghost" id="btnOpenSystem">SYSTEM.md</button></div>
        <div class="flex items-center justify-between gap-2 mt-1"><div class="lbl">Skills · run with /skill:name, or Jade picks them</div><button type="button" class="btn btn-ghost" id="btnNewSkill">+ Skill</button></div>
        <div id="skillList" class="flex flex-col gap-1"></div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">Long-term memory</div>""")
rep("  $('#sMemoryOn').checked = !!S.memoryOn;", "  renderSkillsSettings();\n  $('#sMemoryOn').checked = !!S.memoryOn;")
rep("  if (!(await vfs.load())) seedFs();\n  ensureMemory();", "  if (!(await vfs.load())) seedFs();\n  ensureMemory(); ensureSteering();")
s = s.replace('/* =====================================================================\n   BOOT', rd('steer.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("  if (scr === 'file') {", "  if (!$('#slashSuggest').hidden) { $('#slashSuggest').hidden = true; return true; }\n  if (scr === 'file') {")
CSS3 = r"""
.msg-actions{display:flex;justify-content:flex-end;gap:2px;margin-top:-2px}
.msg-actions button{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);padding:6px 8px;min-height:30px}
.msg-actions button:active,.msg-actions button:hover{color:var(--cy)}
.msg-edit textarea{font-size:15px;min-width:min(78vw,520px)}
.slash-suggest{margin:0 0 6px;border:1px solid var(--line-hot)}
.math-tex{color:var(--fg)}
div.math-tex{overflow-x:auto;overflow-y:hidden;margin:.7em 0;padding:4px 0;max-width:100%}
.math-raw{font-family:var(--f-mono);font-size:.92em;color:#8df2c9}
.katex{font-size:1.08em}
.katex-display{margin:0}
.skill-row{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px dashed var(--line)}
"""
rep("#graphCv{background:", CSS3 + "#graphCv{background:")
rep("Object.assign(window, { vfs, openFile,", "Object.assign(window, { listSkills, steering, resendFrom, openFile2: openFile, vfs, openFile,")

# v3b: the artifact viewer blocks third-party stylesheets, so inline KaTeX's CSS with its woff2 fonts
import base64 as _b64, re as _re2
_K = NM + 'katex/dist/'
_kcss = open(_K + 'katex.min.css').read()
_kcss = _re2.sub(r'src:url\(fonts/([^)]+\.woff2)\) format\("woff2"\)[^;}]*', lambda m: 'src:url(data:font/woff2;base64,' + _b64.b64encode(open(_K + 'fonts/' + m.group(1), 'rb').read()).decode() + ') format("woff2")', _kcss)
assert 'url(fonts/' not in _kcss
rep('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" id="katex-css">', '<style id="katex-css">' + _kcss + '</style>')

# ================= v4: providers (local Ollama, Ollama Cloud, Groq, OpenAI-compatible) + fallback =================
i = s.index('class FetchOllama { // minimal ollama-js compatible surface'); j = s.index('function setOllamaChip(')
s = s[:i] + rd('providers.js') + '\n' + s[j:]
rep("$('#txtOllama').textContent = 'OLLAMA ' + text; }", "$('#txtOllama').textContent = (PROVIDERS[activeProv]?.chip || 'OLLAMA') + ' ' + text; $('#chipOllama').title = providerName(); }")
assert s.count("fetch(S.host.replace(/\\/+$/, '') + '/api/chat', {") == 2, s.count("fetch(S.host.replace(/\\/+$/, '') + '/api/chat', {")
s = s.replace("fetch(S.host.replace(/\\/+$/, '') + '/api/chat', {", "llmPost({")
rep("    } catch (e) { throw new Error(`could not reach Ollama at ${S.host}`); }", "    } catch (e) { throw new Error(`could not reach ${providerName()}`); }")
rep("const DEFAULTS = { memoryOn: true,", "const DEFAULTS = { provider: 'local', fallbacks: [], fallbackOrder: ['local', 'cloud', 'groq', 'openai'], auxProv: '', auxModel: '', bgMode: 'agent', bgNotify: true, groqKey: '', oaiHost: '', oaiKey: '', modelBy: {}, memoryOn: true,")
rep("const saveSettings = () => ls.set('settings', S);", "const saveSettings = () => { if (activeProv && S.model) (S.modelBy ||= {})[activeProv] = S.model; ls.set('settings', S); };")
# agent loop: automatic fallback when the Mac drops mid-chat
rep("async function agentLoop() {\n  setRunning(true);", "async function agentLoop() {\n  const triedProv = new Set();\n  setRunning(true);")
rep("        let hint = msg;\n", """        if (/Failed to fetch|NetworkError|Load failed|did not answer|rate limit|HTTP 5\\d\\d|overloaded|unavailable|timed? ?out/i.test(msg) && providerChain().length > 1) {
          const from = PROVIDERS[activeProv].label; thinkD.remove(); textEl.remove(); jadeBubble(`Lost ${from}. Trying the next provider…`);
          if (await failover(triedProv)) { toast(`${esc(from)} failed (${esc(msg.slice(0, 80))}). Continuing on ${esc(PROVIDERS[activeProv].label)}.`, 'ok'); turns--; continue; }
        }
        let hint = msg;
""")
rep("hint = `Could not reach Ollama at ${S.host}. Make sure it is running with OLLAMA_ORIGINS=\"*\" so this page is allowed to call it.`;",
    "hint = activeProv === 'local' ? `Could not reach Ollama at ${S.host}. Make sure it is running with OLLAMA_ORIGINS=\"*\" so this page is allowed to call it${providerChain().length > 1 ? '' : ', or add fallback providers in Config'}.` : `Could not reach ${providerName()}. Check your internet connection and API key.`;")
rep("  else if (text.startsWith('/')) return slash(text);", "  else if (text.startsWith('/')) return slash(text);\n  await maybeRestorePrimary();")
# empty-state boot row
rep("""<b>Ollama at <span class="mono text-cy">${esc(host)}</span></b> — ${ok ? `${models.length} model${models.length > 1 ? 's' : ''} found` : 'not reachable'}${!ok ? `<div class="text-dim text-[13px] mt-1">Start Ollama so it accepts requests from this page, then press Retry:<div class="mono text-yl text-xs mt-1 break-all">${esc(corsCmd)}</div>""",
    """<b>${activeProv === 'local' ? `Ollama at <span class="mono text-cy">${esc(host)}</span>` : esc(PROVIDERS[activeProv].label) + (activeProv !== (S.provider || 'local') ? ' <span class="text-dim">(fallback)</span>' : '')}</b> — ${ok ? `${models.length} model${models.length > 1 ? 's' : ''} found` : 'not reachable'}${!ok ? `<div class="text-dim text-[13px] mt-1">${activeProv === 'local' ? `Start Ollama so it accepts requests from this page, then press Retry:<div class="mono text-yl text-xs mt-1 break-all">${esc(corsCmd)}</div>${providerChain().length > 1 ? '' : '<div class="mt-1">Away from your computer? Pick Ollama Cloud or Groq in Config (as the provider, or as a fallback).</div>'}` : 'Check the API key in Config, then press Retry.'}""")
# settings markup
rep('<div class="pane-h">Ollama link</div>', '<div class="pane-h">Model provider</div>')
rep('          <div><label class="lbl" for="sHost">Address</label><input id="sHost" class="field mt-1" placeholder="http://localhost:11434"></div>',
    """          <div><label class="lbl" for="sProvider">Provider</label><select id="sProvider" class="field mt-1"><option value="local">Ollama on my computer</option><option value="cloud">Ollama Cloud (ollama.com)</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible endpoint</option></select></div>
          <div data-prov="local"><label class="lbl" for="sHost">Ollama address</label><input id="sHost" class="field mt-1" placeholder="http://localhost:11434" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <div id="sFallbackWrap" style="grid-column:1/-1"><div class="lbl">If it fails, try these in order</div><div id="fbList" class="flex flex-col mt-1"></div><div class="hint mt-1">Used when the provider can't be reached, times out, or hits a rate limit. Jade switches back automatically when it returns.</div></div>
          <div data-prov="cloud"><label class="lbl" for="sCloudKey">Ollama API key</label><input id="sCloudKey" type="password" class="field mt-1" autocomplete="off" placeholder="from ollama.com/settings/keys"></div>
          <div data-prov="groq"><label class="lbl" for="sGroqKey">Groq API key</label><input id="sGroqKey" type="password" class="field mt-1" autocomplete="off" placeholder="gsk_… from console.groq.com/keys"></div>
          <div data-prov="openai"><label class="lbl" for="sOaiHost">Base URL</label><input id="sOaiHost" class="field mt-1" placeholder="https://api.example.com/v1" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <div data-prov="openai"><label class="lbl" for="sOaiKey">API key</label><input id="sOaiKey" type="password" class="field mt-1" autocomplete="off"></div>""")
rep("""<p class="hint leading-relaxed" id="corsHint">""", """<p class="hint leading-relaxed" id="provHint" hidden></p>
        <p class="hint leading-relaxed" id="corsHint">""")
rep("const closeSettings = () => $('#settings').hidden = true;", """const closeSettings = () => $('#settings').hidden = true;
const PROV_HINT = {
  cloud: 'Runs on ollama.com with your account, no computer needed. The key also powers Ollama web search. Keys stay on this device.',
  groq: 'Very fast hosted models. Pick one that supports tool calling (for example a gpt-oss, Kimi K2 or Llama 3.3 70B model). The free tier has rate limits. Keys stay on this device.',
  openai: 'Any server that speaks the OpenAI chat completions API with tools (OpenRouter, Together, LM Studio, vLLM, OpenAI…). Keys stay on this device.',
};
function showProvFields() {
  const p = $('#sProvider').value;
  for (const el of $$('[data-prov]')) el.hidden = !(el.dataset.prov === p || fbDraft.on.has(el.dataset.prov));
  $('#corsHint').hidden = p !== 'local' && !fbDraft.on.has('local');
  $('#provHint').hidden = p === 'local'; $('#provHint').textContent = PROV_HINT[p] || '';
}
function readProvFields() {
  S.provider = $('#sProvider').value; S.fallbackOrder = [...fbDraft.order]; S.fallbacks = fbDraft.order.filter(q => fbDraft.on.has(q) && q !== S.provider);
  S.groqKey = $('#sGroqKey').value.trim(); S.oaiHost = $('#sOaiHost').value.trim().replace(/\\/+$/, ''); S.oaiKey = $('#sOaiKey').value.trim();
  const ck = $('#sCloudKey').value.trim(); if (ck !== ($('#sCloudKey').dataset.orig || '')) { S.ollamaKey = ck; $('#sKey').value = ck; $('#sCloudKey').dataset.orig = ck; }
}
// provider settings as currently typed in the form, without touching the live settings
function formCfg() {
  const c = { ...S }; if ($('#settings').hidden) return c;
  return Object.assign(c, { host: $('#sHost').value.trim() || c.host, groqKey: $('#sGroqKey').value.trim(), oaiHost: $('#sOaiHost').value.trim().replace(/\\/+$/, ''), oaiKey: $('#sOaiKey').value.trim(),
    lcppHost: ($('#sLcppHost')?.value.trim() || 'http://localhost:8080').replace(/\\/+$/, ''), lcppKey: $('#sLcppKey')?.value.trim() || '', ollamaKey: $('#sCloudKey').value.trim() || $('#sKey').value.trim() || c.ollamaKey });
}
$('#sProvider').onchange = () => { renderFbList(); showProvFields(); };""")
rep("  $('#sHost').value = S.host; $('#sTemp').value", "  $('#sProvider').value = S.provider || 'local'; loadFbDraft(); $('#sCloudKey').value = $('#sCloudKey').dataset.orig = S.ollamaKey || ''; $('#sGroqKey').value = S.groqKey || ''; $('#sOaiHost').value = S.oaiHost || ''; $('#sOaiKey').value = S.oaiKey || ''; renderFbList(); showProvFields();\n  $('#sHost').value = S.host; $('#sTemp').value")
rep("$('#btnRefresh').onclick = async () => { S.host = $('#sHost').value.trim() || DEFAULTS.host; await connect();", "$('#btnRefresh').onclick = async () => { S.host = $('#sHost').value.trim() || DEFAULTS.host; readProvFields(); await connect();")
rep("  saveSettings(); setVoice($('#sJadeVoice').checked);", "  readProvFields();\n  saveSettings(); setVoice($('#sJadeVoice').checked);")
# drawer quick switch
rep("""    <label class="lbl" for="modelSel">Model</label>""", """    <label class="lbl" for="provSel">Provider</label>
    <select id="provSel" class="field cut-sm cut"><option value="local">Ollama on my computer</option><option value="cloud">Ollama Cloud</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible</option></select>
    <label class="lbl" for="modelSel">Model</label>""")
rep("$('#modelSel').onchange = e => { S.model = e.target.value; saveSettings(); fillModelSelects(); };", """$('#modelSel').onchange = e => { S.model = e.target.value; saveSettings(); fillModelSelects(); };
$('#provSel').value = S.provider || 'local';
$('#provSel').onchange = async e => { const p = e.target.value; const miss = providerMissing(p); if (miss) { toast(esc(miss.replace(/ \\(.*\\)$/, '')) + '. Add it in Config.', 'err'); e.target.value = S.provider || 'local'; openSettings(); $('#sProvider').value = p; showProvFields(); return; } S.provider = p; saveSettings(); await connect(); };""")
rep("  $('#hdrModel').textContent = S.model ? S.model : models.length ? 'pick a model' : 'Ollama offline';", "  $('#hdrModel').textContent = (S.model ? S.model : models.length ? 'pick a model' : (activeProv === 'local' ? 'Ollama offline' : PROVIDERS[activeProv].label + ' offline')) + (activeProv !== 'local' && S.model ? ' · ' + PROVIDERS[activeProv].label.replace('OpenAI-compatible', 'API') : '');\n  if ($('#provSel')) $('#provSel').value = S.provider || 'local';")
rep("Object.assign(window, { listSkills,", "Object.assign(window, { connect, toOpenAIMessages, getProv: () => ({ activeProv, models, client: client?.constructor?.name }), listSkills,")

# ================= v5: compaction model, backup JSON, background mode =================
rep("""          <div><label class="lbl" for="sCompactPct">Also compact when context is this full (%)</label><input id="sCompactPct" type="number" min="40" max="98" step="1" class="field mt-1"></div>""",
    """          <div><label class="lbl" for="sCompactPct">Also compact when context is this full (%)</label><input id="sCompactPct" type="number" min="40" max="98" step="1" class="field mt-1"></div>
          <div><label class="lbl" for="sAuxProv">Model for compaction & journal</label><select id="sAuxProv" class="field mt-1"><option value="">Same as the chat model</option><option value="local">Ollama on my computer</option><option value="cloud">Ollama Cloud</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible</option></select></div>
          <div id="sAuxModelWrap" hidden><label class="lbl" for="sAuxModel">Model</label><div class="flex gap-2 mt-1"><select id="sAuxModel" class="field"></select><button type="button" class="btn" id="btnAuxScan">Scan</button></div></div>""")
rep("""        <p class="hint leading-relaxed">A turn is one message from you plus everything the agent does in reply.""", """        <p class="hint leading-relaxed">A small, fast model is usually enough for summaries and saves your main model's time. If it fails, the chat model is used. A turn is one message from you plus everything the agent does in reply.""")
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Persona, instructions & skills</div>""", """      <section class="flex flex-col gap-3">
        <div class="pane-h">Background</div>
        <div><label class="lbl" for="sBgMode">Keep Jade running when the app is in the background</label><select id="sBgMode" class="field mt-1"><option value="agent">While she is working (recommended)</option><option value="always">Always while the app is open (keeps schedules firing)</option><option value="off">Off</option></select></div>
        <label class="flex items-center gap-2 text-sm" for="sBgNotify"><input type="checkbox" id="sBgNotify" class="accent-emerald-400 w-4 h-4"> Notify me when a run finishes in the background</label>
        <div id="bgNative" class="flex flex-col gap-2"><div class="text-sm flex items-center gap-2" id="bgBattery"></div><div><button type="button" class="btn btn-ghost" id="btnBattery">Allow unrestricted battery</button></div><p class="hint leading-relaxed">The app shows a small notification while it keeps Jade alive. Android needs that to let her finish work with the screen off.</p></div>
        <p class="hint leading-relaxed" id="bgWeb">In a browser tab, Jade keeps working while the tab stays open, but the browser may slow it down in the background. Install the Android app for real background runs.</p>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">Backup</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Export to a JSON file. <b>Everything</b> = all notes and files, chats, schedules, memory, skills and settings. <b>Config</b> = settings, SOUL.md, AGENTS.md, SYSTEM.md, memory and skills. Import a file to restore it: a full backup replaces what is here, a config file merges in.</p>
        <label class="flex items-center gap-2 text-sm" for="sBackupKeys"><input type="checkbox" id="sBackupKeys" class="accent-emerald-400 w-4 h-4"> Include API keys (keep that file private)</label>
        <div class="flex flex-wrap gap-2"><button type="button" class="btn btn-solid cut cut-sm" id="btnExportAll">Export everything</button><button type="button" class="btn" id="btnExportCfg">Export config</button><label class="btn btn-ghost" for="importBackup">Import…</label><input type="file" id="importBackup" accept=".json,application/json" hidden><button type="button" class="btn btn-ghost" id="btnBackupCopy" hidden>Copy JSON</button></div>
        <div class="hint" id="backupNote"></div>
        <div class="mt-2 p-3 rounded border border-white/10" id="abBox">
          <label class="flex items-center gap-2 text-sm" for="sAbOn"><input type="checkbox" id="sAbOn" class="accent-emerald-400 w-4 h-4"> <b>Scheduled backup to a server</b></label>
          <div class="hint mt-1">Uploads a backup on a schedule to your own backup server (server/jade-backup-server.py; setup in docs/backup-server.md). It runs while the app is running, like the heartbeat.</div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div class="col-span-2"><label class="lbl" for="sAbUrl">Server address</label><input id="sAbUrl" class="field mt-1" placeholder="http://192.168.1.20:8787" autocomplete="off"></div>
            <div class="col-span-2"><label class="lbl" for="sAbToken">Token</label><input id="sAbToken" type="password" class="field mt-1" autocomplete="off"></div>
            <div><label class="lbl" for="sAbHours">Every (hours)</label><input id="sAbHours" type="number" min="1" max="720" class="field mt-1"></div>
            <div><label class="lbl" for="sAbKind">What</label><select id="sAbKind" class="field mt-1"><option value="full">Everything</option><option value="config">Config only</option></select></div>
          </div>
          <label class="flex items-center gap-2 text-sm mt-2" for="sAbEncrypt"><input type="checkbox" id="sAbEncrypt" class="accent-emerald-400 w-4 h-4"> Encrypt on this device before sending (the server never sees your notes)</label>
          <label class="flex items-center gap-2 text-sm mt-1" for="sAbKeys"><input type="checkbox" id="sAbKeys" class="accent-emerald-400 w-4 h-4"> Include API keys and SSH hosts (forces encryption)</label>
          <div class="mt-1"><label class="lbl" for="sAbPass">Passphrase (needed to restore an encrypted backup; if you lose it the backup cannot be opened)</label><input id="sAbPass" type="password" class="field mt-1" autocomplete="off"></div>
          <div class="flex flex-wrap items-center gap-2 mt-2"><button type="button" id="abNow" class="btn btn-solid cut cut-sm">Back up now</button><button type="button" id="abTest" class="btn btn-ghost">Test connection</button><button type="button" id="abPick" class="btn btn-ghost">Restore from server…</button></div>
          <div id="abRestoreRow" class="flex gap-2 mt-2" hidden><select id="abSel" class="field flex-1"></select><button type="button" id="abRestore" class="btn">Restore this</button></div>
          <div class="hint mt-1" id="abStatus"></div>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">Persona, instructions & skills</div>""")
rep("  renderSkillsSettings();\n", "  renderSkillsSettings(); renderBgSettings();\n  $('#sAuxProv').value = S.auxProv || ''; $('#sAuxModel').dataset.want = S.auxModel || ''; fillAuxModels(false);\n")
rep("  readProvFields();\n  saveSettings(); setVoice($('#sJadeVoice').checked);", "  readProvFields();\n  Object.assign(S, { auxProv: $('#sAuxProv').value, auxModel: $('#sAuxProv').value ? $('#sAuxModel').value : '', bgMode: $('#sBgMode').value, bgNotify: $('#sBgNotify').checked });\n  if (S.bgMode !== 'off' && window.NetrunnerAndroid?.requestNotifications) { try { window.NetrunnerAndroid.requestNotifications(); } catch {} }\n  saveSettings(); bgSync(); setVoice($('#sJadeVoice').checked);")
# running state → background service + finish notification
rep("  if (!v) { setState('IDLE'); scheduleJournal(); } else clearTimeout(journalT);\n}", "  if (!v) { setState('IDLE'); scheduleJournal(); bgFinished(); } else { clearTimeout(journalT); bgSync(); }\n}")
rep("function setState(s) { $('#hudState').textContent = s;", "function setState(s) { bgState(s); $('#hudState').textContent = s;")
rep("  if (cmd === 'config') return openSettings();", "  if (cmd === 'export') { exportBackup(arg === 'config' ? 'config' : 'full'); return; }\n  if (cmd === 'config') return openSettings();")
rep("<b>/skills</b> · <b>/soul</b>", "<b>/skills</b> · <b>/export</b> [config] · <b>/soul</b>")
rep("  await bbBoot; if (!cur?.messages.length) renderEmpty();", "  await bbBoot; if (!cur?.messages.length) renderEmpty();\n  bgSync();")
s = s.replace('/* =====================================================================\n   BOOT', rd('extras.js') + '\n/* =====================================================================\n   BOOT', 1)
CSS5 = """
.fb-row{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px dashed var(--line)}
.fb-row .icon-btn{width:34px;height:34px;font-size:12px}
.fb-row .icon-btn[disabled]{opacity:.25}
"""
rep("#graphCv{background:", CSS5 + "#graphCv{background:")
rep("  persist() { idb.set('vfs', [...this.nodes.entries()]); }", "  persist() { if (window.__restoring) return; idb.set('vfs', [...this.nodes.entries()]); }")
rep("const saveSession = (() => { let t; return () => { clearTimeout(t);", "const saveSession = (() => { let t; return () => { if (window.__restoring) return; clearTimeout(t);")
rep("const saveSettings = () => { if (activeProv", "const saveSettings = () => { if (window.__restoring) return; if (activeProv")
rep("Object.assign(window, { connect,", "Object.assign(window, { buildBackup, importBackup, bgSync, providerChain, connect,")

# ================= v6: heartbeat, chat attachments, llama.cpp =================
rep("provider: 'local', fallbacks: [], fallbackOrder: ['local', 'cloud', 'groq', 'openai'],", "provider: 'local', fallbacks: [], fallbackOrder: ['local', 'llamacpp', 'cloud', 'groq', 'openai'], lcppHost: 'http://localhost:8080', lcppKey: '', hbOn: false, hbEvery: 30, hbStart: '08:00', hbEnd: '22:00', hbChat: 'own', hbPrompt: '', hbProv: '', hbModel: '',")
# llama.cpp in every provider menu
s = s.replace('<option value="cloud">Ollama Cloud (ollama.com)</option>', '<option value="llamacpp">llama.cpp server</option><option value="cloud">Ollama Cloud (ollama.com)</option>')
s = s.replace('<option value="local">Ollama on my computer</option><option value="cloud">Ollama Cloud</option>', '<option value="local">Ollama on my computer</option><option value="llamacpp">llama.cpp server</option><option value="cloud">Ollama Cloud</option>')
rep("""          <div data-prov="cloud"><label class="lbl" for="sCloudKey">""", """          <div data-prov="llamacpp"><label class="lbl" for="sLcppHost">llama.cpp server address</label><input id="sLcppHost" class="field mt-1" placeholder="http://localhost:8080" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <div data-prov="llamacpp"><label class="lbl" for="sLcppKey">llama.cpp API key (only if started with --api-key)</label><input id="sLcppKey" type="password" class="field mt-1" autocomplete="off"></div>
          <div data-prov="cloud"><label class="lbl" for="sCloudKey">""")
rep("  openai: 'Any server that speaks", "  llamacpp: 'Your own llama-server. Start it with --jinja so tool calling works (for example: llama-server -m model.gguf --jinja --host 0.0.0.0 --port 8080). It lists the model it was started with.',\n  openai: 'Any server that speaks")
rep("S.oaiKey = $('#sOaiKey').value.trim();", "S.oaiKey = $('#sOaiKey').value.trim(); S.lcppHost = $('#sLcppHost').value.trim().replace(/\\/+$/, '') || 'http://localhost:8080'; S.lcppKey = $('#sLcppKey').value.trim();")
rep("$('#sOaiKey').value = S.oaiKey || '';", "$('#sOaiKey').value = S.oaiKey || ''; $('#sLcppHost').value = S.lcppHost || 'http://localhost:8080'; $('#sLcppKey').value = S.lcppKey || '';")
# heartbeat settings
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Background</div>""", """      <section class="flex flex-col gap-3">
        <div class="pane-h">Heartbeat</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Every so often Jade wakes up, reads <span class="text-yl">Jade/HEARTBEAT.md</span> and checks what it lists. If all is well she answers HEARTBEAT_OK and stays quiet; otherwise you get a notification. An empty checklist costs nothing.</p>
        <label class="flex items-center gap-2 text-sm" for="sHbOn"><input type="checkbox" id="sHbOn" class="accent-emerald-400 w-4 h-4"> Heartbeat on</label>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          <div><label class="lbl" for="sHbEvery">Every (minutes)</label><input id="sHbEvery" type="number" min="1" max="1440" class="field mt-1"></div>
          <div><label class="lbl" for="sHbStart">Active from</label><input id="sHbStart" type="time" class="field mt-1"></div>
          <div><label class="lbl" for="sHbEnd">Until</label><input id="sHbEnd" type="time" class="field mt-1"></div>
        </div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
          <div><label class="lbl" for="sHbProv">Heartbeat model</label><select id="sHbProv" class="field mt-1"><option value="">Same as the chat model</option><option value="local">Ollama on my computer</option><option value="llamacpp">llama.cpp server</option><option value="cloud">Ollama Cloud</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible</option></select></div>
          <div id="sHbModelWrap" hidden><label class="lbl" for="sHbModel">Model</label><div class="flex gap-2 mt-1"><select id="sHbModel" class="field"></select><button type="button" class="btn" id="btnHbScan">Scan</button></div></div>
          <div><label class="lbl" for="sHbChat">Where it runs</label><select id="sHbChat" class="field mt-1"><option value="own">Its own “♥ Heartbeat” chat</option><option value="current">The chat that is open</option></select></div>
        </div>
        <div><label class="lbl" for="sHbPrompt">Heartbeat prompt (optional)</label><textarea id="sHbPrompt" class="field mt-1" rows="2"></textarea></div>
        <div class="flex flex-wrap gap-2"><button type="button" class="btn btn-ghost" id="btnHbEdit">Edit HEARTBEAT.md</button><button type="button" class="btn btn-ghost" id="btnHbRun">Run now</button></div>
        <div class="hint" id="hbStatus"></div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">Background</div>""")
rep("  renderSkillsSettings(); renderBgSettings();\n  $('#sAuxProv').value = S.auxProv || ''; $('#sAuxModel').dataset.want = S.auxModel || ''; fillAuxModels(false);\n", "  renderSkillsSettings(); renderBgSettings();\n")
rep("  $('#settings').hidden = false; $('#sHost').focus();", "  $('#settings').hidden = false; $('#sHost').focus();\n  renderHbSettings(); $('#sAuxProv').value = S.auxProv || ''; $('#sAuxModel').dataset.want = S.auxModel || ''; fillAuxModels(false);")
rep("  readProvFields();\n  Object.assign(S, { auxProv:", "  readProvFields(); readHbSettings();\n  Object.assign(S, { auxProv:")
s = s.replace('<option value="local">Ollama on my computer</option><option value="cloud">Ollama Cloud</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible</option></select></div>\n          <div id="sAuxModelWrap"', '<option value="local">Ollama on my computer</option><option value="llamacpp">llama.cpp server</option><option value="cloud">Ollama Cloud</option><option value="groq">Groq</option><option value="openai">OpenAI-compatible</option></select></div>\n          <div id="sAuxModelWrap"')

# ================= AICord: character chat provider (docs.aicordapp.com/api/aicord-chat-api) =================
rep("lcppKey: '', hbOn: false,", "lcppKey: '', aicKey: '', hbOn: false,")
rep("fallbackOrder: ['local', 'llamacpp', 'cloud', 'groq', 'openai'],", "fallbackOrder: ['local', 'llamacpp', 'cloud', 'groq', 'openai', 'aicord'],")
for _o in ('<option value="openai">OpenAI-compatible endpoint</option>', '<option value="openai">OpenAI-compatible</option>'):
    assert s.count(_o) >= 1, _o
    s = s.replace(_o, _o + '<option value="aicord">AICord (character chat)</option>')
rep("""          <div data-prov="openai"><label class="lbl" for="sOaiKey">API key</label><input id="sOaiKey" type="password" class="field mt-1" autocomplete="off"></div>""",
    """          <div data-prov="openai"><label class="lbl" for="sOaiKey">API key</label><input id="sOaiKey" type="password" class="field mt-1" autocomplete="off"></div>
          <div data-prov="aicord"><label class="lbl" for="sAicKey">AICord API key</label><input id="sAicKey" type="password" class="field mt-1" autocomplete="off" placeholder="your AICord authorization token" autocapitalize="off" autocorrect="off" spellcheck="false"></div>""")
rep("  openai: 'Any server that speaks", "  aicord: 'Chat with your AICord characters (pick one under Model). AICord answers as the character: there is no tool calling, so Jade cannot read or edit the vault through it. Best as a chat model or a fallback. Replies arrive whole, not streamed. Uses your AICord credits. The key stays on this device.',\n  openai: 'Any server that speaks")
rep("S.lcppKey = $('#sLcppKey').value.trim();", "S.lcppKey = $('#sLcppKey').value.trim(); S.aicKey = $('#sAicKey').value.trim();")
rep("$('#sLcppKey').value = S.lcppKey || '';", "$('#sLcppKey').value = S.lcppKey || ''; $('#sAicKey').value = S.aicKey || '';")
rep("lcppKey: $('#sLcppKey')?.value.trim() || '',", "lcppKey: $('#sLcppKey')?.value.trim() || '', aicKey: $('#sAicKey')?.value.trim() || '',")

rep("const saveSettings = () => { if (window.__restoring) return;", "const saveSettings = () => { if (window.__restoring) return; S._savedAt = Date.now(); if (window.__modelOverride) { settingsStore({ ...S, model: window.__modelOverride.model ?? S.model }); return; }")
# localStorage writes can be lost when the page reloads or the app is killed before they are flushed: settings are also
# kept in IndexedDB, and at boot the newer copy wins (applyPendingSettings in extras.js)
rep("(S.modelBy ||= {})[activeProv] = S.model; ls.set('settings', S); };", "(S.modelBy ||= {})[activeProv] = S.model; settingsStore(S); };\nfunction settingsStore(o) { ls.set('settings', o); try { idb.set('settingsMirror', JSON.parse(JSON.stringify(o))); } catch {} }")   # a background model call (journal, heartbeat …) borrows S.model: save the person's own model, never skip their change
rep("  if (!S.journalOn || !sess || !S.model) return;", "  if (!S.journalOn || !sess || !S.model || sess._hb) return;")
rep("- Daily notes live at /daily/YYYY-MM-DD.md.", "- Your heartbeat checklist is /Jade/HEARTBEAT.md: when the user wants you to keep an eye on something regularly, add a short line under its Check heading (use schedule instead for exact times).\\n- Files the user attaches in chat are saved under /attachments/YYYY-MM-DD/; PDFs get a .pdf.md text note next to them.\\n- Daily notes live at /daily/YYYY-MM-DD.md.")
# composer: attach button + pending bar
rep("""            <label for="input" class="sr-only">Message</label>""", """            <button type="button" class="icon-btn attach-btn" id="btnAttach" aria-label="Attach files"><svg viewBox="0 0 24 24"><path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1L13 4.3a3.3 3.3 0 014.7 4.7l-8.3 8.3a1.7 1.7 0 01-2.4-2.4l7.6-7.6"/></svg></button>
            <input type="file" id="attachInput" multiple hidden>
            <label for="input" class="sr-only">Message</label>""")
rep('        <div class="link-suggest slash-suggest" id="slashSuggest" hidden></div>', '        <div class="link-suggest slash-suggest" id="slashSuggest" hidden></div>\n        <div class="attach-bar" id="attachBar" hidden></div>')
# sending with attachments
rep("  text = text.trim(); if (!text) return;", "  $('#slashSuggest').hidden = true;\n  text = text.trim(); if (!text && !ATT.pending.length) return;")
rep("const v = input.value; if (!v.trim()) return; input.value = ''; autosize(); ls.set('draft', ''); send(v); } if (e.key === 'Escape' && running) abort(); });", "const v = input.value; if (!v.trim() && !ATT.pending.length) return; input.value = ''; autosize(); ls.set('draft', ''); send(v); } if (e.key === 'Escape' && running) abort(); });")
rep("$('#btnSend').onclick = () => { if (running && !input.value.trim()) return abort(); const v = input.value; if (!v.trim()) return;", "$('#btnSend').onclick = () => { if (running && !input.value.trim()) return abort(); const v = input.value; if (!v.trim() && !ATT.pending.length) return;")
rep("  if (!cur.messages.length) { chatEl.innerHTML = ''; if (!cur._named) cur.title = text.slice(0, 60); }", "  if (!cur.messages.length) { chatEl.innerHTML = ''; if (!cur._named) cur.title = (text || '📎 ' + ATT.pending.map(a => a.name).join(', ')).slice(0, 60); }")
rep("  cur.messages.push(content === text ? { role: 'user', content } : { role: 'user', content, display: text }); chatEl.appendChild(userBlock(text, cur.messages.length - 1));",
    "  const umsg = composeUserMessage(text, content === text ? '' : content); cur.messages.push(umsg); chatEl.appendChild(userBlock(umsg.display || umsg.content, cur.messages.length - 1));")
rep("  el.innerHTML = `<div class=\"who\">You</div><div class=\"bubble cut cut-sm\"></div><div class=\"msg-actions\">", "  const um = idx != null && idx !== '' ? cur?.messages?.[idx] : null;\n  el.innerHTML = `<div class=\"who\">You</div><div class=\"bubble cut cut-sm\"></div>${um?.attachments ? attachmentChips(um.attachments) : ''}<div class=\"msg-actions\">")
rep("    if (m.role === 'tool') o.tool_name = m.tool_name;", "    if (m.role === 'tool') o.tool_name = m.tool_name;\n    if (m.images?.length && !cur._noImages) o.images = m.images;")
rep("        if (/Failed to fetch|NetworkError|Load failed|did not answer|rate limit", """        if (/image|vision|multimodal|multi-modal/i.test(msg) && apiMsgs.some(m => m.images) && !cur._noImages) { cur._noImages = true; thinkD.remove(); textEl.remove(); toast(`${esc(S.model)} cannot look at images, so they were left out. The files are still in the vault.`); turns--; continue; }
        if (/Failed to fetch|NetworkError|Load failed|did not answer|rate limit""")
# edit + resend keeps attachments
rep("  cur.messages = cur.messages.slice(0, i);\n  const mk = ls.get('journaled', {});", "  const oldMsg = cur.messages[i];\n  cur.messages = cur.messages.slice(0, i);\n  const mk = ls.get('journaled', {});")
rep("  cur.messages.push(content === text ? { role: 'user', content } : { role: 'user', content, display: text });\n  saveSession(); renderChat();", "  const nm = { role: 'user', content: content + (oldMsg?._attBlock || '') }; if (nm.content !== text) nm.display = text;\n  for (const k of ['attachments', 'images', '_attBlock']) if (oldMsg?.[k]) nm[k] = oldMsg[k];\n  cur.messages.push(nm);\n  saveSession(); renderChat();")
# slash
rep("  if (cmd === 'export') {", "  if (cmd === 'heartbeat') { if (arg === 'edit') { ensureHeartbeatFile(); openFile(HB_PATH, { mode: 'edit' }); } else runHeartbeat({ manual: true }); return; }\n  if (cmd === 'export') {")
rep("<b>/export</b> [config] ·", "<b>/export</b> [config] · <b>/heartbeat</b> [edit] ·")
s = s.replace("const SLASH_CMDS = [['/new', 'new chat'],", "const SLASH_CMDS = [['/new', 'new chat'], ['/heartbeat', 'run the heartbeat now'],", 1)
# modules + boot
s = s.replace('/* =====================================================================\n   BOOT', rd('heartbeat.js') + '\n' + rd('attach.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("  ensureMemory(); ensureSteering();", "  ensureMemory(); ensureSteering(); ensureHeartbeatFile();")
CSS6 = """
.attach-btn{width:40px;height:42px;flex:none;align-self:flex-end}
.attach-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round}
.attach-bar{display:flex;gap:6px;overflow-x:auto;padding:0 0 6px;scrollbar-width:none}
.att-row{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.att-chip{display:inline-flex;align-items:center;gap:6px;max-width:220px;flex:none;padding:4px 8px;border:1px solid rgba(255,184,198,.35);background:rgba(255,184,198,.06);font-size:12.5px;color:var(--fg);text-decoration:none!important}
.att-chip img{width:34px;height:34px;object-fit:cover;border:1px solid var(--line)}
.att-chip b{font-family:var(--f-mono);font-size:10px;color:var(--cy)}
.att-chip small{font-family:var(--f-mono);font-size:10px;color:var(--dim);white-space:nowrap}
.att-chip button{color:var(--dim);font-size:16px;padding:0 4px;min-width:26px;min-height:26px}
.drop-hot{outline:2px dashed var(--cy);outline-offset:-6px}
"""
rep("#graphCv{background:", CSS6 + "#graphCv{background:")
rep("Object.assign(window, { buildBackup,", "Object.defineProperty(window, 'cur', { get: () => cur }); Object.defineProperty(window, 'sessions', { get: () => sessions }); Object.assign(window, { ls, inActiveHours, hbTick, openSession, runHeartbeat, hbIsAck, heartbeatBody, addAttachments, ATT, HB, buildBackup,")

# ================= v7: MCP (pi-style: mcp.json, exposure modes, codemode, tool_search, resources, /mcp) =================
rep("const activeTools = () => OLLAMA_TOOLS.filter(t => (t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel)) && (t.function.name !== 'memory' || S.memoryOn));",
    "const activeTools = () => [...OLLAMA_TOOLS.filter(t => (t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel)) && (t.function.name !== 'memory' || S.memoryOn)), ...mcpToolDefs()];")
rep("    default: throw new Error(`Unknown tool: ${name}`);", "    default: if (mcpHandles(name)) return await mcpRunTool(name, args, ui); throw new Error(`Unknown tool: ${name}`);")
rep("skill: a => a.name || '', memory:", "codemode: a => (String(a.code || '').split('\\n').find(l => l.trim() && !/^\\s*\\/\\/\\s*@options/.test(l)) || '').trim().slice(0, 90), tool_search: a => `\"${a.query || ''}\"`, read_mcp_resource: a => `${a.server} ${a.uri}`, skill: a => a.name || '', memory:")
rep("function toolCaption(name, a = {}) {", "function toolCaption(name, a = {}) {\n  if (/^mcp__/.test(name)) { const [, srv, tool] = name.split('__'); return `${srv} › ${tool}`; }\n  if (name === 'codemode') return 'Running a codemode script'; if (name === 'tool_search') return `Searching MCP tools: ${String(a.query || '').slice(0, 60)}`;")
rep("  today(c) { openToday(); c.o(`Opened /daily/${todayStr()}.md\\n`); return 0; },", "  today(c) { openToday(); c.o(`Opened /daily/${todayStr()}.md\\n`); return 0; },\n  async mcp(c) { try { return await mcpShell(c); } catch (e) { c.e(`mcp: ${e.message}\\n`); return 1; } },")
rep("'search', 'today']);", "'search', 'today', 'mcp']);")
rep("Vault: open <note>, links [note], backlinks <note>, tags [tag], search <words|#tag>, today.", "Vault: open <note>, links [note], backlinks <note>, tags [tag], search <words|#tag>, today.\\nMCP: mcp list | add <name> <url> | remove | reconnect | tools [server] | call <tool> '<json>'.")
rep("`}${steeringContext(steer)}`; };", "`}${steeringContext(steer)}${mcpPromptBlock()}`; };")
rep("- Daily notes live at /daily/YYYY-MM-DD.md.", "- MCP servers are configured in /Jade/mcp.json (streamable HTTP url, optional headers, exposure codemode|deferred|direct|hidden); the shell command mcp add/list/tools manages them.\\n- Daily notes live at /daily/YYYY-MM-DD.md.")
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Heartbeat</div>""", """      <section class="flex flex-col gap-3" id="mcpSection">
        <div class="flex items-center justify-between gap-2"><div class="pane-h">MCP servers</div><span class="hint" id="mcpCount"></span></div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Works like pi: servers live in <span class="text-yl">Jade/mcp.json</span> and connect in the background. <b>codemode</b> (default) keeps their tools out of the prompt; Jade writes a short script that calls them. <b>deferred</b> loads tools on demand with tool_search, <b>direct</b> shows them like built-in tools, <b>hidden</b> turns them off. Streamable HTTP servers only; a stdio server needs an HTTP bridge such as <span class="mono text-yl">npx -y supergateway --stdio "…" --outputTransport streamableHttp</span>.</p>
        <div id="mcpList" class="flex flex-col gap-2"></div>
        <div class="mcp-add">
          <div class="lbl">Add a server</div>
          <div class="grid gap-2" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
            <input id="mcpName" class="field" placeholder="name, e.g. github" autocapitalize="off" autocorrect="off" spellcheck="false">
            <select id="mcpExposure" class="field"><option>codemode</option><option>deferred</option><option>direct</option><option>hidden</option></select>
          </div>
          <input id="mcpUrl" class="field" placeholder="https://example.com/mcp" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input id="mcpHeader" class="field" placeholder="optional header, e.g. Authorization: Bearer ${GITHUB_TOKEN}" autocapitalize="off" autocorrect="off" spellcheck="false">
          <div class="flex flex-wrap gap-2"><button type="button" class="btn btn-solid cut cut-sm" id="btnMcpAdd">Add server</button><button type="button" class="btn btn-ghost" id="btnMcpEdit">Edit mcp.json</button></div>
        </div>
        <div><label class="lbl" for="mcpSecrets">Secrets for headers (NAME=value per line, used as ${NAME}; kept out of the vault)</label><textarea id="mcpSecrets" class="field mt-1 mono" rows="2" spellcheck="false" autocapitalize="off" placeholder="GITHUB_TOKEN=ghp_…"></textarea></div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="pane-h">Heartbeat</div>""")
rep("  $('#settings').hidden = false; $('#sHost').focus();\n", "  $('#settings').hidden = false; $('#sHost').focus(); renderMcpSettings();\n")
rep("  readProvFields(); readHbSettings();\n", "  readProvFields(); readHbSettings(); readMcpSettings();\n")
rep("  if (cmd === 'heartbeat') {", """  if (cmd === 'mcp') {
    const [sub, srvName] = rest;
    if (sub === 'reconnect') { const list = srvName ? [MCP.servers.get(srvName)].filter(Boolean) : [...MCP.servers.values()].filter(x => x.cfg.enabled !== false && x.state !== 'invalid'); Promise.all(list.map(mcpConnect)).then(() => toast(list.map(x => `${esc(x.name)}: ${esc(x.state)}`).join(' · ') || 'No servers', 'ok')); return; }
    openSettings(); setTimeout(() => $('#mcpSection').scrollIntoView({ block: 'start' }), 60); return;
  }
  if (cmd === 'heartbeat') {""")
rep("<b>/heartbeat</b> [edit] ·", "<b>/heartbeat</b> [edit] · <b>/mcp</b> [reconnect] ·")
s = s.replace("const SLASH_CMDS = [['/new', 'new chat'], ['/heartbeat', 'run the heartbeat now'],", "const SLASH_CMDS = [['/new', 'new chat'], ['/mcp', 'MCP servers'], ['/heartbeat', 'run the heartbeat now'],", 1)
s = s.replace('/* =====================================================================\n   BOOT', rd('mcp.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("  ensureMemory(); ensureSteering(); ensureHeartbeatFile();", "  await applyPendingSettings();\n  ensureMemory(); ensureSteering(); ensureHeartbeatFile();")
rep("  ensureMemory(); ensureSteering(); ensureHeartbeatFile();\n", "  ensureMemory(); ensureSteering(); ensureHeartbeatFile(); ensureMcpFile();\n  MCP.cfgText = vfs.isFile(MCP_PATH) ? vfs.read(MCP_PATH) : ''; mcpReload();\n")
CSS7 = """
.mcp-row{display:flex;flex-direction:column;gap:2px;padding:10px;border:1px solid var(--line);background:rgba(9,16,14,.6)}
.mcp-row .btn{min-height:34px;padding:4px 10px}
.mcp-tools{margin-top:6px;max-height:260px;overflow-y:auto;border-top:1px dashed var(--line);padding-top:6px}
.mcp-tool{padding:4px 0;font-size:12.5px}
.mcp-add{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px dashed var(--line-hot)}
"""
rep("#graphCv{background:", CSS7 + "#graphCv{background:")
rep("Object.assign(window, { ls, inActiveHours,", "Object.assign(window, { MCP, mcpReload, mcpToolDefs, mcpAllTools, runCodemode, toolSearch, activeTools, systemPrompt, ls, inActiveHours,")

# ================= v8: MicroPython (PyScript's WebAssembly build) =================
rep("  async mcp(c) { try { return await mcpShell(c); }", """  async python(c) { return runPython(c); },
  get python3() { return this.python; },
  get micropython() { return this.python; },
  pip(c) { c.e('pip is not available: MicroPython runs in the browser and has no package installer. Use its standard library (json, re, math, random, collections, os, time, hashlib, struct, binascii, heapq, io).\\n'); return 1; },
  get pip3() { return this.pip; },
  async mcp(c) { try { return await mcpShell(c); }""")
rep("'search', 'today', 'mcp']);", "'search', 'today', 'mcp', 'python', 'python3', 'micropython', 'pip', 'pip3']);")
rep("`No loops/if blocks: use node for scripting. Extra: node, xargs.\\n", "`No loops/if blocks: use node or python for scripting. Extra: node, python (MicroPython), xargs.\\n")
rep("Use node for bulk edits across many notes.", "Use node for bulk edits across many notes.\\n- \"python file.py\" or python -c \"code\" runs MicroPython ${MPY_VER} on the same files (open(), os.listdir, os.walk, os.path, os.makedirs, os.remove work on the vault). It has json, re, math, random, collections, os, time, hashlib, struct, binascii, heapq, io; there is no pip, numpy or requests. Prefer python when the user asks for Python.")
rep("For scripts longer than a line, write a .js file and run `node file.js` (fs and path work on the vault).", "For scripts longer than a line, write a .js or .py file and run `node file.js` or `python file.py` (both work on the vault files).")
rep('<button data-c="ls -la">ls</button>', '<button data-c="python --version">py</button><button data-c="ls -la">ls</button>')
s = s.replace('/* =====================================================================\n   BOOT', rd('python.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("Object.assign(window, { MCP,", "Object.assign(window, { idb, mpyAssets, runPython, MCP,")

# ================= v9: SQLite (3.53, built to WebAssembly here, embedded) =================
import gzip as _gz, base64 as _b64
_sq = open(os.path.join(D, 'vendor', 'sqlite3.min.wasm'), 'rb').read()
_sqb = _b64.b64encode(_gz.compress(_sq, 9, mtime=0)).decode()
_i = s.index('<script type="application/octet-stream" id="bb-glue">'); _j = s.index('</script>', _i) + len('</script>')
s = s[:_j] + '\n<script type="application/octet-stream" id="sqlite-wasm">' + _sqb + '</script>' + s[_j:]
# the Rust core for the browser (rust/build-wasm.sh → app/vendor/jade_core.wasm), unpacked after load by RustCore.init
_jc = _b64.b64encode(_gz.compress(open(os.path.join(D, 'vendor', 'jade_core.wasm'), 'rb').read(), 9, mtime=0)).decode()
s = s.replace('<script type="application/octet-stream" id="sqlite-wasm">', '<script type="application/octet-stream" id="jade-core-wasm">' + _jc + '</script>\n<script type="application/octet-stream" id="sqlite-wasm">', 1)
rep("  async python(c) { return runPython(c); },", """  async sqlite3(c) { return runSqliteCli(c); },
  get sqlite() { return this.sqlite3; },
  async python(c) { return runPython(c); },""")
rep("'python', 'python3', 'micropython', 'pip', 'pip3']);", "'python', 'python3', 'micropython', 'pip', 'pip3', 'sqlite3', 'sqlite']);")
rep("Extra: node, python (MicroPython), xargs.\\n", "Extra: node, python (MicroPython), sqlite3, xargs.\\n")
rep("Prefer python when the user asks for Python.", "Prefer python when the user asks for Python.\\n- SQLite 3.53 is built in, offline: sqlite3 data/app.db \\\"SQL\\\" (modes: -json -csv -box -table -markdown -line -header; dot commands .tables .schema .import file.csv tbl --csv .dump .read file.sql; or pipe a script into it). In node: require('node:sqlite').DatabaseSync or require('better-sqlite3'). In python: import sqlite3 (connect/execute/fetchall/commit). .db files are real SQLite files in the vault, saved when the command ends. Use SQLite for structured data (tables, counts, joins) instead of hand-parsing markdown.")
# node: hand the worker the SQLite module and any database files (as bytes) when the script mentions sqlite
rep("  const files = {}, dirs = []; for (const [p, n] of vfs.nodes) { if (n.dir) dirs.push(p); else if (n.data.length < 2e6) files[p] = dec.decode(n.data); }\n  const src = NODE_PRELUDE + `\\nasync function __main() {\\n${code}\\n}\\n`;",
"""  const useSq = /sqlite/i.test(code) || [...vfs.nodes].some(([p, n]) => !n.dir && /\\.[cm]?js$/.test(p) && n.data.length < 2e6 && /sqlite/i.test(dec.decode(n.data)));
  const files = {}, dirs = [], bins = {}; for (const [p, n] of vfs.nodes) { if (n.dir) dirs.push(p); else if (isSqliteBytes(n.data)) { bins[p] = n.data; files[p] = n.data; } else if (n.data.length < 2e6) files[p] = dec.decode(n.data); }
  let sqMod = null; if (useSq) { try { sqMod = await sqliteModule(); } catch (e) { c.e(`node: could not load SQLite (${e.message})\\n`); } }
  const src = NODE_PRELUDE + `\\nasync function __main() {\\n${code}\\n}\\n` + (sqMod ? '\\n' + SQLITE_GLUE_SRC + '\\n' : '');""")
rep("    w.postMessage({ files, dirs, cwd: c.sh.cwd, argv });", "    w.postMessage({ files, dirs, bins, sqliteModule: sqMod, cwd: c.sh.cwd, argv });")
s = s.replace('/* =====================================================================\n   BOOT', rd('sqlite_glue.js') + '\n' + rd('sqlite_main.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("Object.assign(window, { idb, mpyAssets,", "Object.assign(window, { sqliteModule, runSqliteCli, isSqliteBytes, idb, mpyAssets,")
rep("(both work on the vault files). Vault commands:", "(both work on the vault files). SQLite: sqlite3 file.db \"SQL\" (-json, -csv, -box; .tables .schema .import .dump), node:sqlite, python sqlite3. Vault commands:")
rep('<button data-c="python --version">py</button>', '<button data-c="python --version">py</button><button data-c="sqlite3 --version">sql</button>')

# ================= v10: context guard (estimate, compact/trim before sending, learn limits, /context) =================
s = s.replace('/* =====================================================================\n   BOOT', rd('ctxguard.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("  let turns = 0; let think = S.think; let needCtxCompact = false;", "  let turns = 0; let think = S.think; let needCtxCompact = false; let ctxRetry = 0; let fit = { est: 0, lim: ctxLimit() };")
rep("      const apiMsgs = buildApiMessages();\n", "      let apiMsgs = buildApiMessages(); const toolsNow = routeTools(activeTools());\n      fit = await fitContext(apiMsgs, toolsNow, body); apiMsgs = fit.msgs;\n")
rep("const req = { model: S.model, messages: apiMsgs, tools: activeTools(), stream: true,", "const req = { model: S.model, messages: apiMsgs, tools: toolsNow, stream: true,")
rep("        if (think && /think/i.test(msg)) {", """        if (isCtxError(msg) && ctxRetry < 3) {
          ctxRetry++; ctxLearn(msg, fit.est); thinkD.remove(); textEl.remove(); jadeBubble('Too long for the model. Trimming and retrying…');
          toast(`${esc(S.model)} said the request was too long. Fitting it to ~${fmtK(ctxTarget(ctxLimit()))} tokens and retrying.`); turns--; continue;
        }
        if (think && /think/i.test(msg)) {""")
rep("        if (/does not support tools/i.test(msg)) hint =", "        if (isCtxError(msg)) hint = `${msg}\\n\\nThe request is still too big for this model. Type /context to see what fills it; /compact or /new frees space.`;\n        else if (/does not support tools/i.test(msg)) hint =")
rep("      const ctxUsed = final ? (final.prompt_eval_count || 0) + (final.eval_count || 0) : 0;\n      if (S.compactAuto && calls.length && ctxUsed > (+S.numCtx) * (+S.compactPct || 85) / 100) needCtxCompact = true;\n      if (final) { $('#hudCtx').textContent = `${fmtK((final.prompt_eval_count || 0) + (final.eval_count || 0))} / ${fmtK(+S.numCtx)}`;",
"""      const pe = final?.prompt_eval_count || 0;
      if (pe > fit.est * 1.05 && fit.est > 500) { const rat = ls.get('ctxRatio', {}); rat[ctxKey()] = Math.max(0.8, ctxRatio() * fit.est / pe); ls.set('ctxRatio', rat); }   // only ever makes estimates bigger
      const ctxUsed = Math.max(fit.est, pe) + (final?.eval_count || 0);
      if (S.compactAuto && calls.length && ctxUsed > fit.lim * (+S.compactPct || 85) / 100) needCtxCompact = true;
      if (final) { $('#hudCtx').textContent = `~${fmtK(ctxUsed)} / ${fmtK(fit.lim)}`;""")
rep("  const budget = Math.max(6000, Math.round((+S.numCtx || 16384) * 2.4));", "  const budget = Math.max(6000, Math.round(ctxTarget(ctxLimit()) * ctxRatio() * 0.75));")
rep("  if (cmd === 'compact') {", "  if (cmd === 'context' || cmd === 'ctx') { showContext(); return; }\n  if (cmd === 'compact') {")
s = s.replace("['/compact', 'summarise old turns'],", "['/compact', 'summarise old turns'], ['/context', 'what fills the context'],", 1)
rep("<b>/compact</b> summarise old turns ·", "<b>/compact</b> summarise old turns · <b>/context</b> what fills the context ·")
rep("  const sys = vfs.isFile(SYSTEM_PATH) ? stripComments(parseFront(vfs.read(SYSTEM_PATH)).body) : '';", "  const sys = vfs.isFile(SYSTEM_PATH) ? clip(stripComments(parseFront(vfs.read(SYSTEM_PATH)).body), 24000, 'of SYSTEM.md left out: keep it shorter') : '';")
rep("${st.skills.map(s => `- ${s.name}: ${s.description}`).join('\\n')}", "${skillLines(st.skills)}")
rep("    out.push({ name: mcpToolName(srv.name, t.name), server: srv.name, tool: t.name, description: t.description || t.title || '', inputSchema: t.inputSchema || { type: 'object', properties: {} }, exposure: ex, annotations: t.annotations });\n  }\n  return out;",
"""    out.push({ name: mcpToolName(srv.name, t.name), server: srv.name, tool: t.name, description: t.description || t.title || '', inputSchema: t.inputSchema || { type: 'object', properties: {} }, exposure: ex, annotations: t.annotations });
  }
  // direct tools are sent with every request: past ~24k characters of schemas, the rest load on demand via tool_search
  let room = 24000; for (const t of out) if (t.exposure === 'direct') { const c = JSON.stringify(t.inputSchema).length + Math.min(1024, t.description.length) + 80; if (c > room) { t.exposure = 'deferred'; t.overflow = true; } else room -= c; }
  return out;""")
rep("Object.assign(window, { sqliteModule,", "Object.assign(window, { buildApiMessages, newSession, chatEl, CTX, fitContext, contextReport, ctxLimit, estRequest, shrinkMessages, ctxLearn, isCtxError, sqliteModule,")

# ================= v11: timestamps, date/time for the model, trajectory logger =================
s = s.replace('/* =====================================================================\n   BOOT', rd('traj.js') + '\n/* =====================================================================\n   BOOT', 1)
TRAJ_HTML = """      <section class="flex flex-col gap-3" id="trajSection">
        <div class="pane-h">Trajectory log (fine-tuning data)</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Records every agent run exactly as the model saw it: system prompt, tools, your messages, its replies, tool calls and results. It stays on this device until you export it as JSONL for fine-tuning your own model. Rate replies with 👍 / 👎 in the chat to choose what goes in.</p>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
          <label class="flex items-center gap-2 text-sm" for="sTrajOn"><input type="checkbox" id="sTrajOn" class="accent-emerald-400 w-4 h-4"> Log trajectories</label>
          <label class="flex items-center gap-2 text-sm" for="sTrajThink"><input type="checkbox" id="sTrajThink" class="accent-emerald-400 w-4 h-4"> Include thinking</label>
          <label class="flex items-center gap-2 text-sm" for="sTrajMeta" title="Adds a metadata field to each line with the 👍/👎 rating, outcome, model and time, for preference training (DPO / KTO)"><input type="checkbox" id="sTrajMeta" class="accent-emerald-400 w-4 h-4"> Include ratings (👍/👎) and run info</label>
          <div><label class="lbl" for="sTrajFormat">Export format</label><select id="sTrajFormat" class="field mt-1"><option value="openai">OpenAI chat: messages + tools (Unsloth, Axolotl, TRL)</option><option value="sharegpt">ShareGPT with tools (LLaMA-Factory)</option></select></div>
          <div><label class="lbl" for="sTrajFilter">Which runs</label><select id="sTrajFilter" class="field mt-1"><option value="clean">Finished runs, minus 👎</option><option value="good">Only 👍 replies</option><option value="prefs">Finished runs, 👎 too (for DPO / KTO)</option><option value="all">Everything (errors too)</option></select></div>
        </div>
        <div class="mono text-xs text-dim" id="trajStats">…</div>
        <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-solid" id="btnTrajExport">Export JSONL</button><button type="button" class="btn btn-red" id="btnTrajClear">Clear log</button></div>
        <label class="flex items-center gap-2 text-sm" for="sStampOn"><input type="checkbox" id="sStampOn" class="accent-emerald-400 w-4 h-4"> Tell Jade the date and time of each message</label>
      </section>

"""
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Jade companion</div>""", TRAJ_HTML + """      <section class="flex flex-col gap-3">
        <div class="pane-h">Jade companion</div>""")
rep("  renderSkillsSettings(); renderBgSettings();", "  renderSkillsSettings(); renderBgSettings(); renderTrajSettings(); window.__trajSync?.();")
rep("- Today's date: ${new Date().toISOString().slice(0, 10)}.", "- Today is ${longToday()} (time zone ${TZ}, ${utcOffset()}).${S.stampOn !== false ? ' Each user message starts with the time it was sent, like [Sun 2026-10-11 20:18 EDT]. The app adds that stamp, not the user: use it for now, today, deadlines and how much time has passed, and never copy it into your replies.' : ''}")
rep("    const o = { role: m.role, content: m.content || '' };", "    const o = { role: m.role, content: m.role === 'user' && m.ts && S.stampOn !== false ? `[${fmtStamp(m.ts)}] ${m.content || ''}` : (m.content || '') };")
rep("cur.messages.push({ role: 'user', content: q });", "cur.messages.push({ role: 'user', content: q, ts: Date.now() });")
rep("  const nm = { role: 'user', content: content + (oldMsg?._attBlock || '') };", "  const nm = { role: 'user', content: content + (oldMsg?._attBlock || ''), ts: Date.now() };")
rep("cur.messages.push({ role: 'user', content: prompt, display: '♥ Heartbeat check', _hb: true });", "cur.messages.push({ role: 'user', content: prompt, display: '♥ Heartbeat check', _hb: true, ts: Date.now() });")
rep("  const msg = { role: 'user', content: (content || text ||", "  const msg = { ts: Date.now(), role: 'user', content: (content || text ||")
rep("      const asst = { role: 'assistant', content, model: S.model };", "      const asst = { role: 'assistant', content, model: S.model, ts: Date.now() };")
rep("        cur.messages.push({ role: 'tool', tool_name: name, content: String(result), _for: tc._id, _err: isErr || undefined }); saveSession();", "        cur.messages.push({ role: 'tool', tool_name: name, content: String(result), _for: tc._id, _err: isErr || undefined, ts: Date.now() }); saveSession(); TR.tool(name, result, isErr);")
rep("cur.messages.push({ role: 'assistant', content: '', _error: hint });", "cur.messages.push({ role: 'assistant', content: '', _error: hint, ts: Date.now() });")
rep("      cur.messages.push(asst); saveSession();\n", "      TR.reply(asst, final, fit.est); cur.messages.push(asst); saveSession();\n")
rep("      if (think) req.think = true;\n", "      if (think) req.think = true;\n      TR.call(apiMsgs, toolsNow, req);\n")
rep("  const ai = aiBlock(); ai.querySelector('[data-model]').textContent = S.model; chatEl.appendChild(ai); const body = ai.querySelector('[data-body]');",
    "  const ai = aiBlock(); ai.querySelector('[data-model]').textContent = S.model; chatEl.appendChild(ai); const body = ai.querySelector('[data-body]');\n  const runT0 = Date.now(); setWhen(ai, runT0); const TR = trajRecorder(); const runStart = cur.messages.length;")
rep("""  } finally {
    setRunning(false); saveSession();
    if (abortReq) { jadeMood('idle');""", """  } finally {
    try {
      const tid = await TR.end(abortReq ? 'aborted' : runError ? 'error' : 'ok', runError);
      setWhen(ai, runT0, fmtDur(Date.now() - runT0));
      const lastA = cur?.messages.slice(runStart).filter(m => m.role === 'assistant').at(-1);
      if (lastA) { lastA.dur = Date.now() - runT0; if (tid) { lastA.trajId = tid; ai.appendChild(rateBar(lastA)); } }
    } catch (e) { console.warn(e); }
    setRunning(false); saveSession();
    if (abortReq) { jadeMood('idle');""")
rep("""<span class="mono text-[10px] text-dim tracking-normal normal-case" data-model></span></div><div class="flex flex-col gap-2" data-body></div>`;""",
    """<span class="mono text-[10px] text-dim tracking-normal normal-case" data-model></span><span class="when" data-when></span></div><div class="flex flex-col gap-2" data-body></div>`;""")
rep("""el.innerHTML = `<div class="who">You</div>""", """el.innerHTML = `<div class="who">You <span class="when" data-when></span></div>""")
rep("el.querySelector('.bubble').textContent = text; return", "el.querySelector('.bubble').textContent = text; setWhen(el, um?.ts); return")
rep("      if (!ai) { ai = aiBlock(); chatEl.appendChild(ai); if (m.model) ai.querySelector('[data-model]').textContent = m.model; }",
    "      if (!ai) { ai = aiBlock(); chatEl.appendChild(ai); if (m.model) ai.querySelector('[data-model]').textContent = m.model; setWhen(ai, m.ts); }")
rep("      if (m._error) body.appendChild(errorEl(m._error));\n    }\n  }\n  scrollDown(true);",
    "      if (m._error) body.appendChild(errorEl(m._error));\n      if (m.trajId) { const w = ai.querySelector('[data-when]'); if (m.dur && w.textContent) w.textContent += ' · ' + fmtDur(m.dur); ai.appendChild(rateBar(m)); }\n    }\n  }\n  scrollDown(true);")
rep("  if (cmd === 'context' || cmd === 'ctx') {", """  if (cmd === 'trajectories' || cmd === 'traj') { if (arg === 'export') { exportTrajectories().then(r => r && toast(`Exported ${r.count} of ${r.of} runs`, 'ok')); return; } openSettings(); setTimeout(() => $('#trajSection').scrollIntoView({ block: 'start' }), 60); return; }
  if (cmd === 'context' || cmd === 'ctx') {""")
s = s.replace("['/context', 'what fills the context'],", "['/context', 'what fills the context'], ['/trajectories', 'fine-tuning log'], ['/trajectories export', 'export the log as JSONL'],", 1)
rep("<b>/context</b> what fills the context ·", "<b>/context</b> what fills the context · <b>/trajectories</b> [export] fine-tuning log ·")
CSS11 = """
.when{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;letter-spacing:0;text-transform:none;color:var(--dim,#83998f);font-weight:400;margin-left:6px}
.msg-user .who{display:flex;justify-content:flex-end;align-items:baseline;gap:4px}
.rate-bar{display:flex;gap:6px;margin-top:2px}
.rate-bar button{font-size:13px;line-height:1;padding:5px 9px;border:1px solid var(--line);background:rgba(9,16,14,.6);opacity:.55;filter:grayscale(1)}
.rate-bar button.on{opacity:1;filter:none;border-color:var(--line-hot)}
"""
rep("#graphCv{background:", CSS11 + "#graphCv{background:")
rep("Object.assign(window, { buildApiMessages,", "Object.assign(window, { openSettings, TrajDB, exportTrajectories, trajRecorder, trajToOpenAI, trajToShareGPT, trajStats, fmtStamp, renderChat, buildApiMessages,")

# ================= v12: http_request + secrets, node fetch/https, images in markdown =================
s = s.replace('/* =====================================================================\n   BOOT', rd('net.js') + '\n' + rd('img.js') + '\n/* =====================================================================\n   BOOT', 1)
SECRETS_HTML = """      <section class="flex flex-col gap-3" id="secretSection">
        <div class="pane-h">Secrets (API keys for Jade's HTTP requests)</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Jade writes <code class="text-cy">{{NAME}}</code> in a URL, header or body and the app fills in the value when the request goes out. She never sees the value, so it stays out of chats, the trajectory log and replies (any echo is blanked). Node scripts get them as <code class="text-cy">process.env.NAME</code>.</p>
        <div id="secretList" class="flex flex-col gap-2"></div>
        <div class="grid gap-2" style="grid-template-columns:minmax(110px,1fr) minmax(140px,2fr) auto">
          <input id="sSecretName" class="field" placeholder="NAME" autocapitalize="characters" autocomplete="off" spellcheck="false">
          <input id="sSecretValue" class="field" type="password" placeholder="value" autocomplete="off">
          <button type="button" class="btn btn-solid" id="btnSecretAdd">Add</button>
        </div>
      </section>

"""
rep("""      <section class="flex flex-col gap-3">
        <div class="pane-h">Web search</div>""", SECRETS_HTML + """      <section class="flex flex-col gap-3">
        <div class="pane-h">Web search</div>""")
rep("const SECRET_KEYS = ['ollamaKey', 'groqKey', 'oaiKey', 'lcppKey', 'ollayaKey', 'mcpSecrets'];", "const SECRET_KEYS = ['ollamaKey', 'groqKey', 'oaiKey', 'lcppKey', 'ollayaKey', 'mcpSecrets', 'secrets'];")
rep("""  { name: 'web_fetch', description: 'Fetch a web page and return it as readable text/markdown.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Absolute http(s) URL' } }, required: ['url'] } },""",
"""  { name: 'web_fetch', description: 'Fetch a web page and return it as readable text/markdown.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Absolute http(s) URL' } }, required: ['url'] } },
  { name: 'http_request', description: 'Call an HTTP API: any method (GET, POST, PUT, PATCH, DELETE, HEAD) with headers and a JSON, form or raw body. Returns the status, key headers and the body (JSON pretty-printed). Binary responses (images, PDFs, .xdc apps) are saved to the vault and the path is returned. Write API keys as {{NAME}} using the secret names listed in your instructions; never ask the user to paste keys into chat.',
    parameters: { type: 'object', properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'Default GET' },
      url: { type: 'string', description: 'Absolute http(s) URL; may contain {{SECRET}}' },
      headers: { type: 'object', description: 'Request headers, e.g. {"Authorization": "Bearer {{API_KEY}}"}' },
      query: { type: 'object', description: 'Query-string parameters to add to the URL' },
      json: { type: 'object', description: 'JSON body (sets Content-Type: application/json)' },
      form: { type: 'object', description: 'Form body (application/x-www-form-urlencoded)' },
      body: { type: 'string', description: 'Raw body text, if not json/form' },
      save_to: { type: 'string', description: 'Optional vault path to save the response body to' },
      timeout: { type: 'number', description: 'Seconds (default 30, max 120)' } }, required: ['url'] } },""")
rep("    case 'web_fetch': return await webFetch(String(args.url || ''));", "    case 'web_fetch': return await webFetch(String(args.url || ''));\n    case 'http_request': return await httpRequest(args);")
rep("web_fetch: a => a.url,", "web_fetch: a => a.url, http_request: a => `${(a.method || 'GET').toUpperCase()} ${a.url || ''}`,")
rep("    web_fetch: () => `Fetching ${short(a.url)}`,", "    web_fetch: () => `Fetching ${short(a.url)}`, http_request: () => `${(a.method || 'GET').toUpperCase()} ${short(a.url)}`,")
rep("- web_search / web_fetch: look things up on the web", "- web_search / web_fetch: look things up on the web\\n- http_request: call APIs with any method (POST JSON, forms, auth headers). ${Object.keys(secretsMap()).length ? `Secrets you can use (write them exactly like this, the app fills in the value): ${Object.keys(secretsMap()).map(k => '{{' + k + '}}').join(', ')}` : 'No secrets are saved yet: if an API needs a key, ask the user to add it in Config → Secrets and tell them the NAME to use'}")
# node: secrets as env, redact echoes, mention fetch/https
rep("    w.postMessage({ files, dirs, bins, sqliteModule: sqMod, cwd: c.sh.cwd, argv });", "    w.postMessage({ files, dirs, bins, sqliteModule: sqMod, env: { ...secretsMap() }, cwd: c.sh.cwd, argv });")
rep("  for (const [k, v] of r.out) k === 'o' ? c.o(v) : c.e(v);\n  const W = Object.entries(r.writes || {});", "  for (const [k, v] of r.out) k === 'o' ? c.o(redactSecrets(v)) : c.e(redactSecrets(v));\n  const W = Object.entries(r.writes || {});")
rep("runs JavaScript in a sandboxed worker with require('fs') (readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, unlinkSync) and require('path').", "runs JavaScript in a sandboxed worker with require('fs') (readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, unlinkSync), require('path'), global fetch, require('https'/'http') and Buffer; secrets are in process.env.")
# images
rep("  for (const el of div.querySelectorAll('.math-tex')) renderTex(el);\n", "  for (const el of div.querySelectorAll('.math-tex')) renderTex(el);\n  try { hydrateMedia(div); } catch (e) { console.warn(e); }\n")
rep("  setNoteMode(isNote(p) ? (opts.mode || noteMode) : 'edit', true);\n", "  setNoteMode(isNote(p) ? (opts.mode || noteMode) : 'edit', true);\n  if (isImagePath(p)) showImageFile(p);\n")
rep("      const p = readPath(args.path); const text = vfs.read(p); const L = text.split", "      const p = readPath(args.path); if (isImagePath(p) || /\\.(xdc|zip|db|sqlite|pdf|mp3|mp4|wav)$/i.test(p)) { const n = vfs.nodes.get(p); if (n && !n.dir && !isText(n.data.subarray(0, 4096))) return `[binary file ${p}, ${fmtKB(n.data.length)}]${isImagePath(p) ? ` Show it with ![[${vfs.base(p)}]] in a note or your reply.` : ''}`; }\n      const text = vfs.read(p); const L = text.split")
rep("- Math renders with KaTeX:", "- Images: ![[photo.png]] or ![[photo.png|300]] (width in px) shows a vault image; ![alt](https://…) works for web images; ![[Other Note]] embeds a note. Images the user adds go to /attachments/images/. Download pictures with http_request (binary responses are saved to the vault) and embed them.\\n- Math renders with KaTeX:")
CSS12 = """
.md img.md-img{max-width:100%;height:auto;display:block;margin:8px 0;border:1px solid var(--line);background:rgba(9,16,14,.6);cursor:zoom-in}
.md img.md-img.missing{min-height:44px;min-width:160px;padding:10px;font:12px "JetBrains Mono",monospace;color:var(--rd);border-style:dashed;cursor:default}
.md p > img.md-img{display:inline-block;vertical-align:middle}
.note-embed{border-left:2px solid var(--line-hot);padding:4px 0 4px 12px;margin:10px 0;background:rgba(31,229,165,.03)}
.note-embed .embed-h{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px}
.file-chip{display:inline-block;padding:2px 8px;border:1px solid var(--line);text-decoration:none}
.lightbox{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.lightbox img{max-width:100%;max-height:calc(100% - 60px);object-fit:contain}
.lightbox .lb-cap{color:#83998f;margin-top:8px;word-break:break-all;text-align:center}
.lightbox .lb-x{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px}
.image-file img.md-img{margin:0 auto}
.secret-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.secret-row .btn{min-height:32px;padding:3px 10px;margin-left:auto}
"""
rep("#graphCv{background:", CSS12 + "#graphCv{background:")
rep("Object.assign(window, { openSettings,", "Object.assign(window, { httpRequest, fillSecrets, redactSecrets, secretsMap, resolveFile, vaultBlobUrl, addImagesToNote, saveImageFile, md, openSettings,")

# ================= v13: webxdc apps (Apps tab + apps tool) =================
s = s.replace('/* =====================================================================\n   BOOT', rd('xdc.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("""    <button class="tab" role="tab" data-tab="tasks" aria-selected="false">""", """    <button class="tab" role="tab" data-tab="apps" aria-selected="false"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><path d="M16.75 13.5v6.5M13.5 16.75H20"/></svg>Apps</button>
    <button class="tab" role="tab" data-tab="tasks" aria-selected="false">""")
rep(".m-nav{flex:none;display:grid;grid-template-columns:repeat(5,1fr);", ".m-nav{flex:none;display:grid;grid-template-columns:repeat(6,1fr);")
APPS_HTML = """    <!-- APPS (webxdc) -->
    <section class="m-screen overflow-y-auto" data-panel="apps" hidden>
      <div class="p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2"><div class="pane-h">Apps</div><button class="btn btn-solid cut cut-sm" id="btnAppInstall">+ Install .xdc</button></div>
        <input type="file" id="xdcPick" accept=".xdc,application/x-webxdc,application/zip" multiple hidden>
        <div id="appGrid" class="app-grid"></div>
        <div id="appsEmpty" class="hint leading-relaxed">No apps yet. Webxdc apps are small offline apps (games, polls, checklists, editors) in a single <b>.xdc</b> file: get them from <span class="text-cy">webxdc.org/apps</span> and install them here. Jade can use them with you: she reads what happens in an app and can send her own moves, and she can build new apps in the vault and install them.</div>
      </div>
    </section>

    <!-- SCHEDULE -->"""
rep("    <!-- SCHEDULE -->", APPS_HTML)
rep("  if (name === 'files') renderTree();\n", "  if (name === 'files') renderTree();\n  if (name === 'apps') xdcRefresh().catch(() => {});\n")
rep("window.__androidBack = () => {\n", "window.__androidBack = () => {\n  { const lb = document.querySelector('.lightbox'); if (lb) { lb.remove(); return true; } }\n  { const mb = document.querySelector('.xdc-menu-bg'); if (mb) { mb.remove(); return true; } }\n  if (XDC.session) { closeApp(); return true; }\n")
rep("""  { name: 'http_request', description:""", """  { name: 'apps', description: 'Use the webxdc apps installed in the Apps tab (offline mini apps: games, polls, checklists, editors). list: installed apps. read: an app\\'s updates (its shared state, in order; since=<serial> for only new ones). send: post your own update (payload in the JSON shape the app uses: read its updates or source first). open: show it on the user\\'s screen. files / source: see its code. install: from a vault .xdc file, a vault folder with index.html (to install an app you wrote), or a URL. export: save it as a .xdc in the vault.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['list', 'read', 'send', 'open', 'files', 'source', 'install', 'export'] },
      app: { type: 'string', description: 'App name or id' },
      payload: { type: 'object', description: 'send: the update payload (JSON) the app expects' },
      info: { type: 'string', description: 'send: optional short info message shown to the user' },
      summary: { type: 'string', description: 'send: optional new summary line for the app' },
      since: { type: 'number', description: 'read: only updates after this serial' },
      limit: { type: 'number', description: 'read: max updates (default 30, newest)' },
      file: { type: 'string', description: 'source: file inside the app, e.g. index.html' },
      path: { type: 'string', description: 'install: vault path of a .xdc or app folder; export: where to save' },
      url: { type: 'string', description: 'install: https link to a .xdc file' } }, required: ['action'] } },
  { name: 'http_request', description:""")
rep("    case 'http_request': return await httpRequest(args);", "    case 'http_request': return await httpRequest(args);\n    case 'apps': return await appsTool(args);")
rep("http_request: a => `${(a.method || 'GET').toUpperCase()} ${a.url || ''}`,", "http_request: a => `${(a.method || 'GET').toUpperCase()} ${a.url || ''}`, apps: a => `${a.action || 'list'}${a.app ? ' ' + a.app : ''}${a.path ? ' ' + a.path : ''}`,")
rep("http_request: () => `${(a.method || 'GET').toUpperCase()} ${short(a.url)}`,", "http_request: () => `${(a.method || 'GET').toUpperCase()} ${short(a.url)}`, apps: () => `Apps: ${a.action || 'list'}${a.app ? ' ' + short(a.app) : ''}`,")
rep("- web_search / web_fetch: look things up on the web\\n", "- web_search / web_fetch: look things up on the web\\n- apps: webxdc apps in the Apps tab${XDC.apps.length ? ` (installed: ${XDC.apps.slice(0, 12).map(a => a.name).join(', ')})` : ''}. Read an app's updates to see what the user did, send updates to take part, open it for the user. To build an app: write index.html (+ js/css, manifest.toml with a name line) into a vault folder such as /Apps/src/<name>/ using window.webxdc (setUpdateListener, sendUpdate, selfAddr, selfName; no network, no CDNs) and install it with apps action=install path=<folder>.\\n")
CSS13 = """
.app-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.app-tile{position:relative;border:1px solid var(--line);background:rgba(9,16,14,.6)}
.app-open{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:16px 10px 12px;text-align:center;background:none;color:inherit}
.app-open img,.app-noic{width:56px;height:56px;object-fit:cover;border:1px solid var(--line-hot);display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--yl)}
.app-open b{font-size:13.5px;line-height:1.2;word-break:break-word}
.app-open .hud{font-size:10.5px;color:var(--dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.app-more{position:absolute;top:2px;right:2px;width:34px;height:34px;color:var(--dim);background:none;font-size:18px}
.xdc-ov{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#000}
.xdc-bar{display:flex;align-items:center;gap:8px;padding:calc(6px + env(safe-area-inset-top,0px)) 8px 6px;border-bottom:1px solid var(--line);background:rgba(4,8,7,.98)}
.xdc-bar .btn{min-height:38px;min-width:40px;padding:4px 10px}
.xdc-ic{width:30px;height:30px;object-fit:cover;border:1px solid var(--line)}
.xdc-ic-x{display:flex;align-items:center;justify-content:center;color:var(--yl)}
.xdc-t{flex:1;display:flex;flex-direction:column;line-height:1.15}
.xdc-t .hud{font-size:10.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xdc-frame-wrap{flex:1;position:relative;background:#fff}
.xdc-frame-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.xdc-menu-bg{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center}
.xdc-menu{width:100%;max-width:520px;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:#06100c;border-top:1px solid var(--line-hot)}
"""
rep("#graphCv{background:", CSS13 + "#graphCv{background:")
rep("Object.assign(window, { httpRequest,", "Object.assign(window, { setNoteMode, XDC, XdcDB, unzip, zipStore, xdcInstall, xdcInstallBytes, xdcInstallFromVault, xdcRefresh, openApp, closeApp, appsTool, xdcPage, setTab, httpRequest,")

rep("function renderNotePreview() {\n  if (!editing) return;\n", "function renderNotePreview() {\n  if (!editing) return;\n  if (isImagePath(editing)) { showImageFile(editing); return; }\n")
# ================= v14: apps can wake Jade (notify), realtime status, built-in Jade Link app =================
s = s.replace('/* =====================================================================\n   BOOT', rd('xdcwake.js') + '\n/* =====================================================================\n   BOOT', 1)
_jl = _b64.b64encode(open(os.path.join(DIST, 'jade-link.xdc'), 'rb').read()).decode()
_i = s.index('<script type="application/octet-stream" id="sqlite-wasm">'); _j = s.index('</script>', _i) + len('</script>')
s = s[:_j] + '\n<script type="application/octet-stream" id="xdc-jadelink">' + _jl + '</script>' + s[_j:]
rep("Read an app's updates to see what the user did, send updates to take part,", "Apps can message you: when the user writes to you in an app you get a turn in that app's own chat and should answer with apps send. Read an app's updates to see what the user did, send updates to take part,")
rep("Object.assign(window, { setNoteMode, XDC,", "Object.assign(window, { XWAKE, xdcPump, seedJadeLink, xdcSendUpdate, XDC_JADE, setNoteMode, XDC,")

# ================= v15: never lose the last chat save when the app is hidden / closed =================
rep("const saveSession = (() => { let t; return () => {", "const saveSession = (() => { let t; const f = () => {")
rep("renderSessions(); }, 250); }; })();", "renderSessions(); }, 250); }; f.flush = () => { if (!cur || window.__restoring) return; clearTimeout(t); if (!cur.messages.length) return; cur.updated = Date.now(); idb.set('session:' + cur.id, cur); const m = sessions.find(s => s.id === cur.id); if (m) { m.title = cur.title; m.updated = cur.updated; } else sessions.unshift({ id: cur.id, title: cur.title, updated: cur.updated }); idb.set('sessions', sessions); }; return f; })();\naddEventListener('pagehide', () => saveSession.flush()); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSession.flush(); });")

rep("const s = await idb.get('session:' + id); if (!s) return newSession();", "let s = await idb.get('session:' + id); for (let i = 0; !s && i < 4 && sessions.some(x => x.id === id); i++) { await new Promise(r => setTimeout(r, 250)); s = await idb.get('session:' + id); }   // a read right after a reload can come back empty: retry before giving up\n  if (!s) return newSession();")
rep("  if (last && sessions.find(s => s.id === last)) await openSession(last); else newSession();", "  if (last && sessions.find(s => s.id === last)) await openSession(last); else if (!last && sessions.length) await openSession([...sessions].sort((a, b) => (b.updated || 0) - (a.updated || 0))[0].id); else newSession();   // no pointer (storage lost): reopen the newest chat")
# ================= v16: Vector messenger bot =================
s = s.replace('/* =====================================================================\n   BOOT', rd('vector.js') + '\n/* =====================================================================\n   BOOT', 1)
VEC_HTML = """      <section class="flex flex-col gap-3" id="vecSection">
        <div class="pane-h">Vector messenger (Jade as a bot)</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Jade lives on <span class="text-cy">Vector</span> as a bot account: she answers DMs and channels, reacts, sends files, sees images, plays Mini Apps, joins and leaves communities, and takes messages for you. Vector itself runs in the <b>Jade Vector bridge</b> on a computer that stays on (Mac, Linux or Docker: see the jade-vector folder), and this app connects to it like it does to Ollama.</p>
        <label class="flex items-center gap-2 text-sm" for="sVecOn"><input type="checkbox" id="sVecOn" class="accent-emerald-400 w-4 h-4"> Run Jade on Vector</label>
        <div id="vecStatus" class="text-sm"></div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <div><label class="lbl" for="sVecUrl">Bridge URL</label><input id="sVecUrl" class="field mt-1" placeholder="http://192.168.1.20:8787/mcp" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sVecToken">Bridge token</label><input id="sVecToken" type="password" class="field mt-1" placeholder="printed by setup.sh" autocomplete="off"></div>
          <div><label class="lbl" for="sVecOwner">Owner npub (absolute power)</label><input id="sVecOwner" class="field mt-1" placeholder="npub1… (your own Vector account)" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sVecOwnerName">Your name (what Jade calls you to others)</label><input id="sVecOwnerName" class="field mt-1" placeholder="e.g. Sam"></div>
          <div><label class="lbl" for="sVecAdmins">Admin whitelist (npubs)</label><textarea id="sVecAdmins" class="field mt-1" rows="2" placeholder="one per line: they can have Jade join, leave, invite, moderate and message people on Vector" spellcheck="false"></textarea></div>
          <div><label class="lbl" for="sVecChannels">Channel whitelist</label><textarea id="sVecChannels" class="field mt-1" rows="2" placeholder="channel ids, community ids or names where Jade takes part" spellcheck="false"></textarea></div>
          <div><label class="lbl" for="sVecDm">Who can DM her</label><select id="sVecDm" class="field mt-1"><option value="anyone">Anyone (general chat)</option><option value="known">Only owner + admins</option><option value="owner">Only me</option></select></div>
          <div><label class="lbl" for="sVecTrigger">In channels she answers</label><select id="sVecTrigger" class="field mt-1"><option value="mention">When named or replied to</option><option value="all">Every message</option></select></div>
          <div><label class="lbl" for="sVecWords">Trigger words</label><input id="sVecWords" class="field mt-1" placeholder="jade, @jade, hey jade"></div>
          <div><label class="lbl" for="sVecNotify">Messages for you</label><select id="sVecNotify" class="field mt-1"><option value="inbox">Go to the inbox</option><option value="urgent">Inbox; urgent ones right away</option><option value="now">Tell me right away</option></select></div>
          <div><label class="lbl" for="sVecPoll">Check every (seconds)</label><input id="sVecPoll" type="number" min="2" max="120" class="field mt-1"></div>
        </div>
        <label class="flex items-center gap-2 text-sm" for="sVecImages"><input type="checkbox" id="sVecImages" class="accent-emerald-400 w-4 h-4"> Let her see images people send</label>
        <label class="flex items-center gap-2 text-sm" for="sVecXdc"><input type="checkbox" id="sVecXdc" class="accent-emerald-400 w-4 h-4"> Wake her when a Mini App she joined gets new moves</label>
        <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-solid" id="btnVecTest">Connect</button><button type="button" class="btn" id="btnVecInbox">Open inbox</button><button type="button" class="btn" id="btnVecCopy">Copy her npub</button></div>
        <p class="hint leading-relaxed">You (the owner) get the same Jade as in this app, with every tool. Admins get Vector powers but never your notes, memory or files. Everyone else can chat, play Mini Apps and leave you messages. Each Vector chat has its own chat here (💬). Keep the app running for her to answer: Config → Background mode keeps it alive on Android.</p>
      </section>

"""
rep("""      <section class="flex flex-col gap-3" id="secretSection">""", VEC_HTML + """      <section class="flex flex-col gap-3" id="secretSection">""")
DC_HTML = """      <section class="flex flex-col gap-3" id="dcSection">
        <div class="pane-h">Discord (Jade as a bot)</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Jade lives on <span class="text-cy">Discord</span> as a bot: she answers DMs and channels, reacts, sends files, sees images, and takes messages for you. It works at the same time as Vector. The bot runs in the <b>Jade Discord bridge</b> (<span class="mono">jade-discord/</span>, built on discord.py) on a computer you keep on; paste its URL and token here. Create the bot at discord.com/developers/applications → <b>Bot</b>, give its token to the bridge (<span class="mono">--set-token</span>), and turn on <b>Message Content Intent</b>. Then use <b>Copy invite link</b> and open it to add her to your server.</p>
        <label class="flex items-center gap-2 text-sm" for="sDcOn"><input type="checkbox" id="sDcOn" class="accent-emerald-400 w-4 h-4"> Run Jade on Discord</label>
        <div id="dcStatus" class="text-sm"></div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <div><label class="lbl" for="sDcUrl">Bridge URL</label><input id="sDcUrl" class="field mt-1" placeholder="http://192.168.1.20:8788/mcp" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sDcToken">Bridge token</label><input id="sDcToken" type="password" class="field mt-1" placeholder="printed by the bridge (--print-token)" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sDcPoll">Check for messages every (seconds)</label><input id="sDcPoll" type="number" min="1" max="120" class="field mt-1" placeholder="3"></div>
          <div><label class="lbl" for="sDcOwner">Owner user id (absolute power)</label><input id="sDcOwner" class="field mt-1" placeholder="your Discord user id (Developer Mode → Copy User ID)" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sDcOwnerName">Your name (what Jade calls you to others)</label><input id="sDcOwnerName" class="field mt-1" placeholder="e.g. Sam"></div>
          <div><label class="lbl" for="sDcAdmins">Admin whitelist (user ids)</label><textarea id="sDcAdmins" class="field mt-1" rows="2" placeholder="one per line: they can have Jade message people, kick, ban and leave servers" spellcheck="false"></textarea></div>
          <div><label class="lbl" for="sDcChannels">Channel whitelist</label><textarea id="sDcChannels" class="field mt-1" rows="2" placeholder="channel ids, server ids or names, #channel-names where Jade takes part" spellcheck="false"></textarea></div>
          <div><label class="lbl" for="sDcDm">Who can DM her</label><select id="sDcDm" class="field mt-1"><option value="anyone">Anyone (general chat)</option><option value="known">Only owner + admins</option><option value="owner">Only me</option></select></div>
          <div><label class="lbl" for="sDcTrigger">In channels she answers</label><select id="sDcTrigger" class="field mt-1"><option value="mention">When @mentioned, named or replied to</option><option value="all">Every message</option></select></div>
          <div><label class="lbl" for="sDcWords">Trigger words</label><input id="sDcWords" class="field mt-1" placeholder="jade, hey jade"></div>
          <div><label class="lbl" for="sDcNotify">Messages for you</label><select id="sDcNotify" class="field mt-1"><option value="inbox">Go to the inbox</option><option value="urgent">Inbox; urgent ones right away</option><option value="now">Tell me right away</option></select></div>
        </div>
        <label class="flex items-center gap-2 text-sm" for="sDcImages"><input type="checkbox" id="sDcImages" class="accent-emerald-400 w-4 h-4"> Let her see images people send</label>
        <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-solid" id="btnDcTest">Connect</button><button type="button" class="btn" id="btnDcInbox">Open inbox</button><button type="button" class="btn" id="btnDcInvite">Copy invite link</button></div>
        <p class="hint leading-relaxed">You (the owner) get the same Jade as in this app, with every tool. Admins get Discord powers but never your notes, memory or files. Everyone else can chat and leave you messages. Each Discord chat has its own chat here (🎮). Jade never pings @everyone or roles, and ignores other bots. Vector and Discord share one Jade: she answers one conversation at a time. Keep the app running for her to answer: Config → Background mode keeps it alive on Android.</p>
      </section>

"""
rep("""      <section class="flex flex-col gap-3" id="secretSection">""", DC_HTML + """      <section class="flex flex-col gap-3" id="secretSection">""")
# v24: Voice & senses settings section
WORLD_HTML = """      <section class="flex flex-col gap-3" id="senseSection">
        <div class="pane-h">Voice &amp; senses</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Talk to Jade without touching the screen (the <span class="text-yl">Talk</span> button next to Voice), and let her use the phone's camera, microphone, location and sensors: <span class="text-yl">senses</span> (photos, video, sound level, GPS, accelerometer, gyroscope, magnetic field, light, battery, Wi-Fi signal…), <span class="text-yl">look</span> (open any image or video in the vault), <span class="text-yl">litert</span> (run .tflite models). Android asks you the first time. She can also build her own tools, skills and flows on top of these.</p>
        <label class="flex items-center gap-2 text-sm" for="sSensesOn"><input type="checkbox" id="sSensesOn" class="accent-emerald-400 w-4 h-4"> Let Jade use the camera, microphone, location, sensors and the phone itself (alarms, sounds, calls, texts)</label>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <div><label class="lbl" for="sVoiceLang">Speech language (empty = the phone's)</label><input id="sVoiceLang" class="field mt-1" placeholder="en-US" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sWakeWords">Wake phrases for hands-free (empty = always listening)</label><input id="sWakeWords" class="field mt-1" placeholder="hey jade, hey choom" autocomplete="off" spellcheck="false"></div>
          <div><label class="lbl" for="sVadMs">Pause that ends a sentence (ms, transcription model only)</label><input id="sVadMs" type="number" min="400" max="3000" step="100" class="field mt-1" placeholder="900"></div>
          <div><label class="lbl" for="sSttProv">Speech to text (hands-free listening)</label><select id="sSttProv" class="field mt-1"></select></div>
          <div><label class="lbl" for="sSttModel">Transcription model</label><input id="sSttModel" class="field mt-1" list="dlStt" placeholder="e.g. whisper-large-v3-turbo" autocomplete="off" spellcheck="false"><datalist id="dlStt"></datalist></div>
          <div><label class="lbl" for="sVisProv">Picture understanding</label><select id="sVisProv" class="field mt-1"></select></div>
          <div><label class="lbl" for="sVisModel">Vision model</label><input id="sVisModel" class="field mt-1" list="dlVis" placeholder="e.g. gemma3:12b" autocomplete="off" spellcheck="false"><datalist id="dlVis"></datalist></div>
        </div>
        <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-ghost" id="btnSttScan">List transcription models</button><button type="button" class="btn btn-ghost" id="btnVisScan">List vision models</button></div>
        <p class="hint leading-relaxed">When a vision model is picked, every picture (yours, from the camera, or from <span class="text-yl">look</span>) is described by it and the chat model reads the description, so the chat model does not need to see images. With a transcription model, Jade records each phrase and sends it there (Groq/OpenAI-style <span class="mono">/audio/transcriptions</span>, or an audio-capable chat model); it needs a connection to that provider.</p>
        <label class="flex items-center gap-2 text-sm" for="sSttOffline"><input type="checkbox" id="sSttOffline" class="accent-emerald-400 w-4 h-4"> Prefer on-device speech recognition (works without internet when the phone has its offline language pack)</label>
        <label class="flex items-center gap-2 text-sm" for="sHfSolo"><input type="checkbox" id="sHfSolo" class="accent-emerald-400 w-4 h-4"> Hands-free shows only her avatar and background (tap ✕, double-tap, or Back to leave)</label>
        <label class="flex items-center gap-2 text-sm" for="sBrowserOn"><input type="checkbox" id="sBrowserOn" class="accent-emerald-400 w-4 h-4"> Let Jade use her own web browser (open pages, click, type, screenshots)</label>\n        <label class="flex items-center gap-2 text-sm" for="sScreenOn"><input type="checkbox" id="sScreenOn" class="accent-emerald-400 w-4 h-4"> Let Jade drive other apps on the phone (needs turning on in Android Accessibility settings too)</label>
        <label class="flex items-center gap-2 text-sm" for="sPhoneOn"><input type="checkbox" id="sPhoneOn" class="accent-emerald-400 w-4 h-4"> Let Jade control the phone (alarms, calls, texts, Bluetooth, casting, apps)</label>
        <div class="mt-3 p-3 rounded border border-white/10">
          <label class="flex items-center gap-2 text-sm" for="sCuOn"><input type="checkbox" id="sCuOn" class="accent-emerald-400 w-4 h-4"> <b>Curiosity wake-ups</b>: Jade wakes at random times and chooses for herself what to do</label>
          <div class="hint mt-1">Off by default. She picks from a ranked menu (learning progress + her track record), or rests, and what she does is measured by what actually changed in the vault. Needs the app to stay running, like the heartbeat. Write what you want her to know (interests, things to look into, things to keep away from) in CURIOSITY.md.</div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div><label class="lbl" for="sCuMin">Soonest (minutes)</label><input id="sCuMin" type="number" min="1" class="field mt-1"></div>
            <div><label class="lbl" for="sCuMax">Latest (minutes)</label><input id="sCuMax" type="number" min="1" class="field mt-1"></div>
            <div><label class="lbl" for="sCuFrom">Active from</label><input id="sCuFrom" type="time" class="field mt-1"></div>
            <div><label class="lbl" for="sCuTo">Active until</label><input id="sCuTo" type="time" class="field mt-1"></div>
            <div><label class="lbl" for="sCuCap">At most per day</label><input id="sCuCap" type="number" min="1" max="48" class="field mt-1"></div>
            <div><label class="lbl" for="sCuTools">Tools while awake</label><select id="sCuTools" class="field mt-1"><option value="notes">Notes and memory only</option><option value="web">Notes, memory and web</option><option value="all">All tools</option></select></div>
          </div>
          <div class="lbl mt-2">Things she may choose to do</div><div id="cuActs" class="mt-1 space-y-1"></div>
          <div class="flex items-center gap-2 mt-2"><button type="button" id="cuEdit" class="btn btn-ghost">Edit CURIOSITY.md</button><button type="button" id="cuNow" class="btn btn-ghost">Wake her now</button><span id="cuStatus" class="hint"></span></div>
        </div>
        <label class="flex items-center gap-2 text-sm" for="sDelegateOn"><input type="checkbox" id="sDelegateOn" class="accent-emerald-400 w-4 h-4"> Let Jade hand side jobs to a sub-agent (its own clean context; read-only unless she says otherwise)</label>
        <label class="flex items-center gap-2 text-sm" for="sThinkOn"><input type="checkbox" id="sThinkOn" class="accent-emerald-400 w-4 h-4"> Let Jade search several lines of reasoning and verify them (tree of thoughts)</label>
        <label class="flex items-center gap-2 text-sm" for="sSentryPackOn"><input type="checkbox" id="sSentryPackOn" class="accent-emerald-400 w-4 h-4"> Let Jade set up Sentry rules (react to sensors, calls, texts, the camera…)</label>
        <p class="hint leading-relaxed">Each switch above removes that whole set of tools from what Jade is told, which also saves some of the model's context (the estimate is on each line).</p>
        <div class="flex flex-col gap-2 mt-2 p-3 rounded-lg" style="border:1px solid var(--bd,#2f6)" id="sentryBox">
          <div class="lbl">Sentry: reacts to events by itself</div>
          <label class="flex items-center gap-2 text-sm" for="sySentryOn"><input type="checkbox" id="sySentryOn" class="accent-emerald-400 w-4 h-4"> Sentry is on (runs the rules in /Jade/Config/Sentry.json)</label>
          <div class="hint leading-relaxed">Systems: add or remove each source. A system only uses battery while it is ticked <em>and</em> a rule needs it.</div>
          <div id="sySystems" class="flex flex-col gap-1"></div>
          <div><label class="lbl" for="syAllow">Numbers Sentry may text or call by itself (emergency contacts)</label><textarea id="syAllow" class="field mt-1" rows="2" placeholder="one number per line" spellcheck="false"></textarea></div>
          <div class="flex items-center gap-2 text-sm"><label for="syLimit">At most</label><input id="syLimit" type="number" min="1" max="60" class="field" style="width:5rem"><span>texts or calls per hour</span></div>
          <div class="flex items-center gap-3 flex-wrap"><button type="button" class="btn btn-ghost" id="btnSyNotif">Notification access…</button><span class="text-sm text-dim" id="syStatus"></span></div>
          <p class="hint leading-relaxed">Camera and microphone checks only measure change and loudness; nothing is recorded or sent anywhere. While Sentry is working, a notice lists what it is using. Jade cannot edit the numbers above.</p>
        </div>
        <div class="flex flex-col gap-2 mt-2 p-3 rounded-lg" style="border:1px solid var(--bd,#2f6)" id="sshBox">
          <div class="lbl">SSH hosts: machines Jade can work on</div>
          <label class="flex items-center gap-2 text-sm" for="sSshOn"><input type="checkbox" id="sSshOn" class="accent-emerald-400 w-4 h-4"> Let Jade open SSH sessions</label>
          <div class="hint leading-relaxed">Jade asks for a machine by name. The password or key below is sent straight from here to the SSH connection &mdash; it is never shown to her and never appears in the chat. The first connection asks you to approve the machine's host-key fingerprint; after that a changed key is refused.</div>
          <div id="sshList" class="flex flex-col gap-2"></div>
          <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-ghost" id="btnSshAdd">Add a machine</button><span class="text-sm text-dim" id="sshStatus"></span></div>
          <p class="hint leading-relaxed">These are kept with your API keys, so a backup exported <em>with</em> keys contains them in the clear: treat that file like a private key. &ldquo;Ask before each command&rdquo; is on by default. Sentry-triggered flows cannot use a machine unless you tick it for them.</p>
        </div>
        <label class="flex items-center gap-2 text-sm" for="sAskRisky"><input type="checkbox" id="sAskRisky" class="accent-emerald-400 w-4 h-4"> Ask me before Jade places a call, sends a text or sends an email</label>
        <div class="flex items-center gap-3 flex-wrap"><button type="button" class="btn btn-ghost" id="btnSenseTest">Check permissions</button><span class="text-sm text-dim" id="senseStatus"></span></div>
        <p class="hint leading-relaxed">Hands-free listens while the app is open and the screen is on, and stops listening while Jade is talking so she does not hear herself. Some phones beep each time the recognizer restarts; turn the phone's system sounds down if that bothers you.</p>
      </section>

"""
rep("""      <section class="flex flex-col gap-3" id="secretSection">""", WORLD_HTML + """      <section class="flex flex-col gap-3" id="secretSection">""")
DISK_HTML = """      <section class="flex flex-col gap-3" id="diskSection" hidden>
        <div class="pane-h">Vault storage</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Every note and file is a real file on the phone, so other apps (a file manager, Pydroid, a sync app) can open and edit them. Jade only keeps the list of files in memory and reads a file when she needs it.</p>
        <div class="text-sm flex flex-col gap-1" id="diskStatus"></div>
        <div class="flex gap-2 flex-wrap"><button type="button" class="btn btn-ghost" id="btnDiskShared">Use the JadeVault folder</button><button type="button" class="btn btn-ghost" id="btnDiskRescan">Rescan the folder</button></div>
        <p class="hint leading-relaxed">Changes made by other apps show up when you come back to Jade, or when you tap Rescan. Files over about 16 MB are not handed to shell commands, Python or scripts, but Jade can still open, move and delete them.</p>
      </section>

"""
rep("""      <section class="flex flex-col gap-3" id="secretSection">""", DISK_HTML + """      <section class="flex flex-col gap-3" id="secretSection">""")
s = s.replace('/* =====================================================================\n   BOOT', rd('discord.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("const activeTools = () => [...OLLAMA_TOOLS.filter(t => (t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel)) && (t.function.name !== 'memory' || S.memoryOn)), ...mcpToolDefs()];",
    "const activeTools = () => vecFilterTools([...OLLAMA_TOOLS.filter(t => (t.function.name !== 'decide' || (S.ollayaOn && S.ollayaModel)) && (t.function.name !== 'memory' || S.memoryOn)), ...VEC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]);")
rep("        try { result = await runTool(name, args, card); }", "        try { vecGuard(name); result = await runTool(name, args, card); }")
rep("    case 'apps': return await appsTool(args);", "    case 'apps': return await appsTool(args);\n    case 'vector': return await vectorTool(args);\n    case 'notify_owner': return await notifyOwnerTool(args);")
rep("const systemPrompt = () => { const vi = vaultIndex();", "const systemPrompt = () => { if (vecScope()) return vecScopedPrompt(); const vi = vaultIndex();")
rep("- web_search / web_fetch: look things up on the web\\n", "- web_search / web_fetch: look things up on the web\\n${S.vecOn ? `- vector: you are also a bot on Vector messenger${VEC.npub ? ' (' + VEC.npub + ')' : ''}: message people or channels, reply, react, send files from the vault, download what people send, read chats, join or leave communities, invite, moderate, play Mini Apps. Use it whenever the user asks you to message, send or share something on Vector.\\n- notify_owner: file a message in the user's Vector inbox (or tell them at once, by their setting)\\n` : ''}")
rep("const SECRET_KEYS = ['ollamaKey', 'groqKey', 'oaiKey', 'lcppKey', 'ollayaKey', 'mcpSecrets', 'secrets'];", "const SECRET_KEYS = ['ollamaKey', 'groqKey', 'oaiKey', 'lcppKey', 'ollayaKey', 'mcpSecrets', 'secrets', 'vecToken'];")
rep("'secrets', 'vecToken'];", "'secrets', 'vecToken', 'aicKey'];")
rep("  const want = S.bgMode === 'always' || (S.bgMode !== 'off' && running);\n  const t = text || (running ? 'Jade is working…' :", "  const vecOnline = typeof VEC !== 'undefined' && S.vecOn && VEC.connected;\n  const want = S.bgMode === 'always' || (S.bgMode !== 'off' && (running || vecOnline));\n  const t = text || (running ? 'Jade is working…' : vecOnline ? 'Jade is online on Vector' :")
rep("  if (!document.hidden || !S.bgNotify || !cur) return;", "  if (!document.hidden || !S.bgNotify || !cur || cur.vec) return;")
rep("  if (running || compacting) { setTimeout(xdcPump, 1500); return; }", "  if (running || compacting || (typeof VEC !== 'undefined' && VEC.busy)) { setTimeout(xdcPump, 1500); return; }")
rep("  if (cmd === 'context' || cmd === 'ctx') {", "  if (cmd === 'inbox') { if (!vfs.isFile(VEC_INBOX)) vecInboxAdd({ from: '', chat: '', text: 'Inbox created.' }); openFile(VEC_INBOX, { mode: 'read' }); return; }\n  if (cmd === 'vector') { openSettings(); setTimeout(() => $('#vecSection').scrollIntoView({ block: 'start' }), 60); return; }\n  if (cmd === 'context' || cmd === 'ctx') {")
s = s.replace("['/context', 'what fills the context'],", "['/context', 'what fills the context'], ['/inbox', 'messages people left for you'], ['/vector', 'Vector messenger settings'],", 1)
rep("<b>/context</b> what fills the context ·", "<b>/context</b> what fills the context · <b>/inbox</b> Vector messages for you · <b>/vector</b> bot settings ·")
rep("http_request: a => `${(a.method || 'GET').toUpperCase()} ${a.url || ''}`,", "http_request: a => `${(a.method || 'GET').toUpperCase()} ${a.url || ''}`, vector: a => `${a.action || ''}${a.to ? ' → ' + a.to : ''}${a.text ? ' “' + String(a.text).slice(0, 40) + '”' : ''}${a.emoji || ''}`, notify_owner: a => (a.urgent ? '⚡ ' : '') + String(a.message || '').slice(0, 60),")
rep("http_request: () => `${(a.method || 'GET').toUpperCase()} ${short(a.url)}`,", "http_request: () => `${(a.method || 'GET').toUpperCase()} ${short(a.url)}`, vector: () => `Vector: ${a.action || ''}`, notify_owner: () => 'Passing a message on',")
rep("  renderSkillsSettings(); renderBgSettings(); renderTrajSettings(); window.__trajSync?.();", "  renderSkillsSettings(); renderBgSettings(); renderTrajSettings(); window.__trajSync?.(); window.__vecSync?.();")
rep("Object.assign(window, { XWAKE,", "Object.assign(window, { saveSettings, VEC, vecConnect, vecStop, vecPoll, vecIncoming, vectorTool, notifyOwnerTool, vecWake, vecScope, vecFilterTools, vecInboxAdd, VEC_INBOX, XWAKE,")

rep("function newSession() { if (cur?.messages?.length) journalSession(cur);", "function newSession() { saveSession.flush?.(); if (cur?.messages?.length) journalSession(cur);")
rep("async function openSession(id) { if (cur?.messages?.length && cur.id !== id) journalSession(cur);", "async function openSession(id) { if (cur?.id !== id) saveSession.flush?.(); if (cur?.messages?.length && cur.id !== id) journalSession(cur);")

# ---------- v17: HTTP API (Android app) + settings tabs ----------
rep("const DEFAULTS = { provider: 'local',", "const DEFAULTS = { apiOn: false, apiPort: 8787, apiLan: false, apiToken: '', provider: 'local',")
API_HTML = r"""      <section class="flex flex-col gap-3" id="apiSection">
        <div class="pane-h">API endpoint</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Let other apps and scripts talk to Jade. They send a GET request and get JSON back. A message sent this way goes through the normal chat: it appears in the app and Jade answers there.</p>
        <div id="apiNative" class="flex flex-col gap-3">
          <label class="flex items-center gap-2 text-sm" for="sApiOn"><input type="checkbox" id="sApiOn" class="accent-emerald-400 w-4 h-4"> Enable the API (stays running in the background while on)</label>
          <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
            <div><label class="lbl" for="sApiPort">Port</label><input id="sApiPort" type="number" min="1024" max="65535" step="1" class="field mt-1"></div>
            <div class="flex items-end"><label class="flex items-center gap-2 text-sm" for="sApiLan"><input type="checkbox" id="sApiLan" class="accent-emerald-400 w-4 h-4"> Allow other devices on my Wi-Fi</label></div>
          </div>
          <div><label class="lbl" for="sApiToken">Access token (required on every call)</label>
            <div class="flex gap-2 mt-1"><input id="sApiToken" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="made for you when you enable the API"><button type="button" class="btn" id="btnApiCopy">Copy</button><button type="button" class="btn btn-ghost" id="btnApiToken">New</button></div></div>
          <div class="text-sm flex items-center gap-2 flex-wrap" id="apiStatus"></div>
          <div><div class="lbl">Try it</div><pre class="field mt-1" id="apiExample" style="white-space:pre-wrap;word-break:break-all;margin:0"></pre><div class="mt-1"><button type="button" class="btn btn-ghost" id="btnApiCopyEx">Copy example</button></div></div>
          <details class="text-sm"><summary class="cursor-pointer text-[#c2d6ce]">Request and reply format</summary>
<pre class="hint leading-relaxed mt-2" style="white-space:pre-wrap;overflow-x:auto">GET /v1/chat?message=TEXT
  session=new | CHAT_ID   start a new chat or continue one
                          (default: the chat open in the app)
  wait=0                  answer 202 at once; poll /v1/status,
                          then read /v1/history
  tools=0                 leave tool_calls out of the reply
  timeout=SECONDS         how long to wait (default 300, max 1800)
  json={"message":"hi","new":true}
                          the same parameters as one JSON object

Reply: {"ok":true,"api":1,"reply":"...",
  "session":{"id","title","messages"},
  "tool_calls":[{"name","arguments","ok","result"}],
  "model","elapsed_ms","error":null}

GET /v1/status   busy flag, model, open chat
GET /v1/history?limit=20&amp;session=CHAT_ID
GET /v1/chats    list of chats
GET /v1/health   no token needed

Errors: {"ok":false,"error":{"code","message"}} with HTTP
400 bad request, 401 token, 404 unknown chat, 409 busy,
502 model error, 504 timeout (Jade keeps going in the app).

Send the token as  Authorization: Bearer TOKEN  or  ?token=TOKEN.
Over Wi-Fi the traffic is plain HTTP, so use a trusted network.</pre></details>
        </div>
        <p class="hint leading-relaxed" id="apiWeb">The API runs inside the Android app. A browser tab cannot listen for requests.</p>
      </section>

"""
VS = '      <section class="flex flex-col gap-3" id="vecSection">'
rep(VS, API_HTML + VS)
rep("  renderSkillsSettings(); renderBgSettings();", "  renderSkillsSettings(); renderBgSettings(); renderApiSettings(); initSettingsTabs();")
rep("bgMode: $('#sBgMode').value, bgNotify: $('#sBgNotify').checked });", "bgMode: $('#sBgMode').value, bgNotify: $('#sBgNotify').checked, ...apiReadFields() });")
rep("  saveSettings(); bgSync(); setVoice($('#sJadeVoice').checked);", "  saveSettings(); apiApply(); bgSync(); setVoice($('#sJadeVoice').checked);")
rep("  const want = S.bgMode === 'always' || (S.bgMode !== 'off' && (running || vecOnline));", "  const apiUp = !!(S.apiOn && apiState?.listening);\n  const want = apiUp || S.bgMode === 'always' || (S.bgMode !== 'off' && (running || vecOnline));")
rep("vecOnline ? 'Jade is online on Vector' :", "vecOnline ? 'Jade is online on Vector' : apiUp ? `Jade API on port ${apiState.port}` :")
rep("  bgSync();\n  setTab('chat');\n})();", "  apiApply();\n  bgSync();\n  setTab('chat');\n})();")
s = s.replace('/* =====================================================================\n   BOOT', rd('api.js') + '\n' + '/* =====================================================================\n   BOOT', 1)

for sec_id in ('trajSection', 'vecSection', 'mcpSection'):
    rep(f"setTimeout(() => $('#{sec_id}').scrollIntoView({{ block: 'start' }}), 60)", f"setTimeout(() => showSettingsSection('#{sec_id}'), 60)")
rep("openSettings(); $('#sProvider').value = p; showProvFields(); return; }", "openSettings(); showSettingsSection('#sProvider'); $('#sProvider').value = p; showProvFields(); return; }")
# settings tabs: every section gets data-tab (an unknown section fails the build, so none is ever lost)
TABS = [('model', 'Model'), ('memory', 'Memory'), ('tools', 'Tools'), ('connect', 'Connect'), ('app', 'App')]
TAB_OF = {'Model provider': 'model', 'Web search': 'model', 'Decision models': 'model',
          'Persona, instructions & skills': 'memory', 'Long-term memory': 'memory', 'Embeddings (sqlite-vec)': 'memory', 'History compaction': 'memory', 'Trajectory log (fine-tuning data)': 'memory',
          'MCP servers': 'tools', 'Secrets (API keys for Jade\'s HTTP requests)': 'tools', 'BusyBox WASM': 'tools',
          'API endpoint': 'connect', 'Vector messenger (Jade as a bot)': 'connect', 'Discord (Jade as a bot)': 'connect',
          'Heartbeat': 'app', 'Voice & senses': 'app', 'Vault storage': 'app', 'Background': 'app', 'Jade companion': 'app', 'Backup': 'app', 'Danger zone': 'app'}
a = s.index('<div class="modal-bg" id="settings" hidden>'); b = s.index('<div class="flex justify-end gap-2"><button class="btn" id="btnCancel">', a)
blk = s[a:b]; seen = set()
def tag(m):
    t = re.search(r'class="pane-h">([^<]+)<', m.group(0))
    if not t: sys.exit('SETTINGS SECTION WITHOUT TITLE: ' + m.group(0)[:100])
    title = t.group(1).replace('&amp;', '&').replace('&#39;', "'")
    if title not in TAB_OF: sys.exit(f'SETTINGS SECTION NOT ASSIGNED TO A TAB: {title!r}')
    seen.add(title)
    return '<section data-tab="' + TAB_OF[title] + '"' + m.group(0)[len('<section'):]
blk2 = re.sub(r'<section class="flex flex-col gap-3"[^>]*>.*?</section>', tag, blk, flags=re.S)
if seen != set(TAB_OF): sys.exit('SETTINGS TABS: sections missing from the page: ' + repr(set(TAB_OF) - seen))
HDR_END = '<button class="btn btn-ghost" id="btnCloseSettings">Close</button></div>\n'
assert blk2.count(HDR_END) == 1
bar = '<div class="set-top"><div class="set-tabs" id="setTabs" role="tablist">' + ''.join(f'<button type="button" role="tab" class="set-tab" data-tab="{k}" aria-selected="false">{v}</button>' for k, v in TABS) + '</div><input id="setSearch" type="search" class="field" placeholder="Search settings" autocomplete="off" autocapitalize="off" spellcheck="false"></div>\n      <p class="hint" id="setNone" hidden>No setting matches that.</p>\n'
blk2 = blk2.replace(HDR_END, HDR_END + '      ' + bar, 1)
s = s[:a] + blk2 + s[b:]
s = s.replace('<div class="flex justify-end gap-2"><button class="btn" id="btnCancel">', '<div class="flex justify-end gap-2 set-foot"><button class="btn" id="btnCancel">', 1)
s = s.replace('s = s', 's = s') if False else s
s = s.replace('[hidden]{display:none!important}', '[hidden]{display:none!important}\n' + """#settings section.tab-off{display:none!important}
#settings .set-top{position:sticky;top:-20px;z-index:3;background:var(--panel);margin:-20px -20px 0;padding:20px 20px 10px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--line)}
#settings .set-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#settings .set-tabs::-webkit-scrollbar{display:none}
.set-tab{flex:1 0 auto;font-family:var(--f-disp);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:11px;padding:7px 8px;border:1px solid var(--line);color:var(--dim);background:transparent;cursor:pointer;white-space:nowrap}
.set-tab:hover{color:var(--fg)} .set-tab[aria-selected="true"]{color:var(--yl);border-color:var(--yl);background:rgba(31,229,165,.07)}
#settings .set-foot{position:sticky;bottom:-20px;z-index:3;background:var(--panel);margin:0 -20px -20px;padding:10px 20px 20px;border-top:1px solid var(--line)}
""", 1)
s = s.replace('/* =====================================================================\n   BOOT', rd('settings_tabs.js') + '\n' + '/* =====================================================================\n   BOOT', 1)


# ---------- v18 fix: a BusyBox command applies only its own changes ----------
# The worker gets a copy of the vault and hands back the whole tree. Replacing the vault with it lost files
# written meanwhile (by Jade, a flow, a cron job, an autosave) and brought deleted ones back. Now the result
# is compared with the copy the command started from: only what the command changed is applied.
rep_between('function applyBbEntries(entries) {', 'async function loadEmbeddedBusybox() {', """function applyBbEntries(entries, base) {
  const same = (a, b) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));
  if (!base) {
    const next = new Map(); let changed = false;
    for (const [p, n] of entries) {
      const old = vfs.nodes.get(p);
      if (n.dir) next.set(p, old?.dir ? old : (changed = true, { dir: true, mtime: Date.now() }));
      else { const s = old && !old.dir && same(old.data, n.data); if (!s) changed = true; next.set(p, s ? old : { data: n.data, mtime: Date.now() }); }
    }
    if (changed || next.size !== vfs.nodes.size) vfs.replace([...next.entries()]);
    return;
  }
  const seen = new Set(); let changed = false;
  for (const [p, n] of entries) {
    seen.add(p); const b = base.get(p), cur = vfs.nodes.get(p);
    if (n.dir) { if (!cur) { vfs.nodes.set(p, { dir: true, mtime: Date.now() }); changed = true; } continue; }
    if (b && !b.dir && same(b.data, n.data)) continue;               // the command did not touch it: keep what is there now
    if (cur && !cur.dir && same(cur.data, n.data)) continue;
    vfs.nodes.set(p, { data: n.data, mtime: Date.now() }); changed = true;
  }
  for (const [p, b] of base) if (p !== '/' && !seen.has(p) && vfs.nodes.get(p) === b) { vfs.nodes.delete(p); changed = true; }   // the command removed it (and nobody changed it since)
  if (changed) vfs.changed();
}
""")
rep("    const r = await bbRun([name, ...args], stdin, this.timeoutMs, this.cwd);", "    const base = new Map(vfs.nodes); const r = await bbRun([name, ...args], stdin, this.timeoutMs, this.cwd);")
rep("    applyBbEntries(r.entries);", "    applyBbEntries(r.entries, base);")



# ---------- v18: flows (n8n-light), jade.* bridge for scripts, shell/flow schedules + crontab, note scripts & templates ----------
rep("const DEFAULTS = { apiOn: false,", "const DEFAULTS = { tplOn: true, tplTools: false, tplDir: '/Templates', apiOn: false,")
# bottom bar: a Flows tab between Schedule and Apps
SCHED_TAB = '<button class="tab" role="tab" data-tab="sched" aria-selected="false"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>Schedule<span class="badge" id="schedBadge" hidden>0</span></button>'
rep(SCHED_TAB, SCHED_TAB + '\n    <button class="tab" role="tab" data-tab="flows" aria-selected="false"><svg viewBox="0 0 24 24"><rect x="3" y="3.5" width="7" height="5.5" rx="1"/><rect x="14" y="15" width="7" height="5.5" rx="1"/><circle cx="17.5" cy="6.25" r="2.75"/><path d="M10 6.25h4.75M6.5 9v5.25a3 3 0 0 0 3 3H14"/></svg>Flows<span class="badge" id="flowBadge" hidden>0</span></button>')
rep("repeat(6,1fr)", "repeat(7,1fr)")
rep("font-size:9.5px;letter-spacing:.1em;position:relative}", "font-size:8.8px;letter-spacing:.04em;position:relative}")
rep("    <!-- GRAPH -->", """    <!-- FLOWS -->
    <section class="m-screen overflow-y-auto" data-panel="flows" hidden>
      <div class="p-4 flex flex-col gap-3" id="flowsPanel"></div>
    </section>

    <!-- GRAPH -->""")
rep("  if (name === 'apps') xdcRefresh().catch(() => {});", "  if (name === 'apps') xdcRefresh().catch(() => {});\n  if (name === 'flows') flowsRender();")
# bottom bar: a Playbooks tab after Flows
FLOW_TAB_END = 'Flows<span class="badge" id="flowBadge" hidden>0</span></button>'
rep(FLOW_TAB_END, FLOW_TAB_END + '\n    <button class="tab" role="tab" data-tab="playbooks" aria-selected="false"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8.5 9l2 2 3.5-4M8.5 15.5h7"/></svg>Playbooks<span class="badge" id="pbBadge" hidden>0</span></button>')
rep("repeat(7,1fr)", "repeat(8,1fr)")
rep("font-size:8.8px;letter-spacing:.04em;position:relative}", "font-size:8.2px;letter-spacing:.01em;position:relative}")
rep("    <!-- GRAPH -->", """    <!-- PLAYBOOKS -->
    <section class="m-screen overflow-y-auto" data-panel="playbooks" hidden>
      <div class="p-4 flex flex-col gap-3" id="playbooksPanel"></div>
    </section>

    <!-- GRAPH -->""")
rep("  if (name === 'flows') flowsRender();", "  if (name === 'flows') flowsRender();\n  if (name === 'playbooks') { pbMigrate(); pbRender(); }")
rep('[hidden]{display:none!important}', '[hidden]{display:none!important}\n' + """#flowsPanel .fl-new,#playbooksPanel .fl-new{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px dashed var(--line-hot)}
.fl-ex{display:flex;flex-direction:column;gap:2px;text-align:left;padding:8px 10px;border:1px solid var(--line);background:rgba(5,10,8,.7);color:var(--fg);cursor:pointer}
.fl-ex b{font-family:var(--f-disp);letter-spacing:.06em;color:var(--yl);font-size:13px} .fl-ex span{font-size:12px;color:var(--dim)} .fl-ex:hover{border-color:var(--line-hot)}
.fl-runrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;text-align:left;padding:8px 4px;border-bottom:1px solid var(--line);color:var(--fg);font-size:13px;background:none;cursor:pointer}
.fl-st{font-family:var(--f-mono);font-size:11px;white-space:nowrap} .fl-st-ok{color:var(--ok)} .fl-st-error{color:var(--rd)} .fl-st-running{color:var(--yl)} .fl-st-stopped,.fl-st-skipped{color:var(--dim)}
.fl-err{border-left:2px solid var(--rd);background:rgba(255,61,79,.08);padding:6px 10px;font-size:12.5px;color:#ffc2c9;white-space:pre-wrap;word-break:break-word}
.fl-errs{border:1px solid var(--rd);background:rgba(255,61,79,.06);padding:8px 12px;font-size:12.5px;color:#ffc2c9} .fl-errs ul{margin:4px 0 0 16px;list-style:disc}
.fl-io summary,.fl-srow summary{cursor:pointer;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fl-srow{border:1px solid var(--line);background:rgba(5,10,8,.7);padding:6px 10px} .fl-srow.bad{border-color:rgba(255,61,79,.5)}
.fl-srow pre,.fl-io pre,.fl-out{font-family:var(--f-mono);font-size:11.5px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;background:#030705;border:1px solid var(--line);padding:6px 8px;margin:4px 0;color:#cde3da}
.fl-title{font-family:var(--f-disp);font-weight:700;letter-spacing:.06em}
.fl-list{display:flex;flex-direction:column;gap:6px}
.fl-step{border:1px solid var(--line);background:rgba(5,10,8,.75)} .fl-step.open{border-color:var(--line-hot)} .fl-step.off{opacity:.55} .fl-step.bad{border-color:var(--rd)}
.fl-step-h{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 10px;cursor:pointer;min-height:44px}
.fl-ico{width:22px;text-align:center;color:var(--yl);flex:none;font-size:14px}
.fl-type{font-family:var(--f-disp);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:var(--yl);flex:none}
.fl-sname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#c2d6ce}
.fl-acts{display:flex;gap:2px;flex:none} .fl-acts button{min-width:32px;height:32px;border:1px solid transparent;color:var(--dim);background:none;font-size:13px}
.fl-acts button:hover:not(:disabled){color:var(--yl);border-color:var(--line)} .fl-acts button:disabled{opacity:.3} .fl-acts button.armed{color:var(--rd);border-color:var(--rd);padding:0 6px}
.fl-step-b{display:flex;flex-direction:column;gap:10px;padding:6px 10px 12px;border-top:1px solid var(--line)}
.fl-branch{border-left:2px solid var(--line-hot);padding:6px 0 6px 10px;display:flex;flex-direction:column;gap:6px}
.fl-branch-h{font-family:var(--f-disp);font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:11px;color:var(--cy)}
.fl-add{max-width:230px;color:var(--dim);border-style:dashed}
.fl-json{min-height:50vh} .field.bad{border-color:var(--rd)} .btn.armed{color:var(--rd);border-color:var(--rd)}
.jv-js{border-left:2px solid var(--line-hot);padding:4px 0 4px 12px;margin:.6em 0}
.jv-js-log{font-family:var(--f-mono);font-size:12px;white-space:pre-wrap;background:#030705;border:1px solid var(--line);padding:6px 8px}
.jv-js-err{color:#ffc2c9;border-left:2px solid var(--rd);padding:4px 8px;font-family:var(--f-mono);font-size:12px;white-space:pre-wrap;word-break:break-word}
.jv-js-inline{color:var(--cy)} .jv-js-inline.err{color:var(--rd);font-family:var(--f-mono);font-size:12px}
.jv-dv-wrap{overflow-x:auto;max-width:100%} .jv-dv-table{border-collapse:collapse;width:100%;font-size:13px}
.jv-dv-table th,.jv-dv-table td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.jv-dv-table th{color:var(--yl);font-family:var(--f-disp);letter-spacing:.06em;text-transform:uppercase;font-size:11px} .jv-dv-group{margin-top:.5em;font-weight:700}
.jv-dlg{align-items:center!important;padding:16px!important;background:rgba(0,0,0,.72)!important} .jv-dlg>.frame{height:auto!important}
.jv-dlg-item{text-transform:none;letter-spacing:0;font-family:var(--f-mono);text-align:left;justify-content:flex-start;font-weight:400}
""")

# the Schedule tab: run a prompt, a shell command or a flow
rep('<div class="pane-h">Scheduled prompts</div>', '<div class="pane-h">Schedules</div>')
rep("Runs a prompt on a schedule, in your local time.", "Runs a prompt, a shell command, a flow or a playbook on a schedule, in your local time. From the shell: <span class=\"mono text-cy\">crontab -l</span>.")
SNAME = '<div><label class="lbl" for="schedName">Name</label><input id="schedName" class="field mt-1" maxlength="60" placeholder="Morning standup"></div>'
rep(SNAME, SNAME + """
            <div class="sched-row"><div><label class="lbl" for="schedKind">Run</label><select id="schedKind" class="field mt-1"><option value="prompt">A prompt (Jade does it in a chat)</option><option value="shell">A shell command</option><option value="flow">A flow</option><option value="playbook">A playbook</option></select></div><div id="schedFlowWrap" hidden><label class="lbl" for="schedFlow">Flow</label><select id="schedFlow" class="field mt-1"></select></div><div id="schedPbWrap" hidden><label class="lbl" for="schedPb">Playbook</label><select id="schedPb" class="field mt-1"></select></div></div>
            <div id="schedCmdWrap" hidden><label class="lbl" for="schedCmd">Command</label><input id="schedCmd" class="field mt-1 mono" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="node /scripts/sync.js >> /Jade/Logs/sync.log"><div class="hint mt-1">Runs in the shell on its own (no chat, no model). Output goes to /Jade/Logs/cron.log; a failure notifies you.</div></div>
            <div id="schedInputWrap" hidden><label class="lbl" for="schedInput" id="schedInputLbl">Flow input (JSON, optional)</label><input id="schedInput" class="field mt-1 mono" autocapitalize="off" spellcheck="false" placeholder='{"folder": "/projects"}'></div>""")
rep('<div><label class="lbl" for="schedPrompt">Prompt</label>', '<div id="schedPromptWrap"><label class="lbl" for="schedPrompt">Prompt</label>')
rep("syncSchedForm(true); $('#schedName').focus();", "schedKindFill(s); syncSchedForm(true); $('#schedName').focus();")
rep("  try {\n    if (Sched.editing) {\n      if (!vals.prompt.trim()) throw new Error('the prompt is empty');", "  try {\n    if (schedKindSubmit(vals)) { $('#schedForm').hidden = true; Sched.editing = null; return; }\n    if (Sched.editing) {\n      if (!vals.prompt.trim()) throw new Error('the prompt is empty');")
rep("  if (b.dataset.act === 'run') { if (!Sched.queue.some(j => j.s === s))", "  if (b.dataset.act === 'run' && schedIsJob(s)) { runScheduleKind(s, 'manual'); return; }\n  if (b.dataset.act === 'run') { if (!Sched.queue.some(j => j.s === s))")
rep("    if (!Sched.queue.some(j => j.s.id === s.id)) Sched.queue.push({ s, why: 'scheduled' });", "    if (schedIsJob(s)) runScheduleKind(s, 'scheduled'); else if (!Sched.queue.some(j => j.s.id === s.id)) Sched.queue.push({ s, why: 'scheduled' });")
rep("      if (s.catchUp) { Sched.queue.push({ s, why: 'catch-up' }); s.lastStatus = 'missed, catching up'; }", "      if (s.catchUp) { if (schedIsJob(s)) setTimeout(() => runScheduleKind(s, 'catch-up'), 4000); else Sched.queue.push({ s, why: 'catch-up' }); s.lastStatus = 'missed, catching up'; }")
rep("async function runSchedule({ s, why }) {", "async function runSchedule({ s, why }) {\n  if (schedIsJob(s)) return runScheduleKind(s, why);")
rep("runningNow = s.lastStatus === 'running' && Sched.draining;", "runningNow = (s.lastStatus === 'running' && Sched.draining) || SchedBusy.has(s.id);")
rep('<div class="sched-prompt">${esc(s.prompt)}</div>', '<div class="sched-prompt${schedIsJob(s) ? \' mono\' : \'\'}">${esc(s.prompt)}</div>')
rep("    const s = addSchedule({ name: a.name, when, prompt: a.prompt || a.message || a.task || a.name, chat: a.chat });", "    const s = (a.command || a.flow || a.playbook) ? addScheduleKind({ name: a.name, when, kind: a.command ? 'shell' : a.playbook ? 'playbook' : 'flow', command: a.command, flow: a.flow, playbook: a.playbook, input: (a.playbook ? a.vars ?? a.input : a.input) ?? null }) : addSchedule({ name: a.name, when, prompt: a.prompt || a.message || a.task || a.name, chat: a.chat });")
rep("Each run sends the prompt to you as a new message.", "Each run sends the prompt to you as a new message; or it runs a shell command (\"command\", no chat, output in /Jade/Logs/cron.log) or one of your flows (\"flow\").")
rep("prompt: { type: 'string', description: 'What to do or say each time, e.g. \"Remind the user to finish their projects\" (add)' },", "prompt: { type: 'string', description: 'What to do or say each time, e.g. \"Remind the user to finish their projects\" (add)' }, command: { type: 'string', description: 'add: run this shell command instead of a prompt, e.g. \"node /scripts/sync.js\"' }, flow: { type: 'string', description: 'add: run this flow (by name) instead of a prompt' }, input: { type: 'object', description: 'add with flow: the flow\\'s input' }, playbook: { type: 'string', description: 'add: run this saved, approved playbook (by name) instead of a prompt' }, vars: { type: 'object', description: 'add with playbook: values for variables the playbook declares' },")
rep(r"- schedule: create/list/pause/delete scheduled prompts and reminders.", r"- schedule: create/list/pause/delete scheduled prompts and reminders, or scheduled shell commands (command) and flows (flow).")

# shell: jade, flow, crontab; node gets the jade bridge (runNode now lives in bridge.js)
rep_between('async function runNode(c) {', '/* =====================================================================\n   TERMINAL (xterm.js', '')
rep("  async mcp(c) { try { return await mcpShell(c); }", "  async jade(c) { return jadeShell(c); },\n  async flow(c) { return flowShell(c); },\n  async crontab(c) { return crontabShell(c); },\n  async mcp(c) { try { return await mcpShell(c); }")
rep("'sqlite3', 'sqlite']);", "'sqlite3', 'sqlite', 'jade', 'flow', 'crontab']);")
rep(r"MCP: mcp list | add <name> <url> | remove | reconnect | tools [server] | call <tool> '<json>'.\n\n`", r"MCP: mcp list | add <name> <url> | remove | reconnect | tools [server] | call <tool> '<json>'.\nJade: jade tool <name> '<json>' | decide | ask | agent | notify | kv  (jade help; in node: jade.tool(), jade.decide() …).\nFlows: flow list | run <name> [json] | show | runs  (flow help).  Cron: crontab -l | add '<when>' '<command>' | <file>  (crontab -h).\n\n`")
rep(r"Use node for bulk edits across many notes.\n", r"Use node for bulk edits across many notes. In node, jade.tool(name, args), jade.decide({...}), jade.ask(prompt), jade.flow(name, input), jade.shell(cmd) and jade.notify(title, body) call your tools, decisions, model and flows.\n")

# Jade's flow tool
rep("    case 'schedule': return scheduleTool(args);", "    case 'schedule': return scheduleTool(args);\n    case 'flow': return await flowTool(args);")
rep("...VEC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]);", "...VEC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...FLOW_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]);")
rep("vector: a => `${a.action || ''}${a.to ? ' → ' + a.to : ''}", "flow: a => `${a.action || 'list'}${a.name ? ' ' + a.name : ''}`, vector: a => `${a.action || ''}${a.to ? ' → ' + a.to : ''}")
rep("vector: () => `Vector: ${a.action || ''}`,", "flow: () => `Flow: ${a.action || 'list'}${a.name ? ' ' + short(a.name) : ''}`, vector: () => `Vector: ${a.action || ''}`,")
rep(r"- skill: load a skill's instructions by name\n", r"- skill: load a skill's instructions by name\n- flow: build, change and run automation flows (steps of tools, JavaScript, shell commands, decisions, AI and logic; triggers: by hand, schedule, note change). Use a flow when the user wants an automation with several steps; read flow help before creating one.\n- Notes can hold live JavaScript: \`\`\`dataviewjs blocks and inline \`$= expr\` with a Dataview-like dv (dv.pages('#tag' or '\"folder\"'), dv.table(headers, rows), dv.list(items), dv.current()). Templates in ${S.tplDir || '/Templates'} use Templater tags (<% tp.date.now(\"YYYY-MM-DD\") %>, <% tp.file.title %>, <%* code %>).\n")

# note scripts & templates: settings (Tools tab), live blocks in Read view
API_SEC = '      <section data-tab="connect" class="flex flex-col gap-3" id="apiSection">'
rep(API_SEC, """      <section data-tab="tools" class="flex flex-col gap-3" id="tplSection">
        <div class="pane-h">Note scripts &amp; templates</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Notes can run JavaScript like Obsidian's Dataview and Templater: <span class="mono text-cy">```dataviewjs</span> (or <span class="mono text-cy">```jade-js</span>) blocks and inline <span class="mono text-cy">`$= …`</span> show live results in Read view, and notes in your templates folder fill in <span class="mono text-cy">&lt;% tp.date.now() %&gt;</span> tags when you insert them with the <b class="text-yl">{ }</b> button in the editor. Scripts run sandboxed: they read the vault, with no network and no file changes.</p>
        <label class="flex items-center gap-2 text-sm" for="sTplOn"><input type="checkbox" id="sTplOn" class="accent-emerald-400 w-4 h-4"> Run JavaScript in notes</label>
        <label class="flex items-start gap-2 text-sm" for="sTplTools"><input type="checkbox" id="sTplTools" class="accent-emerald-400 w-4 h-4 mt-0.5"> <span>Let note scripts and templates call Jade's tools (jade.tool, jade.decide, jade.ask, jade.flow). Only if you trust every note: a note written from web content could then run tools just by being opened.</span></label>
        <div><label class="lbl" for="sTplDir">Templates folder</label><input id="sTplDir" class="field mt-1 mono" placeholder="/Templates" autocapitalize="off" spellcheck="false"></div>
      </section>

""" + API_SEC)
rep("renderApiSettings(); initSettingsTabs();", "renderApiSettings(); renderTplSettings(); initSettingsTabs();")
rep("...apiReadFields() });", "...apiReadFields(), ...tplReadFields() });")
rep("  const pv = $('#notePrev'); const st = pv.scrollTop; pv.replaceChildren(el); pv.scrollTop = st;", "  const pv = $('#notePrev'); const st = pv.scrollTop; pv.replaceChildren(el); pv.scrollTop = st;\n  try { tplHydrate(el, editing); } catch (e) { console.warn('note scripts', e); }")

rep("  apiApply();\n  bgSync();", "  flowsInit();\n  apiApply();\n  bgSync();")
s = s.replace('/* =====================================================================\n   BOOT', rd('bridge.js') + '\n' + rd('cron.js') + '\n' + rd('flows.js') + '\n' + rd('templates.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("Object.assign(window, { saveSettings, VEC,", "Object.assign(window, { setNoteMode, renderNotePreview, openSettings, scheduleTool, addSchedule, saveSchedules, renderSchedules, TOOL_DEFS, flowRecordsLoad, flowDelete, flowHelp, cronLog, SchedBusy, crontabShell, jadeShell, flowShell, tplBlock, tplExec, renderTplSettings, schedKindFill, flowRun, flowRunByName, flowList, flowFind, flowSave, flowValidate, flowTool, flowClean, FlowRuns, FlowTrig, flowsRender, FUI, flowNoteCheck, flowTick, flowsArm, runNodeScript, jadeBridge, decideData, askOnce, runShellLine, kvOp, jvDialog, tplHydrate, tplRender, tplCompile, tplPages, TplState, tplInsertFlow, jvDate, addScheduleKind, runScheduleKind, Sched, schedTick, saveSettings, VEC,")

# ---------- v19: reply bar under Jade's replies: Copy · 👍 · 👎 · Retry ----------
rep("      if (m.trajId) { const w = ai.querySelector('[data-when]'); if (m.dur && w.textContent) w.textContent += ' · ' + fmtDur(m.dur); ai.appendChild(rateBar(m)); }",
    "      if (m.dur) { const w = ai.querySelector('[data-when]'); if (w.textContent && !w.textContent.includes(' · ')) w.textContent += ' · ' + fmtDur(m.dur); }\n      if (replyTurnEnd(msgs, i)) ai.appendChild(replyBar(m));")
rep("      if (lastA) { lastA.dur = Date.now() - runT0; if (tid) { lastA.trajId = tid; ai.appendChild(rateBar(lastA)); } }",
    "      if (lastA) { lastA.dur = Date.now() - runT0; if (tid) lastA.trajId = tid; }\n      if (ai && !ai.querySelector(':scope > .reply-bar')) ai.appendChild(replyBar(lastA || null));")
rep("  running = v; const b = $('#btnSend');", "  running = v; document.body.classList.toggle('jv-running', !!v); const b = $('#btnSend');")
rep('[hidden]{display:none!important}', '[hidden]{display:none!important}\n' + """.reply-bar{align-items:center;flex-wrap:wrap}
.reply-bar [data-ract]{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);opacity:.9;filter:none;min-height:30px}
.reply-bar [data-ract]:hover,.reply-bar [data-ract]:active{color:var(--cy);border-color:var(--line-hot)}
body.jv-running .reply-bar [data-ract="retry"]{display:none}
""")
s = s.replace('/* =====================================================================\n   BOOT', rd('replybar.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("Object.assign(window, { setNoteMode,", "Object.assign(window, { replyBar, replyText, replyRetry, replyRetrySync, setNoteMode,")

# ---------- v20: TensorFlow.js 4.22 for Jade's scripts (embedded, gzip + base64, unpacked on first use) ----------
_tf = open(os.path.join(D, 'vendor', 'tf.min.js'), 'rb').read() + b'\n' + open(os.path.join(D, 'vendor', 'tf-backend-webgpu.min.js'), 'rb').read()   # + the WebGPU backend (2.22)
_tfb = _b64.b64encode(_gz.compress(_tf, 9, mtime=0)).decode()
_i = s.index('<script type="application/octet-stream" id="sqlite-wasm">'); _j = s.index('</script>', _i) + len('</script>')
s = s[:_j] + '\n<script type="application/octet-stream" id="tfjs-src">' + _tfb + '</script>' + s[_j:]
rep(r"jade.shell(cmd) and jade.notify(title, body) call your tools, decisions, model and flows.\n", r"jade.shell(cmd) and jade.notify(title, body) call your tools, decisions, model and flows. TensorFlow.js 4.22 is built in: use tf (or require('@tensorflow/tfjs')) in node for tensors and small models; it runs on WebGPU when the device has it, else WebGL, else the CPU (tf.getBackend() says which); keep a trained model with await model.save('indexeddb://name') and tf.loadLayersModel('indexeddb://name').\n")
rep("Object.assign(window, { replyBar,", "Object.assign(window, { tfjsSource, replyBar,")
# ---------- v21: Discord bot (next to Vector, one shared turn queue) ----------
rep("const activeTools = () => vecFilterTools([", "const activeTools = () => dcFilterTools(vecFilterTools([")
rep("...FLOW_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]);", "...FLOW_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...DC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]));")
rep("try { vecGuard(name); result = await runTool(name, args, card); }", "try { vecGuard(name); dcGuard(name); result = await runTool(name, args, card); }")
rep("    case 'vector': return await vectorTool(args);", "    case 'vector': return await vectorTool(args);\n    case 'discord': return await discordTool(args);")
rep("const systemPrompt = () => { if (vecScope()) return vecScopedPrompt();", "const systemPrompt = () => { if (vecScope()) return vecScopedPrompt(); if (dcScope()) return dcScopedPrompt();")
rep("by their setting)\\n` : ''}", "by their setting)\\n` : ''}${S.dcOn ? `- discord: you are also a bot on Discord${DC.user ? ' (' + DC.user.username + ')' : ''}: message people (DM by user id) or channels, reply, react, send files from the vault, download what people send, read channels, list servers and channels. Use it whenever the user asks you to message, send or share something on Discord.\\n` : ''}")
rep("  const want = apiUp || S.bgMode === 'always' || (S.bgMode !== 'off' && (running || vecOnline));", "  const dcOnline = typeof DC !== 'undefined' && S.dcOn && DC.connected;\n  const want = apiUp || S.bgMode === 'always' || (S.bgMode !== 'off' && (running || vecOnline || dcOnline));")
rep("vecOnline ? 'Jade is online on Vector' :", "vecOnline ? 'Jade is online on Vector' : dcOnline ? 'Jade is online on Discord' :")
rep("!cur || cur.vec) return;", "!cur || cur.vec || cur.dc) return;")
rep("notify_owner: a => (a.urgent ? '⚡ ' : '') + String(a.message || '').slice(0, 60),", "notify_owner: a => (a.urgent ? '⚡ ' : '') + String(a.message || '').slice(0, 60), discord: a => `${a.action || ''}${a.to ? ' → ' + a.to : ''}${a.text ? ' “' + String(a.text).slice(0, 40) + '”' : ''}${a.emoji || ''}`,")
rep("notify_owner: () => 'Passing a message on',", "notify_owner: () => 'Passing a message on', discord: () => `Discord: ${a.action || ''}`,")
rep("  if (cmd === 'context' || cmd === 'ctx') {", "  if (cmd === 'discord') { openSettings(); setTimeout(() => showSettingsSection('#dcSection'), 60); return; }\n  if (cmd === 'context' || cmd === 'ctx') {")
rep("['/vector', 'Vector messenger settings'],", "['/vector', 'Vector messenger settings'], ['/discord', 'Discord bot settings'],")
rep("<b>/vector</b> bot settings ·", "<b>/vector</b> bot settings · <b>/discord</b> Discord bot settings ·")
rep("window.__vecSync?.();", "window.__vecSync?.(); window.__dcSync?.();")
rep("'secrets', 'vecToken', 'aicKey'];", "'secrets', 'vecToken', 'aicKey', 'dcToken'];")
rep("Object.assign(window, { tfjsSource,", "Object.assign(window, { DC, dcInviteUrl, dcConnect, dcStop, dcIncoming, dcPoll, dcCall, dcWake, dcScope, dcFilterTools, discordTool, dcInboxAdd, DC_INBOX, tfjsSource,")
# ---------- v22: embeddings (Ollama) + sqlite-vec + FTS5 hybrid search, the embeddings tool ----------
rep("  { name: 'notes_search', description:", """  { name: 'embeddings', description: 'Semantic search and storage on sqlite-vec, with embeddings from Ollama. Collections: "memory" and "journal" (kept in step automatically), "notes" (the vault, after the index action) and any collection name you choose for your own text. search: the closest texts to a query; mode hybrid (default: meaning + keywords, fused), semantic or keyword; collection limits it (default: all). add: store text (or texts) in a collection of your own so you can find it by meaning later. index: embed the vault\\'s notes (optional path = a folder). remove: delete by id, source or whole collection. compare: cosine similarity of two texts (a, b). status: model, sizes, problems. For facts about the user use the memory tool; use this for research, snippets, documents and anything you want to search by meaning.',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['search', 'add', 'index', 'remove', 'compare', 'status'] }, query: { type: 'string', description: 'search: what to look for' }, text: { type: 'string', description: 'add: the text to store' }, texts: { type: 'array', items: { type: 'string' }, description: 'add: several texts at once' }, collection: { type: 'string', description: 'search/add/remove: collection name (search takes a comma list)' }, source: { type: 'string', description: 'add: where the text came from (a note path, URL …); remove: delete everything from that source' }, head: { type: 'string', description: 'add: a short title for the text' }, k: { type: 'number', description: 'search: results (default 8, max 30)' }, mode: { type: 'string', enum: ['hybrid', 'semantic', 'keyword'] }, id: { type: 'number', description: 'remove: id from a search result' }, path: { type: 'string', description: 'index: only notes under this folder' }, a: { type: 'string', description: 'compare: first text' }, b: { type: 'string', description: 'compare: second text' } }, required: ['action'] } },
  { name: 'notes_search', description:""")
rep("(t.function.name !== 'memory' || S.memoryOn))", "(t.function.name !== 'memory' || S.memoryOn) && (t.function.name !== 'embeddings' || (S.memoryOn && S.embedOn !== false)))")
rep("    case 'memory': return memoryTool(args);", "    case 'memory': return memoryTool(args);\n    case 'embeddings': return await embeddingsTool(args);")
rep("skill: a => a.name || '',", "skill: a => a.name || '', embeddings: a => `${a.action || 'status'}${a.query || a.text ? ' “' + String(a.query || a.text).slice(0, 50) + '”' : ''}${a.collection ? ' in ' + a.collection : ''}`,")
rep("skill: () => `Loading skill: ${short(a.name)}`,", "skill: () => `Loading skill: ${short(a.name)}`, embeddings: () => ({ search: 'Searching by meaning', add: 'Storing for later', index: 'Embedding the vault', remove: 'Removing embeddings', compare: 'Comparing meanings', status: 'Checking embeddings' }[a.action] || 'Embeddings') + (a.query || a.text ? ': ' + short(a.query || a.text, 50) : ''),")
rep("${S.memoryOn ? '- memory: your long-term memory across chats (save / search / forget / list)\\n' : ''}", "${S.memoryOn ? '- memory: your long-term memory across chats (save / search / forget / list; search uses keywords and meaning together)\\n' : ''}${S.memoryOn && S.embedOn !== false ? '- embeddings: search by meaning with sqlite-vec (memory, journal, the vault after index, and collections of your own: search / add / index / remove / compare / status)\\n' : ''}")
rep("  let runError = null, lastContent = '';", "  let runError = null, lastContent = '';\n  await skillPrefetch().catch(() => {});   // pick the skills that fit this message when there are many\n  await memoryPrefetch();                 // rank the memories for this message by keywords + meaning (the prompt builder is synchronous)")
rep("  ensureMemory(); ensureSteering(); ensureHeartbeatFile(); ensureMcpFile();", "  ensureMemory(); ensureSteering(); ensureHeartbeatFile(); ensureMcpFile(); vmemSyncSoon();")
rep("'secrets', 'vecToken', 'aicKey', 'dcToken'];", "'secrets', 'vecToken', 'aicKey', 'dcToken', 'embedKey'];")
rep("'dcToken', 'embedKey'];", "'dcToken', 'embedKey', 'sshHosts'];")
rep("'embedKey', 'sshHosts'];", "'embedKey', 'sshHosts', 'abToken', 'abPass'];")
rep("Object.assign(window, { DC,", "window.__vmem = { sync: vmemSync, rebuild: vmemRebuild, status: vmemStatus, search: vmemSearch, prefetch: memoryPrefetch, reset: () => { vmemCtx = { q: '', hits: null }; } };\nObject.assign(window, { DC,")
# ---------- v23: kiosk mode (Android app: Jade as the home screen of a dedicated device) ----------
rep("""        <p class="hint leading-relaxed" id="bgWeb">""", """        <div id="kioskNative" class="flex flex-col gap-2" hidden>
          <label class="flex items-center gap-2 text-sm" for="sKiosk"><input type="checkbox" id="sKiosk" class="accent-emerald-400 w-4 h-4"> Kiosk mode: Jade is the home screen, full screen and always in front</label>
          <div class="text-sm flex items-center gap-2 flex-wrap" id="kioskStatus"></div>
          <p class="hint leading-relaxed">For a computer or tablet that only runs Jade. She starts when it boots, and this switch is the way out. Without more setup Android pins the screen (hold Back and Overview to unpin). For a full lock, run this once from a computer with USB debugging on: <code>adb shell dpm set-device-owner app.netrunner.vault/app.netrunner.jade.AdminReceiver</code></p>
        </div>
        <p class="hint leading-relaxed" id="bgWeb">""")
rep("function renderBgSettings() {", """function nativeKiosk() { return typeof window.NetrunnerAndroid?.setKiosk === 'function'; }
function renderKiosk() {
  const el = $('#kioskNative'); if (!el) return;
  el.hidden = !nativeKiosk(); if (el.hidden) return;
  let st = {}; try { st = JSON.parse(window.NetrunnerAndroid.kioskStatus()); } catch {}
  $('#sKiosk').checked = !!st.on;
  $('#kioskStatus').innerHTML = !st.on ? '<span class="dot"></span>Off.'
    : st.locked ? '<span class="dot ok"></span>On and locked' + (st.owner ? ' (device owner: full kiosk).' : '.')
    : st.pinned ? '<span class="dot ok"></span>On: the screen is pinned to Jade.'
    : '<span class="dot bad"></span>On, not locked yet. Press Home and pick Jade, then “Always”.';
}
$('#sKiosk').addEventListener('change', e => { try { window.NetrunnerAndroid.setKiosk(e.target.checked); } catch {} setTimeout(renderKiosk, 800); });
function renderBgSettings() {
  renderKiosk();""")
# ---------- v24: senses, look, LiteRT, hands-free voice ----------
s = s.replace('/* =====================================================================\n   BOOT', rd('world.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("...DC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]));", "...DC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...WORLD_TOOL_DEFS.filter(t => S.sensesOn !== false || t.name === 'look' || t.name === 'litert').map(f => ({ type: 'function', function: f })), ...mcpToolDefs()]));")
rep("    case 'discord': return await discordTool(args);", "    case 'discord': return await discordTool(args);\n    case 'senses': case 'look': case 'litert': return await worldTool(name, args);")
rep(r"${S.dcOn ? `- discord: you are also a bot on Discord", r"${S.sensesOn !== false ? '- senses: your senses (camera photo/video, microphone, GPS, every phone sensor incl. accelerometer, gyroscope, magnetic field/EMF, light, battery, Wi-Fi signal, device facts, and the flashlight and vibration motor: senses torch / vibrate); look: open an image or video from the vault and see it; litert: run .tflite models. Build tools, skills and flows on top of them (jade.tool(\'senses\', {...}) from scripts)\\n' : ''}${S.dcOn ? `- discord: you are also a bot on Discord")
rep("saveSession(); TR.tool(name, result, isErr);", "saveSession(); TR.tool(name, result, isErr);\n        if (tc === asst.tool_calls[asst.tool_calls.length - 1]) { const lv = worldFlushViews(); if (lv) { cur.messages.push(lv); chatEl.appendChild(userBlock(lv.display, cur.messages.length - 1)); scrollDown(); saveSession(); } }")
rep("const DEFAULTS = { tplOn: true,", "const DEFAULTS = { sensesOn: true, voiceLang: '', sttOffline: false, visProv: '', visModel: '', sttProv: '', sttModel: '', vadMs: 900, tplOn: true,")
rep("  Object.assign(S, { jadeShow: $('#sJadeShow').checked,", "  Object.assign(S, { sensesOn: $('#sSensesOn').checked, voiceLang: $('#sVoiceLang').value.trim(), sttOffline: $('#sSttOffline').checked }, worldReadSettings());\n  Object.assign(S, { jadeShow: $('#sJadeShow').checked,")
rep("  $('#sCompactAuto').checked = !!S.compactAuto;", "  $('#sSensesOn').checked = S.sensesOn !== false; $('#sVoiceLang').value = S.voiceLang || ''; $('#sSttOffline').checked = !!S.sttOffline; worldFillSettings();\n  $('#sCompactAuto').checked = !!S.compactAuto;")
rep("      let apiMsgs = buildApiMessages(); const toolsNow = routeTools(activeTools());", "      await visionPrepass();\n      let apiMsgs = buildApiMessages(); const toolsNow = routeTools(activeTools());")
rep("    if (m.images?.length && !cur._noImages) o.images = m.images;", "    if (m.images?.length && !cur._noImages) { if (visionOn() && m._vdesc) o.content = (o.content ? o.content + '\\n\\n' : '') + visionNote(m); else o.images = m.images; }")

# ---------- v25: the vault lives on real storage (Android app) ----------
rep_between("class VFS {", "const vfs = new VFS();", rd('vfs_disk.js').split('class VFS {', 1)[0].split('   VIRTUAL FILESYSTEM', 1)[1].split('*/', 1)[1].lstrip('\n') + 'class VFS {' + rd('vfs_disk.js').split('class VFS {', 1)[1] + '\n')
s = s.replace('/* =====================================================================\n   BOOT', rd('vfs_disk_ui.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("window.__trajSync?.(); window.__vecSync?.(); window.__dcSync?.();", "window.__trajSync?.(); window.__vecSync?.(); window.__dcSync?.(); window.__diskSync?.();")
# sizes without reading the file
rep("const entriesForBb = () => vfs.entries().map(([p, n]) => [p, n.dir ? { dir: true } : { data: n.data }]);", "const BB_MAX = 16e6;   // bigger files stay on disk and are not copied into the shell\n// A file the vault lists but storage cannot read (removed or renamed by another app, a case-only rename) is left out\n// of the run and marked, so the run cannot delete it and the command still works; a rescan then drops it if it is gone.\nconst entriesForBb = () => {\n  const out = []; let bad = 0;\n  for (const [p, n] of vfs.entries()) {\n    if (n.dir) { out.push([p, { dir: true }]); continue; }\n    if (vfs.diskOn && fsize(n) > BB_MAX) continue;\n    let d; try { d = n.data; if (n._unread) n._unread = false; } catch (e) { n._unread = true; bad++; console.warn('shell: skipped unreadable file', p, e.message); continue; }\n    out.push([p, { data: d }]);\n  }\n  if (bad) setTimeout(() => { try { vfs.rescan?.(true); } catch {} }, 0);\n  return out;\n};")
rep("      else { const s = old && !old.dir && same(old.data, n.data); if (!s) changed = true; next.set(p, s ? old : { data: n.data, mtime: Date.now() }); }\n    }\n    if (changed || next.size !== vfs.nodes.size) vfs.replace([...next.entries()]);",
    "      else { const s = old && !old.dir && fsize(old) === n.data.length && same(old.data, n.data); if (!s) changed = true; next.set(p, s ? old : { data: n.data, mtime: Date.now() }); }\n    }\n    for (const [p, o] of vfs.nodes) if (!o.dir && (o._unread || (vfs.diskOn && fsize(o) > BB_MAX)) && !next.has(p)) next.set(p, o);\n    if (changed || next.size !== vfs.nodes.size) vfs.replace([...next.entries()]);")
rep("    if (n.dir) { if (!cur) { vfs.nodes.set(p, { dir: true, mtime: Date.now() }); changed = true; } continue; }\n    if (b && !b.dir && same(b.data, n.data)) continue;               // the command did not touch it: keep what is there now\n    if (cur && !cur.dir && same(cur.data, n.data)) continue;\n    vfs.nodes.set(p, { data: n.data, mtime: Date.now() }); changed = true;",
    "    if (n.dir) { if (!cur) { vfs.mkdirp(p); changed = true; } continue; }\n    if (b && !b.dir && fsize(b) === n.data.length && same(b.data, n.data)) continue;               // the command did not touch it: keep what is there now\n    if (cur && !cur.dir && fsize(cur) === n.data.length && same(cur.data, n.data)) continue;\n    vfs.write(p, n.data, { mkdirs: true }); changed = true;")
rep("for (const [p, b] of base) if (p !== '/' && !seen.has(p) && vfs.nodes.get(p) === b) { vfs.nodes.delete(p); changed = true; }", "for (const [p, b] of base) if (p !== '/' && !seen.has(p) && vfs.nodes.get(p) === b && !b._unread && !(vfs.diskOn && !b.dir && fsize(b) > BB_MAX)) { if (vfs.exists(p)) vfs.rm(p, true); changed = true; }")
rep("if (vfs.isFile(p)) vfs.nodes.get(p).mtime = Date.now(), vfs.changed(); else vfs.write(p, '');", "if (vfs.isFile(p)) vfs.touch(p); else vfs.write(p, '');")
# do not read every file just to learn how big it is
rep("else if (isSqliteBytes(n.data)) { bins[p] = n.data; files[p] = n.data; } else if (n.data.length < 2e6) files[p] = dec.decode(n.data); }", "else if (fsize(n) >= 2e6 && !(fsize(n) < 4e7 && /\\.(db|sqlite3?)$/i.test(p))) continue; else if (isSqliteBytes(n.data)) { bins[p] = n.data; files[p] = n.data; } else if (fsize(n) < 2e6) files[p] = dec.decode(n.data); }")
rep("[...vfs.nodes].some(([p, n]) => !n.dir && /\\.[cm]?js$/.test(p) && n.data.length < 2e6 && /sqlite/i.test(dec.decode(n.data))));", "[...vfs.nodes].some(([p, n]) => !n.dir && /\\.[cm]?js$/.test(p) && fsize(n) < 2e6 && /sqlite/i.test(dec.decode(n.data))));")
rep("    if (isSqliteBytes(n.data)) files[p] = n.data; else if (n.data.length < 2e6) files[p] = dec.decode(n.data);", "    if (fsize(n) >= 2e6 && !(fsize(n) < 4e7 && /\\.(db|sqlite3?)$/i.test(p))) continue;\n    if (isSqliteBytes(n.data)) files[p] = n.data; else if (fsize(n) < 2e6) files[p] = dec.decode(n.data);")
rep("else if (n.data.length < 4e6) files[p] = n.data; }\n", "else if (fsize(n) < 4e6) files[p] = n.data; }\n")
rep("!n.dir && p.endsWith('.py') && n.data.length < 2e6 &&", "!n.dir && p.endsWith('.py') && fsize(n) < 2e6 &&")
# a file the vault lists but storage cannot read must not break node, python or a backup: skip it
rep("function vfsChangesSince(before) {", "function nodeBytes(n) { try { return n.data; } catch (e) { console.warn('vault: unreadable file', n && n.p, e.message); return null; } }\nfunction vfsChangesSince(before) {")
rep("for (const [p, n] of vfs.nodes) { if (n.dir) dirs.push(p); else if (fsize(n) < 4e6) files[p] = n.data; }", "for (const [p, n] of vfs.nodes) { if (n.dir) dirs.push(p); else if (fsize(n) < 4e6) { const d = nodeBytes(n); if (d) files[p] = d; } }")
rep("[...vfs.nodes].some(([p, n]) => !n.dir && p.endsWith('.py') && fsize(n) < 2e6 && /sqlite/i.test(dec.decode(n.data)))", "[...vfs.nodes].some(([p, n]) => !n.dir && p.endsWith('.py') && fsize(n) < 2e6 && /sqlite/i.test(dec.decode(nodeBytes(n) || new Uint8Array())))")
rep("[...vfs.nodes].some(([p, n]) => !n.dir && /\\.[cm]?js$/.test(p) && fsize(n) < 2e6 && /sqlite/i.test(dec.decode(n.data)))", "[...vfs.nodes].some(([p, n]) => !n.dir && /\\.[cm]?js$/.test(p) && fsize(n) < 2e6 && /sqlite/i.test(dec.decode(nodeBytes(n) || new Uint8Array())))")
rep("else if (isSqliteBytes(n.data)) { bins[p] = n.data; files[p] = n.data; } else if (fsize(n) < 2e6) files[p] = dec.decode(n.data); }", "else { const d = nodeBytes(n); if (!d) continue; if (isSqliteBytes(d)) { bins[p] = d; files[p] = d; } else if (fsize(n) < 2e6) files[p] = dec.decode(d); } }")
rep("    files[p] = isText(n.data) ? dec.decode(n.data) : { base64: b64enc(n.data) };", "    const d = nodeBytes(n); if (!d) continue;\n    files[p] = isText(d) ? dec.decode(d) : { base64: b64enc(d) };")
rep("return { path: full, bytes: vfs.nodes.get(full)?.data.length || 0 };", "return { path: full, bytes: fsize(vfs.nodes.get(full) || { dir: true }) };")
rep("const st = vfs.stat?.(p)?.size ?? vfs.nodes.get(p)?.data?.length ?? 0;", "const st = vfs.stat?.(p)?.size ?? 0;")
# backups and restores
rep("""    await dbRestore({ ...(data.db || {}), vfs: entries, pendingSettings: next }, true);   // settings ride along in IndexedDB (durable before reload)""",
    """    if (vfs.diskOn) { vfs.replace(entries, true); if (!vfs.flush(true)) throw new Error('could not write the restored vault to storage'); await dbRestore({ ...(data.db || {}), pendingSettings: next }, true); }
    else await dbRestore({ ...(data.db || {}), vfs: entries, pendingSettings: next }, true);   // settings ride along in IndexedDB (durable before reload)""")
rep("await dbRestore({ vfs: [...vfs.nodes.entries()], pendingSettings: next }, false);", "if (vfs.diskOn) { vfs.flush(true); await dbRestore({ pendingSettings: next }, false); } else await dbRestore({ vfs: [...vfs.nodes.entries()], pendingSettings: next }, false);")

# ---------- v25b: browser tool ----------
s = s.replace('/* =====================================================================\n   BOOT', rd('browser_agent.js') + '\n' + rd('browser_tool.js') + '\n' + rd('phone_tool.js') + '\n' + rd('screen_tool.js') + '\n' + rd('sentry_tool.js') + '\n' + rd('ssh_tool.js') + '\n' + rd('think_tool.js') + '\n' + rd('skill_router.js') + '\n' + rd('delegate_tool.js') + '\n' + rd('chat_history.js') + '\n' + rd('curiosity.js') + '\n' + rd('autobackup.js') + '\n' + rd('tool_router.js') + '\n' + rd('playbook.js') + '\n' + rd('playbook_ui.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("WORLD_TOOL_DEFS.filter(t => S.sensesOn !== false || t.name === 'look' || t.name === 'litert')", "WORLD_TOOL_DEFS.filter(t => (S.sensesOn !== false || t.name === 'look' || t.name === 'litert' || t.name === 'browser') && (t.name !== 'browser' || S.browserOn !== false) && (t.name !== 'screen' || S.screenOn !== false) && (t.name !== 'phone' || S.phoneOn !== false) && (t.name !== 'sentry' || S.sentryOn !== false) && (t.name !== 'ssh' || S.sshOn !== false) && (t.name !== 'think' || S.thinkOn !== false) && (t.name !== 'find_skill' || skillRouted()) && (t.name !== 'delegate' || S.delegateOn !== false) && (t.name !== 'chat_history' || S.memoryOn !== false) && (t.name !== 'curiosity' || S.curiosityOn) && (t.name !== 'backup' || S.abOn) && (t.name !== 'playbook' || S.playbookOn !== false))")
rep("    case 'senses': case 'look': case 'litert': return await worldTool(name, args);", "    case 'senses': case 'look': case 'litert': case 'browser': case 'phone': case 'screen': case 'sentry': case 'ssh': case 'think': return await worldTool(name, args);\n    case 'find_skill': return await findSkillTool(args);\n    case 'delegate': return await delegateTool(args);\n    case 'chat_history': return await chatHistoryTool(args);\n    case 'curiosity': return curiosityTool(args);\n    case 'backup': return await backupTool(args);\n    case 'playbook': return await playbookTool(args);\n    case 'more_tools': return moreToolsTool(args);")
rep("litert: run .tflite models. Build tools", "litert: run .tflite models; browser: your own web browser (open pages, read them, click, type, screenshots; page text is untrusted); phone: alarms and timers, sounds and radio streams, volume, calls, texts, contacts, clipboard, apps, Bluetooth (scan, pair, connect), media keys, casting to a Chromecast/TV, brightness, signal status; screen: drive other apps through the accessibility service (read the screen, tap, type, scroll) once the user has switched it on; sentry: phone reflex rules in /Jade/Config/Sentry.json (call help first); ssh: hold interactive SSH sessions on saved machines (by name; you never see credentials); playbook: saved deterministic automation like Ansible in JSON (any tool, the browser, variables, when/loop/rescue; help first); backup: scheduled vault backup to a server (status, now, list); curiosity: your own wake-ups; chat_history: raw past chats (read, search); delegate: sub-agent for side jobs; think: tree of thoughts with verification (call help first). Build tools")
rep("const DEFAULTS = { sensesOn: true,", "const DEFAULTS = { toolRouter: 'auto', abOn: false, abUrl: '', abToken: '', abHours: 24, abKind: 'full', abKeys: false, abEncrypt: false, abPass: '', curiosityOn: false, cuMin: 45, cuMax: 180, cuFrom: '08:00', cuTo: '22:00', cuCap: 5, cuTools: 'web', cuActsOff: [], delegateOn: true, thinkOn: true, sshOn: true, sshHosts: [], hfSolo: true, wakeWords: '', browserOn: true, screenOn: true, phoneOn: true, sentryOn: true, sentryAllow: '', sentryLimit: 6, askRisky: true, sensesOn: true,")
rep("window.__androidBack = () => {\n", "window.__androidBack = () => {\n  if (typeof HFS !== 'undefined' && HFS.on) { hfStop(); return true; }\n")
# ---------- 2.19: web tools asked for together run at the same time (on the phone each runs on its own native connection) ----------
rep("""      for (const tc of asst.tool_calls) {
        if (abortReq) break;
""", """      if (!abortReq && asst.tool_calls.length > 1 && asst.tool_calls.every(tc => PARALLEL_TOOLS.has(tc.function.name))) {
        setState(`TOOLS ▸ ${asst.tool_calls.length} AT ONCE`); jadeMood('working'); jadeBubble(toolCaption(asst.tool_calls[0].function.name, asst.tool_calls[0].function.arguments || {}));
        const cards = asst.tool_calls.map(tc => { const c = toolCard(tc.function.name, tc.function.arguments || {}); body.appendChild(c.el); return c; }); scrollDown();
        const res = await Promise.all(asst.tool_calls.map(async (tc, i) => { const name = tc.function.name; try { vecGuard(name); dcGuard(name); return [await runTool(name, tc.function.arguments || {}, cards[i]), false]; } catch (e) { return ['Error: ' + (e.message || e), true]; } }));
        asst.tool_calls.forEach((tc, i) => {
          const [result, isErr] = res[i]; if (isErr || cards[i].el.classList.contains('err')) jadeMood('error', 1800, 'working');
          cards[i].done(result, isErr);
          cur.messages.push({ role: 'tool', tool_name: tc.function.name, content: String(result), _for: tc._id, _err: isErr || undefined, ts: Date.now() }); TR.tool(tc.function.name, result, isErr);
        });
        saveSession(); scrollDown();
        const lv = worldFlushViews(); if (lv) { cur.messages.push(lv); chatEl.appendChild(userBlock(lv.display, cur.messages.length - 1)); scrollDown(); saveSession(); }
        continue;
      }
      for (const tc of asst.tool_calls) {
        if (abortReq) break;
""")
rep("async function agentLoop() {", "const PARALLEL_TOOLS = new Set(['web_search', 'web_fetch']);   // read-only network tools: safe to run together\nasync function agentLoop() {")
# on the phone the app reaches Ollama natively (no CORS), so OLLAMA_ORIGINS is not the fix there
rep("""hint = activeProv === 'local' ? `Could not reach Ollama at ${S.host}. Make sure it is running with OLLAMA_ORIGINS="*" so this page is allowed to call it${providerChain().length > 1 ? '' : ', or add fallback providers in Config'}.` :""", """hint = activeProv === 'local' ? (RustCore.net ? `Could not reach Ollama at ${S.host}. Make sure it is running and reachable from the phone (on a computer, start it with OLLAMA_HOST=0.0.0.0 and use the computer's address)${providerChain().length > 1 ? '' : ', or add fallback providers in Config'}.` : `Could not reach Ollama at ${S.host}. Make sure it is running with OLLAMA_ORIGINS="*" so this page is allowed to call it${providerChain().length > 1 ? '' : ', or add fallback providers in Config'}.`) :""")
# ---------- 2.22: ONNX Runtime (onnx tool) next to LiteRT ----------
rep("|| t.name === 'litert' || t.name === 'browser')", "|| t.name === 'litert' || t.name === 'onnx' || t.name === 'browser')")
rep("    case 'senses': case 'look': case 'litert': case 'browser':", "    case 'senses': case 'look': case 'litert': case 'onnx': case 'browser':")
rep("litert: run .tflite models;", "litert: run .tflite models; onnx: run .onnx models with ONNX Runtime (WebGPU, or the CPU);")
rep("  litert: 'tflite model", "  onnx: 'onnx model inference run classify detect tensor embedding network onnxruntime',\n  litert: 'tflite model")
# ---------- 2.22: USB (navigator.usb on Android, WebUSB in browsers) and the usb tool ----------
s = s.replace('/* =====================================================================\n   BOOT', rd('usb.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("...DC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...WORLD_TOOL_DEFS", "...DC_TOOL_DEFS.map(f => ({ type: 'function', function: f })), ...USB_TOOL_DEFS.filter(() => S.usbOn !== false).map(f => ({ type: 'function', function: f })), ...WORLD_TOOL_DEFS")
rep("    case 'senses': case 'look': case 'litert': case 'onnx': case 'browser':", "    case 'usb': return await usbTool(args);\n    case 'senses': case 'look': case 'litert': case 'onnx': case 'browser':")
rep("onnx: run .onnx models with ONNX Runtime (WebGPU, or the CPU);", "onnx: run .onnx models with ONNX Runtime (WebGPU, or the CPU); usb: USB devices plugged into the phone (OTG) or the computer: list, ask the user to allow one, open, claim, control and bulk transfers;")
rep("  onnx: 'onnx model", "  usb: 'usb device otg plugged arduino microcontroller serial adapter dongle port firmware endpoint',\n  onnx: 'onnx model")
# ---------- 2.23: the model router (laya picks the model for each main-chat turn) ----------
rep("""ollama pull</span> and leave the address blank to use the Ollama address above. Both accept requests from localhost and local files by default; for the hosted page, start them with <span class="text-yl">OLLAYA_ORIGINS="*"</span> or <span class="text-yl">OLLAMA_ORIGINS="*"</span>.</p>
      </section>""", """ollama pull</span> and leave the address blank to use the Ollama address above. Both accept requests from localhost and local files by default; for the hosted page, start them with <span class="text-yl">OLLAYA_ORIGINS="*"</span> or <span class="text-yl">OLLAMA_ORIGINS="*"</span>.</p>
        <div class="pane-h" id="routerSection">Model router</div>
        <p class="text-sm leading-relaxed text-[#c2d6ce]">Before each message you send, the decision model reads it and picks which of these models answers: a quick one for everyday chat, a strong one only when the message needs it. It uses the server and address above (laya through Ollaya, Ollama 0.35+ or the fleet broker), even when the decide tool is off. If it can't decide, or the model it picks can't be reached, the main model answers.</p>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <label class="flex items-center gap-2 text-sm" for="sRouterOn"><input type="checkbox" id="sRouterOn" class="accent-emerald-400 w-4 h-4"> Let the decision model pick the model for each message</label>
          <div><label class="lbl" for="sRouterDecider">Routing decision model</label><input id="sRouterDecider" class="field mt-1" placeholder="laya"></div>
          <div><label class="lbl" for="sRouterMin">Main model when less sure than (0–1)</label><input id="sRouterMin" type="number" min="0" max="1" step="0.05" class="field mt-1" placeholder="0"></div>
        </div>
        <div><label class="lbl" for="sRouterModels">Models, one per line: provider | model | what it is good at</label><textarea id="sRouterModels" rows="4" class="field mt-1 mono" placeholder="local | qwen3:8b | quick everyday chat, short answers, simple lookups&#10;groq | openai/gpt-oss-120b | coding, long documents, hard multi-step reasoning"></textarea>
        <p class="hint">Providers: local (Ollama), cloud (Ollama Cloud), groq, llamacpp, openai (the OpenAI-compatible endpoint), aicord, each with its key and address from Model provider. Leave the provider out to use the main one.</p></div>
        <div class="flex gap-2 items-center flex-wrap"><input id="sRouterTry" class="field" style="flex:1;min-width:200px" placeholder="A message to try (empty: a coding question)"><button class="btn btn-cy" id="btnRouterTest">Test routing</button><span class="hint" id="routerNote"></span></div>
      </section>""")
s = s.replace('/* =====================================================================\n   BOOT', rd('model_router.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("function openSettings() {", "function openSettings() { try { routerFill(); } catch {}")
rep("async function agentLoop() {\n  const triedProv = new Set();", "async function agentLoop(opts = {}) {\n  const triedProv = new Set();")
rep("  const ai = aiBlock(); ai.querySelector('[data-model]').textContent = S.model; chatEl.appendChild(ai); const body = ai.querySelector('[data-body]');",
    "  const RT = opts.route ? await routeTurn() : null; let runModel = RT && !RT.error ? RT.model : S.model, runClient = RT && !RT.error ? RT.client : null;\n  const ai = aiBlock(); ai.querySelector('[data-model]').textContent = runModel; chatEl.appendChild(ai); const body = ai.querySelector('[data-body]'); if (RT) body.appendChild(routerTag(RT));")
rep("const req = { model: S.model, messages: apiMsgs, tools: toolsNow, stream: true,", "const req = { model: runModel, messages: apiMsgs, tools: toolsNow, stream: true,")
rep("        currentIter = await client.chat(req);", "        currentIter = await (runClient || client).chat(req);")
rep("        const msg = String(e.message || e);\n        if (isCtxError(msg) && ctxRetry < 3) {",
    "        const msg = String(e.message || e);\n        if (runModel !== S.model || runClient) { thinkD.remove(); textEl.remove(); toast(`${esc(runModel)} (picked by the router) failed: ${esc(msg.slice(0, 120))}. Using ${esc(S.model)}.`); runModel = S.model; runClient = null; ai.querySelector('[data-model]').textContent = S.model; turns--; continue; }\n        if (isCtxError(msg) && ctxRetry < 3) {")
rep("const asst = { role: 'assistant', content, model: S.model, ts: Date.now() };", "const asst = { role: 'assistant', content, model: runModel, ts: Date.now() };")
rep("  await agentLoop();\n  if (queue.length) { const next = queue.splice(0).join('\\n\\n'); updateQueueNote(); await send(next); }", "  await agentLoop({ route: true });\n  if (queue.length) { const next = queue.splice(0).join('\\n\\n'); updateQueueNote(); await send(next); }")
# the xterm instance itself, for the Fleet client's real terminal and for reading the whole scrollback
rep('return { write: s => t.write(s), clear: () => t.clear(), onData: f => t.onData(f), fit: doFit, focus: () => t.focus() };', 'return { write: s => t.write(s), clear: () => t.clear(), onData: f => t.onData(f), fit: doFit, focus: () => t.focus(), _t: t };')
# ================= v2.24: Vault Loci, a built-in webxdc map of the vault, and the vault_map tool so Jade can walk it =================
s = s.replace('/* =====================================================================\n   BOOT', rd('vault_map.js') + '\n/* =====================================================================\n   BOOT', 1)
_vl = _b64.b64encode(open(os.path.join(DIST, 'vault-loci.xdc'), 'rb').read()).decode()
_i = s.index('<script type="application/octet-stream" id="xdc-jadelink">'); _j = s.index('</script>', _i) + len('</script>')
s = s[:_j] + '\n<script type="application/octet-stream" id="xdc-vaultloci">' + _vl + '</script>' + s[_j:]
rep("    case 'more_tools': return moreToolsTool(args);", "    case 'more_tools': return moreToolsTool(args);\n    case 'vault_map': return await vaultMapTool(args);")
# ================= v2.25: the knowledge graph (Rust reasoner as WebAssembly), the knowledge tool and the Knowledge screen =================
s = s.replace('/* =====================================================================\n   BOOT', rd('knowledge.js') + '\n/* =====================================================================\n   BOOT', 1)
_kg = _b64.b64encode(_gz.compress(open(os.path.join(D, 'vendor', 'jade_kg.wasm'), 'rb').read(), 9, mtime=0)).decode()
s = s.replace('<script type="application/octet-stream" id="jade-core-wasm">', '<script type="application/octet-stream" id="jade-kg-wasm">' + _kg + '</script>\n<script type="application/octet-stream" id="jade-core-wasm">', 1)
rep("    case 'more_tools': return moreToolsTool(args);", "    case 'more_tools': return moreToolsTool(args);\n    case 'knowledge': return await knowledgeTool(args);")
rep("think: tree of thoughts with verification (call help first). Build tools", "think: tree of thoughts with verification (call help first); knowledge: the knowledge graph (facts, rules, constraints) and a reasoner that proves answers: verify claims, query, check for contradictions' + kgPromptExtra() + '. Build tools")
rep("const navFor = { file: 'files', graph: 'files' }[name] || name;", "const navFor = { file: 'files', graph: 'files', kg: 'files' }[name] || name;")
rep('<button class="btn btn-ghost" id="btnGraph" title="Graph view">Graph</button>', '<button class="btn btn-ghost" id="btnGraph" title="Graph view">Graph</button>\n        <button class="btn btn-ghost kg-btn" id="btnKnowledge" title="Knowledge graph: facts, rules, verification">Knowledge<span class="badge" id="kgBadge" hidden>0</span></button>')
rep("    <!-- GRAPH -->", """    <!-- KNOWLEDGE -->
    <section class="m-screen" data-panel="kg" hidden>
      <div class="m-sub">
        <button class="icon-btn" id="btnKgBack" aria-label="Back" style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="disp text-yl font-bold text-[14px] truncate flex-1 min-w-0">Knowledge</span>
        <label class="kg-chk" title="Jade checks her factual claims against the graph and marks them"><input type="checkbox" id="kgVerify"> Verify answers</label>
      </div>
      <div class="kg-views" id="kgViews" role="tablist"><button role="tab" data-v="ask">Ask</button><button role="tab" data-v="facts">Facts</button><button role="tab" data-v="rules">Rules</button><button role="tab" data-v="check">Check</button><button role="tab" data-v="graph">Graph</button></div>
      <div class="kg-body" id="kgPanel"></div>
    </section>

    <!-- GRAPH -->""")
rep('[hidden]{display:none!important}', '[hidden]{display:none!important}\n' + """.kg-btn{position:relative}.kg-btn .badge{position:absolute;top:-6px;right:-6px}
.kg-views{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--line);overflow-x:auto}
.kg-views button{flex:1;min-height:36px;padding:0 10px;background:none;border:1px solid var(--line);color:var(--dim);font-family:var(--f-disp);letter-spacing:.06em;font-size:12px;cursor:pointer;white-space:nowrap}
.kg-views button[aria-selected=true]{border-color:var(--line-hot);color:var(--fg);background:rgba(31,229,165,.12)}
.kg-body{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.kg-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.kg-row .field{min-width:0}
.kg-help{font-size:12px;color:var(--dim);margin:0;line-height:1.5}.kg-help code,.kg-ft code{font-family:var(--f-mono,monospace)}
.kg-help.ok{color:#1fe5a5}.kg-help.bad{color:#ff6b7a}
.kg-out{margin:0;padding:10px;border:1px solid var(--line);background:rgba(5,10,8,.7);white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.5;min-height:48px;user-select:text}
.kg-out.ok{border-color:rgba(31,229,165,.6)}.kg-out.bad{border-color:rgba(255,61,79,.7)}.kg-out.unk{border-color:rgba(255,200,80,.6)}
.kg-prop{padding:8px 10px;border:1px dashed rgba(255,200,80,.6);font-size:13px}
.kg-list{display:flex;flex-direction:column}
.kg-fact{padding:8px 4px;border-bottom:1px solid var(--line)}
.kg-ft{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:13px;word-break:break-word}
.kg-st{font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border:1px solid var(--line);white-space:nowrap}
.kg-st.confirmed{color:#1fe5a5;border-color:rgba(31,229,165,.5)}.kg-st.proposed{color:#ffc850;border-color:rgba(255,200,80,.5)}.kg-st.rejected{color:var(--dim)}
.kg-src{font-size:11px;color:var(--dim);margin-top:2px}
.kg-acts{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}.kg-acts .btn{min-height:32px;padding:0 10px;font-size:12px}
.kg-rules{min-height:300px;font-size:12.5px;line-height:1.5;width:100%}
.kg-chk{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim);cursor:pointer}
.kg-cv{flex:1;min-height:360px;width:100%;touch-action:none;border:1px solid var(--line)}""")
# ================= v2.26: autonomy (3-tier scheduler + autonomous mode), Plans (Gantt) and Jade Lisp =================
_lisp_root = os.path.join(D, 'vault', 'lisp'); _lisp = {}
for _dp, _dn, _fn in os.walk(_lisp_root):
    for _f in sorted(_fn): _full = os.path.join(_dp, _f); _lisp['/Jade/' + os.path.relpath(_full, _lisp_root).replace(os.sep, '/')] = open(_full).read()
_lisp_js = 'const LISP_SEED = ' + _json.dumps(_lisp, ensure_ascii=False).replace('</', '<\\/') + ';\n'
s = s.replace('/* =====================================================================\n   BOOT', _lisp_js + rd('lisp_tool.js') + '\n' + rd('gantt.js') + '\n' + rd('sched.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("    case 'knowledge': return await knowledgeTool(args);", "    case 'knowledge': return await knowledgeTool(args);\n    case 'lisp': return await lispTool(args);\n    case 'gantt': return await ganttTool(args, 'jade');\n    case 'sched': return await schedTool(args);")
rep("' + kgPromptExtra() + '. Build tools", "' + kgPromptExtra() + '; lisp: Jade Lisp, your own Lisp for DSLs and scripts that call any tool; sched: your 3-tier scheduler for autonomous work (goals worked on in slices); gantt: long-term project plans (Gantt charts). Build tools")
rep("const navFor = { file: 'files', graph: 'files', kg: 'files' }[name] || name;", "const navFor = { file: 'files', graph: 'files', kg: 'files', gantt: 'sched', auto: 'sched' }[name] || name;")
rep('<div class="pane-h">Schedules</div><button class="btn btn-solid cut cut-sm" id="btnSchedNew">+ New</button></div>', '<div class="pane-h">Schedules</div><div class="flex items-center gap-2"><button class="btn" id="btnPlans" title="Plans: Gantt charts for long-term projects">Plans</button><button class="btn" id="btnQueue" title="Queue: the scheduler and autonomous mode">Queue</button><button class="btn btn-solid cut cut-sm" id="btnSchedNew">+ New</button></div></div>')
rep("    <!-- KNOWLEDGE -->", """    <!-- PLANS (Gantt) -->
    <section class="m-screen" data-panel="gantt" hidden>
      <div class="m-sub">
        <button class="icon-btn" id="btnGanttBack" aria-label="Back" style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <select class="field g-proj" id="ganttProj" aria-label="Project"></select>
        <button class="btn" id="btnGanttNew" title="New project">+ Project</button>
        <button class="btn" id="btnGanttPlan" title="Push tasks after their dependencies">Plan</button>
      </div>
      <div class="kg-views" id="ganttZoom" role="tablist"><button role="tab" data-z="day">Days</button><button role="tab" data-z="week">Weeks</button><button role="tab" data-z="month">Months</button></div>
      <div class="kg-body" id="ganttBody"></div>
    </section>

    <!-- QUEUE (scheduler + autonomous mode) -->
    <section class="m-screen" data-panel="auto" hidden>
      <div class="m-sub">
        <button class="icon-btn" id="btnAutoBack" aria-label="Back" style="width:38px;height:38px"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="disp text-yl font-bold text-[14px] truncate flex-1 min-w-0">Queue</span>
        <label class="kg-chk" title="Jade works through the queue on her own, within your limits"><input type="checkbox" id="autoOn"> Autonomous</label>
        <button class="btn" id="btnAutoStop" title="Stop now and turn autonomous mode off">Stop</button>
      </div>
      <div class="kg-body" id="autoBody"></div>
    </section>

    <!-- KNOWLEDGE -->""")
rep('[hidden]{display:none!important}', '[hidden]{display:none!important}\n' + """[data-panel="files"]>.m-sub{overflow-x:auto;scrollbar-width:none}[data-panel="files"]>.m-sub::-webkit-scrollbar{display:none}[data-panel="files"]>.m-sub>*{flex-shrink:0}[data-panel="files"]>.m-sub>.pane-h{flex:0 0 auto;overflow:visible}@media (max-width:440px){[data-panel="files"]>.m-sub>.pane-h{display:none}}\n.m-sub .pane-h{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#schedPanel>div:first-child{flex-wrap:wrap}\n.g-proj{flex:1;min-width:0}
.g-sum{font-size:12px;color:var(--dim)}
.g-wrap{flex:none;overflow-x:auto;overflow-y:hidden;border:1px solid var(--line);background:rgba(5,10,8,.6);-webkit-overflow-scrolling:touch}
#ganttSvg{display:block;touch-action:pan-y;user-select:none}
.g-grid{stroke:var(--line);stroke-width:1}.g-wkend{fill:rgba(255,255,255,.025)}
.g-head{fill:var(--dim);font-size:10px;font-family:var(--f-mono,monospace)}.g-mon{fill:var(--fg)}
.g-today{stroke:#ffc850;stroke-width:1.5;stroke-dasharray:4 3}.g-todayt{fill:#ffc850}
.g-bar{fill:rgba(31,229,165,.25);stroke:rgba(31,229,165,.7);stroke-width:1;cursor:grab}
.g-bar.done{fill:rgba(31,229,165,.12);stroke:rgba(31,229,165,.35)}.g-bar.blocked,.g-bar.waiting{fill:rgba(255,200,80,.18);stroke:rgba(255,200,80,.7)}
.g-bar.late{fill:rgba(255,61,79,.2);stroke:rgba(255,61,79,.85)}.g-bar.planned{fill:rgba(120,160,150,.15);stroke:rgba(120,160,150,.6)}
.g-bar.user{stroke-dasharray:3 2}.g-bar.crit{stroke-width:2.2}.g-bar.sel{stroke:#fff;stroke-width:2}
.g-prog{fill:rgba(31,229,165,.55)}.g-ms{cursor:grab}
.g-lab{fill:var(--fg);font-size:11px;pointer-events:none}
.g-link{fill:none;stroke:rgba(180,200,195,.5);stroke-width:1.2}.g-link.crit{stroke:rgba(255,200,80,.85)}.g-arrowhead{fill:rgba(180,200,195,.7)}
.g-form{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--line)}
.g-l{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--dim);flex:1;min-width:110px}
.aq-status{padding:10px;border:1px solid var(--line);font-size:13px}.aq-status.on{border-color:rgba(31,229,165,.6)}
.aq-bud{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--dim)}.aq-bud b{color:var(--fg)}
.aq-strip{display:flex;gap:1px;height:12px;border:1px solid var(--line)}
.aq-s{min-width:2px}.aq-s.t1{background:#ff6b7a}.aq-s.t2{background:#ffc850}.aq-s.t3{background:#1fe5a5}.aq-s.error,.aq-s.blocked{opacity:.4}
.aq-tier{display:flex;flex-direction:column;gap:6px}.aq-n{color:var(--dim);font-size:11px}
.aq-row{padding:8px;border:1px solid var(--line);display:flex;flex-direction:column;gap:3px}
.aq-row.running{border-color:rgba(31,229,165,.8)}.aq-row.waiting,.aq-row.blocked{border-color:rgba(255,200,80,.7)}.aq-row.paused{opacity:.65}
.aq-t{font-size:13px;word-break:break-word}.aq-id{font-family:var(--f-mono,monospace);color:var(--dim);font-size:11px}
.aq-m{font-size:11px;color:var(--dim)}.aq-m.bad{color:#ff6b7a}
.aq-need{font-size:12px;color:#ffc850;word-break:break-word}.aq-need code{font-size:11px}
.aq-add,.aq-set{border:1px solid var(--line);padding:8px;display:flex;flex-direction:column;gap:8px}.aq-add summary,.aq-set summary{cursor:pointer}
.aq-add[open],.aq-set[open]{gap:8px}.aq-add>*+*,.aq-set>*+*{margin-top:8px}
.aq-log{font-size:12px;padding:4px 0;border-bottom:1px solid var(--line);word-break:break-word}.aq-log span{color:var(--dim);font-family:var(--f-mono,monospace)}""")
# ================= v2.27: OpenRouter, as a model provider and as a decision server =================
s = s.replace('/* =====================================================================\n   BOOT', rd('openrouter.js') + '\n/* =====================================================================\n   BOOT', 1)
rep("lcppKey: '', aicKey: '',", "lcppKey: '', aicKey: '', orKey: '',")
rep("'groq', 'openai', 'aicord'],", "'groq', 'openrouter', 'openai', 'aicord'],")
for _o in ('<option value="openai">OpenAI-compatible endpoint</option>', '<option value="openai">OpenAI-compatible</option>'):
    assert s.count(_o) >= 1, _o
    s = s.replace(_o, '<option value="openrouter">OpenRouter</option>' + _o)
rep("""          <div data-prov="aicord"><label class="lbl" for="sAicKey">""", """          <div data-prov="openrouter"><label class="lbl" for="sOrKey">OpenRouter API key</label><input id="sOrKey" type="password" class="field mt-1" autocomplete="off" placeholder="sk-or-… from openrouter.ai/keys" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <div data-prov="aicord"><label class="lbl" for="sAicKey">""")
rep("  aicord: 'Chat with your AICord", "  openrouter: 'Hundreds of models (Claude, GPT, Gemini, Llama, Qwen, DeepSeek…) behind one key, paid per token. The model list shows the models that can call tools. Model ids look like anthropic/claude-sonnet-4.5. The key stays on this device.',\n  aicord: 'Chat with your AICord")
rep("S.aicKey = $('#sAicKey').value.trim();", "S.aicKey = $('#sAicKey').value.trim(); S.orKey = $('#sOrKey').value.trim();")
rep("$('#sAicKey').value = S.aicKey || '';", "$('#sAicKey').value = S.aicKey || ''; $('#sOrKey').value = S.orKey || '';")
rep("aicKey: $('#sAicKey')?.value.trim() || '',", "aicKey: $('#sAicKey')?.value.trim() || '', orKey: $('#sOrKey')?.value.trim() || '',")
rep("'vecToken', 'aicKey', 'dcToken',", "'vecToken', 'aicKey', 'orKey', 'dcToken',")
rep("openai (the OpenAI-compatible endpoint), aicord", "openrouter (model ids like openai/gpt-4o-mini), openai (the OpenAI-compatible endpoint), aicord")
# decisions through OpenRouter: the same /v1/systemone answers, from a model's log probabilities
rep("const decName = () => S.decideProv === 'ollama' ? 'Ollama' : 'Ollaya';", "const decName = () => S.decideProv === 'ollama' ? 'Ollama' : S.decideProv === 'openrouter' ? 'OpenRouter' : 'Ollaya';")
rep("const ollayaBase = () => (S.decideProv === 'ollama' ?", "const ollayaBase = () => S.decideProv === 'openrouter' ? OR_BASE : (S.decideProv === 'ollama' ?")
rep("async function ollayaFetch(path, init = {}) {", "async function ollayaFetch(path, init = {}) {\n  if (S.decideProv === 'openrouter') return orDecideFetch(path, init);")
rep('<option value="ollama">Ollama (0.35+)</option></select>', '<option value="ollama">Ollama (0.35+)</option><option value="openrouter">OpenRouter (any model with log probabilities)</option></select>')
rep("const decDraft = { ollaya: '', ollama: '' };", "const decDraft = { ollaya: '', ollama: '', openrouter: '' };")
rep("const decAddr = (p, v) => ({", "const decAddr = (p, v) => p === 'openrouter' ? {} : ({")
rep("$('#sDecideProv').onchange = () => { const other = $('#sDecideProv').value === 'ollama' ? 'ollaya' : 'ollama'; decDraft[other] = $('#sOllayaHost').value.trim(); decFill(); };",
    "let decPrev = null; $('#sDecideProv').onfocus = () => { decPrev = $('#sDecideProv').value; };\n$('#sDecideProv').onchange = () => { if (decPrev) decDraft[decPrev] = $('#sOllayaHost').value.trim(); decPrev = $('#sDecideProv').value; decFill(); };")
rep("$('#sOllayaHost').placeholder = p === 'ollama' ?", "$('#sOllayaHost').closest('div').hidden = p === 'openrouter'; $('#sOllayaKey').placeholder = p === 'openrouter' ? 'blank: the OpenRouter key from Model provider' : 'optional'; $('#sOllayaHost').placeholder = p === 'ollama' ?")
rep("'Connected, but no models are pulled yet. Run: ollaya pull winnow:e4b'", "(S.decideProv === 'openrouter' ? 'OpenRouter lists no models with log probabilities right now.' : 'Connected, but no models are pulled yet. Run: ollaya pull winnow:e4b')")

# ================= v2.28: Ollama Cloud as a decision server (laya, jev… on ollama.com's /v1/systemone) =================
rep("const decName = () => S.decideProv === 'ollama' ? 'Ollama' : S.decideProv === 'openrouter' ? 'OpenRouter' : 'Ollaya';",
    "const decName = () => S.decideProv === 'ollama' ? 'Ollama' : S.decideProv === 'cloud' ? 'Ollama Cloud' : S.decideProv === 'openrouter' ? 'OpenRouter' : 'Ollaya';")
rep("const ollayaBase = () => S.decideProv === 'openrouter' ? OR_BASE : (", "const ollayaBase = () => S.decideProv === 'openrouter' ? OR_BASE : S.decideProv === 'cloud' ? 'https://ollama.com' : (")
rep("const ollayaHeaders = () => { const h = { 'Content-Type': 'application/json' }; if (S.ollayaKey) h.Authorization = 'Bearer ' + S.ollayaKey; return h; };",
    "const ollayaHeaders = () => { const h = { 'Content-Type': 'application/json' }; const k = S.ollayaKey || (S.decideProv === 'cloud' ? S.ollamaKey : ''); if (k) h.Authorization = 'Bearer ' + k; return h; };")
rep("catch (e) { const N = decName(); throw new Error(`could not reach ${N} at ${ollayaBase()}.", "catch (e) { const N = decName(); if (S.decideProv === 'cloud') throw new Error(`could not reach Ollama Cloud at https://ollama.com: ${e.message || e}`); throw new Error(`could not reach ${N} at ${ollayaBase()}.")
rep('<option value="ollama">Ollama (0.35+)</option><option value="openrouter">', '<option value="ollama">Ollama (0.35+)</option><option value="cloud">Ollama Cloud (laya, jev…)</option><option value="openrouter">')
rep("const decDraft = { ollaya: '', ollama: '', openrouter: '' };", "const decDraft = { ollaya: '', ollama: '', openrouter: '', cloud: '' };")
rep("const decAddr = (p, v) => p === 'openrouter' ? {} : ({", "const decAddr = (p, v) => p === 'openrouter' || p === 'cloud' ? {} : ({")
rep("$('#sOllayaHost').closest('div').hidden = p === 'openrouter'; $('#sOllayaKey').placeholder = p === 'openrouter' ? 'blank: the OpenRouter key from Model provider' : 'optional';",
    "$('#sOllayaHost').closest('div').hidden = p === 'openrouter' || p === 'cloud'; $('#sOllayaKey').placeholder = p === 'openrouter' ? 'blank: the OpenRouter key from Model provider' : p === 'cloud' ? 'blank: the Ollama Cloud key from Model provider' : 'optional';")
rep("(S.decideProv === 'openrouter' ? 'OpenRouter lists no models with log probabilities right now.' :", "(S.decideProv === 'openrouter' ? 'OpenRouter lists no models with log probabilities right now.' : S.decideProv === 'cloud' ? 'Ollama Cloud listed no models for this key.' :")

for bad in ['showPreview', 'schedulePreview', 'prevFrame', 'btnPrevBack', 'btnFilePreview', 'btnFileSave', 'inlineAssets']:
    if bad in s: print('WARN leftover', bad, s.count(bad))
open(os.path.join(DIST, 'jade-vault.html'), 'w').write(s)
print('ok', len(src), '->', len(s))
