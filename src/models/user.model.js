import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }, // Reference Role model
  active_time: { type: Number, default: 0 },
  protected: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'pending' },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true }, // Reference Client model
  verified: { type: Boolean, default: false },
  avatar: { type: String, default: '/assets/icons/navbar/ic-user.svg' },
  nombre: { type: String, default: '' },
  puesto: { type: String, default: '' },
  user_description: { type: String, default: '' },
  mqtt_zip_password: { type: String, default: '' } // Contraseña para el ZIP del certificado MQTT
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
