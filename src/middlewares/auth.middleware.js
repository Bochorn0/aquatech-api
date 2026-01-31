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

// Normalize path for comparison: lowercase, ensure leading /
function normalizePath(path) {
  const p = typeof path === 'string' ? path.trim().toLowerCase() : '';
  return p.startsWith('/') ? p : `/${p}`;
}

// Middleware to authorize roles (example: only 'admin' or 'manager' can access certain routes)
export const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      const role = await Role.findById(req.user.role);
      if (!role) {
        return res.status(403).json({ message: 'Forbidden: Role not found' });
      }
      if (!roles.includes(role.name)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }
      next();
    } catch (error) {
      console.error('Role Authorization Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  };
};

/**
 * Require the user's role to have at least one of the given permissions (same as frontend menu permissions).
 * API permission mapping (see index.js):
 *   /  -> dashboard, clients, metrics, cities, notifications, reportes, sensor-data
 *   /equipos -> products (read)
 *   /puntoVenta -> puntoVentas
 *   /usuarios -> users, roles
 *   /controladores -> controllers
 * Backward compat: if role has no permissions array (undefined/empty), allow if role.name is 'admin' or 'cliente'.
 */
export const requirePermission = (...allowedPaths) => {
  const normalizedAllowed = allowedPaths.map(normalizePath).filter(Boolean);
  return async (req, res, next) => {
    try {
      const role = await Role.findById(req.user.role);
      if (!role) {
        return res.status(403).json({ message: 'Forbidden: Role not found' });
      }
      const perms = role.permissions && Array.isArray(role.permissions) ? role.permissions : [];
      const normalizedPerms = perms.map(normalizePath);
      // Backward compat: no permissions set -> allow admin and cliente by role name
      if (normalizedPerms.length === 0) {
        if (['admin', 'cliente'].includes(role.name)) {
          return next();
        }
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }
      const hasAccess = normalizedAllowed.some((p) => normalizedPerms.includes(p));
      if (!hasAccess) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }
      next();
    } catch (error) {
      console.error('Permission Authorization Error:', error);
      res.status(500).json({ message: 'Server Error' });
    }
  };
};