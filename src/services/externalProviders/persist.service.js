/**
 * Persist a NormalizedReading into sensores_message / sensores / sensor_latest.
 */

import SensoresMessageModel from '../../models/postgres/sensoresMessage.model.js';
import SensorLatestModel from '../../models/postgres/sensorLatest.model.js';
import {
  DEFAULT_EXTERNAL_RESOURCE_TYPE,
  externalSourceTag,
} from './types.js';

/**
 * @param {import('./types.js').NormalizedReading} reading
 * @param {{ codigoTienda: string, clientId?: string|null, puntoventaId?: number|null }} binding
 */
export async function saveNormalizedReading(reading, binding) {
  const source = externalSourceTag(reading.provider);
  const timestamp = reading.observedAt instanceof Date
    ? reading.observedAt
    : new Date(reading.observedAt);

  const storeOriginal = process.env.SENSORES_META_STORE_ORIGINAL_PAYLOAD === 'true';
  const messageMeta = {
    source,
    provider: reading.provider,
    external_device_id: reading.externalDeviceId,
    imei: reading.imei || null,
    idempotency_key: reading.idempotencyKey,
    alarms: reading.alarms || null,
    ...(storeOriginal && reading.raw ? { original_payload: reading.raw } : {}),
  };

  const { id: messageId } = await SensoresMessageModel.createMessage({
    timestamp,
    clientid: binding.clientId || null,
    lat: null,
    long: null,
    codigotienda: binding.codigoTienda,
    resourceid: reading.externalDeviceId,
    resourcetype: DEFAULT_EXTERNAL_RESOURCE_TYPE,
    meta: messageMeta,
    region: null,
    ciudad: null,
    cliente_identifier: null,
  });

  const detailRows = reading.metrics
    .filter((m) => m.value !== null && m.value !== undefined && !Number.isNaN(Number(m.value)))
    .map((m) => ({
      name: m.name,
      type: m.type,
      value: Number(m.value),
    }));

  await SensoresMessageModel.createDetails(messageId, detailRows);

  const latestShape = detailRows.map((r) => ({
    name: r.name,
    type: r.type,
    value: r.value,
    timestamp,
    codigoTienda: binding.codigoTienda,
    resourceId: reading.externalDeviceId,
    resourceType: DEFAULT_EXTERNAL_RESOURCE_TYPE,
    clientId: binding.clientId || null,
    meta: { source },
  }));

  try {
    await SensorLatestModel.upsertMany(latestShape);
  } catch (err) {
    console.warn('[externalProviders.persist] sensor_latest upsert failed:', err.message);
  }

  return {
    sensoresMessageId: messageId,
    metricCount: detailRows.length,
    codigoTienda: binding.codigoTienda,
    source,
  };
}

export default { saveNormalizedReading };
