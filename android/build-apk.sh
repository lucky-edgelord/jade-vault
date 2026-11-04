#!/usr/bin/env bash
# Build and sign the Android APK (no Android SDK needed: API stubs + dx + apktool).
#   Release signing:  JADE_KEYSTORE=path.jks JADE_KEYSTORE_PASSWORD=... [JADE_KEY_ALIAS=netrunner] ./android/build-apk.sh
#   Without those, a local debug key is made (that APK cannot update one signed with the release key).
#   ./android/build-apk.sh fleet   builds the Jade Fleet client instead (dist/jade-fleet-<version>.apk, package
#   app.netrunner.fleet, so it installs next to Jade Vault); its page is dist/jade-fleet.html.
set -euo pipefail
VARIANT="${1:-vault}"
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"; T=.tools; mkdir -p "$T"
VERSION="$(cat ../VERSION)"; CODE="$(cat VERSION_CODE)"
fetch() { # url file sha256
  if [ ! -f "$T/$2" ] || ! echo "$3  $T/$2" | sha256sum -c --status 2>/dev/null; then
    echo "Downloading $2…"; curl -fsSL -o "$T/$2" "$1"
    echo "$3  $T/$2" | sha256sum -c --status || { echo "Checksum mismatch for $2"; rm -f "$T/$2"; exit 1; }
  fi
}
fetch https://github.com/iBotPeaches/Apktool/releases/download/v2.10.0/apktool_2.10.0.jar apktool.jar c0350abbab5314248dfe2ee0c907def4edd14f6faef1f5d372d3d4abd28f0431
fetch https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar uber-apk-signer.jar e1299fd6fcf4da527dd53735b56127e8ea922a321128123b9c32d619bba1d835
fetch https://github.com/pxb1988/dex2jar/releases/download/v2.4/dex-tools-v2.4.zip dex-tools.zip ee7c45eb3c1d2474a6145d8d447e651a736a22d9664b6d3d3be5a5a817dda23a
[ -f "$T/dx.jar" ] || unzip -p "$T/dex-tools.zip" dex-tools-v2.4/lib/dx-30.0.2.jar > "$T/dx.jar"
[ -f proj/assets/index.html ] || { echo "Build the web app first: scripts/build-web.sh"; exit 1; }
# the Rust core (libjade.so); rebuilt when a Rust toolchain is here, else the built copies in proj/lib are used
# (a toolchain without the Android targets, like the one on GitHub's runners, uses the built copies too)
if command -v cargo >/dev/null && [ -d "$HOME/.cargo" ] && command -v rustup >/dev/null \
   && [ "$(rustup target list --installed 2>/dev/null | grep -cE '^(aarch64-linux-android|armv7-linux-androideabi|x86_64-linux-android)$')" = 3 ]; then
  ../rust/build-android.sh
fi
[ -f proj/lib/arm64-v8a/libjade.so ] || { echo "Build the Rust core first: rust/build-android.sh"; exit 1; }

rm -rf build && mkdir -p build/stubs build/classes build/out
cp -r proj build/proj
NAME=jade-vault
if [ "$VARIANT" = fleet ]; then
  [ -f "$ROOT/dist/jade-fleet.html" ] || { echo "Build the web app first: scripts/build-web.sh"; exit 1; }
  cp "$ROOT/dist/jade-fleet.html" build/proj/assets/index.html
  sed -i 's/renameManifestPackage: null/renameManifestPackage: app.netrunner.fleet/' build/proj/apktool.yml
  sed -i 's#<string name="app_name">Jade Vault</string>#<string name="app_name">Jade Fleet</string>#' build/proj/res/values/strings.xml
  grep -q 'renameManifestPackage: app.netrunner.fleet' build/proj/apktool.yml && grep -q '>Jade Fleet<' build/proj/res/values/strings.xml || { echo "could not make the fleet variant"; exit 1; }
  NAME=jade-fleet
fi
sed -i.bak -E "s/android:versionCode=\"[0-9]+\"/android:versionCode=\"$CODE\"/; s/android:versionName=\"[^\"]+\"/android:versionName=\"$VERSION\"/" build/proj/AndroidManifest.xml
sed -i.bak -E "s/versionCode: .*/versionCode: $CODE/; s/versionName: .*/versionName: \"$VERSION\"/" build/proj/apktool.yml
rm -f build/proj/*.bak
javac -nowarn --release 8 -d build/stubs $(find stubs -name '*.java')
javac -nowarn --release 8 -cp build/stubs -d build/classes $(find src -name '*.java')
java -cp "$T/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output=build/proj/classes.dex build/classes
java -jar "$T/apktool.jar" b build/proj -o build/out/unsigned.apk >/dev/null

if [ -n "${JADE_KEYSTORE:-}" ]; then
  KS="$JADE_KEYSTORE"; PASS="${JADE_KEYSTORE_PASSWORD:?set JADE_KEYSTORE_PASSWORD}"; ALIAS="${JADE_KEY_ALIAS:-netrunner}"
else
  KS="$T/debug.jks"; PASS=android; ALIAS=debug
  [ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Jade Vault Debug" >/dev/null
  echo "Signing with a DEBUG key (set JADE_KEYSTORE for a release build)."
fi
java -jar "$T/uber-apk-signer.jar" -a build/out/unsigned.apk --ks "$KS" --ksAlias "$ALIAS" --ksPass "$PASS" --ksKeyPass "$PASS" -o build/out/signed | grep -E "signature verified|SHA256:" || true
mkdir -p "$ROOT/dist"; cp build/out/signed/*-aligned-signed.apk "$ROOT/dist/$NAME-$VERSION.apk"
echo "dist/$NAME-$VERSION.apk"
