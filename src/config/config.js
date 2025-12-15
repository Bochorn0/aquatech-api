// config/config.js
import dotenv from 'dotenv';
dotenv.config();

const config = {
  TUYA_CLIENT_ID: process.env.TUYA_CLIENT_ID,
  TUYA_SECRET: process.env.TUYA_CLIENT_SECRET,
  TUYA_URL: process.env.TUYA_API_URL,
  SECRET_KEY: process.env.SECRET_KEY,
  MQTT_BROKER: process.env.MQTT_BROKER || '146.190.143.141',
  MQTT_PORT: process.env.MQTT_PORT || 1883,
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'aquatech-api-consumer',
};

export default config;  // Use 'export default' for ESM
