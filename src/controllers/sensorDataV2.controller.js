// src/controllers/sensorDataV2.controller.js
// Controller for v2.0 API endpoints using PostgreSQL sensores table

import SensoresModel from '../models/postgres/sensores.model.js';
import { query } from '../config/postgres.config.js';
import ClientModel from '../models/postgres/client.model.js';

/**
 * Genera el histórico diario de un producto tipo Nivel basándose en registros acumulados
 * Agrupa por día y toma el último valor registrado de cada día
 * 
 * @param {string} codigoTienda - Código de la tienda
 * @param {string} resourceId - ID del recurso (producto)
 * @param {string} sensorName - Nombre del sensor (default: 'liquid_level_percent')
 * @param {number} daysBack - Número de días hacia atrás desde hoy (default: 30)
 * @param {string} resourceType - Tipo de recurso: 'nivel' o 'tiwater' (default: 'nivel')
 * @returns {Promise<Object|null>} Objeto con el histórico diario o null si hay error
 */
export async function generateNivelHistoricoDiarioV2(codigoTienda, resourceId, sensorName = 'liquid_level_percent', daysBack = 30, resourceType = 'nivel') {
  try {
    // Determinar el tipo de recurso primero
    const isTiwater = resourceType === 'tiwater' || resourceId === 'tiwater-system';
    
    // Calcular fecha de inicio (días hacia atrás desde hoy)
    // Usar el último registro disponible como referencia si no hay datos del día actual
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    // Primero verificar si hay registros y determinar si usar timestamp o createdat como fallback
    // Verificar si timestamp es válido (no fechas muy lejanas)
    const checkQuery = isTiwater 
      ? `SELECT COUNT(*) as count, 
         MIN(createdat) as min_created, MAX(createdat) as max_created,
         MIN(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as min_timestamp,
         MAX(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as max_timestamp
         FROM sensores 
         WHERE codigotienda = $1 AND resourcetype = 'tiwater' AND (resourceid IS NULL OR resourceid = 'tiwater-system') AND name = $2`
      : `SELECT COUNT(*) as count,
         MIN(createdat) as min_created, MAX(createdat) as max_created,
         MIN(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as min_timestamp,
         MAX(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as max_timestamp
         FROM sensores 
         WHERE codigotienda = $1 AND resourcetype = 'nivel' AND resourceid = $2 AND name = $3`;
    
    const checkParams = isTiwater ? [codigoTienda, sensorName] : [codigoTienda, resourceId, sensorName];
    const checkResult = await query(checkQuery, checkParams);
    
    if (checkResult.rows.length === 0 || parseInt(checkResult.rows[0].count) === 0) {
      console.log(`[generateNivelHistoricoDiarioV2] No hay registros disponibles para ${codigoTienda}/${resourceId}/${sensorName}`);
      return null;
    }
    
    const minCreated = checkResult.rows[0].min_created ? new Date(checkResult.rows[0].min_created) : null;
    const maxCreated = checkResult.rows[0].max_created ? new Date(checkResult.rows[0].max_created) : null;
    const minTimestamp = checkResult.rows[0].min_timestamp ? new Date(checkResult.rows[0].min_timestamp) : null;
    const maxTimestamp = checkResult.rows[0].max_timestamp ? new Date(checkResult.rows[0].max_timestamp) : null;
    
    // Determinar si usar timestamp o createdat como fallback
    const useTimestamp = maxTimestamp && maxTimestamp.getFullYear() >= 2000 && maxTimestamp.getFullYear() <= 3000;
    const dateField = useTimestamp ? 'timestamp' : 'createdat';
    const maxDate = useTimestamp ? maxTimestamp : maxCreated;
    
    console.log(`[generateNivelHistoricoDiarioV2] Datos disponibles: ${checkResult.rows[0].count} registros`);
    console.log(`[generateNivelHistoricoDiarioV2] Usando campo: ${dateField} (timestamp válido: ${useTimestamp})`);
    console.log(`[generateNivelHistoricoDiarioV2] Rango: ${minCreated?.toISOString()} hasta ${maxCreated?.toISOString()}`);
    if (useTimestamp) {
      console.log(`[generateNivelHistoricoDiarioV2] Timestamp válido: ${minTimestamp?.toISOString()} hasta ${maxTimestamp?.toISOString()}`);
    }
    
    // Usar la fecha del último registro como referencia
    if (maxDate) {
      endDate.setTime(maxDate.getTime());
      endDate.setHours(23, 59, 59, 999);
      startDate.setTime(endDate.getTime());
      startDate.setDate(startDate.getDate() - daysBack);
      startDate.setHours(0, 0, 0, 0);
      console.log(`[generateNivelHistoricoDiarioV2] Usando fecha del último registro (${dateField}): ${maxDate.toISOString()}`);
    }

    // Construir la consulta SQL para obtener el histórico diario
    let historicoQuery;
    let queryParams;
    
    if (isTiwater) {
      // Para TIWater, buscar en resourcetype = 'tiwater' con resourceId NULL o 'tiwater-system'
      // Usar timestamp si es válido, sino usar createdat como fallback
      const timestampFilter = useTimestamp ? "AND (timestamp IS NULL OR EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000)" : "";
      // Construir consulta dinámicamente reemplazando ${dateField} con el nombre del campo
      historicoQuery = `
        WITH daily_data AS (
          SELECT 
            DATE_TRUNC('day', ` + dateField + `) AS dia,
            value,
            ` + dateField + ` as fecha,
            ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('day', ` + dateField + `) ORDER BY ` + dateField + ` DESC) AS rn
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'tiwater'
            AND (resourceid IS NULL OR resourceid = 'tiwater-system')
            AND name = $2
            AND ` + dateField + ` >= $3
            AND ` + dateField + ` <= $4
            ` + timestampFilter + `
        ),
        daily_stats AS (
          SELECT 
            dia,
            value AS liquid_level_percent_promedio,
            (SELECT COUNT(*) 
             FROM sensores 
             WHERE codigotienda = $1 
               AND resourcetype = 'tiwater'
               AND (resourceid IS NULL OR resourceid = 'tiwater-system')
               AND name = $2
               AND DATE_TRUNC('day', ` + dateField + `) = daily_data.dia
               AND ` + dateField + ` >= $3
               AND ` + dateField + ` <= $4
               ` + timestampFilter + `) AS total_logs
          FROM daily_data
          WHERE rn = 1
        )
        SELECT 
          dia,
          liquid_level_percent_promedio,
          total_logs
        FROM daily_stats
        ORDER BY dia ASC
      `;
      queryParams = [codigoTienda, sensorName, startDate, endDate];
    } else {
      // Para Nivel, buscar en resourcetype = 'nivel' con resourceId específico
      // Usar timestamp si es válido, sino usar createdat como fallback
      const timestampFilter = useTimestamp ? "AND (timestamp IS NULL OR EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000)" : "";
      // Construir consulta dinámicamente reemplazando ${dateField} con el nombre del campo
      historicoQuery = `
        WITH daily_data AS (
          SELECT 
            DATE_TRUNC('day', ` + dateField + `) AS dia,
            value,
            ` + dateField + ` as fecha,
            ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('day', ` + dateField + `) ORDER BY ` + dateField + ` DESC) AS rn
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'nivel'
            AND resourceid = $2
            AND name = $3
            AND ` + dateField + ` >= $4
            AND ` + dateField + ` <= $5
            ` + timestampFilter + `
        ),
        daily_stats AS (
          SELECT 
            dia,
            value AS liquid_level_percent_promedio,
            (SELECT COUNT(*) 
             FROM sensores 
             WHERE codigotienda = $1 
               AND resourcetype = 'nivel'
               AND resourceid = $2
               AND name = $3
               AND DATE_TRUNC('day', ` + dateField + `) = daily_data.dia
               AND ` + dateField + ` >= $4
               AND ` + dateField + ` <= $5
               ` + timestampFilter + `) AS total_logs
          FROM daily_data
          WHERE rn = 1
        )
        SELECT 
          dia,
          liquid_level_percent_promedio,
          total_logs
        FROM daily_stats
        ORDER BY dia ASC
      `;
      queryParams = [codigoTienda, resourceId, sensorName, startDate, endDate];
    }

    console.log(`[generateNivelHistoricoDiarioV2] Ejecutando consulta para ${codigoTienda}/${resourceId}/${sensorName}:`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      resourceType: isTiwater ? 'tiwater' : 'nivel',
      queryParams
    });

    const historicoResult = await query(historicoQuery, queryParams);
    
    console.log(`[generateNivelHistoricoDiarioV2] Resultado de consulta: ${historicoResult.rows.length} filas encontradas`);
    
    const daysWithData = historicoResult.rows.map(row => ({
      fecha: new Date(row.dia).toISOString().split('T')[0], // Formato YYYY-MM-DD
      total_logs: parseInt(row.total_logs) || 0,
      estadisticas: {
        liquid_level_percent_promedio: parseFloat(row.liquid_level_percent_promedio) || 0
      }
    }));

    const totalLogs = daysWithData.reduce((sum, d) => sum + d.total_logs, 0);

    console.log(`[generateNivelHistoricoDiarioV2] Histórico diario generado: ${daysWithData.length} días, ${totalLogs} registros totales`);

    return {
      product: `Nivel ${resourceId}`,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_logs: totalLogs,
      days_with_data: daysWithData
    };

  } catch (error) {
    console.error(`[generateNivelHistoricoDiarioV2] Error generando histórico diario para ${codigoTienda}/${resourceId}:`, error);
    return null;
  }
}

/**
 * Genera el histórico de un producto tipo Nivel basándose en registros acumulados del día actual
 * Agrupa por hora y toma el último valor registrado de cada hora
 * 
 * @param {string} codigoTienda - Código de la tienda
 * @param {string} resourceId - ID del recurso (producto)
 * @param {string} sensorName - Nombre del sensor (default: 'liquid_level_percent')
 * @param {Date} date - Fecha para generar el histórico (default: hoy)
 * @param {string} resourceType - Tipo de recurso: 'nivel' o 'tiwater' (default: 'nivel')
 * @returns {Promise<Object|null>} Objeto con el histórico o null si hay error
 */
export async function generateNivelHistoricoV2(codigoTienda, resourceId, sensorName = 'liquid_level_percent', date = null, resourceType = 'nivel') {
  try {
    // Determinar el tipo de recurso y condiciones de búsqueda primero
    const isTiwater = resourceType === 'tiwater' || resourceId === 'tiwater-system';
    
    // Primero verificar si hay registros y determinar si usar timestamp o createdat como fallback
    const checkQuery = isTiwater 
      ? `SELECT COUNT(*) as count, 
         MAX(createdat) as max_created,
         MAX(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as max_timestamp
         FROM sensores 
         WHERE codigotienda = $1 AND resourcetype = 'tiwater' AND (resourceid IS NULL OR resourceid = 'tiwater-system') AND name = $2`
      : `SELECT COUNT(*) as count,
         MAX(createdat) as max_created,
         MAX(CASE WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 THEN timestamp ELSE NULL END) as max_timestamp
         FROM sensores 
         WHERE codigotienda = $1 AND resourcetype = 'nivel' AND resourceid = $2 AND name = $3`;
    
    const checkParams = isTiwater ? [codigoTienda, sensorName] : [codigoTienda, resourceId, sensorName];
    const checkResult = await query(checkQuery, checkParams);
    
    if (checkResult.rows.length === 0 || parseInt(checkResult.rows[0].count) === 0) {
      console.log(`[generateNivelHistoricoV2] No hay registros disponibles para ${codigoTienda}/${resourceId}/${sensorName}`);
      return null;
    }
    
    const maxCreated = checkResult.rows[0].max_created ? new Date(checkResult.rows[0].max_created) : null;
    const maxTimestamp = checkResult.rows[0].max_timestamp ? new Date(checkResult.rows[0].max_timestamp) : null;
    
    // Determinar si usar timestamp o createdat como fallback
    const useTimestamp = maxTimestamp && maxTimestamp.getFullYear() >= 2000 && maxTimestamp.getFullYear() <= 3000;
    const dateField = useTimestamp ? 'timestamp' : 'createdat';
    const maxDate = useTimestamp ? maxTimestamp : maxCreated;
    
    // Usar la fecha del último registro como referencia
    let targetDate = date;
    if (!targetDate && maxDate) {
      // Si no se proporciona fecha, usar el día del último registro disponible
      targetDate = new Date(maxDate);
    } else if (!targetDate) {
      targetDate = new Date();
    }
    
    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`[generateNivelHistoricoV2] Usando campo: ${dateField} (timestamp válido: ${useTimestamp})`);
    console.log(`[generateNivelHistoricoV2] Usando rango de fechas: ${today.toISOString()} a ${tomorrow.toISOString()} (último registro ${dateField}: ${maxDate?.toISOString()})`);
    
    let historicoQuery;
    let queryParams;
    
    if (isTiwater) {
      // Para TIWater, buscar en resourcetype = 'tiwater' con resourceId NULL o 'tiwater-system'
      // Usar timestamp si es válido, sino usar createdat como fallback
      const timestampFilter = useTimestamp ? "AND (timestamp IS NULL OR EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000)" : "";
      // Construir consulta dinámicamente reemplazando ${dateField} con el nombre del campo
      historicoQuery = `
        WITH hourly_data AS (
          SELECT 
            DATE_TRUNC('hour', ` + dateField + `) AS hora,
            value,
            ` + dateField + ` as fecha,
            ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('hour', ` + dateField + `) ORDER BY ` + dateField + ` DESC) AS rn
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'tiwater'
            AND (resourceid IS NULL OR resourceid = 'tiwater-system')
            AND name = $2
            AND ` + dateField + ` >= $3
            AND ` + dateField + ` < $4
            ` + timestampFilter + `
        ),
        hourly_stats AS (
          SELECT 
            hora,
            value AS liquid_level_percent_promedio,
            (SELECT COUNT(*) 
             FROM sensores 
             WHERE codigotienda = $1 
               AND resourcetype = 'tiwater'
               AND (resourceid IS NULL OR resourceid = 'tiwater-system')
               AND name = $2
               AND DATE_TRUNC('hour', ` + dateField + `) = hourly_data.hora
               AND ` + dateField + ` >= $3
               AND ` + dateField + ` < $4
               ` + timestampFilter + `) AS total_logs
          FROM hourly_data
          WHERE rn = 1
        )
        SELECT 
          hora,
          liquid_level_percent_promedio,
          total_logs
        FROM hourly_stats
        ORDER BY hora ASC
      `;
      queryParams = [codigoTienda, sensorName, today, tomorrow];
    } else {
      // Para Nivel, buscar en resourcetype = 'nivel' con resourceId específico
      // Usar timestamp si es válido, sino usar createdat como fallback
      const timestampFilter = useTimestamp ? "AND (timestamp IS NULL OR EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000)" : "";
      // Construir consulta dinámicamente reemplazando ${dateField} con el nombre del campo
      historicoQuery = `
        WITH hourly_data AS (
          SELECT 
            DATE_TRUNC('hour', ` + dateField + `) AS hora,
            value,
            ` + dateField + ` as fecha,
            ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('hour', ` + dateField + `) ORDER BY ` + dateField + ` DESC) AS rn
          FROM sensores
          WHERE codigotienda = $1 
            AND resourcetype = 'nivel'
            AND resourceid = $2
            AND name = $3
            AND ` + dateField + ` >= $4
            AND ` + dateField + ` < $5
            ` + timestampFilter + `
        ),
        hourly_stats AS (
          SELECT 
            hora,
            value AS liquid_level_percent_promedio,
            (SELECT COUNT(*) 
             FROM sensores 
             WHERE codigotienda = $1 
               AND resourcetype = 'nivel'
               AND resourceid = $2
               AND name = $3
               AND DATE_TRUNC('hour', ` + dateField + `) = hourly_data.hora
               AND ` + dateField + ` >= $4
               AND ` + dateField + ` < $5
               ` + timestampFilter + `) AS total_logs
          FROM hourly_data
          WHERE rn = 1
        )
        SELECT 
          hora,
          liquid_level_percent_promedio,
          total_logs
        FROM hourly_stats
        ORDER BY hora ASC
      `;
      queryParams = [codigoTienda, resourceId, sensorName, today, tomorrow];
    }

    console.log(`[generateNivelHistoricoV2] Ejecutando consulta para ${codigoTienda}/${resourceId}/${sensorName}:`, {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      resourceType: isTiwater ? 'tiwater' : 'nivel',
      queryParams
    });

    const historicoResult = await query(historicoQuery, queryParams);
    
    console.log(`[generateNivelHistoricoV2] Resultado de consulta: ${historicoResult.rows.length} filas encontradas`);
    
    const hoursWithData = historicoResult.rows.map(row => ({
      hora: new Date(row.hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      total_logs: parseInt(row.total_logs) || 0,
      estadisticas: {
        liquid_level_percent_promedio: parseFloat(row.liquid_level_percent_promedio) || 0
      }
    }));

    const totalLogs = hoursWithData.reduce((sum, h) => sum + h.total_logs, 0);

    console.log(`[generateNivelHistoricoV2] Histórico por hora generado: ${hoursWithData.length} horas, ${totalLogs} registros totales`);

    return {
      product: `Nivel ${resourceId}`,
      date: today.toISOString().split('T')[0],
      total_logs: totalLogs,
      hours_with_data: hoursWithData
    };

  } catch (error) {
    console.error(`[generateNivelHistoricoV2] Error generando histórico para ${codigoTienda}/${resourceId}:`, error);
    return null;
  }
}

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
/**
 * Get all puntos de venta (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/puntoVentas/all
 * @desc    Get all puntos de venta from PostgreSQL
 * @access  Private
 */
export const getPuntosVentaV2 = async (req, res) => {
  try {
    console.log('Fetching Puntos de Venta from PostgreSQL (v2.0)...');

    // Import PostgreSQL PuntoVenta model
    const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;

    // Get all puntos de venta from PostgreSQL
    const puntosPG = await PuntoVentaModel.find({}, { limit: 1000, offset: 0 });

    // Check online status by querying sensors table for recent data
    // A punto de venta is online if it has sensor data in the last 5 minutes
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const thresholdTime = new Date(now.getTime() - ONLINE_THRESHOLD_MS);

    // Get online status for each punto de venta and fetch client data
    const puntosConEstado = await Promise.all(
      puntosPG.map(async (pv) => {
        let online = false;
        
        // Check if there are recent sensor readings for this punto de venta
        if (pv.codigo_tienda || pv.code) {
          const codigoTienda = (pv.codigo_tienda || pv.code).toUpperCase();
          try {
            const onlineCheckQuery = `
              SELECT COUNT(*) as count
              FROM sensores
              WHERE codigotienda = $1
                AND createdat >= $2
              LIMIT 1
            `;
            const onlineResult = await query(onlineCheckQuery, [codigoTienda, thresholdTime]);
            online = onlineResult.rows.length > 0 && parseInt(onlineResult.rows[0].count) > 0;
          } catch (error) {
            console.warn(`[getPuntosVentaV2] Error checking online status for ${codigoTienda}:`, error.message);
          }
        }

        // Fetch client data if clientId exists
        let clienteData = null;
        if (pv.clientId) {
          try {
            const clientId = typeof pv.clientId === 'string' 
              ? parseInt(pv.clientId, 10) 
              : pv.clientId;
            if (!isNaN(clientId)) {
              clienteData = await ClientModel.findById(clientId);
            }
          } catch (error) {
            console.warn(`[getPuntosVentaV2] Error fetching client ${pv.clientId}:`, error.message);
          }
        }

        // Parse address if it's a JSON string
        let addressObj = null;
        if (pv.address) {
          try {
            addressObj = typeof pv.address === 'string' ? JSON.parse(pv.address) : pv.address;
          } catch (e) {
            // If parsing fails, treat as plain string or object
            addressObj = pv.address;
          }
        }

        // Try to fetch city data from cities table if address has city/state
        let cityData = null;
        if (addressObj && addressObj.city && addressObj.state) {
          try {
            const CityModel = (await import('../models/postgres/city.model.js')).default;
            cityData = await CityModel.findByStateAndCity(addressObj.state, addressObj.city);
          } catch (error) {
            console.warn(`[getPuntosVentaV2] Error fetching city for ${pv.id}:`, error.message);
          }
        }

        // Transform PostgreSQL format to MongoDB-compatible format
        return {
          _id: String(pv.id), // Use id as _id for compatibility (convert to string)
          id: String(pv.id),
          name: pv.name || 'Sin nombre',
          codigo_tienda: pv.codigo_tienda || pv.code || null,
          cliente: clienteData ? {
            _id: String(clienteData.id),
            id: String(clienteData.id),
            name: clienteData.name || null,
            email: clienteData.email || null,
            phone: clienteData.phone || null
          } : null,
          city: cityData ? {
            _id: String(cityData.id),
            id: String(cityData.id),
            city: cityData.city || null,
            state: cityData.state || null,
            lat: cityData.lat || pv.lat || null,
            lon: cityData.lon || pv.long || null
          } : (addressObj ? {
            _id: null,
            city: addressObj.city || null,
            state: addressObj.state || null,
            lat: pv.lat || addressObj.lat || null,
            lon: pv.long || addressObj.lon || null
          } : {
            _id: null,
            city: null,
            state: null,
            lat: pv.lat || null,
            lon: pv.long || null
          }),
          address: addressObj || null,
          productos: [], // Products would need to be queried separately if needed
          controladores: [], // Controllers would need to be queried separately if needed
          online: online,
          status: pv.status || 'active',
          owner: pv.owner || null,
          clientId: pv.clientId ? String(pv.clientId) : null,
          lat: pv.lat || null,
          long: pv.long || null,
          contactId: pv.contactId ? String(pv.contactId) : null,
          meta: pv.meta || null,
          createdAt: pv.createdAt || null,
          updatedAt: pv.updatedAt || null
        };
      })
    );

    console.log(`[getPuntosVentaV2] ✅ Found ${puntosConEstado.length} puntos de venta from PostgreSQL`);
    res.json(puntosConEstado);
  } catch (error) {
    console.error('Error fetching puntos de venta from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching puntos de venta',
      error: error.message 
    });
  }
};

export const getPuntoVentaDetalleV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Import PostgreSQL PuntoVenta model first (v2.0 uses PostgreSQL)
    const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
    
    let puntoFromPG = null;
    let codigoTienda = null;
    
    // Check if id is numeric (PostgreSQL ID)
    const isNumericId = /^\d+$/.test(id);
    
    if (isNumericId) {
      // Try to find by PostgreSQL numeric ID first
      puntoFromPG = await PuntoVentaModel.findById(parseInt(id, 10));
    }
    
    // If not found by ID, try by codigo_tienda
    if (!puntoFromPG) {
      puntoFromPG = await PuntoVentaModel.findByCode(id);
    }
    
    if (puntoFromPG) {
      codigoTienda = (puntoFromPG.code || puntoFromPG.codigo_tienda || id).toUpperCase();
    } else {
      // If not found in PostgreSQL, return 404
      return res.status(404).json({
        success: false,
        message: 'Punto de venta no encontrado'
      });
    }
    
    // Fetch client data if clientId exists
    let clienteData = null;
    if (puntoFromPG.clientId) {
      try {
        const clientId = typeof puntoFromPG.clientId === 'string' 
          ? parseInt(puntoFromPG.clientId, 10) 
          : puntoFromPG.clientId;
        if (!isNaN(clientId)) {
          clienteData = await ClientModel.findById(clientId);
        }
      } catch (error) {
        console.warn(`[getPuntoVentaDetalleV2] Error fetching client ${puntoFromPG.clientId}:`, error.message);
      }
    }

    // Fetch city data from address or try to match by lat/long
    let cityData = null;
    try {
      // Try to parse address to get city/state
      let addressObj = null;
      if (puntoFromPG.address) {
        try {
          addressObj = typeof puntoFromPG.address === 'string' 
            ? JSON.parse(puntoFromPG.address) 
            : puntoFromPG.address;
        } catch (e) {
          addressObj = null;
        }
      }
      
      // If address has city and state, try to find matching city
      if (addressObj && addressObj.city && addressObj.state) {
        const CityModel = (await import('../models/postgres/city.model.js')).default;
        cityData = await CityModel.findByStateAndCity(addressObj.state, addressObj.city);
      }
      
      // If not found and we have lat/long, we could try to find closest city, but for now just use address data
      if (!cityData && addressObj) {
        cityData = {
          city: addressObj.city || null,
          state: addressObj.state || null,
          lat: addressObj.lat || puntoFromPG.lat || null,
          lon: addressObj.lon || puntoFromPG.long || null
        };
      }
    } catch (error) {
      console.warn(`[getPuntoVentaDetalleV2] Error fetching city:`, error.message);
    }

    // Create punto object from PostgreSQL data
    const punto = {
      _id: String(puntoFromPG.id),
      id: String(puntoFromPG.id),
      name: puntoFromPG.name || `Punto de Venta ${codigoTienda}`,
      codigo_tienda: codigoTienda,
      cliente: clienteData ? {
        _id: String(clienteData.id),
        id: String(clienteData.id),
        name: clienteData.name || null,
        email: clienteData.email || null,
        phone: clienteData.phone || null
      } : null,
      city: cityData ? {
        _id: cityData.id ? String(cityData.id) : null,
        id: cityData.id ? String(cityData.id) : null,
        city: cityData.city || null,
        state: cityData.state || null,
        lat: cityData.lat || null,
        lon: cityData.lon || null
      } : null,
      productos: [],
      controladores: [],
      online: false,
      owner: puntoFromPG.owner,
      clientId: puntoFromPG.clientId,
      status: puntoFromPG.status,
      lat: puntoFromPG.lat,
      long: puntoFromPG.long,
      address: puntoFromPG.address,
      contactId: puntoFromPG.contactId,
      createdAt: puntoFromPG.createdAt,
      updatedAt: puntoFromPG.updatedAt,
      meta: puntoFromPG.meta,
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
          owner: this.owner,
          clientId: this.clientId,
          status: this.status,
          lat: this.lat,
          long: this.long,
          address: this.address,
          contactId: this.contactId,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
          meta: this.meta
        };
      }
    };

    // Get osmosis systems from PostgreSQL (including tiwater systems)
    const osmosisSystems = [];

    // Query to get distinct osmosis/tiwater systems (by resourceId)
    // Include both 'osmosis' and 'tiwater' resource types
    // For tiwater, resourceId might be NULL, so we'll treat all tiwater sensors as one system
    const distinctSystemsQuery = `
      SELECT DISTINCT 
        COALESCE(resourceid, 'tiwater-system') as resourceid,
        resourcetype
      FROM sensores
      WHERE codigotienda = $1 
        AND (resourcetype = 'osmosis' OR resourcetype = 'tiwater')
      ORDER BY resourcetype, resourceid
    `;

    const systemsResult = await query(distinctSystemsQuery, [codigoTienda]);
    const systemRows = systemsResult.rows || [];
    
    // If no systems found but we have tiwater data, create a default system entry
    if (systemRows.length === 0) {
      const hasTiwaterData = await query(
        `SELECT COUNT(*) as count FROM sensores WHERE codigotienda = $1 AND resourcetype = 'tiwater'`,
        [codigoTienda]
      );
      if (hasTiwaterData.rows[0]?.count > 0) {
        systemRows.push({ resourceid: 'tiwater-system', resourcetype: 'tiwater' });
      }
    }

    // Get osmosis/tiwater data for each system
    for (const row of systemRows) {
      const resourceId = row.resourceid;
      const resourceType = row.resourcetype || 'osmosis';
      
      try {
        // Build filters
        const filters = {
          codigoTienda: codigoTienda,
          resourceType: resourceType,
          resourceId: resourceId
        };

        // Get latest sensor readings for this system
        // First, let's check what sensors exist
        let checkSensorsQuery;
        let checkParams;
        
        if (resourceId === 'tiwater-system' && resourceType === 'tiwater') {
          checkSensorsQuery = `
            SELECT DISTINCT name, COUNT(*) as count
            FROM sensores
            WHERE codigotienda = $1 
              AND resourcetype = $2
              AND (resourceid IS NULL OR resourceid = 'tiwater-system')
            GROUP BY name
          `;
          checkParams = [filters.codigoTienda, filters.resourceType];
        } else {
          checkSensorsQuery = `
            SELECT DISTINCT name, COUNT(*) as count
            FROM sensores
            WHERE codigotienda = $1 
              AND resourcetype = $2
              AND resourceid = $3
            GROUP BY name
          `;
          checkParams = [filters.codigoTienda, filters.resourceType, resourceId];
        }
        
        const checkResult = await query(checkSensorsQuery, checkParams);
        console.log(`[SensorDataV2] Available sensors for ${filters.codigoTienda}/${filters.resourceType}/${resourceId}:`, checkResult.rows);

        // Get latest sensor readings for this system
        // Handle NULL resourceId for tiwater systems
        let latestSensorsQuery;
        let queryParams;
        
        if (resourceId === 'tiwater-system' && resourceType === 'tiwater') {
          // For tiwater systems without resourceId, search for NULL resourceId
          latestSensorsQuery = `
            SELECT DISTINCT ON (name) 
              name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda, label
            FROM sensores
            WHERE codigotienda = $1 
              AND resourcetype = $2
              AND (resourceid IS NULL OR resourceid = 'tiwater-system')
            ORDER BY name, timestamp DESC
          `;
          queryParams = [filters.codigoTienda, filters.resourceType];
        } else {
          latestSensorsQuery = `
            SELECT DISTINCT ON (name) 
              name, value, type, timestamp, meta, resourceid, resourcetype, codigotienda, label
            FROM sensores
            WHERE codigotienda = $1 
              AND resourcetype = $2
              AND resourceid = $3
            ORDER BY name, timestamp DESC
          `;
          queryParams = [filters.codigoTienda, filters.resourceType, resourceId];
        }

        const result = await query(latestSensorsQuery, queryParams);
        const sensors = result.rows || [];

        console.log(`[SensorDataV2] Found ${sensors.length} sensors for osmosis system ${resourceId} in ${filters.codigoTienda}`);
        console.log(`[SensorDataV2] Sensor names:`, sensors.map(s => s.name));
        console.log(`[SensorDataV2] Sensor types:`, sensors.map(s => s.type));
        console.log(`[SensorDataV2] All sensor details:`, sensors.map(s => ({ name: s.name, type: s.type, value: s.value })));
        
        // Check specifically for current sensors
        const currentSensors = sensors.filter(s => 
          s.name?.toLowerCase().includes('corriente') || 
          s.type?.toLowerCase().includes('corriente') ||
          s.name === 'ch1' || s.name === 'ch2' || s.name === 'ch3' || s.name === 'ch4' ||
          s.type === 'ch1' || s.type === 'ch2' || s.type === 'ch3' || s.type === 'ch4'
        );
        if (currentSensors.length > 0) {
          console.log(`[SensorDataV2] ⚡ Found ${currentSensors.length} current sensors:`, currentSensors.map(s => ({ name: s.name, type: s.type, value: s.value })));
        } else {
          console.log(`[SensorDataV2] ⚠️ No current sensors found in database for ${filters.codigoTienda}`);
        }

        // Map to osmosis format (works for both osmosis and tiwater)
        const osmosisData = {
          resourceId: resourceId || 'tiwater-system',
          resourceType: resourceType,
          status: [],
          online: false,
          lastUpdate: null
        };

        sensors.forEach(sensor => {
          console.log(`[SensorDataV2] Processing sensor: name="${sensor.name}", type="${sensor.type}", value=${sensor.value}`);
          let code = '';
          let label = sensor.label || sensor.name;
          
          // Map sensor names to status codes (supporting both osmosis and tiwater formats)
          // Note: sensor.name is the label stored in DB (e.g., "Corriente Canal 1")
          // sensor.type is the type code (e.g., "corriente_ch1")
          const sensorName = sensor.name || sensor.type || '';
          const sensorType = sensor.type || '';
          
          // Debug: Log specifically for current sensors
          if (sensorName.toLowerCase().includes('corriente') || sensorType.toLowerCase().includes('corriente') || 
              sensorName === 'ch1' || sensorName === 'ch2' || sensorName === 'ch3' || sensorName === 'ch4' ||
              sensorType === 'ch1' || sensorType === 'ch2' || sensorType === 'ch3' || sensorType === 'ch4') {
            console.log(`[SensorDataV2] ⚡ Processing current sensor: name="${sensorName}", type="${sensorType}"`);
          }
          
          // Try to match by name (label) first, then by type
          switch (sensorName) {
            case 'Flujo Producción':
            case 'flujo_produccion':
              code = 'flowrate_speed_1';
              label = 'Flujo Producción';
              break;
            case 'Flujo Rechazo':
            case 'flujo_rechazo':
              code = 'flowrate_speed_2';
              label = 'Flujo Rechazo';
              break;
            case 'Flujo Recuperación':
            case 'flujo_recuperacion':
              code = 'flowrate_recuperacion';
              label = 'Flujo Recuperación';
              break;
            case 'TDS':
            case 'tds':
              code = 'tds_out';
              label = 'TDS';
              break;
            case 'Nivel Purificada':
            case 'electronivel_purificada':
              code = 'level_purificada';
              label = 'Nivel Purificada';
              break;
            case 'Nivel Recuperada':
            case 'electronivel_recuperada':
              code = 'level_recuperada';
              label = 'Nivel Recuperada';
              break;
            case 'Nivel Purificada (absoluto)':
            case 'nivel_purificada':
              code = 'nivel_purificada_absoluto';
              label = 'Nivel Purificada (absoluto)';
              break;
            case 'Nivel Cruda':
            case 'nivel_cruda':
              code = 'nivel_cruda_absoluto';
              label = 'Nivel Cruda (absoluto)';
              break;
            case 'Caudal Cruda':
            case 'caudal_cruda':
              code = 'caudal_cruda';
              label = 'Caudal Cruda';
              break;
            case 'Caudal Cruda (L/min)':
            case 'caudal_cruda_lmin':
              code = 'caudal_cruda_lmin';
              label = 'Caudal Cruda (L/min)';
              break;
            case 'Acumulado Cruda':
            case 'acumulado_cruda':
              code = 'acumulado_cruda';
              label = 'Acumulado Cruda';
              break;
            case 'Presión Entrada':
            case 'presion_in':
            case 'pressure_in':
              code = 'pressure_in';
              label = 'Presión Entrada';
              break;
            case 'Presión Salida':
            case 'presion_out':
            case 'pressure_out':
              code = 'pressure_out';
              label = 'Presión Salida';
              break;
            case 'Presión CO2':
            case 'presion_co2':
              code = 'presion_co2';
              label = 'Presión CO2';
              break;
            case 'Eficiencia':
            case 'eficiencia':
              code = 'eficiencia';
              label = 'Eficiencia';
              break;
            case 'Vida':
            case 'Vida del Sistema':
            case 'vida':
              code = 'vida';
              label = 'Vida del Sistema';
              break;
            case 'Corriente Canal 1':
            case 'corriente_ch1':
              code = 'corriente_ch1';
              label = 'Corriente Canal 1';
              break;
            case 'Corriente Canal 2':
            case 'corriente_ch2':
              code = 'corriente_ch2';
              label = 'Corriente Canal 2';
              break;
            case 'Corriente Canal 3':
            case 'corriente_ch3':
              code = 'corriente_ch3';
              label = 'Corriente Canal 3';
              break;
            case 'Corriente Canal 4':
            case 'corriente_ch4':
              code = 'corriente_ch4';
              label = 'Corriente Canal 4';
              break;
            case 'Corriente Total':
            case 'corriente_total':
              code = 'corriente_total';
              label = 'Corriente Total';
              break;
            default:
              // Try to match by type if name didn't match
              switch (sensorType) {
                case 'flujo_produccion':
                  code = 'flowrate_speed_1';
                  label = 'Flujo Producción';
                  break;
                case 'flujo_rechazo':
                  code = 'flowrate_speed_2';
                  label = 'Flujo Rechazo';
                  break;
                case 'flujo_recuperacion':
                  code = 'flowrate_recuperacion';
                  label = 'Flujo Recuperación';
                  break;
                case 'corriente_ch1':
                  code = 'corriente_ch1';
                  label = 'Corriente Canal 1';
                  break;
                case 'corriente_ch2':
                  code = 'corriente_ch2';
                  label = 'Corriente Canal 2';
                  break;
                case 'corriente_ch3':
                  code = 'corriente_ch3';
                  label = 'Corriente Canal 3';
                  break;
                case 'corriente_ch4':
                  code = 'corriente_ch4';
                  label = 'Corriente Canal 4';
                  break;
                case 'corriente_total':
                  code = 'corriente_total';
                  label = 'Corriente Total';
                  break;
                default:
                  code = sensorName || sensorType || 'unknown';
              }
          }

          // Get unit based on the mapped code/name
          const unit = sensor.meta?.unit || getUnitForSensor(code) || getUnitForSensor(sensorName) || getUnitForSensor(sensorType);
          
          // Fix timestamp if it's invalid (check for weird years)
          let timestamp = sensor.timestamp;
          let validTimestamp = true;
          if (timestamp) {
            try {
              const date = new Date(timestamp);
              // If year is way off (like 57992), use current time instead
              if (isNaN(date.getTime()) || date.getFullYear() > 3000 || date.getFullYear() < 2000) {
                console.warn(`[SensorDataV2] Invalid timestamp detected: ${timestamp}, using current time`);
                timestamp = new Date().toISOString();
                validTimestamp = false;
              }
            } catch (e) {
              console.warn(`[SensorDataV2] Error parsing timestamp: ${timestamp}, using current time`);
              timestamp = new Date().toISOString();
              validTimestamp = false;
            }
          } else {
            timestamp = new Date().toISOString();
            validTimestamp = false;
          }

          // Debug: Log if this is a current sensor
          if (code.includes('corriente') || code.includes('ch1') || code.includes('ch2') || code.includes('ch3') || code.includes('ch4')) {
            console.log(`[SensorDataV2] ⚡ Adding current sensor to status: code="${code}", label="${label}", value=${sensor.value}`);
          }

          osmosisData.status.push({
            code,
            value: parseFloat(sensor.value) || 0,
            label,
            unit: unit,
            timestamp: timestamp
          });

          // Update lastUpdate only if timestamp is valid
          if (validTimestamp && timestamp) {
            try {
              const sensorDate = new Date(timestamp);
              if (!osmosisData.lastUpdate || sensorDate > new Date(osmosisData.lastUpdate)) {
                osmosisData.lastUpdate = timestamp;
              }
            } catch (e) {
              // Ignore timestamp comparison errors
            }
          }
        });

        const now = new Date();
        const lastUpdate = osmosisData.lastUpdate ? new Date(osmosisData.lastUpdate) : null;
        osmosisData.online = lastUpdate && (now - lastUpdate < 5 * 60 * 1000);

        // Para productos TIWater, agregar histórico de niveles si tienen datos de nivel
        if (resourceType === 'tiwater' && resourceId) {
          // Verificar si tiene datos de nivel (Nivel Purificada o Nivel Recuperada)
          const nivelCodes = osmosisData.status?.map(s => s.code) || [];
          const hasNivelPurificada = osmosisData.status?.some(s => s.code === 'level_purificada' || s.code === 'electronivel_purificada');
          const hasNivelRecuperada = osmosisData.status?.some(s => s.code === 'level_recuperada' || s.code === 'electronivel_recuperada');
          
          console.log(`[SensorDataV2] Verificando histórico para TIWater ${resourceId} en osmosisSystems:`, {
            hasNivelPurificada,
            hasNivelRecuperada,
            nivelCodes: nivelCodes.filter(c => c.includes('nivel') || c.includes('level')),
            statusCount: osmosisData.status?.length || 0
          });
          
          // Generar histórico para "Nivel Purificada" si existe
          if (hasNivelPurificada) {
            console.log(`[SensorDataV2] Generando histórico para TIWater ${resourceId} en osmosisSystems (Nivel Purificada)`);
            
            try {
              const [historicoHora, historicoDiario] = await Promise.all([
                generateNivelHistoricoV2(codigoTienda, resourceId, 'Nivel Purificada', null, 'tiwater'),
                generateNivelHistoricoDiarioV2(codigoTienda, resourceId, 'Nivel Purificada', 30, 'tiwater')
              ]);
              
              if (historicoHora || historicoDiario) {
                osmosisData.historico = historicoHora || null;
                osmosisData.historico_diario = historicoDiario || null;
                console.log(`📊 [SensorDataV2] Histórico agregado a osmosisSystems para TIWater ${resourceId} (Nivel Purificada): ${historicoHora?.hours_with_data?.length || 0} horas, ${historicoDiario?.days_with_data?.length || 0} días`);
              } else {
                console.warn(`⚠️ [SensorDataV2] No se generó histórico para TIWater ${resourceId} en osmosisSystems (Nivel Purificada) - ambos históricos son null`);
              }
            } catch (error) {
              console.error(`[SensorDataV2] Error generando histórico para TIWater ${resourceId} en osmosisSystems (Nivel Purificada):`, error);
            }
          }
          
          // Generar histórico para "Nivel Recuperada" si existe
          if (hasNivelRecuperada) {
            console.log(`[SensorDataV2] Generando histórico para TIWater ${resourceId} en osmosisSystems (Nivel Recuperada)`);
            
            try {
              const [historicoHoraRecuperada, historicoDiarioRecuperada] = await Promise.all([
                generateNivelHistoricoV2(codigoTienda, resourceId, 'Nivel Recuperada', null, 'tiwater'),
                generateNivelHistoricoDiarioV2(codigoTienda, resourceId, 'Nivel Recuperada', 30, 'tiwater')
              ]);
              
              if (historicoHoraRecuperada || historicoDiarioRecuperada) {
                osmosisData.historico_recuperada = historicoHoraRecuperada || null;
                osmosisData.historico_recuperada_diario = historicoDiarioRecuperada || null;
                console.log(`📊 [SensorDataV2] Histórico agregado a osmosisSystems para TIWater ${resourceId} (Nivel Recuperada): ${historicoHoraRecuperada?.hours_with_data?.length || 0} horas, ${historicoDiarioRecuperada?.days_with_data?.length || 0} días`);
              } else {
                console.warn(`⚠️ [SensorDataV2] No se generó histórico para TIWater ${resourceId} en osmosisSystems (Nivel Recuperada) - ambos históricos son null`);
              }
            } catch (error) {
              console.error(`[SensorDataV2] Error generando histórico para TIWater ${resourceId} en osmosisSystems (Nivel Recuperada):`, error);
            }
          }
          
          // Si no tiene ninguno de los dos, usar el fallback antiguo
          if (!hasNivelPurificada && !hasNivelRecuperada) {
            console.log(`[SensorDataV2] TIWater ${resourceId} en osmosisSystems no tiene datos de nivel para generar histórico`);
          }
        }

        osmosisSystems.push(osmosisData);
      } catch (error) {
        console.error(`[SensorDataV2] Error getting osmosis system ${resourceId}:`, error);
      }
    }

    // If no osmosis/tiwater systems found, still return punto data
    // Map osmosis/tiwater systems to products format
    const productos = punto.productos || [];
    const osmosisProducts = await Promise.all(osmosisSystems.map(async (osmosis, index) => {
      // Find matching product or create new structure
      const matchingProduct = productos.find((p) => p.product_type === 'Osmosis' || p.product_type === 'TIWater');
      
      // Determine product type based on resourceType
      const productType = osmosis.resourceType === 'tiwater' ? 'TIWater' : 'Osmosis';
      const defaultName = osmosis.resourceType === 'tiwater' 
        ? `Sistema TIWater ${index + 1}` 
        : `Sistema Osmosis ${index + 1}`;
      
      // Para productos TIWater, agregar histórico de niveles si tienen datos de nivel
      let historicoHora = null;
      let historicoDiario = null;
      let historicoHoraRecuperada = null;
      let historicoDiarioRecuperada = null;
      
      if (productType === 'TIWater' && osmosis.resourceId) {
        // Verificar si tiene datos de nivel (Nivel Purificada o Nivel Recuperada)
        const nivelCodes = osmosis.status?.map(s => s.code) || [];
        const hasNivelPurificada = osmosis.status?.some(s => s.code === 'level_purificada' || s.code === 'electronivel_purificada');
        const hasNivelRecuperada = osmosis.status?.some(s => s.code === 'level_recuperada' || s.code === 'electronivel_recuperada');
        
        console.log(`[SensorDataV2] Verificando histórico para TIWater ${osmosis.resourceId}:`, {
          hasNivelPurificada,
          hasNivelRecuperada,
          nivelCodes: nivelCodes.filter(c => c.includes('nivel') || c.includes('level')),
          statusCount: osmosis.status?.length || 0
        });
        
        // Generar histórico para "Nivel Purificada" si existe
        if (hasNivelPurificada) {
          console.log(`[SensorDataV2] Generando histórico para TIWater ${osmosis.resourceId} (Nivel Purificada)`);
          
          try {
            [historicoHora, historicoDiario] = await Promise.all([
              generateNivelHistoricoV2(codigoTienda, osmosis.resourceId, 'Nivel Purificada', null, 'tiwater'),
              generateNivelHistoricoDiarioV2(codigoTienda, osmosis.resourceId, 'Nivel Purificada', 30, 'tiwater')
            ]);
            
            if (historicoHora || historicoDiario) {
              console.log(`📊 [SensorDataV2] Histórico agregado para producto TIWater ${osmosis.resourceId} (Nivel Purificada): ${historicoHora?.hours_with_data?.length || 0} horas, ${historicoDiario?.days_with_data?.length || 0} días`);
            } else {
              console.warn(`⚠️ [SensorDataV2] No se generó histórico para TIWater ${osmosis.resourceId} (Nivel Purificada) - ambos históricos son null`);
            }
          } catch (error) {
            console.error(`[SensorDataV2] Error generando histórico para TIWater ${osmosis.resourceId} (Nivel Purificada):`, error);
          }
        }
        
        // Generar histórico para "Nivel Recuperada" si existe
        if (hasNivelRecuperada) {
          console.log(`[SensorDataV2] Generando histórico para TIWater ${osmosis.resourceId} (Nivel Recuperada)`);
          
          try {
            [historicoHoraRecuperada, historicoDiarioRecuperada] = await Promise.all([
              generateNivelHistoricoV2(codigoTienda, osmosis.resourceId, 'Nivel Recuperada', null, 'tiwater'),
              generateNivelHistoricoDiarioV2(codigoTienda, osmosis.resourceId, 'Nivel Recuperada', 30, 'tiwater')
            ]);
            
            if (historicoHoraRecuperada || historicoDiarioRecuperada) {
              console.log(`📊 [SensorDataV2] Histórico agregado para producto TIWater ${osmosis.resourceId} (Nivel Recuperada): ${historicoHoraRecuperada?.hours_with_data?.length || 0} horas, ${historicoDiarioRecuperada?.days_with_data?.length || 0} días`);
            } else {
              console.warn(`⚠️ [SensorDataV2] No se generó histórico para TIWater ${osmosis.resourceId} (Nivel Recuperada) - ambos históricos son null`);
            }
          } catch (error) {
            console.error(`[SensorDataV2] Error generando histórico para TIWater ${osmosis.resourceId} (Nivel Recuperada):`, error);
          }
        }
        
        // Si no tiene ninguno de los dos, usar el fallback antiguo
        if (!hasNivelPurificada && !hasNivelRecuperada) {
          console.log(`[SensorDataV2] TIWater ${osmosis.resourceId} no tiene datos de nivel para generar histórico`);
        }
      }
      
      return {
        _id: matchingProduct?._id || `${productType.toLowerCase()}-${index}`,
        id: osmosis.resourceId || `${productType.toLowerCase()}-${index}`,
        name: matchingProduct?.name || defaultName,
        product_type: productType,
        status: osmosis.status || [],
        online: osmosis.online || false,
        lastUpdate: osmosis.lastUpdate,
        historico: historicoHora || osmosis.historico || null,
        historico_diario: historicoDiario || osmosis.historico_diario || null,
        historico_recuperada: historicoHoraRecuperada || osmosis.historico_recuperada || null,
        historico_recuperada_diario: historicoDiarioRecuperada || osmosis.historico_recuperada_diario || null
      };
    }));

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

        // Generar histórico por hora (día actual) y histórico diario (últimos días)
        const [historicoHora, historicoDiario] = await Promise.all([
          generateNivelHistoricoV2(codigoTienda, resourceId, 'liquid_level_percent'),
          generateNivelHistoricoDiarioV2(codigoTienda, resourceId, 'liquid_level_percent', 30)
        ]);

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
          historico: historicoHora || null,
          historico_diario: historicoDiario || null // Histórico agrupado por día
        };

        if (historicoHora) {
          console.log(`📊 [SensorDataV2] Histórico por hora agregado para producto Nivel ${resourceId}: ${historicoHora.hours_with_data.length} horas con datos de ${historicoHora.total_logs} registros acumulados`);
        }
        if (historicoDiario) {
          console.log(`📊 [SensorDataV2] Histórico diario agregado para producto Nivel ${resourceId}: ${historicoDiario.days_with_data.length} días con datos de ${historicoDiario.total_logs} registros acumulados`);
        }
        if (!historicoHora && !historicoDiario) {
          console.warn(`⚠️ [SensorDataV2] No se pudo generar histórico para producto Nivel ${resourceId}`);
        }

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
 * Get latest tiwater sensor data for a punto de venta
 * Returns all sensor readings from the most recent MQTT message
 */
export const getTiwaterSensorData = async (req, res) => {
  try {
    const { codigoTienda } = req.query;

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'codigoTienda is required'
      });
    }

    // Get latest timestamp for this codigo_tienda
    const latestTimestampQuery = `
      SELECT MAX(timestamp) as latest_timestamp
      FROM sensores
      WHERE codigotienda = $1
        AND resourcetype = 'tiwater'
    `;

    const timestampResult = await query(latestTimestampQuery, [codigoTienda.toUpperCase()]);
    const latestTimestamp = timestampResult.rows[0]?.latest_timestamp;

    if (!latestTimestamp) {
      return res.json({
        success: true,
        data: null,
        message: 'No sensor data found for this punto de venta'
      });
    }

    // Get all sensor readings from the latest timestamp
    const sensorsQuery = `
      SELECT 
        name, value, type, timestamp, meta, label
      FROM sensores
      WHERE codigotienda = $1
        AND resourcetype = 'tiwater'
        AND timestamp = $2
      ORDER BY name
    `;

    const sensorsResult = await query(sensorsQuery, [codigoTienda.toUpperCase(), latestTimestamp]);
    const sensors = sensorsResult.rows || [];

    // Organize data by sensor type
    const sensorData = {
      codigoTienda: codigoTienda.toUpperCase(),
      timestamp: latestTimestamp,
      online: true, // Consider online if we have recent data
      // Caudales
      caudales: {
        purificada: null,
        recuperacion: null,
        rechazo: null,
        cruda: null,
        cruda_lmin: null
      },
      // Niveles
      niveles: {
        purificada_absoluto: null,
        purificada_porcentaje: null,
        cruda_absoluto: null,
        cruda_porcentaje: null
      },
      // Acumulados
      acumulados: {
        cruda: null
      },
      // Presiones
      presiones: {
        co2: null
      },
      // Sistema
      sistema: {
        eficiencia: null,
        vida: null
      },
      // Corrientes
      corrientes: {
        ch1: null,
        ch2: null,
        ch3: null,
        ch4: null,
        total: null
      },
      // Raw data for reference
      raw: {}
    };

    // Map sensor values
    sensors.forEach(sensor => {
      const value = parseFloat(sensor.value);
      sensorData.raw[sensor.name] = value;

      switch (sensor.name) {
        case 'flujo_produccion':
          sensorData.caudales.purificada = value;
          break;
        case 'flujo_recuperacion':
          sensorData.caudales.recuperacion = value;
          break;
        case 'flujo_rechazo':
          sensorData.caudales.rechazo = value;
          break;
        case 'caudal_cruda':
          sensorData.caudales.cruda = value;
          break;
        case 'caudal_cruda_lmin':
          sensorData.caudales.cruda_lmin = value;
          break;
        case 'nivel_purificada':
          sensorData.niveles.purificada_absoluto = value;
          break;
        case 'electronivel_purificada':
          sensorData.niveles.purificada_porcentaje = value;
          break;
        case 'nivel_cruda':
          sensorData.niveles.cruda_absoluto = value;
          break;
        case 'electronivel_recuperada':
          sensorData.niveles.cruda_porcentaje = value;
          break;
        case 'acumulado_cruda':
          sensorData.acumulados.cruda = value;
          break;
        case 'presion_co2':
          sensorData.presiones.co2 = value;
          break;
        case 'eficiencia':
          sensorData.sistema.eficiencia = value;
          break;
        case 'vida':
          sensorData.sistema.vida = value;
          break;
        case 'corriente_ch1':
          sensorData.corrientes.ch1 = value;
          break;
        case 'corriente_ch2':
          sensorData.corrientes.ch2 = value;
          break;
        case 'corriente_ch3':
          sensorData.corrientes.ch3 = value;
          break;
        case 'corriente_ch4':
          sensorData.corrientes.ch4 = value;
          break;
        case 'corriente_total':
          sensorData.corrientes.total = value;
          break;
      }
    });

    // Check if data is recent (within 5 minutes)
    const now = new Date();
    const dataTime = new Date(latestTimestamp);
    sensorData.online = (now - dataTime) < 5 * 60 * 1000;

    res.json({
      success: true,
      data: sensorData
    });

  } catch (error) {
    console.error('[SensorDataV2] Error getting tiwater sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tiwater sensor data',
      error: error.message
    });
  }
};

/**
 * Helper function to get unit for sensor
 */
function getUnitForSensor(sensorName) {
  if (!sensorName) return '';
  
  const units = {
    // Flujos
    'flujo_produccion': 'L/min',
    'flowrate_speed_1': 'L/min',
    'flujo_rechazo': 'L/min',
    'flowrate_speed_2': 'L/min',
    'flujo_recuperacion': 'L/min',
    'flowrate_recuperacion': 'L/min',
    // TDS
    'tds': 'ppm',
    'tds_out': 'ppm',
    // Niveles (porcentajes)
    'electronivel_purificada': '%',
    'level_purificada': '%',
    'electronivel_recuperada': '%',
    'level_recuperada': '%',
    // Niveles (absolutos)
    'nivel_purificada': 'mm',
    'nivel_purificada_absoluto': 'mm',
    'nivel_cruda': 'mm',
    'nivel_cruda_absoluto': 'mm',
    // Caudales
    'caudal_cruda': 'L/min',
    'caudal_cruda_lmin': 'L/min',
    'Caudal Cruda': 'L/min',
    'Caudal Cruda (L/min)': 'L/min',
    // Acumulados
    'acumulado_cruda': 'L',
    'Acumulado Cruda': 'L',
    // Presiones
    'presion_co2': 'PSI',
    'Presión CO2': 'PSI',
    'presion_in': 'PSI',
    'pressure_in': 'PSI',
    'Presión Entrada': 'PSI',
    'presion_out': 'PSI',
    'pressure_out': 'PSI',
    'Presión Salida': 'PSI',
    // Sistema
    'eficiencia': '%',
    'Eficiencia': '%',
    'vida': 'días',
    'Vida': 'días',
    'Vida del Sistema': 'días',
    // Corrientes
    'corriente_ch1': 'A',
    'Corriente Canal 1': 'A',
    'corriente_ch2': 'A',
    'Corriente Canal 2': 'A',
    'corriente_ch3': 'A',
    'Corriente Canal 3': 'A',
    'corriente_ch4': 'A',
    'Corriente Canal 4': 'A',
    'corriente_total': 'A',
    'Corriente Total': 'A'
  };
  
  // Try exact match first
  if (units[sensorName]) {
    return units[sensorName];
  }
  
  // Try case-insensitive match
  const lowerName = sensorName.toLowerCase();
  for (const [key, value] of Object.entries(units)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  return '';
}

