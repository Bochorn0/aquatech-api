/** CSV de product_logs para la sección de reportería en Equipos / histórico. */

export const REPORT_MAX_ROWS = 200000;
export const REPORT_PAGE_SIZE_DEFAULT = 25;
export const REPORT_PAGE_SIZE_MAX = 100;

const DETAIL_SORT_KEYS = [
  'fecha_hermosillo',
  'fecha_utc',
  'tds_ppm',
  'volumen_produccion_l',
  'volumen_rechazo_l',
  'flujo_produccion_l_min',
  'flujo_rechazo_l_min',
  'temperatura',
  'origen',
];

const DAILY_SORT_KEYS = [
  'dia',
  'muestras',
  'tds_inicio_ppm',
  'tds_fin_ppm',
  'tds_min_ppm',
  'tds_max_ppm',
  'volumen_produccion_delta_l',
  'volumen_rechazo_delta_l',
  'flujo_produccion_prom_l_min',
  'flujo_rechazo_prom_l_min',
];

const TEXT_FILTER_KEYS = new Set(['origen']);

const HERMOSILLO_TZ = 'America/Hermosillo';

export const DETAIL_CSV_HEADERS = [
  'fecha_hermosillo',
  'fecha_utc',
  'tds_ppm',
  'volumen_produccion_l',
  'volumen_rechazo_l',
  'flujo_produccion_l_min',
  'flujo_rechazo_l_min',
  'flujo_produccion_crudo',
  'flujo_rechazo_crudo',
  'temperatura',
  'origen',
  'device_id',
];

export const DAILY_CSV_HEADERS = [
  'dia',
  'muestras',
  'tds_inicio_ppm',
  'tds_fin_ppm',
  'tds_min_ppm',
  'tds_max_ppm',
  'volumen_produccion_delta_l',
  'volumen_rechazo_delta_l',
  'flujo_produccion_prom_l_min',
  'flujo_rechazo_prom_l_min',
];

function queryFlag(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function parseOptionalEpochMs(raw) {
  if (raw == null || raw === '') return { ok: true, date: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, date: null };
  return { ok: true, date: new Date(n) };
}

function parseOptionalNumber(raw) {
  if (raw == null || String(raw).trim() === '') return { ok: true, value: null };
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, value: null };
  return { ok: true, value: n };
}

function parseColumnFilters(query, mode) {
  const allowed = new Set(mode === 'daily' ? DAILY_SORT_KEYS : DETAIL_SORT_KEYS);
  const columnFilters = {};
  for (const key of allowed) {
    if (TEXT_FILTER_KEYS.has(key)) {
      const text = String(query[`col_${key}`] ?? '').trim();
      if (text) columnFilters[key] = { text: text.slice(0, 80) };
      continue;
    }
    const minParsed = parseOptionalNumber(query[`col_${key}_min`]);
    const maxParsed = parseOptionalNumber(query[`col_${key}_max`]);
    if (!minParsed.ok || !maxParsed.ok) {
      return { error: `Filtro numérico inválido en ${key}` };
    }
    if (minParsed.value == null && maxParsed.value == null) continue;
    if (minParsed.value != null && maxParsed.value != null && minParsed.value > maxParsed.value) {
      return { error: `En ${key} el mínimo no puede ser mayor que el máximo` };
    }
    columnFilters[key] = { min: minParsed.value, max: maxParsed.value };
  }
  return { columnFilters };
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ error: string } | { error?: undefined, start: Date|null, end: Date|null, excludeZeros: boolean, countOnly: boolean, mode: 'detail'|'daily', page: number, pageSize: number, sort: string, order: 'asc'|'desc', columnFilters: Record<string, { min?: number|null, max?: number|null, text?: string }> }}
 */
export function parseReportQuery(query = {}) {
  const startParsed = parseOptionalEpochMs(query.start_date);
  const endParsed = parseOptionalEpochMs(query.end_date);
  if (!startParsed.ok || !endParsed.ok) {
    return { error: 'Parámetros de fecha inválidos (start_date / end_date en milisegundos UTC)' };
  }

  let start = startParsed.date;
  let end = endParsed.date;
  const now = new Date();
  if (end && end > now) end = now;
  if (start && end && start.getTime() >= end.getTime()) {
    return { error: 'Rango inválido: la fecha inicial debe ser anterior a la final' };
  }

  const rawMode = String(query.mode || 'detail').toLowerCase();
  if (rawMode !== 'detail' && rawMode !== 'daily') {
    return { error: 'Modo inválido. Use detail o daily.' };
  }

  const sortKeys = rawMode === 'daily' ? DAILY_SORT_KEYS : DETAIL_SORT_KEYS;
  const defaultSort = rawMode === 'daily' ? 'dia' : 'fecha_hermosillo';
  const sort = String(query.sort || defaultSort);
  if (!sortKeys.includes(sort)) {
    return { error: 'Columna de orden no válida' };
  }
  const order = String(query.order || 'desc').toLowerCase();
  if (order !== 'asc' && order !== 'desc') {
    return { error: 'El orden debe ser asc o desc' };
  }

  const page = Math.max(parseInt(query.page ?? '1', 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(query.page_size ?? String(REPORT_PAGE_SIZE_DEFAULT), 10) || REPORT_PAGE_SIZE_DEFAULT, 1),
    REPORT_PAGE_SIZE_MAX
  );
  const filters = parseColumnFilters(query, rawMode);
  if (filters.error) return { error: filters.error };

  return {
    start,
    end,
    excludeZeros: queryFlag(query.exclude_zeros),
    countOnly: queryFlag(query.count_only),
    mode: rawMode,
    page,
    pageSize,
    sort,
    order,
    columnFilters: filters.columnFilters,
  };
}

export function csvCell(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatReportNumber(value, digits = null) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (digits == null) return String(n);
  return n.toFixed(digits);
}

/** Misma escala que la tabla de histórico: crudo Tuya ÷ 10 → L/min. Cero se deja vacío. */
export function flujoToLmin(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return '';
  return (n / 10).toFixed(2);
}

export function formatReportBound(value, mode = 'detail') {
  if (value == null || value === '') return null;
  if (mode === 'daily') {
    const day = formatCalendarDay(value);
    if (!day) return null;
    const [year, month, dayNum] = day.split('-');
    return `${dayNum}/${month}/${year}`;
  }
  const formatted = formatHermosillo(value);
  return formatted || null;
}

export function formatHermosillo(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: HERMOSILLO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

function formatCalendarDay(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function volumeDelta(first, last) {
  if (first == null || first === '' || last == null || last === '') return '';
  const a = Number(first);
  const b = Number(last);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  return (b - a).toFixed(2);
}

export function reportRowToCsvCells(row) {
  const d = row?.date instanceof Date ? row.date : new Date(row?.date);
  const fechaUtc = Number.isNaN(d.getTime()) ? '' : d.toISOString();
  return [
    formatHermosillo(d),
    fechaUtc,
    formatReportNumber(row?.tds, 2),
    formatReportNumber(row?.production_volume, 2),
    formatReportNumber(row?.rejected_volume, 2),
    flujoToLmin(row?.flujo_produccion),
    flujoToLmin(row?.flujo_rechazo),
    formatReportNumber(row?.flujo_produccion),
    formatReportNumber(row?.flujo_rechazo),
    formatReportNumber(row?.temperature, 2),
    row?.source ?? '',
    row?.product_device_id ?? '',
  ];
}

export function reportRowToObject(row) {
  const cells = reportRowToCsvCells(row);
  return Object.fromEntries(DETAIL_CSV_HEADERS.map((header, index) => [header, cells[index]]));
}

export function reportDailyRowToCsvCells(row) {
  return [
    formatCalendarDay(row?.day),
    row?.muestras != null ? String(Number(row.muestras) || 0) : '',
    formatReportNumber(row?.tds_first, 2),
    formatReportNumber(row?.tds_last, 2),
    formatReportNumber(row?.tds_min, 2),
    formatReportNumber(row?.tds_max, 2),
    volumeDelta(row?.prod_first, row?.prod_last),
    volumeDelta(row?.rej_first, row?.rej_last),
    flujoToLmin(row?.flujo_prod_avg),
    flujoToLmin(row?.flujo_rech_avg),
  ];
}

export function reportDailyRowToObject(row) {
  const cells = reportDailyRowToCsvCells(row);
  return Object.fromEntries(DAILY_CSV_HEADERS.map((header, index) => [header, cells[index]]));
}

function toCsv(headers, cellRows) {
  const lines = [headers.join(',')];
  for (const cells of cellRows) {
    lines.push(cells.map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function buildProductLogsReportCsv(rows) {
  return toCsv(DETAIL_CSV_HEADERS, (rows || []).map(reportRowToCsvCells));
}

export function buildDailyReportCsv(rows) {
  return toCsv(DAILY_CSV_HEADERS, (rows || []).map(reportDailyRowToCsvCells));
}

export function safeReportFilename(name, mode = 'detail') {
  const base = String(name || 'equipo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  const kind = mode === 'daily' ? 'por_dia' : 'registros';
  return `reporte_${kind}_${base || 'equipo'}_${stamp}.csv`;
}
