-- MONET GARDEN Delivery V1 migration
-- Safe: creates separate delivery tables and does not modify public.orders.

create table if not exists public.wholesale_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  contact_person text,
  phone text,
  address text,
  city text,
  sales_area text not null default 'local' check (sales_area in ('local','outstation')),
  remarks text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  driver_name text not null,
  phone text,
  default_commission_rate numeric(5,2) default 0,
  is_active boolean not null default true,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wholesale_orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null default current_date,
  customer_id uuid not null references public.wholesale_customers(id),
  driver_id uuid references public.drivers(id),
  location text not null,
  sales_area text not null default 'local' check (sales_area in ('local','outstation')),
  delivery_type text not null default 'local' check (delivery_type in ('local','outstation')),
  delivery_quantity integer not null default 1 check (delivery_quantity > 0),
  delivery_fee numeric(12,2) not null default 15,
  items text,
  sales_amount numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','delivered','cancelled')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wholesale_orders add column if not exists delivery_type text not null default 'local';
alter table public.wholesale_orders add column if not exists delivery_quantity integer not null default 1;
alter table public.wholesale_orders add column if not exists delivery_fee numeric(12,2) not null default 15;

update public.wholesale_orders set delivery_type = sales_area where delivery_type is null or delivery_type not in ('local','outstation');
update public.wholesale_orders set delivery_quantity = 1 where delivery_quantity is null or delivery_quantity < 1;
update public.wholesale_orders set delivery_fee = 15 where delivery_fee is null;

create table if not exists public.delivery_settings (
  id integer primary key default 1 check (id = 1),
  local_rate numeric(12,2) not null default 15,
  outstation_rate numeric(12,2) not null default 15,
  updated_at timestamptz not null default now()
);
insert into public.delivery_settings (id,local_rate,outstation_rate)
values (1,15,15)
on conflict (id) do nothing;

create index if not exists idx_wholesale_orders_date on public.wholesale_orders(order_date);
create index if not exists idx_wholesale_orders_customer on public.wholesale_orders(customer_id);
create index if not exists idx_wholesale_orders_driver on public.wholesale_orders(driver_id);
create index if not exists idx_wholesale_orders_area on public.wholesale_orders(sales_area);

-- Recommended for the existing authenticated app: allow signed-in staff to use the Delivery tables.
alter table public.wholesale_customers enable row level security;
alter table public.drivers enable row level security;
alter table public.wholesale_orders enable row level security;
alter table public.delivery_settings enable row level security;

drop policy if exists "delivery_staff_all_customers" on public.wholesale_customers;
create policy "delivery_staff_all_customers" on public.wholesale_customers for all to authenticated using (true) with check (true);
drop policy if exists "delivery_staff_all_drivers" on public.drivers;
create policy "delivery_staff_all_drivers" on public.drivers for all to authenticated using (true) with check (true);
drop policy if exists "delivery_staff_all_orders" on public.wholesale_orders;
create policy "delivery_staff_all_orders" on public.wholesale_orders for all to authenticated using (true) with check (true);
drop policy if exists "delivery_staff_all_settings" on public.delivery_settings;
create policy "delivery_staff_all_settings" on public.delivery_settings for all to authenticated using (true) with check (true);

-- Delivery Deleted History
alter table public.wholesale_orders add column if not exists deleted_at timestamptz null;
create index if not exists idx_wholesale_orders_deleted_at on public.wholesale_orders(deleted_at);

-- Delivery status is intentionally limited to Delivered / Cancelled.
alter table public.wholesale_orders add column if not exists deleted_at timestamptz null;
update public.wholesale_orders set status = 'delivered' where status = 'pending';
alter table public.wholesale_orders drop constraint if exists wholesale_orders_status_check;
alter table public.wholesale_orders add constraint wholesale_orders_status_check check (status in ('delivered','cancelled'));
create index if not exists idx_wholesale_orders_deleted_at on public.wholesale_orders(deleted_at);
