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

export default { generateRandomDataForDevModePuntos };
