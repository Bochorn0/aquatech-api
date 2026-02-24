// PostgreSQL model for client_metrics (legacy one-per-client, replaces MongoDB Metric)

import { query } from '../../config/postgres.config.js';

class ClientMetricModel {
  static async findById(id) {
    const result = await query('SELECT * FROM client_metrics WHERE id = $1 LIMIT 1', [id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByClientId(clientId) {
    const result = await query('SELECT * FROM client_metrics WHERE client_id = $1 LIMIT 1', [clientId]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async find(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.client_id != null || filters.cliente != null) {
      where.push(`client_id = $${i}`);
      values.push(filters.client_id ?? filters.cliente);
      i++;
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`SELECT * FROM client_metrics WHERE ${whereClause} ORDER BY createdat DESC`, values);
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async create(data) {
    const result = await query(`
      INSERT INTO client_metrics (client_id, product_type, tds_range, production_volume_range, temperature_range, rejected_volume_range, flow_rate_speed_range, filter_only_online, active_time, metrics_description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.client_id ?? data.cliente,
      data.product_type ?? null,
      data.tds_range ?? 0,
      data.production_volume_range ?? 0,
      data.temperature_range ?? 0,
      data.rejected_volume_range ?? 0,
      data.flow_rate_speed_range ?? 0,
      data.filter_only_online ?? true,
      data.active_time ?? null,
      data.metrics_description ?? null
    ]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async update(id, data) {
    const result = await query(`
      UPDATE client_metrics SET
        client_id = COALESCE($1, client_id),
        product_type = COALESCE($2, product_type),
        tds_range = COALESCE($3, tds_range),
        production_volume_range = COALESCE($4, production_volume_range),
        temperature_range = COALESCE($5, temperature_range),
        rejected_volume_range = COALESCE($6, rejected_volume_range),
        flow_rate_speed_range = COALESCE($7, flow_rate_speed_range),
        filter_only_online = COALESCE($8, filter_only_online),
        active_time = COALESCE($9, active_time),
        metrics_description = COALESCE($10, metrics_description),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $11 RETURNING *
    `, [
      data.client_id ?? data.cliente,
      data.product_type,
      data.tds_range,
      data.production_volume_range,
      data.temperature_range,
      data.rejected_volume_range,
      data.flow_rate_speed_range,
      data.filter_only_online,
      data.active_time,
      data.metrics_description,
      id
    ]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM client_metrics WHERE id = $1 RETURNING id', [id]);
    return result.rows?.length > 0;
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      _id: String(row.id),
      cliente: row.client_id,
      client_id: row.client_id,
      product_type: row.product_type,
      tds_range: row.tds_range,
      production_volume_range: row.production_volume_range,
      temperature_range: row.temperature_range,
      rejected_volume_range: row.rejected_volume_range,
      flow_rate_speed_range: row.flow_rate_speed_range,
      filter_only_online: row.filter_only_online ?? true,
      active_time: row.active_time,
      metrics_description: row.metrics_description
    };
  }
}

export default ClientMetricModel;
