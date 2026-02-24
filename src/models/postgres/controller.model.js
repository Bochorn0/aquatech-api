// PostgreSQL model for controllers table (replaces MongoDB Controller)

import { query } from '../../config/postgres.config.js';

class ControllerModel {
  static async findById(id) {
    const result = await query(
      `SELECT c.*, p.device_id as product_device_id FROM controllers c
       LEFT JOIN products p ON c.product_id = p.id WHERE c.id = $1 LIMIT 1`,
      [id]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByDeviceId(deviceId) {
    const result = await query('SELECT * FROM controllers WHERE device_id = $1 LIMIT 1', [deviceId]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByIdOrDeviceId(idOrDeviceId) {
    if (!idOrDeviceId) return null;
    const byDevice = await this.findByDeviceId(idOrDeviceId);
    if (byDevice) return byDevice;
    return this.findById(idOrDeviceId);
  }

  static async find(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.client_id != null || filters.cliente != null) {
      where.push(`client_id = $${i}`);
      values.push(filters.client_id ?? filters.cliente);
      i++;
    }
    if (filters.product != null || filters.product_id != null) {
      where.push(`product_id = $${i}`);
      values.push(filters.product ?? filters.product_id);
      i++;
    }
    if (filters.online !== undefined) {
      where.push(`online = $${i}`);
      values.push(!!filters.online);
      i++;
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`SELECT * FROM controllers WHERE ${whereClause} ORDER BY createdat DESC`, values);
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async findOne(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.id) {
      where.push(`(id = $${i} OR device_id = $${i})`);
      values.push(filters.id);
      i++;
    }
    if (filters.ip) {
      where.push(`ip = $${i}`);
      values.push(filters.ip);
      i++;
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`SELECT * FROM controllers WHERE ${whereClause} LIMIT 1`, values);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM controllers WHERE id = $1 OR device_id = $2 RETURNING id', [id, id]);
    return result.rows?.length > 0;
  }

  static async create(data) {
    const row = this.toRow(data);
    const result = await query(`
      INSERT INTO controllers (device_id, active_time, last_time_active, product_type, create_time, kfactor_tds, kfactor_flujo, icon, ip, city, state, client_id, product_id, drive, lat, lon, model, name, online, owner_id, product_device_id, product_name, sub, time_zone, reset_pending, update_controller_time, loop_time, flush_time, flush_pending, tipo_sensor, sensor_factor)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
      RETURNING *
    `, [row.device_id, row.active_time, row.last_time_active, row.product_type, row.create_time, row.kfactor_tds, row.kfactor_flujo, row.icon, row.ip, row.city, row.state, row.client_id, row.product_id, row.drive, row.lat, row.lon, row.model, row.name, row.online, row.owner_id, row.product_device_id, row.product_name, row.sub, row.time_zone, row.reset_pending, row.update_controller_time, row.loop_time, row.flush_time, row.flush_pending, row.tipo_sensor, row.sensor_factor]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async update(id, data) {
    const cols = [];
    const vals = [];
    let i = 1;
    const map = {
      lapso_actualizacion: 'update_controller_time',
      lapso_loop: 'loop_time',
      product: 'product_id',
      cliente: 'client_id',
    };
    const allowed = ['active_time', 'last_time_active', 'online', 'ip', 'reset_pending', 'flush_pending', 'kfactor_tds', 'kfactor_flujo', 'name', 'product_id', 'client_id', 'product_device_id', 'product_name', 'city', 'state', 'drive', 'lat', 'lon', 'model', 'update_controller_time', 'loop_time', 'flush_time', 'flush_pending', 'tipo_sensor', 'sensor_factor'];
    for (const k of Object.keys(data)) {
      const col = map[k] || k;
      if (allowed.includes(col) && data[k] !== undefined) {
        cols.push(`${col} = $${i}`);
        vals.push(data[k]);
        i++;
      }
    }
    if (cols.length === 0) return this.findByIdOrDeviceId(id);
    const existing = await this.findByIdOrDeviceId(id);
    if (!existing) return null;
    vals.push(existing._id);
    const result = await query(`UPDATE controllers SET ${cols.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`, vals);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static toRow(data) {
    const productId = data.product?.id ?? data.product?._id ?? data.product_id;
    const clientId = data.cliente?.id ?? data.cliente ?? data.client_id;
    return {
      device_id: data.id ?? data.device_id ?? '',
      active_time: data.active_time ?? null,
      last_time_active: data.last_time_active ?? null,
      product_type: data.product_type ?? null,
      create_time: data.create_time ?? null,
      kfactor_tds: data.kfactor_tds ?? null,
      kfactor_flujo: data.kfactor_flujo ?? null,
      icon: data.icon ?? null,
      ip: data.ip ?? '',
      city: data.city ?? null,
      state: data.state ?? null,
      client_id: clientId ?? null,
      product_id: productId ?? null,
      drive: data.drive ?? null,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      model: data.model ?? null,
      name: data.name ?? '',
      online: data.online ?? false,
      owner_id: data.owner_id ?? null,
      product_device_id: data.product_id ?? data.product_device_id ?? null,
      product_name: data.product_name ?? null,
      sub: data.sub ?? false,
      time_zone: data.time_zone ?? '-07:00',
      reset_pending: data.reset_pending ?? false,
      update_controller_time: data.update_controller_time ?? 10000,
      loop_time: data.loop_time ?? 1000,
      flush_time: data.flush_time ?? 20000,
      flush_pending: data.flush_pending ?? false,
      tipo_sensor: data.tipo_sensor ?? 1,
      sensor_factor: data.sensor_factor ?? null
    };
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.device_id,
      _id: String(row.id),
      device_id: row.device_id,
      active_time: row.active_time,
      last_time_active: row.last_time_active,
      product_type: row.product_type,
      create_time: row.create_time,
      kfactor_tds: row.kfactor_tds,
      kfactor_flujo: row.kfactor_flujo,
      icon: row.icon,
      ip: row.ip,
      city: row.city,
      state: row.state,
      cliente: row.client_id,
      client_id: row.client_id,
      product: row.product_id,
      product_id: row.product_id,
      product_device_id: row.product_device_id,
      drive: row.drive,
      lat: row.lat,
      lon: row.lon,
      model: row.model,
      name: row.name,
      online: row.online ?? false,
      owner_id: row.owner_id,
      product_name: row.product_name,
      sub: row.sub ?? false,
      time_zone: row.time_zone ?? '-07:00',
      reset_pending: row.reset_pending ?? false,
      update_controller_time: row.update_controller_time ?? 10000,
      loop_time: row.loop_time ?? 1000,
      flush_time: row.flush_time ?? 20000,
      flush_pending: row.flush_pending ?? false,
      tipo_sensor: row.tipo_sensor ?? 1,
      sensor_factor: row.sensor_factor
    };
  }
}

export default ControllerModel;
