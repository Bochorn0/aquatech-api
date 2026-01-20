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
 */
router.get('/puntoVentas/:id', getPuntoVentaDetalleV2);

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

