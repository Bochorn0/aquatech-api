import mongoose from 'mongoose';

const MetricSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  product_type: String,
  tds_range: { type: Number, required: true },
  production_volume_range: { type: Number, required: true },
  temperature_range: { type: Number, required: true },
  rejected_volume_range: { type: Number, required: true },
  flow_rate_speed_range: { type: Number, required: true },
  filter_only_online: { type: Boolean, default: true },
  active_time: Number,
  metrics_description: String
}, { timestamps: true });

const Metric = mongoose.model('Metric', MetricSchema);

export default Metric;
