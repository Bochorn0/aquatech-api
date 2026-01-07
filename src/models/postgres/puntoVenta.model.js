// src/models/postgres/puntoVenta.model.js
// PostgreSQL model for puntoVenta table

import { query, getClient } from '../../config/postgres.config.js';

/**
 * PuntoVenta Model
 * Handles all database operations for the puntoVenta table
 */
class PuntoVentaModel {
  /**
   * Get or create puntoVenta by code/codigo_tienda
   * If it doesn't exist, creates it with default null values
   * @param {Object} data - PuntoVenta data object
   * @returns {Promise<Object>} PuntoVenta record
   */
  static async getOrCreate(data) {
    const {
      code,
      codigo_tienda,
      name,
      owner,
      clientId,
      status,
      lat,
      long,
      address,
      contactId,
      meta
    } = data;

    // Use the database function to get or create
    const result = await query(
      `SELECT * FROM get_or_create_punto_venta(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )`,
      [
        code || null,
        codigo_tienda || null,
        name || null,
        owner || null,
        clientId || null,
        status || null,
        lat !== undefined ? parseFloat(lat) : null,
        long !== undefined ? parseFloat(long) : null,
        address || null,
        contactId || null,
        meta ? JSON.stringify(meta) : null
      ]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find puntoVenta by code or codigo_tienda
   * @param {String} code - Code or codigo_tienda to search for
   * @returns {Promise<Object|null>} PuntoVenta record or null
   */
  static async findByCode(code) {
    if (!code) return null;

    const result = await query(
      `SELECT * FROM puntoVenta 
       WHERE code = $1 OR codigo_tienda = $1 
       LIMIT 1`,
      [code.toUpperCase()]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find puntoVenta by ID
   * @param {Number} id - PuntoVenta ID
   * @returns {Promise<Object|null>} PuntoVenta record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM puntoVenta WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Create a new puntoVenta
   * @param {Object} data - PuntoVenta data object
   * @returns {Promise<Object>} Created puntoVenta record
   */
  static async create(data) {
    const {
      code,
      codigo_tienda,
      name,
      owner,
      clientId,
      status,
      lat,
      long,
      address,
      contactId,
      meta
    } = data;

    // Check if already exists
    const existing = await this.findByCode(code || codigo_tienda);
    if (existing) {
      return existing;
    }

    const insertQuery = `
      INSERT INTO puntoVenta (
        name, code, codigo_tienda, owner, clientId, status,
        lat, long, address, contactId, meta
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;

    const values = [
      name || null,
      (code || codigo_tienda)?.toUpperCase() || null,
      codigo_tienda?.toUpperCase() || code?.toUpperCase() || null,
      owner || null,
      clientId || null,
      status || 'active',
      lat !== undefined ? parseFloat(lat) : null,
      long !== undefined ? parseFloat(long) : null,
      address || null,
      contactId || null,
      meta ? JSON.stringify(meta) : null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      // If duplicate key error, try to get existing record
      if (error.code === '23505') { // unique_violation
        return await this.findByCode(code || codigo_tienda);
      }
      console.error('[PuntoVentaModel] Error creating puntoVenta:', error);
      throw error;
    }
  }

  /**
   * Update puntoVenta
   * @param {Number} id - PuntoVenta ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated puntoVenta record
   */
  static async update(id, data) {
    const {
      name,
      owner,
      clientId,
      status,
      lat,
      long,
      address,
      contactId,
      meta
    } = data;

    const updateQuery = `
      UPDATE puntoVenta
      SET 
        name = COALESCE($1, name),
        owner = COALESCE($2, owner),
        clientId = COALESCE($3, clientId),
        status = COALESCE($4, status),
        lat = COALESCE($5, lat),
        long = COALESCE($6, long),
        address = COALESCE($7, address),
        contactId = COALESCE($8, contactId),
        meta = COALESCE($9, meta),
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;

    const values = [
      name || null,
      owner || null,
      clientId || null,
      status || null,
      lat !== undefined ? parseFloat(lat) : null,
      long !== undefined ? parseFloat(long) : null,
      address || null,
      contactId || null,
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
      console.error('[PuntoVentaModel] Error updating puntoVenta:', error);
      throw error;
    }
  }

  /**
   * Find all puntoVentas with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of puntoVenta records
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
      whereClause += ` AND clientId = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM puntoVenta
      WHERE ${whereClause}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[PuntoVentaModel] Error finding puntoVentas:', error);
      throw error;
    }
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
      name: row.name || null,
      code: row.code || null,
      codigo_tienda: row.codigo_tienda || row.code || null,
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null,
      owner: row.owner || null,
      clientId: row.clientid || row.clientId || null,
      status: row.status || null,
      lat: row.lat !== null && row.lat !== undefined ? parseFloat(row.lat) : null,
      long: row.long !== null && row.long !== undefined ? parseFloat(row.long) : null,
      address: row.address || null,
      contactId: row.contactid || row.contactId || null,
      meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null
    };
  }
}

export default PuntoVentaModel;

