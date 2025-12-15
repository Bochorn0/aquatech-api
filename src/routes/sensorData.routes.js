// src/routes/sensorData.routes.js
// Rutas para consultar datos de sensores recibidos vía MQTT

import express from 'express';
import {
  getSensorData,
  getLatestSensorData,
  getSensorStatistics,
  getSensorDataByTiendaEquipo,
  getSensorDataByTienda,
  getSensorDataByGateway
} from '../controllers/sensorData.controller.js';

const router = express.Router();

// GET /api/v1.0/sensor-data - Obtener todos los datos con filtros
router.get('/', getSensorData);

// GET /api/v1.0/sensor-data/latest - Obtener el último dato
router.get('/latest', getLatestSensorData);

// GET /api/v1.0/sensor-data/statistics - Obtener estadísticas
router.get('/statistics', getSensorStatistics);

// GET /api/v1.0/sensor-data/tienda/:codigo_tienda - Obtener datos por tienda (todos los equipos)
router.get('/tienda/:codigo_tienda', getSensorDataByTienda);

// GET /api/v1.0/sensor-data/tienda/:codigo_tienda/equipo/:equipo_id - Obtener datos por tienda y equipo
router.get('/tienda/:codigo_tienda/equipo/:equipo_id', getSensorDataByTiendaEquipo);

// GET /api/v1.0/sensor-data/gateway/:gateway_id - Obtener datos por gateway (legacy)
router.get('/gateway/:gateway_id', getSensorDataByGateway);

export default router;

