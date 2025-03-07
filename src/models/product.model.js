import mongoose from 'mongoose';

const StatusSchema = new mongoose.Schema({
  code: String,
  value: mongoose.Schema.Types.Mixed,
});

const ProductSchema = new mongoose.Schema({
  active_time: Number,
  product_type: { type: String, default: 'Osmosis' },
  biz_type: Number,
  category: String,
  create_time: Number,
  icon: String,
  id: { type: String, unique: true }, // Ensuring unique device ID
  ip: String,
  city: String,
  state: String,
  cliente: String,
  drive: String,
  lat: String,
  local_key: String,
  lon: String,
  model: String,
  name: String,
  online: Boolean,
  owner_id: String,
  product_id: String,
  product_name: String,
  status: [StatusSchema],
  sub: Boolean,
  time_zone: String,
  uid: String,
  update_time: Number,
  uuid: String,
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

export default Product;
