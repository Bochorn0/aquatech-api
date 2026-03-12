// One row per MQTT message; meta stored once. Detail rows in sensores.

import { query } from '../../config/postgres.config.js';

/**
 * Insert one message row; returns id for linking sensor_details.
 * Topic hierarchy: CLIENTE/REGION/CIUDAD/CODIGO_TIENDA/data → cliente_identifier, region, ciudad, codigotienda.
 * @param {Object} data - { timestamp, clientid, lat, long, codigotienda, resourceid, resourcetype, meta, region, ciudad, cliente_identifier }
 * @returns {Promise<{ id: number }>}
 */
export async function createMessage(data) {
  const result = await query(
    `INSERT INTO sensores_message (
      "timestamp", clientid, lat, long, codigotienda, resourceid, resourcetype, meta,
      region, ciudad, cliente_identifier
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      data.timestamp || new Date(),
      data.clientid ?? null,
      data.lat ?? null,
      data.long ?? null,
      data.codigotienda ?? null,
      data.resourceid ?? null,
      data.resourcetype ?? null,
      data.meta != null ? (typeof data.meta === 'string' ? data.meta : JSON.stringify(data.meta)) : null,
      data.region ?? null,
      data.ciudad ?? null,
      data.cliente_identifier ?? null
    ]
  );
  return { id: result.rows[0].id };
}

/**
 * Insert many detail rows for one message (no meta).
 * @param {number} sensoresMessageId
 * @param {Array<{ name: string, type: string, value: number }>} rows
 */
export async function createDetails(sensoresMessageId, rows) {
  if (!rows || rows.length === 0) return;
  const values = [];
  const placeholders = [];
  let i = 1;
  for (const r of rows) {
    placeholders.push(`($${i}, $${i + 1}, $${i + 2}, $${i + 3})`);
    values.push(sensoresMessageId, r.name ?? null, r.type ?? null, r.value != null ? parseFloat(r.value) : null);
    i += 4;
  }
  await query(
    `INSERT INTO sensores (sensores_message_id, name, type, value) VALUES ${placeholders.join(', ')}`,
    values
  );
}

export default { createMessage, createDetails };
