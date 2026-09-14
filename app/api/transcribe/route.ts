import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../lib/supabase/server';
import { consumeProviderQuota } from '../../../lib/supabase/quota';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Speech transcription is not configured.' }, { status: 503 });
  }

  const quota = await consumeProviderQuota('transcription', 30, 60);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Transcription rate limit reached.' },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
    );
  }

  const incoming = await request.formData();
  const audio = incoming.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Expected multipart form field named audio.' }, { status: 400 });
  }
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio must be between 1 byte and 12 MB.' }, { status: 413 });
  }

  const body = new FormData();
  body.set('file', audio, audio.name || 'ptt.webm');
  body.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
  body.set('language', 'en');
  body.set('prompt', 'Aviation ATC radio transmission. Preserve callsigns, runway numbers, headings, altitudes, squawk codes, frequencies, hold short instructions, and ICAO phonetic words accurately.');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: 'Transcription provider rejected the request.', providerStatus: response.status }, { status: 502 });
    }
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'No transcript was returned.' }, { status: 502 });
    return NextResponse.json({ text, provider: 'openai', model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe' });
  } catch {
    return NextResponse.json({ error: 'Transcription provider is unreachable.' }, { status: 502 });
  }
}
