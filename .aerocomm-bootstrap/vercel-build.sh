#!/usr/bin/env bash
set -euo pipefail

echo "[AeroComm] Materializing v1.0.4 RC source for Vercel build"
base64 -d .aerocomm-bootstrap/part00.b64 > /tmp/aerocomm-v1.0.4.zip
rm -rf /tmp/aerocomm-src
mkdir -p /tmp/aerocomm-src
unzip -q /tmp/aerocomm-v1.0.4.zip -d /tmp/aerocomm-src
SRC=/tmp/aerocomm-src/aerocomm-master-mvp-v1.0.4
TREE_SHA=$(cd "$SRC" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')
EXPECTED_TREE_SHA=2bb0aee533f42b2173800c730c630198a7ec2200d9bd4a5eeac93b4593725d54
if [ "$TREE_SHA" != "$EXPECTED_TREE_SHA" ]; then
  echo "[AeroComm] Source-tree digest mismatch: $TREE_SHA"
  exit 1
fi
echo "[AeroComm] Full source-tree digest verified: $TREE_SHA"
rm -rf app components lib supabase scripts tests docs
cp -a "$SRC/app" "$SRC/components" "$SRC/lib" "$SRC/supabase" "$SRC/scripts" "$SRC/tests" "$SRC/docs" .
cp "$SRC/middleware.ts" "$SRC/next-env.d.ts" "$SRC/next.config.mjs" "$SRC/tsconfig.json" "$SRC/tsconfig.core.json" "$SRC/tsconfig.engine-test.json" "$SRC/vercel.json" "$SRC/deployment-manifest.json" "$SRC/release-provenance.json" "$SRC/README.md" .
cp "$SRC/.npmrc" "$SRC/.nvmrc" "$SRC/.vercelignore" "$SRC/.env.example" .
echo "[AeroComm] Verifying release manifests"
node scripts/verify-deployment-manifest.mjs
node scripts/verify-release-provenance.mjs
echo "[AeroComm] Running Next.js production build"
./node_modules/.bin/next build
