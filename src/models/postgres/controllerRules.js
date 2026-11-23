const INPUT_PINS = [4, 16, 17, 19, 22];
const FLOW_PINS = [4, 19];
const FLUSH_EVERY_MS = 12 * 60 * 60 * 1000;

const FLOW_SLOTS = [
  { role: 'gate', name: 'Agua cruda', optionalDevice: false },
  { role: 'chlorine', name: 'Cruda a tienda', optionalDevice: false },
  { role: 'calc', name: 'Rechazo', optionalDevice: true },
  { role: 'calc', name: 'Produccion', optionalDevice: true },
  { role: 'read', name: 'Pura a tienda', optionalDevice: true },
];

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function clampNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isLegacy(src) {
  const relays = Array.isArray(src.relays) ? src.relays : [];
  return relays.some((relay) => {
    const id = Number(relay?.id);
    const mode = relay?.mode;
    return id > 4 || mode === 'and_inputs' || mode === 'pressure' || mode === 'diff';
  });
}

function sourceRelay(src, legacy, id) {
  const relays = Array.isArray(src.relays) ? src.relays : [];
  const find = (relayId) => relays.find((relay) => Number(relay?.id) === relayId) || {};
  if (!legacy) return find(id);
  if (id === 1) return find(1);
  if (id === 2) return find(3);
  if (id === 3) return find(4);
  const purified = find(6);
  return purified?.mode === 'manual' ? purified : {};
}

/**
 * Cuatro relevadores y cinco flujos.
 * 1 interruptor: la válvula arranca la bomba de agua cruda.
 * 2 timer: flush, 12 horas si el portal no manda otro periodo.
 * 3 flujo: la bomba de cloro sigue al agua cruda que va a la tienda.
 * 4 interruptor: la bomba de agua purificada.
 * El flujo de agua cruda es la condición para que arranque cualquier relevador.
 */
export function normalizeControllerRules(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const legacy = isLegacy(src);
  const raw = sourceRelay(src, legacy, 1);
  const flush = sourceRelay(src, legacy, 2);
  const chlorine = sourceRelay(src, legacy, 3);
  const purified = sourceRelay(src, legacy, 4);
  const rawPin = inputPin(raw.input_a, 16);
  const purifiedPin = inputPin(purified.input_a, 22);
  if (purifiedPin === rawPin) fail('La bomba de cruda y la de purificada no pueden usar el mismo interruptor');

  const relays = [
    {
      id: 1,
      enabled: Boolean(raw.enabled),
      mode: 'manual',
      on: Boolean(raw.on),
      input_a: rawPin,
    },
    normalizeFlush(flush),
    normalizeChlorine(chlorine),
    {
      id: 4,
      enabled: Boolean(purified.enabled),
      mode: 'manual',
      on: Boolean(purified.on),
      input_a: purifiedPin,
    },
  ];

  return {
    input_active_low: src.input_active_low !== false,
    description: String(src.description || '').trim().slice(0, 280),
    flows: normalizeFlows(src.flows),
    relays,
    pressure_alarms: normalizePressureAlarms(src.pressure_alarms),
  };
}

function hexColor(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : fallback;
}

function normalizePressureAlarms(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const sensorsIn = Array.isArray(src.sensors) ? src.sensors : [];
  const sensors = [1, 2, 3, 4].map((sensor) => {
    const found = sensorsIn.find((item) => Number(item?.sensor) === sensor) || {};
    let minPsi = clampNumber(found.min_psi, 20);
    let maxPsi = clampNumber(found.max_psi, 80);
    let margin = clampNumber(found.margin_psi, 5);
    if (minPsi < 0) minPsi = 0;
    if (minPsi > 200) minPsi = 200;
    if (maxPsi > 200) maxPsi = 200;
    if (maxPsi <= minPsi) maxPsi = Math.min(200, minPsi + 1);
    if (margin < 0) margin = 0;
    if (margin * 2 >= maxPsi - minPsi) margin = Math.max(0, (maxPsi - minPsi) / 2 - 0.1);
    const channel = ['portal', 'email', 'both'].includes(found.channel) ? found.channel : 'portal';
    return {
      sensor,
      enabled: Boolean(found.enabled),
      min_psi: Math.round(minPsi * 10) / 10,
      max_psi: Math.round(maxPsi * 10) / 10,
      margin_psi: Math.round(margin * 10) / 10,
      channel,
      email: String(found.email || '').trim().slice(0, 80),
    };
  });
  return {
    color_ok: hexColor(src.color_ok, '#059669'),
    color_warn: hexColor(src.color_warn, '#D97706'),
    color_alarm: hexColor(src.color_alarm, '#DC2626'),
    sensors,
  };
}

function normalizeFlush(relay) {
  const duration = Math.round(clampNumber(relay.duration_ms, 30000));
  const interval = Math.round(clampNumber(relay.interval_ms, FLUSH_EVERY_MS));
  if (duration < 1000 || duration > 3600000) fail('La duración del flush va de 1 a 3600 segundos');
  if (interval < 60000 || interval > 10080 * 60000) fail('El periodo del flush va de 1 minuto a 7 días');
  if (duration >= interval) fail('La duración del flush tiene que ser menor que el periodo');
  return {
    id: 2,
    enabled: Boolean(relay.enabled),
    mode: 'timer',
    duration_ms: duration,
    interval_ms: interval,
  };
}

function normalizeChlorine(relay) {
  let minLpm = clampNumber(relay.min_lpm, 0);
  if (minLpm < 0) minLpm = 0;
  if (minLpm > 10000) minLpm = 10000;
  let hyst = clampNumber(relay.hyst_lpm, 0);
  if (hyst < 0) hyst = 0;
  if (hyst > 1000) hyst = 1000;
  return {
    id: 3,
    enabled: Boolean(relay.enabled),
    mode: 'flow',
    meter: 1,
    min_lpm: minLpm,
    hyst_lpm: hyst,
  };
}

function inputPin(value, fallback) {
  const pin = Number(value);
  return INPUT_PINS.includes(pin) ? pin : fallback;
}

function normalizeFlows(input) {
  const source = Array.isArray(input) ? input : [];
  const flows = FLOW_SLOTS.map((slot, index) => {
    const flow = source[index] && typeof source[index] === 'object' ? source[index] : {};
    let name = String(flow.name || '').trim().slice(0, 15);
    if (!name || /^Medidor \d+$/.test(name)) name = slot.name;

    let origin = index < 2 ? 'pin' : 'platform';
    if (flow.origin === 'pin' || flow.origin === 'platform') origin = flow.origin;
    else if (flow.device_code || flow.deviceCode) origin = 'platform';
    else if (flow.pin != null) origin = 'pin';

    if (origin === 'pin') {
      const pin = Number(flow.pin);
      if (!FLOW_PINS.includes(pin)) {
        fail(`Flujo ${index + 1} (${slot.name}): elige GPIO 4 o GPIO 19`);
      }
      let liters = clampNumber(flow.liters_per_pulse, 1 / 330);
      if (liters <= 0 || liters > 100) liters = 0.1;
      return {
        name,
        origin: 'pin',
        role: slot.role,
        pin,
        liters_per_pulse: liters,
      };
    }

    const deviceCode = String(flow.device_code || flow.deviceCode || '').trim().slice(0, 64);
    if (!deviceCode && !slot.optionalDevice) {
      fail(`Flujo ${index + 1} (${slot.name}): elige el equipo en Medidores`);
    }
    return {
      name,
      origin: 'platform',
      role: slot.role,
      ...(deviceCode ? { device_code: deviceCode } : {}),
    };
  });

  const pins = flows.filter((flow) => flow.origin === 'pin').map((flow) => flow.pin);
  if (new Set(pins).size !== pins.length) {
    fail('GPIO 4 y GPIO 19 no se pueden repetir entre flujos');
  }
  return flows;
}

export function countEnabledRules(rules) {
  if (!rules || !Array.isArray(rules.relays)) return 0;
  return rules.relays.filter((relay) => relay && relay.enabled).length;
}
