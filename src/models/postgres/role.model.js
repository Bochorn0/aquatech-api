// src/models/postgres/role.model.js
// PostgreSQL model for roles table (replaces MongoDB Role)

import { query } from '../../config/postgres.config.js';

class RoleModel {
  static async findById(id) {
    const result = await query(
      'SELECT * FROM roles WHERE id = $1 LIMIT 1',
      [id]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async findByName(name) {
    const result = await query(
      'SELECT * FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async findAll() {
    const result = await query('SELECT * FROM roles ORDER BY name');
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async create(data) {
    const { name, permissions = [], dashboardVersion = 'v1', protected: isProtected = false } = data;
    const result = await query(
      `INSERT INTO roles (name, protected, permissions, dashboard_version)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, isProtected, permissions, dashboardVersion]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async update(id, data) {
    const { name, permissions, dashboardVersion } = data;
    const result = await query(
      `UPDATE roles SET
        name = COALESCE($1, name),
        permissions = COALESCE($2, permissions),
        dashboard_version = COALESCE($3, dashboard_version),
        updatedat = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, permissions, dashboardVersion, id]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM roles WHERE id = $1 RETURNING id', [id]);
    return result.rows?.length > 0;
  }

  static parseRow(row) {
    if (!row) return null;
    const perms = row.permissions;
    const permissions = Array.isArray(perms) ? perms : (perms ? [perms] : []);
    return {
      id: row.id,
      _id: row.id,
      name: row.name,
      protected: row.protected ?? false,
      permissions,
      dashboardVersion: row.dashboard_version || 'v1'
    };
  }
}

export default RoleModel;
