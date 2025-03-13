import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  protected: { type: Boolean, default: false },
  permissions: [{ type: String }] // Example: ['read_users', 'edit_users', 'delete_users']
}, { timestamps: true });

const Role = mongoose.model('Role', RoleSchema);

export default Role;
