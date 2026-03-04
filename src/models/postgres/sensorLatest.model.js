// src/models/postgres/sensorLatest.model.js
// Keeps the most recent sensor value per (codigo_tienda, type, resource). Updated on every sensores insert.

import { query } from '../../config/postgres.config.js';

const TABLE = 'sensor_latest';

/**
 * Upsert a single sensor reading into sensor_latest (one row per codigo_tienda + type + resource).
 * Call this whenever a new row is inserted into sensores.
 */
export async function upsertOne(data) {
  const codigoTienda = (data.codigoTienda ?? data.codigo_tienda ?? '').toString().trim();
  const type = (data.type ?? '').toString().trim();
  const resourceId = (data.resourceId ?? data.resource_id ?? '').toString().trim();
  const resourceType = (data.resourceType ?? data.resource_type ?? '').toString().trim();
  const name = data.name ?? null;
  const value = data.value != null ? parseFloat(data.value) : null;
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();

  if (!codigoTienda || !type) return null;

  const sql = `
    INSERT INTO ${TABLE} (codigo_tienda, type, resource_id, resource_type, name, value, "timestamp")
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (codigo_tienda, type, resource_id, resource_type)
    DO UPDATE SET
      name = EXCLUDED.name,
      value = EXCLUDED.value,
      "timestamp" = EXCLUDED."timestamp",
      updated_at = CURRENT_TIMESTAMP
  `;
  await query(sql, [codigoTienda, type, resourceId, resourceType, name, value, ts]);
  return { codigoTienda, type, resourceId, resourceType, value, timestamp: ts };
}

/**
 * Upsert multiple sensor readings (e.g. after SensoresModel.createMany).
 * Each item should have codigoTienda, type, resourceId, resourceType, name, value, timestamp.
 */
export async function upsertMany(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
  for (const data of dataArray) {
    await upsertOne(data);
  }
  return dataArray.length;
}

/**
 * Get latest values for a store code (e.g. for dashboard / punto venta).
 * Returns array of { type, name, value, timestamp }.
 */
export async function getLatestByCodigoTienda(codigoTienda) {
  const code = (codigoTienda ?? '').toString().trim();
  if (!code) return [];

  const result = await query(
    `SELECT type, name, value, "timestamp", resource_id, resource_type
     FROM ${TABLE}
     WHERE codigo_tienda = $1
     ORDER BY type`,
    [code]
  );
  return (result.rows || []).map((row) => ({
    type: row.type,
    name: row.name,
    value: row.value != null ? parseFloat(row.value) : null,
    timestamp: row.timestamp,
    resourceId: row.resource_id || null,
    resourceType: row.resource_type || null,
  }));
}

/**
 * Get latest values for multiple store codes (e.g. for dashboard global).
 * Returns object keyed by codigo_tienda: { [codigo_tienda]: [ { type, name, value, timestamp }, ... ] }
 */
export async function getLatestByCodigoTiendas(codigoTiendas) {
  if (!Array.isArray(codigoTiendas) || codigoTiendas.length === 0) return {};
  const codes = codigoTiendas.map((c) => (c ?? '').toString().trim()).filter(Boolean);
  if (codes.length === 0) return {};

  const placeholders = codes.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `SELECT codigo_tienda, type, name, value, "timestamp", resource_id, resource_type
     FROM ${TABLE}
     WHERE codigo_tienda IN (${placeholders})
     ORDER BY codigo_tienda, type`,
    codes
  );
  const byCode = {};
  for (const row of result.rows || []) {
    const code = row.codigo_tienda;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({
      type: row.type,
      name: row.name,
      value: row.value != null ? parseFloat(row.value) : null,
      timestamp: row.timestamp,
      resourceId: row.resource_id || null,
      resourceType: row.resource_type || null,
    });
  }
  return byCode;
}

export default { upsertOne, upsertMany, getLatestByCodigoTienda, getLatestByCodigoTiendas };
