import type { Metadata } from 'next';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { requireUser } from '@/lib/auth';
import { setNewPassword } from '../entrar/actions';
import { deleteAccount, updateProfile } from './actions';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };
export const dynamic = 'force-dynamic';

const PLAN: Record<string, string> = { monthly: 'Mensual', yearly: 'Anual', vip: 'Mentoría VIP', gift: 'Regalo' };
const STATUS: Record<string, string> = { active: 'Activa', trialing: 'En prueba', past_due: 'Pago pendiente', canceled: 'Cancelada' };

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!supabaseReady) return <NotReady />;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser();
  const { data: memberships } = await supabase.from('memberships').select('plan, status, current_period_end').eq('user_id', user.id).order('created_at', { ascending: false });

  return (
    <div className="wrap section" style={{ maxWidth: 860 }}>
      <p className="kick">Mi cuenta</p>
      <h1 style={{ marginBottom: 24 }}>Tu espacio, <span className="script">{profile?.full_name || 'tú'}.</span></h1>
      <div style={{ marginBottom: 20 }}><Alert error={msg(sp.error)} ok={msg(sp.ok)} /></div>
      <div className="grid g2">
        <section className="card">
          <h3 style={{ marginBottom: 14 }}>Datos</h3>
          <form className="stack" action={updateProfile}>
            <label>Nombre<input name="name" defaultValue={profile?.full_name ?? ''} maxLength={120} required /></label>
            <label>Correo<input value={user.email ?? ''} disabled /></label>
            <button className="btn b-iv b-sm" type="submit">Guardar</button>
          </form>
        </section>
        <section className="card">
          <h3 style={{ marginBottom: 14 }}>Cambiar contraseña</h3>
          <form className="stack" action={setNewPassword}>
            <input type="hidden" name="back" value="/cuenta" />
            <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label>Repítela<input name="password2" type="password" autoComplete="new-password" minLength={10} required /></label>
            <button className="btn b-iv b-sm" type="submit">Actualizar</button>
          </form>
        </section>
        <section className="card">
          <h3 style={{ marginBottom: 14 }}>Membresía</h3>
          {memberships?.length ? (
            <ul className="lessons">
              {memberships.map((m, i) => (
                <li key={i} className="row between">
                  <span>{PLAN[m.plan] ?? m.plan}</span>
                  <span className={m.status === 'active' ? 'pill on' : 'pill'}>{STATUS[m.status] ?? m.status}</span>
                  {m.current_period_end && <span className="small mute">hasta {new Date(m.current_period_end).toLocaleDateString('es-ES')}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <><p className="mute" style={{ marginBottom: 14 }}>Todavía no tienes membresía.</p><a className="btn b-iv b-sm" href="/#academia">Ver planes</a></>
          )}
        </section>
        <section className="card" style={{ borderColor: '#ff9aa833' }}>
          <h3 style={{ marginBottom: 8 }}>Borrar mi cuenta</h3>
          <p className="mute small" style={{ marginBottom: 14 }}>Se borrarán tus datos y tu progreso para siempre. Escribe BORRAR para confirmar.</p>
          <form className="stack" action={deleteAccount}>
            <label className="sr" htmlFor="confirm">Confirmación</label>
            <input id="confirm" name="confirm" placeholder="BORRAR" autoComplete="off" required />
            <button className="btn b-danger b-sm" type="submit">Borrar mi cuenta</button>
          </form>
        </section>
      </div>
    </div>
  );
}
