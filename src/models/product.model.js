import mongoose from 'mongoose';  // Use ES Module import

const productSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
  },
  metrics: {
    tds: {
      type: Number,
      default: 0,
    },
    waterFlow: {
      type: Number,
      default: 0,
    },
    filterLife: {
      type: Number,
      default: 100,
    },
    waterQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good',
    },
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  alerts: [{
    type: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  }],
}, {
  timestamps: true,
});

// Default export for ES Modules
const Product = mongoose.model('Product', productSchema);
export default Product;
