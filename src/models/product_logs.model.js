import mongoose from 'mongoose';

const ProductLogSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_id:{ type: String, required: true },

  // TODOS OPCIONALES para aceptar logs de todos los tipos de productos
  tds: { type: Number },
  production_volume: { type: Number },  // en litros
  rejected_volume: { type: Number },
  temperature: { type: Number },
  flujo_produccion: { type: Number },       // L/min actuales
  flujo_rechazo: { type: Number },     // L/min actuales
  tiempo_inicio: { type: Number },     // timestamp en segundos
  tiempo_fin: { type: Number },        // timestamp en segundos

  source: { type: String, default: 'esp32' },          // opcional: fuente del log
  date: { type: Date, default: Date.now }              // fecha del evento
}, {
  timestamps: true  // Crea createdAt y updatedAt
});

// Index for fast range queries by product and date (historico, reportes)
ProductLogSchema.index({ product_id: 1, date: 1 });

const ProductLog = mongoose.model('ProductLog', ProductLogSchema);

export default ProductLog;
