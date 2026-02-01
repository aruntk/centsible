#!/usr/bin/env bash
set -euo pipefail

# Release script for Centsible
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.5.0
# If no version is given, uses the version from package.json.

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"

if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) is required. Install it from https://cli.github.com"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Bump version in package.json if a version argument was provided
if [ "${1:-}" ]; then
  node -e "const p=require('./package.json'); p.version='${VERSION}'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n')"
  git add package.json
  git commit -m "chore: bump version to ${VERSION}"
fi

echo "==> Building macOS (.dmg) and Windows (.exe) binaries..."
npm run electron:build:all

echo "==> Tagging ${TAG}..."
git tag -a "${TAG}" -m "Release ${TAG}"
git push origin HEAD "${TAG}"

# Collect artifacts
ARTIFACTS=()
for f in dist/*.dmg dist/*.exe; do
  [ -f "$f" ] && ARTIFACTS+=("$f")
done

if [ ${#ARTIFACTS[@]} -eq 0 ]; then
  echo "Warning: No .dmg or .exe found in dist/. Creating release without assets."
  gh release create "${TAG}" --title "${TAG}" --generate-notes
else
  echo "==> Creating GitHub release with ${#ARTIFACTS[@]} asset(s)..."
  gh release create "${TAG}" "${ARTIFACTS[@]}" --title "${TAG}" --generate-notes
fi

echo "Done — https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/${TAG}"
