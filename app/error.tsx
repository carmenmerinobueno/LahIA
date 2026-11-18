'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap section" style={{ textAlign: 'center', padding: '120px 24px' }}>
      <h1 style={{ marginBottom: 16 }}>Algo ha fallado.</h1>
      <p className="mute" style={{ marginBottom: 20 }}>Inténtalo de nuevo en un momento.</p>
      <button className="btn b-iv" onClick={reset}>Reintentar</button>
    </div>
  );
}
