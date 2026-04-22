#!/usr/bin/env bash
#
# verify-legal-sync.sh
#
# Compares the source-of-truth legal docs in this repo against the
# public copies in benefits-safe-marketing. Exits 0 if in sync, 1 if
# drift is detected. Safe to run anytime; does not modify either repo.
#
# Usage:
#   ./scripts/verify-legal-sync.sh
#
# Requires: git. Clones marketing into a temp dir and compares hashes.

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKETING_REPO="stynerdev225/benefitssafe-marketing"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

BOLD=$'\033[1m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
DIM=$'\033[2m'
RESET=$'\033[0m'

echo "${BOLD}Cloning marketing repo (${MARKETING_REPO})...${RESET}"
# Private repo — use gh for auth. Falls back to anonymous HTTPS if gh
# isn't installed (useful in CI contexts where the runner already has
# read creds). Install gh locally with: brew install gh && gh auth login
if command -v gh >/dev/null 2>&1; then
  gh repo clone "$MARKETING_REPO" "$TMPDIR/marketing" -- --depth 1 --quiet
else
  git clone --depth 1 --quiet "https://github.com/${MARKETING_REPO}.git" "$TMPDIR/marketing"
fi

# Mapping: source path in app repo -> destination path in marketing repo.
# Only the three PUBLIC docs sync. LEGAL-CHECKLIST.md and SYNC-SETUP.md are
# internal and intentionally NOT published to benefitssafe.com.
FILES=(
  "docs/legal/PRIVACY-POLICY.md|content/legal/privacy.md"
  "docs/legal/TERMS-OF-SERVICE.md|content/legal/terms.md"
  "docs/legal/DATA-PROCESSING-AGREEMENT.md|content/legal/dpa.md"
)

DRIFT=0

sha() {
  # Portable SHA-256 across macOS (shasum) and Linux (sha256sum).
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

echo ""
echo "${BOLD}Comparing hashes...${RESET}"
echo ""

for row in "${FILES[@]}"; do
  src="${row%%|*}"
  dst="${row##*|}"
  src_abs="$APP_ROOT/$src"
  dst_abs="$TMPDIR/marketing/$dst"

  if [[ ! -f "$src_abs" ]]; then
    printf "  %s MISSING IN APP:%s %s\n" "$RED" "$RESET" "$src"
    DRIFT=1
    continue
  fi

  if [[ ! -f "$dst_abs" ]]; then
    printf "  %s MISSING IN MARKETING:%s %s\n" "$RED" "$RESET" "$dst"
    DRIFT=1
    continue
  fi

  src_hash="$(sha "$src_abs")"
  dst_hash="$(sha "$dst_abs")"

  if [[ "$src_hash" == "$dst_hash" ]]; then
    printf "  %sIN SYNC%s  %s %s(%s)%s\n" \
      "$GREEN" "$RESET" "$src" "$DIM" "${src_hash:0:12}" "$RESET"
  else
    printf "  %sDRIFT%s    %s\n" "$RED" "$RESET" "$src"
    printf "           app:       %s\n" "${src_hash:0:12}"
    printf "           marketing: %s\n" "${dst_hash:0:12}"
    echo ""
    echo "           Diff (first 30 lines):"
    diff -u "$src_abs" "$dst_abs" | sed 's/^/           /' | head -30
    echo ""
    DRIFT=1
  fi
done

echo ""
if [[ "$DRIFT" -eq 0 ]]; then
  printf "%sAll legal docs in sync.%s\n" "$GREEN" "$RESET"
  exit 0
else
  printf "%sDrift detected.%s Commit the updated docs in the app repo;\n" "$YELLOW" "$RESET"
  printf "the sync-legal-to-marketing workflow will open a PR in the\n"
  printf "marketing repo on push. After that PR is merged, re-run this\n"
  printf "script to confirm parity.\n"
  exit 1
fi
