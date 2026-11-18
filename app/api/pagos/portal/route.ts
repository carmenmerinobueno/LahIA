import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';
import { portalReady, stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

/** Portal de Stripe: cambiar tarjeta, ver facturas o cancelar la suscripción. */
export async function POST(req: NextRequest) {
  if (!portalReady) return NextResponse.redirect(new URL('/cuenta?error=error', req.url), { status: 303 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/entrar', req.url), { status: 303 });
  // RLS: solo puede leer su propio cliente.
  const { data } = await supabase.from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!data) return NextResponse.redirect(new URL('/precios', req.url), { status: 303 });
  const portal = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${SITE_URL}/cuenta`, locale: 'es' });
  return NextResponse.redirect(portal.url, { status: 303 });
}
