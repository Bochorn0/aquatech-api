// src/controllers/customizationV2.controller.js
// Controller for v2.0 API endpoints using PostgreSQL for customization data

import MetricModel from '../models/postgres/metric.model.js';
import MetricAlertModel from '../models/postgres/metricAlert.model.js';
import ClientModel from '../models/postgres/client.model.js';
import CityModel from '../models/postgres/city.model.js';
import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';
import PuntoVentaSensorModel from '../models/postgres/puntoVentaSensor.model.js';
import SensoresModel from '../models/postgres/sensores.model.js';
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
  try {
    console.log('Fetching Metrics from PostgreSQL (v2.0)...');
    
    const metrics = await MetricModel.find({}, { limit: 1000, offset: 0 });
    
    // Get clients to populate client_name
    const clients = await ClientModel.find({}, { limit: 1000, offset: 0 });
    const clientMap = new Map(clients.map(c => [String(c.id), c.name]));
    
    // Get puntos de venta to populate punto_venta_name
    const puntosVenta = await PuntoVentaModel.find({}, { limit: 1000, offset: 0 });
    const puntoVentaMap = new Map(puntosVenta.map(pv => [String(pv.id), pv.name]));
    
    // Map metrics with client names and punto venta names
    const mappedResults = metrics.map(metric => ({
      ...metric,
      client_name: metric.clientId ? (clientMap.get(String(metric.clientId)) || '') : '',
      punto_venta_name: metric.punto_venta_id ? (puntoVentaMap.get(String(metric.punto_venta_id)) || '') : ''
    }));
    
    console.log(`[getMetricsV2] ✅ Found ${mappedResults.length} metrics from PostgreSQL`);
    res.json(mappedResults);
  } catch (error) {
    console.error('Error fetching metrics from PostgreSQL (v2.0):', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching metrics',
      error: error.message 
    });
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
    
    const newMetric = await MetricModel.create({
      ...metricData,
      clientId: clientId || metricData.clientId,
      punto_venta_id: puntoVentaId || metricData.punto_venta_id
    });
    
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
    
    // Convert cliente to clientId if needed
    if (metricData.cliente) {
      const clientId = parseInt(metricData.cliente, 10);
      if (!isNaN(clientId)) {
        metricData.clientId = clientId;
      }
    }
    
    // Convert punto_venta_id to integer if needed
    if (metricData.punto_venta_id) {
      const puntoVentaId = parseInt(metricData.punto_venta_id, 10);
      if (!isNaN(puntoVentaId)) {
        metricData.punto_venta_id = puntoVentaId;
      }
    }
    
    const updatedMetric = await MetricModel.update(parseInt(id, 10), metricData);
    
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
