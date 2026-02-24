import UserModel from '../models/postgres/user.model.js';
import ClientModel from '../models/postgres/client.model.js';
import RoleModel from '../models/postgres/role.model.js';
import bcrypt from 'bcrypt';

export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.find({ status: 'active,pending' });
    if (users.length === 0) {
      return res.json([
        { id: '001', name: 'LuisFer Cordova', company: 'Consultor', isVerified: true, avatarUrl: '/assets/images/avatar/avatar-lf.webp', status: 'active', role: 'Consultor' }
      ]);
    }
    res.json(users.map(u => {
      const { password, ...rest } = u;
      return rest;
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

export const getActiveUsers = async (req, res) => {
  try {
    const { status, role, cliente } = req.query;
    const users = await UserModel.find({ status, role, cliente });
    const mapped = users.map(u => {
      const { password, ...rest } = u;
      return {
        ...rest,
        client_name: u.client_name || '',
        role_name: u.roleName || ''
      };
    });
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ message: 'Error fetching active users' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedUser = req.body;

    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (updatedUser.avatar && updatedUser.avatar.startsWith('data:image/')) {
      const base64Data = updatedUser.avatar.split(',')[1];
      const bufferLength = Buffer.byteLength(base64Data, 'base64');
      const maxSize = 2048 * 1024;
      if (bufferLength > maxSize) {
        return res.status(400).json({ message: 'Avatar image size exceeds 100 KB' });
      }
    }

    const data = { ...updatedUser };
    delete data.password;
    if (updatedUser.password && updatedUser.password.trim() !== '') {
      const isNewPassword = !updatedUser.password.startsWith('$2b$') && !updatedUser.password.startsWith('$2a$');
      if (isNewPassword) {
        data.password = await bcrypt.hash(updatedUser.password, 10);
        data.mqtt_zip_password = updatedUser.password;
      }
    }

    const allowed = ['nombre', 'puesto', 'avatar', 'status', 'role_id', 'client_id', 'postgres_client_id', 'password', 'mqtt_zip_password'];
    const toUpdate = {};
    for (const k of allowed) {
      if (data[k] !== undefined) toUpdate[k] = data[k];
    }

    const updated = await UserModel.update(id, toUpdate);
    if (!updated) return res.status(500).json({ message: 'Error updating user' });

    const { password, ...rest } = updated;
    res.json(rest);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await UserModel.delete(id);
    const { password, ...rest } = user;
    res.json(rest);
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

export const addUser = async (req, res) => {
  try {
    const userData = req.body;
    delete userData._id;

    const existing = await UserModel.findByEmail(userData.email);
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const password = userData.password?.trim() || '';
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hash = await bcrypt.hash(password, 10);
    const mqttZip = userData.mqtt_zip_password || password;

    const { query } = await import('../config/postgres.config.js');
    let roleId = userData.role_id;
    if (!roleId && userData.role) {
      const roleRes = await query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1) OR id = $2 LIMIT 1', [userData.role, userData.role]);
      roleId = roleRes.rows?.[0]?.id;
    }
    if (!roleId) {
      const def = await query('SELECT id FROM roles WHERE LOWER(name) = $1 LIMIT 1', ['cliente']);
      roleId = def.rows?.[0]?.id;
    }
    const clientRes = await query('SELECT id FROM clients ORDER BY id LIMIT 1');
    const clientId = userData.client_id || userData.cliente || clientRes.rows?.[0]?.id;

    if (!roleId || !clientId) return res.status(400).json({ message: 'Invalid role or client' });

    const created = await UserModel.create({
      email: userData.email,
      password: hash,
      role_id: roleId,
      client_id: clientId,
      postgres_client_id: userData.postgres_client_id || clientId,
      status: userData.status || 'pending',
      nombre: userData.nombre || '',
      puesto: userData.puesto || '',
      mqtt_zip_password: mqttZip
    });

    const user = await UserModel.findById(created.id);
    const { password: _, ...rest } = user;
    res.status(201).json(rest);
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ message: 'Error adding user' });
  }
};
