import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Profile = { id: string; full_name: string | null; role: 'admin' | 'student'; created_at: string };

/** Usuario + perfil. Redirige a /entrar si no hay sesión. */
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  return { supabase, user, profile };
}

/** Solo administradores. El rol se comprueba en el servidor y, además, la base de datos lo vuelve a comprobar con RLS. */
export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile?.role !== 'admin') redirect('/academia');
  return ctx;
}

export async function hasActiveMembership(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc('has_active_membership');
  return Boolean(data);
}

/** Solo permite redirecciones internas (evita redirecciones abiertas). */
export function safeNext(next: unknown, fallback = '/academia') {
  // Solo rutas internas: empieza por "/" y nunca "//", "/\\", barras invertidas ni caracteres de control.
  return typeof next === 'string' && next.length <= 300 && /^\/(?![\/\\])[^\\\s\u0000-\u001f]*$/.test(next) ? next : fallback;
}
