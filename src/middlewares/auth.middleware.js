// src/middleware/auth.middleware.js

import jwt from 'jsonwebtoken';
import config from '../config/config.js'; // Ensure this contains the SECRET_KEY
import Role from '../models/role.model.js'; // Import the Role model

const SECRET_KEY = config.SECRET_KEY; // Your secret key

// Middleware to verify JWT token - Renamed to 'authenticate'
export const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header

  if (!token) {
    return res.status(401).json({ message: 'Tu token es invalido o ha expirado' });
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
  return async (req, res, next) => {
    try {
      // Fetch the role object from the database using the role ObjectId in the JWT
      const role = await Role.findById(req.user.role);

      if (!role) {
        return res.status(403).json({ message: 'Forbidden: Role not found' });
      }

      // Check if the role is in the allowed list of roles
      if (!roles.includes(role.name)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }

      next(); // Proceed if the user has a valid role
    } catch (error) {
      console.error('Role Authorization Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  };
};