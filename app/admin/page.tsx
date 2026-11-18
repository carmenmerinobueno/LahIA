import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/Alert';
import { NotReady } from '@/components/NotReady';
import { supabaseReady } from '@/lib/env';
import { msg } from '@/lib/messages';
import { requireAdmin } from '@/lib/auth';
import * as A from './actions';

export const metadata: Metadata = { title: 'Administración', robots: { index: false } };
export const dynamic = 'force-dynamic';

const TABS = [['resumen', 'Resumen'], ['cursos', 'Cursos'], ['lecciones', 'Lecciones'], ['alumnos', 'Alumnos'], ['mensajes', 'Mensajes']] as const;
const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  if (!supabaseReady) return <NotReady />;
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'resumen';
  const { supabase } = await requireAdmin();

  const [courses, lessons, profiles, memberships, messages] = await Promise.all([
    supabase.from('courses').select('id, slug, title, level, position, published').order('position'),
    supabase.from('lessons').select('id, course_id, title, position, duration_min, is_free, published').order('position'),
    supabase.from('profiles').select('id, full_name, email, role, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('memberships').select('user_id, plan, status, current_period_end'),
    supabase.from('contact_messages').select('id, name, email, kind, message, handled, created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  const C = courses.data ?? [], L = lessons.data ?? [], P = profiles.data ?? [], M = memberships.data ?? [], X = messages.data ?? [];
  const activeFor = (uid: string) => M.find((m) => m.user_id === uid && ['active', 'trialing'].includes(m.status) && (!m.current_period_end || new Date(m.current_period_end) > new Date()));
  const activeCount = P.filter((p) => activeFor(p.id)).length;

  return (
    <div className="wrap section">
      <p className="kick">Administración</p>
      <h1 style={{ marginBottom: 22 }}>Panel de <span className="script">LahIA.</span></h1>
      <nav className="tabs" aria-label="Secciones" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(([k, t]) => <Link key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? 'page' : undefined}>{t}</Link>)}
      </nav>
      <div style={{ marginBottom: 18 }}><Alert ok={msg(sp.ok)} error={msg(sp.error)} /></div>

      {tab === 'resumen' && (
        <div className="grid g3">
          {[['Alumnos registrados', P.length], ['Membresías activas', activeCount], ['Cursos publicados', C.filter((c) => c.published).length], ['Lecciones', L.length], ['Mensajes sin responder', X.filter((m) => !m.handled).length]].map(([t, n]) => (
            <div key={t} className="card"><p className="mute small">{t}</p><p style={{ fontSize: 44, fontFamily: 'Inter Tight', fontWeight: 600 }}>{n}</p></div>
          ))}
        </div>
      )}

      {tab === 'cursos' && (
        <div className="grid" style={{ gap: 24 }}>
          <form className="card stack" action={A.createCourse}>
            <h3>Nuevo curso</h3>
            <div className="grid g2">
              <label>Título<input name="title" required maxLength={140} /></label>
              <label>Dirección (opcional)<input name="slug" placeholder="ia-desde-cero" pattern="[a-z0-9-]*" maxLength={80} /></label>
              <label>Nivel<select name="level" defaultValue="Inicial"><option>Inicial</option><option>Intermedio</option><option>Avanzado</option><option>Experta</option></select></label>
              <label>Orden<input name="position" type="number" defaultValue={C.length + 1} /></label>
            </div>
            <label>Resumen<textarea name="summary" maxLength={600} /></label>
            <button className="btn b-iv b-sm" type="submit">Crear curso (en borrador)</button>
          </form>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Curso</th><th>Nivel</th><th>Lecciones</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {C.map((c) => (
                  <tr key={c.id}>
                    <td>{c.position}</td><td>{c.title}<br /><span className="small mute">/{c.slug}</span></td><td>{c.level}</td>
                    <td>{L.filter((l) => l.course_id === c.id).length}</td>
                    <td><span className={c.published ? 'pill on' : 'pill'}>{c.published ? 'Publicado' : 'Borrador'}</span></td>
                    <td className="row">
                      <form action={A.toggleCourse}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="published" value={c.published ? '1' : '0'} /><button className="btn b-ln b-sm">{c.published ? 'Ocultar' : 'Publicar'}</button></form>
                      <form action={A.deleteCourse}><input type="hidden" name="id" value={c.id} /><label className="check small"><input type="checkbox" name="confirm" value="si" required />seguro</label><button className="btn b-danger b-sm">Borrar</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lecciones' && (
        <div className="grid" style={{ gap: 24 }}>
          <form className="card stack" action={A.createLesson}>
            <h3>Nueva lección</h3>
            <div className="grid g2">
              <label>Curso<select name="course_id" required>{C.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label>Título<input name="title" required maxLength={160} /></label>
              <label>Orden<input name="position" type="number" defaultValue={1} /></label>
              <label>Duración (minutos)<input name="duration" type="number" min={0} /></label>
              <label>ID del vídeo (Bunny Stream)<input name="video_id" maxLength={120} placeholder="Opcional" /></label>
            </div>
            <label>Apuntes de la lección<textarea name="body" maxLength={20000} /></label>
            <div className="row">
              <label className="check"><input type="checkbox" name="published" defaultChecked />Publicada</label>
              <label className="check"><input type="checkbox" name="is_free" />Gratis (lección de muestra)</label>
            </div>
            <button className="btn b-iv b-sm" type="submit" disabled={!C.length}>Crear lección</button>
          </form>
          {C.map((c) => (
            <div key={c.id} className="card" style={{ overflowX: 'auto' }}>
              <h3 style={{ marginBottom: 10 }}>{c.title}</h3>
              <table>
                <tbody>
                  {L.filter((l) => l.course_id === c.id).map((l) => (
                    <tr key={l.id}>
                      <td>{l.position}</td><td>{l.title}</td><td>{l.duration_min ? `${l.duration_min} min` : ''}</td>
                      <td>{l.is_free && <span className="pill wine">Gratis</span>} <span className={l.published ? 'pill on' : 'pill'}>{l.published ? 'Publicada' : 'Borrador'}</span></td>
                      <td className="row">
                        <form action={A.toggleLesson}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="published" value={l.published ? '1' : '0'} /><button className="btn b-ln b-sm">{l.published ? 'Ocultar' : 'Publicar'}</button></form>
                        <form action={A.deleteLesson}><input type="hidden" name="id" value={l.id} /><button className="btn b-danger b-sm">Borrar</button></form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'alumnos' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Alta</th><th>Membresía</th><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>
              {P.map((p) => {
                const a = activeFor(p.id);
                return (
                  <tr key={p.id}>
                    <td>{p.full_name || '—'}</td><td>{p.email}</td><td>{fmt(p.created_at)}</td>
                    <td>{a ? <span className="pill on">Activa{a.current_period_end ? ` hasta ${fmt(a.current_period_end)}` : ''}</span> : <span className="pill">No</span>}</td>
                    <td>{p.role === 'admin' ? <span className="pill wine">Admin</span> : 'Alumno'}</td>
                    <td className="row">
                      <form action={A.grantMembership} className="row">
                        <input type="hidden" name="user_id" value={p.id} />
                        <select name="plan" defaultValue="gift" aria-label="Plan" style={{ width: 'auto', minHeight: 38 }}><option value="gift">Regalo</option><option value="monthly">Mensual</option><option value="yearly">Anual</option><option value="vip">VIP</option></select>
                        <input name="months" type="number" min={1} max={36} defaultValue={1} aria-label="Meses" style={{ width: 70, minHeight: 38 }} />
                        <button className="btn b-wine b-sm">Dar acceso</button>
                      </form>
                      {a && <form action={A.revokeMemberships}><input type="hidden" name="user_id" value={p.id} /><button className="btn b-ln b-sm">Quitar acceso</button></form>}
                      <form action={A.setRole}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="role" value={p.role === 'admin' ? 'student' : 'admin'} /><button className="btn b-ln b-sm">{p.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'mensajes' && (
        <div className="grid" style={{ gap: 14 }}>
          {X.map((m) => (
            <div key={m.id} className="card" style={{ opacity: m.handled ? 0.6 : 1 }}>
              <div className="row between">
                <strong>{m.name} · <a href={`mailto:${m.email}`}>{m.email}</a></strong>
                <span className="small mute">{fmt(m.created_at)} · {m.kind}</span>
              </div>
              <p style={{ margin: '10px 0 14px', whiteSpace: 'pre-line' }}>{m.message}</p>
              <form action={A.markMessage}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="handled" value={m.handled ? '1' : '0'} /><button className="btn b-ln b-sm">{m.handled ? 'Marcar como pendiente' : 'Marcar como respondido'}</button></form>
            </div>
          ))}
          {!X.length && <p className="mute">No hay mensajes todavía.</p>}
        </div>
      )}
    </div>
  );
}
