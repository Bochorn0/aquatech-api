import { Router } from 'express';
import { getActiveUsers, updateUser } from '../controllers/user.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';  // Corrected import


const router = Router();
// Protected Route: Get Active Users (only admin can access)
router.get('/', authenticate, authorizeRoles('admin'), getActiveUsers);

// Protected Route: Update User (only user can access)
router.patch('/:id', authenticate, authorizeRoles('admin'), updateUser);

// Example protected route
// router.get('/admin-dashboard', authenticate, authorizeRoles('admin'), (req, res) => {
// res.json({ message: 'Welcome to the admin dashboard!' });
// });


export default router;
