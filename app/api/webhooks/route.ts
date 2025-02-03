import Stripe from 'stripe';
import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe/config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord,

} from '@/utils/supabase/admin';
import { NextApiRequest, NextApiResponse } from 'next';

const relevantEvents: Stripe.Event.Type[] = [
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
];

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET as string;
  if (req.method === 'POST') {
    const sig = req.headers['stripe-signature'];

    let event: Stripe.Event;

    try {
      const body = await buffer(req);
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error(`⚠️  Webhook signature verification failed.`, err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`🔔  Webhook event received: ${event.type}:${event.id}`);
  }

res.json({received: true});
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature");

  if (!signature) return NextResponse.json({}, { status: 400 });

  async function doEventProcessing() {
    if (typeof signature !== "string") {
      throw new Error("[STRIPE HOOK] Header isn't a string???");
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    waitUntil(processEvent(event));
  }

  const { error } = await tryCatch(doEventProcessing());

  if (error) {
    console.error("[STRIPE HOOK] Error processing event", error);
  }

  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';

async function buffer(readable: ReadableStream) {
  const chunks = [];
  const reader = readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  if (!req.body) {
    return new Response('No body.', { status: 400 });
  }

  const rawBody = await buffer(req.body as ReadableStream);
  const rawBodyStr = rawBody.toString('utf8');
  const sig = headers().get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret)
      return new Response('Webhook secret not found.', { status: 400 });

    event = await stripe.webhooks.constructEventAsync(rawBodyStr, sig, webhookSecret);

    console.log(`🔔  Webhook received: ${event.type}`);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`)
    ;
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
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

        case 'price.created':
        case 'price.updated':
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;

        case 'price.deleted':
          await deletePriceRecord(event.data.object as Stripe.Price);
          break;

        // Subscription Events
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          {
            const subscription = event.data.object as Stripe.Subscription;
            await manageSubscriptionStatusChange(
              subscription.id,
              subscription.customer as string,
              event.type === 'customer.subscription.created'
            );
          }
          break;

        case 'customer.subscription.deleted':
          await manageSubscriptionStatusChange(
            event.data.object.id,
            event.data.object.customer as string,
            false
          );
          break;

        case 'checkout.session.completed':
          {
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
              const subscriptionId = checkoutSession.subscription;
              await manageSubscriptionStatusChange(
                subscriptionId as string,
                checkoutSession.customer as string,
                true
            );
          }
        }
        break;

        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        { status: 400 }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400 
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}