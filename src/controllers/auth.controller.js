import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { body, validationResult } from 'express-validator';  // Using express-validator for input validation

const SECRET_KEY = config.SECRET_KEY; // Store in env

// Register a new user with validation
export const registerUser = [
  // Validation rules
  body('email').isEmail().withMessage('Email must be a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role').optional().isMongoId().withMessage('Role must be a valid MongoDB ObjectId'),
  body('nombre').optional().isString().withMessage('Name must be a string'),
  body('empresa').optional().isString().withMessage('Company must be a string'),
  body('puesto').optional().isString().withMessage('Position must be a string'),

  // Register handler
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role, nombre, empresa, puesto } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Usuario ya registrado' });

      const newUser = new User({
        email,
        password,  // Don't hash here; the schema will handle it
        role: role || 'user',
        nombre: nombre || '',
        empresa: empresa || 'Aquatech',
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
      .populate('role', 'name') // Populate 'role' with only the 'name' field
      .populate('cliente', 'name'); // Populate 'cliente' with 'name' and 'company' (assuming 'cliente' is a reference to a 'Client' model)
      if (user && user.status === 'pending') return res.status(400).json({ message: 'Usuario pendiente de activación' });
      if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

      // Trim the password to avoid issues with leading/trailing spaces
      const trimmedPassword = password.trim();

      // Compare entered password with stored hashed password
      const isMatch = await bcrypt.compare(trimmedPassword, user.password);

      if (!isMatch) return res.status(401).json({ message: 'Credenciales invalidas' });

      // Generate Token if passwords match
      const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '8h' });

      delete user._doc.password; // Remove password from user object
      res.json({ token, user });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  },
];
