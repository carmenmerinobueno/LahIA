import 'server-only';
import Stripe from 'stripe';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

export const PLANS = {
  monthly: { name: 'Mensual', price: process.env.STRIPE_PRICE_MONTHLY ?? '', label: '1 € al mes' },
  yearly: { name: 'Anual', price: process.env.STRIPE_PRICE_YEARLY ?? '', label: '10 € al año' },
} as const;
export type PlanKey = keyof typeof PLANS;

export const isPlan = (p: unknown): p is PlanKey => typeof p === 'string' && Object.hasOwn(PLANS, p);

/** El portal solo necesita la clave secreta. */
export const portalReady = Boolean(process.env.STRIPE_SECRET_KEY);
/** Para cobrar hace falta TODO: si falta el webhook o la clave de servidor, alguien podría pagar sin recibir acceso. */
export const stripeReady = Boolean(
  portalReady && PLANS.monthly.price && PLANS.yearly.price && process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

/** El plan se deduce del intervalo real del precio (no de la configuración actual). */
export function planFromPrice(price?: Stripe.Price | null): 'monthly' | 'yearly' {
  if (price?.recurring?.interval === 'year') return 'yearly';
  if (price?.id && price.id === PLANS.yearly.price) return 'yearly';
  return 'monthly';
}

/**
 * Guarda (o actualiza) la membresía a partir de una suscripción de Stripe.
 * Siempre se vuelve a pedir la suscripción a Stripe: así un aviso antiguo que llegue tarde no puede pisar el estado actual.
 */
export async function syncSubscription(subscriptionId: string, userIdHint?: string | null) {
  const db = adminDb();
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = (sub.metadata?.user_id as string | undefined) || userIdHint || null;
  if (!userId) {
    const { data } = await db.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error(`Suscripción ${sub.id} sin usuario`);

  const { error: custError } = await db.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
  if (custError) throw custError;

  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const row = {
    user_id: userId,
    plan: planFromPrice(item?.price),
    status: mapStatus(sub.status),
    current_period_end: periodEnd,
    provider: 'stripe',
    provider_ref: sub.id,
  };
  const { error } = await db.from('memberships').upsert(row, { onConflict: 'provider_ref' });
  if (error) throw error;
}

/** Cancela en Stripe todas las suscripciones vivas de un usuario (al borrar la cuenta o al quitar el acceso). */
export async function cancelStripeSubscriptions(userId: string) {
  if (!portalReady || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { data, error } = await adminDb().from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return;
  const subs = await stripe().subscriptions.list({ customer: data.stripe_customer_id, status: 'all', limit: 100 });
  for (const sub of subs.data) {
    if (!['canceled', 'incomplete_expired'].includes(sub.status)) await stripe().subscriptions.cancel(sub.id);
  }
}

/** ¿Tiene ya una suscripción viva o a medio pagar en Stripe? */
export async function hasOpenStripeSubscription(customerId: string) {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return subs.data.some((s) => ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'].includes(s.status));
}
