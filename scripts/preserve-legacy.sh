#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BLOB_SHA="f70906cf6728891d8605653945091c078c87cfe6"
CANONICAL_PATH="legacy/index.html"
PRESERVED_PATH="legacy/aerosforge-mvp-v0.html"

mkdir -p legacy

if [[ -e "$CANONICAL_PATH" ]]; then
  existing_blob_sha="$(git hash-object "$CANONICAL_PATH")"
  if [[ "$existing_blob_sha" == "$EXPECTED_BLOB_SHA" ]]; then
    echo "$CANONICAL_PATH already contains the verified MVP; nothing to do."
    exit 0
  fi
  echo "$CANONICAL_PATH exists but does not match the verified MVP; refusing to overwrite it." >&2
  exit 1
fi

source_path=""
for candidate in "$PRESERVED_PATH" index.html; do
  if [[ -f "$candidate" ]] && [[ "$(git hash-object "$candidate")" == "$EXPECTED_BLOB_SHA" ]]; then
    source_path="$candidate"
    break
  fi
done

if [[ -z "$source_path" ]]; then
  echo "The verified static MVP was not found at $PRESERVED_PATH or ./index.html." >&2
  echo "Expected Git blob: $EXPECTED_BLOB_SHA" >&2
  echo "Re-audit the legacy source before migration; do not bypass this check." >&2
  exit 1
fi

cp "$source_path" "$CANONICAL_PATH"
printf '%s\n' "$EXPECTED_BLOB_SHA" > legacy/index.html.git-blob-sha
sha256sum "$CANONICAL_PATH" > legacy/index.html.sha256
printf 'Preserved and verified static MVP at legacy/index.html (Git blob %s)\n' "$EXPECTED_BLOB_SHA"
