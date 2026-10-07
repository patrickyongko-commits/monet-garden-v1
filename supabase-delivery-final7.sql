-- MONET GARDEN Delivery Final7 safety migration
-- Safe: affects Delivery tables only. Does not modify public.orders.

alter table public.wholesale_orders enable row level security;
drop policy if exists "delivery_staff_all_orders" on public.wholesale_orders;
create policy "delivery_staff_all_orders" on public.wholesale_orders
  for all to authenticated using (true) with check (true);

-- This explicitly restores DELETE permission needed by Delivery Deleted History > Delete Forever.
