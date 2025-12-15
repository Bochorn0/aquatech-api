#!/usr/bin/env python3
"""
Script de ejemplo para Gateway Siemens 2050 (Debian)
Publica datos de sensores a MQTT en formato: aquatech/{codigo_tienda}/{equipo_id}/data

Requisitos:
    pip install paho-mqtt

Uso:
    python3 gateway_siemens2050_example.py
"""

import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# ================== Configuración MQTT ==================
MQTT_BROKER = "146.190.143.141"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "siemens2050_gateway"

# ================== Configuración de Tienda y Equipos ==================
# ⚠️ CAMBIAR estos valores según tu configuración
CODIGO_TIENDA = "CODIGO_TIENDA_001"
EQUIPOS = [
    "equipo_001",
    "equipo_002",
    # Agregar más equipos según sea necesario
]

# ================== Intervalo de publicación ==================
PUBLISH_INTERVAL = 5  # Segundos entre publicaciones

# ================== Callbacks MQTT ==================
def on_connect(client, userdata, flags, rc):
    """Callback cuando se conecta al broker"""
    if rc == 0:
        print(f"✅ Conectado al broker MQTT {MQTT_BROKER}:{MQTT_PORT}")
    else:
        print(f"❌ Error de conexión, código: {rc}")

def on_publish(client, userdata, mid):
    """Callback cuando se publica un mensaje"""
    print(f"📤 Mensaje publicado (mid: {mid})")

def on_disconnect(client, userdata, rc):
    """Callback cuando se desconecta"""
    print("⚠️  Desconectado del broker MQTT")

# ================== Función para leer sensores ==================
def read_sensors(equipo_id):
    """
    Lee los sensores del equipo.
    ⚠️ REEMPLAZAR esta función con la lógica real de lectura de sensores.
    
    En producción, aquí leerías:
    - Sensores LoRa
    - Sensores I2C/SPI
    - Sensores analógicos
    - Etc.
    """
    # ⚠️ ESTO ES SOLO PARA PRUEBAS - Generar valores aleatorios
    return {
        "flujo_produccion": round(random.uniform(10.0, 20.0), 1),      # L/min
        "flujo_rechazo": round(random.uniform(5.0, 15.0), 1),         # L/min
        "tds": round(random.uniform(30, 80), 1),                       # ppm
        "electronivel_purificada": round(random.uniform(70, 100), 1),   # %
        "electronivel_recuperada": round(random.uniform(60, 90), 1),    # %
        "presion_in": round(random.uniform(40, 60), 1),                 # PSI/bar
        "presion_out": round(random.uniform(50, 70), 1),                # PSI/bar
    }

# ================== Función para publicar datos ==================
def publish_sensor_data(client, codigo_tienda, equipo_id, sensor_data):
    """
    Publica datos de sensores al topic MQTT
    """
    topic = f"aquatech/{codigo_tienda}/{equipo_id}/data"
    
    # Construir payload JSON
    payload = {
        **sensor_data,
        "timestamp": int(time.time()),
        "source": "Siemens2050",
        "gateway_ip": "192.168.1.100"  # ⚠️ Obtener IP real del sistema
    }
    
    # Publicar mensaje
    result = client.publish(topic, json.dumps(payload), qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"✅ [{equipo_id}] Publicado en {topic}")
        print(f"   Datos: {json.dumps(payload, indent=2)}")
    else:
        print(f"❌ [{equipo_id}] Error al publicar: {result.rc}")
    
    return result.rc == mqtt.MQTT_ERR_SUCCESS

# ================== Función para publicar estado ==================
def publish_status(client, codigo_tienda, equipo_id, status="online"):
    """
    Publica estado del equipo al topic MQTT
    """
    topic = f"aquatech/{codigo_tienda}/{equipo_id}/status"
    
    payload = {
        "status": status,
        "ip": "192.168.1.100"  # ⚠️ Obtener IP real del sistema
    }
    
    result = client.publish(topic, json.dumps(payload), qos=1)
    return result.rc == mqtt.MQTT_ERR_SUCCESS

# ================== Función principal ==================
def main():
    """Función principal"""
    print("=" * 60)
    print("Gateway Siemens 2050 - Publicador MQTT")
    print("=" * 60)
    print(f"Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"Código Tienda: {CODIGO_TIENDA}")
    print(f"Equipos: {', '.join(EQUIPOS)}")
    print(f"Intervalo: {PUBLISH_INTERVAL} segundos")
    print("=" * 60)
    print()
    
    # Crear cliente MQTT
    client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
    
    # Asignar callbacks
    client.on_connect = on_connect
    client.on_publish = on_publish
    client.on_disconnect = on_disconnect
    
    # Conectar al broker
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()  # Iniciar loop en background
        
        # Esperar conexión
        time.sleep(2)
        
        # Publicar estado inicial de todos los equipos
        print("\n📡 Publicando estado inicial...")
        for equipo_id in EQUIPOS:
            publish_status(client, CODIGO_TIENDA, equipo_id, "online")
        time.sleep(1)
        
        # Loop principal: leer sensores y publicar
        print(f"\n🔄 Iniciando publicación de datos cada {PUBLISH_INTERVAL} segundos...\n")
        
        try:
            while True:
                for equipo_id in EQUIPOS:
                    # Leer sensores
                    sensor_data = read_sensors(equipo_id)
                    
                    # Publicar datos
                    publish_sensor_data(client, CODIGO_TIENDA, equipo_id, sensor_data)
                    
                    # Pequeña pausa entre equipos
                    time.sleep(0.5)
                
                print("-" * 60)
                time.sleep(PUBLISH_INTERVAL)
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Interrupción recibida, cerrando...")
            
            # Publicar estado offline
            print("📡 Publicando estado offline...")
            for equipo_id in EQUIPOS:
                publish_status(client, CODIGO_TIENDA, equipo_id, "offline")
            
            time.sleep(1)
            client.loop_stop()
            client.disconnect()
            print("✅ Desconectado correctamente")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()

