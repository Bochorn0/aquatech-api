import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  active_time: Number,
  user_description: String
}, { timestamps: true });

const Report = mongoose.model('Report', ReportSchema);

export default Report;
