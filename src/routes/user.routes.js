import { Router } from 'express';
import { getActiveUsers, updateUser, deleteUser, addUser } from '../controllers/user.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Access by requirePermission('/usuarios') at mount
router.get('/', authenticate, getActiveUsers);
router.patch('/:id', authenticate, updateUser);
router.post('/', authenticate, requirePermission('/usuarios'), addUser);
router.delete('/:id', authenticate, requirePermission('/usuarios'), deleteUser);

export default router;
