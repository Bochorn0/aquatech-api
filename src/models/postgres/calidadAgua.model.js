// src/models/postgres/calidadAgua.model.js
// PostgreSQL model for calidad_agua table

import { query } from '../../config/postgres.config.js';

/**
 * CalidadAgua Model
 * Handles all database operations for the calidad_agua table
 */
class CalidadAguaModel {
  /**
   * Find water quality record by ID
   * @param {Number} id - Record ID
   * @returns {Promise<Object|null>} Water quality record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM calidad_agua WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all water quality records with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of water quality records
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 1000,
      offset = 0
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.estado) {
      whereClause += ` AND LOWER(estado) = LOWER($${paramIndex})`;
      values.push(filters.estado);
      paramIndex++;
    }

    if (filters.ciudad) {
      whereClause += ` AND LOWER(ciudad) = LOWER($${paramIndex})`;
      values.push(filters.ciudad);
      paramIndex++;
    }

    if (filters.municipio) {
      whereClause += ` AND LOWER(municipio) = LOWER($${paramIndex})`;
      values.push(filters.municipio);
      paramIndex++;
    }

    if (filters.owner) {
      whereClause += ` AND owner = $${paramIndex}`;
      values.push(filters.owner);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM calidad_agua
      WHERE ${whereClause}
      ORDER BY estado, ciudad
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[CalidadAguaModel] Error finding records:', error);
      throw error;
    }
  }

  /**
   * Get aggregated water quality by state (latest records only)
   * @returns {Promise<Array>} Array of state aggregations
   */
  static async getByState() {
    const selectQuery = `
      WITH latest_records AS (
        SELECT DISTINCT ON (ciudad, estado) *
        FROM calidad_agua
        ORDER BY ciudad, estado, createdat DESC
      )
      SELECT 
        estado,
        COUNT(*) as total_registros,
        AVG(calidad) as calidad_promedio,
        MIN(tds_minimo) as tds_min,
        MAX(tds_maximo) as tds_max,
        ARRAY_AGG(DISTINCT ciudad) as ciudades
      FROM latest_records
      GROUP BY estado
      ORDER BY estado
    `;

    try {
      const result = await query(selectQuery);
      return result.rows.map(row => ({
        estado: row.estado,
        totalRegistros: parseInt(row.total_registros, 10),
        calidadPromedio: parseFloat(row.calidad_promedio),
        tdsMin: row.tds_min ? parseFloat(row.tds_min) : null,
        tdsMax: row.tds_max ? parseFloat(row.tds_max) : null,
        ciudades: row.ciudades || []
      }));
    } catch (error) {
      console.error('[CalidadAguaModel] Error getting state aggregation:', error);
      throw error;
    }
  }

  /**
   * Get historical water quality data for a specific state
   * @param {String} estado - State name
   * @returns {Promise<Array>} Array of historical records
   */
  static async getHistoricalByState(estado) {
    const selectQuery = `
      SELECT 
        ciudad,
        calidad,
        tds_minimo,
        tds_maximo,
        createdat
      FROM calidad_agua
      WHERE LOWER(estado) = LOWER($1)
      ORDER BY createdat ASC, ciudad
    `;

    try {
      const result = await query(selectQuery, [estado]);
      return result.rows.map(row => ({
        ciudad: row.ciudad,
        calidad: row.calidad ? parseFloat(row.calidad) : null,
        tdsMinimo: row.tds_minimo ? parseFloat(row.tds_minimo) : null,
        tdsMaximo: row.tds_maximo ? parseFloat(row.tds_maximo) : null,
        createdAt: row.createdat
      }));
    } catch (error) {
      console.error('[CalidadAguaModel] Error getting historical data:', error);
      throw error;
    }
  }

  /**
   * Create a new water quality record
   * @param {Object} data - Water quality data object
   * @returns {Promise<Object>} Created record
   */
  static async create(data) {
    const {
      municipio,
      ciudad,
      estado,
      calidad,
      tdsMinimo,
      tdsMaximo,
      owner
    } = data;

    const insertQuery = `
      INSERT INTO calidad_agua (
        municipio, ciudad, estado, calidad, tds_minimo, tds_maximo, owner
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING *
    `;

    const values = [
      municipio || null,
      ciudad || null,
      estado || null,
      calidad !== undefined ? parseFloat(calidad) : null,
      tdsMinimo !== undefined ? parseFloat(tdsMinimo) : null,
      tdsMaximo !== undefined ? parseFloat(tdsMaximo) : null,
      owner || null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[CalidadAguaModel] Error creating record:', error);
      throw error;
    }
  }

  /**
   * Update water quality record
   * @param {Number} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  static async update(id, data) {
    const {
      municipio,
      ciudad,
      estado,
      calidad,
      tdsMinimo,
      tdsMaximo,
      owner
    } = data;

    const updateQuery = `
      UPDATE calidad_agua
      SET 
        municipio = COALESCE($1, municipio),
        ciudad = COALESCE($2, ciudad),
        estado = COALESCE($3, estado),
        calidad = COALESCE($4, calidad),
        tds_minimo = COALESCE($5, tds_minimo),
        tds_maximo = COALESCE($6, tds_maximo),
        owner = COALESCE($7, owner),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      municipio || null,
      ciudad || null,
      estado || null,
      calidad !== undefined ? parseFloat(calidad) : null,
      tdsMinimo !== undefined ? parseFloat(tdsMinimo) : null,
      tdsMaximo !== undefined ? parseFloat(tdsMaximo) : null,
      owner !== undefined ? owner : null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('[CalidadAguaModel] Error updating record:', error);
      throw error;
    }
  }

  /**
   * Delete water quality record
   * @param {Number} id - Record ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM calidad_agua WHERE id = $1 RETURNING id';
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
      municipio: row.municipio || null,
      ciudad: row.ciudad || null,
      estado: row.estado || null,
      calidad: row.calidad !== null && row.calidad !== undefined ? parseFloat(row.calidad) : null,
      tdsMinimo: row.tds_minimo !== null && row.tds_minimo !== undefined ? parseFloat(row.tds_minimo) : null,
      tdsMaximo: row.tds_maximo !== null && row.tds_maximo !== undefined ? parseFloat(row.tds_maximo) : null,
      owner: row.owner || null,
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null
    };
  }
}

export default CalidadAguaModel;
