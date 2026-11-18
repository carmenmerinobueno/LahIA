-- Después de crear las cuentas en Authentication → Users, ejecuta esto (cambia los correos si usaste otros).
update public.profiles set role = 'admin', full_name = 'Carmen'
where email = 'admin@somoslahia.com';

update public.profiles set full_name = 'Alumna de prueba'
where email = 'alumna@somoslahia.com';

insert into public.memberships (user_id, plan, status, current_period_end, provider)
select id, 'monthly', 'active', now() + interval '1 year', 'manual'
from public.profiles where email = 'alumna@somoslahia.com';
