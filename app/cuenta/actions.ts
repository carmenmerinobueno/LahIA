'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export async function updateProfile(form: FormData) {
  const name = String(form.get('name') ?? '').trim().slice(0, 120);
  if (!name) redirect('/cuenta?error=datos');
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
  redirect(error ? '/cuenta?error=error' : '/cuenta?ok=guardado');
}

export async function deleteAccount(form: FormData) {
  if (String(form.get('confirm') ?? '').trim().toUpperCase() !== 'BORRAR') redirect('/cuenta?error=datos');
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) redirect('/cuenta?error=error');
  await supabase.auth.signOut();
  redirect('/?cuenta=borrada');
}
