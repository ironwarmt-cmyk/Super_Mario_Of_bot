alter table quality_plans
  add column if not exists physical_shipping_included boolean not null default false,
  add column if not exists physical_shipping_price_pln numeric(10,2);

update quality_plans
set physical_shipping_included = true,
    physical_shipping_price_pln = 0,
    description_pl = case
      when description_pl ilike '%przesyłka wersji drukowanej w cenie%'
        then description_pl
      else description_pl || ' W pakiecie VIP przesyłka drukowanego e-booka na wskazany adres w Polsce jest wliczona w cenę pakietu.'
    end,
    description_en = case
      when description_en ilike '%shipping of the printed e-book is included%'
        then description_en
      else description_en || ' In the VIP plan, shipping of the printed e-book to the selected address in Poland is included in the plan price.'
    end,
    updated_at = now()
where slug='vip';

update quality_plans
set physical_shipping_included = false,
    physical_shipping_price_pln = null,
    updated_at = now()
where slug in ('basic','pro');
