#!/usr/bin/env node
// scripts/run-dev-mode-data-generator.js
// Standalone script to run the dev mode random data generator.
// Use from system crontab: */5 * * * * cd /path/to/Aquatech_api && node scripts/run-dev-mode-data-generator.js
//
// Set DEV_MODE_USE_MQTT=true to publish to MQTT (tiwater/{codigo_tienda}/data). npm run dev-mode-data-gen sets this.
// Otherwise data is written directly to PostgreSQL. For TLS (port 8883) set MQTT_CA_CERT_PATH or MQTT_CA_CERT.

import dotenv from 'dotenv';
import fs from 'fs';
import mqtt from 'mqtt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const useMqtt = process.env.DEV_MODE_USE_MQTT === 'true';
const MQTT_BROKER = process.env.MQTT_BROKER || 'localhost';
const MQTT_PORT = parseInt(process.env.MQTT_PORT, 10) || 1883;
const MQTT_USE_TLS = process.env.MQTT_USE_TLS === 'true' || MQTT_PORT === 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME || null;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || null;

// When connecting by IP, cert often has hostname only → skip hostname check so TLS still works
const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(MQTT_BROKER);
const rejectUnauthorized = !(
  process.env.MQTT_TLS_REJECT_UNAUTHORIZED === 'false' ||
  (MQTT_USE_TLS && isIp)
);

function createMqttClient() {
  const protocol = MQTT_USE_TLS ? 'mqtts' : 'mqtt';
  const url = `${protocol}://${MQTT_BROKER}:${MQTT_PORT}`;
  const options = {
    clientId: process.env.MQTT_CLIENT_ID || 'tiwater-dev-mode-script-' + Date.now(),
    reconnectPeriod: 0,
    connectTimeout: 15000,
    rejectUnauthorized
  };
  if (MQTT_USERNAME) options.username = MQTT_USERNAME;
  if (MQTT_PASSWORD) options.password = MQTT_PASSWORD;
  if (MQTT_USE_TLS) {
    if (process.env.MQTT_CA_CERT_PATH) {
      try {
        options.ca = fs.readFileSync(process.env.MQTT_CA_CERT_PATH);
      } catch (e) {
        console.warn('[run-dev-mode-data-generator] MQTT CA file not loaded:', e.message);
      }
    } else if (process.env.MQTT_CA_CERT) {
      options.ca = process.env.MQTT_CA_CERT;
    }
  }
  return mqtt.connect(url, options);
}

async function main() {
  if (useMqtt) {
    const { getMqttPayloadsForDevModePuntos } = await import('../src/services/devModeDataGenerator.service.js');
    let client;
    try {
      const { payloads, puntosProcessed, errors } = await getMqttPayloadsForDevModePuntos();
      errors.forEach((e) => console.warn('[run-dev-mode-data-generator]', e));
      if (payloads.length === 0) {
        console.log('[run-dev-mode-data-generator] 0 puntos (MQTT), nothing to publish');
        process.exit(0);
      }
      client = createMqttClient();
      await new Promise((resolve, reject) => {
        client.on('connect', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('MQTT connect timeout')), 10000);
      });
      for (let i = 0; i < payloads.length; i++) {
        const { topic, message } = payloads[i];
        await new Promise((resolve, reject) => {
          client.publish(topic, message, { qos: 0 }, (err) => (err ? reject(err) : resolve()));
        });
        console.log(`[run-dev-mode-data-generator] Published to ${topic}`);
        if (i < payloads.length - 1) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      // Let the socket flush before closing (otherwise messages may not reach the broker)
      await new Promise((r) => setTimeout(r, 1200));
      client.end();
      await new Promise((r) => setTimeout(r, 500));
      console.log(`[run-dev-mode-data-generator] MQTT: ${puntosProcessed} puntos, ${payloads.length} messages published`);
    } catch (error) {
      console.error('[run-dev-mode-data-generator] MQTT Error:', error.message);
      if (client) client.end();
      process.exit(1);
    }
    process.exit(0);
    return;
  }

  const pool = (await import('../src/config/postgres.config.js')).default;
  const { generateRandomDataForDevModePuntos } = await import('../src/services/devModeDataGenerator.service.js');
  try {
    const result = await generateRandomDataForDevModePuntos();
    console.log(`[run-dev-mode-data-generator] ${result.puntosProcessed} puntos, ${result.readingsCreated} readings`);
    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.warn('[run-dev-mode-data-generator]', e));
    }
  } catch (error) {
    console.error('[run-dev-mode-data-generator] Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main();
