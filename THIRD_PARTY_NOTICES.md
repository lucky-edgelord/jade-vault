# Third-party notices

Jade Vault's own code is MIT (see `LICENSE`). It embeds or loads the components below, which keep
their own licenses.

## Embedded in the app page (`app/base/pi-netrunner-mobile.html`, and so in every build)

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| BusyBox (compiled to WebAssembly with Emscripten) | 1.37.0 | **GPL-2.0** | The shell. See "BusyBox source" below. |
| PixiJS | 6.5.10 | MIT | Live2D renderer. |
| pixi-live2d-display | 0.4.0 | MIT | Live2D model loader. |
| Live2D Cubism Core for Web | 4.x | **Live2D Proprietary Software License** | Redistributable inside apps under Live2D's terms: https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html . Publishers above Live2D's revenue threshold need a Live2D publication license. |
| Jade avatar ("jadecat" Live2D model and texture) | — | Owner's own asset | Not covered by the MIT license. Do not reuse without the owner's permission. |

### BusyBox source

The BusyBox binary is the unmodified BusyBox 1.37.0 sources built for WebAssembly with Emscripten.
Source: https://busybox.net/downloads/busybox-1.37.0.tar.bz2 . The build configuration used for the
binary in `app/base/` must ship alongside it to meet the GPL's "complete corresponding source"
requirement; add it under `third_party/busybox/` (the `.config` plus the build command) before
distributing builds. Until then, a written offer: the maintainers will provide the complete
corresponding source on request for three years from each release.

## Embedded for scripts

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| TensorFlow.js (`@tensorflow/tfjs`, the `tf.min.js` bundle: core, layers, converter, CPU and WebGL backends) | 4.22.0 | Apache-2.0 | `app/vendor/tf.min.js`, unmodified apart from the removed source-map comment; Google's license header is kept. Loaded only into scripts that use `tf`. License: https://www.apache.org/licenses/LICENSE-2.0 |
| LiteRT.js (`@litertjs/core`, `@litertjs/wasm-utils`) | 2.5.3 | Apache-2.0 | `android/proj/assets/litert/`: the bundled JavaScript (esbuild bundle of the two packages; one change to `@litertjs/core`: an `int8` entry added to its data-type table) and the WebAssembly runtime files. Loaded only when Jade uses the `litert` tool. License: https://www.apache.org/licenses/LICENSE-2.0 |
| TensorFlow.js WebGPU backend (`@tensorflow/tfjs-backend-webgpu`) | 4.22.0 | Apache-2.0 | `app/vendor/tf-backend-webgpu.min.js`, unmodified; embedded next to `tf.min.js` for Jade's scripts. |
| ONNX Runtime Web (`onnxruntime-web`: `ort.webgpu.min.js`, `ort-wasm-simd-threaded.asyncify.mjs/.wasm`) | 1.31.1 | MIT (Microsoft) | `app/vendor/ort/`, unmodified; shipped as `assets/ort/` in the APK, from jsDelivr in a browser. |
| xterm.js (`@xterm/xterm`, `@xterm/addon-fit`) | 5.5.0, 0.10.0 | MIT | `app/vendor/xterm/`, unmodified; inlined into the phone page so the terminal works offline. |

## Built here

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| SQLite | 3.53.4 | Public domain | `app/vendor/sqlite3.min.wasm`, built from the amalgamation; build inputs in `sqlite-wasm/`. |
| sqlite-vec | 0.1.9 | MIT OR Apache-2.0 (Alex Garcia) | linked into `app/vendor/sqlite3.min.wasm`; vector search for Jade's memory. |
| wasi-libc (linked into the SQLite build) | — | Apache-2.0 WITH LLVM-exception / MIT / BSD | |

## Inlined into the Android page at build time

| Component | Version | License |
| --- | --- | --- |
| marked | 18.0.10 | MIT |
| DOMPurify | 3.4.14 | Apache-2.0 OR MPL-2.0 |
| KaTeX (+ fonts) | 0.16.47 | MIT (fonts: SIL OFL 1.1) |
| Tailwind CSS (compiled output) | 4.3.3 | MIT |

## Loaded from CDNs at runtime

marked 12, DOMPurify 3.1, KaTeX 0.16, highlight.js 11.9 (BSD-3-Clause), xterm.js 5.5 and
addon-fit (MIT), Tailwind Play CDN 3.4 (MIT), ollama-js 0.6 (MIT), @pixi/unsafe-eval (MIT),
MicroPython 1.27 WebAssembly / PyScript build (MIT), pdf.js (Apache-2.0), Google Fonts
Rajdhani, Chakra Petch, JetBrains Mono (SIL OFL 1.1).

## Vault Loci app (`apps/vault-loci`)

Silkscreen and JetBrains Mono (latin subsets, from `@fontsource` 5.3.0), SIL OFL 1.1, embedded so the app works offline.

## Jade Vector bridge

| Component | License | Notes |
| --- | --- | --- |
| Vector, vector-agent, vector-core | MIT | https://github.com/VectorPrivacy/Vector — fetched and built by `jade-vector/setup.sh` or the Dockerfile, with a small patch (`jade-vector/patch_vector_agent.py`). |

## Build tools (downloaded, not shipped)

Apktool 2.10.0 (Apache-2.0), uber-apk-signer 1.3.0 (Apache-2.0), dex2jar / dx 30.0.2 (Apache-2.0),
Playwright (Apache-2.0).
