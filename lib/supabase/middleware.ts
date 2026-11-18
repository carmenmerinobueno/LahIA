import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseReady } from '@/lib/env';

const PRIVATE = ['/academia', '/cuenta', '/admin'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseReady) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Valida el token con Supabase (no solo lo lee de la cookie).
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PRIVATE.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = '';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return response;
}
