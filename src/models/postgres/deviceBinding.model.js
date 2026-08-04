/**
 * PostgreSQL model: device_bindings
 */

import { query } from '../../config/postgres.config.js';

function parseRow(row) {
  if (!row) return null;
  let meta = row.meta;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { /* keep string */ }
  }
  return {
    id: row.id,
    provider: row.provider,
    externalDeviceId: row.external_device_id,
    externalImei: row.external_imei,
    puntoventaId: row.puntoventa_id,
    codigoTienda: row.codigo_tienda,
    clientId: row.client_id != null ? String(row.client_id) : null,
    active: row.active,
    meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class DeviceBindingModel {
  static async findActiveByExternalId(provider, externalDeviceId) {
    const result = await query(
      `SELECT * FROM device_bindings
       WHERE provider = $1 AND external_device_id = $2 AND active = TRUE
       LIMIT 1`,
      [provider, String(externalDeviceId).trim()]
    );
    return parseRow(result.rows[0]);
  }

  static async findActiveByImei(provider, imei) {
    if (!imei) return null;
    const result = await query(
      `SELECT * FROM device_bindings
       WHERE provider = $1 AND external_imei = $2 AND active = TRUE
       LIMIT 1`,
      [provider, String(imei).trim()]
    );
    return parseRow(result.rows[0]);
  }

  static async upsert(data) {
    const provider = String(data.provider).trim();
    const externalDeviceId = String(data.externalDeviceId || data.external_device_id).trim();
    const codigoTienda = String(data.codigoTienda || data.codigo_tienda).trim();
    const result = await query(
      `INSERT INTO device_bindings (
         provider, external_device_id, external_imei, puntoventa_id,
         codigo_tienda, client_id, active, meta, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, TRUE),$8, NOW())
       ON CONFLICT (provider, external_device_id) DO UPDATE SET
         external_imei = COALESCE(EXCLUDED.external_imei, device_bindings.external_imei),
         puntoventa_id = COALESCE(EXCLUDED.puntoventa_id, device_bindings.puntoventa_id),
         codigo_tienda = EXCLUDED.codigo_tienda,
         client_id = COALESCE(EXCLUDED.client_id, device_bindings.client_id),
         active = COALESCE(EXCLUDED.active, device_bindings.active),
         meta = COALESCE(EXCLUDED.meta, device_bindings.meta),
         updated_at = NOW()
       RETURNING *`,
      [
        provider,
        externalDeviceId,
        data.externalImei || data.external_imei || null,
        data.puntoventaId || data.puntoventa_id || null,
        codigoTienda,
        data.clientId || data.client_id || null,
        data.active !== undefined ? data.active : true,
        data.meta != null ? JSON.stringify(data.meta) : null,
      ]
    );
    return parseRow(result.rows[0]);
  }

  static async listByProvider(provider, { activeOnly = true, limit = 500 } = {}) {
    const result = await query(
      `SELECT * FROM device_bindings
       WHERE provider = $1
         AND ($2::boolean IS FALSE OR active = TRUE)
       ORDER BY codigo_tienda
       LIMIT $3`,
      [provider, activeOnly, limit]
    );
    return result.rows.map(parseRow);
  }
}

export default DeviceBindingModel;
