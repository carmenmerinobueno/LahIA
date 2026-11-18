-- =====================================================================
-- Datos de ejemplo + cuentas de prueba.
-- 1) Crea dos usuarios en Supabase → Authentication → Users → "Add user":
--      admin@somoslahia.com   (será la administradora)
--      alumna@somoslahia.com  (alumna de prueba)
--    (marca "Auto Confirm User" y pon contraseñas seguras).
-- 2) Ejecuta este archivo en el SQL Editor.
-- =====================================================================

-- Rol de administradora (cambia el correo por el tuyo real si quieres).
update public.profiles set role = 'admin', full_name = 'Carmen'
where id = (select id from auth.users where email = 'admin@somoslahia.com');

-- Alumna de prueba con membresía activa durante un año.
update public.profiles set full_name = 'Alumna de prueba'
where id = (select id from auth.users where email = 'alumna@somoslahia.com');
insert into public.memberships (user_id, plan, status, current_period_end, provider)
select id, 'monthly', 'active', now() + interval '1 year', 'manual'
from auth.users where email = 'alumna@somoslahia.com';

-- Cursos de ejemplo.
insert into public.courses (slug, title, summary, level, position, published) values
 ('ia-desde-cero', 'IA desde cero', 'Entiende qué es la IA y úsala hoy mismo en tu día a día.', 'Inicial', 1, true),
 ('chatgpt-y-claude-pro', 'ChatGPT y Claude como una profesional', 'Prompts, asistentes y flujos para ahorrar horas cada semana.', 'Intermedio', 2, true),
 ('automatiza-tu-negocio', 'Automatiza tu negocio', 'Conecta tus herramientas y deja que el trabajo se haga solo.', 'Avanzado', 3, true);

insert into public.lessons (course_id, title, position, duration_min, is_free, published)
select c.id, l.title, l.pos, l.dur, l.free, true
from public.courses c
join (values
  ('ia-desde-cero', 'Bienvenida: qué vas a conseguir', 1, 4, true),
  ('ia-desde-cero', 'Qué es (y qué no es) la IA', 2, 12, false),
  ('ia-desde-cero', 'Tu primera conversación útil', 3, 15, false),
  ('chatgpt-y-claude-pro', 'Anatomía de un buen prompt', 1, 14, true),
  ('chatgpt-y-claude-pro', 'Crea tu asistente personal', 2, 18, false),
  ('automatiza-tu-negocio', 'Mapa de tareas automatizables', 1, 10, true),
  ('automatiza-tu-negocio', 'Tu primera automatización', 2, 22, false)
) as l(slug, title, pos, dur, free) on l.slug = c.slug;

insert into public.lesson_content (lesson_id, body)
select id, 'Contenido de la lección. Aquí irá el vídeo y los apuntes.' from public.lessons;
