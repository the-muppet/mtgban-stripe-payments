-- This file contains SQL code to create the Foriegn Data Wrapper (FDW)
-- for a direct Stripe integration with the SupaBAN PostgreSQL database.
-- While not necessarily 'needed', Stripe webhook data isnt explicitly ordered
-- and has no delivery guarantee. So I thought it important to implement.

-- Note: this is just for documentation, the FDW and related objects have aleady been created
-- (1/31/2025 - Elmo)

-- Creates the FDW extension
create extension if not exists wrappers with schema extensions;

-- Creates the FDW itself
create foreign data wrapper stripe_wrapper
    handler stripe_fdw_handler
    validator stripe_fdw_validator;

-- Saves Stripe API key in Vault -> returns key_id
insert into vault.secrets (name, secret)
values (
        'stripe',
        --'<Stripe API Key>'
    )
returning key_id;

-- Provides Postgres with credentials to connect to Stripe
create server stripe_server foreign data wrapper stripe_wrapper options (
    api_key_id '<key_id>' --from previous step,
    api_key_name 'stripe'
);

-- Creates schema to hold Stripe foreign tables
create schema if not exists stripe;

-- Stripe foreign tables

-- Customers
create foreign table stripe.customers (
    id text,
    email text,
    name text,
    description text,
    created timestamp,
    attrs jsonb
) server stripe_server options (
    object 'customers',
    rowid_column 'id' 
);
-- Prices
create foreign table stripe.prices (
    id text,
    active bool,
    currency text,
    product text,
    unit_amount bigint,
    type text,
    created timestamp,
    attrs jsonb
) server stripe_server options (
    object 'prices'
);
-- Products
create foreign table stripe.products (
    id text,
    name text,
    active bool,
    default_price text,
    description text,
    created timestamp,
    updated timestamp,
    attrs jsonb
) server stripe_server options (
    object 'products',
    rowid_column 'id'
);
-- Subscriptions
create foreign table stripe.subscriptions (
    id text,
    customer text,
    currency text,
    current_period_start timestamp,
    current_period_end timestamp,
    attrs jsonb
) server stripe_server options (
    object 'subscriptions',
    rowid_column 'id'
);