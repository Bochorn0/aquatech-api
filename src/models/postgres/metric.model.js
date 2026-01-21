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

    if (filters.metricType) {
      whereClause += ` AND metric_type = $${paramIndex}`;
      values.push(filters.metricType);
      paramIndex++;
    }

    if (filters.enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex}`;
      values.push(filters.enabled);
      paramIndex++;
    }

    // Order by display_order first, then by createdat
    const orderBy = filters.orderBy || 'display_order ASC, createdat DESC';

    const selectQuery = `
      SELECT * FROM metrics
      WHERE ${whereClause}
      ORDER BY ${orderBy}
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
      metric_name,
      metric_type,
      sensor_type,
      sensor_unit,
      rules,
      conditions,
      enabled = true,
      read_only = false,
      display_order = 0
    } = data;

    const insertQuery = `
      INSERT INTO metrics (
        clientid, punto_venta_id, metric_name, metric_type, sensor_type, sensor_unit,
        rules, conditions, enabled, read_only, display_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;

    const values = [
      clientId || null,
      punto_venta_id || null,
      metric_name || null,
      metric_type || null,
      sensor_type || null,
      sensor_unit || null,
      rules ? JSON.stringify(rules) : null,
      conditions ? JSON.stringify(conditions) : null,
      enabled,
      read_only,
      display_order || 0
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
      metric_name,
      metric_type,
      sensor_type,
      sensor_unit,
      rules,
      conditions,
      enabled,
      read_only,
      display_order
    } = data;

    const updateQuery = `
      UPDATE metrics
      SET 
        clientid = COALESCE($1, clientid),
        punto_venta_id = COALESCE($2, punto_venta_id),
        metric_name = COALESCE($3, metric_name),
        metric_type = COALESCE($4, metric_type),
        sensor_type = COALESCE($5, sensor_type),
        sensor_unit = COALESCE($6, sensor_unit),
        rules = COALESCE($7::jsonb, rules),
        conditions = COALESCE($8::jsonb, conditions),
        enabled = COALESCE($9, enabled),
        read_only = COALESCE($10, read_only),
        display_order = COALESCE($11, display_order),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;

    const values = [
      clientId !== undefined ? clientId : null,
      punto_venta_id !== undefined ? punto_venta_id : null,
      metric_name !== undefined ? metric_name : null,
      metric_type !== undefined ? metric_type : null,
      sensor_type !== undefined ? sensor_type : null,
      sensor_unit !== undefined ? sensor_unit : null,
      rules !== undefined ? JSON.stringify(rules) : null,
      conditions !== undefined ? JSON.stringify(conditions) : null,
      enabled !== undefined ? enabled : null,
      read_only !== undefined ? read_only : null,
      display_order !== undefined ? display_order : null,
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

    // Parse JSONB fields
    let rules = null;
    let conditions = null;
    
    try {
      if (row.rules) {
        rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules;
      }
      if (row.conditions) {
        conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions;
      }
    } catch (error) {
      console.warn('[MetricModel] Error parsing JSONB fields:', error);
    }

    return {
      id: row.id ? String(row.id) : null,
      _id: row.id ? String(row.id) : null, // For compatibility
      cliente: row.clientid ? String(row.clientid) : null,
      clientId: row.clientid ? String(row.clientid) : null,
      punto_venta_id: row.punto_venta_id ? String(row.punto_venta_id) : null,
      metric_name: row.metric_name || null,
      metric_type: row.metric_type || null,
      sensor_type: row.sensor_type || null,
      sensor_unit: row.sensor_unit || null,
      rules: rules,
      conditions: conditions,
      enabled: row.enabled !== undefined ? row.enabled : true,
      read_only: row.read_only !== undefined ? row.read_only : false,
      display_order: row.display_order || 0,
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null
    };
  }
}

export default MetricModel;
