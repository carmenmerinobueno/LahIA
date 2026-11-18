import 'server-only';
import Stripe from 'stripe';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

export const PLANS = {
  monthly: { name: 'Mensual', price: process.env.STRIPE_PRICE_MONTHLY ?? '', label: '1 € al mes' },
  yearly: { name: 'Anual', price: process.env.STRIPE_PRICE_YEARLY ?? '', label: '10 € al año' },
} as const;
export type PlanKey = keyof typeof PLANS;

export const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY && PLANS.monthly.price && PLANS.yearly.price);

let _stripe: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Falta STRIPE_SECRET_KEY');
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: 'LahIA' } }));
}

/** Cliente con permisos de servidor. NUNCA se usa en el navegador. */
export function adminDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return createSupabase(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Traduce el estado de Stripe al de nuestra base de datos. */
export function mapStatus(s: Stripe.Subscription.Status): 'active' | 'trialing' | 'past_due' | 'canceled' {
  if (s === 'active') return 'active';
  if (s === 'trialing') return 'trialing';
  if (s === 'past_due' || s === 'unpaid' || s === 'incomplete' || s === 'paused') return 'past_due';
  return 'canceled';
}

export function planFromPrice(priceId?: string | null): 'monthly' | 'yearly' {
  return priceId && priceId === PLANS.yearly.price ? 'yearly' : 'monthly';
}

/** Guarda (o actualiza) la membresía a partir de una suscripción de Stripe. */
export async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const db = adminDb();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = (sub.metadata?.user_id as string | undefined) || userIdHint || null;
  if (!userId) {
    const { data } = await db.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error(`Suscripción ${sub.id} sin usuario`);

  await db.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });

  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const row = {
    user_id: userId,
    plan: planFromPrice(item?.price?.id),
    status: mapStatus(sub.status),
    current_period_end: periodEnd,
    provider: 'stripe',
    provider_ref: sub.id,
  };
  const { error } = await db.from('memberships').upsert(row, { onConflict: 'provider_ref' });
  if (error) throw error;
}
