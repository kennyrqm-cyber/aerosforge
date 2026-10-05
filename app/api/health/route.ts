import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 3_000;
const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex"
};

function releaseIdentity() {
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? "unknown",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"
  };
}

async function checkDatabase() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Database health check exceeded ${DATABASE_TIMEOUT_MS}ms`)),
          DATABASE_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const release = releaseIdentity();

  try {
    await checkDatabase();
    return NextResponse.json(
      { ok: true, service: "aerosforge-one", database: "reachable", release, timestamp },
      { headers: HEALTH_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "aerosforge-one", database: "unreachable", release, timestamp },
      { status: 503, headers: HEALTH_HEADERS }
    );
  }
}
