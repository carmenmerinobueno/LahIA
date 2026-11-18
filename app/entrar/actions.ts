'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { SITE_URL } from '@/lib/env';
import { validEmail, validPassword } from '@/lib/messages';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const rateLimited = (m?: string) => /rate|too many/i.test(m ?? '');

export async function signIn(form: FormData) {
  const email = str(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  if (!validEmail(email) || !password) redirect('/entrar?error=datos');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = rateLimited(error.message) ? 'demasiados' : /confirm/i.test(error.message) ? 'sin_confirmar' : 'credenciales';
    redirect(`/entrar?error=${code}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signUp(form: FormData) {
  const email = str(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  const name = str(form, 'name').slice(0, 120);
  const next = safeNext(form.get('next'));
  if (form.get('website')) redirect('/entrar?modo=registro&ok=revisa_correo'); // honeypot anti-bots
  if (!validEmail(email) || !name) redirect('/entrar?modo=registro&error=datos');
  if (!validPassword(password)) redirect('/entrar?modo=registro&error=password_corta');
  if (password !== String(form.get('password2') ?? '')) redirect('/entrar?modo=registro&error=password_distinta');
  if (form.get('legal') !== 'on') redirect('/entrar?modo=registro&error=legal');
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/entrar?modo=registro&error=${rateLimited(error.message) ? 'demasiados' : 'registro'}`);
  redirect('/entrar?ok=revisa_correo');
}

export async function requestReset(form: FormData) {
  const email = str(form, 'email').toLowerCase();
  if (!validEmail(email)) redirect('/recuperar?error=datos');
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/callback?next=/nueva-contrasena` });
  // Misma respuesta exista o no el correo (no revelamos qué cuentas existen).
  redirect('/recuperar?ok=recuperar_enviado');
}

export async function setNewPassword(form: FormData) {
  const password = String(form.get('password') ?? '');
  const again = String(form.get('password2') ?? '');
  const back = String(form.get('back') ?? '/nueva-contrasena') === '/cuenta' ? '/cuenta' : '/nueva-contrasena';
  if (!validPassword(password)) redirect(`${back}?error=password_corta`);
  if (password !== again) redirect(`${back}?error=password_distinta`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?error=enlace');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`${back}?error=error`);
  redirect(back === '/cuenta' ? '/cuenta?ok=password_cambiada' : '/academia');
}
