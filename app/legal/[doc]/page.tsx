import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// IMPORTANTE: textos base. Completar los datos entre [corchetes] con la gestoría antes de vender.
const TITULAR = '[Nombre y apellidos o razón social]';
const NIF = '[NIF/CIF]';
const DOMICILIO = '[Domicilio]';
const EMAIL = '[hola@somoslahia.com]';

const DOCS: Record<string, { title: string; body: React.ReactNode }> = {
  'aviso-legal': {
    title: 'Aviso legal',
    body: (<>
      <p>En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI-CE), se informa de los datos del titular de este sitio web:</p>
      <ul><li>Titular: {TITULAR}</li><li>NIF/CIF: {NIF}</li><li>Domicilio: {DOMICILIO}</li><li>Correo: {EMAIL}</li></ul>
      <h2>Uso del sitio</h2>
      <p>El acceso a la web es gratuito y supone la aceptación de este aviso. La persona usuaria se compromete a hacer un uso lícito del sitio y de sus contenidos.</p>
      <h2>Propiedad intelectual</h2>
      <p>Los textos, vídeos, cursos, diseños, marca «Somos LahIA» y demás contenidos son propiedad del titular o se usan con licencia. Queda prohibida su reproducción, distribución o descarga sin autorización expresa.</p>
      <h2>Responsabilidad</h2>
      <p>El titular no se responsabiliza del mal uso de los contenidos ni de los daños derivados de interrupciones técnicas ajenas a su control.</p>
      <h2>Legislación</h2>
      <p>Este aviso se rige por la legislación española.</p>
    </>),
  },
  privacidad: {
    title: 'Política de privacidad',
    body: (<>
      <p><strong>Responsable:</strong> {TITULAR}, {NIF}, {DOMICILIO}. Contacto: {EMAIL}.</p>
      <h2>Qué datos tratamos y para qué</h2>
      <ul>
        <li><strong>Cuenta de la Academia</strong> (nombre, correo, contraseña cifrada, progreso): para darte acceso a los cursos. Base legal: ejecución del contrato.</li>
        <li><strong>Formulario de contacto</strong> (nombre, correo, mensaje): para responderte. Base legal: tu consentimiento.</li>
        <li><strong>Pagos</strong>: los gestiona el proveedor de pago; nosotros no guardamos los datos de tu tarjeta.</li>
      </ul>
      <h2>Cuánto tiempo</h2>
      <p>Mientras tengas cuenta o mientras sea necesario para responderte, y después el tiempo que exija la ley (por ejemplo, obligaciones fiscales).</p>
      <h2>Con quién se comparten</h2>
      <p>Con proveedores que nos prestan servicio (alojamiento web, base de datos, correo, vídeo y pagos), con contratos que garantizan la protección de tus datos. No vendemos datos a nadie.</p>
      <h2>Tus derechos</h2>
      <p>Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento y pedir la portabilidad de tus datos escribiendo a {EMAIL}. Puedes borrar tu cuenta en cualquier momento desde «Mi cuenta». Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
    </>),
  },
  cookies: {
    title: 'Política de cookies',
    body: (<>
      <p>Esta web solo usa <strong>cookies técnicas</strong>, necesarias para que funcione:</p>
      <ul>
        <li><strong>sb-*</strong> (Supabase): mantienen tu sesión iniciada en la Academia. Duración: la de la sesión.</li>
        <li><strong>lahia-cookies</strong> (almacenamiento local): recuerda tu elección sobre este aviso.</li>
      </ul>
      <p>No usamos cookies de publicidad ni de seguimiento. Si en el futuro añadimos analítica, solo se activará si la aceptas.</p>
      <p>Puedes borrar las cookies desde la configuración de tu navegador.</p>
    </>),
  },
  condiciones: {
    title: 'Condiciones de contratación',
    body: (<>
      <h2>Academia</h2>
      <p>La membresía da acceso a los cursos grabados, la comunidad, los recursos y los certificados mientras esté activa. Los contenidos son para uso personal: no se pueden descargar, compartir ni revender. Compartir la cuenta puede suponer su cierre.</p>
      <h2>Precio y renovación</h2>
      <p>Los precios se muestran con impuestos incluidos. La suscripción se renueva automáticamente cada mes o cada año hasta que la canceles, cosa que puedes hacer en cualquier momento; mantendrás el acceso hasta el final del periodo pagado.</p>
      <h2>Desistimiento</h2>
      <p>Al tratarse de contenido digital al que accedes de inmediato, al empezar a usarlo aceptas que pierdes el derecho de desistimiento de 14 días (art. 103.m del Real Decreto Legislativo 1/2007).</p>
      <h2>Servicios de agencia</h2>
      <p>Los proyectos de agencia se rigen por la propuesta y el presupuesto aceptados en cada caso.</p>
      <h2>Contacto</h2>
      <p>{TITULAR} · {EMAIL}</p>
    </>),
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? 'Legal' };
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <article className="wrap section legal" style={{ maxWidth: 780 }}>
      <p className="kick">Legal</p>
      <h1 style={{ marginBottom: 20 }}>{d.title}</h1>
      {d.body}
      <p className="mute small" style={{ marginTop: 32 }}>Última actualización: noviembre de 2026.</p>
    </article>
  );
}
