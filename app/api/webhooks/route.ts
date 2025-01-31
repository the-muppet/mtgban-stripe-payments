import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord,
  handleCustomerCreated,
  handleCustomerUpdated,
  handlePaymentIntentCreated,
  handlePaymentIntentFailed,
  handlePaymentIntentProcessing,
  handlePaymentIntentRequiresAction,
  handlePaymentIntentSucceeded
  handleSubscriptionPaused,
  handleSubscriptionPendingUpdateApplied,
  handleSubscriptionUpdateExpired,
  handleSubscriptionResumed
} from '@/utils/supabase/admin';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'customer.created',
  'customer.updated',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.resumed',
  'payment_intent.created',
  'payment_intent.succeeded',
  'payment_intent.requires_action',
  'payment_intent.processing',
  'payment_intent.payment_failed'
]);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret)
      return new Response('Webhook secret not found.', { status: 400 });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    console.log(`🔔  Webhook received: ${event.type}`);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        // Customer Events
        case 'customer.created':
          await handleCustomerCreated(event.data.object as Stripe.Customer);
          break;

        case 'customer.updated':
          await handleCustomerUpdated(event.data.object as Stripe.Customer);
          break;
        
        // Product events
        case 'product.created':
        case 'product.updated':
          await upsertProductRecord(event.data.object as Stripe.Product);
          break;

        case 'product.deleted':
          await deleteProductRecord(event.data.object as Stripe.Product);
          break;

        case 'price.created':
        case 'price.updated':
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;

        case 'price.deleted':
          await deletePriceRecord(event.data.object as Stripe.Price);
          break;

        // Payment Intent Events
        case 'payment_intent.created':
          await handlePaymentIntentCreated(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.processing':
          await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.requires_action':
          await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        
        // Subscription Events
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === 'customer.subscription.created'
          );
          break;

        case 'customer.subscription.deleted':
          await manageSubscriptionStatusChange(
            event.data.object.id,
            event.data.object.customer as string,
            false
          );
          break;

        case 'customer.subscription.paused':
          await handleSubscriptionPaused(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.pending_update_applied':
          await handleSubscriptionPendingUpdateApplied(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.pending_update_expired':
          await handleSubscriptionUpdateExpired(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.resumed':
          await handleSubscriptionResumed(event.data.object as Stripe.Subscription);
          break;
        
        // Checkout Session Events
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true
            );
          }
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.log(error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        {
          status: 400
        }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400
    });
  }
  return new Response(JSON.stringify({ received: true }));
}
