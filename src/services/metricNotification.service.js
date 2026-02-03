// src/services/metricNotification.service.js
// Service to evaluate sensor data against metric alerts and create notifications

import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import MetricModel from '../models/postgres/metric.model.js';
import MetricAlertModel from '../models/postgres/metricAlert.model.js';

/**
 * Metric Notification Service
 * Evaluates sensor readings against metric alert rules and creates notifications
 */
class MetricNotificationService {
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

      console.log(`[MetricNotification] Evaluating sensor: type=${type}, value=${value}, client=${clientId}, codigoTienda=${codigoTienda}`);

      if (!type || value === null || value === undefined) {
        console.log(`[MetricNotification] Skipping - missing type or value`);
        return [];
      }

      // Get all metrics for this sensor type and client
      const metrics = await MetricModel.find({
        clientId,
        metric_type: type,
        enabled: true
      });

      console.log(`[MetricNotification] Found ${metrics?.length || 0} metrics for type: ${type}, client: ${clientId}`);

      if (!metrics || metrics.length === 0) {
        return [];
      }

      const createdNotifications = [];

      // Evaluate each metric
      for (const metric of metrics) {
        try {
          console.log(`[MetricNotification] Checking metric ID: ${metric.id}, name: ${metric.metricName || metric.metric_type}`);
          
          // Get alerts for this metric
          const alerts = await MetricAlertModel.findByMetricId(metric.id);

          console.log(`[MetricNotification] Found ${alerts?.length || 0} alerts for metric ${metric.id}`);

          if (!alerts || alerts.length === 0) {
            continue;
          }

          // Evaluate value against alert rules
          const triggeredAlerts = this.evaluateAlertRules(value, alerts, metric);

          console.log(`[MetricNotification] ${triggeredAlerts.length} alerts triggered for value ${value}`);

          // Create notifications for triggered alerts
          for (const alert of triggeredAlerts) {
            const notifications = await this.createNotificationsForAlert(
              alert,
              metric,
              sensorData
            );
            createdNotifications.push(...notifications);
          }
        } catch (error) {
          console.error(`[MetricNotification] Error evaluating metric ${metric.id}:`, error);
        }
      }

      console.log(`[MetricNotification] Total notifications created: ${createdNotifications.length}`);
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

    console.log(`[MetricNotification] Evaluating ${alerts.length} alerts for value ${value}`);
    console.log(`[MetricNotification] Metric config:`, JSON.stringify(metric, null, 2));

    for (const alert of alerts) {
      console.log(`[MetricNotification] Checking alert:`, JSON.stringify(alert, null, 2));
      
      // For now, trigger all alerts that have dashboard_alert enabled
      // This is a simplified version - you'll need to add proper threshold logic
      // based on how your metrics store their rules
      if (alert.dashboardAlert || alert.dashboard_alert) {
        console.log(`[MetricNotification] ✅ Alert triggered (dashboard_alert enabled)`);
        triggered.push(alert);
      }
    }

    console.log(`[MetricNotification] ${triggered.length} alerts will trigger notifications`);
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
      // Only create dashboard notifications for now (email will be added later)
      if (alert.dashboardAlert) {
        const dashboardNotifications = await this.createDashboardNotifications(
          alert,
          metric,
          sensorData
        );
        notifications.push(...dashboardNotifications);
      }

      // Email notifications (to be implemented later)
      // if (alert.emailAlert) {
      //   await this.sendEmailNotification(alert, metric, sensorData);
      // }

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
      // Determine alert level and notification type
      const { level, notificationType } = this.determineAlertLevel(alert, sensorData.value);

      // Get alert message from metricAlert.message or generate default
      const message = alert.message || this.generateDefaultMessage(metric, sensorData, level);

      // Use metric's clientId if sensor data doesn't have one
      const clientId = sensorData.clientId || metric.clientId || metric.cliente;
      
      console.log(`[MetricNotification] Getting users to notify for clientId: ${clientId}, alert.usuario: ${alert.usuario}, alert.correo: ${alert.correo}`);

      // Get users to notify based on alert configuration
      const usersToNotify = await this.getUsersToNotify(alert, clientId);

      console.log(`[MetricNotification] Found ${usersToNotify.length} users to notify`);

      // Create notification for each user
      for (const user of usersToNotify) {
        try {
          const notification = new Notification({
            user: user._id,
            title: `Alerta: ${metric.metricName || metric.metric_type}`,
            description: message,
            avatarUrl: null,
            type: notificationType, // 'alert' or 'warning'
            postedAt: new Date(),
            isUnRead: true
          });

          await notification.save();
          notifications.push(notification);

          console.log(`[MetricNotification] ✅ Dashboard notification created for user ${user.email} (${user._id})`);
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
    const metricName = metric.metricName || metric.metric_type || 'Sensor';
    const location = sensorData.codigoTienda ? ` en ${sensorData.codigoTienda}` : '';
    const value = sensorData.value !== null ? ` Valor: ${sensorData.value.toFixed(2)}` : '';
    const unit = metric.unit || '';
    
    const levelText = level === 'critico' ? 'CRÍTICO' : 'PREVENTIVO';
    
    return `⚠️ Alerta ${levelText}: ${metricName}${location}.${value}${unit ? ' ' + unit : ''}`;
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
      console.log(`[MetricNotification] getUsersToNotify - alert.correo: ${alert.correo}`);

      // Find user by email from alert.correo
      // Don't require active/verified status - let inactive users still receive critical alerts
      if (alert.correo) {
        console.log(`[MetricNotification] Looking for user by email: ${alert.correo}`);
        const userByEmail = await User.findOne({ email: alert.correo });
        
        if (userByEmail) {
          console.log(`[MetricNotification] ✅ Found user: ${userByEmail.email} (status: ${userByEmail.status})`);
          return [userByEmail];
        }
        
        console.log(`[MetricNotification] ⚠️ User not found with email: ${alert.correo}`);
        console.log(`[MetricNotification] ⚠️ Please create a user with this email or update the metric alert email`);
      } else {
        console.log(`[MetricNotification] ⚠️ Alert has no email (correo) configured`);
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
}

export default MetricNotificationService;
