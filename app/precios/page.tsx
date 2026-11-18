import type { Metadata } from 'next';
import { Alert } from '@/components/Alert';
import { msg } from '@/lib/messages';
import { supabaseReady } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { PLAN_FIELDS, eur, priceIdOf, stripeReady, type Plan } from '@/lib/stripe';

export const metadata: Metadata = { title: 'Planes de la Academia' };
export const dynamic = 'force-dynamic';

type Course = { id: string; title: string; position: number };

export default async function Precios({ searchParams }: { searchParams: Promise<{ error?: string; pago?: string; plan?: string }> }) {
  const sp = await searchParams;
  let plans: Plan[] = [];
  let courses: Course[] = [];
  let links: { plan_id: string; course_id: string }[] = [];
  let logged = false;
  let currentPlan: string | null = null;
  let member = false;
  if (supabaseReady) {
    const supabase = await createClient();
    const [p, c, pc, u] = await Promise.all([
      supabase.from('plans').select(PLAN_FIELDS).eq('published', true).order('position').returns<Plan[]>(),
      supabase.from('courses').select('id, title, position').eq('published', true).order('position').returns<Course[]>(),
      supabase.from('plan_courses').select('plan_id, course_id'),
      supabase.auth.getUser(),
    ]);
    plans = p.data ?? [];
    courses = c.data ?? [];
    links = pc.data ?? [];
    const user = u.data.user;
    logged = Boolean(user);
    if (user) {
      const { data } = await supabase.from('memberships').select('plan_id, status, current_period_end').eq('user_id', user.id).in('status', ['active', 'trialing']);
      const live = (data ?? []).filter((m) => !m.current_period_end || new Date(m.current_period_end) > new Date());
      member = live.length > 0;
      currentPlan = (live.find((m) => m.plan_id)?.plan_id as string | undefined) ?? null;
    }
  }
  const includes = (p: Plan, courseId: string) => p.all_courses || links.some((l) => l.plan_id === p.id && l.course_id === courseId);
  const coursesOf = (p: Plan) => courses.filter((c) => includes(p, c.id));
  const info = sp.pago === 'cancelado' ? 'Has cancelado el pago. Puedes intentarlo cuando quieras.' : undefined;

  return (
    <div className="wrap section">
      <p className="kick">LahIA Academia</p>
      <h1 style={{ marginBottom: 12 }}>Elige tu plan. <span className="script">Empieza hoy.</span></h1>
      <p className="mute" style={{ maxWidth: '56ch', marginBottom: 24 }}>Cada semana sin IA es tiempo y dinero que pierdes. Suscripción que se renueva sola cada mes o cada año. Cambias de plan o te das de baja cuando quieras.</p>
      <div style={{ marginBottom: 20 }}><Alert error={msg(sp.error)} info={info} /></div>

      {!plans.length && <div className="card"><h3>Los planes se publicarán muy pronto.</h3></div>}

      <div className="grid g3" style={{ alignItems: 'stretch' }}>
        {plans.map((p) => {
          const mine = currentPlan === p.id;
          const chosen = sp.plan === p.slug;
          const style = chosen
            ? { borderColor: 'var(--ivory)', boxShadow: '0 0 0 2px var(--rose)' }
            : p.highlighted ? { borderColor: 'var(--rose)', background: 'linear-gradient(160deg,#6e1423,#2a0d13)' } : undefined;
          return (
            <form key={p.id} className="card stack" action="/api/pagos/checkout" method="post" style={style}>
              <input type="hidden" name="plan" value={p.slug} />
              <div className="row between">
                <h3>{p.name}</h3>
                {mine ? <span className="pill on">Tu plan</span> : p.highlighted && <span className="pill wine">El más completo</span>}
              </div>
              {p.tagline && <p className="mute small">{p.tagline}</p>}
              {p.monthly_eur != null ? (
                <p style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 44, lineHeight: 1 }}>
                  {eur(p.monthly_eur)} €<span className="mute" style={{ fontSize: 16, fontWeight: 400 }}> al mes</span>
                </p>
              ) : <p className="mute">Precio próximamente</p>}
              {p.yearly_eur != null && <p className="small mute">o {eur(p.yearly_eur)} € al año{p.monthly_eur != null && p.yearly_eur < p.monthly_eur * 12 ? ` (ahorras ${eur(Math.round(p.monthly_eur * 12 - p.yearly_eur))} €)` : ''}</p>}
              <ul style={{ paddingLeft: 18 }}>
                {(p.all_courses ? [{ id: 'all', title: 'Todos los cursos de la academia' }] : coursesOf(p)).map((c) => <li key={c.id}>{c.title}</li>)}
              </ul>
              {p.perks.length > 0 && <ul className="mute small" style={{ paddingLeft: 18 }}>{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>}
              <div className="stack" style={{ marginTop: 'auto' }}>
                {!logged ? (
                  <a className="btn b-iv" href={`/entrar?modo=registro&next=${encodeURIComponent(`/precios?plan=${p.slug}`)}`}>Crear cuenta y apuntarme</a>
                ) : mine ? (
                  <a className="btn b-ln" href="/academia">Ir a mis cursos</a>
                ) : !stripeReady ? (
                  <button className="btn b-iv" type="button" disabled>Pagos disponibles muy pronto</button>
                ) : (
                  <>
                    {priceIdOf(p, 'monthly') && <button className="btn b-iv" type="submit" name="interval" value="monthly">{member ? 'Cambiar a este plan (mensual)' : `Apuntarme ya · ${eur(p.monthly_eur)} €/mes`}</button>}
                    {priceIdOf(p, 'yearly') && <button className="btn b-ln" type="submit" name="interval" value="yearly">{member ? 'Cambiar a este plan (anual)' : `Pago anual · ${eur(p.yearly_eur)} €/año`}</button>}
                    {!priceIdOf(p, 'monthly') && !priceIdOf(p, 'yearly') && <button className="btn b-iv" type="button" disabled>Muy pronto</button>}
                  </>
                )}
              </div>
            </form>
          );
        })}
      </div>

      {plans.length > 1 && courses.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ marginBottom: 18 }}>Compara los <span className="script">planes.</span></h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Curso</th>{plans.map((p) => <th key={p.id}>{p.name.replace(/^LahIA\s+/, '')}</th>)}</tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}><td>{c.title}</td>{plans.map((p) => <td key={p.id} aria-label={includes(p, c.id) ? 'Incluido' : 'No incluido'}>{includes(p, c.id) ? '✓' : '·'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="small mute" style={{ marginTop: 18 }}>Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay. IVA incluido. Al pagar aceptas las <a href="/legal/condiciones">condiciones</a>.</p>
    </div>
  );
}
