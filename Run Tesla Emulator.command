#!/bin/zsh -l
# Double-click in Finder to start the emulator. It installs dependencies and
# builds the 3D car the first time, then runs in dev mode (live reload).
# Quit the emulator (⌘Q) to stop it.

cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null; then
  echo "Node.js is not installed. Get it from https://nodejs.org or run: brew install node"
  read -k1 "?Press any key to close."
  exit 1
fi

if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  echo "Installing dependencies…"
  npm install || { read -k1 "?Install failed. Press any key to close."; exit 1 }
  touch node_modules/.package-lock.json
fi

# The Electron binary download can be skipped by npm; fetch it if missing.
[[ -d node_modules/electron/dist ]] || node node_modules/electron/install.js

# Build the 3D car the first time, and again whenever the build script changes.
MODEL=src/renderer/public/models/model3-highland.glb
if [[ ! -f $MODEL || scripts/build-car-model.mjs -nt $MODEL ]]; then
  npm run build:car || echo "3D car not built (vendor/tesla/model3-2024-base/vehicle.obj is missing); using the 2D stand-in."
fi

npm run dev
