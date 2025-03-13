import Role from '../models/role.model.js';
import User from '../models/user.model.js';

// Get all roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Error fetching roles' });
  }
};

// Add a new role
export const addRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    const existingRole = await Role.findOne({ name });
    if (existingRole) return res.status(400).json({ message: 'Role already exists' });

    const role = new Role({ name, permissions });
    await role.save();

    res.status(201).json(role);
  } catch (error) {
    console.error('Error adding role:', error);
    res.status(500).json({ message: 'Error adding role' });
  }
};

// Update a role
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;

    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    role.name = name || role.name;
    role.permissions = permissions || role.permissions;

    await role.save();
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Error updating role' });
  }
};

// Delete a role
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.protected) {
      return res.status(400).json({ message: 'No puedes borrar un rol protegido' });
    }
    // Check if any users are assigned to this role
    const usersWithRole = await User.countDocuments({ role: id });
    if (usersWithRole > 0) {
      return res.status(400).json({ message: 'Cannot delete role assigned to users' });
    }

    await Role.findByIdAndDelete(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'Error deleting role' });
  }
};
