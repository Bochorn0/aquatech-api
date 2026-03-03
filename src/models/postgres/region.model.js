// src/models/postgres/region.model.js
// PostgreSQL model for regions table (MQTT topic: CODIGO_REGION)

import { query } from '../../config/postgres.config.js';

class RegionModel {
  static async findById(id) {
    const result = await query('SELECT * FROM regions WHERE id = $1 LIMIT 1', [id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByCode(code) {
    if (!code) return null;
    const result = await query(
      'SELECT * FROM regions WHERE LOWER(code) = LOWER($1) LIMIT 1',
      [String(code).trim()]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async getOrCreate(data) {
    const code = (data.code || '').trim().toUpperCase() || 'NoRegion';
    const name = data.name || (code === 'NoRegion' ? 'Sin región' : code);

    const existing = await this.findByCode(code);
    if (existing) return existing;

    const result = await query(
      `INSERT INTO regions (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [code, name]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findAll() {
    const result = await query('SELECT * FROM regions ORDER BY code');
    return (result.rows || []).map(row => this.parseRow(row));
  }

  /**
   * Create a new region (manual create; for get-or-create use getOrCreate).
   * @param {Object} data - { code, name }
   * @returns {Promise<Object|null>} Created region or null if code already exists
   */
  static async create(data) {
    const code = (data.code || '').trim().toUpperCase();
    const name = (data.name || '').trim() || code;
    if (!code) return null;
    const existing = await this.findByCode(code);
    if (existing) return null;
    const result = await query(
      'INSERT INTO regions (code, name) VALUES ($1, $2) RETURNING *',
      [code, name]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  /**
   * Delete a region by id. Cascades to region_punto_venta and ciudades (FK ON DELETE CASCADE).
   */
  static async delete(id) {
    if (!id) return false;
    const result = await query('DELETE FROM regions WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }

  static async update(id, data) {
    const { code, name } = data;
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      values.push(String(code).trim().toUpperCase());
      paramIndex++;
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(String(name).trim());
      paramIndex++;
    }
    if (updates.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE regions SET ${updates.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : null,
      code: row.code || null,
      name: row.name || null,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null,
    };
  }
}

export default RegionModel;
