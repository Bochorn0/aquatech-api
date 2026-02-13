// src/routes/sensorDataV2.routes.js
// Routes for v2.0 API endpoints using PostgreSQL

import express from 'express';
import {
  getOsmosisSystemByPuntoVenta,
  getPuntoVentaDetalleV2,
  getPuntosVentaV2,
  getSensorTimeSeries,
  getTiwaterSensorData
} from '../controllers/sensorDataV2.controller.js';

const router = express.Router();

/** Stub response for global-metrics when controller export is missing (keeps API up and dashboard valid JSON) */
const stubGlobalMetrics = {
  puntosVentaCount: 0,
  productionSum: 0,
  rechazoSum: 0,
  eficienciaAvg: null,
  nivelPurificadaAvg: null,
  nivelCrudaAvg: null,
  byLevel: {
    nivelPurificada: { normal: 0, preventivo: 0, critico: 0 },
    nivelCruda: { normal: 0, preventivo: 0, critico: 0 },
  },
  perPvMetrics: [],
};

/**
 * @route   GET /api/v2.0/dashboard/global-metrics
 * @desc    Global summary for Main Dashboard V2 (production sum, rechazo sum, eficiencia avg, nivel by level)
 * @access  Private
 */
router.get('/dashboard/global-metrics', async (req, res) => {
  try {
    const { getMainDashboardV2Metrics } = await import('../controllers/sensorDataV2.controller.js');
    return getMainDashboardV2Metrics(req, res);
  } catch (_) {
    return res.json(stubGlobalMetrics);
  }
});

/**
 * @route   GET /api/v2.0/sensors/osmosis
 * @desc    Get osmosis system data by punto de venta
 * @access  Private
 * @query   codigoTienda (required), resourceId (optional)
 */
router.get('/osmosis', getOsmosisSystemByPuntoVenta);

/**
 * @route   GET /api/v2.0/puntoVentas/all
 * @desc    Get all puntos de venta (MongoDB - v2.0 compatible)
 * @access  Private
 */
router.get('/puntoVentas/all', getPuntosVentaV2);

/**
 * @route   GET /api/v2.0/puntoVentas/:id
 * @desc    Get punto de venta detail with osmosis data from PostgreSQL
 * @access  Private
 * @param   id - Can be numeric ID or codigo_tienda
 * NOTE: Using regex to prevent matching /puntoVentas/:id/sensors (sensors routes are in customizationV2Routes)
 */
router.get('/puntoVentas/:id([^/]+)$', getPuntoVentaDetalleV2);

/**
 * @route   GET /api/v2.0/sensors/timeseries
 * @desc    Get sensor time series data for charts
 * @access  Private
 * @query   codigoTienda, sensorName, resourceId, startDate, endDate, interval
 */
router.get('/timeseries', getSensorTimeSeries);

/**
 * @route   GET /api/v2.0/sensors/tiwater
 * @desc    Get latest tiwater sensor data for a punto de venta
 * @access  Private
 * @query   codigoTienda (required)
 */
router.get('/tiwater', getTiwaterSensorData);

export default router;

