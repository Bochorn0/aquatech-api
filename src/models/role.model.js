import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  protected: { type: Boolean, default: false },
  permissions: [{ type: String }], // Example: ['read_users', 'edit_users', 'delete_users']
  // Dashboard version for landing/home: 'v1' (metrics by product + map), 'v2' (general metrics), or 'both' (user can switch)
  dashboardVersion: { type: String, enum: ['v1', 'v2', 'both'], default: 'v1' }
}, { timestamps: true });

const Role = mongoose.model('Role', RoleSchema);

export default Role;
