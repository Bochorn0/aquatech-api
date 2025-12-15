// test-mqtt-publisher.js
// Script para publicar mensajes de prueba al broker MQTT
// Ejecutar con: node test-mqtt-publisher.js

import dotenv from 'dotenv';
dotenv.config();

import mqtt from 'mqtt';

const MQTT_BROKER = process.env.MQTT_BROKER || '146.190.143.141';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_CLIENT_ID = 'aquatech-test-publisher';

console.log('\n==========================================');
console.log('Test Publisher MQTT');
console.log('==========================================\n');
console.log(`Conectando a: ${MQTT_BROKER}:${MQTT_PORT}\n`);

const mqttUrl = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
const client = mqtt.connect(mqttUrl, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  connectTimeout: 10000,
});

let publishedCount = 0;

// Evento: Conexión exitosa
client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT!\n');
  console.log('Publicando mensajes de prueba cada 2 segundos...\n');
  
  // Publicar mensajes de prueba
  const interval = setInterval(() => {
    publishedCount++;
    
    // Generar valores aleatorios
    const presionIn = (Math.random() * 100).toFixed(1);
    const presionOut = (Math.random() * 100).toFixed(1);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Publicar presión IN
    const topicIn = 'aquatech/presion_in';
    const payloadIn = presionIn;
    client.publish(topicIn, payloadIn, (err) => {
      if (err) {
        console.error(`❌ Error al publicar en ${topicIn}:`, err);
      } else {
        console.log(`[${publishedCount}] ✅ Publicado en ${topicIn}: ${payloadIn}`);
      }
    });
    
    // Publicar presión OUT
    const topicOut = 'aquatech/presion_out';
    const payloadOut = presionOut;
    client.publish(topicOut, payloadOut, (err) => {
      if (err) {
        console.error(`❌ Error al publicar en ${topicOut}:`, err);
      } else {
        console.log(`[${publishedCount}] ✅ Publicado en ${topicOut}: ${payloadOut}`);
      }
    });
    
    // Publicar datos combinados (JSON)
    const topicData = 'aquatech/data';
    const payloadData = JSON.stringify({
      presion_in: parseFloat(presionIn),
      presion_out: parseFloat(presionOut),
      timestamp: timestamp,
      source: 'Test'
    });
    client.publish(topicData, payloadData, (err) => {
      if (err) {
        console.error(`❌ Error al publicar en ${topicData}:`, err);
      } else {
        console.log(`[${publishedCount}] ✅ Publicado en ${topicData}: ${payloadData}`);
      }
    });
    
    // Publicar status
    const topicStatus = 'aquatech/status';
    const payloadStatus = JSON.stringify({
      status: 'online',
      ip: '127.0.0.1'
    });
    client.publish(topicStatus, payloadStatus, (err) => {
      if (err) {
        console.error(`❌ Error al publicar en ${topicStatus}:`, err);
      } else {
        console.log(`[${publishedCount}] ✅ Publicado en ${topicStatus}: ${payloadStatus}`);
      }
    });
    
    console.log('---\n');
    
  }, 2000); // Publicar cada 2 segundos
  
  // Detener después de 30 segundos (opcional)
  setTimeout(() => {
    clearInterval(interval);
    console.log(`\n✅ Publicación de prueba completada. Total: ${publishedCount} grupos de mensajes`);
    client.end();
    process.exit(0);
  }, 30000);
});

// Evento: Error de conexión
client.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.error('   Verifica que el servidor MQTT esté accesible');
  process.exit(1);
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n\nCerrando conexión...');
  client.end();
  console.log(`Total de grupos publicados: ${publishedCount}`);
  process.exit(0);
});

