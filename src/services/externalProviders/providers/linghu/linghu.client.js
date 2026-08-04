/**
 * Optional outbound HTTP helpers for Linghu (stubs until vendor documents pull APIs).
 * Mirrors the spirit of tuya.service.js exports without requiring live credentials.
 */

export async function getDeviceDetail(externalId) {
  return {
    success: false,
    error: 'Not implemented: Linghu has no documented pull/detail API',
    data: null,
    externalId,
  };
}

export async function listDevices() {
  return {
    success: false,
    error: 'Not implemented: Linghu has no documented device list API',
    data: [],
  };
}

export default { getDeviceDetail, listDevices };
