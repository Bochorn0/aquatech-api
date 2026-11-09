import {
  buildDailyReportCsv,
  buildProductLogsReportCsv,
  parseReportQuery,
  reportDailyRowToObject,
  reportRowToObject,
  safeReportFilename,
} from '../../src/services/productLogsReport.js';

describe('productLogsReport', () => {
  it('parses an open range and the zero filter', () => {
    const parsed = parseReportQuery({ exclude_zeros: '1', mode: 'daily', count_only: '1' });
    expect(parsed.error).toBeUndefined();
    expect(parsed.excludeZeros).toBe(true);
    expect(parsed.countOnly).toBe(true);
    expect(parsed.mode).toBe('daily');
    expect(parsed.start).toBeNull();
    expect(parsed.end).toBeNull();
  });

  it('rejects an inverted date range', () => {
    const parsed = parseReportQuery({ start_date: '2000', end_date: '1000' });
    expect(parsed.error).toMatch(/anterior/);
  });

  it('writes detail rows with Hermosillo time and L/min', () => {
    const csv = buildProductLogsReportCsv([
      {
        date: new Date('2026-03-15T18:30:00.000Z'),
        tds: 12.5,
        production_volume: 100,
        rejected_volume: 0,
        flujo_produccion: 25,
        flujo_rechazo: 0,
        temperature: null,
        source: 'tuya, historico',
        product_device_id: 'abc',
      },
    ]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('fecha_hermosillo,fecha_utc,tds_ppm')).toBe(true);
    expect(row).toContain('2026-03-15T18:30:00.000Z');
    expect(row).toContain('15/03/2026');
    expect(row).toContain('11:30:00');
    expect(row).toContain('12.50');
    expect(row).toContain('2.50');
    expect(row).toContain('"tuya, historico"');
    const obj = reportRowToObject({
      date: new Date('2026-03-15T18:30:00.000Z'),
      tds: 0,
      production_volume: 1,
      rejected_volume: null,
      flujo_produccion: 0,
      flujo_rechazo: null,
      source: 'database',
      product_device_id: 'abc',
    });
    expect(obj.tds_ppm).toBe('0.00');
    expect(obj.flujo_produccion_l_min).toBe('');
    expect(obj.flujo_produccion_crudo).toBe('0');
  });

  it('writes a daily delta row', () => {
    const row = reportDailyRowToObject({
      day: '2026-03-15',
      muestras: 40,
      tds_first: 10,
      tds_last: 12,
      tds_min: 9,
      tds_max: 14,
      prod_first: 100,
      prod_last: 130.5,
      rej_first: 20,
      rej_last: 20,
      flujo_prod_avg: 18,
      flujo_rech_avg: 0,
    });
    expect(row.dia).toBe('2026-03-15');
    expect(row.volumen_produccion_delta_l).toBe('30.50');
    expect(row.volumen_rechazo_delta_l).toBe('0.00');
    expect(row.flujo_produccion_prom_l_min).toBe('1.80');
    expect(row.flujo_rechazo_prom_l_min).toBe('');
    expect(buildDailyReportCsv([row]).split('\n')[0]).toContain('volumen_produccion_delta_l');
  });

  it('builds an ascii filename', () => {
    const name = safeReportFilename('Ósmosis Norte / 1', 'daily');
    expect(name.startsWith('reporte_por_dia_Osmosis_Norte_1_')).toBe(true);
    expect(name.endsWith('.csv')).toBe(true);
  });
});
