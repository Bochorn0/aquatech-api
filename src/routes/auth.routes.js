import { Router } from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Register Route
router.post('/register', registerUser);
// Authentication Route
router.post('/login', loginUser);
// verify token
router.post('/verify', authenticate, (req, res) => {
  res.json({ message: 'Token is valid' });
});
export default router;
