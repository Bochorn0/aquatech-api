const RELAY_MODES = {
  1: 'manual',
  2: 'and_inputs',
  3: 'timer',
  4: 'flow',
  5: 'pressure',
  6: 'pressure',
};

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function clampNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Deja las reglas en la forma que aplica el firmware del controlador hidráulico.
 * El modo de cada relevador queda fijo: el portal solo cambia habilitación y parámetros.
 */
export function normalizeControllerRules(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const byId = new Map();
  if (Array.isArray(src.relays)) {
    for (const relay of src.relays) {
      const id = Number(relay?.id);
      if (id >= 1 && id <= 6) byId.set(id, relay);
    }
  }

  const relays = [];
  for (let id = 1; id <= 6; id += 1) {
    const relay = byId.get(id) || {};
    const mode = RELAY_MODES[id];
    const enabled = Boolean(relay.enabled);
    const rule = { id, enabled, mode };

    if (mode === 'manual') {
      rule.on = Boolean(relay.on);
    }

    if (mode === 'timer') {
      let duration = Math.round(clampNumber(relay.duration_ms, 30000));
      let interval = Math.round(clampNumber(relay.interval_ms, 4 * 60 * 60 * 1000));
      if (duration < 5000) duration = 5000;
      if (duration > 180000) duration = 180000;
      if (interval < 60 * 60 * 1000) interval = 60 * 60 * 1000;
      if (interval < duration * 2) interval = duration * 2;
      rule.duration_ms = duration;
      rule.interval_ms = interval;
    }

    if (mode === 'flow') {
      const meter = Number(relay.meter) === 1 ? 1 : 0;
      let minLpm = clampNumber(relay.min_lpm, 0);
      if (minLpm < 0) minLpm = 0;
      if (minLpm > 10000) minLpm = 10000;
      rule.meter = meter;
      rule.min_lpm = minLpm;
    }

    if (mode === 'pressure') {
      const sensors = Array.isArray(relay.sensors)
        ? [...new Set(relay.sensors.map(Number).filter((n) => n >= 0 && n <= 3))]
        : [];
      const minPsi = clampNumber(relay.min_psi, 0);
      const maxPsi = clampNumber(relay.max_psi, 60);
      if (minPsi < 0 || maxPsi > 200 || minPsi >= maxPsi) {
        fail(`Relevador ${id}: la presión mínima tiene que ser menor que la máxima, entre 0 y 200 psi`);
      }
      if (enabled && sensors.length === 0) {
        fail(`Relevador ${id}: elige al menos un sensor de presión`);
      }
      rule.sensors = sensors;
      rule.min_psi = minPsi;
      rule.max_psi = maxPsi;
    }

    relays.push(rule);
  }

  const flows = normalizeFlows(src.flows);

  return {
    input_active_low: src.input_active_low !== false,
    flows,
    relays,
  };
}

const FLOW_PINS = [4, 5, 15, 18, 19, 21, 22, 23];

function normalizeFlows(input) {
  const source = Array.isArray(input) ? input : [];
  const flows = [0, 1].map((index) => {
    const flow = source[index] && typeof source[index] === 'object' ? source[index] : {};
    const name = String(flow.name || '').trim().slice(0, 15);
    const origin = flow.origin === 'pin' || (flow.pin != null && flow.origin !== 'platform')
      ? 'pin'
      : 'platform';

    if (origin === 'pin') {
      const pin = Number(flow.pin);
      if (!FLOW_PINS.includes(pin)) {
        fail(`Medidor ${index + 1}: elige un pin disponible (${FLOW_PINS.join(', ')})`);
      }
      let liters = clampNumber(flow.liters_per_pulse, 0.1);
      if (liters <= 0 || liters > 100) liters = 0.1;
      return {
        name: name || `GPIO ${pin}`,
        origin: 'pin',
        pin,
        liters_per_pulse: liters,
      };
    }

    const deviceCode = String(flow.device_code || flow.deviceCode || '').trim().slice(0, 64);
    if (!deviceCode) fail(`Medidor ${index + 1}: elige el equipo en Medidores`);
    return {
      name: name || deviceCode.slice(0, 15),
      origin: 'platform',
      device_code: deviceCode,
    };
  });

  const pins = flows.filter((flow) => flow.origin === 'pin').map((flow) => flow.pin);
  if (new Set(pins).size !== pins.length) {
    fail('Los dos medidores físicos no pueden usar el mismo pin');
  }
  return flows;
}

export function countEnabledRules(rules) {
  if (!rules || !Array.isArray(rules.relays)) return 0;
  return rules.relays.filter((relay) => relay && relay.enabled).length;
}
