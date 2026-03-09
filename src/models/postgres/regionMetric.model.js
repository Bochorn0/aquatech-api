// src/models/postgres/regionMetric.model.js
// PostgreSQL model for region_metrics table

import { query } from '../../config/postgres.config.js';

class RegionMetricModel {
  static async findById(id) {
    const result = await query(
      'SELECT * FROM region_metrics WHERE id = $1 LIMIT 1',
      [id]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async find(filters = {}, options = {}) {
    const { limit = 100, offset = 0 } = options;
    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.clientId != null) {
      whereClause += ` AND client_id = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }
    if (filters.regionId != null) {
      whereClause += ` AND region_id = $${paramIndex}`;
      values.push(filters.regionId);
      paramIndex++;
    }
    if (filters.sensor_type) {
      whereClause += ` AND sensor_type = $${paramIndex}`;
      values.push(filters.sensor_type);
      paramIndex++;
    }
    if (filters.enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex}`;
      values.push(filters.enabled);
      paramIndex++;
    }

    const orderBy = filters.orderBy || 'display_order ASC, createdat DESC';
    values.push(limit, offset);
    const selectQuery = `
      SELECT * FROM region_metrics
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const result = await query(selectQuery, values);
    return (result.rows || []).map(row => this.parseRow(row));
  }

  static async create(data) {
    const insertQuery = `
      INSERT INTO region_metrics (
        client_id, region_id, metric_name, metric_type, sensor_type, sensor_unit,
        rules, conditions, enabled, read_only, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      data.clientId ?? null,
      data.regionId ?? null,
      data.metric_name ?? null,
      data.metric_type ?? null,
      data.sensor_type ?? null,
      data.sensor_unit ?? null,
      data.rules != null ? JSON.stringify(data.rules) : null,
      data.conditions != null ? JSON.stringify(data.conditions) : null,
      data.enabled !== undefined ? data.enabled : true,
      data.read_only !== undefined ? data.read_only : false,
      data.display_order ?? 0
    ];
    const result = await query(insertQuery, values);
    return this.parseRow(result.rows[0]);
  }

  static async update(id, data) {
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (data.clientId !== undefined) { updates.push(`client_id = $${paramIndex}`); values.push(data.clientId); paramIndex++; }
    if (data.regionId !== undefined) { updates.push(`region_id = $${paramIndex}`); values.push(data.regionId); paramIndex++; }
    if (data.metric_name !== undefined) { updates.push(`metric_name = $${paramIndex}`); values.push(data.metric_name); paramIndex++; }
    if (data.metric_type !== undefined) { updates.push(`metric_type = $${paramIndex}`); values.push(data.metric_type); paramIndex++; }
    if (data.sensor_type !== undefined) { updates.push(`sensor_type = $${paramIndex}`); values.push(data.sensor_type); paramIndex++; }
    if (data.sensor_unit !== undefined) { updates.push(`sensor_unit = $${paramIndex}`); values.push(data.sensor_unit); paramIndex++; }
    if (data.rules !== undefined) { updates.push(`rules = $${paramIndex}::jsonb`); values.push(data.rules != null ? JSON.stringify(data.rules) : null); paramIndex++; }
    if (data.conditions !== undefined) { updates.push(`conditions = $${paramIndex}::jsonb`); values.push(data.conditions != null ? JSON.stringify(data.conditions) : null); paramIndex++; }
    if (data.enabled !== undefined) { updates.push(`enabled = $${paramIndex}`); values.push(data.enabled); paramIndex++; }
    if (data.read_only !== undefined) { updates.push(`read_only = $${paramIndex}`); values.push(data.read_only); paramIndex++; }
    if (data.display_order !== undefined) { updates.push(`display_order = $${paramIndex}`); values.push(data.display_order); paramIndex++; }
    if (updates.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE region_metrics SET ${updates.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows?.length > 0 ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM region_metrics WHERE id = $1 RETURNING id', [id]);
    return (result.rowCount || 0) > 0;
  }

  static parseRow(row) {
    if (!row) return null;
    let rules = null;
    let conditions = null;
    try {
      if (row.rules) rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules;
      if (row.conditions) conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions;
    } catch (_) {}
    return {
      id: row.id ? String(row.id) : null,
      _id: row.id ? String(row.id) : null,
      clientId: row.client_id != null ? String(row.client_id) : null,
      cliente: row.client_id != null ? String(row.client_id) : null,
      regionId: row.region_id != null ? String(row.region_id) : null,
      metric_name: row.metric_name || null,
      metric_type: row.metric_type || null,
      sensor_type: row.sensor_type || null,
      sensor_unit: row.sensor_unit || null,
      rules,
      conditions,
      enabled: row.enabled !== undefined ? row.enabled : true,
      read_only: row.read_only !== undefined ? row.read_only : false,
      display_order: row.display_order ?? 0,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null
    };
  }
}

export default RegionMetricModel;
