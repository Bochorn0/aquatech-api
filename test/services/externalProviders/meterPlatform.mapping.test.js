import {
  normalizeMeterPlatformReading,
  cubicMetersToLiters,
  toCubicMeters,
  parseLast5DaysDailyUsage,
  enrichDailyUsageMap,
  METER_PLATFORM_PROVIDER_ID,
} from '../../../src/services/externalProviders/providers/meterPlatform/meterPlatform.mapping.js';
import { ExternalProviderValidationError } from '../../../src/services/externalProviders/types.js';
import { getProvider, listProviders } from '../../../src/services/externalProviders/index.js';

describe('meterPlatform.mapping normalizeMeterPlatformReading', () => {
  /** Fixture inspired by PDF live capture (~2990 m³, device 83222604200001). */
  const sampleExtend = {
    deviceCode: '83222604200001',
    imei: '860123456789012',
    currentForwardUsage: 2990,
    currentReverseUsage: 0,
    reportTime: '2026-08-08 00:01:29',
    temperature: 2210,
    pressure: 320,
    batteryVoltage: 3600,
    signalStrength: 18,
    valveStatus: 0,
    isOnline: true,
    dailyUsageMap: { '2026-08-07': 12.5 },
    deviceType: 'water',
  };

  it('maps deviceCode, converts m³→L, scales protocol temp/pressure/voltage', () => {
    const r = normalizeMeterPlatformReading(sampleExtend);
    expect(r.provider).toBe(METER_PLATFORM_PROVIDER_ID);
    expect(r.externalDeviceId).toBe('83222604200001');
    expect(r.imei).toBe('860123456789012');
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(2_990_000);
    expect(r.metrics.find((m) => m.name === 'volume_reverse').value).toBe(0);
    expect(r.metrics.find((m) => m.name === 'temperature').value).toBeCloseTo(22.1);
    expect(r.metrics.find((m) => m.name === 'pressure').value).toBeCloseTo(0.32);
    expect(r.metrics.find((m) => m.name === 'voltage_meter').value).toBeCloseTo(3.6);
    expect(r.metrics.find((m) => m.name === 'online').value).toBe(1);
    expect(r.idempotencyKey).toContain(METER_PLATFORM_PROVIDER_ID);
    expect(r.raw.source).toBe('external:meter-platform');
    expect(r.raw.dailyUsageMap).toEqual({ '2026-08-07': 12.5 });
  });

  it('parses 12-digit BCD-like report clock', () => {
    const r = normalizeMeterPlatformReading({
      deviceCode: '83222604200001',
      currentForwardUsage: 1,
      realTimeClock: '260808000129',
    });
    expect(r.observedAt.getFullYear()).toBe(2026);
    expect(r.observedAt.getMonth()).toBe(7); // August
    expect(r.observedAt.getDate()).toBe(8);
  });

  it('honors volumeUnit m3x1000', () => {
    const r = normalizeMeterPlatformReading(
      { deviceCode: 'X', currentForwardUsage: 2990000 },
      { volumeUnit: 'm3x1000' }
    );
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(2_990_000);
  });

  it('flattens live deviceExtend + nested deviceInfo', () => {
    const r = normalizeMeterPlatformReading({
      meterNo: '11002608101111',
      valveDesc: '阀门开',
      terminalClock: '260810134546',
      deviceInfo: {
        deviceCode: '11002608101111',
        totalMetering: 0,
        isOnline: 'on_line',
        valveStatus: '阀门开',
      },
    });
    expect(r.externalDeviceId).toBe('11002608101111');
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(0);
    expect(r.metrics.find((m) => m.name === 'online').value).toBe(1);
    expect(r.metrics.find((m) => m.name === 'valve_status').value).toBe(0);
  });

  it('parses conn analyticalBody meterReportRequest', () => {
    const r = normalizeMeterPlatformReading({
      deviceCode: '11002608101111',
      direction: 'client',
      type: 'report',
      analyticalBody: JSON.stringify({
        meterReportRequest: {
          terminalClock: '260810134546',
          currentForwardUsage: 12.5,
          reverseUsage: 0.1,
          batteryVoltage: 3694,
          valveDesc: '阀门开',
          dailyUsageMap: { '2026-08-09': 0 },
        },
      }),
    });
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(12500);
    expect(r.metrics.find((m) => m.name === 'volume_reverse').value).toBe(100);
    expect(r.metrics.find((m) => m.name === 'voltage_meter').value).toBeCloseTo(3.694);
    expect(r.raw.dailyUsageMap).toEqual({ '2026-08-09': 0 });
  });

  it('rejects missing deviceCode', () => {
    expect(() => normalizeMeterPlatformReading({ currentForwardUsage: 1 })).toThrow(
      ExternalProviderValidationError
    );
  });

  it('rejects empty metrics', () => {
    expect(() => normalizeMeterPlatformReading({ deviceCode: 'X' })).toThrow(
      ExternalProviderValidationError
    );
  });
});

describe('parseLast5DaysDailyUsage / enrichDailyUsageMap', () => {
  it('parses last5DaysDailyUsage hex as protocol 1101H ×1000 m³', () => {
    // start 2026-08-05, 2 days: 1.5 m³ (1500) and 2.0 m³ (2000)
    const hex = `26080502${'000005dc'}${'000007d0'}`;
    const parsed = parseLast5DaysDailyUsage(hex);
    expect(parsed.startDate).toBe('2026-08-05');
    expect(parsed.days).toBe(2);
    expect(parsed.entries[0]).toMatchObject({ date: '2026-08-05', raw: 1500, m3: 1.5, liters: 1500 });
    expect(parsed.entries[1]).toMatchObject({ date: '2026-08-06', raw: 2000, m3: 2, liters: 2000 });
  });

  it('enriches dailyUsageMap with m³→L and day deltas (cumulative pattern)', () => {
    const rows = enrichDailyUsageMap({
      '2026-08-05': 2880,
      '2026-08-06': 2900,
      '2026-08-07': 2990,
    });
    expect(rows[0].liters).toBe(2_880_000);
    expect(rows[1].deltaM3).toBe(20);
    expect(rows[1].deltaLiters).toBe(20_000);
    expect(rows[2].deltaM3).toBe(90);
  });
});

describe('toCubicMeters / cubicMetersToLiters', () => {
  it('passes through m3 in auto mode', () => {
    expect(toCubicMeters(2990, 'auto')).toBe(2990);
    expect(cubicMetersToLiters(1.5)).toBe(1500);
  });
});

describe('meter-platform registry', () => {
  it('registers pull provider', () => {
    const p = getProvider('meter-platform');
    expect(p?.id).toBe('meter-platform');
    expect(p?.mode).toBe('pull');
    expect(listProviders().some((x) => x.id === 'meter-platform' && x.mode === 'pull')).toBe(true);
  });

  it('verifyAuth rejects push path', () => {
    expect(() => getProvider('meter-platform').verifyAuth({})).toThrow(/pull sync/i);
  });
});
