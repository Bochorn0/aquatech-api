import mongoose from 'mongoose';

const PuntoVentaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Código único de tienda (ej: CODIGO_TIENDA_001)
    // Opcional para mantener compatibilidad con datos existentes
    codigo_tienda: {
      type: String,
      required: false,  // Opcional para no romper datos existentes
      unique: true,
      sparse: true,     // Permite múltiples null/undefined, pero valores únicos si existen
      trim: true,
      uppercase: true,
      index: true,
      // No usar default: null - esto fuerza el campo a existir incluso cuando no se proporciona
      // Validación solo si el valor existe
      validate: {
        validator: function(v) {
          // Si no hay valor, es válido (opcional)
          if (!v) return true;
          // Si hay valor, debe cumplir el formato
          return /^CODIGO_TIENDA_\d{3}$/.test(v);
        },
        message: 'El código debe tener formato: CODIGO_TIENDA_XXX o estar vacío'
      }
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
