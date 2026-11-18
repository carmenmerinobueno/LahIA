import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { SITE_URL, supabaseReady } from '@/lib/env';

/** Entrar o registrarse con Google (Supabase Auth). Se activa con NEXT_PUBLIC_GOOGLE_LOGIN=1 cuando Google está configurado en Supabase. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  if (!supabaseReady || process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== '1') {
    return NextResponse.redirect(new URL('/entrar?error=google_no_listo', url.origin));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) return NextResponse.redirect(new URL('/entrar?error=error', url.origin));
  return NextResponse.redirect(data.url);
}
