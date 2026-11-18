import type { Metadata } from 'next';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { requestReset } from '../entrar/actions';

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false } };

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!supabaseReady) return <NotReady />;
  const sp = await searchParams;
  return (
    <div className="wrap section" style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 24 }}>Recupera tu <span className="script">acceso.</span></h1>
      <div className="card">
        <div style={{ marginBottom: 14 }}><Alert error={msg(sp.error)} ok={msg(sp.ok)} /></div>
        <form className="stack" action={requestReset}>
          <label>Correo de tu cuenta<input name="email" type="email" autoComplete="email" required /></label>
          <button className="btn b-iv" type="submit">Enviarme el enlace</button>
        </form>
      </div>
    </div>
  );
}
