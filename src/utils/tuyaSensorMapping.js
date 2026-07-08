/**
 * Map Tuya product status codes to V2 sensor_type keys used by metrics.
 */

export const TUYA_CODE_TO_SENSOR_TYPE = {
  flowrate_speed_1: 'flujo_produccion',
  flowrate_speed_2: 'flujo_rechazo',
  flowrate_total_1: 'flujo_produccion',
  flowrate_total_2: 'flujo_rechazo',
  tds_out: 'tds',
  tds_in: 'tds_entrada',
  liquid_level_percent: 'nivel_cruda',
  liquid_depth: 'nivel_cruda',
};

export function tuyaCodeToSensorType(code) {
  if (!code) return null;
  const lower = String(code).toLowerCase().trim();
  return TUYA_CODE_TO_SENSOR_TYPE[lower] || null;
}

export function normalizeTuyaStatus(status = []) {
  if (!Array.isArray(status)) return [];
  return status.map((s) => ({
    code: s.code,
    label: s.label || s.name || s.code,
    value: s.value != null && s.value !== '' ? parseFloat(s.value) : null,
    sensor_type: tuyaCodeToSensorType(s.code),
  }));
}
