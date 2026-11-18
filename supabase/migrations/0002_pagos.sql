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

-- ---------------------------------------------------------------------
-- Permisos de la API explícitos (por si el proyecto no los concede
-- automáticamente). La seguridad real la ponen las políticas RLS.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.courses, public.lessons to anon, authenticated;
grant select on public.lesson_content to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.memberships, public.courses, public.lessons, public.lesson_content to authenticated;
grant select, insert, delete on public.lesson_progress to authenticated;
grant select on public.billing_customers to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.has_active_membership(), public.is_admin() to anon, authenticated;
