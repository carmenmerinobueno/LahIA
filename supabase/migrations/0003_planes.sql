-- =====================================================================
-- Planes por niveles, módulos y acceso por curso.
-- Cada plan abre sus cursos; un plan con "all_courses" (LahIA Total) los abre todos.
-- Las membresías antiguas sin plan (regalo, VIP, manuales) siguen abriendo todo.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- Planes ----------
create table if not exists public.plans (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name                  text not null check (char_length(name) <= 80),
  tagline               text check (char_length(tagline) <= 200),
  perks                 text[] not null default '{}',
  monthly_eur           numeric(8,2) check (monthly_eur is null or monthly_eur > 0),
  yearly_eur            numeric(8,2) check (yearly_eur is null or yearly_eur > 0),
  all_courses           boolean not null default false,
  highlighted           boolean not null default false,
  position              int not null default 0,
  published             boolean not null default false,
  stripe_product_id     text,
  stripe_price_monthly  text unique,
  stripe_price_yearly   text unique,
  created_at            timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists "planes visibles" on public.plans;
create policy "planes visibles" on public.plans for select using (published or public.is_admin());
drop policy if exists "admin gestiona planes" on public.plans;
create policy "admin gestiona planes" on public.plans for all using (public.is_admin()) with check (public.is_admin());

-- Qué cursos abre cada plan.
create table if not exists public.plan_courses (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  primary key (plan_id, course_id)
);
create index if not exists plan_courses_course_idx on public.plan_courses (course_id);
alter table public.plan_courses enable row level security;
drop policy if exists "ver qué incluye cada plan" on public.plan_courses;
create policy "ver qué incluye cada plan" on public.plan_courses for select using (true);
drop policy if exists "admin gestiona planes y cursos" on public.plan_courses;
create policy "admin gestiona planes y cursos" on public.plan_courses for all using (public.is_admin()) with check (public.is_admin());

-- La membresía guarda el plan que paga. Un plan con alumnas no se puede borrar (se oculta).
alter table public.memberships add column if not exists plan_id uuid references public.plans(id) on delete restrict;
create index if not exists memberships_plan_idx on public.memberships (plan_id);

-- ---------- Módulos dentro de cada curso ----------
create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null check (char_length(title) <= 160),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists modules_course_idx on public.modules (course_id, position);
alter table public.modules enable row level security;
drop policy if exists "módulos visibles" on public.modules;
create policy "módulos visibles" on public.modules for select using (
  public.is_admin() or exists (select 1 from public.courses c where c.id = course_id and c.published)
);
drop policy if exists "admin gestiona módulos" on public.modules;
create policy "admin gestiona módulos" on public.modules for all using (public.is_admin()) with check (public.is_admin());

alter table public.lessons add column if not exists module_id uuid references public.modules(id) on delete set null;
create index if not exists lessons_module_idx on public.lessons (module_id, position);

-- ---------- Acceso por curso ----------
-- Cursos que puede ver la persona conectada.
create or replace function public.course_access_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.courses c where public.is_admin()
  union
  select c.id
  from public.memberships m
  left join public.plans p on p.id = m.plan_id
  join public.courses c on (
    m.plan_id is null
    or p.all_courses
    or exists (select 1 from public.plan_courses pc where pc.plan_id = m.plan_id and pc.course_id = c.id)
  )
  where m.user_id = auth.uid()
    and m.status in ('active', 'trialing')
    and (m.current_period_end is null or m.current_period_end > now());
$$;

create or replace function public.has_course_access(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_access_ids() id where id = p_course);
$$;

-- El contenido de una lección: solo si tu plan incluye su curso (o es lección de muestra).
drop policy if exists "contenido solo miembros" on public.lesson_content;
drop policy if exists "contenido según plan" on public.lesson_content;
create policy "contenido según plan" on public.lesson_content for select using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and (public.has_course_access(l.course_id) or (l.is_free and l.published))
  )
);

drop policy if exists "marcar mi progreso" on public.lesson_progress;
create policy "marcar mi progreso" on public.lesson_progress for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.lessons l where l.id = lesson_id and public.has_course_access(l.course_id))
);

-- ---------- Permisos de la API ----------
grant select on public.plans, public.plan_courses, public.modules to anon, authenticated;
grant insert, update, delete on public.plans, public.plan_courses, public.modules to authenticated;
grant all on public.plans, public.plan_courses, public.modules to service_role;
revoke all on function public.course_access_ids(), public.has_course_access(uuid) from public;
grant execute on function public.course_access_ids(), public.has_course_access(uuid) to anon, authenticated, service_role;
