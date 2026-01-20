// src/models/postgres/metric.model.js
// PostgreSQL model for metrics table

import { query } from '../../config/postgres.config.js';

/**
 * Metric Model
 * Handles all database operations for the metrics table
 */
class MetricModel {
  /**
   * Find metric by ID
   * @param {Number} id - Metric ID
   * @returns {Promise<Object|null>} Metric record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM metrics WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all metrics with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of metric records
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.clientId) {
      whereClause += ` AND clientid = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }

    if (filters.puntoVentaId) {
      whereClause += ` AND punto_venta_id = $${paramIndex}`;
      values.push(filters.puntoVentaId);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM metrics
      WHERE ${whereClause}
      ORDER BY createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[MetricModel] Error finding metrics:', error);
      throw error;
    }
  }

  /**
   * Create a new metric
   * @param {Object} data - Metric data object
   * @returns {Promise<Object>} Created metric record
   */
  static async create(data) {
    const {
      clientId,
      punto_venta_id,
      tds_range,
      production_volume_range,
      rejected_volume_range,
      flow_rate_speed_range,
      active_time,
      metrics_description
    } = data;

    const insertQuery = `
      INSERT INTO metrics (
        clientid, punto_venta_id, tds_range, production_volume_range,
        rejected_volume_range, flow_rate_speed_range,
        active_time, metrics_description
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `;

    const values = [
      clientId || null,
      punto_venta_id || null,
      tds_range !== undefined ? parseFloat(tds_range) : null,
      production_volume_range !== undefined ? parseFloat(production_volume_range) : null,
      rejected_volume_range !== undefined ? parseFloat(rejected_volume_range) : null,
      flow_rate_speed_range !== undefined ? parseFloat(flow_rate_speed_range) : null,
      active_time !== undefined ? parseFloat(active_time) : null,
      metrics_description || null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[MetricModel] Error creating metric:', error);
      throw error;
    }
  }

  /**
   * Update metric
   * @param {Number} id - Metric ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated metric record
   */
  static async update(id, data) {
    const {
      clientId,
      punto_venta_id,
      tds_range,
      production_volume_range,
      rejected_volume_range,
      flow_rate_speed_range,
      active_time,
      metrics_description
    } = data;

    const updateQuery = `
      UPDATE metrics
      SET 
        clientid = COALESCE($1, clientid),
        punto_venta_id = COALESCE($2, punto_venta_id),
        tds_range = COALESCE($3, tds_range),
        production_volume_range = COALESCE($4, production_volume_range),
        rejected_volume_range = COALESCE($5, rejected_volume_range),
        flow_rate_speed_range = COALESCE($6, flow_rate_speed_range),
        active_time = COALESCE($7, active_time),
        metrics_description = COALESCE($8, metrics_description),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const values = [
      clientId || null,
      punto_venta_id || null,
      tds_range !== undefined ? parseFloat(tds_range) : null,
      production_volume_range !== undefined ? parseFloat(production_volume_range) : null,
      rejected_volume_range !== undefined ? parseFloat(rejected_volume_range) : null,
      flow_rate_speed_range !== undefined ? parseFloat(flow_rate_speed_range) : null,
      active_time !== undefined ? parseFloat(active_time) : null,
      metrics_description || null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('[MetricModel] Error updating metric:', error);
      throw error;
    }
  }

  /**
   * Delete metric
   * @param {Number} id - Metric ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM metrics WHERE id = $1 RETURNING id';
    const result = await query(deleteQuery, [id]);
    return result.rows.length > 0;
  }

  /**
   * Parse database row to object with camelCase keys
   * @param {Object} row - Database row
   * @returns {Object} Parsed object
   */
  static parseRow(row) {
    if (!row) return null;

    return {
      id: row.id ? String(row.id) : null,
      _id: row.id ? String(row.id) : null, // For compatibility
      cliente: row.clientid ? String(row.clientid) : null,
      clientId: row.clientid ? String(row.clientid) : null,
      punto_venta_id: row.punto_venta_id ? String(row.punto_venta_id) : null,
      tds_range: row.tds_range !== null && row.tds_range !== undefined ? parseFloat(row.tds_range) : null,
      production_volume_range: row.production_volume_range !== null && row.production_volume_range !== undefined ? parseFloat(row.production_volume_range) : null,
      rejected_volume_range: row.rejected_volume_range !== null && row.rejected_volume_range !== undefined ? parseFloat(row.rejected_volume_range) : null,
      flow_rate_speed_range: row.flow_rate_speed_range !== null && row.flow_rate_speed_range !== undefined ? parseFloat(row.flow_rate_speed_range) : null,
      active_time: row.active_time !== null && row.active_time !== undefined ? parseFloat(row.active_time) : null,
      metrics_description: row.metrics_description || null,
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null
    };
  }
}

export default MetricModel;
