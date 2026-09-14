import { NextResponse } from 'next/server';
import { AEROCOMM_RELEASE_CHANNEL, AEROCOMM_VERSION } from '../../../lib/release';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'aerocomm-master',
      version: AEROCOMM_VERSION,
      channel: AEROCOMM_RELEASE_CHANNEL,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
