// src/controllers/sensorData.controller.js
// Controlador para consultar datos de sensores recibidos vía MQTT

import SensorData from '../models/sensorData.model.js';
import Controller from '../models/controller.model.js';

// Obtener todos los datos de sensores con filtros opcionales
export const getSensorData = async (req, res) => {
  try {
    const {
      codigo_tienda,
      equipo_id,
      punto_venta_id,
      gateway_id,  // Legacy
      controller_id,
      product_id,
      cliente_id,
      startDate,
      endDate,
      limit = 100,
      page = 1,
      sort = '-timestamp' // Ordenar por timestamp descendente (más recientes primero)
    } = req.query;

    // Construir filtro
    const filter = {};

    // Nuevos filtros principales
    if (codigo_tienda) {
      filter.codigo_tienda = codigo_tienda.toUpperCase();
    }

    if (equipo_id) {
      filter.equipo_id = equipo_id;
    }

    if (punto_venta_id) {
      filter.punto_venta = punto_venta_id;
    }

    // Filtros legacy (mantener compatibilidad)
    if (gateway_id) {
      filter.gateway_id = gateway_id;
    }

    if (controller_id) {
      filter.controller = controller_id;
    }

    if (product_id) {
      filter.product = product_id;
    }

    if (cliente_id) {
      filter.cliente = cliente_id;
    }

    // Filtro por rango de fechas
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Consulta con populate para obtener datos relacionados
    const sensorData = await SensorData.find(filter)
      .populate('punto_venta', 'name codigo_tienda address')
      .populate('controller', 'id name ip online')
      .populate('product', 'id name product_name')
      .populate('cliente', 'name email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Contar total de documentos
    const total = await SensorData.countDocuments(filter);

    res.json({
      success: true,
      data: sensorData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error al obtener datos de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores',
      error: error.message
    });
  }
};

// Obtener el último dato de sensores
export const getLatestSensorData = async (req, res) => {
  try {
    const { codigo_tienda, equipo_id, punto_venta_id, gateway_id, controller_id } = req.query;

    const filter = {};
    
    // Nuevos filtros principales
    if (codigo_tienda) {
      filter.codigo_tienda = codigo_tienda.toUpperCase();
    }
    if (equipo_id) {
      filter.equipo_id = equipo_id;
    }
    if (punto_venta_id) {
      filter.punto_venta = punto_venta_id;
    }
    
    // Filtros legacy
    if (gateway_id) {
      filter.gateway_id = gateway_id;
    }
    if (controller_id) {
      filter.controller = controller_id;
    }

    const latestData = await SensorData.findOne(filter)
      .populate('punto_venta', 'name codigo_tienda address')
      .populate('controller', 'id name ip online')
      .populate('product', 'id name product_name')
      .populate('cliente', 'name email')
      .sort('-timestamp')
      .lean();

    if (!latestData) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos de sensores'
      });
    }

    res.json({
      success: true,
      data: latestData
    });

  } catch (error) {
    console.error('Error al obtener último dato de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener último dato de sensores',
      error: error.message
    });
  }
};

// Obtener estadísticas de sensores
export const getSensorStatistics = async (req, res) => {
  try {
    const {
      codigo_tienda,
      equipo_id,
      punto_venta_id,
      gateway_id,
      controller_id,
      product_id,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    // Nuevos filtros principales
    if (codigo_tienda) {
      filter.codigo_tienda = codigo_tienda.toUpperCase();
    }
    if (equipo_id) {
      filter.equipo_id = equipo_id;
    }
    if (punto_venta_id) {
      filter.punto_venta = punto_venta_id;
    }

    // Filtros legacy
    if (gateway_id) {
      filter.gateway_id = gateway_id;
    }
    if (controller_id) {
      filter.controller = controller_id;
    }
    if (product_id) {
      filter.product = product_id;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Agregación para calcular estadísticas con todos los sensores
    const stats = await SensorData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          // Flujos
          avg_flujo_produccion: { $avg: '$flujo_produccion' },
          avg_flujo_rechazo: { $avg: '$flujo_rechazo' },
          max_flujo_produccion: { $max: '$flujo_produccion' },
          max_flujo_rechazo: { $max: '$flujo_rechazo' },
          min_flujo_produccion: { $min: '$flujo_produccion' },
          min_flujo_rechazo: { $min: '$flujo_rechazo' },
          // TDS
          avg_tds: { $avg: '$tds' },
          max_tds: { $max: '$tds' },
          min_tds: { $min: '$tds' },
          // Niveles
          avg_electronivel_purificada: { $avg: '$electronivel_purificada' },
          avg_electronivel_recuperada: { $avg: '$electronivel_recuperada' },
          max_electronivel_purificada: { $max: '$electronivel_purificada' },
          max_electronivel_recuperada: { $max: '$electronivel_recuperada' },
          min_electronivel_purificada: { $min: '$electronivel_purificada' },
          min_electronivel_recuperada: { $min: '$electronivel_recuperada' },
          // Presiones
          avg_presion_in: { $avg: '$presion_in' },
          avg_presion_out: { $avg: '$presion_out' },
          max_presion_in: { $max: '$presion_in' },
          max_presion_out: { $max: '$presion_out' },
          min_presion_in: { $min: '$presion_in' },
          min_presion_out: { $min: '$presion_out' },
          // Legacy (mantener compatibilidad)
          avg_pressure_in: { $avg: '$presion_in' },
          avg_pressure_out: { $avg: '$presion_out' },
          avg_water_level: { $avg: '$electronivel_purificada' },
          max_pressure_in: { $max: '$presion_in' },
          max_pressure_out: { $max: '$presion_out' },
          max_water_level: { $max: '$electronivel_purificada' },
          min_pressure_in: { $min: '$presion_in' },
          min_pressure_out: { $min: '$presion_out' },
          min_water_level: { $min: '$electronivel_purificada' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        avg_flujo_produccion: null,
        avg_flujo_rechazo: null,
        avg_tds: null,
        avg_electronivel_purificada: null,
        avg_electronivel_recuperada: null,
        avg_presion_in: null,
        avg_presion_out: null,
        count: 0
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de sensores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de sensores',
      error: error.message
    });
  }
};

// Obtener datos de sensores por tienda y equipo
export const getSensorDataByTiendaEquipo = async (req, res) => {
  try {
    const { codigo_tienda, equipo_id } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const filter = {
      codigo_tienda: codigo_tienda.toUpperCase(),
      equipo_id: equipo_id
    };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    const sensorData = await SensorData.find(filter)
      .populate('punto_venta', 'name codigo_tienda address')
      .populate('controller', 'id name ip online')
      .populate('product', 'id name product_name')
      .populate('cliente', 'name email')
      .sort('-timestamp')
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: sensorData,
      count: sensorData.length
    });

  } catch (error) {
    console.error('Error al obtener datos de sensores por tienda/equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por tienda/equipo',
      error: error.message
    });
  }
};

// Obtener datos de sensores por código de tienda (todos los equipos)
export const getSensorDataByTienda = async (req, res) => {
  try {
    const { codigo_tienda } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const filter = {
      codigo_tienda: codigo_tienda.toUpperCase()
    };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    const sensorData = await SensorData.find(filter)
      .populate('punto_venta', 'name codigo_tienda address')
      .populate('controller', 'id name ip online')
      .populate('product', 'id name product_name')
      .populate('cliente', 'name email')
      .sort('-timestamp')
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: sensorData,
      count: sensorData.length
    });

  } catch (error) {
    console.error('Error al obtener datos de sensores por tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por tienda',
      error: error.message
    });
  }
};

// Obtener datos de sensores por gateway_id (legacy)
export const getSensorDataByGateway = async (req, res) => {
  try {
    const { gateway_id } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const filter = { gateway_id };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    const sensorData = await SensorData.find(filter)
      .populate('punto_venta', 'name codigo_tienda address')
      .populate('controller', 'id name ip online')
      .populate('product', 'id name product_name')
      .populate('cliente', 'name email')
      .sort('-timestamp')
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: sensorData,
      count: sensorData.length
    });

  } catch (error) {
    console.error('Error al obtener datos de sensores por gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de sensores por gateway',
      error: error.message
    });
  }
};

