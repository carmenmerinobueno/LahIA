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
  // éxitos
  revisa_correo: 'Te hemos enviado un correo para confirmar tu cuenta.',
  recuperar_enviado: 'Si el correo existe, te hemos enviado un enlace para crear una nueva contraseña.',
  password_cambiada: 'Contraseña actualizada.',
  guardado: 'Cambios guardados.',
};
export const msg = (code?: string) => (code && MSG[code]) || undefined;

export function validPassword(p: string) {
  return p.length >= 10 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p);
}
export function validEmail(e: string) {
  return e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}
