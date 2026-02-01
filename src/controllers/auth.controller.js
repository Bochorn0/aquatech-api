import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.js';
import { body, validationResult } from 'express-validator';  // Using express-validator for input validation
import emailHelper from '../utils/email.helper.js';

const SECRET_KEY = config.SECRET_KEY; // Store in env

// Register a new user with validation
export const registerUser = [
  // Validation rules
  body('email').isEmail().withMessage('Email must be a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('nombre').optional().isString().withMessage('Name must be a string'),
  body('empresa').optional().isString().withMessage('Company must be a string'),
  body('puesto').optional().isString().withMessage('Position must be a string'),

  // Register handler
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, nombre, puesto } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Usuario ya registrado' });

      const newUser = new User({
        email,
        password,  // Don't hash here; the schema will handle it
        role: '67d273b4219909a5e9b8b1d6',
        nombre: nombre || '',
        cliente: '67d26119cf18fdaf14ec2dc1',
        puesto: puesto || 'Consultor',
      });

      await newUser.save();
      res.status(201).json({ message: 'Usuario registrado, pendiente de activación' });
    } catch (error) {
      console.error('Registration Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

// Login existing user with validation
export const loginUser = [
  // Validation rules
  body('email').isEmail().withMessage('Correo electrónico debe ser una dirección de correo válida'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),

  // Login handler
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email })
      .populate('role', 'name permissions dashboardVersion') // Populate 'role' with 'name', 'permissions', 'dashboardVersion'
      .populate('cliente', 'name'); // Populate 'cliente' with 'name' and 'company' (assuming 'cliente' is a reference to a 'Client' model)
      if (user && user.status === 'pending') return res.status(400).json({ message: 'Usuario pendiente de activación' });
      if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

      // Trim the password to avoid issues with leading/trailing spaces
      const trimmedPassword = password.trim();

      // Compare entered password with stored hashed password
      const isMatch = await bcrypt.compare(trimmedPassword, user.password);

      if (!isMatch) return res.status(401).json({ message: 'Credenciales invalidas' });

      // Generate Token if passwords match
      const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '1m' });

      delete user._doc.password; // Remove password from user object
      res.json({ token, user });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

// Request password reset
export const requestPasswordReset = [
  body('email').isEmail().withMessage('Correo electrónico debe ser una dirección de correo válida'),
  
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      console.log('[requestPasswordReset] Request received for email:', email);

      const user = await User.findOne({ email });
      
      // Don't reveal if user exists or not (security best practice)
      if (!user) {
        console.log('[requestPasswordReset] User not found');
        return res.json({ 
          success: true, 
          message: 'Si el correo existe, se enviará un enlace de recuperación' 
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        console.log('[requestPasswordReset] User not active:', user.status);
        return res.status(400).json({ 
          message: 'Tu cuenta no está activa. Contacta al administrador.' 
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token expires in 1 hour

      // Save reset token to user
      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();
      console.log('[requestPasswordReset] Reset token saved for user:', user.email);

      // Send password reset email
      const emailResult = await emailHelper.sendPasswordResetEmail({
        to: user.email,
        resetToken,
        userName: user.nombre || user.email,
      });

      if (!emailResult.success) {
        console.error('[requestPasswordReset] Error sending email:', emailResult.error);
        // Still return success to user (don't reveal email issues)
        return res.json({ 
          success: true, 
          message: 'Si el correo existe, se enviará un enlace de recuperación' 
        });
      }

      console.log('[requestPasswordReset] Password reset email sent successfully');
      res.json({ 
        success: true, 
        message: 'Si el correo existe, se enviará un enlace de recuperación' 
      });
    } catch (error) {
      console.error('[requestPasswordReset] Password Reset Request Error:', error);
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
  },
];

// Verify reset token
export const verifyResetToken = [
  body('token').notEmpty().withMessage('Token es requerido'),
  
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;

    try {
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() }, // Token not expired
      });

      if (!user) {
        return res.status(400).json({ 
          message: 'Token inválido o expirado' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Token válido',
        email: user.email 
      });
    } catch (error) {
      console.error('Verify Reset Token Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];

// Reset password
export const resetPassword = [
  body('token').notEmpty().withMessage('Token es requerido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() }, // Token not expired
      });

      if (!user) {
        return res.status(400).json({ 
          message: 'Token inválido o expirado' 
        });
      }

      // Update password (will be hashed by pre-save hook)
      user.password = password;
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await user.save();

      res.json({ 
        success: true, 
        message: 'Contraseña restablecida exitosamente' 
      });
    } catch (error) {
      console.error('Reset Password Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];
