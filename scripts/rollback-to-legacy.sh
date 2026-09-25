#!/usr/bin/env bash
set -euo pipefail
EXPECTED_BLOB_SHA="f70906cf6728891d8605653945091c078c87cfe6"

if [[ ! -f legacy/index.html ]]; then
  echo "legacy/index.html is missing; rollback is not safe." >&2
  exit 1
fi
actual="$(git hash-object legacy/index.html)"
if [[ "$actual" != "$EXPECTED_BLOB_SHA" ]]; then
  echo "Legacy rollback file failed integrity verification." >&2
  echo "Expected: $EXPECTED_BLOB_SHA" >&2
  echo "Actual:   $actual" >&2
  exit 1
fi

if [[ "${CONFIRM_AEROSFORGE_ROLLBACK:-}" != "RESTORE_VERIFIED_STATIC_MVP" ]]; then
  echo "Rollback is guarded. Re-run with CONFIRM_AEROSFORGE_ROLLBACK=RESTORE_VERIFIED_STATIC_MVP." >&2
  exit 1
fi

cp legacy/index.html index.html
printf 'Restored verified static MVP to ./index.html. Review git diff and deploy explicitly.\n'
