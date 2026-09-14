import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../lib/supabase/server';

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (process.env.AEROCOMM_ENABLE_REALTIME !== 'true') {
    return NextResponse.json({ error: 'Realtime transport is disabled.' }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Realtime provider is not configured.' }, { status: 503 });
  }

  // Deliberately not minting a browser credential yet. v0.6 uses the authenticated
  // SDP relay route. Keep this endpoint closed rather than exposing a second path
  // with a different security contract.
  return NextResponse.json({
    error: 'Ephemeral realtime session minting is intentionally disabled in v0.6; use the authenticated /api/realtime/call relay.'
  }, { status: 501 });
}
