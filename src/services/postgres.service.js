// src/services/postgres.service.js
// Service layer for PostgreSQL operations

import SensoresModel from '../models/postgres/sensores.model.js';
import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';

/**
 * PostgreSQL Service
 * Handles business logic for PostgreSQL operations
 */
class PostgresService {
  /**
   * Save sensor data from MQTT message
   * Maps MQTT payload to sensores table structure
   * Automatically creates or updates puntoVenta if codigo_tienda is provided
   * @param {Object} mqttData - Data received from MQTT
   * @param {Object} context - Additional context (codigo_tienda, equipo_id, etc.)
   * @returns {Promise<Object>} Created sensor record
   */
  static async saveSensorFromMQTT(mqttData, context = {}) {
    try {
      // Get codigo_tienda from context or mqttData
      const codigoTienda = context.codigo_tienda || mqttData.codigo_tienda || mqttData.codigoTienda;
      
      // Automatically create or get puntoVenta if codigo_tienda is provided
      if (codigoTienda) {
        try {
          // Generar nombre por defecto si no se proporciona
          const defaultName = mqttData.punto_venta_name || context.punto_venta_name || `Punto de Venta ${codigoTienda}`;
          
          const puntoVenta = await PuntoVentaModel.getOrCreate({
            code: codigoTienda,
            codigo_tienda: codigoTienda,
            name: defaultName,
            owner: context.owner_id || mqttData.owner_id || null,
            clientId: context.cliente_id || mqttData.cliente_id || null,
            status: 'active',
            lat: mqttData.lat || context.lat || null,
            long: mqttData.long || context.long || mqttData.lon || null,
            address: mqttData.address || context.address || null,
            contactId: context.contact_id || mqttData.contact_id || null,
            meta: {
              source: 'MQTT',
              created_from: 'sensor_data',
              created_at: new Date().toISOString(),
              gateway_ip: mqttData.gateway_ip || mqttData.ip || null,
              auto_created: true
            }
          });
          
          if (puntoVenta) {
            console.log(`[PostgresService] ✅ PuntoVenta ${puntoVenta.id ? 'creado' : 'encontrado'} para codigo_tienda: ${codigoTienda} (ID: ${puntoVenta.id})`);
          } else {
            console.log(`[PostgresService] ✅ PuntoVenta procesado para codigo_tienda: ${codigoTienda}`);
          }
        } catch (error) {
          // Log error but don't fail sensor data save
          console.error(`[PostgresService] ⚠️  Error ensuring puntoVenta for ${codigoTienda}:`, error.message);
        }
      }

      // Map MQTT data to sensores table structure
      // This is a flexible mapping - adjust based on your actual MQTT payload structure
      
      const sensorData = {
        // Basic information
        name: mqttData.name || context.equipo_id || null,
        type: mqttData.type || this.detectSensorType(mqttData),
        value: mqttData.value || this.extractValue(mqttData),
        
        // Timestamp
        timestamp: mqttData.timestamp 
          ? new Date(mqttData.timestamp * 1000) 
          : (mqttData.timestamp ? new Date(mqttData.timestamp) : new Date()),
        
        // Context from MQTT topic/context
        codigoTienda: context.codigo_tienda || mqttData.codigo_tienda || null,
        resourceId: context.equipo_id || mqttData.equipo_id || mqttData.gateway_id || null,
        resourceType: context.resource_type || this.detectResourceType(context),
        clientId: context.cliente_id || mqttData.cliente_id || null,
        ownerId: context.owner_id || mqttData.owner_id || null,
        
        // Status and metadata
        status: mqttData.status || 'active',
        label: mqttData.label || context.label || null,
        lat: mqttData.lat || context.lat || null,
        long: mqttData.long || context.long || mqttData.lon || null,
        
        // Metadata - store all additional fields here
        meta: {
          ...mqttData,
          source: mqttData.source || context.source || 'MQTT',
          gateway_ip: mqttData.gateway_ip || mqttData.ip || null,
          rssi: mqttData.rssi || null,
          // Store all sensor values in meta for flexibility
          flujo_produccion: mqttData.flujo_produccion || null,
          flujo_rechazo: mqttData.flujo_rechazo || null,
          tds: mqttData.tds || null,
          electronivel_purificada: mqttData.electronivel_purificada || null,
          electronivel_recuperada: mqttData.electronivel_recuperada || null,
          presion_in: mqttData.presion_in || mqttData.pressure_in || null,
          presion_out: mqttData.presion_out || mqttData.pressure_out || null,
          water_level: mqttData.water_level || null,
          ...context.metadata
        }
      };

      // Save to PostgreSQL
      const savedSensor = await SensoresModel.create(sensorData);
      
      console.log(`[PostgresService] ✅ Sensor data saved to PostgreSQL: ID ${savedSensor.id}`);
      
      return savedSensor;
    } catch (error) {
      console.error('[PostgresService] ❌ Error saving sensor data to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Save multiple sensor readings from a single MQTT message
   * Useful when one MQTT message contains multiple sensor values
   * Automatically creates or updates puntoVenta if codigo_tienda is provided
   * @param {Object} mqttData - Data received from MQTT
   * @param {Object} context - Additional context
   * @returns {Promise<Array>} Array of created sensor records
   */
  static async saveMultipleSensorsFromMQTT(mqttData, context = {}) {
    try {
      // Get codigo_tienda from context or mqttData
      const codigoTienda = context.codigo_tienda || mqttData.codigo_tienda || mqttData.codigoTienda;
      
      // Automatically create or get puntoVenta if codigo_tienda is provided
      if (codigoTienda) {
        try {
          // Generar nombre por defecto si no se proporciona
          const defaultName = mqttData.punto_venta_name || context.punto_venta_name || `Punto de Venta ${codigoTienda}`;
          
          const puntoVenta = await PuntoVentaModel.getOrCreate({
            code: codigoTienda,
            codigo_tienda: codigoTienda,
            name: defaultName,
            owner: context.owner_id || mqttData.owner_id || null,
            clientId: context.cliente_id || mqttData.cliente_id || null,
            status: 'active',
            lat: mqttData.lat || context.lat || null,
            long: mqttData.long || context.long || mqttData.lon || null,
            address: mqttData.address || context.address || null,
            contactId: context.contact_id || mqttData.contact_id || null,
            meta: {
              source: 'MQTT',
              created_from: 'sensor_data',
              created_at: new Date().toISOString(),
              gateway_ip: mqttData.gateway_ip || mqttData.ip || null,
              auto_created: true
            }
          });
          
          if (puntoVenta) {
            console.log(`[PostgresService] ✅ PuntoVenta ${puntoVenta.id ? 'creado' : 'encontrado'} para codigo_tienda: ${codigoTienda} (ID: ${puntoVenta.id})`);
          } else {
            console.log(`[PostgresService] ✅ PuntoVenta procesado para codigo_tienda: ${codigoTienda}`);
          }
        } catch (error) {
          // Log error but don't fail sensor data save
          console.error(`[PostgresService] ⚠️  Error ensuring puntoVenta for ${codigoTienda}:`, error.message);
        }
      }

      const sensors = [];
      const timestamp = mqttData.timestamp 
        ? new Date(mqttData.timestamp * 1000) 
        : (mqttData.timestamp ? new Date(mqttData.timestamp) : new Date());

      // Extract individual sensor values and create separate records
      // Incluir todos los tipos de sensores del formato tiwater
      const sensorMappings = [
        { type: 'flujo_produccion', value: mqttData.flujo_produccion, name: 'Flujo Producción' },
        { type: 'flujo_rechazo', value: mqttData.flujo_rechazo, name: 'Flujo Rechazo' },
        { type: 'flujo_recuperacion', value: mqttData.flujo_recuperacion, name: 'Flujo Recuperación' },
        { type: 'tds', value: mqttData.tds, name: 'TDS' },
        { type: 'electronivel_purificada', value: mqttData.electronivel_purificada || mqttData.nivel_purificada, name: 'Nivel Purificada' },
        { type: 'electronivel_recuperada', value: mqttData.electronivel_recuperada, name: 'Nivel Recuperada' },
        { type: 'nivel_purificada', value: mqttData.nivel_purificada, name: 'Nivel Purificada (absoluto)' },
        { type: 'nivel_cruda', value: mqttData.nivel_cruda, name: 'Nivel Cruda' },
        { type: 'caudal_cruda', value: mqttData.caudal_cruda, name: 'Caudal Cruda' },
        { type: 'caudal_cruda_lmin', value: mqttData.caudal_cruda_lmin, name: 'Caudal Cruda (L/min)' },
        { type: 'acumulado_cruda', value: mqttData.acumulado_cruda, name: 'Acumulado Cruda' },
        { type: 'presion_in', value: mqttData.presion_in || mqttData.pressure_in, name: 'Presión Entrada' },
        { type: 'presion_out', value: mqttData.presion_out || mqttData.pressure_out, name: 'Presión Salida' },
        { type: 'presion_co2', value: mqttData.presion_co2, name: 'Presión CO2' },
        { type: 'eficiencia', value: mqttData.eficiencia, name: 'Eficiencia' },
        { type: 'vida', value: mqttData.vida, name: 'Vida' },
        { type: 'water_level', value: mqttData.water_level, name: 'Nivel Agua' },
        // Nuevos campos de corriente
        { type: 'corriente_ch1', value: mqttData.ch1, name: 'Corriente Canal 1' },
        { type: 'corriente_ch2', value: mqttData.ch2, name: 'Corriente Canal 2' },
        { type: 'corriente_ch3', value: mqttData.ch3, name: 'Corriente Canal 3' },
        { type: 'corriente_ch4', value: mqttData.ch4, name: 'Corriente Canal 4' },
        { type: 'corriente_total', value: mqttData.total_corriente, name: 'Corriente Total' }
      ];

      for (const mapping of sensorMappings) {
        if (mapping.value !== undefined && mapping.value !== null) {
          const sensorData = {
            name: mapping.name,
            type: mapping.type,
            value: parseFloat(mapping.value),
            timestamp: timestamp,
            codigoTienda: context.codigo_tienda || mqttData.codigo_tienda || null,
            resourceId: context.equipo_id || mqttData.equipo_id || mqttData.gateway_id || null,
            resourceType: context.resource_type || this.detectResourceType(context),
            clientId: context.cliente_id || mqttData.cliente_id || null,
            ownerId: context.owner_id || mqttData.owner_id || null,
            status: 'active',
            label: context.label || null,
            lat: mqttData.lat || context.lat || null,
            long: mqttData.long || context.long || mqttData.lon || null,
            meta: {
              source: mqttData.source || context.source || 'MQTT',
              gateway_ip: mqttData.gateway_ip || mqttData.ip || null,
              rssi: mqttData.rssi || null,
              original_payload: mqttData
            }
          };
          
          sensors.push(sensorData);
        }
      }

      if (sensors.length === 0) {
        console.warn('[PostgresService] ⚠️  No sensor values found in MQTT data');
        return [];
      }

      // Save all sensors in a single transaction
      const savedSensors = await SensoresModel.createMany(sensors);
      
      console.log(`[PostgresService] ✅ ${savedSensors.length} sensor readings saved to PostgreSQL`);
      
      return savedSensors;
    } catch (error) {
      console.error('[PostgresService] ❌ Error saving multiple sensors to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Detect sensor type from MQTT data
   * @param {Object} data - MQTT data
   * @returns {String} Sensor type
   */
  static detectSensorType(data) {
    // Try to detect from field names
    if (data.flujo_produccion !== undefined) return 'flujo_produccion';
    if (data.flujo_rechazo !== undefined) return 'flujo_rechazo';
    if (data.tds !== undefined) return 'tds';
    if (data.electronivel_purificada !== undefined) return 'electronivel_purificada';
    if (data.electronivel_recuperada !== undefined) return 'electronivel_recuperada';
    if (data.presion_in !== undefined || data.pressure_in !== undefined) return 'presion_in';
    if (data.presion_out !== undefined || data.pressure_out !== undefined) return 'presion_out';
    if (data.water_level !== undefined) return 'water_level';
    
    return 'unknown';
  }

  /**
   * Extract value from MQTT data
   * @param {Object} data - MQTT data
   * @returns {Number|null} Sensor value
   */
  static extractValue(data) {
    // Try common value fields
    if (data.value !== undefined) return parseFloat(data.value);
    if (data.flujo_produccion !== undefined) return parseFloat(data.flujo_produccion);
    if (data.tds !== undefined) return parseFloat(data.tds);
    if (data.presion_in !== undefined) return parseFloat(data.presion_in);
    if (data.pressure_in !== undefined) return parseFloat(data.pressure_in);
    
    return null;
  }

  /**
   * Detect resource type from context
   * @param {Object} context - Context object
   * @returns {String} Resource type
   */
  static detectResourceType(context) {
    if (context.resource_type) return context.resource_type;
    if (context.equipo_id) return 'equipo';
    if (context.gateway_id) return 'gateway';
    if (context.controller_id) return 'controller';
    if (context.product_id) return 'product';
    
    return 'unknown';
  }

  /**
   * Get sensor readings with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query result with data and pagination
   */
  static async getSensorReadings(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 100 } = options;
      const offset = (page - 1) * limit;

      const [data, total] = await Promise.all([
        SensoresModel.find(filters, { ...options, offset }),
        SensoresModel.count(filters)
      ]);

      return {
        success: true,
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[PostgresService] Error getting sensor readings:', error);
      throw error;
    }
  }

  /**
   * Get latest sensor reading
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object|null>} Latest sensor record
   */
  static async getLatestReading(filters = {}) {
    try {
      return await SensoresModel.findLatest(filters);
    } catch (error) {
      console.error('[PostgresService] Error getting latest reading:', error);
      throw error;
    }
  }
}

export default PostgresService;

