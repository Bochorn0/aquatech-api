// src/models/postgres/city.model.js
// PostgreSQL model for cities table

import { query } from '../../config/postgres.config.js';

/**
 * City Model
 * Handles all database operations for the cities table
 */
class CityModel {
  /**
   * Find city by ID
   * @param {Number} id - City ID
   * @returns {Promise<Object|null>} City record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM cities WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find city by state and city name
   * @param {String} state - State name
   * @param {String} city - City name
   * @returns {Promise<Object|null>} City record or null
   */
  static async findByStateAndCity(state, city) {
    const result = await query(
      'SELECT * FROM cities WHERE LOWER(state) = LOWER($1) AND LOWER(city) = LOWER($2) LIMIT 1',
      [state, city]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all cities with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of city records
   */
  static async findAll() {
    const result = await query('SELECT * FROM cities ORDER BY state, city');
    return (result.rows || []).map(row => this.parseRow(row));
  }

  static async findByName(name) {
    const result = await query(
      'SELECT * FROM cities WHERE LOWER(city) = LOWER($1) OR LOWER(state) = LOWER($1) LIMIT 1',
      [name]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.state) {
      whereClause += ` AND LOWER(state) LIKE LOWER($${paramIndex})`;
      values.push(`%${filters.state}%`);
      paramIndex++;
    }

    if (filters.city) {
      whereClause += ` AND LOWER(city) LIKE LOWER($${paramIndex})`;
      values.push(`%${filters.city}%`);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM cities
      WHERE ${whereClause}
      ORDER BY state, city
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[CityModel] Error finding cities:', error);
      throw error;
    }
  }

  /**
   * Create a new city
   * @param {Object} data - City data object
   * @returns {Promise<Object>} Created city record
   */
  static async create(data) {
    const {
      state,
      city: cityName,
      lat,
      lon
    } = data;

    // Check if city already exists
    const existing = await this.findByStateAndCity(state, cityName);
    if (existing) {
      throw new Error('City with this state and name already exists');
    }

    const insertQuery = `
      INSERT INTO cities (
        state, city, lat, lon
      ) VALUES (
        $1, $2, $3, $4
      ) RETURNING *
    `;

    const values = [
      state || null,
      cityName || null,
      lat !== undefined ? parseFloat(lat) : null,
      lon !== undefined ? parseFloat(lon) : null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error('City with this state and name already exists');
      }
      console.error('[CityModel] Error creating city:', error);
      throw error;
    }
  }

  /**
   * Update city
   * @param {Number} id - City ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated city record
   */
  static async update(id, data) {
    const {
      state,
      city: cityName,
      lat,
      lon
    } = data;

    const updateQuery = `
      UPDATE cities
      SET 
        state = COALESCE($1, state),
        city = COALESCE($2, city),
        lat = COALESCE($3, lat),
        lon = COALESCE($4, lon),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const values = [
      state || null,
      cityName || null,
      lat !== undefined ? parseFloat(lat) : null,
      lon !== undefined ? parseFloat(lon) : null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('[CityModel] Error updating city:', error);
      throw error;
    }
  }

  /**
   * Delete city
   * @param {Number} id - City ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM cities WHERE id = $1 RETURNING id';
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
      state: row.state || null,
      city: row.city || null,
      lat: row.lat !== null && row.lat !== undefined ? parseFloat(row.lat) : null,
      lon: row.lon !== null && row.lon !== undefined ? parseFloat(row.lon) : null,
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null
    };
  }
}

export default CityModel;
