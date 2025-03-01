// src/middleware/auth.middleware.js

import jwt from 'jsonwebtoken';
import config from '../config/config.js'; // Ensure this contains the SECRET_KEY

const SECRET_KEY = config.SECRET_KEY; // Your secret key

// Middleware to verify JWT token - Renamed to 'authenticate'
export const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Tu token es invalido o ha expirado' });
    }

    req.user = decoded; // Attach user info from decoded token to request
    next(); // Proceed to the next middleware or route handler
  });
};

// Middleware to authorize roles (example: only 'admin' or 'manager' can access certain routes)
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
    next(); // Proceed if the user has a valid role
  };
};
