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
  /** Comma-separated Tuya cloud user IDs whose devices are merged in getAllProducts (deduped by device id). */
  TUYA_USER_IDS: (process.env.TUYA_USER_IDS
    || 'az1740167873867P5flA,az1758216258645Rvcgb,az1711484065099Tm0oG,az1739408936787MhA1Y')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /**
   * Linghu / external meter provider credentials (from .env — same pattern as Tuya).
   * Webhook auth: X-Linghu-Client-Id + X-Linghu-Client-Secret
   */
  LINGHU_CLIENT_ID: process.env.LINGHU_CLIENT_ID || '',
  LINGHU_CLIENT_SECRET:
    process.env.LINGHU_CLIENT_SECRET
    || process.env.LINGHU_INGEST_SECRET
    || process.env.EXTERNAL_PROVIDER_LINGHU_SECRET
    || '',
  LINGHU_API_URL: process.env.LINGHU_API_URL || '',
  LINGHU_INGEST_ALLOWLIST_IPS: process.env.LINGHU_INGEST_ALLOWLIST_IPS || '',

  /**
   * Water/Gas meter management platform (pull REST + JWT).
   * Docs: 05_Water-Gas-Meter-WebManagementPlatform-API-Doc-EN.pdf
   */
  METER_PLATFORM_BASE_URL: process.env.METER_PLATFORM_BASE_URL || 'http://47.97.252.2/prod-api',
  METER_PLATFORM_USERNAME: process.env.METER_PLATFORM_USERNAME || '',
  METER_PLATFORM_PASSWORD: process.env.METER_PLATFORM_PASSWORD || '',
  METER_PLATFORM_LOGIN_PATH: process.env.METER_PLATFORM_LOGIN_PATH || '/app/login',
  /** auto | m3 | m3x1000 */
  METER_PLATFORM_VOLUME_UNIT: process.env.METER_PLATFORM_VOLUME_UNIT || 'auto',
};

export default config;  // Use 'export default' for ESM
