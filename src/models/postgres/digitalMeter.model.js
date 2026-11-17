import { query } from '../../config/postgres.config.js';

const FRESH_MS = 10 * 60 * 1000;

function mapRow(row) {
  if (!row) return null;
  return {
    deviceCode: row.device_code,
    deviceType: row.device_type,
    installAddress: row.install_address,
    online: row.online,
    litersForward: row.liters_forward == null ? null : Number(row.liters_forward),
    rawForward: row.raw_forward == null ? null : Number(row.raw_forward),
    lastReportAt: row.last_report_at,
    updatedAt: row.updated_at,
    sourceUpdatedAt: row.source_updated_at,
  };
}

export async function listDigitalMeters() {
  const result = await query(
    `SELECT device_code, device_type, install_address, online, liters_forward, raw_forward,
            last_report_at, updated_at, source_updated_at
     FROM digital_meters
     ORDER BY device_code`
  );
  return (result.rows || []).map(mapRow);
}

export async function catalogIsStale() {
  const result = await query(
    `SELECT COUNT(*)::int AS count, MIN(updated_at) AS oldest FROM digital_meters`
  );
  const row = result.rows?.[0];
  if (!row || Number(row.count) === 0) return true;
  const oldest = new Date(row.oldest).getTime();
  return !Number.isFinite(oldest) || Date.now() - oldest >= FRESH_MS;
}

export async function volumesMissing() {
  const result = await query(
    `SELECT COUNT(*)::int AS missing
     FROM digital_meters
     WHERE raw_forward IS NULL AND liters_forward IS NULL`
  );
  return Number(result.rows?.[0]?.missing || 0) > 0;
}

export async function upsertCatalog(meter) {
  await query(
    `INSERT INTO digital_meters (device_code, device_type, install_address, online, raw_forward, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (device_code) DO UPDATE SET
       device_type = EXCLUDED.device_type,
       install_address = EXCLUDED.install_address,
       online = EXCLUDED.online,
       raw_forward = COALESCE(EXCLUDED.raw_forward, digital_meters.raw_forward),
       updated_at = NOW()`,
    [meter.deviceCode, meter.deviceType, meter.installAddress, meter.online, meter.rawForward]
  );
}

export async function metersWithoutVolume(limit = 20) {
  const result = await query(
    `SELECT device_code
     FROM digital_meters
     WHERE raw_forward IS NULL AND liters_forward IS NULL
       AND (source_updated_at IS NULL OR source_updated_at < NOW() - INTERVAL '10 minutes')
     ORDER BY device_code
     LIMIT $1`,
    [limit]
  );
  return (result.rows || []).map((row) => row.device_code);
}

export async function markReadingChecked(deviceCode) {
  await query(
    `UPDATE digital_meters SET source_updated_at = NOW() WHERE device_code = $1`,
    [deviceCode]
  );
}

export async function readingIsFresh(deviceCode) {
  const result = await query(
    `SELECT source_updated_at FROM digital_meters WHERE device_code = $1`,
    [deviceCode]
  );
  const at = result.rows?.[0]?.source_updated_at;
  if (!at) return false;
  const time = new Date(at).getTime();
  return Number.isFinite(time) && Date.now() - time < FRESH_MS;
}

export async function saveReading(meter) {
  await query(
    `INSERT INTO digital_meters (
       device_code, device_type, install_address, online, liters_forward, raw_forward,
       last_report_at, updated_at, source_updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (device_code) DO UPDATE SET
       device_type = COALESCE(EXCLUDED.device_type, digital_meters.device_type),
       install_address = COALESCE(EXCLUDED.install_address, digital_meters.install_address),
       online = COALESCE(EXCLUDED.online, digital_meters.online),
       liters_forward = EXCLUDED.liters_forward,
       raw_forward = EXCLUDED.raw_forward,
       last_report_at = EXCLUDED.last_report_at,
       updated_at = NOW(),
       source_updated_at = NOW()`,
    [
      meter.deviceCode,
      meter.deviceType,
      meter.installAddress,
      meter.online,
      meter.litersForward,
      meter.rawForward,
      meter.lastReportAt,
    ]
  );

  if (!meter.lastReportAt) return;
  await query(
    `INSERT INTO digital_meter_readings (device_code, liters_forward, raw_forward, observed_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (device_code, observed_at) DO NOTHING`,
    [meter.deviceCode, meter.litersForward, meter.rawForward, meter.lastReportAt]
  );
}
