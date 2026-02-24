// PostgreSQL model for products table (replaces MongoDB Product)

import { query } from '../../config/postgres.config.js';

class ProductModel {
  static async findById(id) {
    const result = await query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByDeviceId(deviceId) {
    const result = await query('SELECT * FROM products WHERE device_id = $1 LIMIT 1', [deviceId]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByIdOrDeviceId(idOrDeviceId) {
    if (!idOrDeviceId) return null;
    const byDevice = await this.findByDeviceId(idOrDeviceId);
    if (byDevice) return byDevice;
    return this.findById(idOrDeviceId);
  }

  static async insertMany(items) {
    const created = [];
    for (const data of items) {
      try {
        const row = this.toRow(data);
        const r = await query(`
          INSERT INTO products (device_id, active_time, last_time_active, product_type, biz_type, category, create_time, icon, ip, city, state, client_id, drive, lat, local_key, lon, model, name, online, owner_id, product_id, product_name, status, sub, time_zone, uid, update_time, uuid, tuya_logs_routine_enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
          ON CONFLICT (device_id) DO UPDATE SET updatedat = CURRENT_TIMESTAMP
          RETURNING *
        `, [row.device_id, row.active_time, row.last_time_active, row.product_type, row.biz_type, row.category, row.create_time, row.icon, row.ip, row.city, row.state, row.client_id, row.drive, row.lat, row.local_key, row.lon, row.model, row.name, row.online, row.owner_id, row.product_id, row.product_name, row.status, row.sub, row.time_zone, row.uid, row.update_time, row.uuid, row.tuya_logs_routine_enabled]);
        if (r.rows?.[0]) created.push(this.parseRow(r.rows[0]));
      } catch (e) {
        console.warn('[ProductModel] insertMany skip:', e.message);
      }
    }
    return created;
  }

  static async find(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.client_id != null) {
      where.push(`client_id = $${i}`);
      values.push(filters.client_id);
      i++;
    }
    if (filters.cliente != null) {
      where.push(`client_id = $${i}`);
      values.push(filters.cliente);
      i++;
    }
    if (filters.city) {
      where.push(`city = $${i}`);
      values.push(filters.city);
      i++;
    }
    if (filters.state) {
      where.push(`state = $${i}`);
      values.push(filters.state);
      i++;
    }
    if (filters.drive) {
      where.push(`drive = $${i}`);
      values.push(filters.drive);
      i++;
    }
    if (filters.online !== undefined) {
      where.push(`online = $${i}`);
      values.push(filters.online);
      i++;
    }
    if (filters.tuya_logs_routine_enabled !== undefined) {
      where.push(`tuya_logs_routine_enabled = $${i}`);
      values.push(!!filters.tuya_logs_routine_enabled);
      i++;
    }
    if (filters.create_time) {
      const ct = filters.create_time;
      if (ct.$gte != null) {
        where.push(`create_time >= $${i}`);
        values.push(ct.$gte);
        i++;
      }
      if (ct.$lte != null) {
        where.push(`create_time <= $${i}`);
        values.push(ct.$lte);
        i++;
      }
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`
      SELECT * FROM products WHERE ${whereClause} ORDER BY createdat DESC
    `, values);
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async create(data) {
    const row = this.toRow(data);
    const result = await query(`
      INSERT INTO products (device_id, active_time, last_time_active, product_type, biz_type, category, create_time, icon, ip, city, state, client_id, drive, lat, local_key, lon, model, name, online, owner_id, product_id, product_name, status, sub, time_zone, uid, update_time, uuid, tuya_logs_routine_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      RETURNING *
    `, [row.device_id, row.active_time, row.last_time_active, row.product_type, row.biz_type, row.category, row.create_time, row.icon, row.ip, row.city, row.state, row.client_id, row.drive, row.lat, row.local_key, row.lon, row.model, row.name, row.online, row.owner_id, row.product_id, row.product_name, row.status, row.sub, row.time_zone, row.uid, row.update_time, row.uuid, row.tuya_logs_routine_enabled]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM products WHERE id = $1 OR device_id = $2 RETURNING id', [id, id]);
    return result.rows?.length > 0;
  }

  static async update(id, data) {
    let numericId = id;
    if (typeof id === 'string' && !/^\d+$/.test(id)) {
      const existing = await this.findByDeviceId(id);
      if (!existing) return null;
      numericId = parseInt(existing._id, 10);
    }
    const row = this.toRow(data);
    const result = await query(`
      UPDATE products SET
        active_time = COALESCE($1, active_time), last_time_active = COALESCE($2, last_time_active), product_type = COALESCE($3, product_type),
        biz_type = COALESCE($4, biz_type), category = COALESCE($5, category), create_time = COALESCE($6, create_time),
        icon = COALESCE($7, icon), ip = COALESCE($8, ip), city = COALESCE($9, city), state = COALESCE($10, state),
        client_id = COALESCE($11, client_id), drive = COALESCE($12, drive), lat = COALESCE($13, lat), local_key = COALESCE($14, local_key),
        lon = COALESCE($15, lon), model = COALESCE($16, model), name = COALESCE($17, name), online = COALESCE($18, online),
        owner_id = COALESCE($19, owner_id), product_id = COALESCE($20, product_id), product_name = COALESCE($21, product_name),
        status = COALESCE($22, status), sub = COALESCE($23, sub), time_zone = COALESCE($24, time_zone), uid = COALESCE($25, uid),
        update_time = COALESCE($26, update_time), uuid = COALESCE($27, uuid), tuya_logs_routine_enabled = COALESCE($28, tuya_logs_routine_enabled),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $29 RETURNING *
    `, [row.active_time, row.last_time_active, row.product_type, row.biz_type, row.category, row.create_time, row.icon, row.ip, row.city, row.state, row.client_id, row.drive, row.lat, row.local_key, row.lon, row.model, row.name, row.online, row.owner_id, row.product_id, row.product_name, row.status, row.sub, row.time_zone, row.uid, row.update_time, row.uuid, row.tuya_logs_routine_enabled, numericId]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static toRow(data) {
    const cliente = data.cliente ?? data.client_id;
    const clientId = typeof cliente === 'object' && cliente?.id != null ? cliente.id : cliente;
    const status = Array.isArray(data.status) ? JSON.stringify(data.status) : (data.status ? JSON.stringify(data.status) : '[]');
    return {
      device_id: data.id ?? data.device_id ?? '',
      active_time: data.active_time ?? null,
      last_time_active: data.last_time_active ?? null,
      product_type: data.product_type ?? 'Osmosis',
      biz_type: data.biz_type ?? null,
      category: data.category ?? null,
      create_time: data.create_time ?? null,
      icon: data.icon ?? null,
      ip: data.ip ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      client_id: clientId ?? null,
      drive: data.drive ?? null,
      lat: data.lat ?? null,
      local_key: data.local_key ?? null,
      lon: data.lon ?? null,
      model: data.model ?? null,
      name: data.name ?? null,
      online: data.online ?? false,
      owner_id: data.owner_id ?? null,
      product_id: data.product_id ?? null,
      product_name: data.product_name ?? null,
      status,
      sub: data.sub ?? false,
      time_zone: data.time_zone ?? null,
      uid: data.uid ?? null,
      update_time: data.update_time ?? null,
      uuid: data.uuid ?? null,
      tuya_logs_routine_enabled: data.tuya_logs_routine_enabled ?? false
    };
  }

  static parseRow(row) {
    if (!row) return null;
    const status = Array.isArray(row.status) ? row.status : (row.status ? JSON.parse(row.status || '[]') : []);
    return {
      id: row.device_id,
      _id: String(row.id),
      device_id: row.device_id,
      active_time: row.active_time,
      last_time_active: row.last_time_active,
      product_type: row.product_type ?? 'Osmosis',
      biz_type: row.biz_type,
      category: row.category,
      create_time: row.create_time,
      icon: row.icon,
      ip: row.ip,
      city: row.city,
      state: row.state,
      cliente: row.client_id,
      client_id: row.client_id,
      drive: row.drive,
      lat: row.lat,
      local_key: row.local_key,
      lon: row.lon,
      model: row.model,
      name: row.name,
      online: row.online ?? false,
      owner_id: row.owner_id,
      product_id: row.product_id,
      product_name: row.product_name,
      status,
      sub: row.sub ?? false,
      time_zone: row.time_zone,
      uid: row.uid,
      update_time: row.update_time,
      uuid: row.uuid,
      tuya_logs_routine_enabled: row.tuya_logs_routine_enabled ?? false
    };
  }
}

export default ProductModel;
