# Somos LahIA

Web de LahIA: agencia y academia de inteligencia artificial de Carmen y Gabriel.

**Tecnología:** Next.js 15 (App Router) · Supabase (cuentas + base de datos con Row Level Security) · Vercel (publicación).

## Qué incluye

| Parte | Rutas |
|---|---|
| Portada con todos los efectos | `/` (archivo `public/landing.html`) |
| Cuentas: entrar, registro, confirmar correo, recuperar contraseña | `/entrar`, `/recuperar`, `/nueva-contrasena`, `/auth/callback` |
| Academia (privada) con progreso | `/academia`, `/academia/curso/[slug]` |
| Mi cuenta: datos, contraseña, membresía, borrar cuenta (RGPD) | `/cuenta` |
| Panel de administración: resumen, cursos, lecciones, alumnos, mensajes | `/admin` (solo rol `admin`) |
| Formulario de contacto que guarda en la base de datos | `POST /api/contacto` |
| Legal + cookies + 404 + SEO | `/legal/*`, `/robots.txt`, `/sitemap.xml` |

### Seguridad
- Rutas privadas protegidas en el middleware **y** en cada página (el servidor valida la sesión con Supabase).
- Todas las tablas con **Row Level Security**: un alumno solo ve lo suyo; el contenido de las lecciones solo lo leen miembros activos; nadie puede darse el rol de admin.
- Cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.), contraseñas de 10+ caracteres, honeypot anti-bots, límite de envíos en el contacto, redirecciones solo internas.

## Puesta en marcha (una vez)

1. **Supabase** → crea un proyecto (región Europa) en https://supabase.com.
2. En **SQL Editor** pega y ejecuta `supabase/migrations/0001_init.sql`.
3. En **Authentication → URL Configuration** pon como *Site URL* la dirección de la web y añade `https://TU-DOMINIO/auth/callback` en *Redirect URLs*.
4. **Cuentas de prueba**: en *Authentication → Users → Add user* crea `admin@somoslahia.com` y `alumna@somoslahia.com` (con *Auto Confirm*). Después ejecuta `supabase/seed.sql`: la primera será administradora y la segunda alumna con membresía, y se crean 3 cursos de ejemplo.
5. **Vercel** → *Settings → Environment Variables*: añade las de `.env.example` (están en Supabase → *Project Settings → API*) y vuelve a desplegar.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev
```

## Próximas fases
Pagos (Stripe con tarjeta/Bizum + PayPal) · vídeos protegidos en Bunny Stream · foro · puntos y rachas · certificados con insignia de LinkedIn · versión en inglés · completar textos legales con los datos de la gestoría.
