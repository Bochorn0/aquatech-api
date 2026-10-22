import {
  addDaysYmd,
  addMinutes,
  addMonthsYmd,
  buildOccurrenceDates,
  localDateTimeToUtc,
} from '../../src/services/visitSchedule.dates.js';

describe('visitSchedule.dates', () => {
  it('clamps month ends', () => {
    expect(addMonthsYmd('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsYmd('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('builds a technical-visit series through the horizon', () => {
    expect(buildOccurrenceDates({
      date: '2026-01-15',
      intervalMonths: 3,
      horizonMonths: 12,
    })).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
  });

  it('builds a weekly series through the horizon', () => {
    expect(buildOccurrenceDates({
      date: '2026-01-01',
      intervalDays: 14,
      horizonDays: 56,
    })).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-01-29',
      '2026-02-12',
    ]);
  });

  it('schedules two weekly visits across two weeks', () => {
    expect(buildOccurrenceDates({
      date: '2026-10-23',
      intervalDays: 7,
      horizonDays: 14,
    })).toEqual([
      '2026-10-23',
      '2026-10-30',
    ]);
  });

  it('keeps installation and maintenance as a single date', () => {
    expect(buildOccurrenceDates({
      date: '2026-05-04',
      intervalMonths: null,
      horizonMonths: 24,
    })).toEqual(['2026-05-04']);
  });

  it('rolls the end time into the next day', () => {
    expect(addMinutes('23:30', 60)).toEqual({ hm: '00:30', dayOffset: 1 });
    expect(addDaysYmd('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('converts a wall time in Tijuana to UTC', () => {
    const winter = localDateTimeToUtc('2026-01-15', '10:00', 'America/Tijuana');
    const summer = localDateTimeToUtc('2026-07-15', '10:00', 'America/Tijuana');
    expect(winter.toISOString()).toBe('2026-01-15T18:00:00.000Z');
    expect(summer.toISOString()).toBe('2026-07-15T17:00:00.000Z');
  });
});
