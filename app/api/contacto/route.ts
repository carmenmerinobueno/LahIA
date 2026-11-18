import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseReady } from '@/lib/env';
import { validEmail } from '@/lib/messages';

// Límite sencillo por IP (5 mensajes cada 10 minutos por instancia).
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ ok: false }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (body.website) return NextResponse.json({ ok: true }); // honeypot: bot

  const name = String(body.name ?? '').trim().slice(0, 120);
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);
  const message = String(body.message ?? '').trim().slice(0, 4000);
  const kind = ['empresa', 'academia', 'otro'].includes(String(body.kind)) ? String(body.kind) : 'empresa';
  if (!name || !message || !validEmail(email)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!supabaseReady) return NextResponse.json({ ok: false }, { status: 503 });

  // Cliente anónimo: la política RLS solo permite insertar, nunca leer.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await supabase.from('contact_messages').insert({ name, email, message, kind });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
