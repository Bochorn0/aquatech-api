/** Fechas de visitas en calendario local, sin depender de la zona del proceso. */

export function addMonthsYmd(ymd, months) {
  const [year, month, day] = ymd.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const result = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), clamped));
  return result.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Primera visita en `date`. El periodo es el hueco [inicio, inicio + horizonte):
 * la fecha en que cierra no cuenta. Cada 1 semana durante 2 semanas son 2 citas.
 */
export function buildOccurrenceDates({ date, intervalMonths, horizonMonths, intervalDays, horizonDays }) {
  if (intervalDays) {
    const end = addDaysYmd(date, horizonDays ?? intervalDays);
    const dates = [];
    let cursor = date;
    while (cursor < end && dates.length < 40) {
      dates.push(cursor);
      cursor = addDaysYmd(cursor, intervalDays);
    }
    return dates.length ? dates : [date];
  }
  if (!intervalMonths) return [date];
  const end = addMonthsYmd(date, horizonMonths);
  const dates = [];
  let cursor = date;
  while (cursor < end && dates.length < 40) {
    dates.push(cursor);
    cursor = addMonthsYmd(cursor, intervalMonths);
  }
  return dates.length ? dates : [date];
}

export function addMinutes(hm, minutes) {
  const [hour, minute] = hm.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const mins = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    hm: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
    dayOffset,
  };
}

export function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidHm(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
}

/** Convierte fecha y hora de pared en `timeZone` a un instante UTC. */
export function localDateTimeToUtc(ymd, hm, timeZone) {
  const [year, month, day] = ymd.split('-').map(Number);
  const [hour, minute] = hm.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wanted;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utc)).map((part) => [part.type, part.value])
    );
    let seenHour = Number(parts.hour);
    let seenDay = Number(parts.day);
    let seenMonth = Number(parts.month);
    let seenYear = Number(parts.year);
    if (seenHour === 24) {
      seenHour = 0;
      const next = new Date(Date.UTC(seenYear, seenMonth - 1, seenDay + 1));
      seenYear = next.getUTCFullYear();
      seenMonth = next.getUTCMonth() + 1;
      seenDay = next.getUTCDate();
    }
    const seen = Date.UTC(seenYear, seenMonth - 1, seenDay, seenHour, Number(parts.minute), 0);
    const delta = wanted - seen;
    if (delta === 0) break;
    utc += delta;
  }

  return new Date(utc);
}
