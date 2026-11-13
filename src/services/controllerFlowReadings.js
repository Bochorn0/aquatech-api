import meterPlatformClient from './externalProviders/providers/meterPlatform/meterPlatform.client.js';
import { normalizeMeterPlatformReading } from './externalProviders/providers/meterPlatform/meterPlatform.mapping.js';

const CACHE_MS = 60 * 1000;
const MAX_RATE_MINUTES = 30;

const samples = new Map();
const inflight = new Map();

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.rows || payload.list || payload.records || [];
}

function readingFromCache(deviceCode) {
  const cached = samples.get(deviceCode);
  if (!cached) return { lpm: 0, ok: false };
  const ageMin = (Date.now() - cached.at) / 60000;
  const ok = cached.ok && ageMin >= 0 && ageMin <= MAX_RATE_MINUTES;
  return { lpm: ok ? cached.lpm : 0, ok };
}

async function latestLiters(deviceCode) {
  const conn = await meterPlatformClient.getConnRecordList(deviceCode, {
    pageNum: 1,
    pageSize: 8,
  });
  if (!conn?.success) return null;
  const rows = extractRows(conn.data);
  const report = (rows.length ? rows : extractRows(conn.raw)).find(
    (row) =>
      String(row?.direction || '').toLowerCase() === 'client'
      && String(row?.type || '').toLowerCase() === 'report'
      && row?.analyticalBody
  );
  if (!report) return null;
  const reading = normalizeMeterPlatformReading({ ...report, deviceCode });
  const forward = reading.metrics.find((metric) => metric.name === 'volume_positive');
  const liters = Number(forward?.value);
  const at = new Date(reading.observedAt).getTime();
  if (!Number.isFinite(liters) || !Number.isFinite(at)) return null;
  return { liters, at };
}

async function refresh(deviceCode) {
  const sample = await latestLiters(deviceCode);
  const previous = samples.get(deviceCode);
  const fetchedAt = Date.now();
  if (!sample) {
    if (previous) samples.set(deviceCode, { ...previous, fetchedAt, ok: false, lpm: 0 });
    return;
  }

  let lpm = 0;
  let ok = false;
  if (previous && sample.at > previous.at) {
    const minutes = (sample.at - previous.at) / 60000;
    if (minutes >= 0.15 && minutes <= MAX_RATE_MINUTES) {
      lpm = (sample.liters - previous.liters) / minutes;
      if (lpm < 0) lpm = 0;
      ok = true;
    }
  } else if (previous && sample.at === previous.at) {
    lpm = previous.lpm;
    ok = previous.ok;
  }

  samples.set(deviceCode, {
    liters: sample.liters,
    at: sample.at,
    fetchedAt,
    lpm,
    ok,
  });
}

function schedule(deviceCode) {
  if (inflight.has(deviceCode)) return;
  const job = refresh(deviceCode)
    .catch((error) => {
      console.error('[controllerFlowReadings]', deviceCode, error.message);
    })
    .finally(() => inflight.delete(deviceCode));
  inflight.set(deviceCode, job);
}

/**
 * El equipo solo recibe ip y last_time_active.
 * El caudal de un medidor de plataforma se calcula aquí y se adjunta en la respuesta,
 * sin guardarlo dentro de rules.
 */
export async function decorateRulesForDevice(rules) {
  if (!rules || !Array.isArray(rules.flows)) return rules;
  if (!meterPlatformClient.hasMeterPlatformCredentials()) return rules;

  const flows = rules.flows.map((flow) => {
    if (flow?.origin !== 'platform' || !flow.device_code) return flow;
    const deviceCode = String(flow.device_code);
    const cached = samples.get(deviceCode);
    if (!cached || Date.now() - cached.fetchedAt >= CACHE_MS) schedule(deviceCode);
    const live = readingFromCache(deviceCode);
    return { ...flow, lpm: live.lpm, ok: live.ok };
  });

  return { ...rules, flows };
}
