// src/controllers/product.controller.js
 import User from '../models/user.model.js';
 import Client from '../models/client.model.js';
 import Role from '../models/role.model.js';

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
    const clientes = await Client.find();
    const roles = await Role.find();
    console.log('Fetching Active Users from MongoDB...');

    const { status, role, cliente } = req.query;

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

    if (cliente) {
      filters.cliente = cliente; // Filter by client if provided
    }

    const clienteMap = new Map(clientes.map(cliente => [cliente._id.toString(), cliente.name]));
    const roleMap = new Map(roles.map(role => [role._id.toString(), role.name]));
    // Use populate to include the 'role.name' and 'cliente' (assuming client is referenced)
    const users = await User.find(filters)
    const mappedResults = users.map(user => {
      const clientName = clienteMap.get(user.cliente.toString()) || ''; // Use map for faster lookup
      const roleName = roleMap.get(user.role.toString()) || ''; // Use map for faster lookup
      return {
        ...user.toObject(), // Convert metric to plain object if it's a Mongoose document
        client_name: clientName,
        role_name: roleName,
      };
    });
    res.json(mappedResults);
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

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await
    User.findById
    (id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    } else {
      await User.deleteOne({ _id: id
      });
      res.json(user);
    }
  }
  catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
}

