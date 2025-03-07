// src/controllers/product.controller.js
 import User from '../models/user.model.js';

export const getUsers = async (req, res) => {
  try {
    console.log('Fetching Users from MongoDB...');
    
    // Check if products exist in MongoDB
    let users = await User.find({});

    if (users.length === 0) {

      // Return stored products
      users = [
        {
          id: '001',
          name: 'LuisFer Cordova',
          company: 'Consultor',
          isVerified: true,
          avatarUrl: `/assets/images/avatar/avatar-lf.webp`,
          status: 'active',
          role: 'Consultor'
        }
      ];
    }

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

export const getActiveUsers = async (req, res) => {
  try {
    console.log('Fetching Active Users from MongoDB...');

    const { status, role } = req.query;

    // Build the query object dynamically
    const filters = {};

    if (status) {
      filters.status = { $in: status.split(',') }; // Allow multiple statuses (e.g., "active,pending")
    } else {
      filters.status = { $in: ['active', 'pending'] }; // Default to active & pending
    }

    if (role) {
      filters.role = role; // Filter by role if provided
    }

    const users = await User.find(filters);
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ message: 'Error fetching active users' });
  }
};


export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedUser = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate avatar size if it's a base64 string
    if (updatedUser.avatar && updatedUser.avatar.startsWith('data:image/')) {
      const base64Data = updatedUser.avatar.split(',')[1]; // Remove the data type prefix
      const bufferLength = Buffer.byteLength(base64Data, 'base64'); // Get size in bytes
      
      const maxSize = 2048 * 1024; // 2 MB
      if (bufferLength > maxSize) {
        return res.status(400).json({ message: 'Avatar image size exceeds 100 KB' });
      }
    }

    // Update user fields
    user.set(updatedUser);
    await user.save();

    res.json(user);

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

