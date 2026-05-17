import { query } from '../../config/postgres.config.js';

class TuyaProductAlertConfigModel {
  static parseRow(row) {
    if (!row) return null;
    let rules = [];
    if (row.rules != null) {
      if (Array.isArray(row.rules)) rules = row.rules;
      else if (typeof row.rules === 'string') {
        try {
          rules = JSON.parse(row.rules || '[]');
        } catch {
          rules = [];
        }
      }
    }
    return {
      id: String(row.id),
      device_id: row.device_id,
      client_id: row.client_id != null ? String(row.client_id) : null,
      sensor_code: row.sensor_code,
      display_name: row.display_name,
      rules,
      enabled: row.enabled !== false,
      createdat: row.createdat,
      updatedat: row.updatedat,
    };
  }

  static async findById(id) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return null;
    const r = await query('SELECT * FROM tuya_product_alert_configs WHERE id = $1 LIMIT 1', [n]);
    return r.rows?.[0] ? this.parseRow(r.rows[0]) : null;
  }

  static async findByDeviceId(deviceId, { enabledOnly = false } = {}) {
    if (!deviceId) return [];
    let sql = 'SELECT * FROM tuya_product_alert_configs WHERE device_id = $1';
    const params = [String(deviceId)];
    if (enabledOnly) sql += ' AND enabled = TRUE';
    sql += ' ORDER BY sensor_code ASC';
    const r = await query(sql, params);
    return (r.rows || []).map((row) => this.parseRow(row));
  }

  static async findForClientIds(clientIds = []) {
    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      const r = await query(
        'SELECT * FROM tuya_product_alert_configs ORDER BY device_id ASC, sensor_code ASC LIMIT 500'
      );
      return (r.rows || []).map((row) => this.parseRow(row));
    }
    const r = await query(
      `SELECT * FROM tuya_product_alert_configs WHERE client_id = ANY($1::bigint[]) ORDER BY device_id ASC, sensor_code ASC`,
      [clientIds.map((id) => parseInt(String(id), 10)).filter((n) => !Number.isNaN(n))]
    );
    return (r.rows || []).map((row) => this.parseRow(row));
  }

  static async create(data) {
    const {
      deviceId,
      clientId,
      sensorCode,
      displayName,
      rules = [],
      enabled = true,
    } = data;
    const r = await query(
      `INSERT INTO tuya_product_alert_configs (device_id, client_id, sensor_code, display_name, rules, enabled)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *`,
      [
        String(deviceId),
        parseInt(String(clientId), 10),
        String(sensorCode),
        displayName || null,
        JSON.stringify(Array.isArray(rules) ? rules : []),
        !!enabled,
      ]
    );
    return r.rows?.[0] ? this.parseRow(r.rows[0]) : null;
  }

  static async update(id, data) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return null;
    const updates = [];
    const vals = [];
    let i = 1;
    if (data.sensorCode != null) {
      updates.push(`sensor_code = $${i++}`);
      vals.push(String(data.sensorCode));
    }
    if (data.displayName !== undefined) {
      updates.push(`display_name = $${i++}`);
      vals.push(data.displayName);
    }
    if (data.rules != null) {
      updates.push(`rules = $${i++}::jsonb`);
      vals.push(JSON.stringify(data.rules));
    }
    if (data.enabled !== undefined) {
      updates.push(`enabled = $${i++}`);
      vals.push(!!data.enabled);
    }
    if (updates.length === 0) return this.findById(n);
    vals.push(n);
    const r = await query(
      `UPDATE tuya_product_alert_configs SET ${updates.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
      vals
    );
    return r.rows?.[0] ? this.parseRow(r.rows[0]) : null;
  }

  static async delete(id) {
    const n = parseInt(String(id), 10);
    if (Number.isNaN(n)) return false;
    const r = await query('DELETE FROM tuya_product_alert_configs WHERE id = $1 RETURNING id', [n]);
    return (r.rowCount || 0) > 0;
  }
}

export default TuyaProductAlertConfigModel;
