import { query } from '../../config/postgres.config.js';

function parseRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    config_id: row.config_id != null ? String(row.config_id) : null,
    usuario: row.usuario,
    correo: row.correo,
    celular: row.celular,
    celularAlert: row.celular_alert === true,
    celular_alert: row.celular_alert,
    dashboardAlert: row.dashboard_alert === true,
    dashboard_alert: row.dashboard_alert,
    emailAlert: row.email_alert === true,
    email_alert: row.email_alert,
    preventivo: row.preventivo === true,
    correctivo: row.correctivo === true,
    emailCooldownMinutes: row.email_cooldown_minutes ?? 10,
    emailMaxPerDay: row.email_max_per_day ?? 5,
    createdat: row.createdat,
    updatedat: row.updatedat,
  };
}

class TuyaProductAlertContactModel {
  static async findById(id) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return null;
    const r = await query('SELECT * FROM tuya_product_alert_contacts WHERE id = $1 LIMIT 1', [n]);
    return r.rows?.[0] ? parseRow(r.rows[0]) : null;
  }

  static async findByConfigId(configId) {
    const n = parseInt(String(configId), 10);
    if (Number.isNaN(n)) return [];
    const r = await query(
      'SELECT * FROM tuya_product_alert_contacts WHERE config_id = $1 ORDER BY usuario ASC',
      [n]
    );
    return (r.rows || []).map(parseRow);
  }

  static async create(data) {
    const {
      configId,
      usuario,
      correo,
      celular,
      celularAlert = false,
      dashboardAlert = false,
      emailAlert = false,
      preventivo = false,
      correctivo = false,
      emailCooldownMinutes = 10,
      emailMaxPerDay = 5,
    } = data;
    const r = await query(
      `INSERT INTO tuya_product_alert_contacts (
        config_id, usuario, correo, celular, celular_alert, dashboard_alert, email_alert,
        preventivo, correctivo, email_cooldown_minutes, email_max_per_day
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        parseInt(String(configId), 10),
        usuario,
        correo,
        celular || null,
        !!celularAlert,
        !!dashboardAlert,
        !!emailAlert,
        !!preventivo,
        !!correctivo,
        emailCooldownMinutes ?? 10,
        emailMaxPerDay ?? 5,
      ]
    );
    return r.rows?.[0] ? parseRow(r.rows[0]) : null;
  }

  static async update(id, data) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return null;
    const fields = [];
    const vals = [];
    let p = 1;
    const map = [
      ['usuario', data.usuario],
      ['correo', data.correo],
      ['celular', data.celular],
      ['celular_alert', data.celularAlert ?? data.celular_alert],
      ['dashboard_alert', data.dashboardAlert ?? data.dashboard_alert],
      ['email_alert', data.emailAlert ?? data.email_alert],
      ['preventivo', data.preventivo],
      ['correctivo', data.correctivo],
      ['email_cooldown_minutes', data.emailCooldownMinutes ?? data.email_cooldown_minutes],
      ['email_max_per_day', data.emailMaxPerDay ?? data.email_max_per_day],
    ];
    for (const [col, val] of map) {
      if (val !== undefined) {
        fields.push(`${col} = $${p++}`);
        vals.push(val);
      }
    }
    if (!fields.length) return this.findById(n);
    vals.push(n);
    const r = await query(
      `UPDATE tuya_product_alert_contacts SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${p} RETURNING *`,
      vals
    );
    return r.rows?.[0] ? parseRow(r.rows[0]) : null;
  }

  static async delete(id) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return false;
    const r = await query('DELETE FROM tuya_product_alert_contacts WHERE id = $1 RETURNING id', [n]);
    return (r.rowCount || 0) > 0;
  }
}

export default TuyaProductAlertContactModel;
