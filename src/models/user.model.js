import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  active_time: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'pending' },
  cliente: { type: String, default: 'Aquatech' },
  verified: { type: Boolean, default: false },
  avatar: { type: String, default: '/assets/icons/navbar/ic-user.svg' },
  nombre: { type: String, default: '' },
  puesto: { type: String, default: '' },
  user_description: { type: String, default: '' }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', UserSchema);

export default User;
