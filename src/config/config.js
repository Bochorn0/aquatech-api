// config/config.js
import dotenv from 'dotenv';
dotenv.config();

const config = {
  TUYA_CLIENT_ID: process.env.TUYA_CLIENT_ID,
  TUYA_SECRET: process.env.TUYA_CLIENT_SECRET,
  TUYA_URL: process.env.TUYA_API_URL,
  SECRET_KEY: process.env.SECRET_KEY,
};

export default config;  // Use 'export default' for ESM
