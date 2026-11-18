'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { PLAN_FIELDS, cancelStripeSubscriptions, portalReady, syncPlanPrices, type Plan } from '@/lib/stripe';

const UUID = /^[0-9a-f-]{36}$/i;
const s = (f: FormData, k: string, max = 600) => String(f.get(k) ?? '').trim().slice(0, max);
const done = (tab: string, code = 'guardado') => { revalidatePath('/admin'); redirect(`/admin?tab=${tab}&ok=${code}`); };
const fail = (tab: string, code = 'error') => redirect(`/admin?tab=${tab}&error=${code}`);

export async function createCourse(f: FormData) {
  const { supabase } = await requireAdmin();
  const title = s(f, 'title', 140);
  const slug = (s(f, 'slug', 80) || title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!title || slug.length < 2) fail('cursos', 'datos');
  const { error } = await supabase.from('courses').insert({ title, slug, summary: s(f, 'summary'), level: s(f, 'level', 40) || 'Inicial', position: Number(f.get('position')) || 0 });
  error ? fail('cursos') : done('cursos');
}

export async function toggleCourse(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id)) fail('cursos', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('courses').update({ published: f.get('published') !== '1' }).eq('id', id);
  error ? fail('cursos') : done('cursos');
}

export async function deleteCourse(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id) || s(f, 'confirm') !== 'si') fail('cursos', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('courses').delete().eq('id', id);
  error ? fail('cursos') : done('cursos');
}

const slugify = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** "19,90" → 19.9 · vacío → null · inválido → NaN */
const money = (f: FormData, k: string) => {
  const v = s(f, k, 20).replace(/\s|€/g, '').replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : NaN;
};

export async function createModule(f: FormData) {
  const course_id = s(f, 'course_id', 36);
  const title = s(f, 'title', 160);
  if (!UUID.test(course_id) || !title) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('modules').insert({ course_id, title, position: Number(f.get('position')) || 0 });
  error ? fail('lecciones') : done('lecciones');
}

export async function deleteModule(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id)) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  // Sus lecciones no se borran: se quedan en el curso, sin módulo.
  const { error } = await supabase.from('modules').delete().eq('id', id);
  error ? fail('lecciones') : done('lecciones');
}

export async function createLesson(f: FormData) {
  const course_id = s(f, 'course_id', 36);
  const title = s(f, 'title', 160);
  const module_id = s(f, 'module_id', 36) || null;
  if (!UUID.test(course_id) || !title || (module_id && !UUID.test(module_id))) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  if (module_id) {
    const { data: m } = await supabase.from('modules').select('course_id').eq('id', module_id).maybeSingle();
    if (m?.course_id !== course_id) return fail('lecciones', 'modulo_curso');
  }
  const { data, error } = await supabase.from('lessons').insert({
    course_id, module_id, title, position: Number(f.get('position')) || 0, duration_min: Number(f.get('duration')) || null,
    is_free: f.get('is_free') === 'on', published: f.get('published') === 'on',
  }).select('id').single();
  if (error || !data) return fail('lecciones');
  const video_id = s(f, 'video_id', 120).replace(/[^A-Za-z0-9-]/g, '') || null;
  await supabase.from('lesson_content').insert({ lesson_id: data.id, video_id, body: s(f, 'body', 20000) || null });
  done('lecciones');
}

export async function toggleLesson(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id)) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('lessons').update({ published: f.get('published') !== '1' }).eq('id', id);
  error ? fail('lecciones') : done('lecciones');
}

export async function deleteLesson(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id)) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  error ? fail('lecciones') : done('lecciones');
}

export async function grantMembership(f: FormData) {
  const user_id = s(f, 'user_id', 36);
  const months = Math.min(Math.max(Number(f.get('months')) || 1, 1), 36);
  const plan = ['monthly', 'yearly', 'vip', 'gift'].includes(s(f, 'plan')) ? s(f, 'plan') : 'gift';
  const plan_id = s(f, 'plan_id', 36) || null; // vacío = acceso a todo
  if (!UUID.test(user_id) || (plan_id && !UUID.test(plan_id))) fail('alumnos', 'datos');
  const { supabase } = await requireAdmin();
  const end = new Date(); end.setMonth(end.getMonth() + months);
  const { error } = await supabase.from('memberships').insert({ user_id, plan, plan_id, status: 'active', current_period_end: end.toISOString(), provider: 'manual' });
  error ? fail('alumnos') : done('alumnos');
}

export async function revokeMemberships(f: FormData) {
  const user_id = s(f, 'user_id', 36);
  if (!UUID.test(user_id)) fail('alumnos', 'datos');
  const { supabase } = await requireAdmin();
  // Si pagaba con Stripe, se cancela también allí; si no, el siguiente aviso de Stripe le devolvería el acceso.
  try { await cancelStripeSubscriptions(user_id); } catch { return fail('alumnos'); }
  const { error } = await supabase.from('memberships').update({ status: 'canceled' }).eq('user_id', user_id).in('status', ['active', 'trialing']);
  error ? fail('alumnos') : done('alumnos');
}

export async function setRole(f: FormData) {
  const id = s(f, 'id', 36);
  const role = s(f, 'role') === 'admin' ? 'admin' : 'student';
  if (!UUID.test(id)) fail('alumnos', 'datos');
  const { supabase, user } = await requireAdmin();
  if (id === user.id && role !== 'admin') fail('alumnos', 'datos'); // no quitarte a ti misma el acceso
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  error ? fail('alumnos') : done('alumnos');
}

export async function markMessage(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id)) fail('mensajes', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('contact_messages').update({ handled: f.get('handled') !== '1' }).eq('id', id);
  error ? fail('mensajes') : done('mensajes');
}

// ---------- Planes ----------

export async function createPlan(f: FormData) {
  const name = s(f, 'name', 80);
  const slug = slugify(s(f, 'slug', 60) || name.replace(/^LahIA\s+/i, ''));
  if (!name || slug.length < 2) fail('planes', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('plans').insert({ name, slug, position: Number(f.get('position')) || 0 });
  error ? fail('planes') : done('planes');
}

export async function savePlan(f: FormData) {
  const id = s(f, 'id', 36);
  const name = s(f, 'name', 80);
  const monthly_eur = money(f, 'monthly_eur');
  const yearly_eur = money(f, 'yearly_eur');
  if (!UUID.test(id) || !name || Number.isNaN(monthly_eur) || Number.isNaN(yearly_eur)) fail('planes', 'precio');
  const courseIds = f.getAll('courses').map(String).filter((c) => UUID.test(c));
  const perks = s(f, 'perks', 3000).split('\n').map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, 20);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from('plans').update({
    name, tagline: s(f, 'tagline', 200) || null, perks, monthly_eur, yearly_eur,
    position: Number(f.get('position')) || 0,
    all_courses: f.get('all_courses') === 'on', highlighted: f.get('highlighted') === 'on', published: f.get('published') === 'on',
  }).eq('id', id);
  if (error) return fail('planes');

  const { error: delError } = await supabase.from('plan_courses').delete().eq('plan_id', id);
  if (delError) return fail('planes');
  if (courseIds.length) {
    const { error: insError } = await supabase.from('plan_courses').insert(courseIds.map((course_id) => ({ plan_id: id, course_id })));
    if (insError) return fail('planes');
  }

  // Con Stripe conectado, los precios se crean o actualizan solos.
  if (portalReady) {
    const { data: plan } = await supabase.from('plans').select(PLAN_FIELDS).eq('id', id).single<Plan>();
    if (plan) {
      try {
        const ids = await syncPlanPrices(plan);
        const { error: idsError } = await supabase.from('plans').update(ids).eq('id', id);
        if (idsError) return fail('planes', 'stripe');
      } catch (e) {
        console.error('stripe precios', e);
        return fail('planes', 'stripe');
      }
    }
  }
  done('planes');
}

export async function deletePlan(f: FormData) {
  const id = s(f, 'id', 36);
  if (!UUID.test(id) || s(f, 'confirm') !== 'si') fail('planes', 'datos');
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('plans').delete().eq('id', id);
  // Si alguna alumna lo tiene (o lo tuvo), no se puede borrar: se oculta.
  error ? fail('planes', error.code === '23503' ? 'plan_en_uso' : 'error') : done('planes');
}
