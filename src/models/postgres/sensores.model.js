// src/models/postgres/sensores.model.js
// PostgreSQL model for sensores table using raw SQL queries

import { query, getClient } from '../../config/postgres.config.js';

/**
 * Sensores Model
 * Handles all database operations for the sensores table
 */
class SensoresModel {
  /**
   * Create a new sensor reading
   * @param {Object} data - Sensor data object
   * @returns {Promise<Object>} Created sensor record
   */
  static async create(data) {
    const insertQuery = `
      INSERT INTO sensores (
        name, value, type, timestamp, meta,
        resourceId, resourceType, ownerId, clientId,
        status, label, lat, long, codigoTienda
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *
    `;

    const values = [
      data.name || null,
      data.value !== undefined ? parseFloat(data.value) : null,
      data.type || null,
      data.timestamp ? new Date(data.timestamp) : null,
      data.meta ? JSON.stringify(data.meta) : null,
      data.resourceId || null,
      data.resourceType || null,
      data.ownerId || null,
      data.clientId || null,
      data.status || null,
      data.label || null,
      data.lat !== undefined ? parseFloat(data.lat) : null,
      data.long !== undefined ? parseFloat(data.long) : null,
      data.codigoTienda || null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[SensoresModel] Error creating sensor reading:', error);
      throw error;
    }
  }

  /**
   * Create multiple sensor readings in a single transaction
   * @param {Array} dataArray - Array of sensor data objects
   * @returns {Promise<Array>} Created sensor records
   */
  static async createMany(dataArray) {
    if (!dataArray || dataArray.length === 0) {
      return [];
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO sensores (
          name, value, type, timestamp, meta,
          resourceId, resourceType, ownerId, clientId,
          status, label, lat, long, codigoTienda
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `;

      const results = [];
      for (const data of dataArray) {
        const values = [
          data.name || null,
          data.value !== undefined ? parseFloat(data.value) : null,
          data.type || null,
          data.timestamp ? new Date(data.timestamp) : null,
          data.meta ? JSON.stringify(data.meta) : null,
          data.resourceId || null,
          data.resourceType || null,
          data.ownerId || null,
          data.clientId || null,
          data.status || null,
          data.label || null,
          data.lat !== undefined ? parseFloat(data.lat) : null,
          data.long !== undefined ? parseFloat(data.long) : null,
          data.codigoTienda || null
        ];

        const result = await client.query(insertQuery, values);
        results.push(this.parseRow(result.rows[0]));
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[SensoresModel] Error creating multiple sensor readings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find sensor readings with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} Array of sensor records
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'timestamp DESC'
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause dynamically
    if (filters.codigoTienda) {
      whereClause += ` AND codigoTienda = $${paramIndex}`;
      values.push(filters.codigoTienda);
      paramIndex++;
    }

    if (filters.resourceId) {
      whereClause += ` AND resourceId = $${paramIndex}`;
      values.push(filters.resourceId);
      paramIndex++;
    }

    if (filters.resourceType) {
      whereClause += ` AND resourceType = $${paramIndex}`;
      values.push(filters.resourceType);
      paramIndex++;
    }

    if (filters.clientId) {
      whereClause += ` AND clientId = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }

    if (filters.type) {
      whereClause += ` AND type = $${paramIndex}`;
      values.push(filters.type);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(filters.startDate));
      paramIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(filters.endDate));
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM sensores
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[SensoresModel] Error finding sensor readings:', error);
      throw error;
    }
  }

  /**
   * Find a single sensor reading by ID
   * @param {Number} id - Sensor record ID
   * @returns {Promise<Object|null>} Sensor record or null
   */
  static async findById(id) {
    const selectQuery = 'SELECT * FROM sensores WHERE id = $1';
    
    try {
      const result = await query(selectQuery, [id]);
      return result.rows.length > 0 ? this.parseRow(result.rows[0]) : null;
    } catch (error) {
      console.error('[SensoresModel] Error finding sensor by ID:', error);
      throw error;
    }
  }

  /**
   * Get latest sensor reading
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object|null>} Latest sensor record or null
   */
  static async findLatest(filters = {}) {
    const options = { ...filters, limit: 1, orderBy: 'timestamp DESC' };
    const results = await this.find(filters, options);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count sensor readings with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Number>} Count of records
   */
  static async count(filters = {}) {
    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause (same logic as find)
    if (filters.codigoTienda) {
      whereClause += ` AND codigoTienda = $${paramIndex}`;
      values.push(filters.codigoTienda);
      paramIndex++;
    }

    if (filters.resourceId) {
      whereClause += ` AND resourceId = $${paramIndex}`;
      values.push(filters.resourceId);
      paramIndex++;
    }

    if (filters.resourceType) {
      whereClause += ` AND resourceType = $${paramIndex}`;
      values.push(filters.resourceType);
      paramIndex++;
    }

    if (filters.clientId) {
      whereClause += ` AND clientId = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }

    if (filters.type) {
      whereClause += ` AND type = $${paramIndex}`;
      values.push(filters.type);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(filters.startDate));
      paramIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(filters.endDate));
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as count FROM sensores WHERE ${whereClause}`;

    try {
      const result = await query(countQuery, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[SensoresModel] Error counting sensor readings:', error);
      throw error;
    }
  }

  /**
   * Parse database row to clean object
   * @param {Object} row - Database row
   * @returns {Object} Parsed sensor object
   */
  static parseRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      value: row.value !== null ? parseFloat(row.value) : null,
      type: row.type,
      timestamp: row.timestamp,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
      resourceId: row.resourceid,
      resourceType: row.resourcetype,
      ownerId: row.ownerid,
      clientId: row.clientid,
      status: row.status,
      label: row.label,
      lat: row.lat !== null ? parseFloat(row.lat) : null,
      long: row.long !== null ? parseFloat(row.long) : null,
      codigoTienda: row.codigotienda
    };
  }
}

export default SensoresModel;

