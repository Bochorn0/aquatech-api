import UserModel from '../models/postgres/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.js';
import { body, validationResult } from 'express-validator';
import emailHelper from '../utils/email.helper.js';

const SECRET_KEY = config.SECRET_KEY;

// Build user response for frontend (matches previous MongoDB shape)
function toUserResponse(user) {
  if (!user) return null;
  const u = typeof user.role_id !== 'undefined' ? user : UserModel.parseRow(user);
  const { password, ...rest } = u;
  return {
    ...rest,
    role: {
      _id: u.role_id,
      name: u.roleName,
      permissions: u.permissions || [],
      dashboardVersion: u.dashboardVersion || 'v1'
    },
    cliente: u.client_id ? { _id: u.client_id, name: '' } : null,
    postgresClientId: u.postgresClientId || null
  };
}

export const registerUser = [
  body('email').isEmail().withMessage('Email must be a valid email address'),
  body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters long'),
  body('nombre').optional().isString().withMessage('Name must be a string'),
  body('empresa').optional().isString().withMessage('Company must be a string'),
  body('puesto').optional().isString().withMessage('Position must be a string'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, nombre, puesto } = req.body;

    try {
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) return res.status(400).json({ message: 'Usuario ya registrado' });

      const hash = await bcrypt.hash(password, 10);
      const clienteRoleId = await getClienteRoleId();
      const defaultClientId = await getDefaultClientId();
      if (!clienteRoleId || !defaultClientId) {
        return res.status(500).json({ message: 'Configuración de roles/clientes incompleta' });
      }

      await UserModel.create({
        email,
        password: hash,
        role_id: clienteRoleId,
        client_id: defaultClientId,
        postgres_client_id: defaultClientId,
        nombre: nombre || '',
        puesto: puesto || 'Consultor'
      });

      res.status(201).json({ message: 'Usuario registrado, pendiente de activación' });
    } catch (error) {
      console.error('Registration Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

async function getClienteRoleId() {
  const { query } = await import('../config/postgres.config.js');
  const r = await query('SELECT id FROM roles WHERE LOWER(name) = $1 LIMIT 1', ['cliente']);
  return r.rows?.[0]?.id ?? null;
}

async function getDefaultClientId() {
  const { query } = await import('../config/postgres.config.js');
  const r = await query('SELECT id FROM clients ORDER BY id LIMIT 1');
  return r.rows?.[0]?.id ?? null;
}

export const loginUser = [
  body('email').isEmail().withMessage('Correo electrónico debe ser una dirección de correo válida'),
  body('password').isLength({ min: 5 }).withMessage('La contraseña debe tener al menos 5 caracteres'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await UserModel.findByEmail(email);
      if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });
      if (user.status === 'pending') return res.status(400).json({ message: 'Usuario pendiente de activación' });

      const trimmedPassword = password.trim();
      const isMatch = await bcrypt.compare(trimmedPassword, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Credenciales invalidas' });

      const token = jwt.sign({ id: user.id, role: user.role_id }, SECRET_KEY, { expiresIn: '8h' });

      const userResponse = toUserResponse({ ...user, role_id: user.role_id });
      res.json({ token, user: userResponse });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

export const requestPasswordReset = [
  body('email').isEmail().withMessage('Correo electrónico debe ser una dirección de correo válida'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email } = req.body;
      console.log('[requestPasswordReset] Request received for email:', email);

      const user = await UserModel.findByEmail(email);
      if (!user) {
        console.log('[requestPasswordReset] User not found');
        return res.json({ success: true, message: 'Si el correo existe, se enviará un enlace de recuperación' });
      }

      if (user.status !== 'active') {
        console.log('[requestPasswordReset] User not active:', user.status);
        return res.status(400).json({ message: 'Tu cuenta no está activa. Contacta al administrador.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

      await UserModel.update(user.id, {
        resetToken,
        resetTokenExpiry
      });
      console.log('[requestPasswordReset] Reset token saved for user:', user.email);

      const emailResult = await emailHelper.sendPasswordResetEmail({
        to: user.email,
        resetToken,
        userName: user.nombre || user.email
      });

      if (!emailResult.success) {
        console.error('[requestPasswordReset] Error sending email:', emailResult.error);
      }

      res.json({ success: true, message: 'Si el correo existe, se enviará un enlace de recuperación' });
    } catch (error) {
      console.error('[requestPasswordReset] Password Reset Request Error:', error);
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  },
];

export const verifyResetToken = [
  body('token').notEmpty().withMessage('Token es requerido'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token } = req.body;

    try {
      const { query } = await import('../config/postgres.config.js');
      const r = await query(
        'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW() LIMIT 1',
        [token]
      );
      const user = r.rows?.[0];

      if (!user) {
        return res.status(400).json({ message: 'Token inválido o expirado' });
      }

      res.json({ success: true, message: 'Token válido', email: user.email });
    } catch (error) {
      console.error('Verify Reset Token Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

export const resetPassword = [
  body('token').notEmpty().withMessage('Token es requerido'),
  body('password').isLength({ min: 5 }).withMessage('La contraseña debe tener al menos 5 caracteres'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;

    try {
      const { query } = await import('../config/postgres.config.js');
      const r = await query(
        'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW() LIMIT 1',
        [token]
      );
      const user = r.rows?.[0];

      if (!user) {
        return res.status(400).json({ message: 'Token inválido o expirado' });
      }

      const hash = await bcrypt.hash(password, 10);
      await UserModel.update(user.id, {
        password: hash,
        resetToken: null,
        resetTokenExpiry: null
      });

      res.json({ success: true, message: 'Contraseña restablecida exitosamente' });
    } catch (error) {
      console.error('Reset Password Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];
