import { Router } from 'express';
import { getRoles, addRole, updateRole, deleteRole } from '../controllers/role.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Access by requirePermission('/usuarios') at mount
router.get('/', authenticate, requirePermission('/usuarios'), getRoles);
router.post('/', authenticate, requirePermission('/usuarios'), addRole);
router.patch('/:id', authenticate, requirePermission('/usuarios'), updateRole);
router.delete('/:id', authenticate, requirePermission('/usuarios'), deleteRole);

export default router;
