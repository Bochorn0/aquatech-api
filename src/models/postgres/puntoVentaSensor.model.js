// src/models/postgres/puntoVentaSensor.model.js
// PostgreSQL model for puntoventasensors table

import { query } from '../../config/postgres.config.js';

/**
 * PuntoVentaSensor Model
 * Handles all database operations for the puntoventasensors table
 */
class PuntoVentaSensorModel {
  /**
   * Find sensor configuration by ID
   * @param {Number} id - Sensor configuration ID
   * @returns {Promise<Object|null>} Sensor configuration or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM puntoventasensors WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all sensors for a puntoVenta
   * @param {Number} puntoVentaId - PuntoVenta ID
   * @returns {Promise<Array>} Array of sensor configurations
   */
  static async findByPuntoVentaId(puntoVentaId) {
    const result = await query(
      'SELECT * FROM puntoventasensors WHERE punto_venta_id = $1 ORDER BY sensor_name ASC',
      [puntoVentaId]
    );

    return result.rows.map(row => this.parseRow(row));
  }

  /**
   * Find sensor configuration by puntoVenta and sensor type
   * @param {Number} puntoVentaId - PuntoVenta ID
   * @param {String} sensorType - Sensor type
   * @param {String} resourceId - Optional resource ID
   * @param {String} resourceType - Optional resource type
   * @returns {Promise<Object|null>} Sensor configuration or null
   */
  static async findByPuntoVentaAndType(puntoVentaId, sensorType, resourceId = null, resourceType = null) {
    const result = await query(
      `SELECT * FROM puntoventasensors 
       WHERE punto_venta_id = $1 
         AND sensor_type = $2 
         AND COALESCE(resource_id, '') = COALESCE($3, '')
         AND COALESCE(resource_type, '') = COALESCE($4, '')
       LIMIT 1`,
      [puntoVentaId, sensorType, resourceId || null, resourceType || null]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Create a new sensor configuration
   * @param {Object} data - Sensor configuration data
   * @returns {Promise<Object>} Created sensor configuration
   */
  static async create(data) {
    const {
      punto_venta_id,
      sensor_name,
      sensor_type,
      resource_id,
      resource_type,
      label,
      unit,
      min_value,
      max_value,
      enabled,
      meta
    } = data;

    const insertQuery = `
      INSERT INTO puntoventasensors (
        punto_venta_id, sensor_name, sensor_type, resource_id, resource_type,
        label, unit, min_value, max_value, enabled, meta
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;

    const values = [
      punto_venta_id,
      sensor_name || null,
      sensor_type || null,
      resource_id || null,
      resource_type || null,
      label || null,
      unit || null,
      min_value !== undefined ? parseFloat(min_value) : null,
      max_value !== undefined ? parseFloat(max_value) : null,
      enabled !== undefined ? enabled : true,
      meta ? JSON.stringify(meta) : null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      // Handle unique constraint violation (sensor already exists)
      if (error.code === '23505') {
        // Try to get existing record
        const existing = await this.findByPuntoVentaAndType(
          punto_venta_id,
          sensor_type,
          resource_id,
          resource_type
        );
        if (existing) {
          return existing;
        }
      }
      console.error('[PuntoVentaSensorModel] Error creating sensor configuration:', error);
      throw error;
    }
  }

  /**
   * Update sensor configuration
   * @param {Number} id - Sensor configuration ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated sensor configuration
   */
  static async update(id, data) {
    const {
      sensor_name,
      label,
      unit,
      min_value,
      max_value,
      enabled,
      meta
    } = data;

    const updateQuery = `
      UPDATE puntoventasensors
      SET 
        sensor_name = COALESCE($1, sensor_name),
        label = COALESCE($2, label),
        unit = COALESCE($3, unit),
        min_value = COALESCE($4, min_value),
        max_value = COALESCE($5, max_value),
        enabled = COALESCE($6, enabled),
        meta = COALESCE($7, meta),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      sensor_name || null,
      label || null,
      unit || null,
      min_value !== undefined ? parseFloat(min_value) : null,
      max_value !== undefined ? parseFloat(max_value) : null,
      enabled !== undefined ? enabled : null,
      meta ? JSON.stringify(meta) : null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('[PuntoVentaSensorModel] Error updating sensor configuration:', error);
      throw error;
    }
  }

  /**
   * Delete sensor configuration
   * @param {Number} id - Sensor configuration ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM puntoventasensors WHERE id = $1 RETURNING id';
    try {
      const result = await query(deleteQuery, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[PuntoVentaSensorModel] Error deleting sensor configuration:', error);
      throw error;
    }
  }

  /**
   * Get or create sensor configuration (for MQTT auto-registration)
   * @param {Object} data - Sensor configuration data
   * @returns {Promise<Object>} Sensor configuration (existing or newly created)
   */
  static async getOrCreate(data) {
    const existing = await this.findByPuntoVentaAndType(
      data.punto_venta_id,
      data.sensor_type,
      data.resource_id,
      data.resource_type
    );

    if (existing) {
      return existing;
    }

    return this.create(data);
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
      puntoVentaId: row.punto_venta_id ? String(row.punto_venta_id) : null,
      sensorName: row.sensor_name || null,
      sensorType: row.sensor_type || null,
      resourceId: row.resource_id || null,
      resourceType: row.resource_type || null,
      label: row.label || null,
      unit: row.unit || null,
      minValue: row.min_value !== null && row.min_value !== undefined ? parseFloat(row.min_value) : null,
      maxValue: row.max_value !== null && row.max_value !== undefined ? parseFloat(row.max_value) : null,
      enabled: row.enabled !== undefined ? row.enabled : true,
      meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }
}

export default PuntoVentaSensorModel;
