import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signIn, signUp } from './actions';

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
        <Link href="/entrar?modo=registro" aria-current={reg ? 'page' : undefined}>Crear cuenta</Link>
      </nav>
      <div className="card">
        <div style={{ marginBottom: 14 }}><Alert error={msg(sp.error)} ok={msg(sp.ok)} /></div>
        {reg ? (
          <form className="stack" action={signUp}>
            <label>Nombre<input name="name" autoComplete="name" required maxLength={120} /></label>
            <label>Correo<input name="email" type="email" autoComplete="email" required maxLength={200} /></label>
            <label>Contraseña (mínimo 10 caracteres, con letras y números)<input name="password" type="password" autoComplete="new-password" required minLength={10} /></label>
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
