import mongoose from 'mongoose';

const MetricSchema = new mongoose.Schema({
  active_time: Number,
  metrics_description: String
}, { timestamps: true });

const Metric = mongoose.model('Metric', MetricSchema);

export default Metric;
