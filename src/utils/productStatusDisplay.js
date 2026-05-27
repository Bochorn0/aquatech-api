/** Same list as product.controller.js — special Tuya devices use ×1.6 then ÷10 on totals. */
export const PRODUCTOS_ESPECIALES = ['ebf9738480d78e0132gnru', 'ebea4ffa2ab1483940nrqn'];

export function extractStatusValue(status, code) {
  const list = Array.isArray(status) ? status : [];
  return list.find((s) => s && s.code === code)?.value;
}

/**
 * Display liters for flowrate_total_* (÷10; special products ×1.6 then ÷10 on totals).
 */
export function applyDisplayConversionsToStatus(status, tuyaDetailId) {
  const out = Array.isArray(status) ? JSON.parse(JSON.stringify(status)) : [];
  if (!Array.isArray(out)) return [];

  const isSpecial = PRODUCTOS_ESPECIALES.includes(String(tuyaDetailId || ''));
  const flujos_total_codes = ['flowrate_total_1', 'flowrate_total_2'];
  if (isSpecial) {
    const flujos_codes = ['flowrate_speed_1', 'flowrate_speed_2', 'flowrate_total_1', 'flowrate_total_2'];
    out.forEach((stat) => {
      if (flujos_codes.includes(stat.code)) {
        stat.value = (Number(stat.value) * 1.6).toFixed(2);
      }
      if (flujos_total_codes.includes(stat.code)) {
        stat.value = (Number(stat.value) / 10).toFixed(2);
      }
    });
    return out;
  }

  return out.map((stat) => {
    if (flujos_total_codes.includes(stat.code)) {
      stat.value = (Number(stat.value) / 10).toFixed(2);
    }
    return stat;
  });
}

export function flowVolumesLitersFromStatus(status, tuyaDetailId) {
  const converted = applyDisplayConversionsToStatus(status, tuyaDetailId);
  const prod = Number(extractStatusValue(converted, 'flowrate_total_1'));
  const rej = Number(extractStatusValue(converted, 'flowrate_total_2'));
  const hasProd = Number.isFinite(prod);
  const hasRej = Number.isFinite(rej);
  if (!hasProd && !hasRej) return { production_liters: null, rejection_liters: null };
  return {
    production_liters: hasProd ? prod : null,
    rejection_liters: hasRej ? rej : null,
  };
}

export function sumVolumeLiterFields(a, b) {
  const prod =
    (a?.production_liters != null ? Number(a.production_liters) : 0) +
    (b?.production_liters != null ? Number(b.production_liters) : 0);
  const rej =
    (a?.rejection_liters != null ? Number(a.rejection_liters) : 0) +
    (b?.rejection_liters != null ? Number(b.rejection_liters) : 0);
  return {
    production_liters: Math.round(prod * 100) / 100,
    rejection_liters: Math.round(rej * 100) / 100,
  };
}
