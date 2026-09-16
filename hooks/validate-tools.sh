#!/usr/bin/env bash
# Windows guard: skip on git-bash / MSYS / Cygwin (ps1 counterpart runs there)
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) exit 0 ;; esac
# validate-tools.sh - on-demand wrapper for step003~014 환경 검증
# Usage: bash hooks/validate-tools.sh <playwright|aside|axe|biome|stylelint|c8|jscpd>
#   playwright / aside : browser verification backends (either one satisfies docs/BROWSER-TOOLS.md)
#   axe                : axe-core (tool-neutral), falling back to @axe-core/playwright
set -u
TOOL="${1:-}"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$PROJECT_ROOT" || exit 1

case "$TOOL" in
  playwright)
    # Resolve the installed package (plugin browser-verifier/ first, then the project) instead of
    # `npx playwright`, which would install the package from the registry when it is missing.
    BROWSER_VERIFIER="$(cd "$(dirname "$0")/.." && pwd)/browser-verifier"
    if node -e "const p=require.resolve('playwright/package.json',{paths:process.argv.slice(1)});console.log('playwright: '+require(p).version+' ('+require('path').dirname(p)+')')" "$BROWSER_VERIFIER" "$PROJECT_ROOT" 2>/dev/null; then
      exit 0
    else
      echo "playwright: missing (cd browser-verifier && npm ci && npx playwright install chromium, or use the aside backend)"; exit 1
    fi
    ;;
  aside) aside --version ;;
  axe)
    if node -e 'require.resolve("axe-core")' >/dev/null 2>&1; then
      echo "axe-core: OK"
    elif node -e 'require.resolve("@axe-core/playwright")' >/dev/null 2>&1; then
      echo "axe-core: OK (@axe-core/playwright)"
    else
      echo "axe-core: FAIL"; exit 1
    fi
    ;;
  biome) npx biome --version ;;
  stylelint) npx stylelint --version ;;
  c8) npx c8 --version ;;
  jscpd) npx jscpd --version ;;
  *) echo "Unknown tool: $TOOL (use playwright|aside|axe|biome|stylelint|c8|jscpd)"; exit 1 ;;
esac
