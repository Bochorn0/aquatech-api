import { Router } from 'express';
import { getActiveUsers, updateUser, deleteUser, addUser } from '../controllers/user.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';  // Corrected import


const router = Router();
// Protected Route: Get Active Users (only admin can access)
router.get('/', authenticate, getActiveUsers);


// Protected Route: Update User (only user can access)
router.patch('/:id', authenticate, authorizeRoles('admin', 'cliente'), updateUser);

router.post('/', authenticate, authorizeRoles('admin'), addUser);

// Protected Route: delete User (only user can access)
router.delete('/:id', authenticate, authorizeRoles('admin', 'user'), deleteUser);

export default router;
