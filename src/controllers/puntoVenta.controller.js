import PuntoVenta from '../models/puntoVenta.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';
import Controller from '../models/controller.model.js';
import City from '../models/city.model.js';
import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';
import ClientModel from '../models/postgres/client.model.js';
import CityModel from '../models/postgres/city.model.js';
import { query } from '../config/postgres.config.js';
import { generateProductLogsReport } from './report.controller.js';
import moment from 'moment';
import mqttService from '../services/mqtt.service.js';
import PostgresService from '../services/postgres.service.js';

/** Default full tiwater payload when no sensor data exists (same structure as generate-daily-data). */
function getDefaultTiwaterPayload() {
  const nivelPurificada = 40 + Math.random() * 20;
  const nivelCruda = 50 + Math.random() * 20;
  return {
    'CAUDAL PURIFICADA': 0.4,
    'CAUDAL RECUPERACION': 2.5,
    'CAUDAL RECHAZO': 0.2,
    'NIVEL PURIFICADA': nivelPurificada,
    'PORCENTAJE NIVEL PURIFICADA': parseFloat((nivelPurificada / 10).toFixed(1)),
    'NIVEL CRUDA': nivelCruda,
    'PORCENTAJE NIVEL CRUDA': parseFloat((nivelCruda / 10).toFixed(1)),
    'CAUDAL CRUDA': 2.0,
    'ACUMULADO CRUDA': 2000,
    'CAUDAL CRUDA L/min': 24,
    vida: 80,
    'PRESION CO2': 300,
    ch1: 2.6,
    ch2: 2.9,
    ch3: 1.1,
    ch4: 2.3,
    EFICIENCIA: 51
  };
}

/**
 * Fetch latest tiwater sensor values from PostgreSQL and build full MQTT payload (all keys).
 * Used by dev scenarios so we publish all data and only override nivel cruda.
 */
async function getLatestTiwaterPayloadForPublish(codigoTienda) {
  const latestSensorsQuery = `
    SELECT DISTINCT ON (name) name, value, type
    FROM sensores
    WHERE codigotienda = $1
      AND resourcetype = 'tiwater'
      AND (resourceid IS NULL OR resourceid = 'tiwater-system')
    ORDER BY name, timestamp DESC
  `;
  try {
    const result = await query(latestSensorsQuery, [codigoTienda.toUpperCase()]);
    const rows = result.rows || [];
    if (rows.length === 0) {
      return getDefaultTiwaterPayload();
    }
    const payload = getDefaultTiwaterPayload();
    const typeToMqtt = {
      flujo_produccion: 'CAUDAL PURIFICADA',
      flujo_rechazo: 'CAUDAL RECHAZO',
      flujo_recuperacion: 'CAUDAL RECUPERACION',
      electronivel_purificada: 'PORCENTAJE NIVEL PURIFICADA',
      nivel_purificada: 'NIVEL PURIFICADA',
      electronivel_cruda: 'PORCENTAJE NIVEL CRUDA',
      nivel_cruda: 'NIVEL CRUDA',
      electronivel_recuperada: 'PORCENTAJE NIVEL RECUPERADA',
      caudal_cruda: 'CAUDAL CRUDA',
      caudal_cruda_lmin: 'CAUDAL CRUDA L/min',
      acumulado_cruda: 'ACUMULADO CRUDA',
      presion_co2: 'PRESION CO2',
      eficiencia: 'EFICIENCIA',
      vida: 'vida',
      corriente_ch1: 'ch1',
      corriente_ch2: 'ch2',
      corriente_ch3: 'ch3',
      corriente_ch4: 'ch4'
    };
    for (const row of rows) {
      const type = (row.type || '').trim();
      const mqttKey = typeToMqtt[type];
      if (mqttKey != null && row.value != null) {
        const num = parseFloat(row.value);
        if (!Number.isNaN(num)) payload[mqttKey] = num;
      }
    }
    if (payload['PORCENTAJE NIVEL PURIFICADA'] == null && payload['NIVEL PURIFICADA'] != null) {
      payload['PORCENTAJE NIVEL PURIFICADA'] = parseFloat((payload['NIVEL PURIFICADA'] / 10).toFixed(1));
    }
    if (payload['PORCENTAJE NIVEL CRUDA'] == null && payload['NIVEL CRUDA'] != null) {
      payload['PORCENTAJE NIVEL CRUDA'] = parseFloat((payload['NIVEL CRUDA'] / 10).toFixed(1));
    }
    return payload;
  } catch (err) {
    console.warn('[getLatestTiwaterPayloadForPublish] Error:', err.message);
    return getDefaultTiwaterPayload();
  }
}

/** Build MongoDB-compatible punto response from Postgres record */
async function buildPuntoResponseFromPostgres(pv) {
  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  let online = false;
  if (pv.codigo_tienda || pv.code) {
    const codigoTienda = (pv.codigo_tienda || pv.code).toUpperCase();
    const thresholdTime = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    try {
      const onlineResult = await query(
        `SELECT COUNT(*) as count FROM sensores WHERE codigotienda = $1 AND createdat >= $2 LIMIT 1`,
        [codigoTienda, thresholdTime]
      );
      online = onlineResult.rows?.length > 0 && parseInt(onlineResult.rows[0].count, 10) > 0;
    } catch (e) {
      // ignore
    }
  }
  let clienteData = null;
  if (pv.clientId) {
    try {
      const clientId = typeof pv.clientId === 'string' ? parseInt(pv.clientId, 10) : pv.clientId;
      if (!isNaN(clientId)) clienteData = await ClientModel.findById(clientId);
    } catch (e) {
      // ignore
    }
  }
  let addressObj = null;
  if (pv.address) {
    try {
      addressObj = typeof pv.address === 'string' ? JSON.parse(pv.address) : pv.address;
    } catch (e) {
      addressObj = pv.address;
    }
  }
  let cityData = null;
  if (addressObj?.city && addressObj?.state) {
    try {
      cityData = await CityModel.findByStateAndCity(addressObj.state, addressObj.city);
    } catch (e) {
      // ignore
    }
  }
  return {
    _id: String(pv.id),
    id: String(pv.id),
    name: pv.name || 'Sin nombre',
    codigo_tienda: pv.codigo_tienda || pv.code || null,
    cliente: clienteData ? { _id: String(clienteData.id), id: String(clienteData.id), name: clienteData.name, email: clienteData.email, phone: clienteData.phone } : null,
    city: cityData ? { _id: String(cityData.id), id: String(cityData.id), city: cityData.city, state: cityData.state, lat: cityData.lat, lon: cityData.lon } : (addressObj ? { _id: null, city: addressObj.city, state: addressObj.state, lat: pv.lat, lon: pv.long } : { _id: null, city: null, state: null, lat: pv.lat, lon: pv.long }),
    address: addressObj || null,
    productos: [],
    controladores: [],
    online,
    status: pv.status || 'active',
    owner: pv.owner || null,
    clientId: pv.clientId ? String(pv.clientId) : null,
    lat: pv.lat ?? null,
    long: pv.long ?? null,
    contactId: pv.contactId ? String(pv.contactId) : null,
    meta: pv.meta ?? null,
    createdAt: pv.createdAt ?? null,
    updatedAt: pv.updatedAt ?? null,
    dev_mode: pv.dev_mode === true,
  };
}

// Obtener todos los puntos de venta
export const getPuntosVenta = async (req, res) => {
  try {
    console.log('Fetching Puntos de Venta from PostgreSQL...');

    const puntosPG = await PuntoVentaModel.find({}, { limit: 1000, offset: 0 });
    const puntosConEstado = await Promise.all(puntosPG.map(pv => buildPuntoResponseFromPostgres(pv)));

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

    // V1-only: attach historico to Nivel products so "Histórico de Nivel" charts have data.
    // Uses report.controller (MongoDB ProductLog); does not touch V2 or sensorDataV2.
    const productos = puntoConEstado.productos || [];
    const nivelProducts = productos.filter((p) => p && (p.product_type === 'Nivel' || p.product_type === 'nivel'));
    const historicoRange = (req.query.historicoRange || '24h').toLowerCase();
    if (nivelProducts.length > 0) {
      // Rango según historicoRange: 24h (last 24 hours), 7d (last week), 30d (last month)
      let startDate;
      let endDate;
      if (historicoRange === '7d') {
        startDate = moment().subtract(7, 'days').toISOString();
        endDate = moment().toISOString();
      } else if (historicoRange === '30d') {
        startDate = moment().subtract(30, 'days').toISOString();
        endDate = moment().toISOString();
      } else {
        // default 24h
        startDate = moment().subtract(24, 'hours').toISOString();
        endDate = moment().toISOString();
      }
      await Promise.all(
        nivelProducts.map(async (product) => {
          try {
            const result = await generateProductLogsReport(
              product.id,
              endDate,
              product,
              true, // useLastValue: last value per hour for charts
              startDate,
              endDate
            );
            if (result.success && result.data && result.data.hours_with_data && result.data.hours_with_data.length > 0) {
              product.historico = { hours_with_data: result.data.hours_with_data };
            }
          } catch (err) {
            console.warn(`[getPuntoVentaById] Histórico para Nivel ${product.id} (${product.name}):`, err.message);
          }
        })
      );
    }

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
    // Usar el día anterior para que todos los timestamps estén en el pasado (evitar futuros)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const topic = `tiwater/${codigoTienda}/data`;
    
    const messages = [];
    let publishedCount = 0;
    let errorCount = 0;

    // Valores constantes base (produccion, tds, eficiencia, rechazo - varían poco)
    const baseTds = 80 + Math.random() * 40; // 80-120 ppm, constante durante el día
    const baseProduccion = 0.8 + Math.random() * 0.8; // 0.8-1.6 L/min
    const baseRechazo = 0.15 + Math.random() * 0.25; // 0.15-0.4 L/min
    const baseRecuperacion = 1.8 + Math.random() * 0.6; // 1.8-2.4 L/min
    const baseEficiencia = 48 + Math.random() * 8; // 48-56%
    const baseCaudalCruda = 1.8 + Math.random() * 0.6; // 1.8-2.4
    const baseCaudalCrudaLmin = 20 + Math.random() * 4; // 20-24 L/min

    // Corrientes (ch1-4): base estable, varían solo unos pocos amperes (±0.3)
    const baseCh1 = 2.5 + Math.random() * 0.5;
    const baseCh2 = 2.8 + Math.random() * 0.4;
    const baseCh3 = 1.0 + Math.random() * 0.3;
    const baseCh4 = 2.2 + Math.random() * 0.4;

    // Niveles iniciales (subirán/bajarán según patrón del día)
    let nivelPurificada = 75;
    let nivelCruda = 70;

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(startOfDay);
      timestamp.setHours(hour, 0, 0, 0);

      // Patrón nivel agua: 20%, 40%, 80% a lo largo del día (consumo día, recuperación noche)
      // 0-5h: recuperación noche 70-85%
      // 6-9h: inicio consumo 60-75%
      // 10-14h: pico consumo 25-45%
      // 15-18h: recuperación tarde 45-65%
      // 19-22h: consumo tarde 30-50%
      // 23h: inicio recuperación 55-75%
      if (hour >= 0 && hour < 6) {
        nivelPurificada = Math.min(85, nivelPurificada + 2 + Math.random() * 2);
        nivelCruda = Math.min(88, nivelCruda + 1.5 + Math.random() * 1.5);
      } else if (hour >= 6 && hour < 10) {
        nivelPurificada = Math.max(55, nivelPurificada - (3 + Math.random() * 4));
        nivelCruda = Math.max(60, nivelCruda - (2 + Math.random() * 3));
      } else if (hour >= 10 && hour < 15) {
        nivelPurificada = Math.max(22, nivelPurificada - (4 + Math.random() * 5));
        nivelCruda = Math.max(35, nivelCruda - (3 + Math.random() * 4));
      } else if (hour >= 15 && hour < 19) {
        nivelPurificada = Math.min(70, nivelPurificada + (2 + Math.random() * 3));
        nivelCruda = Math.min(75, nivelCruda + (1.5 + Math.random() * 2));
      } else if (hour >= 19 && hour < 23) {
        nivelPurificada = Math.max(28, nivelPurificada - (2 + Math.random() * 3));
        nivelCruda = Math.max(40, nivelCruda - (1.5 + Math.random() * 2));
      } else {
        nivelPurificada = Math.min(72, nivelPurificada + (2 + Math.random() * 2));
        nivelCruda = Math.min(78, nivelCruda + (1.5 + Math.random() * 1.5));
      }
      nivelPurificada = Math.round(Math.min(95, Math.max(18, nivelPurificada)) * 10) / 10;
      nivelCruda = Math.round(Math.min(95, Math.max(20, nivelCruda)) * 10) / 10;

      // Producción, rechazo, eficiencia: casi constantes, pequeña variación (±0.1-0.2)
      const prodVar = (Math.random() - 0.5) * 0.3;
      const rechVar = (Math.random() - 0.5) * 0.08;
      const effVar = (Math.random() - 0.5) * 4;
      const caudalPurificada = Math.max(0.3, Math.min(2.4, baseProduccion + prodVar));
      const caudalRechazo = Math.max(0.1, Math.min(0.5, baseRechazo + rechVar));
      const eficiencia = Math.max(35, Math.min(65, baseEficiencia + effVar));
      const caudalRecuperacion = Math.max(1.2, Math.min(3.0, baseRecuperacion + (Math.random() - 0.5) * 0.3));

      // TDS: constante 30-150, pequeña variación ±5
      const tds = Math.round(Math.max(30, Math.min(150, baseTds + (Math.random() - 0.5) * 10)));

      // Corrientes: varían muy poco (±0.2-0.3 A)
      const ch1 = baseCh1 + (Math.random() - 0.5) * 0.4;
      const ch2 = baseCh2 + (Math.random() - 0.5) * 0.4;
      const ch3 = baseCh3 + (Math.random() - 0.5) * 0.25;
      const ch4 = baseCh4 + (Math.random() - 0.5) * 0.35;

      const timestampUnix = Math.floor(timestamp.getTime() / 1000);
      
      const tiwaterData = {
        "CAUDAL PURIFICADA": parseFloat(caudalPurificada.toFixed(2)),
        "CAUDAL RECUPERACION": parseFloat(caudalRecuperacion.toFixed(2)),
        "CAUDAL RECHAZO": parseFloat(caudalRechazo.toFixed(2)),
        "NIVEL PURIFICADA": parseFloat(nivelPurificada.toFixed(1)),
        "NIVEL CRUDA": parseFloat(nivelCruda.toFixed(1)),
        "PORCENTAJE NIVEL PURIFICADA": parseFloat(nivelPurificada.toFixed(1)),
        "PORCENTAJE NIVEL CRUDA": parseFloat(nivelCruda.toFixed(1)),
        "CAUDAL CRUDA": parseFloat((baseCaudalCruda + (Math.random() - 0.5) * 0.2).toFixed(2)),
        "ACUMULADO CRUDA": parseFloat((2000.0 + hour * 15 + Math.random() * 10).toFixed(1)),
        "CAUDAL CRUDA L/min": parseFloat((baseCaudalCrudaLmin + (Math.random() - 0.5) * 2).toFixed(3)),
        "vida": Math.floor(75 + Math.random() * 20),
        "TDS": tds,
        "PRESION CO2": parseFloat((300 + (Math.random() - 0.5) * 8).toFixed(2)),
        "ch1": parseFloat(ch1.toFixed(2)),
        "ch2": parseFloat(ch2.toFixed(2)),
        "ch3": parseFloat(ch3.toFixed(2)),
        "ch4": parseFloat(ch4.toFixed(2)),
        "EFICIENCIA": parseFloat(eficiencia.toFixed(1)),
        "timestamp": timestampUnix
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

    console.log(`[Generate Daily Data] Completado: ${publishedCount} publicados, ${errorCount} errores (fecha: ${startOfDay.toISOString().slice(0, 10)})`);

    res.json({
      success: true,
      message: `Generados ${publishedCount} de 24 mensajes MQTT (1 por hora, fecha: ${startOfDay.toISOString().slice(0, 10)})`,
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
 * Generate one mock sensor snapshot for this punto with current timestamp and send to MQTT only.
 * Same payload structure as generate-daily-data; consumer persists to PostgreSQL.
 */
export const generateMockDataNow = async (req, res) => {
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
      if (punto) codigoTienda = (punto.codigo_tienda || '').toUpperCase();
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = (punto.codigo_tienda || codigoDirecto).toUpperCase();
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

    codigoTienda = codigoTienda.toUpperCase();
    const timestampUnix = Math.floor(Date.now() / 1000);
    const topic = `tiwater/${codigoTienda}/data`;
    const tiwaterPayload = buildMockTiwaterPayload(timestampUnix);
    const message = JSON.stringify(tiwaterPayload);
    await mqttService.publish(topic, message);

    console.log(`[generateMockDataNow] Enviado a MQTT ${topic} (timestamp actual)`);

    return res.json({
      success: true,
      message: 'Datos mock enviados a MQTT (timestamp actual)',
      data: {
        puntoVentaId: id,
        codigoTienda,
        topic,
        timestamp: new Date(timestampUnix * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('[generateMockDataNow] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al generar datos mock',
      error: error.message
    });
  }
};

/**
 * Build one mock tiwater payload (current timestamp, random plausible values).
 * Shared by generateMockDataNow and generateMockDataNowAllDevMode.
 */
function buildMockTiwaterPayload(timestampUnix = Math.floor(Date.now() / 1000)) {
  const nivelPurificada = Math.round((25 + Math.random() * 55) * 10) / 10;
  const nivelCruda = Math.round((35 + Math.random() * 45) * 10) / 10;
  return {
    'CAUDAL PURIFICADA': parseFloat((0.5 + Math.random() * 1.5).toFixed(2)),
    'CAUDAL RECUPERACION': parseFloat((1.5 + Math.random() * 1.2).toFixed(2)),
    'CAUDAL RECHAZO': parseFloat((0.1 + Math.random() * 0.3).toFixed(2)),
    'NIVEL PURIFICADA': nivelPurificada,
    'NIVEL CRUDA': nivelCruda,
    'PORCENTAJE NIVEL PURIFICADA': nivelPurificada,
    'PORCENTAJE NIVEL CRUDA': nivelCruda,
    'CAUDAL CRUDA': parseFloat((1.5 + Math.random() * 1.0).toFixed(2)),
    'ACUMULADO CRUDA': parseFloat((1500 + Math.random() * 3000).toFixed(1)),
    'CAUDAL CRUDA L/min': parseFloat((18 + Math.random() * 8).toFixed(3)),
    vida: Math.floor(50 + Math.random() * 150),
    TDS: Math.round(40 + Math.random() * 120),
    'PRESION CO2': parseFloat((40 + Math.random() * 60).toFixed(2)),
    ch1: parseFloat((2 + Math.random() * 3).toFixed(2)),
    ch2: parseFloat((2 + Math.random() * 3).toFixed(2)),
    ch3: parseFloat((1 + Math.random() * 2).toFixed(2)),
    ch4: parseFloat((2 + Math.random() * 2.5).toFixed(2)),
    EFICIENCIA: parseFloat((45 + Math.random() * 25).toFixed(1)),
    timestamp: timestampUnix
  };
}

/**
 * Generate mock data now for all puntos with dev_mode enabled. Sends each to MQTT (same as single-punto flow).
 * Used by cron; auth: X-Cron-Secret header or JWT with /puntoVenta.
 */
export const generateMockDataNowAllDevMode = async (req, res) => {
  try {
    const PuntoVentaModel = (await import('../models/postgres/puntoVenta.model.js')).default;
    const puntos = await PuntoVentaModel.findAllWithDevModeEnabled();

    if (puntos.length === 0) {
      return res.json({
        success: true,
        message: 'No hay puntos con dev_mode habilitado',
        data: { puntosProcessed: 0, errors: [] }
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

    const timestampUnix = Math.floor(Date.now() / 1000);
    const errors = [];
    let puntosProcessed = 0;

    for (const punto of puntos) {
      const codigoTienda = (punto.codigo_tienda || punto.code || '').toString().toUpperCase();
      if (!codigoTienda) {
        errors.push(`Punto id ${punto.id}: sin codigo_tienda`);
        continue;
      }
      try {
        const topic = `tiwater/${codigoTienda}/data`;
        const tiwaterPayload = buildMockTiwaterPayload(timestampUnix);
        const message = JSON.stringify(tiwaterPayload);
        await mqttService.publish(topic, message);
        puntosProcessed += 1;
      } catch (err) {
        errors.push(`Punto ${codigoTienda}: ${err.message}`);
      }
    }

    if (puntosProcessed > 0) {
      console.log(`[generateMockDataNowAllDevMode] ${puntosProcessed} puntos enviados a MQTT`);
    }
    if (errors.length > 0) {
      errors.forEach((e) => console.warn('[generateMockDataNowAllDevMode]', e));
    }

    return res.json({
      success: true,
      message: `Datos mock enviados a MQTT para ${puntosProcessed} punto(s) con dev_mode`,
      data: { puntosProcessed, errors }
    });
  } catch (error) {
    console.error('[generateMockDataNowAllDevMode] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al generar datos mock para dev_mode',
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
      if (punto) codigoTienda = (punto.codigo_tienda || '').toUpperCase();
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = (punto.codigo_tienda || codigoDirecto).toUpperCase();
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

    codigoTienda = codigoTienda.toUpperCase();

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
    const nivelCrudaPercent = 65;

    // Send full sensor data (same as real device) and override only nivel cruda
    const fullPayload = await getLatestTiwaterPayloadForPublish(codigoTienda);
    fullPayload['NIVEL CRUDA'] = nivelCrudaPercent;
    fullPayload['PORCENTAJE NIVEL CRUDA'] = nivelCrudaPercent;
    fullPayload.timestamp = timestampUnix;

    const message = JSON.stringify(fullPayload);
    await mqttService.publish(topic, message);

    console.log(`[Simulate Bajo Nivel Cruda] Publicado en ${topic}: nivel cruda ${nivelCrudaPercent}% (payload completo)`);

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
      if (punto) codigoTienda = (punto.codigo_tienda || '').toUpperCase();
    } else {
      const codigoDirecto = id.toUpperCase();
      punto = await PuntoVenta.findOne({ codigo_tienda: codigoDirecto }).populate('productos');
      if (punto) codigoTienda = (punto.codigo_tienda || codigoDirecto).toUpperCase();
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

    codigoTienda = codigoTienda.toUpperCase();

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

    // Send full sensor data (same as real device) and override only nivel cruda
    const fullPayload = await getLatestTiwaterPayloadForPublish(codigoTienda);
    fullPayload['NIVEL CRUDA'] = nivelCrudaPercent;
    fullPayload['PORCENTAJE NIVEL CRUDA'] = nivelCrudaPercent;
    fullPayload.timestamp = timestampUnix;

    const message = JSON.stringify(fullPayload);
    await mqttService.publish(topic, message);

    console.log(`[Simulate Nivel Cruda Normalizado] Publicado en ${topic}: nivel cruda ${nivelCrudaPercent}% (payload completo)`);

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
