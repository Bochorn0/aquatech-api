# Guía de Prueba MQTT Local

Esta guía te ayudará a probar la conexión MQTT y el consumo de mensajes localmente antes de subir al servidor.

## 📋 Requisitos Previos

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copia `.env-example` a `.env` (si no existe)
   - Las variables MQTT ya tienen valores por defecto:
     ```
     MQTT_BROKER=146.190.143.141
     MQTT_PORT=1883
     MQTT_CLIENT_ID=aquatech-api-consumer
     ```

## 🧪 Pruebas Locales

### Opción 1: Probar solo la conexión MQTT (sin iniciar la API completa)

**Terminal 1 - Consumidor (escucha mensajes):**
```bash
npm run test:mqtt
```

Este script:
- Se conecta al broker MQTT
- Se suscribe a todos los topics
- Muestra los mensajes recibidos en tiempo real
- Presiona `Ctrl+C` para salir

**Terminal 2 - Publicador (envía mensajes de prueba):**
```bash
npm run test:mqtt:publish
```

Este script:
- Se conecta al broker MQTT
- Publica mensajes de prueba cada 2 segundos
- Se detiene automáticamente después de 30 segundos

### Opción 2: Probar con la API completa

**Terminal 1 - Iniciar la API:**
```bash
npm run dev
```

Deberías ver:
```
Connected to MongoDB
[MQTT] Conectando a mqtt://146.190.143.141:1883...
[MQTT] ✅ Conectado al broker 146.190.143.141:1883
[MQTT] ✅ Suscrito a topic: aquatech/presion_in
[MQTT] ✅ Suscrito a topic: aquatech/presion_out
[MQTT] ✅ Suscrito a topic: aquatech/data
[MQTT] ✅ Suscrito a topic: aquatech/status
Server is running on port 3009
```

**Terminal 2 - Publicar mensajes de prueba:**
```bash
npm run test:mqtt:publish
```

**Verificar estado MQTT:**
```bash
curl http://localhost:3009/api/v1.0/mqtt/status
```

Respuesta esperada:
```json
{
  "message": "MQTT Service Status",
  "connected": true,
  "broker": "146.190.143.141:1883",
  "clientId": "aquatech-api-consumer"
}
```

## 📊 Qué Verás en los Logs

Cuando la API reciba mensajes, verás:

```
[MQTT] 📨 Mensaje recibido en aquatech/presion_in: 45.3
[MQTT] Presión IN: 45.3
[MQTT] 📨 Mensaje recibido en aquatech/presion_out: 67.8
[MQTT] Presión OUT: 67.8
[MQTT] 📨 Mensaje recibido en aquatech/data: {"presion_in":45.3,"presion_out":67.8,"timestamp":123,"source":"Test"}
[MQTT] 📊 Datos completos recibidos: {
  "presion_in": 45.3,
  "presion_out": 67.8,
  "timestamp": 123,
  "source": "Test"
}
```

## 🔍 Verificar que Funciona

1. **Verifica la conexión:**
   - Deberías ver `✅ Conectado al broker` en los logs
   - El endpoint `/api/v1.0/mqtt/status` debe mostrar `"connected": true`

2. **Verifica la recepción de mensajes:**
   - Ejecuta el publicador de prueba
   - Deberías ver mensajes apareciendo en los logs de la API

3. **Verifica los topics:**
   - Todos los topics deben mostrar `✅ Suscrito a topic:`

## ⚠️ Solución de Problemas

### Error: "ECONNREFUSED" o "ETIMEDOUT"
- Verifica que el servidor MQTT (146.190.143.141:1883) esté accesible
- Verifica tu conexión a internet
- Verifica que no haya firewall bloqueando el puerto 1883

### No se reciben mensajes
- Verifica que el publicador esté ejecutándose
- Verifica que ambos scripts estén conectados al mismo broker
- Revisa los logs para ver errores de conexión

### La API no inicia
- Verifica que MongoDB esté corriendo
- Verifica las variables de entorno en `.env`
- Revisa los logs de error

## 🚀 Próximos Pasos

Una vez que verifiques que funciona localmente:

1. **Agregar handlers personalizados** para guardar datos en MongoDB
2. **Crear modelos** para almacenar los datos de presión
3. **Agregar validación** de datos antes de guardar
4. **Implementar alertas** si los valores están fuera de rango

## 📝 Notas

- El servicio MQTT se reconecta automáticamente si se pierde la conexión
- Los mensajes se procesan en tiempo real
- Puedes agregar handlers personalizados usando `mqttService.onMessage()`

