// src/services/metricNotification.service.js
// Service to evaluate sensor data against metric alerts and create notifications

import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import MetricModel from '../models/postgres/metric.model.js';
import MetricAlertModel from '../models/postgres/metricAlert.model.js';
import MetricEmailLogModel from '../models/postgres/metricEmailLog.model.js';
import emailHelper from '../utils/email.helper.js';

/**
 * Metric Notification Service
 * Evaluates sensor readings against metric alert rules and creates notifications
 */
class MetricNotificationService {
  // Cache to track recent notifications and prevent duplicates
  // Key format: "userId_metricId_alertLevel"
  static recentNotifications = new Map();
  static DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  /**
   * Evaluate a sensor reading against metric alerts
   * @param {Object} sensorData - Sensor reading data
   * @param {String} sensorData.type - Sensor type (tds, flujo_produccion, etc.)
   * @param {Number} sensorData.value - Sensor value
   * @param {String} sensorData.codigoTienda - Punto de venta code
   * @param {String} sensorData.clientId - Client ID
   * @param {Date} sensorData.timestamp - Reading timestamp
   * @returns {Promise<Array>} Array of created notifications
   */
  static async evaluateAndNotify(sensorData) {
    try {
      const { type, value, codigoTienda, clientId, timestamp } = sensorData;

      console.log(`[MetricNotification] ─── STEP 1: Sensor received ─── type=${type}, value=${value}, client=${clientId}, codigoTienda=${codigoTienda}`);

      if (!type || value === null || value === undefined) {
        console.log(`[MetricNotification] ⏭️  STOP: missing type or value`);
        return [];
      }

      // Get all metrics for this sensor type and client
      const metrics = await MetricModel.find({
        clientId,
        sensor_type: type,
        enabled: true
      });

      console.log(`[MetricNotification] ─── STEP 2: Metrics lookup ─── Found ${metrics?.length || 0} metrics for sensor_type=${type}, client=${clientId}`);
      if (metrics?.length) {
        metrics.forEach((m, i) => console.log(`[MetricNotification]   [${i + 1}] metric_id=${m.id}, name=${m.metric_name || m.metricName || m.metric_type}`));
      }

      if (!metrics || metrics.length === 0) {
        console.log(`[MetricNotification] ⏭️  STOP: no metrics match (add metric with sensor_type="${type}" for client ${clientId})`);
        return [];
      }

      const createdNotifications = [];

      for (const metric of metrics) {
        try {
          console.log(`[MetricNotification] ─── STEP 3: Alerts lookup ─── metric_id=${metric.id}, name=${metric.metric_name || metric.metricName || metric.metric_type}`);

          const alerts = await MetricAlertModel.findByMetricId(metric.id);

          console.log(`[MetricNotification]   Found ${alerts?.length || 0} alerts for metric ${metric.id}`);

          if (!alerts || alerts.length === 0) {
            console.log(`[MetricNotification] ⏭️  SKIP metric ${metric.id}: no alerts (insert into metric_alerts for metric_id=${metric.id})`);
            continue;
          }

          console.log(`[MetricNotification] ─── STEP 4: Rules evaluation ─── value=${value}`);
          const triggeredAlerts = this.evaluateAlertRules(value, alerts, metric);
          console.log(`[MetricNotification]   ${triggeredAlerts.length} alerts triggered`);

          for (const alert of triggeredAlerts) {
            const notifications = await this.createNotificationsForAlert(alert, metric, sensorData);
            createdNotifications.push(...notifications);
          }
        } catch (error) {
          console.error(`[MetricNotification] ❌ Error evaluating metric ${metric.id}:`, error);
        }
      }

      console.log(`[MetricNotification] ─── DONE ─── Total notifications created: ${createdNotifications.length}`);
      return createdNotifications;
    } catch (error) {
      console.error('[MetricNotification] Error in evaluateAndNotify:', error);
      return [];
    }
  }

  /**
   * Evaluate sensor value against alert rules
   * Since metric_alerts table stores notification preferences (not thresholds),
   * we need to check if the alert should trigger based on preventivo/correctivo flags
   * and the metric's own threshold configuration
   * @param {Number} value - Sensor value
   * @param {Array} alerts - Array of metric alerts (notification preferences)
   * @param {Object} metric - Metric configuration with rules
   * @returns {Array} Array of alerts that should trigger notifications
   */
  static evaluateAlertRules(value, alerts, metric) {
    const triggered = [];
    for (const alert of alerts) {
      if (alert.dashboardAlert || alert.dashboard_alert || alert.emailAlert || alert.email_alert) {
        triggered.push(alert);
      }
    }
    return triggered;
  }

  /**
   * Create notifications for a triggered alert
   * @param {Object} alert - Triggered alert
   * @param {Object} metric - Metric configuration
   * @param {Object} sensorData - Sensor reading data
   * @returns {Promise<Array>} Array of created notifications
   */
  static async createNotificationsForAlert(alert, metric, sensorData) {
    const notifications = [];

    try {
      if (alert.dashboardAlert || alert.dashboard_alert) {
        const dashboardNotifications = await this.createDashboardNotifications(
          alert,
          metric,
          sensorData
        );
        notifications.push(...dashboardNotifications);
      }

      if (alert.emailAlert || alert.email_alert) {
        console.log(`[MetricNotification] ─── STEP 7: Email notification ─── alert_id=${alert.id}, correo=${alert.correo}`);
        await this.sendEmailNotification(alert, metric, sensorData);
      }

      return notifications;
    } catch (error) {
      console.error('[MetricNotification] Error creating notifications for alert:', error);
      return [];
    }
  }

  /**
   * Create dashboard notifications
   * @param {Object} alert - Alert configuration
   * @param {Object} metric - Metric configuration
   * @param {Object} sensorData - Sensor reading data
   * @returns {Promise<Array>} Array of created notifications
   */
  static async createDashboardNotifications(alert, metric, sensorData) {
    const notifications = [];

    try {
      const { level, notificationType } = this.determineAlertLevel(alert, sensorData.value);
      const message = alert.message || this.generateDefaultMessage(metric, sensorData, level);
      const clientId = sensorData.clientId || metric.clientId || metric.cliente;

      console.log(`[MetricNotification] ─── STEP 5: User lookup ─── alert.correo=${alert.correo}, alert.usuario=${alert.usuario}`);

      const usersToNotify = await this.getUsersToNotify(alert, clientId);

      console.log(`[MetricNotification]   Found ${usersToNotify.length} users to notify`);

      // Generate notification URL
      const notificationUrl = this.generateNotificationUrl(metric);

      // Create notification for each user
      for (const user of usersToNotify) {
        try {
          // Check if we recently created a notification for this user/metric/level
          const dedupKey = `${user._id}_${metric.id}_${level}`;
          const now = Date.now();
          const lastNotification = this.recentNotifications.get(dedupKey);
          
          if (lastNotification && (now - lastNotification) < this.DEDUP_WINDOW_MS) {
            const minutesAgo = Math.round((now - lastNotification) / 1000 / 60);
            console.log(`[MetricNotification]   ⏭️  Dedup: skip user ${user.email} (sent ${minutesAgo} min ago)`);
            continue;
          }

          console.log(`[MetricNotification] ─── STEP 6: Create notification ─── user=${user.email}, url=${notificationUrl || 'none'}`);

          const notification = new Notification({
            user: user._id,
            title: `Alerta: ${metric.metricName || metric.metric_name || metric.metric_type}`,
            description: message,
            avatarUrl: null,
            type: notificationType, // 'alert' or 'warning'
            postedAt: new Date(),
            isUnRead: true,
            url: notificationUrl
          });

          await notification.save();
          notifications.push(notification);

          // Track this notification to prevent duplicates
          this.recentNotifications.set(dedupKey, now);
          
          // Clean up old entries periodically (keep map size manageable)
          if (this.recentNotifications.size > 1000) {
            this.cleanupOldNotifications();
          }

          console.log(`[MetricNotification]   ✅ Created for ${user.email}`);
        } catch (error) {
          console.error(`[MetricNotification] Error creating notification for user ${user._id}:`, error);
        }
      }

      return notifications;
    } catch (error) {
      console.error('[MetricNotification] Error creating dashboard notifications:', error);
      return [];
    }
  }

  /**
   * Evaluate sensor value against metric rules to determine level (preventivo/critico)
   * @param {Number} value - Sensor value
   * @param {Object} metric - Metric with rules array
   * @returns {string} 'preventivo' | 'critico' | null (null = normal, no alert)
   */
  static evaluateLevelFromMetricRules(value, metric) {
    const rules = metric.rules || [];
    if (!Array.isArray(rules) || rules.length === 0) return 'preventivo'; // default

    const numValue = Number(value);
    if (isNaN(numValue)) return 'preventivo';

    for (const rule of rules) {
      const min = rule.min != null ? Number(rule.min) : null;
      const max = rule.max != null ? Number(rule.max) : null;
      const inRange = (min === null || numValue >= min) && (max === null || numValue <= max);
      if (!inRange) continue;

      const label = (rule.label || '').toLowerCase();
      if (label.includes('critico') || label.includes('crítico') || label.includes('critical') || label.includes('danger') || label.includes('peligro')) {
        return 'critico';
      }
      if (label.includes('preventivo') || label.includes('warning') || label.includes('advertencia') || label.includes('precaucion')) {
        return 'preventivo';
      }
      if (label.includes('normal') || label.includes('ok')) {
        return null; // Normal - no alert
      }
      return 'preventivo'; // Unknown label, treat as warning
    }
    return 'preventivo'; // No matching rule, default to warning
  }

  /**
   * Determine alert level based on alert rule and value
   * @param {Object} alert - Alert configuration
   * @param {Number} value - Sensor value
   * @returns {Object} Level and notification type
   */
  static determineAlertLevel(alert, value) {
    // Try to infer level from alert label or color
    const label = (alert.label || '').toLowerCase();
    const color = (alert.color || '').toLowerCase();

    let level = 'preventivo'; // default
    let notificationType = 'warning'; // default

    // Check for critical/danger keywords
    if (
      label.includes('critico') || 
      label.includes('crítico') || 
      label.includes('danger') || 
      label.includes('peligro') ||
      color.includes('red') ||
      color.includes('#f') || // Common red hex patterns
      color.includes('ff0000')
    ) {
      level = 'critico';
      notificationType = 'alert';
    }
    // Check for preventivo/warning keywords
    else if (
      label.includes('preventivo') || 
      label.includes('warning') || 
      label.includes('advertencia') ||
      label.includes('precaucion') ||
      color.includes('yellow') ||
      color.includes('orange') ||
      color.includes('ffa')
    ) {
      level = 'preventivo';
      notificationType = 'warning';
    }

    return { level, notificationType };
  }

  /**
   * Generate default alert message
   * @param {Object} metric - Metric configuration
   * @param {Object} sensorData - Sensor reading data
   * @param {String} level - Alert level
   * @returns {String} Alert message
   */
  static generateDefaultMessage(metric, sensorData, level) {
    const metricName = metric.metricName || metric.metric_name || metric.metric_type || 'Sensor';
    const location = sensorData.codigoTienda ? ` en ${sensorData.codigoTienda}` : '';
    const value = sensorData.value !== null ? ` Valor: ${sensorData.value.toFixed(2)}` : '';
    const unit = metric.sensorUnit || metric.sensor_unit || metric.unit || '';
    
    const levelText = level === 'critico' ? 'CRÍTICO' : 'PREVENTIVO';
    
    return `⚠️ Alerta ${levelText}: ${metricName}${location}.${value}${unit ? ' ' + unit : ''}`;
  }

  /**
   * Generate notification URL for punto venta detail page
   * @param {Object} metric - Metric configuration
   * @returns {String} URL to punto venta detail page
   */
  static generateNotificationUrl(metric) {
    const puntoVentaId = metric.puntoVentaId || metric.punto_venta_id;
    if (puntoVentaId) {
      const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'https://www.lcc.com.mx';
      const cleanBase = baseUrl.replace(/\/$/, '');
      return `${cleanBase}/PuntoVenta/${puntoVentaId}`;
    }
    return null;
  }

  /**
   * Send email notification with throttling (cooldown + daily limit)
   */
  static async sendEmailNotification(alert, metric, sensorData) {
    try {
      const level = this.evaluateLevelFromMetricRules(sensorData.value, metric);
      if (!level) return;

      const wantsPreventivo = !!alert.preventivo;
      const wantsCorrectivo = !!alert.correctivo;
      if ((level === 'preventivo' && !wantsPreventivo) || (level === 'critico' && !wantsCorrectivo)) {
        return;
      }

      const cooldown = alert.emailCooldownMinutes ?? 10;
      const maxPerDay = alert.emailMaxPerDay ?? 5;
      const metricAlertId = parseInt(alert.id || alert._id, 10);

      const canSend = await MetricEmailLogModel.canSendEmail(metricAlertId, level, cooldown, maxPerDay);
      if (!canSend.allowed) {
        console.log(`[MetricNotification] 📧 Email skipped: ${canSend.reason}`);
        return;
      }

      const metricName = metric.metric_name || metric.metricName || metric.metric_type || 'Sensor';
      const message = alert.message || this.generateDefaultMessage(metric, sensorData, level);
      const alertType = level === 'critico' ? 'correctivo' : 'preventivo';

      const result = await emailHelper.sendAlertEmail({
        to: alert.correo,
        alertType,
        metricName,
        message,
        sensorData: {
          Valor: sensorData.value,
          'Punto de venta': sensorData.codigoTienda || '-',
          Sensor: sensorData.type || '-'
        }
      });

      if (result.success) {
        await MetricEmailLogModel.create({
          metricAlertId,
          metricId: metric.id,
          correo: alert.correo,
          alertLevel: level,
          metricName,
          codigoTienda: sensorData.codigoTienda,
          sensorValue: sensorData.value
        });
        console.log(`[MetricNotification] 📧 Email sent to ${alert.correo} (${level})`);
      } else {
        console.error('[MetricNotification] 📧 Email failed:', result.error);
      }
    } catch (error) {
      console.error('[MetricNotification] Error sending email:', error);
    }
  }

  /**
   * Get users to notify based on alert configuration
   * Simply find user by the email specified in the alert
   * @param {Object} alert - Alert configuration
   * @param {String} clientId - Client ID (not used, kept for compatibility)
   * @returns {Promise<Array>} Array of users to notify
   */
  static async getUsersToNotify(alert, clientId) {
    try {
      if (alert.correo) {
        const userByEmail = await User.findOne({ email: alert.correo });
        if (userByEmail) {
          return [userByEmail];
        }
        console.log(`[MetricNotification]   ⚠️  User not found: ${alert.correo} (create user or fix metric_alerts.correo)`);
      } else {
        console.log(`[MetricNotification]   ⚠️  Alert has no correo configured`);
      }
      return [];
    } catch (error) {
      console.error('[MetricNotification] Error getting users to notify:', error);
      return [];
    }
  }

  /**
   * Batch evaluate multiple sensor readings
   * @param {Array} sensorReadings - Array of sensor readings
   * @returns {Promise<Array>} Array of all created notifications
   */
  static async batchEvaluateAndNotify(sensorReadings) {
    const allNotifications = [];

    for (const reading of sensorReadings) {
      try {
        const notifications = await this.evaluateAndNotify(reading);
        allNotifications.push(...notifications);
      } catch (error) {
        console.error('[MetricNotification] Error evaluating reading:', error);
      }
    }

    return allNotifications;
  }

  /**
   * Clean up old notification tracking entries
   * Removes entries older than the deduplication window
   */
  static cleanupOldNotifications() {
    const now = Date.now();
    const cutoff = now - this.DEDUP_WINDOW_MS;
    let removed = 0;

    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (timestamp < cutoff) {
        this.recentNotifications.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[MetricNotification] 🧹 Cleaned up ${removed} old notification tracking entries`);
    }
  }
}

export default MetricNotificationService;
