#!/usr/bin/env bash
# Build the web app: dist/jade-vault.html (the claude.ai artifact / any static host),
# dist/tw.css and android/proj/assets/index.html (the phone page, CDN-free basics).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules/tailwindcss ] || { echo "Run npm ci first."; exit 1; }
python3 scripts/pack_xdc.py apps/jade-link dist/jade-link.xdc
python3 scripts/pack_xdc.py apps/vault-loci dist/vault-loci.xdc
# the Rust core for the browser; without a Rust toolchain the built copy in app/vendor is used
if command -v cargo >/dev/null && [ -x "$HOME/bin/wasm-bindgen" -o -n "$(command -v wasm-bindgen)" ]; then rust/build-wasm.sh; fi
python3 app/build.py
node app/tools/twbuild.mjs dist/jade-vault.html dist/tw.css
python3 app/tools/build_index.py
python3 app/tools/build_fleet.py      # dist/jade-fleet.html: the Jade Fleet client (browser + APK)
python3 scripts/build-think-vault.py  # dist/think-vault/ and .zip: the think tool as vault files
python3 scripts/build-docs-app.py     # dist/jade-docs/ and .xdc: the Jade Docs app (reads dist/jade-vault.html)
