import mongoose from 'mongoose';

const MetricSchema = new mongoose.Schema({
  cliente: String,
  product_type: String,
  tds_range: Number,
  production_volume_range: Number,
  temperature_range: Number,
  rejected_volume_range: Number,
  flow_rate_speed_range: Number,
  active_time: Number,
  metrics_description: String
}, { timestamps: true });

const Metric = mongoose.model('Metric', MetricSchema);

export default Metric;
