import {
  normalizeLinghuPush,
  cubicMetersToLiters,
  LINGHU_PROVIDER_ID,
} from '../../../src/services/externalProviders/providers/linghu/linghu.mapping.js';
import { ExternalProviderValidationError } from '../../../src/services/externalProviders/types.js';
import { getProvider, listProviders } from '../../../src/services/externalProviders/index.js';

describe('linghu.mapping normalizeLinghuPush', () => {
  const sample = {
    device_number: '12345678901239',
    create_time: '2024-10-10 10:10:10',
    positve_volume: 21.5,
    reverse_volume: 1.25,
    temperature: 22.1,
    voltage_meter: 3.6,
    valve_status: 1,
    signal_meter: 18,
    signal_noise: 2,
    imei: '12345678901239',
    imsi: '12345678901239',
    volume_time: '2024-10-10 10:10:10',
    day_meter_time: '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
    under_voltage_status: 0,
    electrica_fault_status: 0,
    reverse_warning_status: 0,
    sensor_warning_status: 0,
    sensor_p: 1,
    leakage_alarm_status: 0,
    para_a: '0.15',
    para_b: '0.32',
    para_c: '',
  };

  it('maps device, converts m3 to liters, and tags provider', () => {
    const r = normalizeLinghuPush(sample);
    expect(r.provider).toBe(LINGHU_PROVIDER_ID);
    expect(r.externalDeviceId).toBe('12345678901239');
    expect(r.imei).toBe('12345678901239');
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(21500);
    expect(r.metrics.find((m) => m.name === 'volume_reverse').value).toBe(1250);
    expect(r.metrics.find((m) => m.name === 'flow_instant').value).toBeCloseTo(0.15);
    expect(r.metrics.find((m) => m.name === 'pressure').value).toBeCloseTo(0.32);
    expect(r.idempotencyKey).toContain(LINGHU_PROVIDER_ID);
    expect(r.raw.source).toBe('external:linghu');
  });

  it('accepts positive_volume spelling and spaced keys', () => {
    const r = normalizeLinghuPush({
      device_number: 'ABC',
      'volume_time ': '2024-01-01 00:00:00',
      positive_volume: 2,
    });
    expect(r.externalDeviceId).toBe('ABC');
    expect(r.metrics.find((m) => m.name === 'volume_positive').value).toBe(2000);
  });

  it('rejects missing device_number', () => {
    expect(() => normalizeLinghuPush({ positve_volume: 1 })).toThrow(ExternalProviderValidationError);
  });

  it('rejects empty metrics', () => {
    expect(() => normalizeLinghuPush({ device_number: 'X' })).toThrow(ExternalProviderValidationError);
  });
});

describe('cubicMetersToLiters', () => {
  it('converts', () => {
    expect(cubicMetersToLiters(1.5)).toBe(1500);
    expect(cubicMetersToLiters(null)).toBeNull();
  });
});

describe('externalProviders registry', () => {
  it('registers linghu', () => {
    expect(getProvider('linghu')?.id).toBe('linghu');
    expect(listProviders().some((p) => p.id === 'linghu')).toBe(true);
  });
});
