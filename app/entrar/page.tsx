import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PasswordFields } from '@/components/PasswordFields';
import { signIn, signUp } from './actions';

const G = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

type SP = Promise<{ modo?: string; error?: string; ok?: string; next?: string }>;

export default async function Entrar({ searchParams }: { searchParams: SP }) {
  if (!supabaseReady) return <NotReady />;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(safeNext(sp.next));
  const reg = sp.modo === 'registro';
  const next = safeNext(sp.next);
  return (
    <div className="wrap section" style={{ maxWidth: 520 }}>
      <p className="kick">LahIA Academia</p>
      <h1 style={{ marginBottom: 24 }}>{reg ? <>Empieza <span className="script">hoy.</span></> : <>Hola de <span className="script">nuevo.</span></>}</h1>
      <nav className="tabs" aria-label="Acceso" style={{ marginBottom: 22 }}>
        <Link href="/entrar" aria-current={!reg ? 'page' : undefined}>Entrar</Link>
        <Link href={`/entrar?modo=registro${next !== '/academia' ? `&next=${encodeURIComponent(next)}` : ''}`} aria-current={reg ? 'page' : undefined}>Crear cuenta</Link>
      </nav>
      <div className="card">
        <div style={{ marginBottom: 14 }}><Alert error={msg(sp.error)} ok={msg(sp.ok)} /></div>
        <a className="btn-google" href={`/auth/google?next=${encodeURIComponent(next)}`}><G />{reg ? 'Registrarme con Google' : 'Entrar con Google'}</a>
        <p className="or">o con tu correo</p>
        {reg ? (
          <form className="stack" action={signUp}>
            <input type="hidden" name="next" value={next} />
            <label>Nombre<input name="name" autoComplete="name" required maxLength={120} /></label>
            <label>Correo<input name="email" type="email" autoComplete="email" required maxLength={200} /></label>
            <PasswordFields />
            <input className="sr" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <label className="check"><input type="checkbox" name="legal" required /><span>Acepto la <a href="/legal/privacidad">política de privacidad</a> y las <a href="/legal/condiciones">condiciones</a>.</span></label>
            <button className="btn b-iv" type="submit">Crear mi cuenta</button>
          </form>
        ) : (
          <form className="stack" action={signIn}>
            <input type="hidden" name="next" value={next} />
            <label>Correo<input name="email" type="email" autoComplete="email" required /></label>
            <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="btn b-iv" type="submit">Entrar</button>
            <Link className="small mute" href="/recuperar">¿Has olvidado tu contraseña?</Link>
          </form>
        )}
      </div>
    </div>
  );
}
