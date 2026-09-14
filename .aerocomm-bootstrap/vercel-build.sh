#!/usr/bin/env bash
set -euo pipefail

echo "[AeroComm] Materializing verified v1.0.4 RC for Vercel build"
base64 -d .aerocomm-bootstrap/part00.b64 > /tmp/aerocomm-v1.0.4.zip
echo "5331d30f837cbf52d2d006fe1c6a7df0ce3f10d6f4aa54f77edd36c41b09d2ac  /tmp/aerocomm-v1.0.4.zip" | sha256sum -c -
rm -rf /tmp/aerocomm-src
mkdir -p /tmp/aerocomm-src
unzip -q /tmp/aerocomm-v1.0.4.zip -d /tmp/aerocomm-src
SRC=/tmp/aerocomm-src/aerocomm-master-mvp-v1.0.4
rm -rf app components lib supabase scripts tests docs
cp -a "$SRC/app" "$SRC/components" "$SRC/lib" "$SRC/supabase" "$SRC/scripts" "$SRC/tests" "$SRC/docs" .
cp "$SRC/middleware.ts" "$SRC/next-env.d.ts" "$SRC/next.config.mjs" "$SRC/tsconfig.json" "$SRC/tsconfig.core.json" "$SRC/tsconfig.engine-test.json" "$SRC/vercel.json" "$SRC/deployment-manifest.json" "$SRC/release-provenance.json" "$SRC/README.md" .
cp "$SRC/.npmrc" "$SRC/.nvmrc" "$SRC/.vercelignore" "$SRC/.env.example" .
echo "[AeroComm] RC source materialized; running Next.js production build"
./node_modules/.bin/next build
