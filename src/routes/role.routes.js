import { Router } from 'express';
import { getRoles, addRole, updateRole, deleteRole } from '../controllers/role.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Protected Route: Get all roles
router.get('/', authenticate, authorizeRoles('admin'), getRoles);

// Protected Route: Create a new role
router.post('/', authenticate, authorizeRoles('admin'), addRole);

// Protected Route: Update a role
router.patch('/:id', authenticate, authorizeRoles('admin'), updateRole);

// Protected Route: Delete a role
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteRole);

export default router;
