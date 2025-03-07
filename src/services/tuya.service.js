// src/services/tuyaService.js

import { TuyaContext } from '@tuya/tuya-connector-nodejs';  // Import TuyaContext (ESM)
import config from '../config/config.js';  // Import the configuration (ESM)
import axios from 'axios';  // Import axios (CommonJS)

// Initialize TuyaContext with credentials from the environment
const context = new TuyaContext({
  baseUrl: config.TUYA_URL,  // Tuya API base URL from config
  accessKey: config.TUYA_CLIENT_ID,  // Your Tuya Client ID from config
  secretKey: config.TUYA_SECRET,  // Your Tuya Secret Key from config
  rpc: axios  // Use axios for HTTP requests (Tuya API)
});

// Fetch device details by device_id
export async function getDeviceDetail(deviceId) {
  console.log('Fetching device details for:', deviceId);
  try {
    // Get the details of the device using TuyaContext
    return await context.request({
      method: 'GET',
      path: `/v1.0/devices/${deviceId}`
    });
  } catch (error) {
    console.error('Error fetching device details:', error);
    return null;
  }
}

// Fetch the list of all devices
export async function getAllDevices() {
  try {
    const uid = 'az1739408936787MhA1Y';  // Example user ID
    const device_id = 'eb5741b947793cb5d0ozyb';  // Example device ID

    // Make a request to fetch all devices for the user
    return await context.request({
      method: 'GET',
      path: `/v1.0/users/${uid}/devices`
    });
  } catch (error) {
    console.error('Error fetching device list:', error);
    return null;
  }
}

// Fetch device details by device_id
export async function getDeviceLogs(query) {
  console.log('query:', query);
  try {
    const { id, start_date, end_date, fields } = query;
    console.log('Fetching device details for:', id);
    // Get the details of the device using TuyaContext
    // Get current time (end_time)
    // const end_time = Date.now();

    // Get the time 10 minutes ago (start_time)
    // const start_time = end_time - (10 * 60 * 1000); // 10 minutes in milliseconds
    return await context.request({
      method: 'GET',
      path: `/v1.0/iot-03/devices/${id}/report-logs?start_time=${start_date}&end_time=${end_date}&codes=${fields}`
    });
  } catch (error) {
    console.error('Error fetching device details:', error);
    return null;
  }
}

// execute command to device
export async function executeCommands(data) {
  console.log('Executing commands for:', data);

  const { id, commands } = data;
  try {
    // Get the details of the device using TuyaContext
    return await context.request({
      method: 'POST',
      path: `/v1.0/iot-03/devices/${id}/commands`,
      body: {
        commands
      }
    });
  } catch (error) {
    console.error('Error executting commands on devices:', error);
    return null;
  }
}
