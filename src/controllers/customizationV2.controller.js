// src/controllers/customizationV2.controller.js
// Controller for v2.0 API endpoints using PostgreSQL for customization data

import MetricModel from '../models/postgres/metric.model.js';
import ClientModel from '../models/postgres/client.model.js';
import CityModel from '../models/postgres/city.model.js';
import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';

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
    
    // Validate required fields
    if (!metricData.tds_range || metricData.tds_range < 0) {
      return res.status(400).json({ message: 'El rango TDS debe ser mayor a 0' });
    }
    if (!metricData.production_volume_range || metricData.production_volume_range < 0) {
      return res.status(400).json({ message: 'El rango de volumen de producción debe ser mayor a 0' });
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
