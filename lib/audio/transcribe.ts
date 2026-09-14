export type TranscriptionResult = { text: string; provider?: string; model?: string };

export async function transcribePtt(blob: Blob): Promise<TranscriptionResult> {
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  const form = new FormData();
  form.set('audio', new File([blob], `ptt.${ext}`, { type: blob.type || 'audio/webm' }));
  const response = await fetch('/api/transcribe', { method: 'POST', body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Transcription failed.');
  return payload as TranscriptionResult;
}
