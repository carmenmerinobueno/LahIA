'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';

const UUID = /^[0-9a-f-]{36}$/i;

export async function toggleDone(form: FormData) {
  const lessonId = String(form.get('lesson') ?? '');
  const slug = String(form.get('slug') ?? '').replace(/[^a-z0-9-]/g, '');
  if (!UUID.test(lessonId)) return;
  const { supabase, user } = await requireUser();
  if (form.get('done') === '1') {
    await supabase.from('lesson_progress').delete().eq('lesson_id', lessonId).eq('user_id', user.id);
  } else {
    await supabase.from('lesson_progress').insert({ lesson_id: lessonId, user_id: user.id });
  }
  revalidatePath(`/academia/curso/${slug}`);
}
