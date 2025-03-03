import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['info', 'alert', 'warning', 'news', 'updates'],
      required: true,
    },
    postedAt: {
      type: Date,
      required: true,
    },
    isUnRead: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true } // Automatically adds `createdAt` and `updatedAt` fields
);

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
