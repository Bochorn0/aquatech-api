import mongoose from 'mongoose';

const PuntoVentaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Relación con Cliente
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },

    // Relación con Ciudad
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true,
    },

    // Ubicación geográfica (útil para mapas)
    address: {
      street: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
      country: { type: String, trim: true },
      lat: { type: String },
      lon: { type: String },
    },

    // Relación con productos (uno o varios)
    productos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // Relación con controladores (uno o varios)
    controladores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Controller',
      },
    ],

    // Estado general
    online: {
      type: Boolean,
      default: false,
    },

    // Campo útil para mostrar notas o descripciones
    notes: {
      type: String,
      trim: true,
    },

    // Campo para agrupar o clasificar
    category: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('PuntoVenta', PuntoVentaSchema);
