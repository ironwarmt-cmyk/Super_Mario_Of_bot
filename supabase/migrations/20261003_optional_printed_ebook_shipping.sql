alter table quality_plans
  add column if not exists physical_copy_optional boolean not null default true,
  add column if not exists physical_shipping_checkout_url text;

update quality_plans
set physical_copy_optional = true,
    physical_shipping_included = false,
    physical_shipping_price_pln = 19.99,
    physical_shipping_checkout_url = 'https://buy.stripe.com/14A00i0tX0BkeeW0e2dby0b',
    updated_at = now()
where slug='basic';

update quality_plans
set physical_copy_optional = true,
    physical_shipping_included = false,
    physical_shipping_price_pln = 19.99,
    physical_shipping_checkout_url = 'https://buy.stripe.com/8x2eVcccFdo6daSaSGdby0c',
    updated_at = now()
where slug='pro';

update quality_plans
set physical_copy_optional = true,
    physical_shipping_included = true,
    physical_shipping_price_pln = 0,
    physical_shipping_checkout_url = null,
    updated_at = now()
where slug='vip';
