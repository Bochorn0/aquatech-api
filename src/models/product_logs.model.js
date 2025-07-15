import mongoose from 'mongoose';

const ProductLogSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_id:{ type: String, required: true },
  tds: { type: Number, required: true },
  production_volume: { type: Number, required: true },  // en litros
  rejected_volume: { type: Number, required: true },
  temperature: { type: Number, required: true },

  flujo_produccion: { type: Number, required: true },       // L/min actuales
  flujo_rechazo: { type: Number, required: true },     // L/min actuales

  tiempo_inicio: { type: Number, required: true },     // timestamp en segundos
  tiempo_fin: { type: Number, required: true },        // timestamp en segundos

  source: { type: String, default: 'esp32' },          // opcional: fuente del log
  date: { type: Date, default: Date.now }              // fecha del evento
}, {
  timestamps: true  // Crea createdAt y updatedAt
});

const ProductLog = mongoose.model('ProductLog', ProductLogSchema);

export default ProductLog;
