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
