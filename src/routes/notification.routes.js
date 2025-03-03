import { Router } from 'express';
import { getNotifications, getNotificationById, markNotificationAsRead, markAllNotificationAsRead, createNotification, generateAdminNotification } from '../controllers/notification.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get notifications
router.get('/', authenticate, authorizeRoles('admin', 'user'), getNotifications);

// Get specific notification by ID
router.get('/getNotification/:id', authenticate, getNotificationById);

// Mark notification as read
router.patch('/:id', authenticate, markNotificationAsRead);

// Mark notification as read
router.put('/markAllAsRead', authenticate, markAllNotificationAsRead);

// Create notification
router.post('/createNotification', authenticate, createNotification);

// Generate admin notification
router.post('/generateAdminNotification', authenticate, authorizeRoles('admin'), generateAdminNotification);

export default router;
