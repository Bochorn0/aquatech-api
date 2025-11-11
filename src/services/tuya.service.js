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
    console.error(`response`, response);
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
// export async function getDeviceLogs(query) {
//   const { id, start_date, end_date, fields, size, last_row_key } = query;
//   console.log('Fetching device logs for:', query);

//   try {
//     // Ensure last_row_key is passed if it exists, otherwise fetch the first page
//     const response = await context.request({
//       method: 'GET',
//       path: `/v1.0/iot-03/devices/${id}/report-logs?start_time=${start_date}&end_time=${end_date}&codes=${fields}&size=${size}${last_row_key ? `&last_row_key=${last_row_key}` : ''}`
//     });

//     const responseData = handleResponse(response);  // Standardized error handling

//     if (responseData.success && responseData.data) {
//       return responseData;
//     }
//     return { success: false, error: 'No logs found' };
//   } catch (error) {
//     console.error('Error fetching device logs:', error.message);
//     return { success: false, error: error.message };
//   }
// }
export async function getDeviceLogs(query) {
  const { id, start_date, end_date, fields, size = 100, last_row_key } = query;
  const safeStart = Number(start_date);
  const safeEnd = Number(end_date);
  const encodedFields = encodeURIComponent(fields);

  const path = `/v2.0/cloud/thing/${id}/report-logs?codes=${encodedFields}&start_time=${safeStart}&end_time=${safeEnd}&size=${size}` +
                (last_row_key ? `&last_row_key=${last_row_key}` : '');

  console.log('path', path);

  try {
    const response = await context.request({ method: 'GET', path });
    const responseData = handleResponse(response);

    if (responseData.success && responseData.data) return responseData;
    return { success: false, error: 'No logs found' };
  } catch (error) {
    console.error('Error fetching device logs:', error.message);
    return { success: false, error: error.message };
  }
}



// ---------------------------------------------
// Fetch device logs for routine (separate function to avoid breaking existing functionality)
// Uses v1.0 API which works with dev permissions (same as commented version above)
// ---------------------------------------------
export async function getDeviceLogsForRoutine(query) {
  const { id, start_date, end_date, fields, size = 100, last_row_key } = query;
  console.log('[getDeviceLogsForRoutine] Fetching device logs for:', query);

  try {
    // Use v1.0 API endpoint which works with dev permissions
    const response = await context.request({
      method: 'GET',
      path: `/v1.0/iot-03/devices/${id}/report-logs?start_time=${start_date}&end_time=${end_date}&codes=${fields}&size=${size}${last_row_key ? `&last_row_key=${last_row_key}` : ''}`
    });

    console.log('[getDeviceLogsForRoutine] path', `/v1.0/iot-03/devices/${id}/report-logs?start_time=${start_date}&end_time=${end_date}&codes=${fields}&size=${size}${last_row_key ? `&last_row_key=${last_row_key}` : ''}`);

    const responseData = handleResponse(response);  // Standardized error handling

    if (responseData.success && responseData.data) {
      return responseData;
    }
    return { success: false, error: 'No logs found' };
  } catch (error) {
    console.error('[getDeviceLogsForRoutine] Error fetching device logs:', error.message);
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
