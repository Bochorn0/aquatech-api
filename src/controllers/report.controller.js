// src/controllers/report.controller.js
import Report from '../models/report.model.js';
import ProductLog from '../models/product_logs.model.js';
import Product from '../models/product.model.js';
import PuntoVenta from '../models/puntoVenta.model.js';
import moment from 'moment';

export const getReports = async (req, res) => {
  try {
    console.log('Fetching reports...');
    
    // Check if products exist in MongoDB
    let report = await Report.find({});

    if (report.length === 0) {
      // Store products in MongoDB

      // Return stored products
      report = [
        {
          "total": 150,
          "label": "report metrics",
          "totalOnline": 120,
          "percentage": 0.8
        }];
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
};

/* ======================================================
   📊 REPORTE DE LOGS DE PRODUCTO AGRUPADOS POR HORA
   ====================================================== */

/**
 * Función helper privada para generar reporte de logs
 * Puede ser llamada internamente desde otros controladores
 * @param {string} product_id - ID del producto
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @param {Object} product - Objeto del producto (opcional)
 * @param {boolean} useLastValue - Si es true, usa el último valor de cada hora en lugar del promedio (solo para tipo Nivel)
 */
export async function generateProductLogsReport(product_id, date, product = null, useLastValue = false, startDate = null, endDate = null) {
  try {
    console.log('📊 [generateProductLogsReport] Generando reporte para:', { product_id, date, startDate, endDate });

    // Verificar que el producto existe (si no se pasó)
    if (!product) {
      product = await Product.findOne({ id: product_id });
      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }
    }

    // Determinar tipo de producto
    const productType = product.product_type || 'Osmosis';

    // ====== FUNCIÓN PARA APLICAR CONVERSIONES (igual que en reporte mensual) ======
    const applySpecialProductLogic = (fieldName, value) => {
      if (value == null || value === 0) return value;

      const PRODUCTOS_ESPECIALES = [
        'ebf9738480d78e0132gnru',
        'ebea4ffa2ab1483940nrqn'
      ];

      const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
      const flujos_total_codes = ["flowrate_total_1", "flowrate_total_2"];
      const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];

      let convertedValue = value;

      // 1. Si es producto especial y es código de flujo: multiplicar por 1.6
      if (PRODUCTOS_ESPECIALES.includes(product_id) && flujos_codes.includes(fieldName)) {
        convertedValue = convertedValue * 1.6;
        
        // 2. Si es total (flowrate_total_1 o flowrate_total_2): dividir por 10
        if (flujos_total_codes.includes(fieldName)) {
          convertedValue = convertedValue / 10;
        }
      }

      // 3. Si es flowrate_speed_1 o flowrate_speed_2: siempre dividir por 10 (conversión a L/s)
      // Esto se aplica después de la conversión especial si aplica
      if (arrayCodes.includes(fieldName) && convertedValue > 0) {
        convertedValue = convertedValue / 10;
      }
      
      return parseFloat(convertedValue.toFixed(2));
    };

    // ====== CALCULAR RANGO DE FECHA ======
    let startOfDay, endOfDay;
    
    if (startDate && endDate) {
      // Si se proporcionan fechas de inicio y fin, usar el rango completo
      startOfDay = moment(startDate).startOf('day').toDate();
      endOfDay = moment(endDate).endOf('day').toDate();
    } else {
      // Si solo se proporciona una fecha, usar ese día
      startOfDay = moment(date).startOf('day').toDate();
      endOfDay = moment(date).endOf('day').toDate();
    }

    console.log(`📅 [getProductLogsReport] Rango: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);

    // ====== OBTENER LOGS DEL DÍA ======
    const logs = await ProductLog.find({
      product_id: product_id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).sort({ date: 1 }); // Orden ascendente por fecha

    console.log(`📊 [generateProductLogsReport] ${logs.length} logs encontrados`);

    if (logs.length === 0) {
      return {
        success: true,
        message: 'No logs found for this date',
        data: {
          product: {
            id: product.id,
            name: product.name,
            product_type: productType,
          },
          date: startDate && endDate ? `${startDate} a ${endDate}` : date,
          start_date: startDate || date,
          end_date: endDate || date,
          total_logs: 0,
          hours_with_data: [],
        },
      };
    }

    // ====== AGRUPAR LOGS POR HORA ======
    const hoursMap = {};

    // Inicializar estructura para las 24 horas según tipo de producto
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = hour.toString().padStart(2, '0');
      
      if (productType === 'Nivel') {
        hoursMap[hourKey] = {
          hora: `${hourKey}:00`,
          liquid_depth_agrupado: [],
          liquid_level_percent_agrupado: [],
          total_logs: 0,
        };
      } else {
        // Por defecto: Osmosis
        hoursMap[hourKey] = {
          hora: `${hourKey}:00`,
          tds_agrupado: [],
          flujo_produccion_agrupado: [],
          flujo_rechazo_agrupado: [],
          production_volume_agrupado: [],
          rejected_volume_agrupado: [],
          total_logs: 0,
        };
      }
    }

    // Agrupar logs por hora según tipo de producto
    logs.forEach(log => {
      const logDate = moment(log.date);
      const hour = logDate.format('HH'); // Hora en formato 00-23
      const hourMinute = logDate.format('HH:mm'); // Hora:Minuto

      if (hoursMap[hour]) {
        if (productType === 'Nivel') {
          // Para productos tipo Nivel, usar liquid_depth y liquid_level_percent
          // (mapeados temporalmente a flujo_produccion y flujo_rechazo)
          
          if (log.flujo_produccion !== undefined && log.flujo_produccion !== null && log.flujo_produccion !== 0) {
            hoursMap[hour].liquid_depth_agrupado.push({
              liquid_depth: log.flujo_produccion, // Mapeo temporal
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          if (log.flujo_rechazo !== undefined && log.flujo_rechazo !== null && log.flujo_rechazo !== 0) {
            hoursMap[hour].liquid_level_percent_agrupado.push({
              liquid_level_percent: log.flujo_rechazo, // Mapeo temporal
              hora: hourMinute,
              timestamp: log.date,
            });
          }

        } else {
          // Para productos tipo Osmosis
          
          // TDS (excluir si es 0) - sin conversión especial
          if (log.tds !== undefined && log.tds !== null && log.tds !== 0) {
            hoursMap[hour].tds_agrupado.push({
              tds: log.tds,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Flujo Producción (excluir si es 0) - aplicar conversiones
          if (log.flujo_produccion !== undefined && log.flujo_produccion !== null && log.flujo_produccion !== 0) {
            const valorConvertido = applySpecialProductLogic('flowrate_speed_1', log.flujo_produccion);
            hoursMap[hour].flujo_produccion_agrupado.push({
              flujo_produccion: valorConvertido,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Flujo Rechazo (excluir si es 0) - aplicar conversiones
          if (log.flujo_rechazo !== undefined && log.flujo_rechazo !== null && log.flujo_rechazo !== 0) {
            const valorConvertido = applySpecialProductLogic('flowrate_speed_2', log.flujo_rechazo);
            hoursMap[hour].flujo_rechazo_agrupado.push({
              flujo_rechazo: valorConvertido,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Production Volume (excluir si es 0) - aplicar conversiones
          if (log.production_volume !== undefined && log.production_volume !== null && log.production_volume !== 0) {
            const valorConvertido = applySpecialProductLogic('flowrate_total_1', log.production_volume);
            hoursMap[hour].production_volume_agrupado.push({
              production_volume: valorConvertido,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Rejected Volume (excluir si es 0) - aplicar conversiones
          if (log.rejected_volume !== undefined && log.rejected_volume !== null && log.rejected_volume !== 0) {
            const valorConvertido = applySpecialProductLogic('flowrate_total_2', log.rejected_volume);
            hoursMap[hour].rejected_volume_agrupado.push({
              rejected_volume: valorConvertido,
              hora: hourMinute,
              timestamp: log.date,
            });
          }
        }

        hoursMap[hour].total_logs++;
      }
    });

    // ====== FILTRAR SOLO HORAS CON DATOS Y ORDENAR POR HORA ======
    // Obtener las horas ordenadas numéricamente (00, 01, 02, ..., 23)
    const sortedHourKeys = Object.keys(hoursMap).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Filtrar solo horas con datos y mantener el orden
    const hoursWithData = sortedHourKeys
      .map(key => hoursMap[key])
      .filter(hourData => hourData.total_logs > 0);

    // ====== CALCULAR ESTADÍSTICAS POR HORA ======
    const hoursWithStats = hoursWithData.map(hourData => {
      if (productType === 'Nivel') {
        let liquidDepthValue = 0;
        let liquidPercentValue = 0;

        if (useLastValue) {
          // Calcular promedio para comparación
          const avgLiquidDepth = hourData.liquid_depth_agrupado?.length > 0
            ? (hourData.liquid_depth_agrupado.reduce((sum, item) => sum + item.liquid_depth, 0) / hourData.liquid_depth_agrupado.length).toFixed(2)
            : 0;

          const avgLiquidPercent = hourData.liquid_level_percent_agrupado?.length > 0
            ? (hourData.liquid_level_percent_agrupado.reduce((sum, item) => sum + item.liquid_level_percent, 0) / hourData.liquid_level_percent_agrupado.length).toFixed(2)
            : 0;

          // Usar el último valor de cada hora (para gráficas del punto de venta detalle)
          // Ordenar por timestamp descendente para tomar el más reciente primero
          // Asegurarse de que el timestamp sea válido antes de ordenar
          const sortedLiquidDepth = hourData.liquid_depth_agrupado?.length > 0
            ? [...hourData.liquid_depth_agrupado]
                .filter(item => item.timestamp) // Filtrar items sin timestamp
                .sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  if (isNaN(timeA) || isNaN(timeB)) return 0; // Si algún timestamp es inválido, mantener orden
                  return timeB - timeA; // Descendente (más reciente primero)
                })
            : [];
          
          const sortedLiquidPercent = hourData.liquid_level_percent_agrupado?.length > 0
            ? [...hourData.liquid_level_percent_agrupado]
                .filter(item => item.timestamp) // Filtrar items sin timestamp
                .sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  if (isNaN(timeA) || isNaN(timeB)) return 0; // Si algún timestamp es inválido, mantener orden
                  return timeB - timeA; // Descendente (más reciente primero)
                })
            : [];

          // Tomar el primer elemento (más reciente) después de ordenar descendente
          liquidDepthValue = sortedLiquidDepth.length > 0
            ? sortedLiquidDepth[0].liquid_depth
            : 0;

          liquidPercentValue = sortedLiquidPercent.length > 0
            ? sortedLiquidPercent[0].liquid_level_percent
            : 0;

          // Log de comparación: promedio vs último valor usado
          if (sortedLiquidPercent.length > 0) {
            console.log(`📊 [useLastValue=true] Hora ${hourData.hora}: Promedio=${avgLiquidPercent}% | Último valor usado=${liquidPercentValue}% (de ${sortedLiquidPercent.length} registros)`);
          }
        } else {
          // Usar el promedio (comportamiento por defecto para reportes)
          const avgLiquidDepth = hourData.liquid_depth_agrupado?.length > 0
            ? (hourData.liquid_depth_agrupado.reduce((sum, item) => sum + item.liquid_depth, 0) / hourData.liquid_depth_agrupado.length).toFixed(2)
            : 0;

          const avgLiquidPercent = hourData.liquid_level_percent_agrupado?.length > 0
            ? (hourData.liquid_level_percent_agrupado.reduce((sum, item) => sum + item.liquid_level_percent, 0) / hourData.liquid_level_percent_agrupado.length).toFixed(2)
            : 0;

          liquidDepthValue = parseFloat(avgLiquidDepth);
          liquidPercentValue = parseFloat(avgLiquidPercent);
        }

        return {
          ...hourData,
          estadisticas: {
            liquid_depth_promedio: parseFloat(Number(liquidDepthValue).toFixed(2)),
            liquid_level_percent_promedio: parseFloat(Number(liquidPercentValue).toFixed(2)),
          },
        };
      } else {
        // Estadísticas para productos tipo Osmosis
        const avgTds = hourData.tds_agrupado?.length > 0
          ? (hourData.tds_agrupado.reduce((sum, item) => sum + item.tds, 0) / hourData.tds_agrupado.length).toFixed(2)
          : 0;

        const avgFlujoProduccion = hourData.flujo_produccion_agrupado?.length > 0
          ? (hourData.flujo_produccion_agrupado.reduce((sum, item) => sum + item.flujo_produccion, 0) / hourData.flujo_produccion_agrupado.length).toFixed(2)
          : 0;

        const avgFlujoRechazo = hourData.flujo_rechazo_agrupado?.length > 0
          ? (hourData.flujo_rechazo_agrupado.reduce((sum, item) => sum + item.flujo_rechazo, 0) / hourData.flujo_rechazo_agrupado.length).toFixed(2)
          : 0;

        const totalProductionVolume = hourData.production_volume_agrupado?.length > 0
          ? hourData.production_volume_agrupado.reduce((sum, item) => sum + item.production_volume, 0).toFixed(2)
          : 0;

        const totalRejectedVolume = hourData.rejected_volume_agrupado?.length > 0
          ? hourData.rejected_volume_agrupado.reduce((sum, item) => sum + item.rejected_volume, 0).toFixed(2)
          : 0;

        return {
          ...hourData,
          estadisticas: {
            tds_promedio: parseFloat(avgTds),
            flujo_produccion_promedio: parseFloat(avgFlujoProduccion),
            flujo_rechazo_promedio: parseFloat(avgFlujoRechazo),
            production_volume_total: parseFloat(totalProductionVolume),
            rejected_volume_total: parseFloat(totalRejectedVolume),
          },
        };
      }
    });

    // ====== RESPUESTA ======
    console.log(`✅ [generateProductLogsReport] Reporte generado con ${hoursWithStats.length} horas con datos`);

    return {
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          product_type: productType,
        },
        date: date,
        total_logs: logs.length,
        hours_with_data: hoursWithStats,
      },
    };

  } catch (error) {
    console.error('❌ [generateProductLogsReport] Error generando reporte:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Endpoint público para obtener logs de un producto agrupados por hora
 * Query params:
 *   - product_id: ID del producto
 *   - date: Fecha en formato YYYY-MM-DD (ej: 2025-11-11)
 */
export const getProductLogsReport = async (req, res) => {
  try {
    const { product_id, date, start_date, end_date } = req.query;

    // ====== VALIDACIONES ======
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: product_id',
      });
    }

    // Si se proporcionan start_date y end_date, usarlos; si no, usar date
    if (!date && !start_date && !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: date or start_date and end_date (format: YYYY-MM-DD)',
      });
    }

    // Validar que si se proporciona start_date, también se proporcione end_date
    if ((start_date && !end_date) || (!start_date && end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Both start_date and end_date must be provided together (format: YYYY-MM-DD)',
      });
    }

    // Usar date como fallback si no se proporcionan start_date y end_date
    const dateToUse = date || start_date;

    // Llamar a la función helper
    const result = await generateProductLogsReport(product_id, dateToUse, null, false, start_date, end_date);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    return res.json(result);

  } catch (error) {
    console.error('❌ [getProductLogsReport] Error en endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating product logs report',
      error: error.message,
    });
  }
};

/* ======================================================
   📊 REPORTE MENSUAL DE LOGS POR DÍA
   ====================================================== */

/**
 * Reporte mensual que obtiene registros de la base de datos agrupados por día,
 * scoped al punto de venta actual (productos del punto venta).
 * Query: puntoVentaId (MongoDB _id), dateStart, dateEnd (YYYY-MM-DD).
 * Solo considera registros con valores diferentes de 0.
 */
export const reporteMensual = async (req, res) => {
  try {
    const { puntoVentaId, dateStart, dateEnd } = req.query;

    if (!puntoVentaId) {
      return res.status(400).json({
        success: false,
        message: 'puntoVentaId es requerido. Ejemplo: GET /api/v1.0/reportes/mensual?puntoVentaId=697b857abb927ef6df4f43c1&dateStart=2026-02-04&dateEnd=2026-02-05',
      });
    }

    // Cargar punto de venta y sus productos
    const punto = await PuntoVenta.findById(puntoVentaId).populate('productos').lean();
    if (!punto) {
      return res.status(404).json({
        success: false,
        message: 'Punto de venta no encontrado',
      });
    }

    const productos = punto.productos || [];
    const productIds = productos.map((p) => p && p.id).filter(Boolean);
    const productIdToName = new Map(productos.filter((p) => p && p.id).map((p) => [p.id, p.name || p.id]));

    if (productIds.length === 0) {
      return res.json({
        success: true,
        message: 'El punto de venta no tiene productos asignados',
        data: [],
        summary: {
          puntoVentaId,
          puntoVentaName: punto.name,
          fechaInicio: null,
          fechaFin: null,
          totalDias: 0,
          totalLogs: 0,
          productIds: [],
        },
      });
    }

    // Formatear fechas como YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let START_DATE, END_DATE;

    if (dateStart && dateEnd) {
      const dateStartRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateStartRegex.test(dateStart) || !dateStartRegex.test(dateEnd)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido. Use YYYY-MM-DD para dateStart y dateEnd',
        });
      }
      START_DATE = dateStart;
      END_DATE = dateEnd;
      const startDateObj = new Date(START_DATE);
      const endDateObj = new Date(END_DATE);
      if (startDateObj > endDateObj) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de inicio debe ser menor o igual a la fecha de fin',
        });
      }
    } else {
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      START_DATE = formatDate(oneMonthAgo);
      END_DATE = formatDate(today);
    }

    // Rango en America/Hermosillo (UTC-7) para que no dependa de la TZ del servidor.
    // Logs en BD están en UTC; "2026-02-05" = todo el día 5 en Hermosillo.
    const REPORT_TZ_OFFSET_HOURS = 7; // 00:00 Hermosillo = 07:00 UTC
    const parseLocal = (str) => {
      const [y, m, d] = str.split('-').map(Number);
      return { y, m: m - 1, d };
    };
    const startParsed = parseLocal(START_DATE);
    const endParsed = parseLocal(END_DATE);
    const startDate = new Date(Date.UTC(startParsed.y, startParsed.m, startParsed.d, REPORT_TZ_OFFSET_HOURS, 0, 0, 0));
    const endDate = new Date(Date.UTC(endParsed.y, endParsed.m, endParsed.d + 1, REPORT_TZ_OFFSET_HOURS - 1, 59, 59, 999));

    // Diagnóstico: valores usados en la consulta
    console.log('📊 [reporteMensual] Query params:', {
      START_DATE_STR: START_DATE,
      END_DATE_STR: END_DATE,
      startDate_ISO: startDate.toISOString(),
      endDate_ISO: endDate.toISOString(),
      productIds,
      productIdsLength: productIds.length,
    });

    // Conteo diagnóstico: logs en rango sin filtrar por valor (para saber si hay datos)
    const totalInRange = await ProductLog.countDocuments({
      product_id: { $in: productIds },
      date: { $gte: startDate, $lte: endDate },
    });
    if (totalInRange === 0) {
      console.log('📊 [reporteMensual] totalLogsInRange: 0 (no hay logs en BD para este PV en el rango)');
    } else {
      console.log('📊 [reporteMensual] totalLogsInRange:', totalInRange);
    }

    // Incluir logs que tengan al menos un campo de reporte presente (aunque sea 0)
    const logs = await ProductLog.find({
      product_id: { $in: productIds },
      date: { $gte: startDate, $lte: endDate },
      $or: [
        { tds: { $exists: true } },
        { production_volume: { $exists: true } },
        { rejected_volume: { $exists: true } },
        { flujo_produccion: { $exists: true } },
        { flujo_rechazo: { $exists: true } },
      ],
    })
      .sort({ date: 1 })
      .lean();

    console.log('📊 [reporteMensual] totalLogsCount (con datos de reporte):', logs.length);

    if (logs.length === 0) {
      return res.json({
        success: true,
        message: 'No se encontraron registros para el rango de fechas y punto de venta especificados',
        data: [],
        summary: {
          puntoVentaId,
          puntoVentaName: punto.name,
          fechaInicio: START_DATE,
          fechaFin: END_DATE,
          totalDias: 0,
          totalLogs: 0,
          productIds,
        },
      });
    }

    // Helpers: report timezone America/Hermosillo for day/hour grouping
    const REPORT_TZ = 'America/Hermosillo';
    const getLocalDayKey = (date) => {
      const d = new Date(date);
      const str = d.toLocaleDateString('en-CA', { timeZone: REPORT_TZ }); // YYYY-MM-DD
      return str;
    };
    const getLocalHour = (date) => {
      const d = new Date(date);
      const h = d.toLocaleString('en-US', { timeZone: REPORT_TZ, hour: '2-digit', hour12: false });
      return String(Number(h)).padStart(2, '0');
    };
    const getTimeString = (date) => {
      return new Date(date).toLocaleTimeString('es-MX', {
        timeZone: REPORT_TZ,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    // Agrupar logs por día (Hermosillo) y por product_id
    const logsByDayAndProduct = {};
    for (const log of logs) {
      const dayKey = getLocalDayKey(log.date);
      if (!logsByDayAndProduct[dayKey]) logsByDayAndProduct[dayKey] = {};
      const pid = log.product_id;
      if (!logsByDayAndProduct[dayKey][pid]) logsByDayAndProduct[dayKey][pid] = [];
      logsByDayAndProduct[dayKey][pid].push(log);
    }

    const PRODUCTOS_ESPECIALES = ['ebf9738480d78e0132gnru', 'ebea4ffa2ab1483940nrqn'];
    const flujos_codes = ['flowrate_speed_1', 'flowrate_speed_2', 'flowrate_total_1', 'flowrate_total_2'];
    const flujos_total_codes = ['flowrate_total_1', 'flowrate_total_2'];
    const arrayCodes = ['flowrate_speed_1', 'flowrate_speed_2'];

    const applySpecialProductLogic = (fieldName, value, productId) => {
      if (value == null) return value;
      let convertedValue = Number(value);
      if (PRODUCTOS_ESPECIALES.includes(productId) && flujos_codes.includes(fieldName)) {
        convertedValue = convertedValue * 1.6;
        if (flujos_total_codes.includes(fieldName)) convertedValue = convertedValue / 10;
      }
      if (arrayCodes.includes(fieldName) && convertedValue > 0) convertedValue = convertedValue / 10;
      return parseFloat(convertedValue.toFixed(2));
    };

    // Cumulative counters: use min/max over period so total = max - min (device may report only in some logs)
    const getMinMaxVolume = (dayLogs, fieldValue, fieldName, productId) => {
      let minVal = null;
      let maxVal = null;
      let minLog = null;
      let maxLog = null;
      for (const log of dayLogs) {
        const raw = log[fieldValue];
        if (raw == null) continue;
        const v = Number(raw);
        if (minVal === null || v < minVal) {
          minVal = v;
          minLog = log;
        }
        if (maxVal === null || v > maxVal) {
          maxVal = v;
          maxLog = log;
        }
      }
      if (minLog == null || maxLog == null) return null;
      const minConverted = applySpecialProductLogic(fieldName, minVal, productId);
      const maxConverted = applySpecialProductLogic(fieldName, maxVal, productId);
      const delta = parseFloat((maxConverted - minConverted).toFixed(2));
      return {
        inicio: { value: minConverted, hora: getTimeString(minLog.date) },
        fin: { value: maxConverted, hora: getTimeString(maxLog.date) },
        value: delta,
      };
    };

    const findFirstNonZero = (dayLogs, fieldName, fieldValue, productId) => {
      for (const log of dayLogs) {
        const value = log[fieldValue];
        if (value != null && value !== 0) {
          const convertedValue = applySpecialProductLogic(fieldName, value, productId);
          return { hora: getTimeString(log.date), value: convertedValue };
        }
      }
      return null;
    };

    const findLastNonZero = (dayLogs, fieldName, fieldValue, productId) => {
      for (let i = dayLogs.length - 1; i >= 0; i--) {
        const log = dayLogs[i];
        const value = log[fieldValue];
        if (value != null && value !== 0) {
          const convertedValue = applySpecialProductLogic(fieldName, value, productId);
          return { hora: getTimeString(log.date), value: convertedValue };
        }
      }
      return null;
    };

    // Build hourly stats for a set of logs (day or hour slice)
    const buildHourlyStats = (hourLogs, productId) => {
      if (!hourLogs.length) return null;
      const prodVol = getMinMaxVolume(hourLogs, 'production_volume', 'flowrate_total_1', productId);
      const rejVol = getMinMaxVolume(hourLogs, 'rejected_volume', 'flowrate_total_2', productId);
      const withTds = hourLogs.filter((l) => l.tds != null && l.tds !== 0);
      const tdsInicio = withTds.length ? withTds[0].tds : null;
      const tdsFin = withTds.length ? withTds[withTds.length - 1].tds : null;
      const flujoProd = hourLogs.filter((l) => l.flujo_produccion != null && l.flujo_produccion !== 0).map((l) => applySpecialProductLogic('flowrate_speed_1', l.flujo_produccion, productId));
      const flujoRech = hourLogs.filter((l) => l.flujo_rechazo != null && l.flujo_rechazo !== 0).map((l) => applySpecialProductLogic('flowrate_speed_2', l.flujo_rechazo, productId));
      const avgFlujoProd = flujoProd.length ? flujoProd.reduce((a, b) => a + b, 0) / flujoProd.length : null;
      const avgFlujoRech = flujoRech.length ? flujoRech.reduce((a, b) => a + b, 0) / flujoRech.length : null;
      return {
        production_volume_total: prodVol?.value ?? 0,
        rejected_volume_total: rejVol?.value ?? 0,
        tds_inicio: tdsInicio != null ? tdsInicio : null,
        tds_fin: tdsFin != null ? tdsFin : null,
        flujo_produccion_promedio: avgFlujoProd != null ? parseFloat(avgFlujoProd.toFixed(2)) : null,
        flujo_rechazo_promedio: avgFlujoRech != null ? parseFloat(avgFlujoRech.toFixed(2)) : null,
        total_logs: hourLogs.length,
      };
    };

    const result = [];

    for (const dayKey of Object.keys(logsByDayAndProduct).sort()) {
      const byProduct = logsByDayAndProduct[dayKey];
      const productosData = [];

      for (const productId of Object.keys(byProduct).sort()) {
        const dayLogs = byProduct[productId];
        if (!dayLogs.length) continue;

        // Cumulative volumes: min/max over day → total = max - min
        const prodVol = getMinMaxVolume(dayLogs, 'production_volume', 'flowrate_total_1', productId);
        const rejVol = getMinMaxVolume(dayLogs, 'rejected_volume', 'flowrate_total_2', productId);

        const inicio = {
          flowrate_total_1: prodVol ? prodVol.inicio : null,
          flowrate_total_2: rejVol ? rejVol.inicio : null,
          tds_out: findFirstNonZero(dayLogs, 'tds_out', 'tds', productId),
          flowrate_speed_1: findFirstNonZero(dayLogs, 'flowrate_speed_1', 'flujo_produccion', productId),
          flowrate_speed_2: findFirstNonZero(dayLogs, 'flowrate_speed_2', 'flujo_rechazo', productId),
        };
        const fin = {
          flowrate_total_1: prodVol ? prodVol.fin : null,
          flowrate_total_2: rejVol ? rejVol.fin : null,
          tds_out: findLastNonZero(dayLogs, 'tds_out', 'tds', productId),
          flowrate_speed_1: findLastNonZero(dayLogs, 'flowrate_speed_1', 'flujo_produccion', productId),
          flowrate_speed_2: findLastNonZero(dayLogs, 'flowrate_speed_2', 'flujo_rechazo', productId),
        };

        const produccion = {
          flowrate_total_1: prodVol ? { value: prodVol.value, inicio: prodVol.inicio.value, fin: prodVol.fin.value } : null,
          flowrate_total_2: rejVol ? { value: rejVol.value, inicio: rejVol.inicio.value, fin: rejVol.fin.value } : null,
          tds_out: (inicio.tds_out && fin.tds_out)
            ? { value: parseFloat((fin.tds_out.value - inicio.tds_out.value).toFixed(2)), inicio: inicio.tds_out.value, fin: fin.tds_out.value }
            : null,
          flowrate_speed_1: (inicio.flowrate_speed_1 && fin.flowrate_speed_1)
            ? { value: parseFloat(((inicio.flowrate_speed_1.value + fin.flowrate_speed_1.value) / 2).toFixed(2)), inicio: inicio.flowrate_speed_1.value, fin: fin.flowrate_speed_1.value }
            : null,
          flowrate_speed_2: (inicio.flowrate_speed_2 && fin.flowrate_speed_2)
            ? { value: parseFloat(((inicio.flowrate_speed_2.value + fin.flowrate_speed_2.value) / 2).toFixed(2)), inicio: inicio.flowrate_speed_2.value, fin: fin.flowrate_speed_2.value }
            : null,
        };

        // Group by hour (report TZ) for summary by hours
        const byHour = {};
        for (const log of dayLogs) {
          const h = getLocalHour(log.date);
          if (!byHour[h]) byHour[h] = [];
          byHour[h].push(log);
        }
        const sortedHours = Object.keys(byHour).sort((a, b) => Number(a) - Number(b));
        const hours_with_data = sortedHours.map((h) => {
          const hourLogs = byHour[h];
          const stats = buildHourlyStats(hourLogs, productId);
          return {
            hora: `${h}:00`,
            ...stats,
          };
        });

        productosData.push({
          productId,
          productName: productIdToName.get(productId) || productId,
          inicio,
          fin,
          produccion,
          hours_with_data,
        });
      }

      if (productosData.length > 0) {
        result.push({ dia: dayKey, productos: productosData });
      }
    }

    return res.json({
      success: true,
      message: 'Reporte mensual generado exitosamente',
      data: result,
      summary: {
        puntoVentaId,
        puntoVentaName: punto.name,
        fechaInicio: START_DATE,
        fechaFin: END_DATE,
        totalDias: result.length,
        totalLogs: logs.length,
        productIds,
      },
    });
  } catch (error) {
    console.error('❌ [reporteMensual] Error generando reporte:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generando reporte mensual',
      error: error.message,
    });
  }
};
