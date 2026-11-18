import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe, syncSubscription } from '@/lib/stripe';

export const runtime = 'nodejs';

/** Stripe avisa aquí de cada pago, renovación o cancelación. Solo se aceptan avisos firmados por Stripe. */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ error: 'sin firma' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return NextResponse.json({ error: 'firma no válida' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe().subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
          await syncSubscription(sub, s.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object);
        break;
    }
  } catch (e) {
    console.error('webhook', event.type, e);
    return NextResponse.json({ error: 'no procesado' }, { status: 500 }); // Stripe reintentará
  }
  return NextResponse.json({ received: true });
}
