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

      if (!type || value === null || value === undefined) {
        return [];
      }

      // Get all metrics for this sensor type and client
      const metrics = await MetricModel.find({
        clientId,
        metric_type: type,
        enabled: true
      });

      if (!metrics || metrics.length === 0) {
        console.log(`[MetricNotification] No metrics found for type: ${type}, client: ${clientId}`);
        return [];
      }

      const createdNotifications = [];

      // Evaluate each metric
      for (const metric of metrics) {
        try {
          // Get alerts for this metric
          const alerts = await MetricAlertModel.findByMetricId(metric.id);

          if (!alerts || alerts.length === 0) {
            continue;
          }

          // Evaluate value against alert rules
          const triggeredAlerts = this.evaluateAlertRules(value, alerts);

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

      return createdNotifications;
    } catch (error) {
      console.error('[MetricNotification] Error in evaluateAndNotify:', error);
      throw error;
    }
  }

  /**
   * Evaluate sensor value against alert rules
   * @param {Number} value - Sensor value
   * @param {Array} alerts - Array of metric alerts
   * @returns {Array} Array of triggered alerts
   */
  static evaluateAlertRules(value, alerts) {
    const triggered = [];

    for (const alert of alerts) {
      let shouldTrigger = false;

      // Check min threshold
      if (alert.min !== null && alert.min !== undefined && value < alert.min) {
        shouldTrigger = true;
      }

      // Check max threshold
      if (alert.max !== null && alert.max !== undefined && value > alert.max) {
        shouldTrigger = true;
      }

      // If both min and max are set, value should be outside the range
      if (alert.min !== null && alert.max !== null) {
        shouldTrigger = (value < alert.min || value > alert.max);
      }

      if (shouldTrigger) {
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

      // Get users to notify based on alert configuration
      const usersToNotify = await this.getUsersToNotify(alert, sensorData.clientId);

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

          console.log(`[MetricNotification] ✅ Dashboard notification created for user ${user.email}`);
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
   * @param {Object} alert - Alert configuration
   * @param {String} clientId - Client ID
   * @returns {Promise<Array>} Array of users to notify
   */
  static async getUsersToNotify(alert, clientId) {
    try {
      const query = {
        status: 'active',
        verified: true
      };

      // If alert has specific user/usuario configured
      if (alert.usuario) {
        // Try to find user by email (usuario field might contain email)
        const userByEmail = await User.findOne({ email: alert.usuario, ...query });
        if (userByEmail) {
          return [userByEmail];
        }

        // Try to find by MongoDB ID
        const userById = await User.findOne({ _id: alert.usuario, ...query });
        if (userById) {
          return [userById];
        }
      }

      // Fallback: notify all active users of this client
      if (clientId) {
        // clientId from PostgreSQL needs to match either:
        // - postgresClientId field in MongoDB User
        // - or cliente._id if it's the same
        const users = await User.find({
          $or: [
            { postgresClientId: clientId },
            { cliente: clientId }
          ],
          ...query
        }).limit(10); // Limit to prevent spam

        if (users && users.length > 0) {
          return users;
        }
      }

      // Last resort: notify admin users
      const adminRole = await User.model('Role').findOne({ name: 'Admin' });
      if (adminRole) {
        const adminUsers = await User.find({
          role: adminRole._id,
          ...query
        }).limit(5);

        return adminUsers || [];
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
