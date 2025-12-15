// test-mqtt.js
// Script de prueba para verificar la conexión MQTT localmente
// Ejecutar con: node test-mqtt.js

import dotenv from 'dotenv';
dotenv.config();

import mqtt from 'mqtt';

const MQTT_BROKER = process.env.MQTT_BROKER || '146.190.143.141';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_CLIENT_ID = 'aquatech-test-client';

console.log('\n==========================================');
console.log('Test de Conexión MQTT');
console.log('==========================================\n');
console.log(`Conectando a: ${MQTT_BROKER}:${MQTT_PORT}`);
console.log(`Client ID: ${MQTT_CLIENT_ID}\n`);

const mqttUrl = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
const client = mqtt.connect(mqttUrl, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
});

let messageCount = 0;

// Evento: Conexión exitosa
client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT!\n');
  
  // Suscribirse a los topics
  const topics = [
    'aquatech/presion_in',
    'aquatech/presion_out',
    'aquatech/data',
    'aquatech/status'
  ];
  
  topics.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Error al suscribirse a ${topic}:`, err);
      } else {
        console.log(`✅ Suscrito a: ${topic}`);
      }
    });
  });
  
  console.log('\nEsperando mensajes... (Presiona Ctrl+C para salir)\n');
});

// Evento: Error de conexión
client.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.error('   Verifica que el servidor MQTT esté accesible');
  process.exit(1);
});

// Evento: Desconexión
client.on('close', () => {
  console.log('\n⚠️  Desconectado del broker');
});

// Evento: Reconexión
client.on('reconnect', () => {
  console.log('🔄 Reintentando conexión...');
});

// Evento: Mensaje recibido
client.on('message', (topic, message) => {
  messageCount++;
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(`\n[${timestamp}] 📨 Mensaje #${messageCount}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Payload: ${message.toString()}`);
  
  // Si es JSON, intentar parsearlo
  if (topic === 'aquatech/data' || topic === 'aquatech/status') {
    try {
      const data = JSON.parse(message.toString());
      console.log('   JSON parseado:', JSON.stringify(data, null, 2));
    } catch (e) {
      // No es JSON válido, mostrar como texto
    }
  }
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n\nCerrando conexión...');
  client.end();
  console.log(`Total de mensajes recibidos: ${messageCount}`);
  process.exit(0);
});

// Timeout de prueba (opcional - comentar si quieres que siga escuchando)
// setTimeout(() => {
//   console.log('\n\nTimeout de prueba alcanzado');
//   client.end();
//   process.exit(0);
// }, 60000); // 60 segundos

