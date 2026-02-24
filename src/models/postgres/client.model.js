// src/models/postgres/client.model.js
// PostgreSQL model for clients table

import { query } from '../../config/postgres.config.js';

/**
 * Client Model
 * Handles all database operations for the clients table
 */
class ClientModel {
  /**
   * Find client by ID
   * @param {Number} id - Client ID
   * @returns {Promise<Object|null>} Client record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM clients WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find client by email
   * @param {String} email - Client email
   * @returns {Promise<Object|null>} Client record or null
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all clients with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of client records
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.name) {
      whereClause += ` AND LOWER(name) LIKE LOWER($${paramIndex})`;
      values.push(`%${filters.name}%`);
      paramIndex++;
    }

    if (filters.email) {
      whereClause += ` AND LOWER(email) = LOWER($${paramIndex})`;
      values.push(filters.email);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM clients
      WHERE ${whereClause}
      ORDER BY createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[ClientModel] Error finding clients:', error);
      throw error;
    }
  }

  /**
   * Create a new client
   * @param {Object} data - Client data object
   * @returns {Promise<Object>} Created client record
   */
  static async create(data) {
    const {
      name,
      email,
      phone,
      protected: isProtected,
      address
    } = data;

    // Check if email already exists
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new Error('Client with this email already exists');
    }

    const insertQuery = `
      INSERT INTO clients (
        name, email, phone, protected, address
      ) VALUES (
        $1, $2, $3, $4, $5
      ) RETURNING *
    `;

    const values = [
      name || null,
      email ? email.toLowerCase() : null,
      phone || null,
      isProtected !== undefined ? isProtected : false,
      address ? JSON.stringify(address) : null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error('Client with this email already exists');
      }
      console.error('[ClientModel] Error creating client:', error);
      throw error;
    }
  }

  /**
   * Update client
   * @param {Number} id - Client ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated client record
   */
  static async update(id, data) {
    const {
      name,
      email,
      phone,
      protected: isProtected,
      address
    } = data;

    const updateQuery = `
      UPDATE clients
      SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        protected = COALESCE($4, protected),
        address = COALESCE($5, address),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      name || null,
      email ? email.toLowerCase() : null,
      phone || null,
      isProtected !== undefined ? isProtected : null,
      address ? JSON.stringify(address) : null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error('Client with this email already exists');
      }
      console.error('[ClientModel] Error updating client:', error);
      throw error;
    }
  }

  /**
   * Delete client
   * @param {Number} id - Client ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async insertMany(items) {
    const created = [];
    for (const data of items) {
      try {
        const c = await this.create(data);
        if (c) created.push(c);
      } catch (e) {
        console.warn('[ClientModel] insertMany skip:', e.message);
      }
    }
    return created;
  }

  static async delete(id) {
    const deleteQuery = 'DELETE FROM clients WHERE id = $1 RETURNING id';
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

    // Parse address if it's a JSON string
    let addressObj = null;
    if (row.address) {
      try {
        addressObj = typeof row.address === 'string' ? JSON.parse(row.address) : row.address;
      } catch (e) {
        addressObj = row.address;
      }
    }

    return {
      id: row.id ? String(row.id) : null,
      _id: row.id ? String(row.id) : null, // For compatibility
      name: row.name || null,
      email: row.email || null,
      phone: row.phone || null,
      protected: row.protected !== null && row.protected !== undefined ? row.protected : false,
      address: addressObj || {
        street: null,
        city: null,
        state: null,
        zip: null,
        country: null,
        lat: null,
        lng: null
      },
      createdAt: row.createdat || row.createdAt || null,
      updatedAt: row.updatedat || row.updatedAt || null
    };
  }
}

export default ClientModel;
