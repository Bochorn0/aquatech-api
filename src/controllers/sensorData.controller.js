// src/controllers/sensorData.controller.js
// Controller for sensor data - PostgreSQL only (MongoDB removed)

import { query } from '../config/postgres.config.js';

// Get latest timestamp from sensores for codigo_tienda (frontend uses this for "last data" display)
export const getLatestSensorData = async (req, res) => {
  try {
    const { codigo_tienda, equipo_id, punto_venta_id, gateway_id, controller_id } = req.query;

    if (!codigo_tienda) {
      return res.status(400).json({
        success: false,
        message: 'codigo_tienda is required'
      });
    }

    const codigoNorm = codigo_tienda.toString().trim().toUpperCase();

    const result = await query(
      `SELECT timestamp, codigotienda as codigo_tienda
       FROM sensores
       WHERE UPPER(TRIM(codigotienda)) = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [codigoNorm]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos de sensores'
      });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        timestamp: row.timestamp,
        codigo_tienda: row.codigo_tienda || codigoNorm
      }
    });
  } catch (error) {
    console.error('Error al obtener último dato de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener último dato de sensores',
      error: error.message
    });
  }
};

// Get sensor data with filters (PostgreSQL)
export const getSensorData = async (req, res) => {
  try {
    const {
      codigo_tienda,
      equipo_id,
      startDate,
      endDate,
      limit = 100,
      page = 1
    } = req.query;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (codigo_tienda) {
      whereClause += ` AND UPPER(TRIM(codigotienda)) = $${paramIndex}`;
      values.push(codigo_tienda.toUpperCase());
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(endDate));
      paramIndex++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const dataResult = await query(
      `SELECT * FROM sensores
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM sensores WHERE ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0]?.count || 0);

    res.json({
      success: true,
      data: dataResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        value: r.value,
        type: r.type,
        timestamp: r.timestamp,
        codigo_tienda: r.codigotienda,
        resourceType: r.resourcetype,
        resourceId: r.resourceid
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener datos de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores',
      error: error.message
    });
  }
};

// Get sensor statistics (PostgreSQL aggregation)
export const getSensorStatistics = async (req, res) => {
  try {
    const { codigo_tienda, startDate, endDate } = req.query;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (codigo_tienda) {
      whereClause += ` AND UPPER(TRIM(codigotienda)) = $${paramIndex}`;
      values.push(codigo_tienda.toUpperCase());
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(endDate));
      paramIndex++;
    }

    const result = await query(
      `SELECT
         AVG(CASE WHEN type = 'flujo_produccion' THEN value::float END) as avg_flujo_produccion,
         AVG(CASE WHEN type = 'flujo_rechazo' THEN value::float END) as avg_flujo_rechazo,
         AVG(CASE WHEN type = 'tds' THEN value::float END) as avg_tds,
         AVG(CASE WHEN type IN ('electronivel_purificada','nivel_purificada') THEN value::float END) as avg_electronivel_purificada,
         AVG(CASE WHEN type IN ('electronivel_recuperada','nivel_recuperada') THEN value::float END) as avg_electronivel_recuperada,
         AVG(CASE WHEN type = 'presion_in' THEN value::float END) as avg_presion_in,
         AVG(CASE WHEN type = 'presion_out' THEN value::float END) as avg_presion_out,
         COUNT(*) as count
       FROM sensores
       WHERE ${whereClause}`,
      values
    );

    const row = result.rows[0] || {};
    res.json({
      success: true,
      data: {
        avg_flujo_produccion: row.avg_flujo_produccion ? parseFloat(row.avg_flujo_produccion) : null,
        avg_flujo_rechazo: row.avg_flujo_rechazo ? parseFloat(row.avg_flujo_rechazo) : null,
        avg_tds: row.avg_tds ? parseFloat(row.avg_tds) : null,
        avg_electronivel_purificada: row.avg_electronivel_purificada ? parseFloat(row.avg_electronivel_purificada) : null,
        avg_electronivel_recuperada: row.avg_electronivel_recuperada ? parseFloat(row.avg_electronivel_recuperada) : null,
        avg_presion_in: row.avg_presion_in ? parseFloat(row.avg_presion_in) : null,
        avg_presion_out: row.avg_presion_out ? parseFloat(row.avg_presion_out) : null,
        count: parseInt(row.count || 0)
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de sensores',
      error: error.message
    });
  }
};

// Get sensor data by tienda and equipo
export const getSensorDataByTiendaEquipo = async (req, res) => {
  try {
    const { codigo_tienda, equipo_id } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    let whereClause = 'UPPER(TRIM(codigotienda)) = $1';
    const values = [codigo_tienda.toUpperCase()];
    let paramIndex = 2;

    if (equipo_id) {
      whereClause += ` AND (resourceid = $${paramIndex} OR resourceid IS NULL)`;
      values.push(equipo_id);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(endDate));
      paramIndex++;
    }

    const result = await query(
      `SELECT * FROM sensores WHERE ${whereClause}
       ORDER BY timestamp DESC LIMIT $${paramIndex}`,
      [...values, parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener datos de sensores por tienda/equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por tienda/equipo',
      error: error.message
    });
  }
};

// Get sensor data by tienda
export const getSensorDataByTienda = async (req, res) => {
  try {
    const { codigo_tienda } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    let whereClause = 'UPPER(TRIM(codigotienda)) = $1';
    const values = [codigo_tienda.toUpperCase()];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(endDate));
      paramIndex++;
    }

    const result = await query(
      `SELECT * FROM sensores WHERE ${whereClause}
       ORDER BY timestamp DESC LIMIT $${paramIndex}`,
      [...values, parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener datos de sensores por tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por tienda',
      error: error.message
    });
  }
};

// Get sensor data by gateway (legacy - map to resourceId if needed)
export const getSensorDataByGateway = async (req, res) => {
  try {
    const { gateway_id } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    // gateway_id may map to resourceId in sensores
    if (gateway_id) {
      whereClause += ` AND resourceid = $${paramIndex}`;
      values.push(gateway_id);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      values.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      values.push(new Date(endDate));
      paramIndex++;
    }

    const result = await query(
      `SELECT * FROM sensores WHERE ${whereClause}
       ORDER BY timestamp DESC LIMIT $${paramIndex}`,
      [...values, parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener datos de sensores por gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por gateway',
      error: error.message
    });
  }
};
