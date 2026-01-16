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
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'TIWater-api-consumer',
  // PostgreSQL configuration
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: process.env.POSTGRES_PORT || 5432,
  POSTGRES_DB: process.env.POSTGRES_DB || 'TIWater_timeseries',
  POSTGRES_USER: process.env.POSTGRES_USER || 'TIWater_user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_SSL: process.env.POSTGRES_SSL || 'false',
  // TI Water API Key configuration
  TIWATER_API_KEY: process.env.TIWATER_API_KEY,
  TIWATER_API_KEY_HASH: process.env.TIWATER_API_KEY_HASH, // Optional: SHA256 hash of the API key
};

export default config;  // Use 'export default' for ESM
