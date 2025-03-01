import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';

const SECRET_KEY = config.SECRET_KEY; // Store in env

// Register a new user
export const registerUser = async (req, res) => {
  const { email, password, role, nombre, empresa, puesto } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({
      email,
      password,  // Don't hash here; the schema will handle it
      role: role || 'user',
      nombre: nombre || '',
      empresa: empresa || 'Aquatech',
      puesto: puesto || 'Consultor',
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


// Login existing user
// Login existing user
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    // Trim the password to avoid issues with leading/trailing spaces
    const trimmedPassword = password.trim();

    // Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(trimmedPassword, user.password);

    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate Token if passwords match
    const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '8h' });

    res.json({ token, role: user.role });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

