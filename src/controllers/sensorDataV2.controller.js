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
    
    // Try to find by _id first, if that fails try by codigo_tienda
    let punto = null;
    
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    if (isObjectId) {
      // Try to find by MongoDB _id
      punto = await PuntoVenta.findById(id)
        .populate('cliente')
        .populate('city')
        .populate('productos')
        .populate('controladores');
    }
    
    // If not found by _id, try by codigo_tienda
    if (!punto) {
      punto = await PuntoVenta.findOne({ codigo_tienda: id.toUpperCase() })
        .populate('cliente')
        .populate('city')
        .populate('productos')
        .populate('controladores');
    }

    // If not found in MongoDB, try PostgreSQL
    let codigoTienda = null;
    let puntoFromPG = null;
    
    if (!punto) {
      // Try to find in PostgreSQL by code/codigo_tienda
      const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
      puntoFromPG = await PuntoVentaModel.findByCode(id);
      
      if (puntoFromPG) {
        codigoTienda = (puntoFromPG.code || puntoFromPG.codigo_tienda || id).toUpperCase();
        // Create minimal punto object from PostgreSQL data
        punto = {
          _id: `pg-${puntoFromPG.id}`,
          id: puntoFromPG.id,
          name: puntoFromPG.name || `Punto de Venta ${codigoTienda}`,
          codigo_tienda: codigoTienda,
          cliente: null,
          city: null,
          productos: [],
          controladores: [],
          online: false,
          toObject: function() {
            return {
              _id: this._id,
              id: this.id,
              name: this.name,
              codigo_tienda: this.codigo_tienda,
              cliente: this.cliente,
              city: this.city,
              productos: this.productos,
              controladores: this.controladores,
              online: this.online,
              // Add PostgreSQL fields
              owner: puntoFromPG.owner,
              clientId: puntoFromPG.clientId,
              status: puntoFromPG.status,
              lat: puntoFromPG.lat,
              long: puntoFromPG.long,
              address: puntoFromPG.address,
              contactId: puntoFromPG.contactId,
              createdAt: puntoFromPG.createdAt,
              updatedAt: puntoFromPG.updatedAt,
              meta: puntoFromPG.meta
            };
          }
        };
      }
    } else {
      codigoTienda = punto.codigo_tienda?.toUpperCase();
    }

    if (!punto || !codigoTienda) {
      return res.status(404).json({
        success: false,
        message: 'Punto de venta no encontrado'
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
        // First, let's check what sensors exist
        const checkSensorsQuery = `
          SELECT DISTINCT name, COUNT(*) as count
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = $2
            AND resourceid = $3
          GROUP BY name
        `;
        
        const checkResult = await query(checkSensorsQuery, [filters.codigoTienda, filters.resourceType, resourceId]);
        console.log(`[SensorDataV2] Available sensors for ${filters.codigoTienda}/${filters.resourceType}/${resourceId}:`, checkResult.rows);

        // Get latest sensor readings for this system
        const latestSensorsQuery = `
          SELECT DISTINCT ON (name) 
            name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda, label
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = $2
            AND resourceid = $3
          ORDER BY name, timestamp DESC
        `;

        const result = await query(latestSensorsQuery, [filters.codigoTienda, filters.resourceType, resourceId]);
        const sensors = result.rows || [];

        console.log(`[SensorDataV2] Found ${sensors.length} sensors for osmosis system ${resourceId} in ${filters.codigoTienda}`);
        console.log(`[SensorDataV2] Sensor names:`, sensors.map(s => s.name));

        // Map to osmosis format
        const osmosisData = {
          resourceId: resourceId,
          resourceType: 'osmosis',
          status: [],
          online: false,
          lastUpdate: null
        };

        sensors.forEach(sensor => {
          console.log(`[SensorDataV2] Processing sensor: ${sensor.name} = ${sensor.value}`);
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
      const matchingProduct = productos.find((p) => p.product_type === 'Osmosis');
      
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

    // Get nivel products from PostgreSQL (resourceType = 'nivel')
    const nivelProducts = [];
    const distinctNivelesQuery = `
      SELECT DISTINCT resourceid
      FROM sensores
      WHERE codigotienda = $1 
        AND resourcetype = 'nivel'
        AND resourceid IS NOT NULL
      ORDER BY resourceid
    `;

    const nivelesResult = await query(distinctNivelesQuery, [codigoTienda]);
    const nivelResourceIds = nivelesResult.rows.map(row => row.resourceid);

    // Get nivel data for each system with historical data
    for (const resourceId of nivelResourceIds) {
      try {
        // Get latest sensor reading
        const latestNivelQuery = `
          SELECT DISTINCT ON (name) 
            name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'nivel'
            AND resourceid = $2
            AND name = 'liquid_level_percent'
          ORDER BY name, timestamp DESC
          LIMIT 1
        `;

        const latestResult = await query(latestNivelQuery, [codigoTienda, resourceId]);
        const latestSensor = latestResult.rows[0];

        if (!latestSensor) continue;

        // Get historical data for the last 24 hours (grouped by hour)
        const historicoQuery = `
          SELECT 
            DATE_TRUNC('hour', timestamp) AS hora,
            AVG(value) AS liquid_level_percent_promedio,
            COUNT(*) AS total_logs
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'nivel'
            AND resourceid = $2
            AND name = 'liquid_level_percent'
            AND timestamp >= NOW() - INTERVAL '24 hours'
          GROUP BY DATE_TRUNC('hour', timestamp)
          ORDER BY hora ASC
        `;

        const historicoResult = await query(historicoQuery, [codigoTienda, resourceId]);
        const hoursWithData = historicoResult.rows.map(row => ({
          hora: new Date(row.hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          total_logs: parseInt(row.total_logs),
          estadisticas: {
            liquid_level_percent_promedio: parseFloat(row.liquid_level_percent_promedio) || 0
          }
        }));

        const nivelData = {
          _id: `nivel-${resourceId}`,
          id: resourceId,
          name: `Nivel ${resourceId}`,
          product_type: 'Nivel',
          status: [{
            code: 'liquid_level_percent',
            value: parseFloat(latestSensor.value) || 0,
            label: 'Nivel',
            unit: '%',
            timestamp: latestSensor.timestamp
          }],
          online: true,
          historico: {
            product: `Nivel ${resourceId}`,
            date: new Date().toISOString().split('T')[0],
            total_logs: hoursWithData.reduce((sum, h) => sum + h.total_logs, 0),
            hours_with_data: hoursWithData
          }
        };

        nivelProducts.push(nivelData);
      } catch (error) {
        console.error(`[SensorDataV2] Error getting nivel ${resourceId}:`, error);
      }
    }

    // Get metricas (agua cruda y recuperación)
    const metricaProducts = [];
    const distinctMetricasQuery = `
      SELECT DISTINCT resourceid
      FROM sensores
      WHERE codigotienda = $1 
        AND resourcetype = 'metrica'
        AND resourceid IS NOT NULL
      ORDER BY resourceid
    `;

    const metricasResult = await query(distinctMetricasQuery, [codigoTienda]);
    const metricaResourceIds = metricasResult.rows.map(row => row.resourceid);

    for (const resourceId of metricaResourceIds) {
      try {
        const latestMetricaQuery = `
          SELECT DISTINCT ON (name) 
            name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda, label
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'metrica'
            AND resourceid = $2
            AND name = 'liquid_level_percent'
          ORDER BY name, timestamp DESC
          LIMIT 1
        `;

        const latestResult = await query(latestMetricaQuery, [codigoTienda, resourceId]);
        const latestSensor = latestResult.rows[0];

        if (!latestSensor) continue;

        const metricaData = {
          _id: `metrica-${resourceId}`,
          id: resourceId,
          name: latestSensor.label || `Métrica ${resourceId}`,
          product_type: 'Metrica',
          status: [{
            code: 'liquid_level_percent',
            value: parseFloat(latestSensor.value) || 0,
            label: latestSensor.label || 'Nivel',
            unit: '%',
            timestamp: latestSensor.timestamp
          }],
          online: true
        };

        metricaProducts.push(metricaData);
      } catch (error) {
        console.error(`[SensorDataV2] Error getting metrica ${resourceId}:`, error);
      }
    }

    // Combine all products
    const allProductos = [
      ...productos.filter((p) => p.product_type !== 'Osmosis' && p.product_type !== 'Nivel' && p.product_type !== 'Metrica'),
      ...osmosisProducts,
      ...nivelProducts,
      ...metricaProducts
    ];

    // Determine if punto is online (check controllers or osmosis systems)
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    
    const tieneControladorOnline = punto.controladores?.some(
      (ctrl) => ctrl.last_time_active && (now - ctrl.last_time_active * 1000 <= ONLINE_THRESHOLD_MS)
    );

    const tieneOsmosisOnline = osmosisSystems.some((osmosis) => osmosis.online);

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

