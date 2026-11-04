# LiteRT for the app (assets/litert/)

From [`@litertjs/core@2.5.3`](https://www.npmjs.com/package/@litertjs/core/v/2.5.3), the version the browser page
loads from jsDelivr:

- `litert_wasm_internal.{js,wasm}`, `litert_wasm_compat_internal.{js,wasm}`: the package's `wasm/` folder, unchanged.
- `litert.bundle.js`: the package's JavaScript bundled into one script that sets `window.LiteRTJS` (the phone page
  has no module loader for `+esm` imports).

`app/tools/build_index.py` copies this folder to `android/proj/assets/litert/`, so the APK runs LiteRT offline.
