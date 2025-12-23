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
  
  // Si fields es una cadena con múltiples códigos separados por comas, hacer consultas separadas
  const fieldCodes = typeof fields === 'string' ? fields.split(',').map(f => f.trim()) : [fields];
  
  // Si hay múltiples códigos, hacer consultas separadas y combinar resultados
  if (fieldCodes.length > 1) {
    console.log(`📡 Consultando ${fieldCodes.length} códigos por separado para evitar error de parámetros`);
    
    const allLogs = [];
    const promises = fieldCodes.map(async (code) => {
      const path = `/v2.0/cloud/thing/${id}/report-logs?codes=${code}&start_time=${safeStart}&end_time=${safeEnd}&size=${size}` +
                    (last_row_key ? `&last_row_key=${last_row_key}` : '');
      
      try {
        const response = await context.request({ method: 'GET', path });
        const responseData = handleResponse(response);
        
        if (responseData.success && responseData.data?.logs) {
          return responseData.data.logs;
        }
        return [];
      } catch (error) {
        console.warn(`⚠️ Error obteniendo logs para código ${code}:`, error.message);
        return [];
      }
    });
    
    const results = await Promise.all(promises);
    const combinedLogs = results.flat();
    
    // Eliminar duplicados basándose en event_time y code
    const uniqueLogs = [];
    const seen = new Set();
    combinedLogs.forEach(log => {
      const key = `${log.event_time}_${log.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLogs.push(log);
      }
    });
    
    // Ordenar por event_time descendente
    uniqueLogs.sort((a, b) => b.event_time - a.event_time);
    
    console.log(`✅ Logs combinados: ${uniqueLogs.length} registros únicos de ${combinedLogs.length} totales`);
    
    return {
      success: true,
      data: {
        logs: uniqueLogs,
        has_more: false, // No manejamos paginación en modo combinado por ahora
      }
    };
  } else {
    // Un solo código, consulta normal
    const code = fieldCodes[0];
    const path = `/v2.0/cloud/thing/${id}/report-logs?codes=${code}&start_time=${safeStart}&end_time=${safeEnd}&size=${size}` +
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
}



// ---------------------------------------------
// Fetch device logs for routine (separate function to avoid breaking existing functionality)
// Uses the EXACT same implementation as getDeviceLogs which already works
// ---------------------------------------------
export async function getDeviceLogsForRoutine(query) {
  const { id, start_date, end_date, fields, size = 100, last_row_key } = query;
  const safeStart = Number(start_date);
  const safeEnd = Number(end_date);
  const encodedFields = encodeURIComponent(fields);

  const path = `/v2.0/cloud/thing/${id}/report-logs?codes=${encodedFields}&start_time=${safeStart}&end_time=${safeEnd}&size=${size}` +
                (last_row_key ? `&last_row_key=${last_row_key}` : '');

  console.log('[getDeviceLogsForRoutine] path', path);

  try {
    const response = await context.request({ method: 'GET', path });
    const responseData = handleResponse(response);

    if (responseData.success && responseData.data) return responseData;
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
