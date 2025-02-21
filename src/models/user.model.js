import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  active_time: Number,
  user_description: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

export default User;
