#!/usr/bin/env bash
# Build the knowledge graph engine (rust/kg) to WebAssembly: app/vendor/jade_kg.wasm, embedded in the page by
# app/build.py and copied into jade-py. Needs the wasm32-unknown-unknown target (rustup target add wasm32-unknown-unknown).
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release -q -p jade-kg --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/jade_kg.wasm ../app/vendor/jade_kg.wasm
echo "app/vendor/jade_kg.wasm ($(stat -c %s ../app/vendor/jade_kg.wasm) bytes)"
