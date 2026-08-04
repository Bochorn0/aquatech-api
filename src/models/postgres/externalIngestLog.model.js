/**
 * PostgreSQL model: external_ingest_log (idempotency + audit)
 */

import { query } from '../../config/postgres.config.js';

class ExternalIngestLogModel {
  /**
   * @returns {{ inserted: boolean, row: object|null }}
   */
  static async tryBegin(data) {
    try {
      const result = await query(
        `INSERT INTO external_ingest_log (
           provider, external_device_id, idempotency_key, status, codigo_tienda, payload
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          data.provider,
          data.externalDeviceId || null,
          data.idempotencyKey,
          data.status || 'queued',
          data.codigoTienda || null,
          data.payload != null ? JSON.stringify(data.payload) : null,
        ]
      );
      return { inserted: true, row: result.rows[0] };
    } catch (err) {
      if (err.code === '23505') {
        const existing = await query(
          `SELECT * FROM external_ingest_log WHERE idempotency_key = $1 LIMIT 1`,
          [data.idempotencyKey]
        );
        return { inserted: false, row: existing.rows[0] || null };
      }
      throw err;
    }
  }

  static async markPersisted(idempotencyKey, { codigoTienda, sensoresMessageId } = {}) {
    await query(
      `UPDATE external_ingest_log
       SET status = 'persisted',
           codigo_tienda = COALESCE($2, codigo_tienda),
           sensores_message_id = $3
       WHERE idempotency_key = $1`,
      [idempotencyKey, codigoTienda || null, sensoresMessageId || null]
    );
  }

  static async markStatus(idempotencyKey, status, error = null) {
    await query(
      `UPDATE external_ingest_log
       SET status = $2, error = $3
       WHERE idempotency_key = $1`,
      [idempotencyKey, status, error]
    );
  }
}

export default ExternalIngestLogModel;
