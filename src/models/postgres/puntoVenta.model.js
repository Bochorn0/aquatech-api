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

    // First, try to find existing record
    const searchCode = code || codigo_tienda;
    if (searchCode) {
      const existing = await this.findByCode(searchCode);
      if (existing) {
        console.log(`[PuntoVentaModel] ✅ PuntoVenta encontrado (ID: ${existing.id}) para código: ${searchCode}`);
        return existing;
      }
    }

    // Try to use database function if it exists, otherwise fall back to manual create
    try {
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
        const puntoVenta = this.parseRow(result.rows[0]);
        console.log(`[PuntoVentaModel] ✅ PuntoVenta obtenido/creado por función SQL (ID: ${puntoVenta.id}) para código: ${searchCode}`);
        return puntoVenta;
      }
    } catch (error) {
      // If function doesn't exist, fall back to manual create
      if (error.code === '42883' || error.message.includes('does not exist')) {
        console.warn('[PuntoVentaModel] Function get_or_create_punto_venta not found, using manual get/create');
      } else if (error.code === '23505') {
        // Unique constraint violation - record was created by another process
        // Just fetch the existing record
        console.log(`[PuntoVentaModel] ⚠️  Clave duplicada detectada (concurrencia), obteniendo registro existente para código: ${searchCode}`);
        if (searchCode) {
          const existing = await this.findByCode(searchCode);
          if (existing) {
            console.log(`[PuntoVentaModel] ✅ PuntoVenta encontrado después de error de concurrencia (ID: ${existing.id})`);
            return existing;
          }
        }
      } else {
        // For other errors, try manual create as fallback
        console.warn('[PuntoVentaModel] Error calling get_or_create_punto_venta, using manual create:', error.message);
      }
    }

    // Fallback: manual create (which also checks for existing)
    return await this.create(data);
  }

  /**
   * Find puntoVenta by code or codigo_tienda
   * @param {String} code - Code or codigo_tienda to search for
   * @returns {Promise<Object|null>} PuntoVenta record or null
   */
  static async findByCode(code) {
    if (!code) return null;

    const result = await query(
      `SELECT * FROM puntoventa pv
       WHERE pv.code = $1 OR pv.codigo_tienda = $1 
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
      'SELECT * FROM puntoventa WHERE id = $1 LIMIT 1',
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

    // Check if already exists (double-check before insert)
    const searchCode = code || codigo_tienda;
    const existing = await this.findByCode(searchCode);
    if (existing) {
      console.log(`[PuntoVentaModel] ✅ PuntoVenta ya existe (ID: ${existing.id}), retornando existente para código: ${searchCode}`);
      return existing;
    }

    const insertQuery = `
      INSERT INTO puntoventa (
        name, code, codigo_tienda, owner, clientid, status,
        lat, long, address, contactid, meta
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
      const created = this.parseRow(result.rows[0]);
      console.log(`[PuntoVentaModel] ✅ PuntoVenta creado exitosamente (ID: ${created.id}) para código: ${searchCode}`);
      return created;
    } catch (error) {
      // If duplicate key error, try to get existing record
      if (error.code === '23505') { // unique_violation
        console.log(`[PuntoVentaModel] ⚠️  Error de clave duplicada al crear, obteniendo registro existente para código: ${searchCode}`);
        const existing = await this.findByCode(searchCode);
        if (existing) {
          console.log(`[PuntoVentaModel] ✅ PuntoVenta encontrado después de error de clave duplicada (ID: ${existing.id})`);
          return existing;
        }
      }
      console.error('[PuntoVentaModel] ❌ Error creating puntoVenta:', error);
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
      UPDATE puntoventa
      SET 
        name = COALESCE($1, name),
        owner = COALESCE($2, owner),
        clientid = COALESCE($3, clientid),
        status = COALESCE($4, status),
        lat = COALESCE($5, lat),
        long = COALESCE($6, long),
        address = COALESCE($7, address),
        contactid = COALESCE($8, contactid),
        meta = COALESCE($9, meta),
        updatedat = CURRENT_TIMESTAMP
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
   * Find all puntoVentas that have dev mode enabled (meta.dev_mode === true)
   * Used by the dev mode random data generator cron
   * @returns {Promise<Array>} Array of puntoVenta records
   */
  static async findAllWithDevModeEnabled() {
    // Match meta.dev_mode as boolean true or string 'true'
    const result = await query(
      `SELECT * FROM puntoventa
       WHERE meta IS NOT NULL
         AND (
           (meta::jsonb) @> '{"dev_mode": true}'
           OR (meta::jsonb)->>'dev_mode' = 'true'
         )
       ORDER BY id ASC`
    );
    return result.rows.map(row => this.parseRow(row));
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
      whereClause += ` AND clientid = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

      const selectQuery = `
      SELECT * FROM puntoventa
      WHERE ${whereClause}
      ORDER BY createdat DESC
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
   * Delete puntoVenta
   * @param {Number} id - PuntoVenta ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM puntoventa WHERE id = $1 RETURNING id';
    try {
      const result = await query(deleteQuery, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[PuntoVentaModel] Error deleting puntoVenta:', error);
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

