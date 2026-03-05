// src/models/postgres/puntoVentaV1.model.js
// V1: Punto de venta for equipos/products matching and metrics (separate from V2 MQTT/sensors)

import { query } from '../../config/postgres.config.js';

class PuntoVentaV1Model {
  static async findById(id) {
    const result = await query(
      'SELECT * FROM puntoventa_v1 WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  /** Find puntoventa_v1 by puntoventa (V2) id - for metrics mapping */
  static async findByPuntoventaId(puntoventaId) {
    if (puntoventaId == null) return null;
    const id = parseInt(String(puntoventaId), 10);
    if (isNaN(id)) return null;
    const result = await query(
      'SELECT * FROM puntoventa_v1 WHERE puntoventa_id = $1 LIMIT 1',
      [id]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByCode(code) {
    if (!code) return null;
    const result = await query(
      'SELECT * FROM puntoventa_v1 WHERE LOWER(code) = LOWER($1) OR LOWER(codigo_tienda) = LOWER($1) LIMIT 1',
      [String(code).trim()]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async find(filters = {}, options = {}) {
    const { limit = 1000, offset = 0 } = options;
    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.clientId) {
      whereClause += ` AND clientid = $${paramIndex}`;
      values.push(filters.clientId);
      paramIndex++;
    }
    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    values.push(limit, offset);
    const result = await query(
      `SELECT * FROM puntoventa_v1 WHERE ${whereClause} ORDER BY createdat DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );
    return (result.rows || []).map((row) => this.parseRow(row));
  }

  static async create(data) {
    const {
      name,
      code,
      codigo_tienda,
      clientId,
      address,
      lat,
      long,
      status,
      owner,
      contactId,
      meta,
      puntoventaId
    } = data;

    const searchCode = (code || codigo_tienda || '').trim().toUpperCase() || `PV1-${Date.now()}`;
    const result = await query(
      `INSERT INTO puntoventa_v1 (name, code, codigo_tienda, clientid, address, lat, long, status, owner, contactid, meta, puntoventa_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name || null,
        searchCode,
        codigo_tienda || searchCode,
        clientId || null,
        address || null,
        lat != null ? parseFloat(lat) : null,
        long != null ? parseFloat(long) : null,
        status || 'active',
        owner || null,
        contactId || null,
        meta ? JSON.stringify(meta) : null,
        puntoventaId || null
      ]
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async update(id, data) {
    const {
      name,
      clientId,
      status,
      lat,
      long,
      address,
      contactId,
      meta,
      codigo_tienda,
      code
    } = data;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = COALESCE($${paramIndex}, name)`);
      values.push(name);
      paramIndex++;
    }
    if (clientId !== undefined) {
      updates.push(`clientid = COALESCE($${paramIndex}, clientid)`);
      values.push(clientId);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = COALESCE($${paramIndex}, status)`);
      values.push(status);
      paramIndex++;
    }
    if (lat !== undefined) {
      updates.push(`lat = $${paramIndex}`);
      values.push(lat != null ? parseFloat(lat) : null);
      paramIndex++;
    }
    if (long !== undefined) {
      updates.push(`long = $${paramIndex}`);
      values.push(long != null ? parseFloat(long) : null);
      paramIndex++;
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
    }
    if (contactId !== undefined) {
      updates.push(`contactid = COALESCE($${paramIndex}, contactid)`);
      values.push(contactId);
      paramIndex++;
    }
    if (meta !== undefined) {
      updates.push(`meta = $${paramIndex}`);
      values.push(meta ? JSON.stringify(meta) : null);
      paramIndex++;
    }
    if (codigo_tienda !== undefined) {
      updates.push(`codigo_tienda = $${paramIndex}`);
      values.push(codigo_tienda);
      paramIndex++;
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      values.push(code);
      paramIndex++;
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE puntoventa_v1 SET ${updates.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM puntoventa_v1 WHERE id = $1 RETURNING id', [id]);
    return result.rows?.length > 0;
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : null,
      name: row.name || null,
      code: row.code || null,
      codigo_tienda: row.codigo_tienda || row.code || null,
      createdAt: row.createdat || null,
      updatedAt: row.updatedat || null,
      owner: row.owner || null,
      clientId: row.clientid || null,
      status: row.status || null,
      lat: row.lat != null ? parseFloat(row.lat) : null,
      long: row.long != null ? parseFloat(row.long) : null,
      address: row.address || null,
      contactId: row.contactid || null,
      meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
      puntoventaId: row.puntoventa_id ? String(row.puntoventa_id) : null
    };
  }
}

export default PuntoVentaV1Model;
