// src/mqtt-consumer.js
// Script independiente para consumir mensajes MQTT
// Usa PostgreSQL (PostgresService) para guardar datos; MongoDB ya no se usa

import dotenv from 'dotenv';
dotenv.config();

import mqttService from './services/mqtt.service.js';

console.log('🚀 Iniciando consumidor MQTT...');

// Conectar MQTT (PostgresService se usa al recibir mensajes; no requiere conexión previa)
console.log('📡 Iniciando servicio MQTT...');
mqttService.connect();
console.log('✅ Consumidor MQTT iniciado correctamente');

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando consumidor MQTT...');
  mqttService.disconnect();
  console.log('✅ Consumidor MQTT cerrado correctamente');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cerrando consumidor MQTT (SIGTERM)...');
  mqttService.disconnect();
  console.log('✅ Consumidor MQTT cerrado correctamente');
  process.exit(0);
});

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  mqttService.disconnect();
  process.exit(1);
});
