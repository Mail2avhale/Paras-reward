#!/usr/bin/env bash
# Helper: prints the keystore as base64 — copy this entire output and
# paste it as the GitHub Secret named KEYSTORE_BASE64.
#
# Usage:
#   bash scripts/print-keystore-base64.sh
#   # OR copy directly to clipboard (Mac):
#   bash scripts/print-keystore-base64.sh | pbcopy

KEYSTORE="$(dirname "$0")/../frontend/android/keystores/paras-reward.keystore"

if [ ! -f "$KEYSTORE" ]; then
  echo "ERROR: Keystore not found at $KEYSTORE"
  exit 1
fi

base64 -w 0 "$KEYSTORE" 2>/dev/null || base64 "$KEYSTORE"
echo  # trailing newline for clean copy
