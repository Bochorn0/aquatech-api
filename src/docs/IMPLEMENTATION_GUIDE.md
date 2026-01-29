# Guía de Implementación - Arquitectura MQTT Aquatech

## 📋 Resumen de Cambios

Se ha implementado una arquitectura MQTT completa para recibir y almacenar datos de sensores desde gateways **Siemens 2050 (Debian)** organizados por **Puntos de Venta** y **Equipos**.

## 🏗️ Componentes Implementados

### 1. Modelo de Datos (`sensorData.model.js`)
- Almacena datos de sensores: `flujo_produccion`, `flujo_rechazo`, `tds`, `electronivel_purificada`, `electronivel_recuperada`, `presion_in`, `presion_out`
- Referencias a `PuntoVenta`, `Controller`, `Product`, y `Client`
- Índices optimizados para consultas rápidas por tienda/equipo

### 2. Modelo PuntoVenta Actualizado (`puntoVenta.model.js`)
- Nuevo campo `codigo_tienda` (único, indexado)
- Formato: `CODIGO_TIENDA_001`, `CODIGO_TIENDA_002`, etc.

### 3. Servicio MQTT (`mqtt.service.js`)
- Suscripción a topics: `aquatech/+/+/data` y `aquatech/+/+/status`
- Procesamiento automático de mensajes JSON
- Búsqueda automática de `PuntoVenta` por `codigo_tienda`
- Búsqueda automática de `Controller`/`Product` por `equipo_id`
- Guardado automático en MongoDB con referencias
- Actualización de estado de controllers

### 4. Controlador y Rutas (`sensorData.controller.js` y `sensorData.routes.js`)
- `GET /api/v1.0/sensor-data` - Listar datos con filtros (tienda, equipo, fechas)
- `GET /api/v1.0/sensor-data/latest` - Último dato recibido
- `GET /api/v1.0/sensor-data/statistics` - Estadísticas (promedios, máximos, mínimos)
- `GET /api/v1.0/sensor-data/tienda/:codigo_tienda` - Datos por tienda
- `GET /api/v1.0/sensor-data/tienda/:codigo_tienda/equipo/:equipo_id` - Datos por tienda y equipo

### 5. Scripts de Ejemplo para Gateway Siemens 2050
- `gateway_siemens2050_example.py` - Script Python
- `gateway_siemens2050_example.js` - Script Node.js

## 🔧 Configuración Requerida

### 1. Variables de Entorno
Asegúrate de tener en tu `.env`:
```env
MQTT_BROKER=146.190.143.141
MQTT_PORT=1883
MQTT_CLIENT_ID=aquatech-api-consumer
```

### 2. Crear Punto de Venta en MongoDB (Opcional)
Si usas el nuevo formato con `codigo_tienda`, crea un `PuntoVenta` con:
```javascript
{
  name: "Punto de Venta 1",
  codigo_tienda: "CODIGO_TIENDA_001",  // ⚠️ Opcional, pero debe coincidir con el topic MQTT si se usa
  cliente: ObjectId("..."),
  city: ObjectId("..."),
  controladores: [ObjectId("...")],  // Controllers con id = equipo_id
  productos: [ObjectId("...")]       // Products con id = equipo_id
}
```

**Nota**: El campo `codigo_tienda` es **opcional**. Si no lo tienes configurado aún, el sistema funcionará con el formato legacy y buscará controllers/products globalmente.

### 3. Crear Controller/Product con equipo_id (Opcional)
Si usas el nuevo formato, los `Controller` o `Product` deben tener:
```javascript
{
  id: "equipo_001",  // ⚠️ Opcional, pero debe coincidir con equipo_id del topic MQTT si se usa
  // ...
}
```

**Nota**: Si no se proporciona `equipo_id` en el topic, el sistema buscará controllers/products por otros métodos.

### 4. Configurar Gateway Siemens 2050
En el script del gateway (Python o Node.js), configura:
```python
CODIGO_TIENDA = "CODIGO_TIENDA_001"  # ⚠️ CAMBIAR según tu tienda
EQUIPOS = [
    "equipo_001",
    "equipo_002",
    # ...
]
```

## 📡 Formato de Mensajes MQTT

### Topic: `aquatech/{codigo_tienda}/{equipo_id}/data`
```json
{
  "flujo_produccion": 12.5,
  "flujo_rechazo": 8.3,
  "tds": 45,
  "electronivel_purificada": 85.5,
  "electronivel_recuperada": 75.2,
  "presion_in": 45.3,
  "presion_out": 67.8,
  "timestamp": 1234567890,
  "source": "Siemens2050",
  "gateway_ip": "192.168.1.100"
}
```

### Topic: `aquatech/{codigo_tienda}/{equipo_id}/status`
```json
{
  "status": "online",
  "ip": "192.168.1.100"
}
```

## 🔍 Ejemplos de Uso de la API

### Obtener todos los datos con filtros
```bash
GET /api/v1.0/sensor-data?codigo_tienda=CODIGO_TIENDA_001&equipo_id=equipo_001&limit=50
```

### Filtrar por rango de fechas
```bash
GET /api/v1.0/sensor-data?codigo_tienda=CODIGO_TIENDA_001&startDate=2024-01-01&endDate=2024-01-31
```

### Obtener último dato
```bash
GET /api/v1.0/sensor-data/latest?codigo_tienda=CODIGO_TIENDA_001&equipo_id=equipo_001
```

### Obtener estadísticas
```bash
GET /api/v1.0/sensor-data/statistics?codigo_tienda=CODIGO_TIENDA_001&startDate=2024-01-01
```

### Obtener datos por tienda (todos los equipos)
```bash
GET /api/v1.0/sensor-data/tienda/CODIGO_TIENDA_001?limit=100
```

### Obtener datos por tienda y equipo
```bash
GET /api/v1.0/sensor-data/tienda/CODIGO_TIENDA_001/equipo/equipo_001?limit=100
```

## 🧪 Pruebas

### 1. Probar MQTT localmente
```bash
cd Aquatech_api
npm run test:mqtt        # Consumidor
npm run test:mqtt:publish # Publicador de prueba
```

### 2. Probar Gateway Siemens 2050 (Python)
```bash
# Instalar dependencias
pip install paho-mqtt

# Ejecutar script
python3 gateway_siemens2050_example.py
```

### 3. Probar Gateway Siemens 2050 (Node.js)
```bash
# Instalar dependencias
npm install mqtt

# Ejecutar script
node gateway_siemens2050_example.js
```

### 4. Verificar conexión MQTT
```bash
GET /api/v1.0/mqtt/status
```

### 5. Verificar datos guardados
```bash
GET /api/v1.0/sensor-data/latest?codigo_tienda=CODIGO_TIENDA_001
```

## 📊 Flujo Completo

1. **Sensores** envían datos vía LoRa al **Gateway Siemens 2050**
2. **Gateway** agrega datos de todos los sensores del equipo
3. **Gateway** publica a MQTT: `aquatech/{codigo_tienda}/{equipo_id}/data`
4. **API consume** mensaje MQTT
5. **API busca** `PuntoVenta` por `codigo_tienda` y `Controller`/`Product` por `equipo_id`
6. **API guarda** datos en MongoDB con referencias
7. **Frontend consulta** datos desde API REST

## ⚠️ Notas Importantes

- El `codigo_tienda` es **opcional** - Si no lo tienes configurado, el sistema funcionará con formato legacy
- Si usas `codigo_tienda`, debe coincidir con el `codigo_tienda` del `PuntoVenta`
- El `equipo_id` es **opcional** - Si no se proporciona, el sistema buscará controllers/products globalmente
- Si usas `equipo_id`, debe coincidir con el `id` del `Controller` o `Product`
- Si el `PuntoVenta` no existe, los datos se guardan sin referencias (pero se guardan)
- Si el `Controller`/`Product` no existe, los datos se guardan sin referencias (pero se guardan)
- Los datos se guardan automáticamente cuando llegan por MQTT
- El estado `online` del `Controller` se actualiza automáticamente
- **Compatibilidad**: El sistema mantiene compatibilidad con datos existentes que no tengan `codigo_tienda`

## 🚀 Próximos Pasos

1. **Configurar Gateway Real**: Reemplazar función `read_sensors()` con lectura real de sensores
2. **Agregar más sensores**: El modelo ya está preparado para todos los sensores requeridos
3. **Alertas**: Implementar alertas cuando valores excedan umbrales
4. **Dashboard**: Crear visualizaciones con los datos históricos por tienda/equipo
5. **TTL Index**: Opcionalmente, activar el índice TTL para limpiar datos antiguos

## 📝 Estructura de Sensores por Equipo

Cada equipo en un punto de venta tiene los siguientes sensores:
- **Flujo Producción** (L/min)
- **Flujo Rechazo** (L/min)
- **TDS** (ppm)
- **Nivel Electrónico Purificada** (%)
- **Nivel Electrónico Recuperada** (%)
- **Presión IN** (PSI/bar)
- **Presión OUT** (PSI/bar)

Todos estos datos se almacenan en cada registro de `SensorData` y están disponibles para consulta y análisis.
