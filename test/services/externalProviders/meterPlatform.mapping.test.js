import {
  normalizeMeterPlatformReading,
  cubicMetersToLiters,
  toCubicMeters,
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
