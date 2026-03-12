// sensores = detail table (id, sensores_message_id, name, type, value). Join sensores_message for timestamp, codigotienda, etc.

import { query } from '../../config/postgres.config.js';

const JOIN_MSG = `FROM sensores s INNER JOIN sensores_message m ON s.sensores_message_id = m.id`;

function buildWhere(filters, values, paramIndex) {
  let where = '1=1';
  if (filters.codigoTienda) {
    where += ` AND m.codigotienda = $${paramIndex}`;
    values.push(filters.codigoTienda);
    paramIndex++;
  }
  if (filters.resourceId) {
    where += ` AND m.resourceid = $${paramIndex}`;
    values.push(filters.resourceId);
    paramIndex++;
  }
  if (filters.resourceType) {
    where += ` AND m.resourcetype = $${paramIndex}`;
    values.push(filters.resourceType);
    paramIndex++;
  }
  if (filters.clientId) {
    where += ` AND m.clientid = $${paramIndex}`;
    values.push(filters.clientId);
    paramIndex++;
  }
  if (filters.type) {
    where += ` AND s.type = $${paramIndex}`;
    values.push(filters.type);
    paramIndex++;
  }
  if (filters.status) {
    where += ` AND m.meta->>'status' = $${paramIndex}`;
    values.push(filters.status);
    paramIndex++;
  }
  if (filters.startDate) {
    where += ` AND m.timestamp >= $${paramIndex}`;
    values.push(new Date(filters.startDate));
    paramIndex++;
  }
  if (filters.endDate) {
    where += ` AND m.timestamp <= $${paramIndex}`;
    values.push(new Date(filters.endDate));
    paramIndex++;
  }
  return { where, paramIndex };
}

function parseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    value: row.value !== null ? parseFloat(row.value) : null,
    type: row.type,
    timestamp: row.timestamp,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
    resourceId: row.resourceid,
    resourceType: row.resourcetype,
    clientId: row.clientid,
    status: row.status ?? null,
    label: row.label ?? null,
    lat: row.lat != null ? parseFloat(row.lat) : null,
    long: row.long != null ? parseFloat(row.long) : null,
    codigoTienda: row.codigotienda,
    meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
  };
}

class SensoresModel {
  static async create(data) {
    throw new Error('SensoresModel.create: use SensoresMessageModel.createMessage + createDetails for new schema');
  }

  static async createMany(dataArray) {
    throw new Error('SensoresModel.createMany: use SensoresMessageModel.createMessage + createDetails for new schema');
  }

  static async find(filters = {}, options = {}) {
    const { limit = 100, offset = 0, orderBy = 'm.timestamp DESC' } = options;
    const values = [];
    let paramIndex = 1;
    const { where, paramIndex: next } = buildWhere(filters, values, paramIndex);
    paramIndex = next;
    const sql = `
      SELECT s.id, s.name, s.type, s.value, s.sensores_message_id,
             m.timestamp, m.createdat, m.updatedat, m.codigotienda, m.clientid,
             m.resourceid, m.resourcetype, m.lat, m.long, m.meta
      ${JOIN_MSG}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);
    const result = await query(sql, values);
    return result.rows.map((row) => parseRow(row));
  }

  static async findById(id) {
    const result = await query(
      `SELECT s.id, s.name, s.type, s.value, s.sensores_message_id,
              m.timestamp, m.createdat, m.updatedat, m.codigotienda, m.clientid,
              m.resourceid, m.resourcetype, m.lat, m.long, m.meta
       ${JOIN_MSG}
       WHERE s.id = $1`,
      [id]
    );
    return result.rows.length > 0 ? parseRow(result.rows[0]) : null;
  }

  static async findLatest(filters = {}) {
    const results = await this.find(filters, { limit: 1, orderBy: 'm.timestamp DESC' });
    return results.length > 0 ? results[0] : null;
  }

  static async count(filters = {}) {
    const values = [];
    let paramIndex = 1;
    const { where } = buildWhere(filters, values, paramIndex);
    const result = await query(
      `SELECT COUNT(*) AS count ${JOIN_MSG} WHERE ${where}`,
      values
    );
    return parseInt(result.rows[0].count, 10);
  }

  static parseRow(row) {
    return parseRow(row);
  }
}

export default SensoresModel;
