// src/models/postgres/regionMetricAlert.model.js
// PostgreSQL model for region_metric_alerts table

import { query } from '../../config/postgres.config.js';

class RegionMetricAlertModel {
  static async findById(id) {
    const result = await query(
      'SELECT * FROM region_metric_alerts WHERE id = $1 LIMIT 1',
      [id]
    );
    if (result.rows?.length > 0) return this.parseRow(result.rows[0]);
    return null;
  }

  static async findByRegionMetricId(regionMetricId) {
    const result = await query(
      'SELECT * FROM region_metric_alerts WHERE region_metric_id = $1 ORDER BY usuario ASC',
      [regionMetricId]
    );
    return (result.rows || []).map(row => this.parseRow(row));
  }

  static async create(data) {
    const {
      regionMetricId,
      usuario,
      correo,
      celular,
      celularAlert = false,
      dashboardAlert = false,
      emailAlert = false,
      preventivo = false,
      correctivo = false,
      emailCooldownMinutes = 10,
      emailMaxPerDay = 5
    } = data;

    const result = await query(
      `INSERT INTO region_metric_alerts (
        region_metric_id, usuario, correo, celular,
        celular_alert, dashboard_alert, email_alert,
        preventivo, correctivo,
        email_cooldown_minutes, email_max_per_day
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        regionMetricId,
        usuario,
        correo,
        celular || null,
        celularAlert,
        dashboardAlert,
        emailAlert,
        preventivo,
        correctivo,
        emailCooldownMinutes,
        emailMaxPerDay
      ]
    );
    return this.parseRow(result.rows[0]);
  }

  static async update(id, data) {
    const updates = [];
    const values = [];
    let paramIndex = 1;
    const map = {
      usuario: 'usuario',
      correo: 'correo',
      celular: 'celular',
      celularAlert: 'celular_alert',
      dashboardAlert: 'dashboard_alert',
      emailAlert: 'email_alert',
      preventivo: 'preventivo',
      correctivo: 'correctivo',
      emailCooldownMinutes: 'email_cooldown_minutes',
      emailMaxPerDay: 'email_max_per_day'
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] === undefined) continue;
      updates.push(`${col} = $${paramIndex}`);
      values.push(data[key]);
      paramIndex++;
    }
    if (updates.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE region_metric_alerts SET ${updates.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows?.length > 0 ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM region_metric_alerts WHERE id = $1 RETURNING id', [id]);
    return (result.rowCount || 0) > 0;
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : null,
      _id: row.id ? String(row.id) : null,
      regionMetricId: row.region_metric_id != null ? String(row.region_metric_id) : null,
      region_metric_id: row.region_metric_id != null ? String(row.region_metric_id) : null,
      usuario: row.usuario || null,
      correo: row.correo || null,
      celular: row.celular || null,
      celularAlert: row.celular_alert ?? false,
      celular_alert: row.celular_alert ?? false,
      dashboardAlert: row.dashboard_alert ?? false,
      dashboard_alert: row.dashboard_alert ?? false,
      emailAlert: row.email_alert ?? false,
      email_alert: row.email_alert ?? false,
      preventivo: row.preventivo ?? false,
      correctivo: row.correctivo ?? false,
      emailCooldownMinutes: row.email_cooldown_minutes ?? 10,
      emailMaxPerDay: row.email_max_per_day ?? 5,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null
    };
  }
}

export default RegionMetricAlertModel;
