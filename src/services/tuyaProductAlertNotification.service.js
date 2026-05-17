/**
 * Tuya-only product alerts: evaluates products.status[] against tuya_product_alert_configs.rules
 * and notifies tuya_product_alert_contacts. Independent from MQTT / metric_alerts (v2).
 */

import NotificationModel from '../models/postgres/notification.model.js';
import UserModel from '../models/postgres/user.model.js';
import TuyaProductAlertConfigModel from '../models/postgres/tuyaProductAlertConfig.model.js';
import TuyaProductAlertContactModel from '../models/postgres/tuyaProductAlertContact.model.js';
import TuyaProductAlertEmailLogModel from '../models/postgres/tuyaProductAlertEmailLog.model.js';
import MetricNotificationService from './metricNotification.service.js';
import emailHelper from '../utils/email.helper.js';

function liveTuyaDeviceIdForAlerts(product) {
  if (!product) return null;
  const did = String(product.id ?? product.device_id ?? '');
  const merged = Array.isArray(product.merged_from_device_ids) ? product.merged_from_device_ids : [];
  if (did.startsWith('_') && merged.length > 0) return String(merged[0]);
  return did || null;
}

function statusNumericValue(status, code) {
  const arr = Array.isArray(status) ? status : [];
  const item = arr.find((s) => s && String(s.code) === String(code));
  if (!item || item.value === undefined || item.value === null) return null;
  const n = Number(item.value);
  return Number.isFinite(n) ? n : null;
}

class TuyaProductAlertNotificationService {
  static recentKeys = new Map();
  static DEDUP_MS = 5 * 60 * 1000;

  static cleanupDedup() {
    const now = Date.now();
    const cutoff = now - this.DEDUP_MS;
    for (const [k, t] of this.recentKeys.entries()) {
      if (t < cutoff) this.recentKeys.delete(k);
    }
  }

  /**
   * @param {object} product - Parsed product row (device_id, client_id, status[], name, …)
   */
  static async evaluateFromProductRow(product) {
    if (!product || !Array.isArray(product.status)) return [];
    const liveDeviceId = liveTuyaDeviceIdForAlerts(product);
    if (!liveDeviceId) return [];

    const clientId = product.client_id ?? product.cliente;
    const clientNum =
      clientId != null && typeof clientId === 'object'
        ? parseInt(String(clientId.id ?? clientId._id), 10)
        : parseInt(String(clientId), 10);
    if (Number.isNaN(clientNum)) return [];

    const configs = await TuyaProductAlertConfigModel.findByDeviceId(liveDeviceId, { enabledOnly: true });
    const created = [];

    for (const cfg of configs) {
      if (parseInt(String(cfg.client_id), 10) !== clientNum) continue;
      const rules = cfg.rules || [];
      if (!Array.isArray(rules) || rules.length === 0) continue;

      const value = statusNumericValue(product.status, cfg.sensor_code);
      if (value === null) continue;

      const level = MetricNotificationService.evaluateLevelFromMetricRules(value, { rules });
      if (!level) continue;

      const contacts = await TuyaProductAlertContactModel.findByConfigId(cfg.id);
      const metricLike = {
        id: cfg.id,
        metric_name: cfg.display_name || cfg.sensor_code,
        metric_type: cfg.sensor_code,
      };
      const sensorData = {
        type: cfg.sensor_code,
        value,
        codigoTienda: product.name || liveDeviceId,
        clientId: String(clientNum),
        timestamp: new Date(),
      };

      for (const alert of contacts) {
        const wantsP = !!alert.preventivo;
        const wantsC = !!alert.correctivo;
        if ((level === 'preventivo' && !wantsP) || (level === 'critico' && !wantsC)) continue;

        if (alert.dashboardAlert || alert.dashboard_alert) {
          const users = await MetricNotificationService.getUsersToNotify(alert, String(clientNum));
          const notificationType = level === 'critico' ? 'alert' : 'warning';
          const baseUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || '').replace(/\/$/, '');
          const url = baseUrl ? `${baseUrl}/Equipos/${encodeURIComponent(liveDeviceId)}` : null;
          const title = `Alerta Tuya: ${metricLike.metric_name}`;
          const desc =
            MetricNotificationService.generateDefaultMessage(metricLike, sensorData, level) +
            ` (equipo ${liveDeviceId})`;

          for (const user of users) {
            const uid = user.id || user._id;
            const dedupKey = `tuya_${uid}_${cfg.id}_${level}_${cfg.sensor_code}`;
            const now = Date.now();
            const last = this.recentKeys.get(dedupKey);
            if (last && now - last < this.DEDUP_MS) continue;

            try {
              await NotificationModel.create({
                user_id: uid,
                title,
                description: desc,
                avatar_url: null,
                type: notificationType,
                posted_at: new Date(),
                is_unread: true,
                url,
              });
              this.recentKeys.set(dedupKey, now);
              created.push({ user: uid, configId: cfg.id });
            } catch (e) {
              console.error('[TuyaProductAlert] notification', e.message);
            }
          }
        }

        if (alert.emailAlert || alert.email_alert) {
          await this.sendEmail(alert, cfg, metricLike, sensorData, level);
        }
      }
    }

    if (this.recentKeys.size > 800) this.cleanupDedup();
    return created;
  }

  static async sendEmail(alert, config, metricLike, sensorData, level) {
    try {
      const cooldown = alert.emailCooldownMinutes ?? 10;
      const maxPerDay = alert.emailMaxPerDay ?? 5;
      const contactId = parseInt(String(alert.id), 10);
      const configId = parseInt(String(config.id), 10);
      if (Number.isNaN(contactId) || Number.isNaN(configId)) return;

      const can = await TuyaProductAlertEmailLogModel.canSendEmail(contactId, level, cooldown, maxPerDay);
      if (!can.allowed) {
        console.log(`[TuyaProductAlert] email skip: ${can.reason}`);
        return;
      }

      const message = MetricNotificationService.generateDefaultMessage(metricLike, sensorData, level);
      const alertType = level === 'critico' ? 'correctivo' : 'preventivo';
      const result = await emailHelper.sendAlertEmail({
        to: alert.correo,
        alertType,
        metricName: String(metricLike.metric_name || config.sensor_code),
        message,
        sensorData: {
          Valor: sensorData.value,
          Equipo: sensorData.codigoTienda,
          Sensor: config.sensor_code,
          Origen: 'Tuya',
        },
      });

      if (result.success) {
        await TuyaProductAlertEmailLogModel.create({
          contactId,
          configId,
          correo: alert.correo,
          alertLevel: level,
          sensorCode: config.sensor_code,
          sensorValue: sensorData.value,
        });
        console.log(`[TuyaProductAlert] email sent → ${alert.correo}`);
      }
    } catch (e) {
      console.error('[TuyaProductAlert] sendEmail', e.message);
    }
  }
}

export default TuyaProductAlertNotificationService;
