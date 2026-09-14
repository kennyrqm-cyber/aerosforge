import { createServerSupabaseClient } from './server';

export type ProviderQuotaKind = 'transcription' | 'realtime_call';

export async function consumeProviderQuota(
  kind: ProviderQuotaKind,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('aerocomm_consume_provider_quota', {
    p_kind: kind,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });

  if (error) {
    // Fail closed: provider spend should not proceed if quota enforcement is unavailable.
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    retryAfterSeconds: Math.max(1, Number(row?.retry_after_seconds ?? windowSeconds))
  };
}
