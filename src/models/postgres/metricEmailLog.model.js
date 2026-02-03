// src/models/postgres/metricEmailLog.model.js
// PostgreSQL model for metric_email_log table - tracks sent emails for throttling

import { query } from '../../config/postgres.config.js';

/**
 * MetricEmailLog Model
 * Handles email log records for metric alerts - used for throttling (cooldown, daily limit)
 */
class MetricEmailLogModel {
  /**
   * Log a sent email
   * @param {Object} data - Log data
   * @returns {Promise<Object>} Created log record
   */
  static async create(data) {
    const {
      metricAlertId,
      metricId,
      correo,
      alertLevel,
      metricName,
      codigoTienda,
      sensorValue
    } = data;

    const insertQuery = `
      INSERT INTO metric_email_log (
        metric_alert_id, metric_id, correo, alert_level,
        metric_name, codigo_tienda, sensor_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      metricAlertId,
      metricId,
      correo,
      alertLevel,
      metricName || null,
      codigoTienda || null,
      sensorValue != null ? sensorValue : null
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[MetricEmailLogModel] Error creating log:', error);
      throw error;
    }
  }

  /**
   * Check if we can send email based on throttling rules
   * @param {Number} metricAlertId - Alert ID
   * @param {String} alertLevel - 'preventivo' or 'critico'
   * @param {Number} cooldownMinutes - Min minutes since last email
   * @param {Number} maxPerDay - Max emails per day
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  static async canSendEmail(metricAlertId, alertLevel, cooldownMinutes = 10, maxPerDay = 5) {
    try {
      const now = new Date();
      const cooldownCutoff = new Date(now.getTime() - cooldownMinutes * 60 * 1000);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      // Check last email (cooldown)
      const lastEmailResult = await query(`
        SELECT sent_at FROM metric_email_log
        WHERE metric_alert_id = $1 AND alert_level = $2
        ORDER BY sent_at DESC
        LIMIT 1
      `, [metricAlertId, alertLevel]);

      if (lastEmailResult.rows.length > 0) {
        const lastSent = new Date(lastEmailResult.rows[0].sent_at);
        if (lastSent > cooldownCutoff) {
          const minutesAgo = Math.round((now - lastSent) / 60000);
          return {
            allowed: false,
            reason: `Cooldown: last email ${minutesAgo} min ago (min ${cooldownMinutes} min required)`
          };
        }
      }

      // Check daily limit
      const countResult = await query(`
        SELECT COUNT(*) as cnt FROM metric_email_log
        WHERE metric_alert_id = $1 AND alert_level = $2
        AND sent_at >= $3
      `, [metricAlertId, alertLevel, dayStart.toISOString()]);

      const countToday = parseInt(countResult.rows[0]?.cnt || 0, 10);
      if (countToday >= maxPerDay) {
        return {
          allowed: false,
          reason: `Daily limit: ${countToday}/${maxPerDay} emails already sent today`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[MetricEmailLogModel] Error checking canSendEmail:', error);
      return { allowed: false, reason: `Error: ${error.message}` };
    }
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : null,
      metricAlertId: row.metric_alert_id ? String(row.metric_alert_id) : null,
      metricId: row.metric_id ? String(row.metric_id) : null,
      correo: row.correo || null,
      alertLevel: row.alert_level || null,
      metricName: row.metric_name || null,
      codigoTienda: row.codigo_tienda || null,
      sensorValue: row.sensor_value != null ? Number(row.sensor_value) : null,
      sentAt: row.sent_at || null
    };
  }
}

export default MetricEmailLogModel;
