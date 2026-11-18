import type { Metadata } from 'next';
import Link from 'next/link';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { hasActiveMembership, requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Mi Academia', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Course = { id: string; slug: string; title: string; summary: string | null; level: string; lessons: { id: string }[] };

export default async function Academia({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const sp = await searchParams;
  if (!supabaseReady) return <NotReady />;
  const { supabase, profile } = await requireUser();
  const member = await hasActiveMembership(supabase);
  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, title, summary, level, lessons(id)')
    .order('position')
    .returns<Course[]>();
  const { data: done } = await supabase.from('lesson_progress').select('lesson_id');
  const doneSet = new Set((done ?? []).map((d) => d.lesson_id as string));
  const total = (courses ?? []).reduce((n, c) => n + c.lessons.length, 0);
  const completed = (courses ?? []).reduce((n, c) => n + c.lessons.filter((l) => doneSet.has(l.id)).length, 0);

  return (
    <div className="wrap section">
      <p className="kick">LahIA Academia</p>
      <h1>Hola, <span className="script">{profile?.full_name || 'alumna'}.</span></h1>
      <div className="row" style={{ margin: '22px 0 34px' }}>
        <span className={member ? 'pill on' : 'pill'}>{member ? 'Membresía activa' : 'Sin membresía'}</span>
        <span className="pill">{completed} de {total} lecciones completadas</span>
      </div>
      {sp.pago === 'ok' && <p className="alert ok" role="status" style={{ marginBottom: 24 }}>¡Pago completado! Bienvenida a LahIA Academia. Si aún no ves todo el contenido, recarga en unos segundos.</p>}
      {!member && (
        <div className="card" style={{ marginBottom: 28 }}>
          <h3>Desbloquea todos los cursos</h3>
          <p className="mute" style={{ margin: '8px 0 16px' }}>Puedes ver las lecciones de muestra. Hazte miembro para acceder a todo el contenido, la comunidad y los certificados.</p>
          <a className="btn b-iv" href="/precios">Ver planes</a>
        </div>
      )}
      <div className="grid g3">
        {(courses ?? []).map((c) => {
          const n = c.lessons.length;
          const d = c.lessons.filter((l) => doneSet.has(l.id)).length;
          return (
            <Link key={c.id} href={`/academia/curso/${c.slug}`} className="card" style={{ textDecoration: 'none', display: 'grid', gap: 10 }}>
              <span className="pill">{c.level}</span>
              <h3>{c.title}</h3>
              <p className="mute small">{c.summary}</p>
              <div className="bar" aria-label={`${d} de ${n} lecciones`}><i style={{ width: `${n ? (d / n) * 100 : 0}%` }} /></div>
              <span className="small mute">{d}/{n} lecciones</span>
            </Link>
          );
        })}
        {!courses?.length && <p className="mute">Pronto habrá cursos aquí.</p>}
      </div>
    </div>
  );
}
