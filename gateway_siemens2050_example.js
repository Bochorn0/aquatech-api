#!/usr/bin/env node
/**
 * Script de ejemplo para Gateway Siemens 2050 (Debian)
 * Publica datos de sensores a MQTT en formato: aquatech/{codigo_tienda}/{equipo_id}/data
 * 
 * Requisitos:
 *     npm install mqtt
 * 
 * Uso:
 *     node gateway_siemens2050_example.js
 */

const mqtt = require('mqtt');

// ================== Configuración MQTT ==================
const MQTT_BROKER = '146.190.143.141';
const MQTT_PORT = 1883;
const MQTT_CLIENT_ID = 'siemens2050_gateway';

// ================== Configuración de Tienda y Equipos ==================
// ⚠️ CAMBIAR estos valores según tu configuración
const CODIGO_TIENDA = 'CODIGO_TIENDA_001';
const EQUIPOS = [
  'equipo_001',
  'equipo_002',
  // Agregar más equipos según sea necesario
];

// ================== Intervalo de publicación ==================
const PUBLISH_INTERVAL = 5000; // 5 segundos

// ================== Función para leer sensores ==================
/**
 * Lee los sensores del equipo.
 * ⚠️ REEMPLAZAR esta función con la lógica real de lectura de sensores.
 * 
 * En producción, aquí leerías:
 * - Sensores LoRa
 * - Sensores I2C/SPI
 * - Sensores analógicos
 * - Etc.
 */
function readSensors(equipoId) {
  // ⚠️ ESTO ES SOLO PARA PRUEBAS - Generar valores aleatorios
  return {
    flujo_produccion: parseFloat((Math.random() * 10 + 10).toFixed(1)),      // L/min
    flujo_rechazo: parseFloat((Math.random() * 10 + 5).toFixed(1)),          // L/min
    tds: parseFloat((Math.random() * 50 + 30).toFixed(1)),                  // ppm
    electronivel_purificada: parseFloat((Math.random() * 30 + 70).toFixed(1)), // %
    electronivel_recuperada: parseFloat((Math.random() * 30 + 60).toFixed(1)),  // %
    presion_in: parseFloat((Math.random() * 20 + 40).toFixed(1)),            // PSI/bar
    presion_out: parseFloat((Math.random() * 20 + 50).toFixed(1)),           // PSI/bar
  };
}

// ================== Función para publicar datos ==================
function publishSensorData(client, codigoTienda, equipoId, sensorData) {
  const topic = `aquatech/${codigoTienda}/${equipoId}/data`;
  
  const payload = {
    ...sensorData,
    timestamp: Math.floor(Date.now() / 1000),
    source: 'Siemens2050',
    gateway_ip: '192.168.1.100' // ⚠️ Obtener IP real del sistema
  };
  
  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ [${equipoId}] Error al publicar:`, err);
    } else {
      console.log(`✅ [${equipoId}] Publicado en ${topic}`);
      console.log(`   Datos:`, JSON.stringify(payload, null, 2));
    }
  });
}

// ================== Función para publicar estado ==================
function publishStatus(client, codigoTienda, equipoId, status = 'online') {
  const topic = `aquatech/${codigoTienda}/${equipoId}/status`;
  
  const payload = {
    status: status,
    ip: '192.168.1.100' // ⚠️ Obtener IP real del sistema
  };
  
  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ [${equipoId}] Error al publicar estado:`, err);
    } else {
      console.log(`📡 [${equipoId}] Estado: ${status}`);
    }
  });
}

// ================== Función principal ==================
function main() {
  console.log('='.repeat(60));
  console.log('Gateway Siemens 2050 - Publicador MQTT');
  console.log('='.repeat(60));
  console.log(`Broker: ${MQTT_BROKER}:${MQTT_PORT}`);
  console.log(`Código Tienda: ${CODIGO_TIENDA}`);
  console.log(`Equipos: ${EQUIPOS.join(', ')}`);
  console.log(`Intervalo: ${PUBLISH_INTERVAL / 1000} segundos`);
  console.log('='.repeat(60));
  console.log();
  
  // Conectar al broker MQTT
  const mqttUrl = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
  const client = mqtt.connect(mqttUrl, {
    clientId: MQTT_CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
  });
  
  // Eventos MQTT
  client.on('connect', () => {
    console.log(`✅ Conectado al broker MQTT ${MQTT_BROKER}:${MQTT_PORT}\n`);
    
    // Publicar estado inicial de todos los equipos
    console.log('📡 Publicando estado inicial...');
    EQUIPOS.forEach(equipoId => {
      publishStatus(client, CODIGO_TIENDA, equipoId, 'online');
    });
    
    // Esperar un momento antes de empezar a publicar datos
    setTimeout(() => {
      console.log(`\n🔄 Iniciando publicación de datos cada ${PUBLISH_INTERVAL / 1000} segundos...\n`);
      
      // Publicar datos periódicamente
      const interval = setInterval(() => {
        EQUIPOS.forEach(equipoId => {
          const sensorData = readSensors(equipoId);
          publishSensorData(client, CODIGO_TIENDA, equipoId, sensorData);
        });
        console.log('-'.repeat(60));
      }, PUBLISH_INTERVAL);
      
      // Manejar cierre graceful
      process.on('SIGINT', () => {
        console.log('\n\n⚠️  Interrupción recibida, cerrando...');
        clearInterval(interval);
        
        // Publicar estado offline
        console.log('📡 Publicando estado offline...');
        EQUIPOS.forEach(equipoId => {
          publishStatus(client, CODIGO_TIENDA, equipoId, 'offline');
        });
        
        setTimeout(() => {
          client.end();
          console.log('✅ Desconectado correctamente');
          process.exit(0);
        }, 1000);
      });
    }, 2000);
  });
  
  client.on('error', (err) => {
    console.error('❌ Error de conexión MQTT:', err);
  });
  
  client.on('close', () => {
    console.log('⚠️  Desconectado del broker MQTT');
  });
}

// Ejecutar
main();

