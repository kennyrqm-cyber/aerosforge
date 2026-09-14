import { NextResponse } from 'next/server';
import { getCurrentRole } from '../../../lib/supabase/server';
import { AEROCOMM_VERSION } from '../../../lib/release';

export const dynamic = 'force-dynamic';

export async function GET() {
  const role = await getCurrentRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: role ? 403 : 401 });
  }

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const realtimeServerEnabled = process.env.AEROCOMM_ENABLE_REALTIME === 'true';
  const realtimeClientEnabled = process.env.NEXT_PUBLIC_AEROCOMM_REALTIME === 'true';
  const certificateSigningConfigured = Boolean(
    process.env.AEROCOMM_CERTIFICATE_SIGNING_SECRET
      && process.env.AEROCOMM_CERTIFICATE_SIGNING_SECRET.length >= 32
  );

  return NextResponse.json(
    {
      ok: supabaseConfigured && openaiConfigured,
      service: 'aerocomm-master',
      version: AEROCOMM_VERSION,
      configured: {
        supabase: supabaseConfigured,
        transcription: openaiConfigured,
        realtimeServer: realtimeServerEnabled,
        realtimeClient: realtimeClientEnabled,
        realtimeFlagParity: realtimeServerEnabled === realtimeClientEnabled,
        certificateSigning: certificateSigningConfigured
      }
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
