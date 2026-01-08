// src/models/sensorData.model.js
// Modelo para almacenar datos de sensores recibidos vía MQTT desde gateway Siemens 2050

import mongoose from 'mongoose';

const SensorDataSchema = new mongoose.Schema({
  // Identificación de tienda y equipo
  // Opcional para mantener compatibilidad con datos existentes
  codigo_tienda: { 
    type: String, 
    required: false,  // Opcional para no romper datos existentes
    uppercase: true,
    index: true,  // Índice para consultas rápidas por tienda
    default: null
  },
  equipo_id: { 
    type: String, 
    required: false,  // Opcional para mantener compatibilidad
    index: true,  // Índice para consultas por equipo
    default: null
  },
  
  // Referencias a otras entidades
  punto_venta: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PuntoVenta',
    index: true
  },
  controller: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Controller',
    index: true
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    index: true
  },
  cliente: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client',
    index: true
  },
  
  // ================== SENSORES ==================
  // Flujos
  flujo_produccion: { 
    type: Number,
    min: 0,
    max: 1000  // L/min - Ajustar según rango del sensor
  },
  flujo_rechazo: { 
    type: Number,
    min: 0,
    max: 1000  // L/min - Ajustar según rango del sensor
  },
  flujo_recuperacion: {
    type: Number,
    min: 0,
    max: 1000  // L/min
  },
  
  // TDS (Total Dissolved Solids)
  tds: { 
    type: Number,
    min: 0,
    max: 2000  // ppm - Ajustar según rango del sensor
  },
  
  // Niveles electrónicos (porcentajes 0-100)
  electronivel_purificada: { 
    type: Number,
    min: 0,
    max: 100  // Porcentaje (0-100)
  },
  electronivel_recuperada: { 
    type: Number,
    min: 0,
    max: 100  // Porcentaje (0-100)
  },
  
  // Niveles absolutos (valores pueden ser mayores a 100)
  nivel_purificada: {
    type: Number,
    min: 0,
    max: 10000  // Nivel absoluto (aumentado para soportar valores reales)
  },
  nivel_cruda: {
    type: Number,
    min: 0,
    max: 10000  // Nivel absoluto (aumentado para soportar valores reales)
  },
  caudal_cruda: {
    type: Number,
    min: 0,
    max: 1000  // L/min
  },
  caudal_cruda_lmin: {
    type: Number,
    min: 0,
    max: 10000  // L/min (valores más altos)
  },
  acumulado_cruda: {
    type: Number,
    min: 0
  },
  
  // Presiones
  presion_in: { 
    type: Number,
    min: 0,
    max: 1000  // PSI o bar - Ajustar según rango del sensor
  },
  presion_out: { 
    type: Number,
    min: 0,
    max: 1000  // PSI o bar - Ajustar según rango del sensor
  },
  presion_co2: {
    type: Number,
    min: 0,
    max: 2000  // PSI o bar
  },
  
  // Eficiencia y vida
  eficiencia: {
    type: Number,
    min: 0,
    max: 100  // Porcentaje
  },
  vida: {
    type: Number,
    min: 0
  },
  
  // Corriente (nuevos campos)
  corriente_ch1: {
    type: Number,
    min: 0
  },
  corriente_ch2: {
    type: Number,
    min: 0
  },
  corriente_ch3: {
    type: Number,
    min: 0
  },
  corriente_ch4: {
    type: Number,
    min: 0
  },
  corriente_total: {
    type: Number,
    min: 0
  },
  
  // Metadatos
  source: { 
    type: String, 
    enum: ['Siemens2050', 'LoRa', 'WiFi', 'Test', 'tiwater'],
    default: 'Siemens2050'
  },
  gateway_ip: { 
    type: String  // IP del gateway Siemens 2050
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true  // Índice para consultas por fecha
  },
  
  // Datos adicionales (flexible para futuros sensores)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,  // Crea createdAt y updatedAt automáticamente
  // Índices compuestos para consultas eficientes
  indexes: [
    { codigo_tienda: 1, equipo_id: 1, timestamp: -1 },  // Consultas por tienda/equipo y fecha
    { codigo_tienda: 1, timestamp: -1 },  // Consultas por tienda y fecha
    { equipo_id: 1, timestamp: -1 },  // Consultas por equipo y fecha
    { punto_venta: 1, timestamp: -1 },  // Consultas por punto de venta y fecha
    { controller: 1, timestamp: -1 },  // Consultas por controller y fecha
    { product: 1, timestamp: -1 }      // Consultas por product y fecha
  ]
});

// Índice TTL opcional para limpiar datos antiguos (30 días)
// SensorDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const SensorData = mongoose.model('SensorData', SensorDataSchema);

export default SensorData;

