import 'server-only';
import Stripe from 'stripe';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

export const INTERVALS = { monthly: 'month', yearly: 'year' } as const;
export type Interval = keyof typeof INTERVALS;
export const isInterval = (v: unknown): v is Interval => v === 'monthly' || v === 'yearly';

export type Plan = {
  id: string; slug: string; name: string; tagline: string | null; perks: string[];
  monthly_eur: number | null; yearly_eur: number | null; all_courses: boolean; highlighted: boolean;
  position: number; published: boolean;
  stripe_product_id: string | null; stripe_price_monthly: string | null; stripe_price_yearly: string | null;
};
export const PLAN_FIELDS = 'id, slug, name, tagline, perks, monthly_eur, yearly_eur, all_courses, highlighted, position, published, stripe_product_id, stripe_price_monthly, stripe_price_yearly';
export const priceIdOf = (p: Plan, i: Interval) => (i === 'monthly' ? p.stripe_price_monthly : p.stripe_price_yearly);
export const eur = (n: number | null) => (n == null ? null : Number(n).toLocaleString('es-ES', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }));

/** El portal y la creación de precios solo necesitan la clave secreta. */
export const portalReady = Boolean(process.env.STRIPE_SECRET_KEY);
/** Para cobrar hace falta TODO: si falta el webhook o la clave de servidor, alguien podría pagar sin recibir acceso. */
export const stripeReady = Boolean(portalReady && process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);

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

/** Mensual o anual, según el intervalo real del precio. */
export function planFromPrice(price?: Stripe.Price | null): 'monthly' | 'yearly' {
  return price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
}

const UUID = /^[0-9a-f-]{36}$/i;
/** Qué plan de LahIA corresponde a una suscripción: por sus datos o, si no, por el precio. */
async function planIdFor(sub: Stripe.Subscription, price?: Stripe.Price | null) {
  const db = adminDb();
  if (price?.id) {
    const { data, error } = await db.from('plans').select('id').or(`stripe_price_monthly.eq.${price.id},stripe_price_yearly.eq.${price.id}`).maybeSingle();
    if (error) throw error;
    if (data) return data.id as string;
  }
  const fromMeta = sub.metadata?.plan_id;
  if (typeof fromMeta === 'string' && UUID.test(fromMeta)) return fromMeta;
  // Sin plan reconocible no damos acceso a todo por error: Stripe reintentará y queda en el registro.
  throw new Error(`Suscripción ${sub.id}: precio ${price?.id ?? '?'} sin plan`);
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
    plan_id: await planIdFor(sub, item?.price),
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

/** Su suscripción viva o a medio pagar en Stripe, si la tiene. */
export async function openStripeSubscription(customerId: string) {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return subs.data.find((s) => ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'].includes(s.status)) ?? null;
}

/**
 * Crea en Stripe los precios de un plan (los precios de Stripe no se pueden editar: si cambia el importe se crea uno nuevo).
 * Las alumnas que ya pagan siguen con su precio; el nuevo vale para las altas a partir de ahora.
 */
export async function syncPlanPrices(plan: Plan) {
  const s = stripe();
  let product = plan.stripe_product_id;
  if (product) {
    await s.products.update(product, { name: plan.name, active: true });
  } else {
    product = (await s.products.create({ name: plan.name, metadata: { plan_id: plan.id } }, { idempotencyKey: `product-${plan.id}` })).id;
  }
  const out = { stripe_product_id: product, stripe_price_monthly: plan.stripe_price_monthly, stripe_price_yearly: plan.stripe_price_yearly };
  for (const i of ['monthly', 'yearly'] as const) {
    const amount = i === 'monthly' ? plan.monthly_eur : plan.yearly_eur;
    const key = i === 'monthly' ? 'stripe_price_monthly' : 'stripe_price_yearly';
    const current = out[key];
    if (amount == null) { out[key] = null; continue; }
    const cents = Math.round(Number(amount) * 100);
    if (current) {
      const p = await s.prices.retrieve(current);
      if (p.unit_amount === cents && p.active && p.product === product) continue;
    }
    const created = await s.prices.create({
      product, currency: 'eur', unit_amount: cents, recurring: { interval: INTERVALS[i] },
      tax_behavior: 'inclusive', metadata: { plan_id: plan.id },
    });
    if (current) await s.prices.update(current, { active: false });
    out[key] = created.id;
  }
  return out;
}
