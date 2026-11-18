import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, supabaseReady } from '@/lib/env';
import { PLAN_FIELDS, adminDb, isInterval, openStripeSubscription, priceIdOf, stripe, stripeReady, type Plan } from '@/lib/stripe';

export const runtime = 'nodejs';

const SLUG = /^[a-z0-9-]{2,60}$/;

/** Crea la página de pago de Stripe para el plan elegido o, si ya está suscrita, le cambia el plan. */
export async function POST(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/precios?${q}`, req.url), { status: 303 });
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), { status: 303 });
  if (!supabaseReady || !stripeReady) return back('error=pagos_no_listos');

  const form = await req.formData();
  const slug = String(form.get('plan') ?? '');
  const interval = form.get('interval');
  if (!SLUG.test(slug) || !isInterval(interval)) return back('error=datos');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return to(`/entrar?modo=registro&next=${encodeURIComponent(`/precios?plan=${slug}`)}`);

  const { data: plan, error: planError } = await supabase.from('plans').select(PLAN_FIELDS).eq('slug', slug).eq('published', true).maybeSingle<Plan>();
  if (planError) return back('error=error');
  if (!plan) return back('error=datos');
  const price = priceIdOf(plan, interval);
  if (!price) return back('error=pagos_no_listos');

  const { data: existing, error: custError } = await adminDb().from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (custError) return back('error=error');

  // Ya tiene suscripción: no se cobra otra, se cambia de plan (Stripe prorratea la diferencia).
  if (existing) {
    const sub = await openStripeSubscription(existing.stripe_customer_id);
    if (sub) {
      if (!['active', 'trialing'].includes(sub.status) || sub.items.data.length !== 1) return to('/cuenta?error=pago_pendiente');
      const item = sub.items.data[0];
      if (item.price.id !== price) {
        await stripe().subscriptions.update(sub.id, {
          items: [{ id: item.id, price }],
          proration_behavior: 'create_prorations',
          metadata: { user_id: user.id, plan_id: plan.id },
        });
      }
      return to('/cuenta?ok=plan_cambiado');
    }
  }

  // Misma petición repetida en el mismo minuto → misma sesión de pago (evita dobles cobros por doble clic).
  const idempotencyKey = `checkout-${user.id}-${price}-${Math.floor(Date.now() / 60_000)}`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      ...(existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: user.email }),
      subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
      metadata: { user_id: user.id, plan_id: plan.id },
      allow_promotion_codes: true,
      locale: 'es',
      success_url: `${SITE_URL}/academia?pago=ok`,
      cancel_url: `${SITE_URL}/precios?pago=cancelado`,
    },
    { idempotencyKey },
  );
  return NextResponse.redirect(session.url!, { status: 303 });
}
