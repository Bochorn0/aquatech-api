// src/services/mqtt.service.js
// Servicio MQTT para consumir mensajes de Mosquitto

import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tls from 'tls';
import SensorData from '../models/sensorData.model.js';
import Controller from '../models/controller.model.js';
import PuntoVenta from '../models/puntoVenta.model.js';
import PostgresService from './postgres.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración MQTT desde variables de entorno
const MQTT_BROKER = process.env.MQTT_BROKER || '146.190.143.141';
const MQTT_PORT = parseInt(process.env.MQTT_PORT) || 1883;
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || 'tiwater-api-consumer';
const MQTT_USE_TLS = process.env.MQTT_USE_TLS === 'true' || MQTT_PORT === 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME || null;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || null;

// Certificado CA para TLS - Prioridad:
// 1. Variable de entorno MQTT_CA_CERT (recomendado)
// 2. Archivo en MQTT_CA_CERT_PATH
// 3. Certificado embebido (fallback, no recomendado para producción)
const MQTT_CA_CERT = process.env.MQTT_CA_CERT || null;
const MQTT_CA_CERT_PATH = process.env.MQTT_CA_CERT_PATH || null;

// Certificado CA embebido (solo como fallback si no se configura en .env)
const MQTT_CA_CERT_EMBEDDED = `-----BEGIN CERTIFICATE-----
MIIECTCCAvGgAwIBAgIUaeT7mWBE0krpOQdDiG/akjnNe9MwDQYJKoZIhvcNAQEL
BQAwgZMxCzAJBgNVBAYTAk1YMQ8wDQYDVQQIDAZTb25vcmExEzARBgNVBAcMCkhl
cm1vc2lsbG8xETAPBgNVBAoMCEFxdWF0ZWNoMQswCQYDVQQLDAJUSTETMBEGA1UE
AwwKQXF1YXRlY2hUSTEpMCcGCSqGSIb3DQEJARYaYXF1YXRlY2guaXQuMjAyNUBn
bWFpbC5jb20wHhcNMjUxMjI2MTQwMzE4WhcNMzUxMjI0MTQwMzE4WjCBkzELMAkG
A1UEBhMCTVgxDzANBgNVBAgMBlNvbm9yYTETMBEGA1UEBwwKSGVybW9zaWxsbzER
MA8GA1UECgwIQXF1YXRlY2gxCzAJBgNVBAsMAlRJMRMwEQYDVQQDDApBcXVhdGVj
aFRJMSkwJwYJKoZIhvcNAQkBFhphcXVhdGVjaC5pdC4yMDI1QGdtYWlsLmNvbTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKY2bVSij845H6cMaX3CHHdu
zN/EAa5bYHCt8Y5ACphCzLmS5BwBCG0MTgKBLckYaH3qdzjEvMt+jeZ37N2f/Kmh
DDj1LXeSzXAG/tKeNt/dp2FgsF2mblCRaYZxwyBpZjaa/pv30kahNmeiU1euLoBi
BaKOKgyXbSvU7AJ3trT09ZDWUIzicoEw7zr4zPe4eL/0A7yE03JSNNrsb06QJjcz
JIJUeg15GlzIi2hWmYYg/rX11znYq94CUNEf6wbbwZmh7oaEYwO/ru9nq0JaCzDs
lqpKEkSo4VedfamD2zE7v8ncD+SSWzR/gSI+dJejAxsJ3HCVCeUzA1IOsVqkZG0C
AwEAAaNTMFEwHQYDVR0OBBYEFMJCox/DWSVVUDcl0+AOZyxGkMy8MB8GA1UdIwQY
MBaAFMJCox/DWSVVUDcl0+AOZyxGkMy8MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI
hvcNAQELBQADggEBAJ2q5IZdQSg1lLG2nKu9/HY2QUVf2lsi2lD+x9bA1DX6rw5+
s8Fz+ytZKrsDEciVcYgs9BhEVmP8AnZPcaE9pimJXqSBK8tehh/ZJtUZv2Vvp5g/
K6EvShFcvHqXsXQW8nhPvESRaE7bucSCONNS8Cuy/BDQ+ffE6USWzeVY4YwYcJ4g
C0l3buWSVNfbwL5HHTupUze06pn9zZgJbfcFk+WlwNwIizK3DPg39bom/0HT8+Fz
BYZgMEvHi/6B83pecj+MoAVPhpwl8549NE92Sszv8OIKpR59WOuC+a4NiVktCctS
U0YBXM/WsHxY/PyQl3qShJMZT3Q65aQAnC2Wocg=
-----END CERTIFICATE-----`;

// Configuración de logging
const MQTT_LOG_DIR = process.env.MQTT_LOG_DIR || path.join(__dirname, '../../logs');
const MQTT_LOG_FILE = path.join(MQTT_LOG_DIR, 'mqtt_messages.log');

// Asegurar que el directorio de logs existe
if (!fs.existsSync(MQTT_LOG_DIR)) {
  fs.mkdirSync(MQTT_LOG_DIR, { recursive: true });
}

// Topics a los que nos suscribimos
// Estructura: tiwater/{codigo_tienda}/data
// Usando wildcards (+) para recibir mensajes de cualquier tienda
const TOPICS = {
  TIWATER_DATA: 'tiwater/+/data'  // Formato principal: tiwater/CODIGO_TIENDA_001/data
};

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
  }

  // Escribir mensaje MQTT a archivo de log
  logMessageToFile(topic, message) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ${topic} | ${message}\n`;
      
      // Append al archivo de log (no bloqueante)
      fs.appendFile(MQTT_LOG_FILE, logEntry, (err) => {
        if (err) {
          console.error('[MQTT] ❌ Error escribiendo a log file:', err.message);
        }
      });
    } catch (error) {
      console.error('[MQTT] ❌ Error en logMessageToFile:', error.message);
    }
  }

  // Conectar al broker MQTT
  connect() {
    // Determinar si usar TLS basado en puerto o configuración explícita
    const useTLS = MQTT_USE_TLS;
    const protocol = useTLS ? 'mqtts' : 'mqtt';
    const mqttUrl = `${protocol}://${MQTT_BROKER}:${MQTT_PORT}`;
    
    console.log(`[MQTT] Conectando a ${mqttUrl}${useTLS ? ' (TLS)' : ''}...`);

    // Configuración base de conexión
    const connectOptions = {
      clientId: MQTT_CLIENT_ID,
      clean: true,
      reconnectPeriod: 5000, // Reintentar cada 5 segundos
      connectTimeout: 10000, // Timeout de 10 segundos
    };

    // Agregar autenticación si está configurada
    if (MQTT_USERNAME && MQTT_PASSWORD) {
      connectOptions.username = MQTT_USERNAME;
      connectOptions.password = MQTT_PASSWORD;
      console.log(`[MQTT] Usando autenticación: ${MQTT_USERNAME}`);
    }

    // Configurar TLS si es necesario
    if (useTLS) {
      let caCert = null;
      let certSource = '';

      // Prioridad 1: Variable de entorno MQTT_CA_CERT (recomendado)
      if (MQTT_CA_CERT) {
        caCert = MQTT_CA_CERT;
        certSource = 'variable de entorno (MQTT_CA_CERT)';
        console.log(`[MQTT] ✅ Certificado CA cargado desde variable de entorno`);
      }
      // Prioridad 2: Archivo en MQTT_CA_CERT_PATH
      else if (MQTT_CA_CERT_PATH && fs.existsSync(MQTT_CA_CERT_PATH)) {
        try {
          caCert = fs.readFileSync(MQTT_CA_CERT_PATH);
          certSource = `archivo (${MQTT_CA_CERT_PATH})`;
          console.log(`[MQTT] ✅ Certificado CA cargado desde archivo: ${MQTT_CA_CERT_PATH}`);
        } catch (error) {
          console.warn(`[MQTT] ⚠️  No se pudo leer certificado desde archivo:`, error.message);
        }
      }
      // Prioridad 3: Certificado embebido (fallback, no recomendado para producción)
      if (!caCert) {
        caCert = MQTT_CA_CERT_EMBEDDED;
        certSource = 'embebido (fallback)';
        console.warn(`[MQTT] ⚠️  Usando certificado CA embebido. Se recomienda configurar MQTT_CA_CERT en .env para producción`);
      }

      if (!caCert) {
        throw new Error('No se pudo cargar el certificado CA. Configura MQTT_CA_CERT o MQTT_CA_CERT_PATH en .env');
      }

      connectOptions.ca = caCert;
      
      // Opciones adicionales de TLS
      connectOptions.rejectUnauthorized = process.env.MQTT_REJECT_UNAUTHORIZED !== 'false'; // Por defecto true (verificar certificado)
      
      // Personalizar verificación del hostname para aceptar IP en CN
      // Esto es necesario cuando el certificado tiene el IP en CN pero no en altnames
      // El certificado tiene CN='146.190.143.141' pero Node.js requiere que esté en altnames
      // Solución: Si el CN del certificado coincide con el IP al que nos conectamos, aceptarlo
      connectOptions.checkServerIdentity = (servername, cert) => {
        // Si nos conectamos por IP y el certificado tiene ese IP en CN, aceptarlo
        if (servername === MQTT_BROKER && cert.subject && cert.subject.CN === MQTT_BROKER) {
          return undefined; // Aceptar la conexión (undefined = sin error)
        }
        
        // Para otros casos, usar la verificación estándar de Node.js
        return tls.checkServerIdentity(servername, cert);
      };
      
      if (process.env.MQTT_REJECT_UNAUTHORIZED === 'false') {
        console.warn(`[MQTT] ⚠️  ADVERTENCIA: Verificación de certificado deshabilitada (rejectUnauthorized=false)`);
      } else {
        console.log(`[MQTT] Verificación de hostname personalizada: acepta IP en CN del certificado`);
      }
    }

    this.client = mqtt.connect(mqttUrl, connectOptions);

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

      // Guardar mensaje en archivo de log
      this.logMessageToFile(topic, message);

      // Parsear topic: tiwater/{codigo_tienda}/data
      const topicParts = topic.split('/');
      
      // Formato principal: tiwater/CODIGO_TIENDA_001/data
      if (topicParts.length === 3 && topicParts[0] === 'tiwater' && topicParts[2] === 'data') {
        const codigo_tienda = topicParts[1];
        this.handleTiwaterData(codigo_tienda, message);
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
      // Extraer gateway_id del topic: tiwater/gateway/{gateway_id}/data
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

  // Manejar datos de tiwater (nuevo formato: tiwater/CODIGO_TIENDA_001/data)
  async handleTiwaterData(codigo_tienda, message) {
    try {
      const data = JSON.parse(message);
      console.log(`[MQTT] 📊 Datos de tiwater/${codigo_tienda}:`, JSON.stringify(data, null, 2));
      
      // Debug: Verificar corrientes en el mensaje original
      if (data.ch1 !== undefined || data.ch2 !== undefined || data.ch3 !== undefined || data.ch4 !== undefined || data.total_corriente !== undefined) {
        console.log(`[MQTT] ⚡ Corrientes en mensaje original:`, {
          ch1: data.ch1,
          ch2: data.ch2,
          ch3: data.ch3,
          ch4: data.ch4,
          total_corriente: data.total_corriente
        });
      } else {
        console.log(`[MQTT] ⚠️ No se encontraron corrientes en el mensaje original`);
      }
      
      // Mapear campos del nuevo formato a estructura estándar
      const mappedData = this.mapTiwaterDataToStandard(data);
      
      // Debug: Verificar corrientes después del mapeo
      if (mappedData.corriente_ch1 !== undefined || mappedData.corriente_ch2 !== undefined || mappedData.corriente_ch3 !== undefined || mappedData.corriente_ch4 !== undefined || mappedData.corriente_total !== undefined) {
        console.log(`[MQTT] ⚡ Corrientes después de mapTiwaterDataToStandard:`, {
          corriente_ch1: mappedData.corriente_ch1,
          corriente_ch2: mappedData.corriente_ch2,
          corriente_ch3: mappedData.corriente_ch3,
          corriente_ch4: mappedData.corriente_ch4,
          corriente_total: mappedData.corriente_total
        });
      } else {
        console.log(`[MQTT] ⚠️ No se encontraron corrientes después del mapeo`);
      }
      
      // MQTT data → PostgreSQL only. Punto/cliente se resuelven por codigo_tienda en PostgresService.
      // (MongoDB solo se usa para logs de MQTT si aplica; no para datos tiwater.)
      const sensorDataPayload = {
        codigo_tienda: codigo_tienda ? codigo_tienda.toUpperCase() : null,
        punto_venta: null,
        cliente: null,
        
        // Sensores mapeados
        ...mappedData,
        
        // Mapear corrientes también con los nombres que espera postgres.service.js
        ch1: mappedData.corriente_ch1,
        ch2: mappedData.corriente_ch2,
        ch3: mappedData.corriente_ch3,
        ch4: mappedData.corriente_ch4,
        total_corriente: mappedData.corriente_total,
        
        // Metadatos
        source: 'tiwater',
        // Usar timestamp del mensaje si está disponible (mantener como número Unix en segundos para PostgreSQL)
        // Si viene como número, usarlo directamente; si viene como Date, convertirlo a Unix timestamp
        timestamp: data.timestamp 
          ? (typeof data.timestamp === 'number' ? data.timestamp : (data.timestamp instanceof Date ? Math.floor(data.timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000)))
          : Math.floor(Date.now() / 1000),
        metadata: {
          original_payload: data,
          topic_format: 'tiwater'
        }
      };
      
      // Debug: Log de corrientes mapeadas
      if (mappedData.corriente_ch1 || mappedData.corriente_ch2 || mappedData.corriente_ch3 || mappedData.corriente_ch4 || mappedData.corriente_total) {
        console.log(`[MQTT] ⚡ Corrientes mapeadas para tiwater/${codigo_tienda}:`, {
          ch1: mappedData.corriente_ch1,
          ch2: mappedData.corriente_ch2,
          ch3: mappedData.corriente_ch3,
          ch4: mappedData.corriente_ch4,
          total: mappedData.corriente_total
        });
        console.log(`[MQTT] ⚡ Corrientes en payload:`, {
          ch1: sensorDataPayload.ch1,
          ch2: sensorDataPayload.ch2,
          ch3: sensorDataPayload.ch3,
          ch4: sensorDataPayload.ch4,
          total_corriente: sensorDataPayload.total_corriente
        });
      }
      
      // Guardar datos en MongoDB y PostgreSQL
      await this.saveSensorData(sensorDataPayload);
      console.log(`[MQTT] ✅ Datos guardados para tiwater/${codigo_tienda}`);
      
    } catch (error) {
      console.error(`[MQTT] ❌ Error al procesar datos de tiwater/${codigo_tienda}:`, error);
      console.error('[MQTT] Mensaje recibido:', message);
    }
  }

  // Mapear datos de formato tiwater a estructura estándar
  mapTiwaterDataToStandard(data) {
    return {
      // Mapear campos con espacios a formato estándar
      flujo_produccion: data['CAUDAL PURIFICADA'] || data['caudal_purificada'] || null,
      flujo_rechazo: data['CAUDAL RECHAZO'] || data['caudal_rechazo'] || null,
      flujo_recuperacion: data['CAUDAL RECUPERACION'] || data['caudal_recuperacion'] || null,
      tds: data['TDS'] ?? data['tds'] ?? null,
      
      // Niveles absolutos (valores pueden ser > 100). Para payloads parciales, usar porcentaje si no viene nivel.
      nivel_purificada: data['NIVEL PURIFICADA'] ?? data['nivel_purificada'] ?? data['PORCENTAJE NIVEL PURIFICADA'] ?? data['porcentaje_nivel_purificada'] ?? null,
      nivel_cruda: data['NIVEL CRUDA'] ?? data['nivel_cruda'] ?? data['PORCENTAJE NIVEL CRUDA'] ?? data['porcentaje_nivel_cruda'] ?? null,

      // Porcentajes (valores 0-100). Nivel cruda % y nivel recuperada por separado.
      electronivel_cruda: data['PORCENTAJE NIVEL CRUDA'] ?? data['porcentaje_nivel_cruda'] ?? data['NIVEL CRUDA'] ?? data['nivel_cruda'] ?? null,
      electronivel_purificada: data['PORCENTAJE NIVEL PURIFICADA'] ?? data['porcentaje_nivel_purificada'] ?? data['NIVEL PURIFICADA'] ?? data['nivel_purificada'] ?? null,
      electronivel_recuperada: data['PORCENTAJE NIVEL RECUPERADA'] ?? data['porcentaje_nivel_recuperada'] ?? null,
      
      caudal_cruda: data['CAUDAL CRUDA'] || data['caudal_cruda'] || null,
      caudal_cruda_lmin: data['CAUDAL CRUDA L/min'] || data['caudal_cruda_l_min'] || null,
      acumulado_cruda: data['ACUMULADO CRUDA'] || data['acumulado_cruda'] || null,
      presion_in: data['presion_in'] || data['pressure_in'] || null,
      presion_out: data['presion_out'] || data['pressure_out'] || null,
      presion_co2: data['PRESION CO2'] || data['presion_co2'] || null,
      eficiencia: data['EFICIENCIA'] || data['eficiencia'] || null,
      vida: data['vida'] || data['VIDA'] || null,
      
      // Campos de corriente
      corriente_ch1: data['ch1'] || data['ch1'] || null,
      corriente_ch2: data['ch2'] || data['ch2'] || null,
      corriente_ch3: data['ch3'] || data['ch3'] || null,
      corriente_ch4: data['ch4'] || data['ch4'] || null,
      corriente_total: data['total_corriente'] || data['total_corriente'] || null,
      
      // Almacenar todos los campos originales en metadata para referencia
      metadata: {
        ...data,
        mapped_at: new Date().toISOString()
      }
    };
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
  // Tiwater: guardar primero en PostgreSQL para que mensajes del script/cron siempre entren en sensores aunque MongoDB falle
  async saveSensorData(data) {
    const isTiwater = data.source === 'tiwater' || data.metadata?.topic_format === 'tiwater';
    let mongoDoc = null;

    try {
      if (isTiwater) {
        await this.saveMultipleSensorsToPostgreSQL(data, null);
      }

      try {
        const sensorData = new SensorData(data);
        mongoDoc = await sensorData.save();
      } catch (mongoError) {
        if (isTiwater) {
          console.warn('[MQTT] ⚠️  MongoDB save skipped (PostgreSQL updated):', mongoError.message);
        } else {
          throw mongoError;
        }
      }

      if (!isTiwater) {
        this.saveToPostgreSQL(data, mongoDoc?._id?.toString() || null).catch(error => {
          console.error('[MQTT] ⚠️  Error saving to PostgreSQL (non-critical):', error.message);
        });
      }

      return mongoDoc;
    } catch (error) {
      console.error('[MQTT] ❌ Error al guardar datos de sensores:', error);
      throw error;
    }
  }

  // Guardar múltiples sensores en PostgreSQL (uno por tipo de sensor)
  async saveMultipleSensorsToPostgreSQL(data, mongoId = null) {
    try {
      // Determinar resource_type: si es tiwater, usar 'tiwater', sino usar la lógica normal
      const isTiwater = data.source === 'tiwater' || data.metadata?.topic_format === 'tiwater';
      const resourceType = isTiwater 
        ? 'tiwater' 
        : (data.controller ? 'controller' : (data.product ? 'product' : 'equipo'));
      
      const context = {
        codigo_tienda: data.codigo_tienda,
        equipo_id: data.equipo_id,
        cliente_id: data.cliente ? data.cliente.toString() : null,
        owner_id: data.ownerId || null,
        resource_type: resourceType,
        source: data.source || 'tiwater',
        metadata: {
          mongo_id: mongoId,
          ...data.metadata
        }
      };

      // Guardar múltiples sensores (uno por tipo)
      await PostgresService.saveMultipleSensorsFromMQTT(data, context);
      
    } catch (error) {
      console.error('[MQTT] Error saving multiple sensors to PostgreSQL:', error);
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
      clientId: MQTT_CLIENT_ID,
      tls: MQTT_USE_TLS,
      protocol: MQTT_USE_TLS ? 'mqtts' : 'mqtt',
      authenticated: !!(MQTT_USERNAME && MQTT_PASSWORD)
    };
  }

  // Publicar mensaje MQTT (para modo pruebas/dev)
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('MQTT client no está conectado'));
        return;
      }

      const publishOptions = {
        qos: options.qos || 0,
        retain: options.retain || false,
        ...options
      };

      this.client.publish(topic, message, publishOptions, (error) => {
        if (error) {
          console.error(`[MQTT Publisher] ❌ Error publicando en ${topic}:`, error);
          reject(error);
        } else {
          console.log(`[MQTT Publisher] ✅ Publicado en ${topic}: ${message.substring(0, 100)}...`);
          this.logMessageToFile(topic, message);
          resolve(true);
        }
      });
    });
  }
}

// Crear instancia singleton
const mqttService = new MQTTService();

export default mqttService;

