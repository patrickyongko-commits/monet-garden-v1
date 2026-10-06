-- MONET GARDEN V2 fields for quantity and unit pricing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0;
