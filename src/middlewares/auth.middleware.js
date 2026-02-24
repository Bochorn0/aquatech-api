// src/middleware/auth.middleware.js

import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import RoleModel from '../models/postgres/role.model.js';

const SECRET_KEY = config.SECRET_KEY;

export const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Tu token es invalido o ha expirado' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Tu token es invalido o ha expirado' });
    }
    req.user = decoded;
    next();
  });
};

function normalizePath(path) {
  const p = typeof path === 'string' ? path.trim().toLowerCase() : '';
  return p.startsWith('/') ? p : `/${p}`;
}

export const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      const role = await RoleModel.findById(req.user.role);
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

export const requirePermission = (...allowedPaths) => {
  const normalizedAllowed = allowedPaths.map(normalizePath).filter(Boolean);
  return async (req, res, next) => {
    try {
      const role = await RoleModel.findById(req.user.role);
      if (!role) {
        return res.status(403).json({ message: 'Forbidden: Role not found' });
      }
      const perms = role.permissions && Array.isArray(role.permissions) ? role.permissions : [];
      const normalizedPerms = perms.map(normalizePath);
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
