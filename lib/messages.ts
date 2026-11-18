export const MSG: Record<string, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  sin_confirmar: 'Confirma tu correo antes de entrar: te enviamos un enlace.',
  registro: 'No hemos podido crear la cuenta. Puede que ese correo ya esté registrado.',
  datos: 'Revisa los datos del formulario.',
  password_corta: 'La contraseña debe tener al menos 10 caracteres, con letras y números.',
  password_distinta: 'Las contraseñas no coinciden.',
  legal: 'Debes aceptar la política de privacidad y las condiciones.',
  enlace: 'El enlace no es válido o ha caducado. Pide uno nuevo.',
  demasiados: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  error: 'Algo ha fallado. Inténtalo de nuevo.',
  pagos_no_listos: 'Los pagos se activarán muy pronto.',
  pago_pendiente: 'Tienes un pago pendiente. Actualiza tu tarjeta en "Gestionar suscripción" antes de cambiar de plan.',
  precio: 'Revisa el nombre y los precios (solo números, por ejemplo 19 o 19,90).',
  plan_en_uso: 'Ese plan lo tiene o lo tuvo alguna alumna, así que no se puede borrar. Ocúltalo quitando "Publicado".',
  modulo_curso: 'Ese módulo es de otro curso.',
  stripe: 'Stripe no ha aceptado el cambio. Revisa las claves de Stripe e inténtalo de nuevo.',
  // éxitos
  revisa_correo: 'Te hemos enviado un correo para confirmar tu cuenta.',
  recuperar_enviado: 'Si el correo existe, te hemos enviado un enlace para crear una nueva contraseña.',
  password_cambiada: 'Contraseña actualizada.',
  guardado: 'Cambios guardados.',
  plan_cambiado: 'Plan actualizado. En unos segundos verás tus nuevos cursos.',
};
export const msg = (code?: string) => (code && MSG[code]) || undefined;

export function validPassword(p: string) {
  return p.length >= 10 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p);
}
export function validEmail(e: string) {
  return e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}
