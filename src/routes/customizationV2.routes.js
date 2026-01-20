// src/routes/customizationV2.routes.js
// Routes for v2.0 API endpoints using PostgreSQL for customization data

import express from 'express';
import {
  // Metrics
  getMetricsV2,
  getMetricByIdV2,
  addMetricV2,
  updateMetricV2,
  removeMetricV2,
  // Clients
  getClientsV2,
  getClientByIdV2,
  addClientV2,
  updateClientV2,
  removeClientV2,
  // Cities
  getCitiesV2,
  getCityByIdV2,
  addCityV2,
  updateCityV2,
  removeCityV2
} from '../controllers/customizationV2.controller.js';

const router = express.Router();

// ============================================================================
// METRICS ROUTES
// ============================================================================

/**
 * @route   GET /api/v2.0/metrics
 * @desc    Get all metrics (PostgreSQL)
 * @access  Private
 */
router.get('/metrics', getMetricsV2);

/**
 * @route   GET /api/v2.0/metrics/:id
 * @desc    Get metric by ID (PostgreSQL)
 * @access  Private
 */
router.get('/metrics/:id', getMetricByIdV2);

/**
 * @route   POST /api/v2.0/metrics
 * @desc    Create new metric (PostgreSQL)
 * @access  Private
 */
router.post('/metrics', addMetricV2);

/**
 * @route   PATCH /api/v2.0/metrics/:id
 * @desc    Update metric (PostgreSQL)
 * @access  Private
 */
router.patch('/metrics/:id', updateMetricV2);

/**
 * @route   DELETE /api/v2.0/metrics/:id
 * @desc    Delete metric (PostgreSQL)
 * @access  Private
 */
router.delete('/metrics/:id', removeMetricV2);

// ============================================================================
// CLIENTS ROUTES
// ============================================================================

/**
 * @route   GET /api/v2.0/clients
 * @desc    Get all clients (PostgreSQL)
 * @access  Private
 */
router.get('/clients', getClientsV2);

/**
 * @route   GET /api/v2.0/clients/:id
 * @desc    Get client by ID (PostgreSQL)
 * @access  Private
 */
router.get('/clients/:id', getClientByIdV2);

/**
 * @route   POST /api/v2.0/clients
 * @desc    Create new client (PostgreSQL)
 * @access  Private
 */
router.post('/clients', addClientV2);

/**
 * @route   PATCH /api/v2.0/clients/:id
 * @desc    Update client (PostgreSQL)
 * @access  Private
 */
router.patch('/clients/:id', updateClientV2);

/**
 * @route   DELETE /api/v2.0/clients/:id
 * @desc    Delete client (PostgreSQL)
 * @access  Private
 */
router.delete('/clients/:id', removeClientV2);

// ============================================================================
// CITIES ROUTES
// ============================================================================

/**
 * @route   GET /api/v2.0/cities
 * @desc    Get all cities (PostgreSQL)
 * @access  Private
 */
router.get('/cities', getCitiesV2);

/**
 * @route   GET /api/v2.0/cities/:id
 * @desc    Get city by ID (PostgreSQL)
 * @access  Private
 */
router.get('/cities/:id', getCityByIdV2);

/**
 * @route   POST /api/v2.0/cities
 * @desc    Create new city (PostgreSQL)
 * @access  Private
 */
router.post('/cities', addCityV2);

/**
 * @route   PATCH /api/v2.0/cities/:id
 * @desc    Update city (PostgreSQL)
 * @access  Private
 */
router.patch('/cities/:id', updateCityV2);

/**
 * @route   DELETE /api/v2.0/cities/:id
 * @desc    Delete city (PostgreSQL)
 * @access  Private
 */
router.delete('/cities/:id', removeCityV2);

export default router;
