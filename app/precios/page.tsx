import type { Metadata } from 'next';
import { Alert } from '@/components/Alert';
import { msg } from '@/lib/messages';
import { supabaseReady } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { PLANS, stripeReady } from '@/lib/stripe';

export const metadata: Metadata = { title: 'Planes de la Academia' };
export const dynamic = 'force-dynamic';

const PERKS = ['Todos los cursos, de cero a experta', 'Contenido nuevo cada semana', 'Comunidad privada', 'Certificados con insignia para LinkedIn', 'Cancela cuando quieras'];

export default async function Precios({ searchParams }: { searchParams: Promise<{ error?: string; pago?: string; plan?: string }> }) {
  const sp = await searchParams;
  const chosen = sp.plan === 'monthly' || sp.plan === 'yearly' ? sp.plan : null;
  let logged = false;
  let member = false;
  if (supabaseReady) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    logged = Boolean(user);
    if (user) {
      const { data, error } = await supabase.rpc('has_active_membership');
      member = !error && Boolean(data);
    }
  }
  const info = sp.pago === 'cancelado' ? 'Has cancelado el pago. Puedes intentarlo cuando quieras.' : undefined;

  return (
    <div className="wrap section">
      <p className="kick">LahIA Academia</p>
      <h1 style={{ marginBottom: 12 }}>Elige tu plan. <span className="script">Empieza hoy.</span></h1>
      <p className="mute" style={{ maxWidth: '52ch', marginBottom: 24 }}>Cada semana sin IA es tiempo y dinero que pierdes. Entra ya y aprende a tu ritmo.</p>
      <div style={{ marginBottom: 20 }}><Alert error={msg(sp.error)} info={info} /></div>
      {member ? (
        <div className="card"><h3>Ya eres miembro.</h3><p className="mute" style={{ margin: '8px 0 16px' }}>Tienes acceso a todo.</p><a className="btn b-iv" href="/academia">Ir a mis cursos</a></div>
      ) : (
        <div className="grid g2">
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => (
            <form key={k} className="card stack" action="/api/pagos/checkout" method="post" style={chosen === k ? { borderColor: 'var(--ivory)', boxShadow: '0 0 0 2px var(--rose)' } : k === 'yearly' ? { borderColor: 'var(--rose)', background: 'linear-gradient(160deg,#6e1423,#2a0d13)' } : undefined}>
              <input type="hidden" name="plan" value={k} />
              <div className="row between"><h3>Membresía {PLANS[k].name}</h3>{k === 'yearly' && <span className="pill wine">Ahorras más</span>}</div>
              <p style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 48, lineHeight: 1 }}>{PLANS[k].label.split(' ')[0]} €<span className="mute" style={{ fontSize: 16, fontWeight: 400 }}> {PLANS[k].label.split(' ').slice(2).join(' ')}</span></p>
              <ul className="mute" style={{ paddingLeft: 18 }}>{PERKS.map((p) => <li key={p}>{p}</li>)}</ul>
              {logged ? (
                <button className="btn b-iv" type="submit" disabled={!stripeReady}>{stripeReady ? (chosen === k ? 'Continuar al pago' : 'Apuntarme ya') : 'Pagos disponibles muy pronto'}</button>
              ) : (
                <a className="btn b-iv" href={`/entrar?modo=registro&next=${encodeURIComponent(`/precios?plan=${k}`)}`}>Crear cuenta y apuntarme</a>
              )}
            </form>
          ))}
        </div>
      )}
      <p className="small mute" style={{ marginTop: 18 }}>Pago seguro con Stripe. Precios provisionales de prueba, IVA incluido. Al pagar aceptas las <a href="/legal/condiciones">condiciones</a>.</p>
    </div>
  );
}
