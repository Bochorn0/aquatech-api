import RoleModel from '../models/postgres/role.model.js';
import { query } from '../config/postgres.config.js';

export const getRoles = async (req, res) => {
  try {
    const roles = await RoleModel.findAll();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Error fetching roles' });
  }
};

export const addRole = async (req, res) => {
  try {
    const { name, permissions, dashboardVersion } = req.body;

    const existing = await RoleModel.findByName(name);
    if (existing) return res.status(400).json({ message: 'Role already exists' });

    const role = await RoleModel.create({ name, permissions, dashboardVersion });
    if (!role) return res.status(500).json({ message: 'Error creating role' });
    res.status(201).json(role);
  } catch (error) {
    console.error('Error adding role:', error);
    res.status(500).json({ message: 'Error adding role' });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, dashboardVersion } = req.body;

    const role = await RoleModel.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    const updated = await RoleModel.update(id, {
      name: name || role.name,
      permissions: permissions ?? role.permissions,
      dashboardVersion: dashboardVersion !== undefined ? dashboardVersion : role.dashboardVersion
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Error updating role' });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.protected) return res.status(400).json({ message: 'No puedes borrar un rol protegido' });

    const usersRes = await query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
    const count = parseInt(usersRes.rows?.[0]?.count || '0', 10);
    if (count > 0) return res.status(400).json({ message: 'Cannot delete role assigned to users' });

    await RoleModel.delete(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'Error deleting role' });
  }
};
