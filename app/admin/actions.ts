'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';

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

export async function createLesson(f: FormData) {
  const course_id = s(f, 'course_id', 36);
  const title = s(f, 'title', 160);
  if (!UUID.test(course_id) || !title) fail('lecciones', 'datos');
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from('lessons').insert({
    course_id, title, position: Number(f.get('position')) || 0, duration_min: Number(f.get('duration')) || null,
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
  if (!UUID.test(user_id)) fail('alumnos', 'datos');
  const { supabase } = await requireAdmin();
  const end = new Date(); end.setMonth(end.getMonth() + months);
  const { error } = await supabase.from('memberships').insert({ user_id, plan, status: 'active', current_period_end: end.toISOString(), provider: 'manual' });
  error ? fail('alumnos') : done('alumnos');
}

export async function revokeMemberships(f: FormData) {
  const user_id = s(f, 'user_id', 36);
  if (!UUID.test(user_id)) fail('alumnos', 'datos');
  const { supabase } = await requireAdmin();
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
