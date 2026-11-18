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
| Planes y pago con Stripe (mensual / anual), portal para gestionar o cancelar | `/precios`, `/api/pagos/checkout`, `/api/pagos/portal`, `/api/pagos/webhook` |
| Legal + cookies + 404 + SEO | `/legal/*`, `/robots.txt`, `/sitemap.xml` |

### Seguridad
- Rutas privadas protegidas en el middleware **y** en cada página (el servidor valida la sesión con Supabase).
- Todas las tablas con **Row Level Security**: un alumno solo ve lo suyo; el contenido de cada lección solo lo leen las alumnas cuyo plan incluye ese curso; nadie puede darse el rol de admin.
- Cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.), contraseñas de 10+ caracteres, honeypot anti-bots, límite de envíos en el contacto, redirecciones solo internas.

## Puesta en marcha (una vez)

1. **Supabase** → crea un proyecto (región Europa) en https://supabase.com.
2. En **SQL Editor** pega y ejecuta `supabase/instalar_todo.sql` (base de datos + 9 cursos + 6 planes). Si ya la habías instalado antes de los planes, ejecuta en su lugar `supabase/actualizar_planes.sql`.
3. En **Authentication → URL Configuration** pon como *Site URL* la dirección de la web y añade `https://TU-DOMINIO/auth/callback` en *Redirect URLs*.
4. **Cuentas de prueba**: en *Authentication → Users → Add user* crea `admin@somoslahia.com` y `alumna@somoslahia.com` (con *Auto Confirm*). Después ejecuta `supabase/hacerme_admin.sql`: la primera será administradora y la segunda alumna con acceso a todo.
5. **Vercel** → *Settings → Environment Variables*: añade las de `.env.example` (están en Supabase → *Project Settings → API*) y vuelve a desplegar.

## Planes y cursos

- Cada **plan** abre unos cursos. *LahIA Total* tiene marcada la opción «Todos los cursos» y abre también los que se creen después.
- En **/admin → Planes** cambias nombre, frase, precios mensual y anual, ventajas, qué cursos abre, si se publica y si sale destacado. Con Stripe conectado, al guardar se crean los precios en Stripe solos (las alumnas que ya pagan conservan su precio).
- En **/admin → Lecciones** creas módulos dentro de cada curso y lecciones dentro de cada módulo.
- Una alumna suscrita que elige otro plan en `/precios` cambia de plan sin pagar dos veces: Stripe prorratea la diferencia.
- Si das acceso a mano desde **/admin → Alumnos**, eliges el plan o «Todo».

## Pagos con Stripe (modo prueba, sin cobrar)

1. Crea la cuenta en https://dashboard.stripe.com/register y deja activado **Test mode**.
2. No hace falta crear productos a mano: se crean solos al guardar cada plan en **/admin → Planes** (después del paso 5).
3. *Developers → Webhooks → Add endpoint*: `https://TU-DOMINIO/api/pagos/webhook` con los eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`. Copia el *Signing secret*.
4. *Settings → Billing → Customer portal*: actívalo (permitir cancelar, cambiar tarjeta y ver facturas).
5. Añade en Vercel `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`. Luego entra en **/admin → Planes** y pulsa «Guardar plan» en cada uno para crear sus precios.
6. Para probar en local: `stripe listen --forward-to localhost:3000/api/pagos/webhook` y paga con la tarjeta `4242 4242 4242 4242`.

## Entrar con Google

1. En https://console.cloud.google.com crea un proyecto → *APIs y servicios → Pantalla de consentimiento OAuth* (tipo Externo, nombre LahIA).
2. *Credenciales → Crear credenciales → ID de cliente de OAuth* → tipo *Aplicación web*. En *URI de redireccionamiento autorizados* pega la que te da Supabase en *Authentication → Sign In / Providers → Google* (termina en `/auth/v1/callback`).
3. Copia el *ID de cliente* y el *Secreto* en Supabase → *Google* y actívalo.
4. Pon `NEXT_PUBLIC_GOOGLE_LOGIN=1` en `.env.local` y en Vercel. Hasta entonces el botón avisa de que estará disponible pronto.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev
```

## Próximas fases
PayPal y Bizum · vídeos protegidos en Bunny Stream · foro · puntos y rachas · certificados con insignia de LinkedIn · versión en inglés · completar textos legales con los datos de la gestoría.
