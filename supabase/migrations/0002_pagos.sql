-- =====================================================================
-- Pagos con Stripe: cliente de Stripe por usuario.
-- Solo el servidor (clave service_role) escribe aquí; el alumno solo puede leer lo suyo.
-- =====================================================================
create table public.billing_customers (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id  text unique not null,
  created_at          timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
create policy "ver mi cliente" on public.billing_customers for select using (user_id = auth.uid() or public.is_admin());

-- Una suscripción de Stripe = una fila de membresía (se actualiza con cada evento).
create index if not exists memberships_provider_ref_idx on public.memberships (provider_ref);
