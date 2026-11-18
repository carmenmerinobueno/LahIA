export function NotReady() {
  return (
    <div className="wrap section">
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="kick">Casi listo</p>
        <h2>La Academia se está <span className="script">preparando.</span></h2>
        <p className="mute" style={{ marginTop: 12 }}>
          Falta conectar la base de datos (Supabase). En cuanto se añadan las claves en Vercel, el registro y el área de alumnos funcionarán.
        </p>
      </div>
    </div>
  );
}
