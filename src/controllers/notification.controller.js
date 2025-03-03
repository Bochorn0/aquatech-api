import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';

// Controller to get notifications for a specific user
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.query; 
    // Fetch notifications for the logged-in user, sorted by postedAt (descending)
    const notifications = await Notification.find({ user: userId })
      .sort({ postedAt: -1 })
      .exec();

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Controller to get a specific notification by its ID
export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Find the notification by ID and ensure it belongs to the logged-in user
    const notification = await Notification.findOne({ _id: notificationId, user: req.user._id });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ message: 'Error fetching notification' });
  }
};

// Controller to mark a notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('notificationId', id);
    // Find the notification and mark it as read
    const notification = await Notification.findOne({ _id: id });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isUnRead = false;
    await notification.save();  // Save the updated notification

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

// Controller to mark all notifications as read
export const markAllNotificationAsRead = async (req, res) => {
  try {
    const userId = req.body.userId; // Assuming user is authenticated
    // Find all notifications for the logged-in user and mark them as read
    await Notification.updateMany({ user: userId }, { isUnRead: false });

    res.status(200).json({ message: 'Notificaciones actualizadas' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
}

// Controller to create a new notification
export const createNotification = async (req, res) => {
  try {
    const { title, description, type, avatarUrl } = req.body;
    const userId = req.user._id; // Assuming user is authenticated and their id is in req.user._id

    // Create a new notification document
    const newNotification = new Notification({
      user: userId,
      title,
      description,
      avatarUrl,
      type,
      postedAt: new Date(),
      isUnRead: true,
    });

    await newNotification.save(); // Save the new notification to the database

    res.status(201).json(newNotification); // Return the created notification
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Error creating notification' });
  }
};

// Controller to create a customized admin notification for all users
export const generateAdminNotification = async (req, res) => {
  try {
    const { title, description, type, avatarUrl } = req.body;

    // Fetch all active users from the database
    const users = await User.find({status: 'active'});

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    // Iterate through all users and create a notification for each user
    const notifications = [];
    for (let user of users) {
      const newNotification = new Notification({
        user: user._id, // Set the notification for each individual user
        title,
        description,
        avatarUrl,
        type,
        postedAt: new Date(),
        isUnRead: true,  // Notifications are unread by default
      });

      await newNotification.save();  // Save the new notification for the user
      notifications.push(newNotification);  // Push the created notification to an array
    }

    // Respond with the list of created notifications
    res.status(201).json(notifications); // Return the created notifications for all users
  } catch (error) {
    console.error('Error creating admin notification:', error);
    res.status(500).json({ message: 'Error creating admin notification' });
  }
};

