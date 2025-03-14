// src/services/tuyaService.js

import { TuyaContext } from '@tuya/tuya-connector-nodejs';
import config from '../config/config.js';
import axios from 'axios';

// Initialize TuyaContext with credentials from config
const context = new TuyaContext({
  baseUrl: config.TUYA_URL,
  accessKey: config.TUYA_CLIENT_ID,
  secretKey: config.TUYA_SECRET,
  rpc: axios
});

// Standardized helper to handle Tuya API responses
const handleResponse = (response) => {
  if (response.success) {
    return { success: true, data: response.result };
  } else {
    console.error(`Tuya API Error: ${response.msg} (Code: ${response.code})`);
    return { success: false, error: response.msg, code: response.code };
  }
};

// ---------------------------------------------
// Fetch device details by deviceId
// ---------------------------------------------
export async function getDeviceDetail(deviceId) {
  console.log('Fetching device details for:', deviceId);
  try {
    const response = await context.request({
      method: 'GET',
      path: `/v1.0/devices/${deviceId}`
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error fetching device details:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Fetch list of all devices for a user (by userId)
// ---------------------------------------------
export async function getAllDevices(userId) {
  console.log('Fetching all devices for user:', userId);
  try {
    const response = await context.request({
      method: 'GET',
      path: `/v1.0/users/${userId}/devices`
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error fetching device list:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Fetch device logs (report logs) with query params
// ---------------------------------------------
export async function getDeviceLogs(query) {
  const { id, start_date, end_date, fields } = query;
  console.log('Fetching device logs for:', id);
  try {
    const response = await context.request({
      method: 'GET',
      path: `/v1.0/iot-03/devices/${id}/report-logs?start_time=${start_date}&end_time=${end_date}&codes=${fields}`
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error fetching device logs:', error.message);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------
// Execute commands on device
// ---------------------------------------------
export async function executeCommands(data) {
  const { id, commands } = data;
  console.log('Executing commands for device:', id);
  try {
    const response = await context.request({
      method: 'POST',
      path: `/v1.0/iot-03/devices/${id}/commands`,
      body: { commands }
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error executing commands:', error.message);
    return { success: false, error: error.message };
  }
}
