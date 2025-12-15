# Arquitectura MQTT - Sistema Aquatech

## 📐 Arquitectura del Sistema

```
┌─────────────────┐
│ Componente      │
│ Presión         │──┐
└─────────────────┘  │
                      │ LoRa
┌─────────────────┐  │
│ Sensores        │  │
│ Presión         │──┤
└─────────────────┘  │
                      │
┌─────────────────┐  │
│ Sensores        │  │
│ Nivel Agua      │──┤
└─────────────────┘  │
                      ▼
              ┌───────────────┐
              │ Gateway       │
              │ Siemens 2050  │
              │ (Debian)      │
              └───────┬───────┘
                      │
                      │ WiFi/MQTT
                      ▼
              ┌───────────────┐
              │ Mosquitto MQTT│
              │ 146.190.143.141│
              └───────┬───────┘
                      │
                      │ Consume
                      ▼
              ┌───────────────┐
              │ API Node.js   │
              │ MongoDB       │
              └───────────────┘
```

## 🏪 Estructura de Puntos de Venta

Cada **Punto de Venta** tiene:
- **Código de Tienda**: `CODIGO_TIENDA_001`, `CODIGO_TIENDA_002`, etc.
- **Múltiples Equipos**: Cada equipo tiene sensores propios

### Ejemplo:
- **PUNTO DE VENTA 1** (`CODIGO_TIENDA_001`)
  - Equipo 1: `equipo_001`
  - Equipo 2: `equipo_002`
  - Equipo N: `equipo_N`

## 📡 Estructura de Topics MQTT

### Formato Principal (Recomendado)

```
aquatech/{codigo_tienda}/{equipo_id}/data
aquatech/{codigo_tienda}/{equipo_id}/status
```

**Ejemplos:**
```
aquatech/CODIGO_TIENDA_001/equipo_001/data
aquatech/CODIGO_TIENDA_001/equipo_001/status
aquatech/CODIGO_TIENDA_001/equipo_002/data
aquatech/CODIGO_TIENDA_002/equipo_001/data
```

### Payload JSON para `/data`

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

### Payload JSON para `/status`

```json
{
  "status": "online",
  "ip": "192.168.1.100"
}
```

## 🗄️ Modelo de Datos

### SensorData Model
```javascript
{
  codigo_tienda: String,        // CODIGO_TIENDA_001 (opcional, para compatibilidad)
  equipo_id: String,            // equipo_001 (opcional, para compatibilidad)
  punto_venta: ObjectId,        // Referencia al PuntoVenta
  controller: ObjectId,          // Referencia al Controller
  product: ObjectId,            // Referencia al Product
  cliente: ObjectId,            // Referencia al Client
  
  // Sensores
  flujo_produccion: Number,     // L/min
  flujo_rechazo: Number,        // L/min
  tds: Number,                  // ppm
  electronivel_purificada: Number,  // %
  electronivel_recuperada: Number,   // %
  presion_in: Number,           // PSI/bar
  presion_out: Number,          // PSI/bar
  
  // Metadatos
  source: String,               // "Siemens2050"
  gateway_ip: String,           // IP del gateway
  timestamp: Date,              // Timestamp del dato
  
  createdAt: Date,
  updatedAt: Date
}
```

### PuntoVenta Model (Actualizado)
```javascript
{
  name: String,
  codigo_tienda: String,        // CODIGO_TIENDA_001 (opcional, único si existe, indexado)
  cliente: ObjectId,
  city: ObjectId,
  productos: [ObjectId],
  controladores: [ObjectId],
  // ...
}
```

**Nota**: El campo `codigo_tienda` es **opcional** para mantener compatibilidad con datos existentes. Si no se proporciona, el sistema funcionará con el formato legacy.

## 🔄 Flujo de Datos

1. **Sensores** envían datos vía LoRa al **Gateway Siemens 2050**
2. **Gateway** agrega datos de todos los sensores del equipo
3. **Gateway** publica a MQTT: `aquatech/{codigo_tienda}/{equipo_id}/data`
4. **API consume** mensaje MQTT
5. **API busca** PuntoVenta por `codigo_tienda` y Controller/Product por `equipo_id`
6. **API guarda** datos en MongoDB con referencias
7. **Frontend consulta** datos desde API REST

## 📊 Ventajas de esta Arquitectura

✅ **Escalable**: Fácil agregar nuevos puntos de venta y equipos
✅ **Organizado**: Datos agrupados por tienda y equipo
✅ **Desacoplado**: Gateway y API independientes
✅ **Resiliente**: MQTT guarda mensajes si API está offline
✅ **Eficiente**: Solo guarda datos relevantes
✅ **Trazable**: Historial completo de datos por tienda/equipo

## 🔍 Endpoints de la API

### Consultar Datos

```bash
# Todos los datos con filtros
GET /api/v1.0/sensor-data?codigo_tienda=CODIGO_TIENDA_001&equipo_id=equipo_001

# Último dato
GET /api/v1.0/sensor-data/latest?codigo_tienda=CODIGO_TIENDA_001&equipo_id=equipo_001

# Estadísticas
GET /api/v1.0/sensor-data/statistics?codigo_tienda=CODIGO_TIENDA_001&startDate=2024-01-01

# Por tienda (todos los equipos)
GET /api/v1.0/sensor-data/tienda/CODIGO_TIENDA_001

# Por tienda y equipo
GET /api/v1.0/sensor-data/tienda/CODIGO_TIENDA_001/equipo/equipo_001
```

## ⚠️ Configuración Requerida

### 1. Punto de Venta en MongoDB (Opcional)
Si usas el nuevo formato con `codigo_tienda`, crea un `PuntoVenta` con:
```javascript
{
  name: "Punto de Venta 1",
  codigo_tienda: "CODIGO_TIENDA_001",  // ⚠️ Opcional, pero debe coincidir con el topic MQTT si se usa
  cliente: ObjectId("..."),
  city: ObjectId("..."),
  controladores: [ObjectId("...")],  // Controllers con id = equipo_id
  productos: [ObjectId("...")]      // Products con id = equipo_id
}
```

**Nota**: Si no tienes `codigo_tienda` configurado aún, el sistema funcionará con el formato legacy y buscará controllers/products globalmente.

### 2. Controller/Product con equipo_id (Opcional)
Si usas el nuevo formato, los `Controller` o `Product` deben tener:
```javascript
{
  id: "equipo_001",  // ⚠️ Debe coincidir con equipo_id del topic MQTT si se usa
  // ...
}
```

**Nota**: Si no se proporciona `equipo_id`, el sistema buscará controllers/products por otros métodos.

### 3. Gateway Siemens 2050
El gateway puede publicar en dos formatos:

**Formato nuevo (recomendado):**
- Topic: `aquatech/CODIGO_TIENDA_001/equipo_001/data`
- JSON con todos los sensores

**Formato legacy (compatible):**
- Topic: `aquatech/gateway/{gateway_id}/data` o `aquatech/data`
- JSON con todos los sensores
