// src/models/postgres/metricAlert.model.js
// PostgreSQL model for metric_alerts table

import { query } from '../../config/postgres.config.js';

/**
 * MetricAlert Model
 * Handles all database operations for the metric_alerts table
 */
class MetricAlertModel {
  /**
   * Find alert by ID
   * @param {Number} id - Alert ID
   * @returns {Promise<Object|null>} Alert record or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM metric_alerts WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      return this.parseRow(result.rows[0]);
    }

    return null;
  }

  /**
   * Find all alerts for a specific metric
   * @param {Number} metricId - Metric ID
   * @returns {Promise<Array>} Array of alert records
   */
  static async findByMetricId(metricId) {
    const result = await query(
      'SELECT * FROM metric_alerts WHERE metric_id = $1 ORDER BY usuario ASC',
      [metricId]
    );

    return result.rows.map(row => this.parseRow(row));
  }

  /**
   * Find all alerts with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of alert records
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.metricId) {
      whereClause += ` AND metric_id = $${paramIndex}`;
      values.push(filters.metricId);
      paramIndex++;
    }

    if (filters.correo) {
      whereClause += ` AND correo = $${paramIndex}`;
      values.push(filters.correo);
      paramIndex++;
    }

    if (filters.celularAlert !== undefined) {
      whereClause += ` AND celular_alert = $${paramIndex}`;
      values.push(filters.celularAlert);
      paramIndex++;
    }

    if (filters.emailAlert !== undefined) {
      whereClause += ` AND email_alert = $${paramIndex}`;
      values.push(filters.emailAlert);
      paramIndex++;
    }

    if (filters.preventivo !== undefined) {
      whereClause += ` AND preventivo = $${paramIndex}`;
      values.push(filters.preventivo);
      paramIndex++;
    }

    if (filters.correctivo !== undefined) {
      whereClause += ` AND correctivo = $${paramIndex}`;
      values.push(filters.correctivo);
      paramIndex++;
    }

    const selectQuery = `
      SELECT * FROM metric_alerts
      WHERE ${whereClause}
      ORDER BY createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[MetricAlertModel] Error finding alerts:', error);
      throw error;
    }
  }

  /**
   * Create a new alert
   * @param {Object} data - Alert data object
   * @returns {Promise<Object>} Created alert record
   */
  static async create(data) {
    const {
      metricId,
      usuario,
      correo,
      celular,
      celularAlert = false,
      dashboardAlert = false,
      emailAlert = false,
      preventivo = false,
      correctivo = false
    } = data;

    const insertQuery = `
      INSERT INTO metric_alerts (
        metric_id, usuario, correo, celular,
        celular_alert, dashboard_alert, email_alert,
        preventivo, correctivo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `;

    const values = [
      metricId,
      usuario,
      correo,
      celular || null,
      celularAlert,
      dashboardAlert,
      emailAlert,
      preventivo,
      correctivo
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[MetricAlertModel] Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Update alert
   * @param {Number} id - Alert ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated alert record
   */
  static async update(id, data) {
    const {
      usuario,
      correo,
      celular,
      celularAlert,
      dashboardAlert,
      emailAlert,
      preventivo,
      correctivo
    } = data;

    const updateQuery = `
      UPDATE metric_alerts
      SET 
        usuario = COALESCE($1, usuario),
        correo = COALESCE($2, correo),
        celular = COALESCE($3, celular),
        celular_alert = COALESCE($4, celular_alert),
        dashboard_alert = COALESCE($5, dashboard_alert),
        email_alert = COALESCE($6, email_alert),
        preventivo = COALESCE($7, preventivo),
        correctivo = COALESCE($8, correctivo),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const values = [
      usuario !== undefined ? usuario : null,
      correo !== undefined ? correo : null,
      celular !== undefined ? celular : null,
      celularAlert !== undefined ? celularAlert : null,
      dashboardAlert !== undefined ? dashboardAlert : null,
      emailAlert !== undefined ? emailAlert : null,
      preventivo !== undefined ? preventivo : null,
      correctivo !== undefined ? correctivo : null,
      id
    ];

    try {
      const result = await query(updateQuery, values);
      if (result.rows && result.rows.length > 0) {
        return this.parseRow(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('[MetricAlertModel] Error updating alert:', error);
      throw error;
    }
  }

  /**
   * Delete alert
   * @param {Number} id - Alert ID
   * @returns {Promise<Boolean>} True if deleted
   */
  static async delete(id) {
    const deleteQuery = 'DELETE FROM metric_alerts WHERE id = $1 RETURNING id';
    try {
      const result = await query(deleteQuery, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[MetricAlertModel] Error deleting alert:', error);
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
      _id: row.id ? String(row.id) : null, // For compatibility
      metricId: row.metric_id ? String(row.metric_id) : null,
      metric_id: row.metric_id ? String(row.metric_id) : null,
      usuario: row.usuario || null,
      correo: row.correo || null,
      celular: row.celular || null,
      celularAlert: row.celular_alert || false,
      celular_alert: row.celular_alert || false,
      dashboardAlert: row.dashboard_alert || false,
      dashboard_alert: row.dashboard_alert || false,
      emailAlert: row.email_alert || false,
      email_alert: row.email_alert || false,
      preventivo: row.preventivo || false,
      correctivo: row.correctivo || false,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null
    };
  }
}

export default MetricAlertModel;
