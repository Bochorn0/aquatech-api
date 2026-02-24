// PostgreSQL model for reports table (replaces MongoDB Report)

import { query } from '../../config/postgres.config.js';

class ReportModel {
  static async find(filters = {}) {
    const result = await query('SELECT * FROM reports ORDER BY createdat DESC');
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async create(data) {
    const result = await query(`
      INSERT INTO reports (active_time, user_description) VALUES ($1, $2) RETURNING *
    `, [data.active_time ?? null, data.user_description ?? null]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      _id: String(row.id),
      active_time: row.active_time,
      user_description: row.user_description
    };
  }
}

export default ReportModel;
