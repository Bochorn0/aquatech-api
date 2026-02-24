import NotificationModel from '../models/postgres/notification.model.js';
import UserModel from '../models/postgres/user.model.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    const notifications = await NotificationModel.findByUserId(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await NotificationModel.findById(notificationId);
    if (!notification || String(notification.user_id) !== String(req.user.id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ message: 'Error fetching notification' });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await NotificationModel.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    await NotificationModel.update(id, { is_unread: false });
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

export const markAllNotificationAsRead = async (req, res) => {
  try {
    const userId = req.body.userId || req.user?.id;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    await NotificationModel.markAllAsRead(userId);
    res.status(200).json({ message: 'Notificaciones actualizadas' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { title, description, type, avatarUrl } = req.body;
    const newNotification = await NotificationModel.create({
      user_id: req.user.id,
      title,
      description,
      avatarUrl,
      type,
      posted_at: new Date(),
      is_unread: true
    });
    res.status(201).json(newNotification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Error creating notification' });
  }
};

export const generateAdminNotification = async (req, res) => {
  try {
    const { title, description, type, avatarUrl } = req.body;
    const users = await UserModel.find({ status: 'active' });
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    const notifications = [];
    for (const user of users) {
      const n = await NotificationModel.create({
        user_id: user.id,
        title,
        description,
        avatarUrl,
        type,
        posted_at: new Date(),
        is_unread: true
      });
      notifications.push(n);
    }
    res.status(201).json(notifications);
  } catch (error) {
    console.error('Error creating admin notification:', error);
    res.status(500).json({ message: 'Error creating admin notification' });
  }
};
