import PuntoVenta from '../models/puntoVenta.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';
import Controller from '../models/controller.model.js';
import City from '../models/city.model.js';
import { generateProductLogsReport } from './report.controller.js';
import moment from 'moment';
import mqttService from '../services/mqtt.service.js';

// Obtener todos los puntos de venta
export const getPuntosVenta = async (req, res) => {
  try {
    console.log('Fetching Puntos de Venta from MongoDB...');

    const puntos = await PuntoVenta.find({})
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;

    const puntosConEstado = puntos.map(pv => {
      const tieneControladorOnline = pv.controladores?.some(
        ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
      );

      return {
        ...pv.toObject(),
        online: tieneControladorOnline,
      };
    });

    res.json(puntosConEstado);
  } catch (error) {
    console.error('Error fetching puntos de venta:', error);
    res.status(500).json({ message: 'Error fetching puntos de venta' });
  }
};

// Obtener puntos de venta filtrados
export const getPuntosVentaFiltered = async (req, res) => {
  try {
    console.log('Fetching filtered Puntos de Venta...');
    const { cliente, city, online } = req.query;

    const filters = {};
    if (cliente) filters.cliente = cliente;
    if (city) filters.city = city;

    const puntos = await PuntoVenta.find(filters)
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;

    let puntosConEstado = puntos.map(pv => {
      const tieneControladorOnline = pv.controladores?.some(
        ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
      );

      return {
        ...pv.toObject(),
        online: tieneControladorOnline,
      };
    });

    // Filtrar por online si se especifica
    if (online === 'true') {
      puntosConEstado = puntosConEstado.filter(pv => pv.online);
    } else if (online === 'false') {
      puntosConEstado = puntosConEstado.filter(pv => !pv.online);
    }

    res.json(puntosConEstado);
  } catch (error) {
    console.error('Error fetching filtered puntos de venta:', error);
    res.status(500).json({ message: 'Error fetching filtered puntos de venta' });
  }
};

// Obtener un punto de venta por ID
export const getPuntoVentaById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching Punto de Venta by ID: ${id}`);

    const punto = await PuntoVenta.findById(id)
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    if (!punto) {
      return res.status(404).json({ message: 'Punto de venta no encontrado' });
    }

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;

    const tieneControladorOnline = punto.controladores?.some(
      ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
    );

    const puntoConEstado = {
      ...punto.toObject(),
      online: tieneControladorOnline,
    };

    res.json(puntoConEstado);
  } catch (error) {
    console.error('Error fetching punto de venta by ID:', error);
    res.status(500).json({ message: 'Error fetching punto de venta' });
  }
};

// Crear un nuevo punto de venta
export const addPuntoVenta = async (req, res) => {
  try {
    const { name, cliente, city, productos, controladores, lat, long, codigo_tienda } = req.body;

    // Validar que el código_tienda sea único si se proporciona
    if (codigo_tienda) {
      const existingPunto = await PuntoVenta.findOne({ codigo_tienda });
      if (existingPunto) {
        return res.status(400).json({ message: 'El código de tienda ya existe' });
      }
    }

    // Normalize productos: ensure it's an array of ObjectId strings
    let normalizedProductos = [];
    if (productos) {
      if (Array.isArray(productos)) {
        normalizedProductos = productos
          .map(p => {
            // If it's an object with _id, extract the _id
            if (typeof p === 'object' && p !== null && p._id) {
              return p._id;
            }
            // If it's already a string (ObjectId), use it
            if (typeof p === 'string' && p.trim() !== '') {
              return p.trim();
            }
            return null;
          })
          .filter(id => id !== null && id !== '');
      } else if (typeof productos === 'string') {
        // If it's a string, try to parse it (shouldn't happen, but defensive)
        try {
          const parsed = JSON.parse(productos);
          if (Array.isArray(parsed)) {
            normalizedProductos = parsed
              .map(p => (typeof p === 'object' && p?._id ? p._id : p))
              .filter(id => id && typeof id === 'string');
          }
        } catch (e) {
          // If parsing fails, treat as invalid
          normalizedProductos = [];
        }
      }
    }

    // Build the document object, only including codigo_tienda if it's provided
    const puntoData = {
      name,
      cliente,
      city,
      productos: normalizedProductos,
      controladores: controladores || [],
    };

    // Only include codigo_tienda if it's provided and not empty
    if (codigo_tienda && codigo_tienda.trim() !== '') {
      puntoData.codigo_tienda = codigo_tienda.trim().toUpperCase();
    }

    // Include lat/long if provided
    if (lat !== undefined) puntoData.lat = lat;
    if (long !== undefined) puntoData.long = long;

    const nuevoPunto = new PuntoVenta(puntoData);

    const puntoGuardado = await nuevoPunto.save();
    await puntoGuardado.populate('cliente');
    await puntoGuardado.populate('city');
    await puntoGuardado.populate('productos');
    await puntoGuardado.populate('controladores');

    res.status(201).json(puntoGuardado);
  } catch (error) {
    console.error('Error creating punto de venta:', error);
    res.status(500).json({ message: 'Error creating punto de venta', error: error.message });
  }
};

// Actualizar un punto de venta
export const updatePuntoVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Si se actualiza codigo_tienda, validar que sea único
    if (updates.codigo_tienda) {
      const existingPunto = await PuntoVenta.findOne({ 
        codigo_tienda: updates.codigo_tienda,
        _id: { $ne: id }
      });
      if (existingPunto) {
        return res.status(400).json({ message: 'El código de tienda ya existe' });
      }
    }

    // Normalize productos if it's being updated
    if (updates.productos !== undefined) {
      let normalizedProductos = [];
      if (updates.productos) {
        if (Array.isArray(updates.productos)) {
          normalizedProductos = updates.productos
            .map(p => {
              // If it's an object with _id, extract the _id
              if (typeof p === 'object' && p !== null && p._id) {
                return p._id;
              }
              // If it's already a string (ObjectId), use it
              if (typeof p === 'string' && p.trim() !== '') {
                return p.trim();
              }
              return null;
            })
            .filter(id => id !== null && id !== '');
        } else if (typeof updates.productos === 'string') {
          // If it's a string, try to parse it (shouldn't happen, but defensive)
          try {
            const parsed = JSON.parse(updates.productos);
            if (Array.isArray(parsed)) {
              normalizedProductos = parsed
                .map(p => (typeof p === 'object' && p?._id ? p._id : p))
                .filter(id => id && typeof id === 'string');
            }
          } catch (e) {
            // If parsing fails, treat as invalid
            normalizedProductos = [];
          }
        }
      }
      updates.productos = normalizedProductos;
    }

    const puntoActualizado = await PuntoVenta.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    if (!puntoActualizado) {
      return res.status(404).json({ message: 'Punto de venta no encontrado' });
    }

    res.json(puntoActualizado);
  } catch (error) {
    console.error('Error updating punto de venta:', error);
    res.status(500).json({ message: 'Error updating punto de venta', error: error.message });
  }
};

// Eliminar un punto de venta
export const deletePuntoVenta = async (req, res) => {
  try {
    const { id } = req.params;

    const puntoEliminado = await PuntoVenta.findByIdAndDelete(id);

    if (!puntoEliminado) {
      return res.status(404).json({ message: 'Punto de venta no encontrado' });
    }

    res.json({ message: 'Punto de venta eliminado exitosamente', punto: puntoEliminado });
  } catch (error) {
    console.error('Error deleting punto de venta:', error);
    res.status(500).json({ message: 'Error deleting punto de venta', error: error.message });
  }
};

// Generar datos diarios simulados (24 mensajes MQTT)
export const generateDailyData = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[Generate Daily Data] Iniciando generación de datos diarios para punto de venta: ${id}`);

    let punto = null;
    let codigoTienda = null;
    
    // Verificar si es un ID numérico (PostgreSQL v2) o ObjectId (MongoDB v1)
    const isNumericId = /^\d+$/.test(id);
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    console.log(`[Generate Daily Data] ID recibido: ${id}, es numérico: ${isNumericId}, es ObjectId: ${isValidObjectId}`);
    
    if (isNumericId) {
      // Buscar en PostgreSQL (v2.0)
      const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
      
      // Intentar buscar por ID numérico
      punto = await PuntoVentaModel.findById(parseInt(id, 10));
      console.log(`[Generate Daily Data] Búsqueda en PostgreSQL por ID: ${punto ? 'encontrado' : 'no encontrado'}`);
      
      // Si no se encuentra por ID, intentar por código de tienda
      if (!punto) {
        punto = await PuntoVentaModel.findByCode(id);
        console.log(`[Generate Daily Data] Búsqueda en PostgreSQL por código: ${punto ? 'encontrado' : 'no encontrado'}`);
      }
      
      if (punto) {
        codigoTienda = (punto.code || punto.codigo_tienda || id).toUpperCase();
        console.log(`[Generate Daily Data] ✅ Punto encontrado en PostgreSQL: ${punto.name} (codigo_tienda: ${codigoTienda})`);
      }
    } else if (isValidObjectId) {
      // Buscar en MongoDB (v1.0)
      punto = await PuntoVenta.findById(id).populate('productos');
      console.log(`[Generate Daily Data] Búsqueda en MongoDB por ObjectId: ${punto ? 'encontrado' : 'no encontrado'}`);
      
      if (punto) {
        codigoTienda = punto.codigo_tienda;
        console.log(`[Generate Daily Data] ✅ Punto encontrado en MongoDB: ${punto.name} (codigo_tienda: ${codigoTienda})`);
      }
    } else {
      // Intentar buscar por código de tienda en MongoDB
      const codigoDirecto = id.toUpperCase();
      console.log(`[Generate Daily Data] Buscando por código de tienda en MongoDB: ${codigoDirecto}`);
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      console.log(`[Generate Daily Data] Resultado búsqueda por código: ${punto ? 'encontrado' : 'no encontrado'}`);
      
      if (punto) {
        codigoTienda = punto.codigo_tienda;
      }
    }
    
    if (!punto) {
      console.log(`[Generate Daily Data] ❌ Punto de venta no encontrado con ID/código: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: `Punto de venta no encontrado con ID/código: ${id}` 
      });
    }

    // Verificar que tenga código de tienda
    if (!codigoTienda) {
      return res.status(400).json({ 
        success: false, 
        message: 'El punto de venta no tiene código de tienda configurado' 
      });
    }

    // Verificar que MQTT esté conectado para publicar
    // NOTA: Esto conecta MQTT solo para publicar (no para consumir)
    // El consumo de mensajes lo hace el proceso separado mqtt-consumer.js
    if (!mqttService.isConnected) {
      console.log('[Generate Daily Data] MQTT no conectado, intentando conectar para publicar...');
      mqttService.connect();
      
      // Esperar un poco para que se conecte
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!mqttService.isConnected) {
        return res.status(503).json({ 
          success: false, 
          message: 'MQTT no está conectado. Intenta nuevamente en unos segundos.' 
        });
      }
    }

    // Generar 24 mensajes (uno por cada hora del día)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const topic = `tiwater/${codigoTienda}/data`;
    
    const messages = [];
    let publishedCount = 0;
    let errorCount = 0;

    // Valores iniciales para simular comportamiento realista
    let nivelPurificada = 40 + Math.random() * 20; // 40-60%
    let nivelCruda = 35 + Math.random() * 15; // 35-50%
    let caudalPurificada = 0.3 + Math.random() * 0.4; // 0.3-0.7 L/min
    let caudalRecuperacion = 2.0 + Math.random() * 2.0; // 2.0-4.0 L/min
    let eficiencia = 50 + Math.random() * 10; // 50-60%

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(startOfDay);
      timestamp.setHours(hour, 0, 0, 0);

      // Simular comportamiento realista: niveles que suben y bajan
      // Durante el día (6am-10pm): más consumo, niveles bajan
      // Durante la noche (10pm-6am): menos consumo, niveles suben
      const isDayTime = hour >= 6 && hour < 22;
      
      if (isDayTime) {
        // Durante el día: consumo activo, niveles tienden a bajar
        nivelPurificada = Math.max(20, nivelPurificada - (2 + Math.random() * 3));
        nivelCruda = Math.max(25, nivelCruda - (1.5 + Math.random() * 2));
        caudalPurificada = 0.4 + Math.random() * 0.6; // Mayor caudal durante el día
        caudalRecuperacion = 2.5 + Math.random() * 2.5;
        eficiencia = 52 + Math.random() * 8;
      } else {
        // Durante la noche: menos consumo, niveles se recuperan
        nivelPurificada = Math.min(90, nivelPurificada + (1 + Math.random() * 2));
        nivelCruda = Math.min(85, nivelCruda + (1 + Math.random() * 1.5));
        caudalPurificada = 0.1 + Math.random() * 0.3; // Menor caudal durante la noche
        caudalRecuperacion = 1.5 + Math.random() * 1.5;
        eficiencia = 48 + Math.random() * 7;
      }

      // Generar datos TIWATER según el formato del ESP32
      // Incluir timestamp en formato Unix (segundos) para que el servicio MQTT lo use
      const timestampUnix = Math.floor(timestamp.getTime() / 1000);
      
      const tiwaterData = {
        "CAUDAL PURIFICADA": parseFloat(caudalPurificada.toFixed(2)),
        "CAUDAL RECUPERACION": parseFloat(caudalRecuperacion.toFixed(2)),
        "CAUDAL RECHAZO": parseFloat((0.1 + Math.random() * 0.3).toFixed(2)),
        "NIVEL PURIFICADA": parseFloat(nivelPurificada.toFixed(2)),
        "NIVEL CRUDA": parseFloat(nivelCruda.toFixed(2)),
        "CAUDAL CRUDA": parseFloat((1.5 + Math.random() * 2.0).toFixed(2)),
        "ACUMULADO CRUDA": parseFloat((2000.0 + Math.random() * 50.0).toFixed(1)),
        "vida": Math.floor(Math.random() * 100),
        "PRESION CO2": parseFloat((300.0 + Math.random() * 5.0).toFixed(2)),
        "ch1": parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
        "ch2": parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
        "ch3": parseFloat((1.0 + Math.random() * 0.5).toFixed(2)),
        "ch4": parseFloat((2.0 + Math.random() * 1.0).toFixed(2)),
        "EFICIENCIA": parseFloat(eficiencia.toFixed(1)),
        "PORCENTAJE NIVEL PURIFICADA": parseFloat((nivelPurificada / 10).toFixed(1)),
        "PORCENTAJE NIVEL CRUDA": parseFloat((nivelCruda / 10).toFixed(1)),
        "CAUDAL CRUDA L/min": parseFloat((20.0 + Math.random() * 5.0).toFixed(3)),
        "timestamp": timestampUnix  // Timestamp en formato Unix (segundos) para que el servicio MQTT lo use
      };

      const message = JSON.stringify(tiwaterData);
      
      try {
        // Publicar mensaje con delay pequeño entre mensajes
        await mqttService.publish(topic, message);
        publishedCount++;
        
        messages.push({
          hour,
          timestamp: timestamp.toISOString(),
          topic,
          success: true
        });

        // Pequeño delay entre mensajes (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
        console.error(`[Generate Daily Data] Error publicando mensaje hora ${hour}:`, error);
        messages.push({
          hour,
          timestamp: timestamp.toISOString(),
          topic,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[Generate Daily Data] Completado: ${publishedCount} publicados, ${errorCount} errores`);

    res.json({
      success: true,
      message: `Generados ${publishedCount} de 24 mensajes MQTT`,
      data: {
        puntoVentaId: id,
        codigoTienda: codigoTienda,
        topic,
        published: publishedCount,
        errors: errorCount,
        messages: messages
      }
    });
  } catch (error) {
    console.error('[Generate Daily Data] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando datos diarios',
      error: error.message
    });
  }
};

/**
 * Simular bajo nivel de agua cruda (< 70%): publica un mensaje MQTT para que el nivel se actualice
 * y se muestre la alerta en la sección Agua Cruda (y en Dashboard V2).
 */
export const simulateBajoNivelCruda = async (req, res) => {
  try {
    const { id } = req.params;

    let punto = null;
    let codigoTienda = null;

    const isNumericId = /^\d+$/.test(id);
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isNumericId) {
      const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
      punto = await PuntoVentaModel.findById(parseInt(id, 10));
      if (!punto) punto = await PuntoVentaModel.findByCode(id);
      if (punto) codigoTienda = (punto.code || punto.codigo_tienda || id).toUpperCase();
    } else if (isValidObjectId) {
      punto = await PuntoVenta.findById(id).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    }

    if (!punto) {
      return res.status(404).json({
        success: false,
        message: `Punto de venta no encontrado con ID/código: ${id}`
      });
    }

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'El punto de venta no tiene código de tienda configurado'
      });
    }

    if (!mqttService.isConnected) {
      mqttService.connect();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!mqttService.isConnected) {
        return res.status(503).json({
          success: false,
          message: 'MQTT no está conectado. Intenta nuevamente en unos segundos.'
        });
      }
    }

    const topic = `tiwater/${codigoTienda}/data`;
    const timestampUnix = Math.floor(Date.now() / 1000);
    // Nivel agua cruda bajo (< 70%): only send the simulated fields, no full payload
    const nivelCrudaPercent = 65;
    const payload = {
      'NIVEL CRUDA': nivelCrudaPercent,
      'PORCENTAJE NIVEL CRUDA': nivelCrudaPercent,
      timestamp: timestampUnix
    };

    const message = JSON.stringify(payload);
    await mqttService.publish(topic, message);

    console.log(`[Simulate Bajo Nivel Cruda] Publicado en ${topic}: nivel cruda ${nivelCrudaPercent}%`);

    res.json({
      success: true,
      message: 'Mensaje MQTT enviado: nivel de agua cruda simulado bajo (< 70%)',
      data: {
        puntoVentaId: id,
        codigoTienda,
        topic,
        nivelCrudaPercent
      }
    });
  } catch (error) {
    console.error('[Simulate Bajo Nivel Cruda] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al simular bajo nivel de agua cruda',
      error: error.message
    });
  }
};

/**
 * Simular nivel agua cruda normalizado: publica un mensaje MQTT con NIVEL CRUDA y PORCENTAJE NIVEL CRUDA
 * en rango normal (ej. 85%) para que el punto de venta y la UI muestren nivel correcto.
 */
export const simulateNivelCrudaNormalizado = async (req, res) => {
  try {
    const { id } = req.params;

    let punto = null;
    let codigoTienda = null;

    const isNumericId = /^\d+$/.test(id);
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isNumericId) {
      const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
      punto = await PuntoVentaModel.findById(parseInt(id, 10));
      if (!punto) punto = await PuntoVentaModel.findByCode(id);
      if (punto) codigoTienda = (punto.code || punto.codigo_tienda || id).toUpperCase();
    } else if (isValidObjectId) {
      punto = await PuntoVenta.findById(id).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    }

    if (!punto) {
      return res.status(404).json({
        success: false,
        message: `Punto de venta no encontrado con ID/código: ${id}`
      });
    }

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'El punto de venta no tiene código de tienda configurado'
      });
    }

    if (!mqttService.isConnected) {
      mqttService.connect();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!mqttService.isConnected) {
        return res.status(503).json({
          success: false,
          message: 'MQTT no está conectado. Intenta nuevamente en unos segundos.'
        });
      }
    }

    const topic = `tiwater/${codigoTienda}/data`;
    const timestampUnix = Math.floor(Date.now() / 1000);
    const nivelCrudaPercent = 85;

    const payload = {
      'NIVEL CRUDA': nivelCrudaPercent,
      'PORCENTAJE NIVEL CRUDA': nivelCrudaPercent,
      timestamp: timestampUnix
    };

    const message = JSON.stringify(payload);
    await mqttService.publish(topic, message);

    console.log(`[Simulate Nivel Cruda Normalizado] Publicado en ${topic}: nivel cruda ${nivelCrudaPercent}%`);

    res.json({
      success: true,
      message: 'Mensaje MQTT enviado: nivel de agua cruda normalizado',
      data: {
        puntoVentaId: id,
        codigoTienda,
        topic,
        nivelCrudaPercent
      }
    });
  } catch (error) {
    console.error('[Simulate Nivel Cruda Normalizado] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al simular nivel agua cruda normalizado',
      error: error.message
    });
  }
};

/** Allowed sensor keys for custom simulate (same payload keys as dev scenarios MQTT) */
const TIWATER_SENSOR_KEYS = [
  'CAUDAL PURIFICADA', 'CAUDAL RECUPERACION', 'CAUDAL RECHAZO',
  'NIVEL PURIFICADA', 'NIVEL CRUDA', 'PORCENTAJE NIVEL PURIFICADA', 'PORCENTAJE NIVEL CRUDA',
  'CAUDAL CRUDA', 'ACUMULADO CRUDA', 'CAUDAL CRUDA L/min',
  'vida', 'PRESION CO2', 'ch1', 'ch2', 'ch3', 'ch4', 'EFICIENCIA'
];

/**
 * Simular valor custom de un sensor: publica un mensaje MQTT con el payload base
 * y el valor indicado para el sensor seleccionado (mismo formato que dev scenarios).
 */
export const simulateSensor = async (req, res) => {
  try {
    const { id } = req.params;
    const { sensorKey, value: rawValue } = req.body || {};

    if (!sensorKey || typeof sensorKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'sensorKey es requerido y debe ser un string'
      });
    }

    if (!TIWATER_SENSOR_KEYS.includes(sensorKey)) {
      return res.status(400).json({
        success: false,
        message: `sensorKey no permitido. Permitidos: ${TIWATER_SENSOR_KEYS.join(', ')}`
      });
    }

    const numValue = Number(rawValue);
    if (rawValue === '' || rawValue === null || rawValue === undefined || Number.isNaN(numValue)) {
      return res.status(400).json({
        success: false,
        message: 'value es requerido y debe ser un número'
      });
    }

    let punto = null;
    let codigoTienda = null;

    const isNumericId = /^\d+$/.test(id);
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isNumericId) {
      const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
      punto = await PuntoVentaModel.findById(parseInt(id, 10));
      if (!punto) punto = await PuntoVentaModel.findByCode(id);
      if (punto) codigoTienda = (punto.code || punto.codigo_tienda || id).toUpperCase();
    } else if (isValidObjectId) {
      punto = await PuntoVenta.findById(id).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = punto.codigo_tienda;
    }

    if (!punto) {
      return res.status(404).json({
        success: false,
        message: `Punto de venta no encontrado con ID/código: ${id}`
      });
    }

    if (!codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'El punto de venta no tiene código de tienda configurado'
      });
    }

    if (!mqttService.isConnected) {
      mqttService.connect();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!mqttService.isConnected) {
        return res.status(503).json({
          success: false,
          message: 'MQTT no está conectado. Intenta nuevamente en unos segundos.'
        });
      }
    }

    const topic = `tiwater/${codigoTienda}/data`;
    const timestampUnix = Math.floor(Date.now() / 1000);

    // Build payload: for nivel cruda/purificada send both keys so DB and UI update
    let payload;
    if (sensorKey === 'NIVEL CRUDA' || sensorKey === 'PORCENTAJE NIVEL CRUDA') {
      payload = {
        'NIVEL CRUDA': numValue,
        'PORCENTAJE NIVEL CRUDA': numValue,
        timestamp: timestampUnix
      };
    } else if (sensorKey === 'NIVEL PURIFICADA' || sensorKey === 'PORCENTAJE NIVEL PURIFICADA') {
      payload = {
        'NIVEL PURIFICADA': numValue,
        'PORCENTAJE NIVEL PURIFICADA': numValue,
        timestamp: timestampUnix
      };
    } else {
      payload = {
        [sensorKey]: numValue,
        timestamp: timestampUnix
      };
    }

    const message = JSON.stringify(payload);
    await mqttService.publish(topic, message);

    console.log(`[Simulate Sensor] Publicado en ${topic}: ${sensorKey}=${numValue}`);

    res.json({
      success: true,
      message: 'Mensaje MQTT enviado con valor custom',
      data: {
        puntoVentaId: id,
        codigoTienda,
        topic,
        sensorKey,
        value: numValue
      }
    });
  } catch (error) {
    console.error('[Simulate Sensor] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al simular sensor',
      error: error.message
    });
  }
};
