// src/models/postgres/user.model.js
// PostgreSQL model for users table (replaces MongoDB User for auth)

import { query } from '../../config/postgres.config.js';

class UserModel {
  static async findById(id) {
    const result = await query(
      `SELECT u.*, r.name as role_name, r.permissions as role_permissions, r.dashboard_version as role_dashboard_version,
              c.name as client_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1 LIMIT 1`,
      [id]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async find(filters = {}) {
    const { status, role, cliente } = filters;
    let where = ['1=1'];
    const values = [];
    let i = 1;
    if (status) {
      const statuses = status.split ? status.split(',') : [status];
      where.push(`u.status = ANY($${i}::text[])`);
      values.push(statuses);
      i++;
    } else {
      where.push(`u.status IN ('active', 'pending')`);
    }
    if (role) {
      where.push(`u.role_id = $${i}`);
      values.push(role);
      i++;
    }
    if (cliente) {
      where.push(`u.client_id = $${i}`);
      values.push(cliente);
      i++;
    }
    const result = await query(
      `SELECT u.*, r.name as role_name, r.permissions as role_permissions, r.dashboard_version as role_dashboard_version,
              c.name as client_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE ${where.join(' AND ')}
       ORDER BY u.createdat DESC`,
      values
    );
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async delete(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rows?.length > 0;
  }

  static async findByEmail(email) {
    const result = await query(
      `SELECT u.*, r.name as role_name, r.permissions as role_permissions, r.dashboard_version as role_dashboard_version,
              c.name as client_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async create(data) {
    const {
      email,
      password,
      role_id,
      client_id,
      postgres_client_id,
      status = 'pending',
      verified = false,
      nombre = '',
      puesto = '',
      mqtt_zip_password = ''
    } = data;

    const result = await query(
      `INSERT INTO users (email, password, role_id, client_id, postgres_client_id, status, verified, nombre, puesto, mqtt_zip_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email, role_id, client_id, postgres_client_id, status, verified, nombre, puesto, createdat, updatedat`,
      [email, password, role_id, client_id, postgres_client_id, status, verified, nombre, puesto, mqtt_zip_password]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const colMap = { resetToken: 'reset_token', resetTokenExpiry: 'reset_token_expiry' };
    const allowed = ['password', 'role_id', 'client_id', 'postgres_client_id', 'status', 'verified', 'nombre', 'puesto', 'avatar', 'mqtt_zip_password', 'reset_token', 'reset_token_expiry', 'resetToken', 'resetTokenExpiry'];
    for (const [k, v] of Object.entries(data)) {
      if (!allowed.includes(k) || v === undefined) continue;
      const col = colMap[k] || k;
      fields.push(`${col} = $${i}`);
      values.push(v);
      i++;
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updatedat = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static parseRow(row) {
    if (!row) return null;
    const perms = row.role_permissions ?? row.permissions;
    const permissions = Array.isArray(perms) ? perms : (perms ? [perms] : []);
    return {
      id: row.id,
      _id: String(row.id),
      email: row.email,
      password: row.password,
      role: row.role_id,
      role_id: row.role_id,
      roleName: row.role_name,
      client_name: row.client_name,
      permissions,
      dashboardVersion: row.role_dashboard_version || 'v1',
      client_id: row.client_id,
      cliente: row.client_id,
      clienteName: row.client_name,
      postgresClientId: row.postgres_client_id != null ? String(row.postgres_client_id) : null,
      status: row.status,
      verified: row.verified ?? false,
      nombre: row.nombre || '',
      puesto: row.puesto || '',
      avatar: row.avatar || '/assets/icons/navbar/ic-user.svg',
      resetToken: row.reset_token,
      resetTokenExpiry: row.reset_token_expiry,
      mqtt_zip_password: row.mqtt_zip_password || ''
    };
  }
}

export default UserModel;
