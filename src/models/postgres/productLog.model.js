// PostgreSQL model for product_logs table (replaces MongoDB ProductLog)

import { query } from '../../config/postgres.config.js';

class ProductLogModel {
  static async create(data) {
    let productId = data.producto ?? data.product_id;
    const deviceId = data.product_device_id ?? (typeof data.product_id === 'string' ? data.product_id : null);
    if (productId != null && typeof productId === 'object') productId = productId.id ?? productId._id;
    if ((productId == null || (typeof productId === 'string' && !/^\d+$/.test(productId))) && deviceId) {
      const { query: q } = await import('../../config/postgres.config.js');
      const r = await q('SELECT id FROM products WHERE device_id = $1 LIMIT 1', [deviceId]);
      productId = r.rows?.[0]?.id ?? null;
    }
    const result = await query(`
      INSERT INTO product_logs (product_id, product_device_id, tds, production_volume, rejected_volume, temperature, flujo_produccion, flujo_rechazo, tiempo_inicio, tiempo_fin, source, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      productId,
      deviceId,
      data.tds ?? null,
      data.production_volume ?? null,
      data.rejected_volume ?? null,
      data.temperature ?? null,
      data.flujo_produccion ?? null,
      data.flujo_rechazo ?? null,
      data.tiempo_inicio ?? null,
      data.tiempo_fin ?? null,
      data.source ?? 'esp32',
      data.date ?? new Date()
    ]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findOne(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.product_id) {
      where.push(`(product_device_id = $${i} OR product_id = $${i})`);
      values.push(filters.product_id);
      i++;
    }
    if (filters.date != null) {
      const d = filters.date;
      if (typeof d === 'object' && (d.$gte != null || d.$lte != null)) {
        if (d.$gte != null) {
          where.push(`date >= $${i}`);
          values.push(d.$gte instanceof Date ? d.$gte : new Date(d.$gte));
          i++;
        }
        if (d.$lte != null) {
          where.push(`date <= $${i}`);
          values.push(d.$lte instanceof Date ? d.$lte : new Date(d.$lte));
          i++;
        }
      } else if (!(typeof d === 'object' && d.$in)) {
        where.push(`date::date = $${i}::date`);
        values.push(d instanceof Date ? d : new Date(d));
        i++;
      }
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`SELECT * FROM product_logs WHERE ${whereClause} ORDER BY date DESC LIMIT 1`, values);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findLatestWithData(productDeviceId) {
    const result = await query(`
      SELECT * FROM product_logs
      WHERE product_device_id = $1
        AND (COALESCE(tds, 0) != 0 OR COALESCE(production_volume, 0) != 0 OR COALESCE(rejected_volume, 0) != 0
             OR COALESCE(temperature, 0) != 0 OR COALESCE(flujo_produccion, 0) != 0 OR COALESCE(flujo_rechazo, 0) != 0)
      ORDER BY date DESC LIMIT 1
    `, [productDeviceId]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async insertMany(items) {
    const created = [];
    for (const data of items) {
      try {
        const r = await this.create(data);
        if (r) created.push(r);
      } catch (e) {
        console.warn('[ProductLogModel] insertMany skip:', e.message);
      }
    }
    return created;
  }

  static async find(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.product_id) {
      where.push(`(product_id = $${i} OR product_device_id = $${i})`);
      values.push(filters.product_id);
      i++;
    }
    if (filters.product_device_id) {
      where.push(`product_device_id = $${i}`);
      values.push(filters.product_device_id);
      i++;
    }
    if (filters.date) {
      const d = filters.date;
      if (d.$gte != null) {
        where.push(`date >= $${i}`);
        values.push(d.$gte);
        i++;
      }
      if (d.$lte != null) {
        where.push(`date <= $${i}`);
        values.push(d.$lte);
        i++;
      }
      if (d.$in && Array.isArray(d.$in) && d.$in.length > 0) {
        where.push(`date::date = ANY($${i}::date[])`);
        values.push(d.$in.map(x => (x instanceof Date ? x : new Date(x))));
        i++;
      }
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    let sql = `SELECT * FROM product_logs WHERE ${whereClause} ORDER BY date DESC`;
    if (filters._limit) {
      sql += ` LIMIT ${parseInt(filters._limit, 10) || 100}`;
    }
    const result = await query(sql, values);
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async count(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.product_id) {
      where.push(`(product_id = $${i} OR product_device_id = $${i})`);
      values.push(filters.product_id);
      i++;
    }
    if (filters.date) {
      const d = filters.date;
      if (d.$gte != null) {
        where.push(`date >= $${i}`);
        values.push(d.$gte);
        i++;
      }
      if (d.$lte != null) {
        where.push(`date <= $${i}`);
        values.push(d.$lte);
        i++;
      }
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const result = await query(`SELECT COUNT(*)::int as c FROM product_logs WHERE ${whereClause}`, values);
    return result.rows?.[0]?.c ?? 0;
  }

  static async findByDates(productId, dates) {
    if (!dates?.length) return [];
    const dateArr = dates.map(d => (d instanceof Date ? d : new Date(d)));
    const result = await query(
      `SELECT id, date FROM product_logs WHERE (product_id = $1 OR product_device_id = $1) AND date::date = ANY($2::date[])`,
      [productId, dateArr]
    );
    return (result.rows || []).map(r => ({ id: r.id, date: r.date }));
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      _id: String(row.id),
      producto: row.product_id,
      product_id: row.product_device_id,
      product_device_id: row.product_device_id,
      tds: row.tds,
      production_volume: row.production_volume,
      rejected_volume: row.rejected_volume,
      temperature: row.temperature,
      flujo_produccion: row.flujo_produccion,
      flujo_rechazo: row.flujo_rechazo,
      tiempo_inicio: row.tiempo_inicio,
      tiempo_fin: row.tiempo_fin,
      source: row.source ?? 'esp32',
      date: row.date
    };
  }
}

export default ProductLogModel;
