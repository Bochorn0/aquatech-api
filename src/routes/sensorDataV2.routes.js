// src/routes/sensorDataV2.routes.js
// Routes for v2.0 API endpoints using PostgreSQL

import express from 'express';
import {
  getOsmosisSystemByPuntoVenta,
  getPuntoVentaDetalleV2,
  getSensorTimeSeries
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
 * @route   GET /api/v2.0/puntoVentas/:id/detalle
 * @desc    Get punto de venta detail with osmosis data from PostgreSQL
 * @access  Private
 */
router.get('/puntoVentas/:id/detalle', getPuntoVentaDetalleV2);

/**
 * @route   GET /api/v2.0/sensors/timeseries
 * @desc    Get sensor time series data for charts
 * @access  Private
 * @query   codigoTienda, sensorName, resourceId, startDate, endDate, interval
 */
router.get('/timeseries', getSensorTimeSeries);

export default router;

