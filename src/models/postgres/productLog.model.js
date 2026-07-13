// PostgreSQL model for product_logs table (replaces MongoDB ProductLog)

import { query } from '../../config/postgres.config.js';
import { devWarn } from '../../utils/devLogger.js';

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
    const customMetrics =
      data.custom_metrics != null
        ? typeof data.custom_metrics === 'string'
          ? data.custom_metrics
          : JSON.stringify(data.custom_metrics)
        : null;
    try {
      const result = await query(`
        INSERT INTO product_logs (
          product_id, product_device_id, tds, production_volume, rejected_volume, temperature,
          flujo_produccion, flujo_rechazo, tiempo_inicio, tiempo_fin, source, date,
          custom_metrics, campo_personalizado_1, campo_personalizado_2
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
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
        data.date ?? new Date(),
        customMetrics,
        data.campo_personalizado_1 ?? null,
        data.campo_personalizado_2 ?? null,
      ]);
      return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
    } catch (err) {
      // Fallback if migrations 048/050 not applied yet
      if (err?.message?.includes('campo_personalizado') || err?.message?.includes('custom_metrics')) {
        try {
          const result = await query(`
            INSERT INTO product_logs (product_id, product_device_id, tds, production_volume, rejected_volume, temperature, flujo_produccion, flujo_rechazo, tiempo_inicio, tiempo_fin, source, date, custom_metrics)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
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
            data.date ?? new Date(),
            customMetrics,
          ]);
          return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
        } catch (err2) {
          if (err2?.message?.includes('custom_metrics')) {
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
              data.date ?? new Date(),
            ]);
            return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
          }
          throw err2;
        }
      }
      throw err;
    }
  }

  /**
   * Latest log for a device at or before a given date (for delta / previous_hour rules).
   */
  static async findLatestBefore(productDeviceId, beforeDate) {
    const result = await query(
      `SELECT * FROM product_logs
       WHERE product_device_id = $1 AND date <= $2
       ORDER BY date DESC LIMIT 1`,
      [productDeviceId, beforeDate instanceof Date ? beforeDate : new Date(beforeDate)]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  /** Same as findLatestBefore but across locked + live device_id strings. */
  static async findLatestBeforeAmong(deviceIds = [], beforeDate) {
    const ids = [...new Set((deviceIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return null;
    const result = await query(
      `SELECT * FROM product_logs
       WHERE product_device_id = ANY($1::text[]) AND date <= $2
       ORDER BY date DESC LIMIT 1`,
      [ids, beforeDate instanceof Date ? beforeDate : new Date(beforeDate)]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findOne(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.product_id != null) {
      if (typeof filters.product_id === 'object' && Array.isArray(filters.product_id.$in) && filters.product_id.$in.length > 0) {
        where.push(`product_id = ANY($${i}::bigint[])`);
        values.push(filters.product_id.$in);
        i++;
      } else {
        // Never compare product_id (bigint) to Tuya device_id strings — PG cast fails the whole query.
        where.push(`(product_device_id = $${i} OR product_id::text = $${i}::text)`);
        values.push(filters.product_id);
        i++;
      }
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
        // Exact timestamp match (NOT date::date). Day-level match was blocking the hourly
        // Tuya logs routine: once 1 row existed for that UTC day, all later inserts were skipped.
        where.push(`date = $${i}`);
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

  /** Latest log with data across several product_device_id values (e.g. locked canonical `_id` + live Tuya id). */
  static async findLatestWithDataAmong(deviceIds = []) {
    const ids = [...new Set((deviceIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return null;
    const result = await query(`
      SELECT * FROM product_logs
      WHERE product_device_id = ANY($1::text[])
        AND (COALESCE(tds, 0) != 0 OR COALESCE(production_volume, 0) != 0 OR COALESCE(rejected_volume, 0) != 0
             OR COALESCE(temperature, 0) != 0 OR COALESCE(flujo_produccion, 0) != 0 OR COALESCE(flujo_rechazo, 0) != 0)
      ORDER BY date DESC LIMIT 1
    `, [ids]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async insertMany(items) {
    const created = [];
    for (const data of items) {
      try {
        const r = await this.create(data);
        if (r) created.push(r);
      } catch (e) {
        devWarn('[ProductLogModel] insertMany skip:', e.message);
      }
    }
    return created;
  }

  static async find(filters = {}) {
    const where = [];
    const values = [];
    let i = 1;
    if (filters.product_id != null) {
      if (typeof filters.product_id === 'object' && Array.isArray(filters.product_id.$in) && filters.product_id.$in.length > 0) {
        where.push(`product_id = ANY($${i}::bigint[])`);
        values.push(filters.product_id.$in);
        i++;
      } else {
        where.push(`(product_device_id = $${i} OR product_id::text = $${i}::text)`);
        values.push(filters.product_id);
        i++;
      }
    }
    if (filters.product_device_id) {
      where.push(`product_device_id = $${i}`);
      values.push(filters.product_device_id);
      i++;
    }
    if (filters.product_device_ids != null && Array.isArray(filters.product_device_ids) && filters.product_device_ids.length > 0) {
      where.push(`product_device_id = ANY($${i}::text[])`);
      values.push(filters.product_device_ids.map(String));
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
    if (filters.$or && Array.isArray(filters.$or)) {
      const orParts = [];
      for (const cond of filters.$or) {
        if (cond && typeof cond === 'object') {
          for (const [col, pred] of Object.entries(cond)) {
            if (pred && typeof pred === 'object' && pred.$exists === true) {
              orParts.push(`${col} IS NOT NULL`);
            }
          }
        }
      }
      if (orParts.length > 0) {
        where.push(`(${orParts.join(' OR ')})`);
      }
    }
    const whereClause = where.length ? where.join(' AND ') : '1=1';
    const orderDir = filters._sort && filters._sort.date === 1 ? 'ASC' : 'DESC';
    let sql = `SELECT * FROM product_logs WHERE ${whereClause} ORDER BY date ${orderDir}`;
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
    if (filters.product_id != null) {
      if (typeof filters.product_id === 'object' && Array.isArray(filters.product_id.$in) && filters.product_id.$in.length > 0) {
        where.push(`product_id = ANY($${i}::bigint[])`);
        values.push(filters.product_id.$in);
        i++;
      } else {
        where.push(`(product_device_id = $${i} OR product_id::text = $${i}::text)`);
        values.push(filters.product_id);
        i++;
      }
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
      `SELECT id, date FROM product_logs WHERE (product_device_id = $1 OR product_id::text = $1::text) AND date::date = ANY($2::date[])`,
      [productId, dateArr]
    );
    return (result.rows || []).map(r => ({ id: r.id, date: r.date }));
  }

  /** Dedup check for sync when logs may be stored under multiple device_id strings (locked + live). */
  static async findByDatesForDeviceIds(deviceIds, dates) {
    if (!dates?.length || !deviceIds?.length) return [];
    const ids = [...new Set(deviceIds.filter(Boolean).map(String))];
    const dateArr = dates.map(d => (d instanceof Date ? d : new Date(d)));
    const result = await query(
      `SELECT id, date FROM product_logs WHERE product_device_id = ANY($1::text[]) AND date::date = ANY($2::date[])`,
      [ids, dateArr]
    );
    return (result.rows || []).map(r => ({ id: r.id, date: r.date }));
  }

  /**
   * Completa flujo_produccion / flujo_rechazo en una fila existente si estaban vacíos.
   * Usado por histórico Tuya cuando ya había totales/TDS en el mismo timestamp.
   * @returns {number} filas actualizadas
   */
  static async fillMissingFlujos(deviceIds, date, flujoProduccion, flujoRechazo) {
    if (!deviceIds?.length || !date) return 0;
    const hasProd = flujoProduccion != null && Number(flujoProduccion) !== 0;
    const hasRech = flujoRechazo != null && Number(flujoRechazo) !== 0;
    if (!hasProd && !hasRech) return 0;
    const ids = [...new Set(deviceIds.filter(Boolean).map(String))];
    const d = date instanceof Date ? date : new Date(date);
    const result = await query(
      `UPDATE product_logs
       SET flujo_produccion = CASE
             WHEN $3::numeric IS NOT NULL
              AND (flujo_produccion IS NULL OR flujo_produccion = 0)
             THEN $3 ELSE flujo_produccion END,
           flujo_rechazo = CASE
             WHEN $4::numeric IS NOT NULL
              AND (flujo_rechazo IS NULL OR flujo_rechazo = 0)
             THEN $4 ELSE flujo_rechazo END
       WHERE product_device_id = ANY($1::text[])
         AND date = $2
         AND (
           ($3::numeric IS NOT NULL AND (flujo_produccion IS NULL OR flujo_produccion = 0))
           OR ($4::numeric IS NOT NULL AND (flujo_rechazo IS NULL OR flujo_rechazo = 0))
         )`,
      [
        ids,
        d,
        hasProd ? Number(flujoProduccion) : null,
        hasRech ? Number(flujoRechazo) : null,
      ]
    );
    return result.rowCount || 0;
  }

  /**
   * Métricas globales en product_logs para los device_id del equipo (histórico hub / resumen).
   * @returns {{ log_count: number, min_date: Date|null, max_date: Date|null, distinct_calendar_days: number }}
   */
  static async getHistoricoSummaryForDeviceIds(deviceIds = []) {
    const ids = [...new Set((deviceIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) {
      return {
        log_count: 0,
        min_date: null,
        max_date: null,
        distinct_calendar_days: 0,
      };
    }
    const result = await query(
      `SELECT COUNT(*)::int AS log_count,
              MIN(date) AS min_date,
              MAX(date) AS max_date,
              COUNT(DISTINCT date::date)::int AS distinct_calendar_days
       FROM product_logs
       WHERE product_device_id = ANY($1::text[])`,
      [ids]
    );
    const row = result.rows?.[0];
    return {
      log_count: Number(row?.log_count) || 0,
      min_date: row?.min_date ?? null,
      max_date: row?.max_date ?? null,
      distinct_calendar_days: Number(row?.distinct_calendar_days) || 0,
    };
  }

  /** Conteo por día calendario en America/Hermosillo (evita que la tarde local cuente como “día UTC siguiente”). */
  static async getHistoricoDailyBreakdownForDeviceIds(deviceIds = []) {
    const ids = [...new Set((deviceIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return [];
    const result = await query(
      `SELECT (timezone('America/Hermosillo', date))::date AS day,
              COUNT(*)::int AS logs_count
       FROM product_logs
       WHERE product_device_id = ANY($1::text[])
       GROUP BY 1
       ORDER BY 1 DESC`,
      [ids]
    );
    return (result.rows || []).map((row) => ({
      day: row.day,
      logs_count: Number(row.logs_count) || 0,
    }));
  }

  static async getMaxVolumesByDeviceIds(deviceIds = []) {
    const ids = Array.from(new Set((deviceIds || []).filter(Boolean).map(String)));
    if (ids.length === 0) return new Map();
    const result = await query(
      `SELECT product_device_id,
              MAX(COALESCE(production_volume, 0)) AS max_production_volume,
              MAX(COALESCE(rejected_volume, 0))   AS max_rejected_volume
       FROM product_logs
       WHERE product_device_id = ANY($1::text[])
       GROUP BY product_device_id`,
      [ids]
    );
    const map = new Map();
    for (const row of result.rows || []) {
      map.set(String(row.product_device_id), {
        production_volume: Number(row.max_production_volume) || 0,
        rejected_volume: Number(row.max_rejected_volume) || 0,
      });
    }
    return map;
  }

  static async getMaxVolumesByProductIds(productIds = []) {
    const ids = Array.from(
      new Set(
        (productIds || [])
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0)
      )
    );
    if (ids.length === 0) return new Map();
    const result = await query(
      `SELECT product_id,
              MAX(COALESCE(production_volume, 0)) AS max_production_volume,
              MAX(COALESCE(rejected_volume, 0))   AS max_rejected_volume
       FROM product_logs
       WHERE product_id = ANY($1::bigint[])
       GROUP BY product_id`,
      [ids]
    );
    const map = new Map();
    for (const row of result.rows || []) {
      map.set(Number(row.product_id), {
        production_volume: Number(row.max_production_volume) || 0,
        rejected_volume: Number(row.max_rejected_volume) || 0,
      });
    }
    return map;
  }

  static parseRow(row) {
    if (!row) return null;
    let customMetrics = row.custom_metrics ?? null;
    if (typeof customMetrics === 'string') {
      try {
        customMetrics = JSON.parse(customMetrics);
      } catch {
        customMetrics = null;
      }
    }
    return {
      id: row.id,
      _id: String(row.id),
      producto: row.product_id,
      product_id: row.product_id != null ? row.product_id : row.product_device_id,
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
      date: row.date,
      custom_metrics: customMetrics,
      campo_personalizado_1: row.campo_personalizado_1 ?? null,
      campo_personalizado_2: row.campo_personalizado_2 ?? null,
    };
  }
}

export default ProductLogModel;
