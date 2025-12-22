// src/mqtt-consumer.js
// Script independiente para consumir mensajes MQTT
// Este script solo maneja la conexión MQTT sin el servidor Express

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import mqttService from './services/mqtt.service.js';

console.log('🚀 Iniciando consumidor MQTT...');

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    
    // Iniciar servicio MQTT después de conectar a MongoDB
    console.log('📡 Iniciando servicio MQTT...');
    mqttService.connect();
    
    console.log('✅ Consumidor MQTT iniciado correctamente');
  })
  .catch((err) => {
    console.error('❌ Error de conexión a MongoDB:', err);
    process.exit(1);
  });

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando consumidor MQTT...');
  mqttService.disconnect();
  mongoose.connection.close().then(() => {
    console.log('✅ Consumidor MQTT cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cerrando consumidor MQTT (SIGTERM)...');
  mqttService.disconnect();
  mongoose.connection.close().then(() => {
    console.log('✅ Consumidor MQTT cerrado correctamente');
    process.exit(0);
  });
});

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  mqttService.disconnect();
  mongoose.connection.close().then(() => {
    process.exit(1);
  });
});
