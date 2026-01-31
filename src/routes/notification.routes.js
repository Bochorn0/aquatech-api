import { Router } from 'express';
import { getNotifications, getNotificationById, markNotificationAsRead, markAllNotificationAsRead, createNotification, generateAdminNotification } from '../controllers/notification.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Read/update access by requirePermission('/') at mount
router.get('/', authenticate, getNotifications);
router.get('/getNotification/:id', authenticate, getNotificationById);
router.patch('/:id', authenticate, markNotificationAsRead);
router.put('/markAllAsRead', authenticate, markAllNotificationAsRead);
router.post('/createNotification', authenticate, createNotification);

// Generate admin notification: require /usuarios
router.post('/generateAdminNotification', authenticate, requirePermission('/usuarios'), generateAdminNotification);

export default router;
