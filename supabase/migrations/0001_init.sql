-- =====================================================================
-- Somos LahIA · esquema inicial
-- Ejecutar en Supabase → SQL Editor (o con `supabase db push`).
-- Toda tabla tiene Row Level Security: nadie lee ni escribe nada que no le toque.
-- =====================================================================

-- ---------- Perfiles y roles ----------
create type public.user_role as enum ('admin', 'student');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  email       text,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (siempre como alumno).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Un alumno no puede cambiarse el rol a sí mismo.
-- (security invoker: current_user es el rol real; desde el SQL Editor de Supabase sí se permite.)
create function public.protect_role() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

alter table public.profiles enable row level security;
create policy "ver mi perfil o admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "editar mi perfil o admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- ---------- Membresías (las crea el sistema de pagos o un admin) ----------
create type public.membership_status as enum ('active', 'trialing', 'past_due', 'canceled');
create type public.membership_plan as enum ('monthly', 'yearly', 'vip', 'gift');

create table public.memberships (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan                public.membership_plan not null,
  status              public.membership_status not null default 'active',
  current_period_end  timestamptz,
  provider            text,           -- stripe, paypal, manual...
  provider_ref        text unique,    -- id de la suscripción en el proveedor
  created_at          timestamptz not null default now()
);
create index on public.memberships (user_id);
alter table public.memberships enable row level security;
create policy "ver mis membresías o admin" on public.memberships for select using (user_id = auth.uid() or public.is_admin());
create policy "admin gestiona membresías" on public.memberships for all using (public.is_admin()) with check (public.is_admin());

create function public.has_active_membership() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- ---------- Cursos y lecciones ----------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  title        text not null check (char_length(title) <= 140),
  summary      text check (char_length(summary) <= 600),
  level        text not null default 'Inicial',
  position     int not null default 0,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.courses enable row level security;
create policy "catálogo público" on public.courses for select using (published or public.is_admin());
create policy "admin gestiona cursos" on public.courses for all using (public.is_admin()) with check (public.is_admin());

create table public.lessons (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses(id) on delete cascade,
  title          text not null check (char_length(title) <= 160),
  position       int not null default 0,
  duration_min   int,
  is_free        boolean not null default false,  -- lección de muestra
  published      boolean not null default false,
  created_at     timestamptz not null default now()
);
create index on public.lessons (course_id, position);
alter table public.lessons enable row level security;
-- El temario (títulos) es visible para quien vea el curso.
create policy "temario visible" on public.lessons for select using (
  public.is_admin() or (published and exists (select 1 from public.courses c where c.id = course_id and c.published))
);
create policy "admin gestiona lecciones" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- El contenido (vídeo y texto) va aparte y solo lo leen miembros activos.
create table public.lesson_content (
  lesson_id     uuid primary key references public.lessons(id) on delete cascade,
  video_id      text,   -- id del vídeo en Bunny Stream / Vimeo (nunca un enlace descargable)
  body          text
);
alter table public.lesson_content enable row level security;
create policy "contenido solo miembros" on public.lesson_content for select using (
  public.has_active_membership()
  or exists (select 1 from public.lessons l where l.id = lesson_id and l.is_free and l.published)
);
create policy "admin gestiona contenido" on public.lesson_content for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Progreso del alumno ----------
create table public.lesson_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy "mi progreso" on public.lesson_progress for select using (user_id = auth.uid() or public.is_admin());
create policy "marcar mi progreso" on public.lesson_progress for insert with check (user_id = auth.uid() and public.has_active_membership());
create policy "desmarcar mi progreso" on public.lesson_progress for delete using (user_id = auth.uid());

-- ---------- Mensajes del formulario de contacto ----------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind        text not null default 'empresa' check (kind in ('empresa', 'academia', 'otro')),
  message     text not null check (char_length(message) between 1 and 4000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- Cualquiera puede enviar; solo admin puede leer.
create policy "enviar mensaje" on public.contact_messages for insert with check (handled = false);
create policy "admin lee mensajes" on public.contact_messages for select using (public.is_admin());
create policy "admin gestiona mensajes" on public.contact_messages for update using (public.is_admin());
create policy "admin borra mensajes" on public.contact_messages for delete using (public.is_admin());

-- ---------- Borrar mi cuenta (RGPD) ----------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
