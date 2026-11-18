import type { Metadata } from 'next';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { PasswordFields } from '@/components/PasswordFields';
import { setNewPassword } from '../entrar/actions';

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } };

export default async function NuevaContrasena({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!supabaseReady) return <NotReady />;
  const sp = await searchParams;
  return (
    <div className="wrap section" style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 24 }}>Crea tu nueva <span className="script">contraseña.</span></h1>
      <div className="card">
        <div style={{ marginBottom: 14 }}><Alert error={msg(sp.error)} /></div>
        <form className="stack" action={setNewPassword}>
          <PasswordFields label="Nueva contraseña" again="Repítela" />
          <button className="btn b-iv" type="submit">Guardar</button>
        </form>
      </div>
    </div>
  );
}
