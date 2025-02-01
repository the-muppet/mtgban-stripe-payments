'use client';

import Button from '@/components/ui/Button';
import type { Tables } from '@/types_db';
import { getStripe } from '@/utils/stripe/client';
import { checkoutWithStripe } from '@/utils/stripe/server';
import { getErrorRedirect } from '@/utils/helpers';
import { User } from '@supabase/supabase-js';
import { CircleDollarSign } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PricingCard from '../PricingCard';
import '@/styles/pricing.css';

type Subscription = Tables<'subscriptions'>;
type Product = Tables<'products'>;
type Price = Tables<'prices'>;
interface ProductWithPrices extends Product {
  prices: Price[];
}
interface PriceWithProduct extends Price {
  products: Product | null;
}
interface SubscriptionWithProduct extends Subscription {
  prices: PriceWithProduct | null;
}

interface Props {
  user: User | null | undefined;
  products: ProductWithPrices[];
  subscription: SubscriptionWithProduct | null;
}

type BillingInterval = 'month' | 'year';

const formatPrice = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0
  }).format(amount / 100);

export default function Pricing({ user, products, subscription }: Props) {
  const router = useRouter();
  const currentPath = usePathname();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const [mounted, setMounted] = useState<boolean>(false);

  // Memoize intervals calculation
  const intervals = useMemo(() => {
    return [' month'];
  }, []);

  // Memoize active subscription check
  const isActiveSubscription = useCallback(
    (productName: string): boolean =>
      subscription
        ? productName === subscription?.prices?.products?.name
        : productName === 'Free Trial',
    [subscription]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const priceA = a.prices?.find(p => p.interval === billingInterval)?.unit_amount || 0;
      const priceB = b.prices?.find(p => p.interval === billingInterval)?.unit_amount || 0;
      return priceA - priceB;
    });
  }, [products, billingInterval]);

  const handleStripeCheckout = async (price: Price): Promise<void> => {
    setPriceIdLoading(price.id);
    try {
      if (!user) {
        return router.push('/signin/signup');
      }

      const { errorRedirect, sessionId } = await checkoutWithStripe(
        price,
        currentPath
      );

      if (errorRedirect) {
        return router.push(errorRedirect);
      }

      if (!sessionId) {
        return router.push(
          getErrorRedirect(
            currentPath,
            'An unknown error occurred.',
            'Please try again later or contact a system administrator.'
          )
        );
      }

      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Checkout error:', error);
      router.push(
        getErrorRedirect(
          currentPath,
          'Payment processing failed.',
          'Please try again later.'
        )
      );
    } finally {
      setPriceIdLoading(undefined);
    }
  };

  if (!mounted) {
    return null;
  }

  if (!products.length) {
    return (
      <section className="pricing-section">
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
          <div className="relative backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10">
            <p className="gradient-text text-4xl font-extrabold sm:text-center sm:text-6xl">
              No subscription plan found. Create them in your{' '}
              <a
                className="text-red-500 underline hover:text-red-400 transition-colors"
                href="https://dashboard.stripe.com/products"
                rel="noopener noreferrer"
                target="_blank"
              >
                Stripe Dashboard
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pricing-section">
      <div className="max-w-8xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center space-y-16">
          <h1 className="text-4xl font-extrabold sm:text-center sm:text-4xl">
            Play with your cards, not with your money.
          </h1>
          <p className="text-lg text-zinc-400 sm:text-center sm:text-2xl">
            Gain access to powerful market analytics and comprehensive trading tools engineered <br />
            to give you the edge in today's competitive TCG Finance landscape.
          </p>
          <h1 className="gradient-text text-4xl font-extrabold sm:text-center sm:text-6xl">
            MTGBAN
          </h1>
          <div className="mt-36 mb-36">
            <div className="line-divider" />
          </div>
          <div className="w-full px-4">
            <div className="pricing-grid">
              {sortedProducts.map((product) => {
                const price = product?.prices?.find(
                  (price) => price.interval === billingInterval
                );

                if (!price || !price.currency) {
                  return null;
                }
                const priceString = formatPrice(price.unit_amount || 0, price.currency);
                return (
                  <PricingCard
                    key={product.id}
                    isActive={isActiveSubscription(product.name || '')}
                    onSubscribeClick={() => handleStripeCheckout(price)}
                    className="pricing-card"
                  >
                    <div className="relative flex flex-col min-h-[600px] p-6">
                      {/* Header section */}
                      <div className="h-32">
                        <h2 className="text-2xl font-semibold leading-6 text-white">
                          {product.name}
                        </h2>
                        <p className="mt-4 text-zinc-300">
                          <span className="price-text text-5xl font-extrabold">
                            {priceString}
                          </span>
                          <span className="text-base font-medium text-zinc-100">
                            /{billingInterval}
                          </span>
                        </p>
                      </div>

                      {/* Content section */}
                      <div className="flex-grow mb-20">
                        <ul className="text-zinc-300 list-none space-y-4">
                          {product.description
                            ?.split(',')
                            .map((item, index) => (
                              <li
                                className="description-item flex items-start gap-3"
                                key={index}
                              >
                                <CircleDollarSign className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                                <span className="flex-1">{item.trim()}</span>
                              </li>
                            ))}
                        </ul>
                      </div>

                      {/* Button section - fixed to bottom */}
                      <div className="absolute bottom-6 left-6 right-6">
                        <Button
                          variant="slim"
                          type="button"
                          disabled={priceIdLoading === price.id}
                          loading={priceIdLoading === price.id}
                          onClick={() => handleStripeCheckout(price)}
                          className="sub-pricing-button"
                        >
                          {subscription ? 'Manage' : 'Subscribe'}
                        </Button>
                      </div>
                    </div>
                  </PricingCard>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
};