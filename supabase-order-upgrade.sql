-- Run once in Supabase SQL Editor

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists collection_date date;
alter table public.orders add column if not exists reference_image_url text;
alter table public.orders add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists wishing_card boolean default false;
alter table public.orders add column if not exists wishing_message text;
alter table public.orders add column if not exists other_item_type text;
alter table public.orders add column if not exists remarks text;

-- Standardise order status values to: confirmed, delivered_collected, cancelled.
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status='delivered_collected' where status in ('delivered','collected');
update public.orders set status='confirmed' where status is null or status not in ('confirmed','delivered_collected','cancelled');
alter table public.orders add constraint orders_status_check check (status in ('confirmed','delivered_collected','cancelled'));

insert into storage.buckets (id,name,public)
values ('order-references','order-references',true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload order references" on storage.objects;
create policy "Authenticated users can upload order references"
on storage.objects for insert to authenticated
with check (bucket_id='order-references');

drop policy if exists "Authenticated users can read order references" on storage.objects;
create policy "Authenticated users can read order references"
on storage.objects for select to authenticated
using (bucket_id='order-references');


-- Allow the three fulfilment options used by the app.
alter table public.orders drop constraint if exists orders_fulfilment_check;
alter table public.orders add constraint orders_fulfilment_check check (fulfilment in ('Self Pick','Delivery','Walk In'));

-- Allow authenticated staff to permanently delete orders from Deleted History.
drop policy if exists "Authenticated users can permanently delete orders" on public.orders;
create policy "Authenticated users can permanently delete orders"
on public.orders for delete to authenticated
using (true);

-- Reference image storage: public bucket so saved image URLs can be displayed in Orders/Dashboard/Print.
update storage.buckets set public = true where id = 'order-references';

drop policy if exists "Authenticated users can update order references" on storage.objects;
create policy "Authenticated users can update order references"
on storage.objects for update to authenticated
using (bucket_id='order-references')
with check (bucket_id='order-references');

drop policy if exists "Authenticated users can delete order references" on storage.objects;
create policy "Authenticated users can delete order references"
on storage.objects for delete to authenticated
using (bucket_id='order-references');
