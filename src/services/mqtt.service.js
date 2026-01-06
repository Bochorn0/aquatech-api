// src/services/mqtt.service.js
// Servicio MQTT para consumir mensajes de Mosquitto

import mqtt from 'mqtt';
import SensorData from '../models/sensorData.model.js';
import Controller from '../models/controller.model.js';
import PuntoVenta from '../models/puntoVenta.model.js';
import PostgresService from './postgres.service.js';

// Configuración MQTT desde variables de entorno
const MQTT_BROKER = process.env.MQTT_BROKER || '146.190.143.141';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || 'aquatech-api-consumer';

// Topics a los que nos suscribimos
// Estructura: aquatech/{codigo_tienda}/{equipo_id}/data
// Usando wildcards (+) para recibir mensajes de cualquier tienda/equipo
const TOPICS = {
  TIENDA_EQUIPO_DATA: 'aquatech/+/+/data',      // Datos de sensores: aquatech/{codigo_tienda}/{equipo_id}/data
  TIENDA_EQUIPO_STATUS: 'aquatech/+/+/status',  // Estado: aquatech/{codigo_tienda}/{equipo_id}/status
  // Mantener compatibilidad con topics antiguos
  LEGACY_GATEWAY_DATA: 'aquatech/gateway/+/data',
  LEGACY_GATEWAY_STATUS: 'aquatech/gateway/+/status',
  LEGACY_DATA: 'aquatech/data',
  LEGACY_STATUS: 'aquatech/status'
};

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
  }

  // Conectar al broker MQTT
  connect() {
    const mqttUrl = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
    
    console.log(`[MQTT] Conectando a ${mqttUrl}...`);

    this.client = mqtt.connect(mqttUrl, {
      clientId: MQTT_CLIENT_ID,
      clean: true,
      reconnectPeriod: 5000, // Reintentar cada 5 segundos
      connectTimeout: 10000, // Timeout de 10 segundos
    });

    // Evento: Conexión exitosa
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log(`[MQTT] ✅ Conectado al broker ${MQTT_BROKER}:${MQTT_PORT}`);
      
      // Suscribirse a todos los topics
      this.subscribeToTopics();
    });

    // Evento: Error de conexión
    this.client.on('error', (error) => {
      console.error('[MQTT] ❌ Error de conexión:', error);
      this.isConnected = false;
    });

    // Evento: Desconexión
    this.client.on('close', () => {
      console.log('[MQTT] ⚠️  Desconectado del broker');
      this.isConnected = false;
    });

    // Evento: Reconexión
    this.client.on('reconnect', () => {
      console.log('[MQTT] 🔄 Reintentando conexión...');
    });

    // Evento: Mensaje recibido
    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });
  }

  // Suscribirse a los topics
  subscribeToTopics() {
    const topics = Object.values(TOPICS);
    
    topics.forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] ❌ Error al suscribirse a ${topic}:`, err);
        } else {
          console.log(`[MQTT] ✅ Suscrito a topic: ${topic}`);
        }
      });
    });
  }

  // Manejar mensajes recibidos
  handleMessage(topic, message) {
    try {
      console.log(`[MQTT] 📨 Mensaje recibido en ${topic}:`, message);

      // Parsear topic: aquatech/{codigo_tienda}/{equipo_id}/data o /status
      const topicParts = topic.split('/');
      
      // Detectar tipo de topic usando patrones
      if (topicParts.length === 4 && topicParts[0] === 'aquatech' && topicParts[3] === 'data') {
        // Nuevo formato: aquatech/{codigo_tienda}/{equipo_id}/data
        const codigo_tienda = topicParts[1];
        const equipo_id = topicParts[2];
        this.handleTiendaEquipoData(codigo_tienda, equipo_id, message);
      } else if (topicParts.length === 4 && topicParts[0] === 'aquatech' && topicParts[3] === 'status') {
        // Nuevo formato: aquatech/{codigo_tienda}/{equipo_id}/status
        const codigo_tienda = topicParts[1];
        const equipo_id = topicParts[2];
        this.handleTiendaEquipoStatus(codigo_tienda, equipo_id, message);
      } else if (topic.includes('/gateway/') && topic.endsWith('/data')) {
        // Formato legacy: aquatech/gateway/{gateway_id}/data
        this.handleGatewayData(topic, message);
      } else if (topic.includes('/gateway/') && topic.endsWith('/status')) {
        // Formato legacy: aquatech/gateway/{gateway_id}/status
        this.handleGatewayStatus(topic, message);
      } else if (topic === 'aquatech/data' || (topicParts.length === 2 && topicParts[1] === 'data')) {
        // Formato legacy o compatible
        this.handleData(message);
      } else if (topic === 'aquatech/status' || (topicParts.length === 2 && topicParts[1] === 'status')) {
        // Formato legacy o compatible
        this.handleStatus(message);
      } else {
        console.log(`[MQTT] ⚠️  Topic desconocido: ${topic}`);
      }

      // Ejecutar handlers personalizados si existen
      if (this.messageHandlers.has(topic)) {
        const handler = this.messageHandlers.get(topic);
        handler(topic, message);
      }

    } catch (error) {
      console.error(`[MQTT] ❌ Error al procesar mensaje de ${topic}:`, error);
    }
  }

  // Manejar presión IN
  handlePresionIn(message) {
    const presionIn = parseFloat(message);
    console.log(`[MQTT] Presión IN: ${presionIn}`);
    
    // Aquí puedes guardar en la base de datos o procesar el dato
    // Ejemplo: await this.savePresionData({ presion_in: presionIn });
  }

  // Manejar presión OUT
  handlePresionOut(message) {
    const presionOut = parseFloat(message);
    console.log(`[MQTT] Presión OUT: ${presionOut}`);
    
    // Aquí puedes guardar en la base de datos o procesar el dato
    // Ejemplo: await this.savePresionData({ presion_out: presionOut });
  }

  // Manejar datos combinados (JSON)
  handleData(message) {
    try {
      const data = JSON.parse(message);
      console.log(`[MQTT] 📊 Datos completos recibidos:`, JSON.stringify(data, null, 2));
      
      // Aquí puedes guardar en la base de datos
      // Ejemplo: await this.savePresionData(data);
      
      // Los datos vienen en formato:
      // {
      //   "presion_in": 45.3,
      //   "presion_out": 67.8,
      //   "timestamp": 123,
      //   "source": "WiFi" o "LoRa"
      // }
    } catch (error) {
      console.error('[MQTT] ❌ Error al parsear JSON:', error);
      console.error('[MQTT] Mensaje recibido:', message);
    }
  }

  // Manejar estado del dispositivo
  handleStatus(message) {
    try {
      const status = JSON.parse(message);
      console.log(`[MQTT] Estado del dispositivo:`, status);
      
      // Los datos vienen en formato:
      // {
      //   "status": "online",
      //   "ip": "192.168.1.100"
      // }
    } catch (error) {
      console.error('[MQTT] ❌ Error al parsear status JSON:', error);
    }
  }

  // Manejar datos del gateway (nuevo formato)
  async handleGatewayData(topic, message) {
    try {
      // Extraer gateway_id del topic: aquatech/gateway/{gateway_id}/data
      const topicParts = topic.split('/');
      const gatewayId = topicParts[2]; // Índice 2 es el gateway_id
      
      const data = JSON.parse(message);
      console.log(`[MQTT] 📊 Datos del gateway ${gatewayId}:`, JSON.stringify(data, null, 2));
      
      // Buscar el controller asociado al gateway_id
      const controller = await Controller.findOne({ id: gatewayId });
      
      if (!controller) {
        console.warn(`[MQTT] ⚠️  Controller no encontrado para gateway_id: ${gatewayId}`);
        // Guardar datos sin referencias si el controller no existe
        await this.saveSensorData({
          gateway_id: gatewayId,
          ...data.sensors,
          source: data.source || 'LoRa',
          rssi: data.rssi,
          timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date()
        });
        return;
      }
      
      // Guardar datos con referencias
      await this.saveSensorData({
        gateway_id: gatewayId,
        controller: controller._id,
        product: controller.product,
        cliente: controller.cliente,
        pressure_in: data.sensors?.pressure_in,
        pressure_out: data.sensors?.pressure_out,
        water_level: data.sensors?.water_level,
        source: data.source || 'LoRa',
        rssi: data.rssi,
        timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
        metadata: data.metadata || {}
      });
      
      console.log(`[MQTT] ✅ Datos guardados para gateway ${gatewayId}`);
      
    } catch (error) {
      console.error('[MQTT] ❌ Error al procesar datos del gateway:', error);
      console.error('[MQTT] Mensaje recibido:', message);
    }
  }

  // Manejar estado del gateway
  async handleGatewayStatus(topic, message) {
    try {
      // Extraer gateway_id del topic
      const topicParts = topic.split('/');
      const gatewayId = topicParts[2];
      
      const status = JSON.parse(message);
      console.log(`[MQTT] 📡 Estado del gateway ${gatewayId}:`, status);
      
      // Actualizar estado online del controller
      const controller = await Controller.findOne({ id: gatewayId });
      if (controller) {
        controller.online = status.status === 'online';
        controller.ip = status.ip || controller.ip;
        controller.last_time_active = Math.floor(Date.now() / 1000);
        await controller.save();
        console.log(`[MQTT] ✅ Estado del controller ${gatewayId} actualizado: ${status.status}`);
      }
      
    } catch (error) {
      console.error('[MQTT] ❌ Error al procesar status del gateway:', error);
    }
  }

  // Manejar datos de tienda/equipo (nuevo formato principal)
  async handleTiendaEquipoData(codigo_tienda, equipo_id, message) {
    try {
      const data = JSON.parse(message);
      console.log(`[MQTT] 📊 Datos de ${codigo_tienda}/${equipo_id}:`, JSON.stringify(data, null, 2));
      
      // Buscar el punto de venta por código_tienda (si existe)
      let puntoVenta = null;
      if (codigo_tienda) {
        puntoVenta = await PuntoVenta.findOne({ codigo_tienda: codigo_tienda.toUpperCase() });
        
        if (!puntoVenta) {
          console.warn(`[MQTT] ⚠️  Punto de venta no encontrado para codigo_tienda: ${codigo_tienda}`);
        }
      }
      
      // Buscar controller/product por equipo_id (puede coincidir con id del controller o product)
      let controller = null;
      let product = null;
      
      if (equipo_id) {
        // Primero intentar buscar por punto de venta si existe
        if (puntoVenta && puntoVenta.controladores && puntoVenta.controladores.length > 0) {
          // Buscar controller que coincida con equipo_id
          controller = await Controller.findOne({ 
            _id: { $in: puntoVenta.controladores },
            id: equipo_id 
          });
        }
        
        // Si no se encontró en el punto de venta, buscar globalmente
        if (!controller) {
          controller = await Controller.findOne({ id: equipo_id });
        }
        
        // Si no hay controller, buscar product
        if (!controller) {
          const Product = (await import('../models/product.model.js')).default;
          if (puntoVenta && puntoVenta.productos && puntoVenta.productos.length > 0) {
            product = await Product.findOne({ 
              _id: { $in: puntoVenta.productos },
              id: equipo_id 
            });
          }
          
          // Si no se encontró en el punto de venta, buscar globalmente
          if (!product) {
            product = await Product.findOne({ id: equipo_id });
          }
        }
      }
      
      // Preparar datos para guardar
      const sensorDataPayload = {
        // Solo incluir codigo_tienda y equipo_id si existen
        ...(codigo_tienda && { codigo_tienda: codigo_tienda.toUpperCase() }),
        ...(equipo_id && { equipo_id: equipo_id }),
        punto_venta: puntoVenta?._id,
        controller: controller?._id,
        product: product?._id,
        cliente: puntoVenta?.cliente || controller?.cliente || product?.cliente,
        
        // Sensores del equipo
        flujo_produccion: data.flujo_produccion,
        flujo_rechazo: data.flujo_rechazo,
        tds: data.tds,
        electronivel_purificada: data.electronivel_purificada,
        electronivel_recuperada: data.electronivel_recuperada,
        presion_in: data.presion_in,
        presion_out: data.presion_out,
        
        // Metadatos
        source: data.source || 'Siemens2050',
        gateway_ip: data.gateway_ip || data.ip,
        timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
        metadata: data.metadata || {}
      };
      
      // Guardar datos
      await this.saveSensorData(sensorDataPayload);
      console.log(`[MQTT] ✅ Datos guardados para ${codigo_tienda || 'N/A'}/${equipo_id || 'N/A'}`);
      
    } catch (error) {
      console.error(`[MQTT] ❌ Error al procesar datos de ${codigo_tienda}/${equipo_id}:`, error);
      console.error('[MQTT] Mensaje recibido:', message);
    }
  }

  // Manejar estado de tienda/equipo
  async handleTiendaEquipoStatus(codigo_tienda, equipo_id, message) {
    try {
      const status = JSON.parse(message);
      console.log(`[MQTT] 📡 Estado de ${codigo_tienda || 'N/A'}/${equipo_id || 'N/A'}:`, status);
      
      // Buscar controller por equipo_id (si existe)
      let controller = null;
      
      if (equipo_id) {
        // Si hay codigo_tienda, buscar primero en el punto de venta
        if (codigo_tienda) {
          const puntoVenta = await PuntoVenta.findOne({ codigo_tienda: codigo_tienda.toUpperCase() });
          
          if (puntoVenta && puntoVenta.controladores && puntoVenta.controladores.length > 0) {
            controller = await Controller.findOne({ 
              _id: { $in: puntoVenta.controladores },
              id: equipo_id 
            });
          }
        }
        
        // Si no se encontró, buscar globalmente
        if (!controller) {
          controller = await Controller.findOne({ id: equipo_id });
        }
        
        if (controller) {
          controller.online = status.status === 'online';
          controller.ip = status.ip || controller.ip;
          controller.last_time_active = Math.floor(Date.now() / 1000);
          await controller.save();
          console.log(`[MQTT] ✅ Estado del controller ${equipo_id} actualizado: ${status.status}`);
        } else {
          console.warn(`[MQTT] ⚠️  Controller no encontrado para equipo_id: ${equipo_id}`);
        }
      }
      
    } catch (error) {
      console.error(`[MQTT] ❌ Error al procesar status de ${codigo_tienda}/${equipo_id}:`, error);
    }
  }

  // Guardar datos de sensores en MongoDB y PostgreSQL (dual write)
  async saveSensorData(data) {
    try {
      // Save to MongoDB (existing functionality)
      const sensorData = new SensorData(data);
      const mongoDoc = await sensorData.save();
      
      // Save to PostgreSQL (new functionality - non-blocking)
      // We don't want PostgreSQL errors to break MongoDB writes
      this.saveToPostgreSQL(data, mongoDoc._id.toString()).catch(error => {
        console.error('[MQTT] ⚠️  Error saving to PostgreSQL (non-critical):', error.message);
        // Don't throw - allow MongoDB write to succeed even if PostgreSQL fails
      });
      
      return sensorData;
    } catch (error) {
      console.error('[MQTT] ❌ Error al guardar datos de sensores:', error);
      throw error;
    }
  }

  // Guardar datos en PostgreSQL
  async saveToPostgreSQL(data, mongoId = null) {
    try {
      // Extract context from data
      const context = {
        codigo_tienda: data.codigo_tienda,
        equipo_id: data.equipo_id,
        cliente_id: data.cliente ? data.cliente.toString() : null,
        owner_id: data.ownerId || null,
        resource_type: data.controller ? 'controller' : (data.product ? 'product' : null),
        source: data.source || 'Siemens2050',
        lat: data.lat || null,
        long: data.long || null,
        metadata: {
          mongo_id: mongoId,
          ...data.metadata
        }
      };

      // Option 1: Save as single record with all sensor values in meta
      // This is more flexible and stores everything
      await PostgresService.saveSensorFromMQTT(data, context);
      
      // Option 2: Save as multiple records (one per sensor type)
      // Uncomment if you want separate records for each sensor type
      // await PostgresService.saveMultipleSensorsFromMQTT(data, context);
      
    } catch (error) {
      // Log error but don't throw - this is a non-critical operation
      console.error('[MQTT] Error saving to PostgreSQL:', error);
      throw error; // Re-throw so caller can handle if needed
    }
  }

  // Registrar un handler personalizado para un topic
  onMessage(topic, handler) {
    this.messageHandlers.set(topic, handler);
  }

  // Publicar un mensaje (opcional, si necesitas enviar comandos)
  publish(topic, message) {
    if (!this.isConnected) {
      console.error('[MQTT] ❌ No conectado, no se puede publicar');
      return false;
    }

    this.client.publish(topic, message, (err) => {
      if (err) {
        console.error(`[MQTT] ❌ Error al publicar en ${topic}:`, err);
      } else {
        console.log(`[MQTT] ✅ Publicado en ${topic}: ${message}`);
      }
    });

    return true;
  }

  // Desconectar
  disconnect() {
    if (this.client) {
      this.client.end();
      console.log('[MQTT] Desconectado');
    }
  }

  // Obtener estado de conexión
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      broker: `${MQTT_BROKER}:${MQTT_PORT}`,
      clientId: MQTT_CLIENT_ID
    };
  }
}

// Crear instancia singleton
const mqttService = new MQTTService();

export default mqttService;

