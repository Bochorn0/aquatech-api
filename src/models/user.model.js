import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }, // Reference Role model
  active_time: { type: Number, default: 0 },
  protected: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'pending' },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true }, // Reference Client model (MongoDB)
  postgresClientId: { type: String, default: null }, // Reference to PostgreSQL clients.id for dashboard v2
  verified: { type: Boolean, default: false },
  avatar: { type: String, default: '/assets/icons/navbar/ic-user.svg' },
  nombre: { type: String, default: '' },
  puesto: { type: String, default: '' },
  user_description: { type: String, default: '' },
  mqtt_zip_password: { type: String, default: '' }, // Contraseña para el ZIP del certificado MQTT
  // Password reset fields
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  // Si el password es nuevo (no está hasheado) y mqtt_zip_password no está configurado,
  // establecer mqtt_zip_password con el password en texto plano antes de hashearlo
  const isNewPassword = !this.password.startsWith('$2b$'); // Los hashes de bcrypt empiezan con $2b$
  if (isNewPassword && (!this.mqtt_zip_password || this.mqtt_zip_password.trim() === '')) {
    this.mqtt_zip_password = this.password;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', UserSchema);

export default User;
