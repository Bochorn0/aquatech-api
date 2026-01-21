import { Router } from 'express';
import { 
  registerUser, 
  loginUser, 
  requestPasswordReset, 
  verifyResetToken, 
  resetPassword 
} from '../controllers/auth.controller.js';
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
// Password reset routes
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
