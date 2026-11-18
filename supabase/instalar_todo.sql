-- Instalación completa de LahIA (base de datos vacía): copia TODO este archivo, pégalo en Supabase → SQL Editor y pulsa Run.

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

-- =====================================================================
-- Pagos con Stripe: cliente de Stripe por usuario. (Se puede ejecutar más de una vez.)
-- Solo el servidor (clave service_role) escribe aquí; el alumno solo puede leer lo suyo.
-- =====================================================================
create table if not exists public.billing_customers (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id  text unique not null,
  created_at          timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
drop policy if exists "ver mi cliente" on public.billing_customers;
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

-- =====================================================================
-- Contenido de la academia: 9 cursos con módulos y lecciones, y 6 planes.
-- OJO: reemplaza el temario (módulos y lecciones) de estos 9 cursos.
-- Ejecútalo una vez, antes de subir vídeos. Los planes que ya existan no se tocan.
-- Los precios son provisionales: cámbialos en /admin → Planes.
-- =====================================================================

insert into public.courses (slug, title, summary, level, position, published) values
 ('ia-desde-cero', 'IA desde cero', 'Entiende qué es la IA sin tecnicismos y consigue tu primer resultado útil hoy mismo.', 'Inicial', 1, true),
 ('chatgpt-y-claude-pro', 'ChatGPT y Claude como una profesional', 'Prompts, asistentes y flujos de trabajo para ahorrar horas cada semana.', 'Intermedio', 2, true),
 ('contenido-ia-redes', 'Contenido con IA para redes', 'Estrategia, guiones, voz, imagen y vídeo con IA para vender en redes.', 'Intermedio', 3, true),
 ('automatiza-tu-contenido', 'Automatiza tu contenido', 'De una sola idea salen todos los formatos, y se publican solos.', 'Avanzado', 4, true),
 ('automatiza-tu-negocio', 'Automatiza tu negocio', 'Conecta tus herramientas y deja que el trabajo repetitivo se haga solo.', 'Avanzado', 5, true),
 ('chatbots-atencion-cliente', 'Chatbots y atención al cliente con IA', 'Un asistente que atiende a tus clientes en la web, WhatsApp e Instagram.', 'Intermedio', 6, true),
 ('ia-clinicas-bienestar', 'IA para clínicas y bienestar', 'Agenda llena, pacientes atendidos y comunicación responsable con IA.', 'Intermedio', 7, true),
 ('ia-inmobiliarias', 'IA para inmobiliarias', 'Capta, atiende y cierra más operaciones con IA.', 'Intermedio', 8, true),
 ('vende-servicios-ia', 'Vende servicios de IA', 'Convierte lo que aprendes en un negocio: oferta, clientes y entrega.', 'Experta', 9, true)
on conflict (slug) do update set title = excluded.title, summary = excluded.summary, level = excluded.level, position = excluded.position;

delete from public.lessons where course_id in (select id from public.courses where slug in ('ia-desde-cero', 'chatgpt-y-claude-pro', 'contenido-ia-redes', 'automatiza-tu-contenido', 'automatiza-tu-negocio', 'chatbots-atencion-cliente', 'ia-clinicas-bienestar', 'ia-inmobiliarias', 'vende-servicios-ia'));
delete from public.modules where course_id in (select id from public.courses where slug in ('ia-desde-cero', 'chatgpt-y-claude-pro', 'contenido-ia-redes', 'automatiza-tu-contenido', 'automatiza-tu-negocio', 'chatbots-atencion-cliente', 'ia-clinicas-bienestar', 'ia-inmobiliarias', 'vende-servicios-ia'));

insert into public.modules (course_id, title, position)
select c.id, m.title, m.pos from public.courses c join (values
 ('ia-desde-cero', 'Qué es la IA y qué no', 1),
 ('ia-desde-cero', 'Tus primeras herramientas', 2),
 ('ia-desde-cero', 'Tu primer resultado', 3),
 ('chatgpt-y-claude-pro', 'El arte de pedir', 1),
 ('chatgpt-y-claude-pro', 'Tu asistente personal', 2),
 ('chatgpt-y-claude-pro', 'Trabajo diario', 3),
 ('chatgpt-y-claude-pro', 'Nivel avanzado', 4),
 ('contenido-ia-redes', 'Estrategia', 1),
 ('contenido-ia-redes', 'Guiones que venden', 2),
 ('contenido-ia-redes', 'Voz, imagen y vídeo', 3),
 ('contenido-ia-redes', 'Publicar y medir', 4),
 ('automatiza-tu-contenido', 'Tu fábrica de contenido', 1),
 ('automatiza-tu-contenido', 'Vídeo corto', 2),
 ('automatiza-tu-contenido', 'Imagen y texto', 3),
 ('automatiza-tu-contenido', 'Formatos largos', 4),
 ('automatiza-tu-contenido', 'Piloto automático', 5),
 ('automatiza-tu-negocio', 'Detectar qué automatizar', 1),
 ('automatiza-tu-negocio', 'Herramientas sin código', 2),
 ('automatiza-tu-negocio', 'Las automatizaciones que más ahorran', 3),
 ('automatiza-tu-negocio', 'IA dentro de tus automatizaciones', 4),
 ('chatbots-atencion-cliente', 'Qué chatbot necesitas', 1),
 ('chatbots-atencion-cliente', 'Constrúyelo', 2),
 ('chatbots-atencion-cliente', 'WhatsApp e Instagram', 3),
 ('ia-clinicas-bienestar', 'Agenda llena', 1),
 ('ia-clinicas-bienestar', 'Comunicación', 2),
 ('ia-clinicas-bienestar', 'Protección de datos', 3),
 ('ia-inmobiliarias', 'Captar', 1),
 ('ia-inmobiliarias', 'Atender', 2),
 ('ia-inmobiliarias', 'Cerrar', 3),
 ('vende-servicios-ia', 'Tu oferta', 1),
 ('vende-servicios-ia', 'Conseguir clientes', 2),
 ('vende-servicios-ia', 'Entregar bien', 3)
) as m(slug, title, pos) on m.slug = c.slug;

insert into public.lessons (course_id, module_id, title, position, duration_min, is_free, published)
select c.id, m.id, l.title, l.pos, l.dur, l.free, true
from (values
 ('ia-desde-cero', 1, 'Bienvenida: qué vas a conseguir', 1, 8, true),
 ('ia-desde-cero', 1, 'Cómo funciona la IA, explicado fácil', 2, 11, true),
 ('ia-desde-cero', 1, 'Mitos y miedos: lo que de verdad puede y no puede hacer', 3, 9, true),
 ('ia-desde-cero', 2, 'Crea tu cuenta en ChatGPT y Claude', 1, 10, true),
 ('ia-desde-cero', 2, 'Tu primera conversación útil', 2, 9, true),
 ('ia-desde-cero', 2, 'Cómo pedir bien las cosas', 3, 10, true),
 ('ia-desde-cero', 3, 'Un texto para tu negocio en 10 minutos', 1, 8, true),
 ('ia-desde-cero', 3, 'Siguientes pasos dentro de LahIA', 2, 7, true),
 ('chatgpt-y-claude-pro', 1, 'Anatomía de un buen prompt', 1, 7, true),
 ('chatgpt-y-claude-pro', 1, 'Dar contexto: la IA no lee tu mente', 2, 9, false),
 ('chatgpt-y-claude-pro', 1, 'Pedir formatos: tablas, listas, guiones', 3, 10, false),
 ('chatgpt-y-claude-pro', 1, 'Corregir y mejorar las respuestas', 4, 9, false),
 ('chatgpt-y-claude-pro', 2, 'Proyectos y memoria', 1, 7, false),
 ('chatgpt-y-claude-pro', 2, 'Enséñale tu tono de marca', 2, 7, false),
 ('chatgpt-y-claude-pro', 2, 'Plantillas que reutilizas cada día', 3, 9, false),
 ('chatgpt-y-claude-pro', 3, 'Correos, propuestas y presupuestos', 1, 10, false),
 ('chatgpt-y-claude-pro', 3, 'Resumir documentos largos', 2, 7, false),
 ('chatgpt-y-claude-pro', 3, 'Ideas y planificación de la semana', 3, 9, false),
 ('chatgpt-y-claude-pro', 4, 'Analizar hojas de cálculo', 1, 12, false),
 ('chatgpt-y-claude-pro', 4, 'Crear documentos y páginas', 2, 10, false),
 ('chatgpt-y-claude-pro', 4, 'Errores típicos y cómo evitarlos', 3, 10, false),
 ('chatgpt-y-claude-pro', 4, 'Seguridad: qué datos no compartir nunca', 4, 6, false),
 ('contenido-ia-redes', 1, 'Tu cliente ideal en una tarde', 1, 9, true),
 ('contenido-ia-redes', 1, '30 ideas de contenido en una hora', 2, 10, false),
 ('contenido-ia-redes', 1, 'Tu calendario mensual', 3, 11, false),
 ('contenido-ia-redes', 2, 'Ganchos de 3 segundos', 1, 6, false),
 ('contenido-ia-redes', 2, 'Estructura de un reel que convierte', 2, 9, false),
 ('contenido-ia-redes', 2, 'Llamadas a la acción con urgencia', 3, 6, false),
 ('contenido-ia-redes', 3, 'Tu voz con ElevenLabs', 1, 6, false),
 ('contenido-ia-redes', 3, 'Imágenes con IA para tu marca', 2, 11, false),
 ('contenido-ia-redes', 3, 'Vídeo con IA y avatares', 3, 12, false),
 ('contenido-ia-redes', 3, 'Edición rápida y subtítulos', 4, 11, false),
 ('contenido-ia-redes', 4, 'Textos adaptados a cada red', 1, 10, false),
 ('contenido-ia-redes', 4, 'Programar publicaciones', 2, 8, false),
 ('contenido-ia-redes', 4, 'Leer las métricas y repetir lo que funciona', 3, 8, false),
 ('contenido-ia-redes', 4, 'Tu sistema semanal de contenido', 4, 10, false),
 ('automatiza-tu-contenido', 1, 'El sistema completo, de la idea a la publicación', 1, 10, true),
 ('automatiza-tu-contenido', 1, 'Banco de ideas automático', 2, 7, false),
 ('automatiza-tu-contenido', 1, 'Tu voz de marca guardada en la IA', 3, 6, false),
 ('automatiza-tu-contenido', 2, 'Reels, TikTok y Shorts con guion, voz IA y avatar', 1, 6, false),
 ('automatiza-tu-contenido', 2, 'Subtítulos automáticos', 2, 11, false),
 ('automatiza-tu-contenido', 2, 'Cortar un vídeo largo en 10 clips', 3, 6, false),
 ('automatiza-tu-contenido', 3, 'Carruseles automáticos', 1, 9, false),
 ('automatiza-tu-contenido', 3, 'Posts y textos adaptados a cada red', 2, 9, false),
 ('automatiza-tu-contenido', 3, 'Portadas y miniaturas con IA', 3, 11, false),
 ('automatiza-tu-contenido', 4, 'Vídeos de YouTube con IA', 1, 8, false),
 ('automatiza-tu-contenido', 4, 'Newsletter y blog que se escriben solos, con tu revisión', 2, 9, false),
 ('automatiza-tu-contenido', 4, 'Podcast con tu voz clonada', 3, 6, false),
 ('automatiza-tu-contenido', 5, 'De una idea a 30 publicaciones', 1, 11, false),
 ('automatiza-tu-contenido', 5, 'Programarlo todo en Instagram, TikTok, Facebook, YouTube y LinkedIn', 2, 7, false),
 ('automatiza-tu-contenido', 5, 'Reciclar lo que ya funcionó', 3, 9, false),
 ('automatiza-tu-contenido', 5, 'Revisar el sistema cada mes', 4, 11, false),
 ('automatiza-tu-negocio', 1, 'Mapa de tus tareas', 1, 12, true),
 ('automatiza-tu-negocio', 1, 'Calcula las horas que recuperas', 2, 12, false),
 ('automatiza-tu-negocio', 1, 'Prioriza: qué automatizar primero', 3, 6, false),
 ('automatiza-tu-negocio', 2, 'Make, Zapier y n8n comparadas', 1, 9, false),
 ('automatiza-tu-negocio', 2, 'Tu primera automatización', 2, 7, false),
 ('automatiza-tu-negocio', 2, 'Errores y cómo arreglarlos', 3, 6, false),
 ('automatiza-tu-negocio', 3, 'Formularios a hoja de cálculo', 1, 9, false),
 ('automatiza-tu-negocio', 3, 'Citas y recordatorios', 2, 9, false),
 ('automatiza-tu-negocio', 3, 'Facturas sin tocarlas', 3, 11, false),
 ('automatiza-tu-negocio', 3, 'Correos de seguimiento', 4, 12, false),
 ('automatiza-tu-negocio', 4, 'Clasificar mensajes con IA', 1, 7, false),
 ('automatiza-tu-negocio', 4, 'Responder correos con IA', 2, 12, false),
 ('automatiza-tu-negocio', 4, 'Informes automáticos', 3, 9, false),
 ('chatbots-atencion-cliente', 1, 'Web, WhatsApp o Instagram: cuál elegir', 1, 8, true),
 ('chatbots-atencion-cliente', 1, 'Qué debe y qué no debe responder', 2, 7, false),
 ('chatbots-atencion-cliente', 1, 'Diseña sus respuestas', 3, 11, false),
 ('chatbots-atencion-cliente', 2, 'Entrénalo con la información de tu negocio', 1, 6, false),
 ('chatbots-atencion-cliente', 2, 'Conéctalo a tu web', 2, 7, false),
 ('chatbots-atencion-cliente', 2, 'Pasar la conversación a una persona', 3, 11, false),
 ('chatbots-atencion-cliente', 3, 'Respuestas automáticas en WhatsApp', 1, 10, false),
 ('chatbots-atencion-cliente', 3, 'Mensajes automáticos en Instagram', 2, 10, false),
 ('chatbots-atencion-cliente', 3, 'Reservar citas desde el chat', 3, 11, false),
 ('chatbots-atencion-cliente', 3, 'Medir y mejorar', 4, 12, false),
 ('ia-clinicas-bienestar', 1, 'Recordatorios de cita automáticos', 1, 7, true),
 ('ia-clinicas-bienestar', 1, 'Reducir las ausencias', 2, 9, false),
 ('ia-clinicas-bienestar', 1, 'Recuperar pacientes inactivos', 3, 8, false),
 ('ia-clinicas-bienestar', 2, 'Contenido de salud responsable', 1, 11, false),
 ('ia-clinicas-bienestar', 2, 'Respuestas a preguntas frecuentes', 2, 10, false),
 ('ia-clinicas-bienestar', 2, 'Pedir y responder reseñas', 3, 10, false),
 ('ia-clinicas-bienestar', 2, 'Campañas por temporada', 4, 12, false),
 ('ia-clinicas-bienestar', 3, 'Qué datos nunca meter en una IA', 1, 8, false),
 ('ia-clinicas-bienestar', 3, 'RGPD en salud, sin miedo', 2, 12, false),
 ('ia-clinicas-bienestar', 3, 'Tu protocolo de uso de IA', 3, 10, false),
 ('ia-inmobiliarias', 1, 'Anuncios que venden', 1, 7, true),
 ('ia-inmobiliarias', 1, 'Fotos mejoradas y vídeos de viviendas', 2, 8, false),
 ('ia-inmobiliarias', 1, 'Captación de propietarios', 3, 10, false),
 ('ia-inmobiliarias', 2, 'Responder a interesados al momento', 1, 10, false),
 ('ia-inmobiliarias', 2, 'Filtrar compradores', 2, 10, false),
 ('ia-inmobiliarias', 2, 'Agendar visitas solas', 3, 11, false),
 ('ia-inmobiliarias', 3, 'Seguimiento automático', 1, 9, false),
 ('ia-inmobiliarias', 3, 'Documentos y contratos con IA', 2, 11, false),
 ('ia-inmobiliarias', 3, 'Tu sistema completo', 3, 6, false),
 ('vende-servicios-ia', 1, 'Qué servicios de IA vender', 1, 7, true),
 ('vende-servicios-ia', 1, 'Cómo poner precio', 2, 12, false),
 ('vende-servicios-ia', 1, 'Tu primer servicio piloto', 3, 10, false),
 ('vende-servicios-ia', 2, 'Contenido que atrae clientes', 1, 6, false),
 ('vende-servicios-ia', 2, 'Mensajes directos que funcionan', 2, 12, false),
 ('vende-servicios-ia', 2, 'La llamada de venta', 3, 6, false),
 ('vende-servicios-ia', 2, 'Objeciones y cómo responderlas', 4, 7, false),
 ('vende-servicios-ia', 3, 'Propuesta y contrato', 1, 10, false),
 ('vende-servicios-ia', 3, 'Entrega y soporte', 2, 12, false),
 ('vende-servicios-ia', 3, 'Convertir clientes en recurrentes', 3, 6, false)
) as l(slug, mpos, title, pos, dur, free)
join public.courses c on c.slug = l.slug
join public.modules m on m.course_id = c.id and m.position = l.mpos;

insert into public.lesson_content (lesson_id, body)
select l.id, 'Aquí irán el vídeo y los apuntes de esta lección.'
from public.lessons l where not exists (select 1 from public.lesson_content x where x.lesson_id = l.id);

insert into public.plans (slug, name, tagline, monthly_eur, yearly_eur, all_courses, highlighted, position, perks, published) values
 ('esencial', 'LahIA Esencial', 'Para quien empieza de cero con la IA.', 19, 190, false, false, 1, array['Los cursos de base','Certificado de cada curso','Comunidad LahIA']::text[], true),
 ('creadora', 'LahIA Creadora', 'Para quien vende con contenido en redes.', 37, 370, false, false, 2, array['Todo Esencial','Contenido con IA para redes','Automatiza tu contenido','Plantillas de guiones']::text[], true),
 ('automatiza', 'LahIA Automatiza', 'Para quien pierde horas en tareas repetidas.', 37, 370, false, false, 3, array['Todo Esencial','Automatiza tu negocio','Chatbots y atención al cliente','Automatizaciones listas para copiar']::text[], true),
 ('salud-bienestar', 'LahIA Salud y Bienestar', 'Para clínicas, estética, fisioterapia y psicología.', 37, 370, false, false, 4, array['Todo Esencial','IA para clínicas y bienestar','Chatbots y atención al cliente']::text[], true),
 ('inmobiliaria', 'LahIA Inmobiliaria', 'Para agentes y agencias inmobiliarias.', 37, 370, false, false, 5, array['Todo Esencial','IA para inmobiliarias','Chatbots y atención al cliente']::text[], true),
 ('total', 'LahIA Total', 'Absolutamente todo, y ventajas que solo tiene este plan.', 97, 970, true, true, 6, array['Todos los cursos, actuales y futuros','Curso exclusivo: Vende servicios de IA','Cursos nuevos antes que nadie','Biblioteca de plantillas, prompts y automatizaciones','Comunidad privada Total','Respuesta prioritaria en menos de 24 h','Certificados de todos los cursos','20 % de descuento en servicios de la agencia']::text[], true)
on conflict (slug) do nothing;

insert into public.plan_courses (plan_id, course_id)
select p.id, c.id from (values
 ('esencial', 'ia-desde-cero'),
 ('esencial', 'chatgpt-y-claude-pro'),
 ('creadora', 'ia-desde-cero'),
 ('creadora', 'chatgpt-y-claude-pro'),
 ('creadora', 'contenido-ia-redes'),
 ('creadora', 'automatiza-tu-contenido'),
 ('automatiza', 'ia-desde-cero'),
 ('automatiza', 'chatgpt-y-claude-pro'),
 ('automatiza', 'automatiza-tu-negocio'),
 ('automatiza', 'chatbots-atencion-cliente'),
 ('salud-bienestar', 'ia-desde-cero'),
 ('salud-bienestar', 'chatgpt-y-claude-pro'),
 ('salud-bienestar', 'ia-clinicas-bienestar'),
 ('salud-bienestar', 'chatbots-atencion-cliente'),
 ('inmobiliaria', 'ia-desde-cero'),
 ('inmobiliaria', 'chatgpt-y-claude-pro'),
 ('inmobiliaria', 'ia-inmobiliarias'),
 ('inmobiliaria', 'chatbots-atencion-cliente')
) as v(plan, course)
join public.plans p on p.slug = v.plan
join public.courses c on c.slug = v.course
on conflict do nothing;
