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

  /**
   * Ops listing / DLQ visibility.
   * @param {{ provider?: string, status?: string, limit?: number, offset?: number }} opts
   */
  static async list({ provider, status, limit = 50, offset = 0 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const result = await query(
      `SELECT id, provider, external_device_id, idempotency_key, status, codigo_tienda,
              sensores_message_id, error, received_at
       FROM external_ingest_log
       WHERE ($1::text IS NULL OR provider = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY received_at DESC
       LIMIT $3 OFFSET $4`,
      [provider || null, status || null, lim, off]
    );
    return (result.rows || []).map((row) => ({
      id: row.id,
      provider: row.provider,
      externalDeviceId: row.external_device_id,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      codigoTienda: row.codigo_tienda,
      sensoresMessageId: row.sensores_message_id,
      error: row.error,
      receivedAt: row.received_at,
    }));
  }

  static async countByStatus({ provider } = {}) {
    const result = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM external_ingest_log
       WHERE ($1::text IS NULL OR provider = $1)
       GROUP BY status
       ORDER BY status`,
      [provider || null]
    );
    return result.rows || [];
  }
}

export default ExternalIngestLogModel;
