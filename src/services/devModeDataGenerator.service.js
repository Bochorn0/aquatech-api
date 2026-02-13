// src/services/devModeDataGenerator.service.js
// Generates random sensor data for puntos de venta with dev mode enabled.
// Used by a cron job that runs every 5 minutes.

import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';
import PuntoVentaSensorModel from '../models/postgres/puntoVentaSensor.model.js';
import SensoresModel from '../models/postgres/sensores.model.js';

/**
 * Default min/max ranges per sensor type for random value generation
 * when the sensor configuration has no min_value/max_value set
 */
const DEFAULT_RANGES_BY_TYPE = {
  flujo_produccion: { min: 0, max: 25 },
  flujo_rechazo: { min: 0, max: 15 },
  flujo_recuperacion: { min: 0, max: 20 },
  tds: { min: 0, max: 500 },
  electronivel_purificada: { min: 0, max: 100 },
  electronivel_recuperada: { min: 0, max: 100 },
  electronivel_cruda: { min: 0, max: 100 },
  nivel_purificada: { min: 0, max: 1000 },
  nivel_cruda: { min: 0, max: 1000 },
  caudal_cruda: { min: 0, max: 30 },
  caudal_cruda_lmin: { min: 0, max: 30 },
  acumulado_cruda: { min: 0, max: 10000 },
  presion_in: { min: 20, max: 80 },
  presion_out: { min: 20, max: 80 },
  presion_co2: { min: 0, max: 100 },
  eficiencia: { min: 50, max: 100 },
  vida: { min: 0, max: 365 },
  water_level: { min: 0, max: 100 },
  corriente_ch1: { min: 0, max: 20 },
  corriente_ch2: { min: 0, max: 20 },
  corriente_ch3: { min: 0, max: 20 },
  corriente_ch4: { min: 0, max: 20 },
  corriente_total: { min: 0, max: 80 }
};

/**
 * Generate a random number between min and max (inclusive), with optional decimal places
 * @param {number} min
 * @param {number} max
 * @param {number} decimals
 * @returns {number}
 */
function randomInRange(min, max, decimals = 2) {
  const value = min + Math.random() * (max - min);
  return decimals === 0 ? Math.round(value) : parseFloat(value.toFixed(decimals));
}

/**
 * Get min/max for a sensor (from config or defaults by type)
 * @param {Object} sensorConfig - PuntoVentaSensor row (camelCase)
 * @returns {{ min: number, max: number }}
 */
function getRangeForSensor(sensorConfig) {
  const type = sensorConfig.sensorType || sensorConfig.sensor_type;
  const min = sensorConfig.minValue ?? sensorConfig.min_value;
  const max = sensorConfig.maxValue ?? sensorConfig.max_value;
  const defaults = DEFAULT_RANGES_BY_TYPE[type] || { min: 0, max: 100 };
  return {
    min: min != null ? parseFloat(min) : defaults.min,
    max: max != null ? parseFloat(max) : defaults.max
  };
}

/** Map sensor_type to the key name the MQTT consumer (mapTiwaterDataToStandard) expects. */
const SENSOR_TYPE_TO_MQTT_KEY = {
  flujo_produccion: 'caudal_purificada',
  flujo_rechazo: 'caudal_rechazo',
  flujo_recuperacion: 'caudal_recuperacion',
  tds: 'tds',
  electronivel_purificada: 'porcentaje_nivel_purificada',
  electronivel_recuperada: 'porcentaje_nivel_recuperada',
  electronivel_cruda: 'porcentaje_nivel_cruda',
  nivel_purificada: 'nivel_purificada',
  nivel_cruda: 'nivel_cruda',
  caudal_cruda: 'caudal_cruda',
  caudal_cruda_lmin: 'caudal_cruda_l_min',
  acumulado_cruda: 'acumulado_cruda',
  presion_in: 'pressure_in',
  presion_out: 'pressure_out',
  presion_co2: 'presion_co2',
  eficiencia: 'eficiencia',
  vida: 'vida',
  water_level: 'water_level',
  corriente_ch1: 'ch1',
  corriente_ch2: 'ch2',
  corriente_ch3: 'ch3',
  corriente_ch4: 'ch4',
  corriente_total: 'total_corriente'
};

/**
 * Build MQTT payloads (tiwater format) for all dev_mode puntos.
 * Topic: tiwater/{codigo_tienda}/data. Message: JSON with timestamp (Unix s) and sensor keys.
 * The MQTT consumer will receive and save to PostgreSQL.
 * @returns {Promise<{ payloads: Array<{ topic: string, message: string }>, puntosProcessed: number, errors: string[] }>}
 */
export async function getMqttPayloadsForDevModePuntos() {
  const result = { payloads: [], puntosProcessed: 0, errors: [] };

  try {
    const puntos = await PuntoVentaModel.findAllWithDevModeEnabled();
    if (puntos.length === 0) {
      return result;
    }

    const timestampUnix = Math.floor(Date.now() / 1000);

    for (const punto of puntos) {
      const puntoId = parseInt(punto.id, 10);
      const codigoTienda = (punto.codigo_tienda || punto.code || '').toString().toUpperCase();

      if (!codigoTienda) {
        result.errors.push(`Punto venta ID ${puntoId} has no code/codigo_tienda, skipping`);
        continue;
      }

      let sensors;
      try {
        sensors = await PuntoVentaSensorModel.findByPuntoVentaId(puntoId);
      } catch (err) {
        result.errors.push(`Punto ${puntoId}: failed to load sensors: ${err.message}`);
        continue;
      }

      const enabledSensors = sensors.filter(s => s.enabled !== false);
      if (enabledSensors.length === 0) {
        continue;
      }

      const payload = { timestamp: timestampUnix, source: 'dev_mode_generator' };
      for (const sensor of enabledSensors) {
        const type = sensor.sensorType || sensor.sensor_type;
        const { min, max } = getRangeForSensor(sensor);
        const value = randomInRange(min, max);
        const key = SENSOR_TYPE_TO_MQTT_KEY[type] || type;
        payload[key] = value;
      }

      const topic = `tiwater/${codigoTienda}/data`;
      result.payloads.push({ topic, message: JSON.stringify(payload) });
      result.puntosProcessed += 1;
    }

    return result;
  } catch (error) {
    console.error('[DevModeDataGenerator] getMqttPayloads Fatal error:', error);
    result.errors.push(error.message);
    throw error;
  }
}

/**
 * Generate random sensor data for all puntos de venta that have dev_mode enabled.
 * For each punto, loads its sensors from puntoventasensors and inserts one random
 * reading per sensor into the sensores table.
 * @returns {Promise<{ puntosProcessed: number, readingsCreated: number, errors: string[] }>}
 */
export async function generateRandomDataForDevModePuntos() {
  const result = { puntosProcessed: 0, readingsCreated: 0, errors: [] };

  try {
    const puntos = await PuntoVentaModel.findAllWithDevModeEnabled();
    if (puntos.length === 0) {
      return result;
    }

    const timestamp = new Date();
    const codigoTiendaMap = new Map(); // puntoId -> codigo_tienda

    for (const punto of puntos) {
      const puntoId = parseInt(punto.id, 10);
      const codigoTienda = (punto.codigo_tienda || punto.code || '').toString().toUpperCase();
      const clientId = punto.clientId != null ? String(punto.clientId) : null;

      if (!codigoTienda) {
        result.errors.push(`Punto venta ID ${puntoId} has no code/codigo_tienda, skipping`);
        continue;
      }

      codigoTiendaMap.set(puntoId, codigoTienda);

      let sensors;
      try {
        sensors = await PuntoVentaSensorModel.findByPuntoVentaId(puntoId);
      } catch (err) {
        result.errors.push(`Punto ${puntoId}: failed to load sensors: ${err.message}`);
        continue;
      }

      // Filter to enabled sensors only
      const enabledSensors = sensors.filter(s => s.enabled !== false);
      if (enabledSensors.length === 0) {
        continue;
      }

      const sensorRecords = enabledSensors.map((sensor) => {
        const { min, max } = getRangeForSensor(sensor);
        const value = randomInRange(min, max);
        const name = sensor.sensorName || sensor.sensor_name || sensor.sensorType || sensor.sensor_type;
        const type = sensor.sensorType || sensor.sensor_type;

        return {
          name,
          type,
          value,
          timestamp,
          codigoTienda,
          resourceId: sensor.resourceId || sensor.resource_id || null,
          resourceType: sensor.resourceType || sensor.resource_type || null,
          clientId,
          ownerId: null,
          status: 'active',
          label: sensor.label || name,
          lat: null,
          long: null,
          meta: {
            source: 'dev_mode_generator',
            punto_venta_id: puntoId,
            generated_at: timestamp.toISOString()
          }
        };
      });

      try {
        const saved = await SensoresModel.createMany(sensorRecords);
        result.readingsCreated += saved.length;
        result.puntosProcessed += 1;
      } catch (err) {
        result.errors.push(`Punto ${puntoId} (${codigoTienda}): failed to save readings: ${err.message}`);
      }
    }

    if (result.puntosProcessed > 0 || result.errors.length > 0) {
      console.log(
        `[DevModeDataGenerator] Run complete: ${result.puntosProcessed} puntos, ${result.readingsCreated} readings created` +
          (result.errors.length > 0 ? `, ${result.errors.length} error(s)` : '')
      );
      result.errors.forEach((e) => console.warn('[DevModeDataGenerator]', e));
    }

    return result;
  } catch (error) {
    console.error('[DevModeDataGenerator] Fatal error:', error);
    result.errors.push(error.message);
    throw error;
  }
}

export default { generateRandomDataForDevModePuntos, getMqttPayloadsForDevModePuntos };
