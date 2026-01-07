// src/controllers/sensorDataV2.controller.js
// Controller for v2.0 API endpoints using PostgreSQL sensores table

import SensoresModel from '../models/postgres/sensores.model.js';
import { query } from '../config/postgres.config.js';

/**
 * Get osmosis system data for a punto de venta
 * Maps PostgreSQL sensor data to osmosis system format (similar to v1.0)
 */
export const getOsmosisSystemByPuntoVenta = async (req, res) => {
  try {
    const { codigoTienda, resourceId } = req.query;

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'codigoTienda is required'
      });
    }

    // Build filters
    const filters = {
      codigoTienda: codigoTienda.toUpperCase(),
      resourceType: 'osmosis'
    };

    if (resourceId) {
      filters.resourceId = resourceId;
    }

    // Get latest sensor readings grouped by sensor name
    const sensorNames = ['flujo_produccion', 'flujo_rechazo', 'tds', 'electronivel_purificada', 'electronivel_recuperada', 'presion_in', 'presion_out'];
    
    // Query to get latest value for each sensor type
    const latestSensorsQuery = `
      SELECT DISTINCT ON (name) 
        name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda
      FROM sensores
      WHERE codigotienda = $1 
        AND resourcetype = $2
        ${resourceId ? 'AND resourceid = $3' : ''}
      ORDER BY name, timestamp DESC
    `;

    const params = resourceId 
      ? [filters.codigoTienda, filters.resourceType, resourceId]
      : [filters.codigoTienda, filters.resourceType];

    const result = await query(latestSensorsQuery, params);
    const sensors = result.rows || [];

    // Map sensor data to osmosis system format
    const osmosisData = {
      codigoTienda: filters.codigoTienda,
      resourceId: resourceId || null,
      resourceType: 'osmosis',
      status: [],
      online: false,
      lastUpdate: null
    };

    // Map sensor values to status array format (similar to v1.0)
    sensors.forEach(sensor => {
      let code = '';
      let label = sensor.label || sensor.name;
      
      // Map sensor names to status codes (matching v1.0 format)
      switch (sensor.name) {
        case 'flujo_produccion':
          code = 'flowrate_speed_1';  // Flow speed production
          label = 'Flujo Producción';
          break;
        case 'flujo_rechazo':
          code = 'flowrate_speed_2';  // Flow speed rejection
          label = 'Flujo Rechazo';
          break;
        case 'tds':
          code = 'tds_out';  // TDS output
          label = 'TDS';
          break;
        case 'electronivel_purificada':
          code = 'level_purificada';  // Purified water level
          label = 'Nivel Purificada';
          break;
        case 'electronivel_recuperada':
          code = 'level_recuperada';  // Recovered water level
          label = 'Nivel Recuperada';
          break;
        case 'presion_in':
          code = 'pressure_in';  // Input pressure
          label = 'Presión Entrada';
          break;
        case 'presion_out':
          code = 'pressure_out';  // Output pressure
          label = 'Presión Salida';
          break;
        default:
          code = sensor.name;
      }

      osmosisData.status.push({
        code,
        value: parseFloat(sensor.value) || 0,
        label,
        unit: sensor.meta?.unit || getUnitForSensor(sensor.name),
        timestamp: sensor.timestamp
      });

      // Update last update time
      if (!osmosisData.lastUpdate || new Date(sensor.timestamp) > new Date(osmosisData.lastUpdate)) {
        osmosisData.lastUpdate = sensor.timestamp;
      }
    });

    // Check if system is online (last update within 5 minutes)
    const now = new Date();
    const lastUpdate = osmosisData.lastUpdate ? new Date(osmosisData.lastUpdate) : null;
    osmosisData.online = lastUpdate && (now - lastUpdate < 5 * 60 * 1000);

    res.json({
      success: true,
      data: osmosisData
    });

  } catch (error) {
    console.error('[SensorDataV2] Error getting osmosis system:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting osmosis system data',
      error: error.message
    });
  }
};

/**
 * Get punto de venta detail with osmosis system data from PostgreSQL
 */
export const getPuntoVentaDetalleV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Import PuntoVenta model (MongoDB)
    const PuntoVenta = (await import('../models/puntoVenta.model.js')).default;
    
    // Get punto de venta from MongoDB
    const punto = await PuntoVenta.findById(id)
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    if (!punto) {
      return res.status(404).json({
        success: false,
        message: 'Punto de venta no encontrado'
      });
    }

    const codigoTienda = punto.codigo_tienda?.toUpperCase();

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'Punto de venta no tiene codigo_tienda configurado'
      });
    }

    // Get osmosis systems from PostgreSQL
    const osmosisSystems = [];

    // Query to get distinct osmosis systems (by resourceId)
    const distinctSystemsQuery = `
      SELECT DISTINCT resourceid, resourceid
      FROM sensores
      WHERE codigotienda = $1 
        AND resourcetype = 'osmosis'
        AND resourceid IS NOT NULL
      ORDER BY resourceid
    `;

    const systemsResult = await query(distinctSystemsQuery, [codigoTienda]);
    const resourceIds = systemsResult.rows.map(row => row.resourceid);

    // Get osmosis data for each system
    for (const resourceId of resourceIds) {
      try {
        // Build filters
        const filters = {
          codigoTienda: codigoTienda,
          resourceType: 'osmosis',
          resourceId: resourceId
        };

        // Get latest sensor readings for this system
        const latestSensorsQuery = `
          SELECT DISTINCT ON (name) 
            name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = $2
            AND resourceid = $3
          ORDER BY name, timestamp DESC
        `;

        const result = await query(latestSensorsQuery, [filters.codigoTienda, filters.resourceType, resourceId]);
        const sensors = result.rows || [];

        // Map to osmosis format
        const osmosisData = {
          resourceId: resourceId,
          resourceType: 'osmosis',
          status: [],
          online: false,
          lastUpdate: null
        };

        sensors.forEach(sensor => {
          let code = '';
          let label = sensor.label || sensor.name;
          
          switch (sensor.name) {
            case 'flujo_produccion':
              code = 'flowrate_speed_1';
              label = 'Flujo Producción';
              break;
            case 'flujo_rechazo':
              code = 'flowrate_speed_2';
              label = 'Flujo Rechazo';
              break;
            case 'tds':
              code = 'tds_out';
              label = 'TDS';
              break;
            case 'electronivel_purificada':
              code = 'level_purificada';
              label = 'Nivel Purificada';
              break;
            case 'electronivel_recuperada':
              code = 'level_recuperada';
              label = 'Nivel Recuperada';
              break;
            case 'presion_in':
              code = 'pressure_in';
              label = 'Presión Entrada';
              break;
            case 'presion_out':
              code = 'pressure_out';
              label = 'Presión Salida';
              break;
            default:
              code = sensor.name;
          }

          osmosisData.status.push({
            code,
            value: parseFloat(sensor.value) || 0,
            label,
            unit: sensor.meta?.unit || getUnitForSensor(sensor.name),
            timestamp: sensor.timestamp
          });

          if (!osmosisData.lastUpdate || new Date(sensor.timestamp) > new Date(osmosisData.lastUpdate)) {
            osmosisData.lastUpdate = sensor.timestamp;
          }
        });

        const now = new Date();
        const lastUpdate = osmosisData.lastUpdate ? new Date(osmosisData.lastUpdate) : null;
        osmosisData.online = lastUpdate && (now - lastUpdate < 5 * 60 * 1000);

        osmosisSystems.push(osmosisData);
      } catch (error) {
        console.error(`[SensorDataV2] Error getting osmosis system ${resourceId}:`, error);
      }
    }

    // If no osmosis systems found, still return punto data
    // Map osmosis systems to products format
    const productos = punto.productos || [];
    const osmosisProducts = osmosisSystems.map((osmosis, index) => {
      // Find matching product or create new structure
      const matchingProduct = productos.find((p: any) => p.product_type === 'Osmosis');
      
      return {
        _id: matchingProduct?._id || `osmosis-${index}`,
        id: osmosis.resourceId || `osmosis-${index}`,
        name: matchingProduct?.name || `Sistema Osmosis ${index + 1}`,
        product_type: 'Osmosis',
        status: osmosis.status || [],
        online: osmosis.online || false,
        lastUpdate: osmosis.lastUpdate
      };
    });

    // Combine with existing products
    const allProductos = [...productos.filter((p: any) => p.product_type !== 'Osmosis'), ...osmosisProducts];

    // Determine if punto is online (check controllers or osmosis systems)
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    
    const tieneControladorOnline = punto.controladores?.some(
      (ctrl: any) => ctrl.last_time_active && (now - ctrl.last_time_active * 1000 <= ONLINE_THRESHOLD_MS)
    );

    const tieneOsmosisOnline = osmosisSystems.some((osmosis: any) => osmosis.online);

    const safePunto = {
      ...punto.toObject(),
      productos: allProductos,
      osmosisSystems,
      online: tieneControladorOnline || tieneOsmosisOnline
    };

    res.json({
      success: true,
      data: safePunto
    });

  } catch (error) {
    console.error('[SensorDataV2] Error getting punto venta detalle:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting punto de venta detail',
      error: error.message
    });
  }
};

/**
 * Get sensor time series data for charts
 */
export const getSensorTimeSeries = async (req, res) => {
  try {
    const { codigoTienda, resourceId, sensorName, startDate, endDate, interval = '1 hour' } = req.query;

    if (!codigoTienda || !sensorName) {
      return res.status(400).json({
        success: false,
        message: 'codigoTienda and sensorName are required'
      });
    }

    // Build query for time series aggregation (TimescaleDB)
    let timeSeriesQuery = `
      SELECT 
        time_bucket($1::interval, timestamp) AS time_bucket,
        AVG(value) AS avg_value,
        MIN(value) AS min_value,
        MAX(value) AS max_value,
        COUNT(*) AS count
      FROM sensores
      WHERE codigotienda = $2
        AND name = $3
        AND resourcetype = 'osmosis'
    `;

    const params = [interval, codigoTienda.toUpperCase(), sensorName];
    let paramIndex = 4;

    if (resourceId) {
      timeSeriesQuery += ` AND resourceid = $${paramIndex}`;
      params.push(resourceId);
      paramIndex++;
    }

    if (startDate) {
      timeSeriesQuery += ` AND timestamp >= $${paramIndex}`;
      params.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      timeSeriesQuery += ` AND timestamp <= $${paramIndex}`;
      params.push(new Date(endDate));
      paramIndex++;
    }

    timeSeriesQuery += `
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
      LIMIT 1000
    `;

    const result = await query(timeSeriesQuery, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('[SensorDataV2] Error getting time series:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sensor time series',
      error: error.message
    });
  }
};

/**
 * Helper function to get unit for sensor
 */
function getUnitForSensor(sensorName) {
  const units = {
    'flujo_produccion': 'L/min',
    'flujo_rechazo': 'L/min',
    'tds': 'ppm',
    'electronivel_purificada': '%',
    'electronivel_recuperada': '%',
    'presion_in': 'PSI',
    'presion_out': 'PSI'
  };
  return units[sensorName] || '';
}

