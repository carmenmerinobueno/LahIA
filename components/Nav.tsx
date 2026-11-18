import Link from 'next/link';
import { supabaseReady } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export async function Nav() {
  let logged = false;
  let admin = false;
  if (supabaseReady) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    logged = Boolean(user);
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      admin = data?.role === 'admin';
    }
  }
  return (
    <header className="nav">
      <div className="wrap">
        <a className="logo" href="/">Somos La<b><i>h</i>IA</b></a>
        <nav aria-label="Principal">
          <Link href="/academia">Academia</Link>
          {admin && <Link href="/admin">Administración</Link>}
          {logged ? (
            <>
              <Link href="/cuenta">Mi cuenta</Link>
              <form action="/auth/salir" method="post"><button className="btn b-ln b-sm" type="submit">Salir</button></form>
            </>
          ) : (
            <Link className="btn b-iv b-sm" href="/entrar" style={{ color: 'var(--night)' }}>Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
