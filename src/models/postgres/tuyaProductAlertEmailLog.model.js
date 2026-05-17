import { query } from '../../config/postgres.config.js';

class TuyaProductAlertEmailLogModel {
  static async create(data) {
    const {
      contactId,
      configId,
      correo,
      alertLevel,
      sensorCode,
      sensorValue,
    } = data;
    const r = await query(
      `INSERT INTO tuya_product_alert_email_log (contact_id, config_id, correo, alert_level, sensor_code, sensor_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        parseInt(String(contactId), 10),
        parseInt(String(configId), 10),
        correo,
        alertLevel,
        sensorCode || null,
        sensorValue != null ? sensorValue : null,
      ]
    );
    return r.rows?.[0] || null;
  }

  static async canSendEmail(contactId, alertLevel, cooldownMinutes = 10, maxPerDay = 5) {
    try {
      const now = new Date();
      const cooldownCutoff = new Date(now.getTime() - cooldownMinutes * 60 * 1000);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const cid = parseInt(String(contactId), 10);
      if (Number.isNaN(cid)) return { allowed: false, reason: 'invalid contact id' };

      const last = await query(
        `SELECT sent_at FROM tuya_product_alert_email_log WHERE contact_id = $1 AND alert_level = $2 ORDER BY sent_at DESC LIMIT 1`,
        [cid, alertLevel]
      );
      if (last.rows.length > 0) {
        const lastSent = new Date(last.rows[0].sent_at);
        if (lastSent > cooldownCutoff) {
          const minutesAgo = Math.round((now - lastSent) / 60000);
          return { allowed: false, reason: `Cooldown: ${minutesAgo} min ago` };
        }
      }
      const cnt = await query(
        `SELECT COUNT(*)::int AS c FROM tuya_product_alert_email_log WHERE contact_id = $1 AND alert_level = $2 AND sent_at >= $3`,
        [cid, alertLevel, dayStart.toISOString()]
      );
      const n = cnt.rows[0]?.c ?? 0;
      if (n >= maxPerDay) return { allowed: false, reason: `Daily limit ${n}/${maxPerDay}` };
      return { allowed: true };
    } catch (e) {
      console.error('[TuyaProductAlertEmailLog]', e);
      return { allowed: false, reason: e.message };
    }
  }
}

export default TuyaProductAlertEmailLogModel;
