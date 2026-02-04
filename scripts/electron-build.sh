#!/bin/bash
set -e

# Electron build script that reduces memory usage by temporarily
# removing large packages not needed for electron-builder packaging

echo "=== Starting Electron Build ==="

# Step 1: Build Next.js and compile Electron
echo "Building Next.js..."
npm run rebuild:node
npm run build
npm run electron:compile
npm run rebuild:electron

# Step 2: Temporarily move large packages that electron-builder doesn't need
# We keep @types to avoid TypeScript errors if interrupted
echo "Moving unnecessary packages temporarily..."
TEMP_DIR=".tmp-node-modules"
mkdir -p "$TEMP_DIR"

# Only move packages that aren't needed for electron-builder itself
# Keep: electron, app-builder-bin, typescript, electron-builder and its deps
PACKAGES_TO_MOVE=(
  "next"
  "@next"
  "eslint"
  "eslint-config-next"
  "@typescript-eslint"
  "tailwindcss"
  "@tailwindcss"
  "postcss"
  "@capacitor"
  "@capacitor-community"
  "@stencil"
  "jeep-sqlite"
  "sql.js"
  "@reduxjs"
  "@babel"
  "zod"
  "lodash"
  "ag-grid-community"
  "ag-grid-react"
  "recharts"
  "lucide-react"
  "react"
  "react-dom"
  "es-toolkit"
  "es-abstract"
  "@img"
  "@napi-rs"
  "lightningcss-darwin-arm64"
  "postject"
)

for pkg in "${PACKAGES_TO_MOVE[@]}"; do
  if [ -d "node_modules/$pkg" ]; then
    mv "node_modules/$pkg" "$TEMP_DIR/" 2>/dev/null || true
  fi
done

echo "Remaining node_modules size:"
du -sh node_modules

# Step 3: Run electron-builder (explicitly use local version)
echo "Running electron-builder..."
PLATFORM="${1:-mac}"
echo "Using local electron-builder: $(./node_modules/.bin/electron-builder --version)"
NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/electron-builder --$PLATFORM || BUILD_FAILED=1

# Step 4: Restore packages
echo "Restoring packages..."
for pkg in "${PACKAGES_TO_MOVE[@]}"; do
  if [ -d "$TEMP_DIR/$pkg" ]; then
    mv "$TEMP_DIR/$pkg" "node_modules/" 2>/dev/null || true
  fi
done
rmdir "$TEMP_DIR" 2>/dev/null || true

if [ "$BUILD_FAILED" = "1" ]; then
  echo "Build failed!"
  exit 1
fi

echo "=== Build Complete ==="
