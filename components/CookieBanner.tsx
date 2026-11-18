'use client';
import { useEffect, useState } from 'react';

const KEY = 'lahia-cookies';

/** La web solo usa cookies técnicas (sesión). Si en el futuro se añade analítica, se activará solo con "Aceptar". */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(!localStorage.getItem(KEY)); }, []);
  if (!show) return null;
  const choose = (v: 'all' | 'necessary') => { localStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() })); setShow(false); };
  return (
    <div className="cookie" role="dialog" aria-label="Aviso de cookies">
      <p style={{ marginBottom: 14 }}>Usamos cookies técnicas para que puedas iniciar sesión. No usamos cookies de publicidad. <a href="/legal/cookies">Más información</a>.</p>
      <div className="row">
        <button className="btn b-iv b-sm" onClick={() => choose('all')}>Aceptar</button>
        <button className="btn b-ln b-sm" onClick={() => choose('necessary')}>Solo necesarias</button>
      </div>
    </div>
  );
}
