import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { accessibleCourses, requireUser } from '@/lib/auth';
import { toggleDone } from './actions';

export const metadata: Metadata = { title: 'Curso', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Lesson = { id: string; title: string; position: number; duration_min: number | null; is_free: boolean; module_id: string | null };
type Module = { id: string; title: string; position: number };

export default async function Curso({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ leccion?: string }> }) {
  if (!supabaseReady) return <NotReady />;
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data: course } = await supabase.from('courses').select('id, slug, title, summary, level').eq('slug', slug).maybeSingle();
  if (!course) notFound();
  const [{ data: lessons }, { data: modules }, access] = await Promise.all([
    supabase.from('lessons').select('id, title, position, duration_min, is_free, module_id').eq('course_id', course.id).order('position').returns<Lesson[]>(),
    supabase.from('modules').select('id, title, position').eq('course_id', course.id).order('position').returns<Module[]>(),
    accessibleCourses(supabase),
  ]);
  const mods = modules ?? [];
  const modPos = new Map(mods.map((m) => [m.id, m.position]));
  // Orden: por módulo y, dentro, por posición. Las lecciones sin módulo van al final.
  const list = [...(lessons ?? [])].sort((a, b) => (modPos.get(a.module_id ?? '') ?? 1e9) - (modPos.get(b.module_id ?? '') ?? 1e9) || a.position - b.position);
  const groups = [...mods.map((m) => ({ key: m.id, title: m.title as string | null, items: list.filter((l) => l.module_id === m.id) })), { key: 'otros', title: mods.length ? 'Más lecciones' : null, items: list.filter((l) => !l.module_id || !modPos.has(l.module_id)) }].filter((g) => g.items.length);
  const member = access.has(course.id);
  const current = list.find((l) => l.id === sp.leccion) ?? list[0];
  // RLS solo devuelve el contenido si su plan incluye este curso o la lección es de muestra.
  const { data: content } = current
    ? await supabase.from('lesson_content').select('video_id, body').eq('lesson_id', current.id).maybeSingle()
    : { data: null };
  const { data: done } = await supabase.from('lesson_progress').select('lesson_id');
  const doneSet = new Set((done ?? []).map((d) => d.lesson_id as string));
  const libraryId = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID;

  return (
    <div className="wrap section">
      <Link href="/academia" className="small mute">← Mis cursos</Link>
      <p className="kick" style={{ marginTop: 18 }}>{course.level}</p>
      <h1 style={{ marginBottom: 28 }}>{course.title}</h1>
      <div className="grid cg">
        <div>
          {current ? (
            <>
              <div className="player">
                {content?.video_id && libraryId ? (
                  <iframe
                    src={`https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(content.video_id)}?autoplay=false`}
                    title={current.title}
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    loading="lazy"
                  />
                ) : content ? (
                  <div><p className="script" style={{ fontSize: 34 }}>{current.title}</p><p className="mute small">El vídeo de esta lección se añadirá pronto.</p></div>
                ) : (
                  <div><p style={{ fontSize: 22, marginBottom: 12 }}>Esta lección no está en tu plan</p><a className="btn b-iv" href="/precios">Ver planes</a></div>
                )}
              </div>
              <div className="row between" style={{ marginTop: 18 }}>
                <h2 style={{ fontSize: 24 }}>{current.title}</h2>
                {member && (
                  <form action={toggleDone}>
                    <input type="hidden" name="lesson" value={current.id} />
                    <input type="hidden" name="slug" value={course.slug} />
                    <input type="hidden" name="done" value={doneSet.has(current.id) ? '1' : '0'} />
                    <button className={doneSet.has(current.id) ? 'btn b-ln b-sm' : 'btn b-wine b-sm'} type="submit">
                      {doneSet.has(current.id) ? 'Completada ✓' : 'Marcar como completada'}
                    </button>
                  </form>
                )}
              </div>
              {content?.body && <p className="mute" style={{ marginTop: 14, whiteSpace: 'pre-line' }}>{content.body}</p>}
            </>
          ) : <p className="mute">Este curso aún no tiene lecciones.</p>}
        </div>
        <aside className="card" style={{ padding: 14 }}>
          {groups.map((g) => (
            <div key={g.key} style={{ marginBottom: 12 }}>
              {g.title && <p className="kick" style={{ margin: '6px 4px 6px' }}>{g.title}</p>}
              <ol className="lessons">
                {g.items.map((l) => (
                  <li key={l.id}>
                    <Link href={`/academia/curso/${course.slug}?leccion=${l.id}`} aria-current={l.id === current?.id ? 'true' : undefined}>
                      <span>{String(list.indexOf(l) + 1).padStart(2, '0')} · {l.title}</span>
                      <span className="small mute">{doneSet.has(l.id) ? '✓' : l.is_free && !member ? 'Gratis' : !member ? 'Planes' : l.duration_min ? `${l.duration_min} min` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
