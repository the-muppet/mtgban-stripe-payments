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
  'price.created',
  'price.updated',
  'price.deleted',
] as const;

type RelevantEvents = typeof relevantEvents[number];

export const dynamic = 'force-dynamic';

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (!relevantEvents.includes(event.type as RelevantEvents)) {
    console.log(`❌ Unsupported event type: ${event.type}`);
    return;
  }

  try {
    switch (event.type) {
      // Product events
      case 'product.created':
      case 'product.updated': {
        const product = event.data.object as Stripe.Product;
        await upsertProductRecord(product);
        console.log(`✅ Product ${event.type}: ${product.id}`);
        break;
      }

      case 'product.deleted': {
        const product = event.data.object as Stripe.Product;
        await deleteProductRecord(product);
        console.log(`✅ Product deleted: ${product.id}`);
        break;
      }

      // Price events
      case 'price.created':
      case 'price.updated': {
        const price = event.data.object as Stripe.Price;
        await upsertPriceRecord(price);
        console.log(`✅ Price ${event.type}: ${price.id}`);
        break;
      }

      case 'price.deleted': {
        const price = event.data.object as Stripe.Price;
        await deletePriceRecord(price);
        console.log(`✅ Price deleted: ${price.id}`);
        break;
      }

      // Subscription Events
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string,
          event.type === 'customer.subscription.created'
        );
        console.log(`✅ Subscription ${event.type}: ${subscription.id}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string,
          false
        );
        console.log(`✅ Subscription deleted: ${subscription.id}`);
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
          console.log(`✅ Checkout session completed: ${checkoutSession.id}`);
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!req.body) {
    console.log('❌ Error: No request body');
    return NextResponse.json({ error: 'No request body' }, { status: 400 });
  }

  if (!webhookSecret) {
    console.log('❌ Error: Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: 'Missing webhook secret' },
      { status: 500 }
    );
  }

  try {
    const rawBody = await req.text();
    const sig = headers().get('stripe-signature');

    if (!sig) {
      console.log('❌ Error: No Stripe signature found');
      return NextResponse.json(
        { error: 'No Stripe signature found' },
        { status: 400 }
      );
    }

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      webhookSecret
    );

    console.log(`🔔 Webhook received: ${event.type}`);
    await processStripeEvent(event);
    console.log(`✅ Webhook processed successfully: ${event.type}`);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.log(`❌ Error message: ${errorMessage}`);
    
    // Return 401 if signature verification fails
    if (errorMessage.includes('No signatures found')) {
      return NextResponse.json(
        { error: `Webhook signature verification failed` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Webhook error: ${errorMessage}` },
      { status: 400 }
    );
  }
}