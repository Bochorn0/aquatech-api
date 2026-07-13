/**
 * Resolve punto-venta historico preset / custom window to ISO start/end.
 * Presets: 24h | 3d | 7d | 30d | custom (requires startDate + endDate query).
 */
export function resolveHistoricoRangeFromQuery(query = {}, momentLib) {
  const moment = momentLib;
  const rangeRaw = (query.range || query.historicoRange || '24h').toString().toLowerCase();
  const startQ = query.startDate || query.start_date || query.start;
  const endQ = query.endDate || query.end_date || query.end;

  const MAX_CUSTOM_MS = 90 * 24 * 60 * 60 * 1000;

  if (rangeRaw === 'custom') {
    if (!startQ || !endQ) {
      const err = new Error('Para rango custom se requieren startDate y endDate');
      err.statusCode = 400;
      throw err;
    }
    const start = moment(startQ);
    const end = moment(endQ);
    if (!start.isValid() || !end.isValid()) {
      const err = new Error('Parámetros de fecha inválidos (startDate / endDate)');
      err.statusCode = 400;
      throw err;
    }
    if (!end.isAfter(start)) {
      const err = new Error('endDate debe ser posterior a startDate');
      err.statusCode = 400;
      throw err;
    }
    if (end.valueOf() - start.valueOf() > MAX_CUSTOM_MS) {
      const err = new Error('El rango personalizado máximo es 90 días');
      err.statusCode = 400;
      throw err;
    }
    return {
      range: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }

  const endDate = moment().toISOString();
  if (rangeRaw === '3d') {
    return { range: '3d', startDate: moment().subtract(3, 'days').toISOString(), endDate };
  }
  if (rangeRaw === '7d') {
    return { range: '7d', startDate: moment().subtract(7, 'days').toISOString(), endDate };
  }
  if (rangeRaw === '30d') {
    return { range: '30d', startDate: moment().subtract(30, 'days').toISOString(), endDate };
  }
  // default 24h
  return { range: '24h', startDate: moment().subtract(24, 'hours').toISOString(), endDate };
}
