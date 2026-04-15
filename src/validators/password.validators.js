import { body } from 'express-validator';
import { getPasswordMaxLength, validatePasswordPlaintext } from '../config/password-policy.js';

/** Login: any legacy length; only reject empty and absurdly long passwords. */
export function bodyLoginPassword() {
  return body('password')
    .isString()
    .withMessage('La contraseña es requerida')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ max: getPasswordMaxLength() })
    .withMessage('Contraseña demasiado larga');
}

/** Register, reset-password, etc. */
export function bodyNewPassword(field = 'password') {
  return body(field)
    .isString()
    .withMessage('La contraseña es requerida')
    .custom((value) => {
      const r = validatePasswordPlaintext(value);
      if (!r.ok) throw new Error(r.message);
      return true;
    });
}
