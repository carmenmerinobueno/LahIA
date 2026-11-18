'use client';
import { useState } from 'react';

/** Contraseña + repetirla, con los requisitos a la vista: verde si se cumplen, rojo si no. */
export function PasswordFields({ label = 'Contraseña', again = 'Repite la contraseña' }: { label?: string; again?: string }) {
  const [p, setP] = useState('');
  const [p2, setP2] = useState('');
  const rules: [string, boolean][] = [
    ['Al menos 10 caracteres', p.length >= 10],
    ['Al menos una letra', /[A-Za-zÀ-ÿ]/.test(p)],
    ['Al menos un número', /\d/.test(p)],
    ['Las dos contraseñas coinciden', p.length > 0 && p === p2],
  ];
  return (
    <>
      <label>{label}<input name="password" type="password" autoComplete="new-password" required minLength={10} value={p} onChange={(e) => setP(e.target.value)} aria-describedby="pw-rules" /></label>
      <label>{again}<input name="password2" type="password" autoComplete="new-password" required minLength={10} value={p2} onChange={(e) => setP2(e.target.value)} aria-describedby="pw-rules" aria-invalid={p2.length > 0 && p !== p2} /></label>
      <ul id="pw-rules" className="pw-rules" aria-live="polite">
        {rules.map(([t, v]) => (
          <li key={t} className={v ? 'ok' : 'no'}><span aria-hidden="true">{v ? '✓' : '✕'}</span> {t}<span className="sr">{v ? ' (cumplido)' : ' (pendiente)'}</span></li>
        ))}
      </ul>
    </>
  );
}
