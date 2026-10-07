-- MONET GARDEN Delivery Final7 safety migration
-- Safe: affects Delivery tables only. Does not modify public.orders.

alter table public.wholesale_orders enable row level security;
drop policy if exists "delivery_staff_all_orders" on public.wholesale_orders;
create policy "delivery_staff_all_orders" on public.wholesale_orders
  for all to authenticated using (true) with check (true);

-- This explicitly restores DELETE permission needed by Delivery Deleted History > Delete Forever.


-- Commission settings for Delivery defaults (historical commissions remain frozen on each wholesale_order)
alter table public.delivery_settings
  add column if not exists local_commission_per_trip numeric(12,2) not null default 15,
  add column if not exists outstation_commission_per_box numeric(12,2) not null default 15;

update public.delivery_settings
set local_commission_per_trip = coalesce(local_commission_per_trip, 15),
    outstation_commission_per_box = coalesce(outstation_commission_per_box, 15)
where id = 1;
