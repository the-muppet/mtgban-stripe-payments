## MTGBAN Stripe /Auth / User Portal... Thing.

### Part 1: Stripe
Stripe payment processing is (if you believe their admittedly extensive documentation) -
simple to test and a breeze to implement.

#### ***Cue Morgan Freeman's Voice...***

While stripe graciously provides upwards of 300 different events to sift through, there are a few flaws that exist within their delivery system that should make one question their role as an data **provider**. 
- They come ***unisigned*** by default
- There is **no** guarantee of delivery
- Events can both be sent and recieved out of order.
- May god have mercy on your little developer soul if you dare touch one of those events with a parser upon recieving it - you know, the thing thats built into like 96% of request libraries.

You can end up in a state where you've got a customer that has subscribed, successfully even - without having yet been assigned a customer id. 

***can you see my face right now?***

Anywho - the service itself is sound and trusted enough so thats what we're using. But not as a provider, instead we are using their webhook signals as... Signals.


# Database Schema Documentation

This document describes the database schema for a subscription-based service with Stripe integration. The schema includes tables for managing customers, products, pricing, subscriptions, and users.

## Tables Overview

### customers
Stores customer information and their associated Stripe customer IDs.

**Fields:**
- `id` (string, required) - Primary key
- `stripe_customer_id` (string, nullable) - External reference to Stripe customer

### prices
Manages product pricing information including subscription intervals and trial periods.

**Fields:**
- `id` (string, required) - Primary key
- `active` (boolean, nullable) - Whether the price is currently active
- `currency` (string, nullable) - Currency code
- `description` (string, nullable) - Price description
- `interval` (enum, nullable) - Subscription billing interval: "day" | "week" | "month" | "year"
- `interval_count` (number, nullable) - Number of intervals between billings
- `metadata` (Json, nullable) - Additional metadata
- `product_id` (string, nullable) - Reference to associated product
- `trial_period_days` (number, nullable) - Length of trial period in days
- `type` (enum, nullable) - Price type: "one_time" | "recurring"
- `unit_amount` (number, nullable) - Price amount in smallest currency unit

**Relationships:**
- Foreign key to `products` table through `product_id`

### products
Contains product catalog information.

**Fields:**
- `id` (string, required) - Primary key
- `active` (boolean, nullable) - Whether the product is currently active
- `description` (string, nullable) - Product description
- `image` (string, nullable) - URL to product image
- `metadata` (Json, nullable) - Additional metadata
- `name` (string, nullable) - Product name

### subscriptions
Manages customer subscriptions and their lifecycle.

**Fields:**
- `id` (string, required) - Primary key
- `user_id` (string, required) - Reference to user
- `price_id` (string, nullable) - Reference to price
- `status` (enum, nullable) - Subscription status
- `quantity` (number, nullable) - Quantity of subscribed items
- `cancel_at` (string, nullable) - Future cancellation date
- `cancel_at_period_end` (boolean, nullable) - Whether subscription will cancel at period end
- `canceled_at` (string, nullable) - When subscription was canceled
- `created` (string) - Creation timestamp
- `current_period_end` (string) - Current billing period end
- `current_period_start` (string) - Current billing period start
- `ended_at` (string, nullable) - When subscription ended
- `metadata` (Json, nullable) - Additional metadata
- `trial_end` (string, nullable) - Trial period end date
- `trial_start` (string, nullable) - Trial period start date

**Relationships:**
- Foreign key to `prices` table through `price_id`

### users
Stores user profile and billing information.

**Fields:**
- `id` (string, required) - Primary key
- `avatar_url` (string, nullable) - URL to user's avatar
- `billing_address` (Json, nullable) - User's billing address
- `full_name` (string, nullable) - User's full name
- `payment_method` (Json, nullable) - Payment method details

## Enums

### pricing_plan_interval
Defines subscription billing intervals:
- "day"
- "week"
- "month"
- "year"

### pricing_type
Defines types of pricing:
- "one_time"
- "recurring"

### subscription_status
Defines possible subscription states:
- "trialing" - In trial period
- "active" - Subscription is active
- "canceled" - Subscription has been canceled
- "incomplete" - Initial payment failed
- "incomplete_expired" - Initial payment failed and expired
- "past_due" - Payment is past due
- "unpaid" - Payment failed
- "paused" - Subscription is paused

## Functions

### sync_stripe_state
Synchronizes local database state with Stripe.

**Arguments:**
```typescript
{
  p_customer_data: {
    id: string;
    email: string | null;
    metadata: Json | null;
  };
  p_subscription_data: {
    id: string;
    status: subscription_status;
    price_id: string;
    product_id: string;
    current_period_end: string;
    current_period_start: string;
    cancel_at_period_end: boolean;
    payment_method: {
      brand: string | null;
      last4: string | null;
    } | null;
  } | null;
}
```

**Returns:** Json

## Type System

The schema uses TypeScript for type safety and includes:
- Generic JSON type support
- Table-specific Row, Insert, and Update types
- Relationship definitions
- Support for schema-specific table and enum access
- Composite type definitions

All table operations (inserts, updates) are strongly typed, ensuring data integrity at the type level.


# Stripe-Supabase Integration Documentation

This document describes the integration between Stripe and Supabase for managing customers, products, prices, and subscriptions.

## Configuration

### Environment Setup
- Required environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Constants
- `TRIAL_PERIOD_DAYS`: Controls the default trial period length (currently set to 0)

### Type Definitions
```typescript
type Customer = Tables<'customers'>
type Product = Tables<'products'>
type Price = Tables<'prices'>
type Subscription = Tables<'subscriptions'>
```

## Core Functions

### Product Management

#### `upsertProductRecord`
Synchronizes a Stripe product with the Supabase database.

```typescript
async function upsertProductRecord(product: Stripe.Product): Promise<void>
```

**Parameters:**
- `product`: Stripe Product object

**Functionality:**
- Creates or updates product records in Supabase
- Syncs: id, active status, name, description, primary image, and metadata

#### `deleteProductRecord`
Removes a product record from Supabase.

```typescript
async function deleteProductRecord(product: Stripe.Product): Promise<void>
```

### Price Management

#### `upsertPriceRecord`
Synchronizes a Stripe price with the Supabase database.

```typescript
async function upsertPriceRecord(
  price: Stripe.Price,
  retryCount?: number,
  maxRetries?: number
): Promise<void>
```

**Parameters:**
- `price`: Stripe Price object
- `retryCount`: Current retry attempt (default: 0)
- `maxRetries`: Maximum retry attempts (default: 3)

**Features:**
- Implements retry logic for foreign key constraints
- 2-second delay between retry attempts
- Syncs: pricing details, intervals, and trial period information

#### `deletePriceRecord`
Removes a price record from Supabase.

```typescript
async function deletePriceRecord(price: Stripe.Price): Promise<void>
```

### Customer Management

#### `createOrRetrieveCustomer`
Ensures customer existence in both Stripe and Supabase.

```typescript
async function createOrRetrieveCustomer({
  email,
  uuid
}: {
  email: string;
  uuid: string;
}): Promise<string>
```

**Process Flow:**
1. Checks for existing customer in Supabase
2. Verifies customer existence in Stripe
3. Reconciles any mismatches between systems
4. Creates new customer records if needed

**Returns:**
- Stripe customer ID

#### `upsertCustomerToSupabase`
Creates or updates a customer record in Supabase.

```typescript
async function upsertCustomerToSupabase(
  uuid: string,
  customerId: string
): Promise<string>
```

#### `createCustomerInStripe`
Creates a new customer in Stripe.

```typescript
async function createCustomerInStripe(
  uuid: string,
  email: string
): Promise<string>
```

### Subscription Management

#### `manageSubscriptionStatusChange`
Handles subscription status changes between Stripe and Supabase.

```typescript
async function manageSubscriptionStatusChange(
  subscriptionId: string,
  customerId: string,
  createAction?: boolean
): Promise<void>
```

**Parameters:**
- `subscriptionId`: Stripe subscription ID
- `customerId`: Stripe customer ID
- `createAction`: Boolean indicating if this is a new subscription

**Functionality:**
- Retrieves subscription details from Stripe
- Updates subscription status in Supabase
- Syncs billing details for new subscriptions

### Billing Details Management

#### `copyBillingDetailsToCustomer`
Syncs billing details from payment method to customer records.

```typescript
async function copyBillingDetailsToCustomer(
  uuid: string,
  payment_method: Stripe.PaymentMethod
): Promise<void>
```

**Synchronized Data:**
- Name
- Phone
- Address
- Payment method details

## Error Handling

All functions implement comprehensive error handling:
- Detailed error messages for debugging
- Retry mechanism for foreign key constraints
- Validation of required data
- Console logging for important operations

## Best Practices

1. **Service Role Usage**
   - The integration uses `SUPABASE_SERVICE_ROLE_KEY`
   - Must only be used in secure server-side contexts

2. **Data Consistency**
   - Implements reconciliation between Stripe and Supabase
   - Handles mismatched records gracefully
   - Maintains referential integrity

3. **Retry Logic**
   - Implements exponential backoff for database operations
   - Handles temporary failures gracefully
   - Limits maximum retry attempts

4. **Type Safety**
   - Utilizes TypeScript for type checking
   - Implements proper type definitions
   - Handles nullable fields appropriately

## Usage Examples

### Creating a New Customer
```typescript
const stripeCustomerId = await createOrRetrieveCustomer({
  email: 'user@example.com',
  uuid: 'user-uuid'
});
```

### Updating a Subscription
```typescript
await manageSubscriptionStatusChange(
  'sub_12345',
  'cus_12345',
  true
);
```

### Syncing a Product
```typescript
await upsertProductRecord(stripeProduct);
```

# Authentication Server Actions Documentation

This document describes the server-side authentication actions implemented using Next.js server actions and Supabase authentication.

## Overview

These server actions handle various authentication flows including:
- Email magic link authentication
- Password-based authentication
- User registration
- Password reset
- Profile management

## Helper Functions

### `isValidEmail`
Validates email addresses using regex pattern matching.

```typescript
function isValidEmail(email: string): boolean
```

**Pattern:** `^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$`

### `redirectToPath`
Utility function for handling redirects.

```typescript
async function redirectToPath(path: string): Promise<never>
```

## Authentication Actions

### Sign Out
Handles user sign out process.

```typescript
async function SignOut(formData: FormData): Promise<string>
```

**Parameters:**
- `formData`: Contains `pathName` for redirect after sign out

**Returns:**
- Success: Returns '/signin'
- Error: Returns error redirect path with message

### Email Authentication

#### `signInWithEmail`
Handles magic link authentication.

```typescript
async function signInWithEmail(formData: FormData): Promise<string>
```

**Process:**
1. Validates email format
2. Sends magic link using Supabase OTP
3. Sets preferred sign-in method cookie
4. Returns appropriate redirect with status

**Configuration:**
- Uses `shouldCreateUser` option based on password authentication settings
- Redirects to '/auth/callback' after successful authentication

### Password Management

#### `signInWithPassword`
Handles password-based authentication.

```typescript
async function signInWithPassword(formData: FormData): Promise<string>
```

**Parameters:**
- `formData`: Contains `email` and `password`

**Success Flow:**
1. Signs in user via Supabase
2. Sets preferred sign-in method cookie
3. Redirects to home page

#### `requestPasswordUpdate`
Initiates password reset process.

```typescript
async function requestPasswordUpdate(formData: FormData): Promise<string>
```

**Process:**
1. Validates email
2. Sends reset email via Supabase
3. Redirects to status page with instructions

#### `updatePassword`
Updates user's password.

```typescript
async function updatePassword(formData: FormData): Promise<string>
```

**Validation:**
- Ensures password and confirmation match
- Returns error redirect if validation fails

### User Management

#### `signUp`
Handles new user registration.

```typescript
async function signUp(formData: FormData): Promise<string>
```

**Success Cases:**
1. Immediate session: Redirects to home
2. Email confirmation required: Shows confirmation message
3. Existing email: Shows appropriate error

**Error Handling:**
- Invalid email format
- Existing user detection
- General signup failures

#### `updateEmail`
Updates user's email address.

```typescript
async function updateEmail(formData: FormData): Promise<string>
```

**Process:**
1. Validates new email format
2. Sends confirmation emails to old and new addresses
3. Updates email upon confirmation

#### `updateName`
Updates user's full name.

```typescript
async function updateName(formData: FormData): Promise<string>
```

**Updates:**
- Modifies `full_name` in user metadata
- Returns success/error status with appropriate message

## Response Handling

All actions use consistent response formats:

### Success Responses
Generated using `getStatusRedirect`:
```typescript
{
  path: string;
  message: string;
  description: string;
}
```

### Error Responses
Generated using `getErrorRedirect`:
```typescript
{
  path: string;
  error: string;
  description: string;
}
```

## Best Practices

1. **Input Validation**
   - Email validation using regex
   - Password confirmation matching
   - Trimming of all input strings

2. **Error Handling**
   - Specific error messages for different failure cases
   - User-friendly error descriptions
   - Appropriate redirect paths for errors

3. **Security**
   - Server-side validation
   - Secure password reset flow
   - Email confirmation for critical changes

4. **User Experience**
   - Persistent preferred sign-in method
   - Clear success/error messages
   - Appropriate redirects

## Usage Examples

### Magic Link Sign In
```typescript
const redirectPath = await signInWithEmail(formData);
// User receives email with magic link
```

### Password Sign In
```typescript
const redirectPath = await signInWithPassword(formData);
// User is signed in and redirected
```

### Update User Profile
```typescript
const redirectPath = await updateName(formData);
// User's name is updated
```