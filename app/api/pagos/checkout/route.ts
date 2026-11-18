import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, supabaseReady } from '@/lib/env';
import { PLANS, adminDb, stripe, stripeReady, type PlanKey } from '@/lib/stripe';

export const runtime = 'nodejs';

/** Crea la página de pago de Stripe para el plan elegido. */
export async function POST(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/precios?${q}`, req.url), { status: 303 });
  if (!supabaseReady || !stripeReady) return back('error=pagos_no_listos');

  const form = await req.formData();
  const plan = String(form.get('plan')) as PlanKey;
  if (!(plan in PLANS)) return back('error=datos');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/entrar?modo=registro&next=/precios', req.url), { status: 303 });

  // ¿Ya es miembro? Entonces va al portal, no a pagar otra vez.
  const { data: member } = await supabase.rpc('has_active_membership');
  if (member) return NextResponse.redirect(new URL('/cuenta', req.url), { status: 303 });

  const { data: existing } = await adminDb().from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PLANS[plan].price, quantity: 1 }],
    client_reference_id: user.id,
    ...(existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: user.email }),
    subscription_data: { metadata: { user_id: user.id } },
    metadata: { user_id: user.id },
    allow_promotion_codes: true,
    locale: 'es',
    success_url: `${SITE_URL}/academia?pago=ok`,
    cancel_url: `${SITE_URL}/precios?pago=cancelado`,
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
