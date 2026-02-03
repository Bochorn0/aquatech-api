// src/controllers/customizationV2.controller.js
// Controller for v2.0 API endpoints using PostgreSQL for customization data

import MetricModel from '../models/postgres/metric.model.js';
import MetricAlertModel from '../models/postgres/metricAlert.model.js';
import ClientModel from '../models/postgres/client.model.js';
import CityModel from '../models/postgres/city.model.js';
import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';
import PuntoVentaSensorModel from '../models/postgres/puntoVentaSensor.model.js';
import SensoresModel from '../models/postgres/sensores.model.js';
import CalidadAguaModel from '../models/postgres/calidadAgua.model.js';
import { query } from '../config/postgres.config.js';

// ============================================================================
// METRICS CONTROLLERS
// ============================================================================

/**
 * Get all metrics (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/metrics
 * @desc    Get all metrics from PostgreSQL
 * @access  Private
 */
export const getMetricsV2 = async (req, res) => {
  let metrics = [];
  let clientMap = new Map();
  let puntoVentaMap = new Map();
  
  try {
    // Extract query parameters for filtering
    const { punto_venta_id, clientId } = req.query;
    
    // Build filters object
    const filters = {};
    if (clientId) {
      filters.clientId = parseInt(clientId, 10);
      if (isNaN(filters.clientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid clientId parameter'
        });
      }
    }
    
    if (punto_venta_id) {
      filters.puntoVentaId = parseInt(punto_venta_id, 10);
      if (isNaN(filters.puntoVentaId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid punto_venta_id parameter'
        });
      }
    }
    
    console.log(`[getMetricsV2] Fetching Metrics from PostgreSQL (v2.0) with filters:`, filters);
    
    // Fetch metrics with filters (limit to reasonable amount)
    try {
      metrics = await MetricModel.find(filters, { limit: 500, offset: 0 });
      console.log(`[getMetricsV2] Found ${metrics.length} metrics`);
    } catch (dbError) {
      console.error('[getMetricsV2] ❌ Database error fetching metrics:', dbError);
      return res.status(500).json({ 
        success: false,
        message: 'Database error fetching metrics',
        error: process.env.NODE_ENV === 'development' ? dbError.message : 'Internal server error'
      });
    }
    
    if (metrics.length === 0) {
      console.log(`[getMetricsV2] No metrics found with filters:`, filters);
      return res.json([]);
    }
    
    // Collect unique client IDs and punto venta IDs from metrics
    const clientIds = [...new Set(metrics.map(m => m.clientId).filter(Boolean))];
    const puntoVentaIds = [...new Set(metrics.map(m => m.punto_venta_id).filter(Boolean))];
    
    console.log(`[getMetricsV2] Need to fetch ${clientIds.length} clients and ${puntoVentaIds.length} puntos de venta`);
    
    // Only fetch clients and puntos de venta that are actually needed
    // Use Promise.all with individual findById calls (safe for limited number of IDs)
    
    // Fetch clients in parallel (limit to prevent too many concurrent queries)
    if (clientIds.length > 0 && clientIds.length <= 100) {
      try {
        const clientPromises = clientIds.map(id => 
          ClientModel.findById(id).catch(err => {
            console.warn(`[getMetricsV2] Error fetching client ${id}:`, err.message);
            return null;
          })
        );
        const clients = await Promise.all(clientPromises);
        clientMap = new Map(
          clients.filter(c => c !== null).map(c => [String(c.id), c.name])
        );
        console.log(`[getMetricsV2] Successfully fetched ${clientMap.size} clients`);
      } catch (err) {
        console.error('[getMetricsV2] ❌ Error fetching clients:', err);
        // Continue without client names if there's an error
      }
    } else if (clientIds.length > 100) {
      console.warn(`[getMetricsV2] Too many client IDs (${clientIds.length}), skipping client name population`);
    }
    
    // Fetch puntos de venta in parallel (limit to prevent too many concurrent queries)
    if (puntoVentaIds.length > 0 && puntoVentaIds.length <= 100) {
      try {
        const puntoVentaPromises = puntoVentaIds.map(id => 
          PuntoVentaModel.findById(id).catch(err => {
            console.warn(`[getMetricsV2] Error fetching punto venta ${id}:`, err.message);
            return null;
          })
        );
        const puntosVenta = await Promise.all(puntoVentaPromises);
        puntoVentaMap = new Map(
          puntosVenta.filter(pv => pv !== null).map(pv => [String(pv.id), pv.name])
        );
        console.log(`[getMetricsV2] Successfully fetched ${puntoVentaMap.size} puntos de venta`);
      } catch (err) {
        console.error('[getMetricsV2] ❌ Error fetching puntos de venta:', err);
        // Continue without punto venta names if there's an error
      }
    } else if (puntoVentaIds.length > 100) {
      console.warn(`[getMetricsV2] Too many punto venta IDs (${puntoVentaIds.length}), skipping punto venta name population`);
    }
    
    // Map metrics with client names and punto venta names
    const mappedResults = metrics.map(metric => {
      try {
        return {
          ...metric,
          client_name: metric.clientId ? (clientMap.get(String(metric.clientId)) || '') : '',
          punto_venta_name: metric.punto_venta_id ? (puntoVentaMap.get(String(metric.punto_venta_id)) || '') : ''
        };
      } catch (mapError) {
        console.warn(`[getMetricsV2] Error mapping metric ${metric.id}:`, mapError.message);
        return metric; // Return metric without mapped names if mapping fails
      }
    });
    
    console.log(`[getMetricsV2] ✅ Successfully returning ${mappedResults.length} metrics`);
    return res.json(mappedResults);
  } catch (error) {
    console.error('[getMetricsV2] ❌ Unexpected error fetching metrics from PostgreSQL (v2.0):', error);
    console.error('[getMetricsV2] Error stack:', error.stack);
    
    // Ensure response is sent even if there's an error
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Error fetching metrics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    } else {
      console.error('[getMetricsV2] Response already sent, cannot send error response');
    }
  }
};

/**
 * Get metric by ID (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/metrics/:id
 * @desc    Get a specific metric by ID
 * @access  Private
 */
export const getMetricByIdV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const metric = await MetricModel.findById(parseInt(id, 10));
    
    if (!metric) {
      return res.status(404).json({ 
        success: false,
        message: 'Métrica no encontrada' 
      });
    }
    
    res.json(metric);
  } catch (error) {
    console.error('Error fetching metric from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching metric',
      error: error.message 
    });
  }
};

/**
 * Create metric (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/metrics
 * @desc    Create a new metric
 * @access  Private
 */
export const addMetricV2 = async (req, res) => {
  try {
    const metricData = req.body;
    
    // Validate new structure fields
    if (metricData.metric_type && !metricData.metric_name) {
      return res.status(400).json({ message: 'El nombre de métrica es requerido cuando se especifica el tipo' });
    }
    
    if (metricData.metric_type && !metricData.sensor_type) {
      return res.status(400).json({ message: 'El tipo de sensor es requerido cuando se especifica el tipo de métrica' });
    }
    
    // Validate rules if provided
    if (metricData.rules && Array.isArray(metricData.rules)) {
      for (const rule of metricData.rules) {
        if (rule.min === null && rule.max === null) {
          return res.status(400).json({ message: 'Cada regla debe tener al menos un valor mínimo o máximo' });
        }
        if (!rule.color || !rule.label) {
          return res.status(400).json({ message: 'Cada regla debe tener un color y una etiqueta' });
        }
      }
    }
    
    // Convert cliente (MongoDB ObjectId string) to clientId (PostgreSQL integer)
    const clientId = metricData.cliente ? parseInt(metricData.cliente, 10) : null;
    if (isNaN(clientId) && metricData.cliente) {
      return res.status(400).json({ message: 'Cliente ID inválido' });
    }
    
    // Convert punto_venta_id (string) to integer
    const puntoVentaId = metricData.punto_venta_id ? parseInt(metricData.punto_venta_id, 10) : null;
    if (isNaN(puntoVentaId) && metricData.punto_venta_id) {
      return res.status(400).json({ message: 'Punto de Venta ID inválido' });
    }

    // Whitelist: only pass fields for a single new metric. Ensure rules/conditions are stored in full.
    const rulesForCreate = Array.isArray(metricData.rules)
      ? metricData.rules
      : (metricData.rules != null ? [metricData.rules] : null);
    const conditionsForCreate =
      metricData.conditions != null && typeof metricData.conditions === 'object'
        ? metricData.conditions
        : null;

    const createPayload = {
      clientId: clientId ?? metricData.clientId ?? null,
      punto_venta_id: puntoVentaId ?? metricData.punto_venta_id ?? null,
      metric_name: metricData.metric_name ?? null,
      metric_type: metricData.metric_type ?? null,
      sensor_type: metricData.sensor_type ?? null,
      sensor_unit: metricData.sensor_unit ?? null,
      rules: rulesForCreate,
      conditions: conditionsForCreate,
      enabled: metricData.enabled !== undefined ? metricData.enabled : true,
      read_only: metricData.read_only !== undefined ? metricData.read_only : false,
      display_order: Number(metricData.display_order) || 0
    };

    const newMetric = await MetricModel.create(createPayload);
    
    res.status(201).json(newMetric);
  } catch (error) {
    console.error('Error creating metric in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating metric',
      error: error.message 
    });
  }
};

/**
 * Update metric (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/metrics/:id
 * @desc    Update a metric
 * @access  Private
 */
export const updateMetricV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const metricData = req.body;
    
    // Validate rules if provided
    if (metricData.rules && Array.isArray(metricData.rules)) {
      for (const rule of metricData.rules) {
        if (rule.min === null && rule.max === null) {
          return res.status(400).json({ message: 'Cada regla debe tener al menos un valor mínimo o máximo' });
        }
        if (!rule.color || !rule.label) {
          return res.status(400).json({ message: 'Cada regla debe tener un color y una etiqueta' });
        }
      }
    }

    // Convert punto_venta_id to integer if needed
    let puntoVentaId = metricData.punto_venta_id;
    if (puntoVentaId != null) {
      const parsed = parseInt(puntoVentaId, 10);
      if (!isNaN(parsed)) puntoVentaId = parsed;
    }

    // Whitelist: only pass updatable fields for this metric (never spread full body to avoid overwriting other metrics)
    const updatePayload = {};
    if (metricData.cliente !== undefined) {
      const cId = parseInt(metricData.cliente, 10);
      if (!isNaN(cId)) updatePayload.clientId = cId;
    } else if (metricData.clientId !== undefined) {
      updatePayload.clientId = metricData.clientId;
    }
    if (puntoVentaId !== undefined) updatePayload.punto_venta_id = puntoVentaId;
    if (metricData.metric_name !== undefined) updatePayload.metric_name = metricData.metric_name;
    if (metricData.metric_type !== undefined) updatePayload.metric_type = metricData.metric_type;
    if (metricData.sensor_type !== undefined) updatePayload.sensor_type = metricData.sensor_type;
    if (metricData.sensor_unit !== undefined) updatePayload.sensor_unit = metricData.sensor_unit;
    if (metricData.rules !== undefined) {
      updatePayload.rules = Array.isArray(metricData.rules)
        ? metricData.rules
        : (metricData.rules != null ? [metricData.rules] : null);
    }
    if (metricData.conditions !== undefined) {
      updatePayload.conditions =
        metricData.conditions != null && typeof metricData.conditions === 'object'
          ? metricData.conditions
          : null;
    }
    if (metricData.enabled !== undefined) updatePayload.enabled = metricData.enabled;
    if (metricData.read_only !== undefined) updatePayload.read_only = metricData.read_only;
    if (metricData.display_order !== undefined)
      updatePayload.display_order = Number(metricData.display_order) ?? metricData.display_order;

    const updatedMetric = await MetricModel.update(parseInt(id, 10), updatePayload);
    
    if (!updatedMetric) {
      return res.status(404).json({ 
        success: false,
        message: 'Métrica no encontrada' 
      });
    }
    
    res.json(updatedMetric);
  } catch (error) {
    console.error('Error updating metric in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating metric',
      error: error.message 
    });
  }
};

/**
 * Delete metric (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/metrics/:id
 * @desc    Delete a metric
 * @access  Private
 */
export const removeMetricV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MetricModel.delete(parseInt(id, 10));
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Métrica no encontrada' 
      });
    }
    
    res.json({ success: true, message: 'Métrica eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting metric from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting metric',
      error: error.message 
    });
  }
};

// ============================================================================
// METRIC ALERTS CONTROLLERS
// ============================================================================

/**
 * Get all alerts for a metric (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/metrics/:id/alerts
 * @desc    Get all alerts for a specific metric
 * @access  Private
 */
export const getMetricAlertsV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const metricId = parseInt(id, 10);
    
    if (isNaN(metricId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid metric ID' 
      });
    }
    
    const alerts = await MetricAlertModel.findByMetricId(metricId);
    res.json(alerts);
  } catch (error) {
    console.error('Error getting metric alerts (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting metric alerts',
      error: error.message 
    });
  }
};

/**
 * Add alert to metric (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/metrics/:id/alerts
 * @desc    Create a new alert for a metric
 * @access  Private
 */
export const addMetricAlertV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const metricId = parseInt(id, 10);
    
    if (isNaN(metricId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid metric ID' 
      });
    }
    
    const {
      usuario,
      correo,
      celular,
      celularAlert,
      dashboardAlert,
      emailAlert,
      preventivo,
      correctivo
    } = req.body;
    
    // Validate required fields
    if (!usuario || !correo) {
      return res.status(400).json({ 
        success: false,
        message: 'Usuario y correo son requeridos' 
      });
    }
    
    // Validate that at least one alert type is enabled
    if (!celularAlert && !dashboardAlert && !emailAlert) {
      return res.status(400).json({ 
        success: false,
        message: 'Al menos un tipo de alerta debe estar habilitado' 
      });
    }
    
    // Validate that celular is provided if celularAlert is true
    if (celularAlert && !celular) {
      return res.status(400).json({ 
        success: false,
        message: 'Celular es requerido cuando celular_alert está habilitado' 
      });
    }
    
    // Validate that at least one alert type (preventivo or correctivo) is enabled
    if (!preventivo && !correctivo) {
      return res.status(400).json({ 
        success: false,
        message: 'Al menos uno de preventivo o correctivo debe estar habilitado' 
      });
    }
    
    const newAlert = await MetricAlertModel.create({
      metricId,
      usuario,
      correo,
      celular,
      celularAlert: celularAlert || false,
      dashboardAlert: dashboardAlert || false,
      emailAlert: emailAlert || false,
      preventivo: preventivo || false,
      correctivo: correctivo || false
    });
    
    res.status(201).json(newAlert);
  } catch (error) {
    console.error('Error creating metric alert (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating metric alert',
      error: error.message 
    });
  }
};

/**
 * Update metric alert (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/metrics/:id/alerts/:alertId
 * @desc    Update a metric alert
 * @access  Private
 */
export const updateMetricAlertV2 = async (req, res) => {
  try {
    const { id, alertId } = req.params;
    const metricId = parseInt(id, 10);
    const alertIdInt = parseInt(alertId, 10);
    
    if (isNaN(metricId) || isNaN(alertIdInt)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid ID' 
      });
    }
    
    // Verify alert belongs to metric
    const existingAlert = await MetricAlertModel.findById(alertIdInt);
    if (!existingAlert || parseInt(existingAlert.metricId, 10) !== metricId) {
      return res.status(404).json({ 
        success: false,
        message: 'Alert no encontrado' 
      });
    }
    
    const {
      usuario,
      correo,
      celular,
      celularAlert,
      dashboardAlert,
      emailAlert,
      preventivo,
      correctivo
    } = req.body;
    
    // Validate that at least one alert type is enabled
    if (celularAlert !== undefined && dashboardAlert !== undefined && emailAlert !== undefined) {
      if (!celularAlert && !dashboardAlert && !emailAlert) {
        return res.status(400).json({ 
          success: false,
          message: 'Al menos un tipo de alerta debe estar habilitado' 
        });
      }
    }
    
    // Validate that celular is provided if celularAlert is being set to true
    if (celularAlert === true && !celular && !existingAlert.celular) {
      return res.status(400).json({ 
        success: false,
        message: 'Celular es requerido cuando celular_alert está habilitado' 
      });
    }
    
    // Validate that at least one alert type (preventivo or correctivo) is enabled
    if (preventivo !== undefined && correctivo !== undefined) {
      if (!preventivo && !correctivo) {
        return res.status(400).json({ 
          success: false,
          message: 'Al menos uno de preventivo o correctivo debe estar habilitado' 
        });
      }
    }
    
    const updatedAlert = await MetricAlertModel.update(alertIdInt, {
      usuario,
      correo,
      celular,
      celularAlert,
      dashboardAlert,
      emailAlert,
      preventivo,
      correctivo
    });
    
    if (!updatedAlert) {
      return res.status(404).json({ 
        success: false,
        message: 'Alert no encontrado' 
      });
    }
    
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error updating metric alert (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating metric alert',
      error: error.message 
    });
  }
};

/**
 * Delete metric alert (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/metrics/:id/alerts/:alertId
 * @desc    Delete a metric alert
 * @access  Private
 */
export const removeMetricAlertV2 = async (req, res) => {
  try {
    const { id, alertId } = req.params;
    const metricId = parseInt(id, 10);
    const alertIdInt = parseInt(alertId, 10);
    
    if (isNaN(metricId) || isNaN(alertIdInt)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid ID' 
      });
    }
    
    // Verify alert belongs to metric
    const existingAlert = await MetricAlertModel.findById(alertIdInt);
    if (!existingAlert || parseInt(existingAlert.metricId, 10) !== metricId) {
      return res.status(404).json({ 
        success: false,
        message: 'Alert no encontrado' 
      });
    }
    
    const deleted = await MetricAlertModel.delete(alertIdInt);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Alert no encontrado' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Alert eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error deleting metric alert (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting metric alert',
      error: error.message 
    });
  }
};

// ============================================================================
// CLIENTS CONTROLLERS
// ============================================================================

/**
 * Get all clients (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/clients
 * @desc    Get all clients from PostgreSQL
 * @access  Private
 */
export const getClientsV2 = async (req, res) => {
  try {
    console.log('Fetching Clients from PostgreSQL (v2.0)...');
    
    const clients = await ClientModel.find({}, { limit: 1000, offset: 0 });
    
    console.log(`[getClientsV2] ✅ Found ${clients.length} clients from PostgreSQL`);
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching clients',
      error: error.message 
    });
  }
};

/**
 * Get client by ID (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/clients/:id
 * @desc    Get a specific client by ID
 * @access  Private
 */
export const getClientByIdV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await ClientModel.findById(parseInt(id, 10));
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error fetching client from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching client',
      error: error.message 
    });
  }
};

/**
 * Create client (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/clients
 * @desc    Create a new client
 * @access  Private
 */
export const addClientV2 = async (req, res) => {
  try {
    const clientData = req.body;
    delete clientData._id;
    
    const newClient = await ClientModel.create(clientData);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client in PostgreSQL (v2.0):', error);
    res.status(error.message.includes('already exists') ? 409 : 500).json({ 
      success: false,
      message: error.message || 'Error creating client',
      error: error.message 
    });
  }
};

/**
 * Update client (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/clients/:id
 * @desc    Update a client
 * @access  Private
 */
export const updateClientV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const clientData = req.body;
    delete clientData._id;
    
    const updatedClient = await ClientModel.update(parseInt(id, 10), clientData);
    
    if (!updatedClient) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }
    
    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating client',
      error: error.message 
    });
  }
};

/**
 * Delete client (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/clients/:id
 * @desc    Delete a client
 * @access  Private
 */
export const removeClientV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ClientModel.delete(parseInt(id, 10));
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }
    
    res.json({ success: true, message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting client from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting client',
      error: error.message 
    });
  }
};

// ============================================================================
// CITIES CONTROLLERS
// ============================================================================

/**
 * Get all cities (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/cities
 * @desc    Get all cities from PostgreSQL
 * @access  Private
 */
export const getCitiesV2 = async (req, res) => {
  try {
    console.log('Fetching Cities from PostgreSQL (v2.0)...');
    
    const cities = await CityModel.find({}, { limit: 1000, offset: 0 });
    
    console.log(`[getCitiesV2] ✅ Found ${cities.length} cities from PostgreSQL`);
    res.json(cities);
  } catch (error) {
    console.error('Error fetching cities from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching cities',
      error: error.message 
    });
  }
};

/**
 * Get city by ID (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/cities/:id
 * @desc    Get a specific city by ID
 * @access  Private
 */
export const getCityByIdV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityModel.findById(parseInt(id, 10));
    
    if (!city) {
      return res.status(404).json({ 
        success: false,
        message: 'Ciudad no encontrada' 
      });
    }
    
    res.json(city);
  } catch (error) {
    console.error('Error fetching city from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching city',
      error: error.message 
    });
  }
};

/**
 * Create city (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/cities
 * @desc    Create a new city
 * @access  Private
 */
export const addCityV2 = async (req, res) => {
  try {
    const cityData = req.body;
    delete cityData._id;
    
    const newCity = await CityModel.create(cityData);
    res.status(201).json(newCity);
  } catch (error) {
    console.error('Error creating city in PostgreSQL (v2.0):', error);
    res.status(error.message.includes('already exists') ? 409 : 500).json({ 
      success: false,
      message: error.message || 'Error creating city',
      error: error.message 
    });
  }
};

/**
 * Update city (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/cities/:id
 * @desc    Update a city
 * @access  Private
 */
export const updateCityV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const cityData = req.body;
    delete cityData._id;
    
    const updatedCity = await CityModel.update(parseInt(id, 10), cityData);
    
    if (!updatedCity) {
      return res.status(404).json({ 
        success: false,
        message: 'Ciudad no encontrada' 
      });
    }
    
    res.json(updatedCity);
  } catch (error) {
    console.error('Error updating city in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating city',
      error: error.message 
    });
  }
};

/**
 * Delete city (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/cities/:id
 * @desc    Delete a city
 * @access  Private
 */
export const removeCityV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CityModel.delete(parseInt(id, 10));
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Ciudad no encontrada' 
      });
    }
    
    res.json({ success: true, message: 'Ciudad eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting city from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting city',
      error: error.message 
    });
  }
};

// ============================================================================
// PUNTOVENTA CONTROLLERS
// ============================================================================

/**
 * Create puntoVenta (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/puntoVentas
 * @desc    Create a new punto de venta
 * @access  Private
 */
export const addPuntoVentaV2 = async (req, res) => {
  try {
    const puntoVentaData = req.body;
    
    // Convert cliente to clientId if needed
    if (puntoVentaData.cliente) {
      const clientId = parseInt(puntoVentaData.cliente, 10);
      if (!isNaN(clientId)) {
        puntoVentaData.clientId = clientId;
      }
    }
    
    // Handle city - fetch city data and update lat/long/address
    if (puntoVentaData.city) {
      try {
        const cityId = typeof puntoVentaData.city === 'string' 
          ? parseInt(puntoVentaData.city, 10) 
          : puntoVentaData.city;
        if (!isNaN(cityId)) {
          const cityData = await CityModel.findById(cityId);
          if (cityData) {
            // Update lat and long from city data
            puntoVentaData.lat = cityData.lat || puntoVentaData.lat;
            puntoVentaData.long = cityData.lon || puntoVentaData.long;
            
            // Update address with city information
            let addressObj = {};
            if (puntoVentaData.address) {
              try {
                addressObj = typeof puntoVentaData.address === 'string' 
                  ? JSON.parse(puntoVentaData.address) 
                  : puntoVentaData.address;
              } catch (e) {
                addressObj = {};
              }
            }
            addressObj.city = cityData.city || addressObj.city;
            addressObj.state = cityData.state || addressObj.state;
            addressObj.lat = cityData.lat || addressObj.lat;
            addressObj.lon = cityData.lon || addressObj.lon;
            puntoVentaData.address = addressObj;
          }
        }
      } catch (error) {
        console.warn(`[addPuntoVentaV2] Error fetching city ${puntoVentaData.city}:`, error.message);
      }
    }
    
    // Handle address - convert to JSON string if it's an object
    if (puntoVentaData.address && typeof puntoVentaData.address === 'object') {
      puntoVentaData.address = JSON.stringify(puntoVentaData.address);
    }
    
    // Handle meta - convert to JSON string if it's an object
    if (puntoVentaData.meta && typeof puntoVentaData.meta === 'object') {
      puntoVentaData.meta = JSON.stringify(puntoVentaData.meta);
    }
    
    // Extract codigo_tienda if provided
    if (puntoVentaData.codigo_tienda) {
      puntoVentaData.code = puntoVentaData.codigo_tienda;
    }
    
    const newPuntoVenta = await PuntoVentaModel.getOrCreate(puntoVentaData);
    
    res.status(201).json(newPuntoVenta);
  } catch (error) {
    console.error('Error creating punto de venta in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating punto de venta',
      error: error.message 
    });
  }
};

/**
 * Update puntoVenta (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/puntoVentas/:id
 * @desc    Update a punto de venta
 * @access  Private
 */
export const updatePuntoVentaV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const puntoVentaData = req.body;
    
    // Convert cliente to clientId if needed
    if (puntoVentaData.cliente) {
      const clientId = parseInt(puntoVentaData.cliente, 10);
      if (!isNaN(clientId)) {
        puntoVentaData.clientId = clientId;
      }
    }
    
    // Handle city - fetch city data and update lat/long/address
    if (puntoVentaData.city) {
      try {
        const cityId = typeof puntoVentaData.city === 'string' 
          ? parseInt(puntoVentaData.city, 10) 
          : puntoVentaData.city;
        if (!isNaN(cityId)) {
          const cityData = await CityModel.findById(cityId);
          if (cityData) {
            // Update lat and long from city data
            puntoVentaData.lat = cityData.lat || puntoVentaData.lat;
            puntoVentaData.long = cityData.lon || puntoVentaData.long;
            
            // Update address with city information
            let addressObj = {};
            if (puntoVentaData.address) {
              try {
                addressObj = typeof puntoVentaData.address === 'string' 
                  ? JSON.parse(puntoVentaData.address) 
                  : puntoVentaData.address;
              } catch (e) {
                addressObj = {};
              }
            }
            addressObj.city = cityData.city || addressObj.city;
            addressObj.state = cityData.state || addressObj.state;
            addressObj.lat = cityData.lat || addressObj.lat;
            addressObj.lon = cityData.lon || addressObj.lon;
            puntoVentaData.address = addressObj;
          }
        }
      } catch (error) {
        console.warn(`[updatePuntoVentaV2] Error fetching city ${puntoVentaData.city}:`, error.message);
      }
    }
    
    // Handle address - convert to JSON string if it's an object
    if (puntoVentaData.address && typeof puntoVentaData.address === 'object') {
      puntoVentaData.address = JSON.stringify(puntoVentaData.address);
    }
    
    // Handle meta - convert to JSON string if it's an object
    if (puntoVentaData.meta && typeof puntoVentaData.meta === 'object') {
      puntoVentaData.meta = JSON.stringify(puntoVentaData.meta);
    }
    
    // Handle codigo_tienda
    if (puntoVentaData.codigo_tienda) {
      puntoVentaData.code = puntoVentaData.codigo_tienda;
    }
    
    const updatedPuntoVenta = await PuntoVentaModel.update(parseInt(id, 10), puntoVentaData);
    
    if (!updatedPuntoVenta) {
      return res.status(404).json({ 
        success: false,
        message: 'Punto de venta no encontrado' 
      });
    }
    
    res.json(updatedPuntoVenta);
  } catch (error) {
    console.error('Error updating punto de venta in PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating punto de venta',
      error: error.message 
    });
  }
};

/**
 * Delete puntoVenta (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/puntoVentas/:id
 * @desc    Delete a punto de venta
 * @access  Private
 */
export const removePuntoVentaV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PuntoVentaModel.delete(parseInt(id, 10));
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Punto de venta no encontrado' 
      });
    }
    
    res.json({ success: true, message: 'Punto de venta eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting punto de venta from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting punto de venta',
      error: error.message 
    });
  }
};

// ============================================================================
// PUNTOVENTA SENSORS CONTROLLERS
// ============================================================================

/**
 * Get all sensors for a puntoVenta (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/puntoVentas/:id/sensors
 * @desc    Get all sensor configurations for a punto de venta with latest readings
 * @access  Private
 */
export const getPuntoVentaSensorsV2 = async (req, res) => {
  try {
    console.log('[getPuntoVentaSensorsV2] Request received:', req.params);
    const { id } = req.params;
    const puntoVentaId = parseInt(id, 10);
    
    if (isNaN(puntoVentaId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid puntoVenta ID' 
      });
    }
    
    console.log('[getPuntoVentaSensorsV2] Fetching sensors for puntoVenta ID:', puntoVentaId);

    // Get all sensor configurations for this puntoVenta
    const sensors = await PuntoVentaSensorModel.findByPuntoVentaId(puntoVentaId);
    
    // Get puntoVenta to get codigo_tienda
    const puntoVenta = await PuntoVentaModel.findById(puntoVentaId);
    if (!puntoVenta) {
      return res.status(404).json({ 
        success: false,
        message: 'Punto de venta no encontrado' 
      });
    }

    const codigoTienda = (puntoVenta.codigo_tienda || puntoVenta.code || '').toUpperCase();

    // Track invalid timestamps for summary log (use array to track in async context)
    const invalidTimestamps = [];

    // Get latest readings for each sensor
    const sensorsWithReadings = await Promise.all(
      sensors.map(async (sensor) => {
        try {
          // Get latest reading for this sensor type
          let latestReadingQuery;
          let params;
          
          if (sensor.resourceId && sensor.resourceType) {
            latestReadingQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND type = $2
                AND resourceId = $3
                AND resourceType = $4
              ORDER BY timestamp DESC
              LIMIT 1
            `;
            params = [codigoTienda, sensor.sensorType, sensor.resourceId, sensor.resourceType];
          } else if (sensor.resourceId) {
            latestReadingQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND type = $2
                AND resourceId = $3
                AND (resourceType IS NULL OR resourceType = $4)
              ORDER BY timestamp DESC
              LIMIT 1
            `;
            params = [codigoTienda, sensor.sensorType, sensor.resourceId, sensor.resourceType || null];
          } else if (sensor.resourceType) {
            latestReadingQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND type = $2
                AND (resourceId IS NULL OR resourceId = $3)
                AND resourceType = $4
              ORDER BY timestamp DESC
              LIMIT 1
            `;
            params = [codigoTienda, sensor.sensorType, sensor.resourceId || null, sensor.resourceType];
          } else {
            latestReadingQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND type = $2
                AND (resourceId IS NULL)
                AND (resourceType IS NULL)
              ORDER BY timestamp DESC
              LIMIT 1
            `;
            params = [codigoTienda, sensor.sensorType];
          }

          const readingResult = await query(latestReadingQuery, params);
          let latestReading = null;
          if (readingResult.rows.length > 0) {
            const row = readingResult.rows[0];
            
            // Format timestamp - handle invalid dates
            let formattedTimestamp = row.timestamp;
            if (row.timestamp) {
              try {
                const date = new Date(row.timestamp);
                // Check if date is valid and year is reasonable
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  if (year >= 1900 && year <= 2100) {
                    formattedTimestamp = date.toISOString();
                  } else {
                    // Invalid year, use createdAt as fallback
                    invalidTimestamps.push(sensor.id);
                    formattedTimestamp = row.createdat ? new Date(row.createdat).toISOString() : null;
                  }
                } else {
                  // Invalid date, use createdAt as fallback
                  invalidTimestamps.push(sensor.id);
                  formattedTimestamp = row.createdat ? new Date(row.createdat).toISOString() : null;
                }
              } catch (error) {
                // Invalid date, use createdAt as fallback
                invalidTimestamps.push(sensor.id);
                formattedTimestamp = row.createdat ? new Date(row.createdat).toISOString() : null;
              }
            }
            
            latestReading = {
              id: row.id,
              name: row.name,
              value: row.value !== null ? parseFloat(row.value) : null,
              type: row.type,
              timestamp: formattedTimestamp,
              createdAt: row.createdat ? new Date(row.createdat).toISOString() : null,
              updatedAt: row.updatedat ? new Date(row.updatedat).toISOString() : null,
              meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
              resourceId: row.resourceid,
              resourceType: row.resourcetype,
              codigoTienda: row.codigotienda
            };
          }

          return {
            ...sensor,
            latestReading: latestReading ? {
              value: latestReading.value,
              timestamp: latestReading.timestamp,
              createdAt: latestReading.createdAt
            } : null
          };
        } catch (error) {
          console.warn(`[getPuntoVentaSensorsV2] Error getting reading for sensor ${sensor.id}:`, error.message);
          return {
            ...sensor,
            latestReading: null
          };
        }
      })
    );

    // Log summary if there were invalid timestamps (only once per request)
    if (invalidTimestamps.length > 0) {
      console.warn(`[getPuntoVentaSensorsV2] ${invalidTimestamps.length} sensor(s) had invalid timestamps, used createdAt as fallback`);
    }

    res.json(sensorsWithReadings);
  } catch (error) {
    console.error('Error getting sensors for punto de venta (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting sensors',
      error: error.message 
    });
  }
};

/**
 * Get historical sensor readings for all sensors in a puntoVenta (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/puntoVentas/:id/sensors/readings
 * @desc    Get historical readings for all sensors with time range filter
 * @access  Private
 * @query   timeRange: 'today' | 'week' | 'month' (optional, defaults to 'today')
 */
export const getPuntoVentaSensorsReadingsV2 = async (req, res) => {
  try {
    console.log('[getPuntoVentaSensorsReadingsV2] Request received:', req.params, req.query);
    const { id } = req.params;
    const { timeRange = 'today' } = req.query;
    const puntoVentaId = parseInt(id, 10);
    
    if (isNaN(puntoVentaId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid puntoVenta ID' 
      });
    }
    
    console.log('[getPuntoVentaSensorsReadingsV2] Fetching readings for puntoVenta ID:', puntoVentaId, 'timeRange:', timeRange);

    // Get all sensor configurations for this puntoVenta
    const sensors = await PuntoVentaSensorModel.findByPuntoVentaId(puntoVentaId);
    
    // Get puntoVenta to get codigo_tienda
    const puntoVenta = await PuntoVentaModel.findById(puntoVentaId);
    if (!puntoVenta) {
      return res.status(404).json({ 
        success: false,
        message: 'Punto de venta no encontrado' 
      });
    }

    const codigoTienda = (puntoVenta.codigo_tienda || puntoVenta.code || '').toUpperCase();

    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'today':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
    }

    console.log('[getPuntoVentaSensorsReadingsV2] Date range:', startDate.toISOString(), 'to', now.toISOString());

    // Get historical readings for each sensor
    const sensorsWithReadings = await Promise.all(
      sensors.map(async (sensor) => {
        try {
          // Build query based on sensor configuration
          let readingsQuery;
          let params;
          
          if (sensor.resourceId && sensor.resourceType) {
            readingsQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND resourceType = $2
                AND resourceId = $3
                AND name = $4
                AND (
                  (timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 AND timestamp >= $5)
                  OR (timestamp IS NULL AND createdat >= $5)
                  OR (timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) NOT BETWEEN 2000 AND 3000 AND createdat >= $5)
                )
              ORDER BY 
                CASE 
                  WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 
                  THEN timestamp 
                  ELSE createdat 
                END DESC
              LIMIT 1000
            `;
            params = [
              codigoTienda,
              sensor.resourceType,
              sensor.resourceId,
              sensor.sensorName || sensor.sensor_name,
              startDate
            ];
          } else {
            readingsQuery = `
              SELECT * FROM sensores
              WHERE codigoTienda = $1
                AND type = $2
                AND (
                  (timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 AND timestamp >= $3)
                  OR (timestamp IS NULL AND createdat >= $3)
                  OR (timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) NOT BETWEEN 2000 AND 3000 AND createdat >= $3)
                )
              ORDER BY 
                CASE 
                  WHEN timestamp IS NOT NULL AND EXTRACT(YEAR FROM timestamp) BETWEEN 2000 AND 3000 
                  THEN timestamp 
                  ELSE createdat 
                END DESC
              LIMIT 1000
            `;
            params = [
              codigoTienda,
              sensor.sensorType || sensor.sensor_type,
              startDate
            ];
          }

          const { rows: readings } = await query(readingsQuery, params);
          
          // Get the latest reading
          let latestReading = null;
          if (readings.length > 0) {
            const latest = readings[0];
            const isValidTimestamp = latest.timestamp && 
              new Date(latest.timestamp).getFullYear() >= 2000 && 
              new Date(latest.timestamp).getFullYear() <= 3000;
            
            latestReading = {
              value: latest.value,
              timestamp: isValidTimestamp ? latest.timestamp : latest.createdat,
              createdAt: latest.createdat
            };
          }

          return {
            ...sensor,
            latestReading,
            readingsCount: readings.length,
            readings: readings.map(r => ({
              value: r.value,
              timestamp: r.timestamp && 
                new Date(r.timestamp).getFullYear() >= 2000 && 
                new Date(r.timestamp).getFullYear() <= 3000 
                ? r.timestamp 
                : r.createdat,
              createdAt: r.createdat
            }))
          };
        } catch (error) {
          console.warn(`[getPuntoVentaSensorsReadingsV2] Error getting readings for sensor ${sensor.id}:`, error.message);
          return {
            ...sensor,
            latestReading: null,
            readingsCount: 0,
            readings: []
          };
        }
      })
    );

    console.log('[getPuntoVentaSensorsReadingsV2] Returning', sensorsWithReadings.length, 'sensors with readings');
    res.json(sensorsWithReadings);
  } catch (error) {
    console.error('Error getting sensor readings for punto de venta (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting sensor readings',
      error: error.message 
    });
  }
};

/**
 * Add sensor configuration to puntoVenta (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/puntoVentas/:id/sensors
 * @desc    Manually add a sensor configuration
 * @access  Private
 */
export const addPuntoVentaSensorV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const puntoVentaId = parseInt(id, 10);
    const sensorData = req.body;
    
    if (isNaN(puntoVentaId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid puntoVenta ID' 
      });
    }

    // Verify puntoVenta exists
    const puntoVenta = await PuntoVentaModel.findById(puntoVentaId);
    if (!puntoVenta) {
      return res.status(404).json({ 
        success: false,
        message: 'Punto de venta no encontrado' 
      });
    }

    const newSensor = await PuntoVentaSensorModel.create({
      punto_venta_id: puntoVentaId,
      sensor_name: sensorData.sensorName || sensorData.sensor_name,
      sensor_type: sensorData.sensorType || sensorData.sensor_type,
      resource_id: sensorData.resourceId || sensorData.resource_id || null,
      resource_type: sensorData.resourceType || sensorData.resource_type || null,
      label: sensorData.label || null,
      unit: sensorData.unit || null,
      min_value: sensorData.minValue || sensorData.min_value || null,
      max_value: sensorData.maxValue || sensorData.max_value || null,
      enabled: sensorData.enabled !== undefined ? sensorData.enabled : true,
      meta: sensorData.meta || null
    });

    res.status(201).json(newSensor);
  } catch (error) {
    console.error('Error adding sensor to punto de venta (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding sensor',
      error: error.message 
    });
  }
};

/**
 * Update sensor configuration (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/puntoVentas/:id/sensors/:sensorId
 * @desc    Update a sensor configuration
 * @access  Private
 */
export const updatePuntoVentaSensorV2 = async (req, res) => {
  try {
    const { id, sensorId } = req.params;
    const puntoVentaId = parseInt(id, 10);
    const sensorConfigId = parseInt(sensorId, 10);
    const sensorData = req.body;
    
    if (isNaN(puntoVentaId) || isNaN(sensorConfigId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid ID' 
      });
    }

    // Verify sensor belongs to puntoVenta
    const sensor = await PuntoVentaSensorModel.findById(sensorConfigId);
    if (!sensor || parseInt(sensor.puntoVentaId, 10) !== puntoVentaId) {
      return res.status(404).json({ 
        success: false,
        message: 'Sensor no encontrado' 
      });
    }

    const updatedSensor = await PuntoVentaSensorModel.update(sensorConfigId, {
      sensor_name: sensorData.sensorName || sensorData.sensor_name,
      label: sensorData.label,
      unit: sensorData.unit,
      min_value: sensorData.minValue || sensorData.min_value,
      max_value: sensorData.maxValue || sensorData.max_value,
      enabled: sensorData.enabled,
      meta: sensorData.meta
    });

    if (!updatedSensor) {
      return res.status(404).json({ 
        success: false,
        message: 'Sensor no encontrado' 
      });
    }

    res.json(updatedSensor);
  } catch (error) {
    console.error('Error updating sensor (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating sensor',
      error: error.message 
    });
  }
};

/**
 * Delete sensor configuration (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/puntoVentas/:id/sensors/:sensorId
 * @desc    Remove a sensor configuration
 * @access  Private
 */
export const removePuntoVentaSensorV2 = async (req, res) => {
  try {
    const { id, sensorId } = req.params;
    const puntoVentaId = parseInt(id, 10);
    const sensorConfigId = parseInt(sensorId, 10);
    
    if (isNaN(puntoVentaId) || isNaN(sensorConfigId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid ID' 
      });
    }

    // Verify sensor belongs to puntoVenta
    const sensor = await PuntoVentaSensorModel.findById(sensorConfigId);
    if (!sensor || parseInt(sensor.puntoVentaId, 10) !== puntoVentaId) {
      return res.status(404).json({ 
        success: false,
        message: 'Sensor no encontrado' 
      });
    }

    const deleted = await PuntoVentaSensorModel.delete(sensorConfigId);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Sensor no encontrado' 
      });
    }

    res.json({ success: true, message: 'Sensor eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting sensor (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting sensor',
      error: error.message 
    });
  }
};

// ============================================================================
// CALIDAD AGUA CONTROLLERS
// ============================================================================

/**
 * Get all water quality records (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/calidad-agua
 * @desc    Get all water quality records from PostgreSQL
 * @access  Private
 */
export const getCalidadAguaV2 = async (req, res) => {
  try {
    const { estado, ciudad, municipio, owner } = req.query;
    
    const filters = {};
    if (estado) filters.estado = estado;
    if (ciudad) filters.ciudad = ciudad;
    if (municipio) filters.municipio = municipio;
    if (owner) filters.owner = owner;
    
    const records = await CalidadAguaModel.find(filters);
    
    console.log(`[getCalidadAguaV2] ✅ Found ${records.length} water quality records from PostgreSQL`);
    
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('[getCalidadAguaV2] ❌ Error fetching water quality records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching water quality records',
      error: error.message
    });
  }
};

/**
 * Get water quality aggregated by state (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/calidad-agua/by-state
 * @desc    Get water quality data aggregated by state
 * @access  Private
 */
export const getCalidadAguaByStateV2 = async (req, res) => {
  try {
    const stateData = await CalidadAguaModel.getByState();
    
    console.log(`[getCalidadAguaByStateV2] ✅ Found ${stateData.length} states with water quality data`);
    
    res.json({
      success: true,
      count: stateData.length,
      data: stateData
    });
  } catch (error) {
    console.error('[getCalidadAguaByStateV2] ❌ Error fetching state aggregation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching state water quality data',
      error: error.message
    });
  }
};

/**
 * Get historical water quality data for a state (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/calidad-agua/historical/:estado
 * @desc    Get historical water quality data for a specific state
 * @access  Private
 */
export const getCalidadAguaHistoricalV2 = async (req, res) => {
  try {
    const { estado } = req.params;
    const historicalData = await CalidadAguaModel.getHistoricalByState(estado);
    
    console.log(`[getCalidadAguaHistoricalV2] ✅ Found ${historicalData.length} historical records for ${estado}`);
    
    res.json({
      success: true,
      count: historicalData.length,
      data: historicalData
    });
  } catch (error) {
    console.error('[getCalidadAguaHistoricalV2] ❌ Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching historical water quality data',
      error: error.message
    });
  }
};

/**
 * Get water quality record by ID (v2.0 - PostgreSQL)
 * @route   GET /api/v2.0/calidad-agua/:id
 * @desc    Get single water quality record by ID
 * @access  Private
 */
export const getCalidadAguaByIdV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CalidadAguaModel.findById(parseInt(id, 10));
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Water quality record not found'
      });
    }
    
    console.log(`[getCalidadAguaByIdV2] ✅ Found water quality record ${id}`);
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('[getCalidadAguaByIdV2] ❌ Error fetching water quality record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching water quality record',
      error: error.message
    });
  }
};

/**
 * Add new water quality record (v2.0 - PostgreSQL)
 * @route   POST /api/v2.0/calidad-agua
 * @desc    Create new water quality record
 * @access  Private
 */
export const addCalidadAguaV2 = async (req, res) => {
  try {
    const newRecord = await CalidadAguaModel.create(req.body);
    
    console.log(`[addCalidadAguaV2] ✅ Created water quality record ${newRecord.id}`);
    
    res.status(201).json({
      success: true,
      message: 'Water quality record created successfully',
      data: newRecord
    });
  } catch (error) {
    console.error('[addCalidadAguaV2] ❌ Error creating water quality record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating water quality record',
      error: error.message
    });
  }
};

/**
 * Update water quality record (v2.0 - PostgreSQL)
 * @route   PATCH /api/v2.0/calidad-agua/:id
 * @desc    Update existing water quality record
 * @access  Private
 */
export const updateCalidadAguaV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRecord = await CalidadAguaModel.update(parseInt(id, 10), req.body);
    
    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Water quality record not found'
      });
    }
    
    console.log(`[updateCalidadAguaV2] ✅ Updated water quality record ${id}`);
    
    res.json({
      success: true,
      message: 'Water quality record updated successfully',
      data: updatedRecord
    });
  } catch (error) {
    console.error('[updateCalidadAguaV2] ❌ Error updating water quality record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating water quality record',
      error: error.message
    });
  }
};

/**
 * Delete water quality record (v2.0 - PostgreSQL)
 * @route   DELETE /api/v2.0/calidad-agua/:id
 * @desc    Delete water quality record
 * @access  Private
 */
export const removeCalidadAguaV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CalidadAguaModel.delete(parseInt(id, 10));
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Water quality record not found'
      });
    }
    
    console.log(`[removeCalidadAguaV2] ✅ Deleted water quality record ${id}`);
    
    res.json({
      success: true,
      message: 'Water quality record deleted successfully'
    });
  } catch (error) {
    console.error('[removeCalidadAguaV2] ❌ Error deleting water quality record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting water quality record',
      error: error.message
    });
  }
};
