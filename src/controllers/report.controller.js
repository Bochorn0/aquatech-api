// src/controllers/report.controller.js
import Report from '../models/report.model.js';
import ProductLog from '../models/product_logs.model.js';
import Product from '../models/product.model.js';
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
export async function generateProductLogsReport(product_id, date, product = null, useLastValue = false) {
  try {
    console.log('📊 [generateProductLogsReport] Generando reporte para:', { product_id, date });

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

    // ====== CALCULAR RANGO DE FECHA ======
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

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
          date: date,
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
          
          // TDS (excluir si es 0)
          if (log.tds !== undefined && log.tds !== null && log.tds !== 0) {
            hoursMap[hour].tds_agrupado.push({
              tds: log.tds,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Flujo Producción (excluir si es 0)
          if (log.flujo_produccion !== undefined && log.flujo_produccion !== null && log.flujo_produccion !== 0) {
            hoursMap[hour].flujo_produccion_agrupado.push({
              flujo_produccion: log.flujo_produccion,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Flujo Rechazo (excluir si es 0)
          if (log.flujo_rechazo !== undefined && log.flujo_rechazo !== null && log.flujo_rechazo !== 0) {
            hoursMap[hour].flujo_rechazo_agrupado.push({
              flujo_rechazo: log.flujo_rechazo,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Production Volume (excluir si es 0)
          if (log.production_volume !== undefined && log.production_volume !== null && log.production_volume !== 0) {
            hoursMap[hour].production_volume_agrupado.push({
              production_volume: log.production_volume,
              hora: hourMinute,
              timestamp: log.date,
            });
          }

          // Rejected Volume (excluir si es 0)
          if (log.rejected_volume !== undefined && log.rejected_volume !== null && log.rejected_volume !== 0) {
            hoursMap[hour].rejected_volume_agrupado.push({
              rejected_volume: log.rejected_volume,
              hora: hourMinute,
              timestamp: log.date,
            });
          }
        }

        hoursMap[hour].total_logs++;
      }
    });

    // ====== FILTRAR SOLO HORAS CON DATOS ======
    const hoursWithData = Object.values(hoursMap).filter(
      hourData => hourData.total_logs > 0
    );

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

    // ====== CALCULAR PROMEDIO GENERAL (solo para productos tipo Nivel) ======
    let promedioGeneral = null;
    if (productType === 'Nivel' && hoursWithStats.length > 0) {
      // Calcular el promedio general de los últimos valores por hora
      // Estos son los valores que se usan en la gráfica (últimos valores por hora cuando useLastValue=true)
      const valoresPorHora = hoursWithStats.map(hour => 
        hour.estadisticas?.liquid_level_percent_promedio || 0
      ).filter(val => val > 0); // Filtrar valores válidos (mayores a 0)
      
      if (valoresPorHora.length > 0) {
        const sumaTotal = valoresPorHora.reduce((sum, val) => sum + val, 0);
        promedioGeneral = Number((sumaTotal / valoresPorHora.length).toFixed(2));
        console.log(`📊 [generateProductLogsReport] Promedio general calculado: ${promedioGeneral}% (de ${valoresPorHora.length} horas con datos válidos)`);
        console.log(`📊 [generateProductLogsReport] Valores usados para el promedio:`, valoresPorHora);
        console.log(`📊 [generateProductLogsReport] Último valor: ${valoresPorHora[valoresPorHora.length - 1]}%`);
      }
    }

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
        promedio_general: promedioGeneral, // Agregar promedio general a la respuesta
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
    const { product_id, date } = req.query;

    // ====== VALIDACIONES ======
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: product_id',
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: date (format: YYYY-MM-DD)',
      });
    }

    // Llamar a la función helper
    const result = await generateProductLogsReport(product_id, date);

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
