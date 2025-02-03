import Stripe from 'stripe';
import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe/config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord
} from '@/utils/supabase/admin';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const relevantEvents = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'product.created',
  'product.updated',
  'product.deleted',
] as const;

type RelevantEvents = typeof relevantEvents[number];

// fuck you stripe, you commie bastards
export const config = {
  api: {
    bodyParser: false
  }
};

export const dynamic = 'force-dynamic';

async function buffer(readable: ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}


async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (!relevantEvents.includes(event.type as RelevantEvents)) {
    console.log(`❌ Unsupported event type: ${event.type}`);
    return;
  }

  try {
    switch (event.type) {
      // Product events
      case 'product.created':
      case 'product.updated':
        await upsertProductRecord(event.data.object as Stripe.Product);
        break;

      case 'product.deleted':
        await deleteProductRecord(event.data.object as Stripe.Product);
        break;

      // Price events
      case 'price.created':
      case 'price.updated':
        await upsertPriceRecord(event.data.object as Stripe.Price);
        break;

      case 'price.deleted':
        await deletePriceRecord(event.data.object as Stripe.Price);
        break;

      // Subscription Events
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string,
          event.type === 'customer.subscription.created'
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string,
          false
        );
        break;
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
          await manageSubscriptionStatusChange(
            checkoutSession.subscription as string,
            checkoutSession.customer as string,
            true
          );
        }
        break;
      }

      default:
        throw new Error(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
}


export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!req.body) {
    return NextResponse.json('No body.', { status: 400 });
  }

  try {
    const rawBody = await buffer(req.body);
    const rawBodyStr = rawBody.toString('utf8');
    const sig = headers().get('stripe-signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret not found.' },
        { status: 400 }
      );
    }

    const event = await stripe.webhooks.constructEventAsync(
      rawBodyStr,
      sig,
      webhookSecret
    );

    console.log(`🔔 Webhook received: ${event.type}`);
    await processStripeEvent(event);
    console.log(`🔔 Webhook processed successfully: ${event.type}`);

    return NextResponse.json(
      { received: true },
      { status: 200 }
    );
  } catch (err: any) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.log(`❌ Error message: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook error: ${errorMessage}` },
      { status: 400 }
    );
  }
}

