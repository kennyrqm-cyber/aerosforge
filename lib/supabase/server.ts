import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase is not configured.');
  return { url, anon };
}

export async function createServerSupabaseClient() {
  const { url, anon } = config();
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components may not be allowed to mutate cookies. Middleware refreshes sessions.
        }
      }
    }
  });
}

export async function getAuthenticatedUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentRole(): Promise<'student'|'instructor'|'admin'|null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error || !data) return null;
  return data.role as 'student'|'instructor'|'admin';
}
