// src/models/postgres/ciudad.model.js
// PostgreSQL model for ciudades table (MQTT topic: CIUDAD, linked to region)

import { query } from '../../config/postgres.config.js';

class CiudadModel {
  static async findById(id) {
    const result = await query('SELECT * FROM ciudades WHERE id = $1 LIMIT 1', [id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByNameAndRegion(name, regionId) {
    if (!name || !regionId) return null;
    const result = await query(
      'SELECT * FROM ciudades WHERE LOWER(name) = LOWER($1) AND region_id = $2 LIMIT 1',
      [String(name).trim(), regionId]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async getOrCreate(data) {
    const { name, region_id, regionId } = data;
    const regionIdNum = region_id || regionId;
    if (!name || !regionIdNum) return null;

    const existing = await this.findByNameAndRegion(name, regionIdNum);
    if (existing) return existing;

    const result = await query(
      `INSERT INTO ciudades (name, region_id) VALUES ($1, $2)
       ON CONFLICT (name, region_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [String(name).trim(), regionIdNum]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByRegion(regionId) {
    const result = await query(
      'SELECT * FROM ciudades WHERE region_id = $1 ORDER BY name',
      [regionId]
    );
    return (result.rows || []).map(row => this.parseRow(row));
  }

  static async findAll() {
    const result = await query('SELECT * FROM ciudades ORDER BY region_id, name');
    return (result.rows || []).map(row => this.parseRow(row));
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : null,
      name: row.name || null,
      regionId: row.region_id ? String(row.region_id) : null,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null,
    };
  }
}

export default CiudadModel;
