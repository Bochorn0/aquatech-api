// Helpers + defaults for per-product Tuya logs routine config
// Stored on products.tuya_logs_routine_config JSONB

/** Default per product_type when product has no custom config. */
export const DEFAULT_PRODUCT_LOGS_ROUTINE_BY_TYPE = {
  Osmosis: {
    enabled_fields: {
      flowrate_total_1: { enabled: true, db_column: 'production_volume', scale: 0.1 },
      flowrate_total_2: { enabled: true, db_column: 'rejected_volume', scale: 0.1 },
      flowrate_speed_1: { enabled: true, db_column: 'flujo_produccion', scale: 1 },
      flowrate_speed_2: { enabled: true, db_column: 'flujo_rechazo', scale: 1 },
      tds_out: { enabled: false, db_column: 'tds', scale: 1 },
    },
    custom_rules: [],
  },
  Nivel: {
    enabled_fields: {
      liquid_depth: { enabled: true, db_column: 'flujo_produccion', scale: 1 },
      liquid_level_percent: { enabled: true, db_column: 'flujo_rechazo', scale: 1 },
    },
    custom_rules: [],
  },
};

/** @deprecated use DEFAULT_PRODUCT_LOGS_ROUTINE_BY_TYPE — kept for older imports */
export const DEFAULT_TUYA_LOGS_ROUTINE_CONFIG = DEFAULT_PRODUCT_LOGS_ROUTINE_BY_TYPE;

const ALLOWED_DB_COLUMNS = new Set([
  'tds',
  'production_volume',
  'rejected_volume',
  'temperature',
  'flujo_produccion',
  'flujo_rechazo',
  'campo_personalizado_1',
  'campo_personalizado_2',
]);

/** Custom rules may only write to these two product_logs columns. */
export const CUSTOM_FIELD_COLUMNS = ['campo_personalizado_1', 'campo_personalizado_2'];
export const MAX_CUSTOM_RULES = 2;

class TuyaLogsRoutineConfigModel {
  static parseRaw(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  }

  static getDefaultForProductType(productType) {
    const key = productType || 'Osmosis';
    const def =
      DEFAULT_PRODUCT_LOGS_ROUTINE_BY_TYPE[key] ||
      DEFAULT_PRODUCT_LOGS_ROUTINE_BY_TYPE.Osmosis;
    return JSON.parse(JSON.stringify(def));
  }

  /**
   * Resolve effective config for a product row.
   * Accepts either per-product shape {enabled_fields, custom_rules}
   * or legacy global-by-type shape { Osmosis: {...}, Nivel: {...} }.
   */
  static resolveForProduct(product) {
    const productType = product?.product_type || 'Osmosis';
    const raw = this.parseRaw(product?.tuya_logs_routine_config);
    if (!raw || typeof raw !== 'object') {
      return this.getDefaultForProductType(productType);
    }
    // Legacy global shape keyed by product type
    if (raw.enabled_fields == null && (raw.Osmosis || raw.Nivel)) {
      const typed = raw[productType] || raw.Osmosis;
      if (typed?.enabled_fields) {
        return this.sanitizeProductConfig(typed, productType);
      }
    }
    return this.sanitizeProductConfig(raw, productType);
  }

  /** Sanitize a single product config object. */
  static sanitizeProductConfig(config, productType = 'Osmosis') {
    const fallback = this.getDefaultForProductType(productType);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return fallback;
    }

    const enabledFields = {};
    const rawFields = {
      ...(fallback.enabled_fields || {}),
      ...(config.enabled_fields || {}),
    };
    for (const [code, fieldCfg] of Object.entries(rawFields)) {
      if (!code || typeof code !== 'string') continue;
      const enabled = Boolean(fieldCfg?.enabled);
      const dbColumn = ALLOWED_DB_COLUMNS.has(fieldCfg?.db_column)
        ? fieldCfg.db_column
        : null;
      const scale =
        fieldCfg?.scale != null && Number.isFinite(Number(fieldCfg.scale))
          ? Number(fieldCfg.scale)
          : 1;
      enabledFields[code] = { enabled, db_column: dbColumn, scale };
    }
    if (Object.keys(enabledFields).length === 0) {
      Object.assign(enabledFields, fallback.enabled_fields);
    }

    const customRules = Array.isArray(config.custom_rules)
      ? config.custom_rules
          .filter((r) => r && typeof r === 'object' && r.name)
          .slice(0, MAX_CUSTOM_RULES)
          .map((r, idx) => {
            const preferred =
              r.db_column === 'campo_personalizado_1' || r.db_column === 'campo_personalizado_2'
                ? r.db_column
                : CUSTOM_FIELD_COLUMNS[idx];
            return {
              id: String(r.id || `${r.name}_${Date.now()}`),
              name: String(r.name).trim().slice(0, 120),
              enabled: r.enabled !== false,
              op:
                r.op === 'subtract' || r.op === 'add' || r.op === 'multiply' || r.op === 'divide'
                  ? r.op
                  : 'subtract',
              left: {
                source: r.left?.source === 'previous_hour' ? 'previous_hour' : 'current',
                code: String(r.left?.code || ''),
              },
              right: {
                source: r.right?.source === 'previous_hour' ? 'previous_hour' : 'current',
                code: String(r.right?.code || ''),
              },
              scale: r.scale != null && Number.isFinite(Number(r.scale)) ? Number(r.scale) : 1,
              store_as: String(r.store_as || r.name).trim().slice(0, 120),
              /** Always one of the two dedicated custom columns */
              db_column: preferred,
            };
          })
          .filter((r) => r.left.code && r.right.code)
      : [];

    // Ensure unique db_column slots (1 then 2) when duplicates sneak in
    const used = new Set();
    for (const rule of customRules) {
      if (used.has(rule.db_column)) {
        rule.db_column =
          CUSTOM_FIELD_COLUMNS.find((c) => !used.has(c)) || rule.db_column;
      }
      used.add(rule.db_column);
    }

    return { enabled_fields: enabledFields, custom_rules: customRules };
  }

  /** @deprecated alias — prefer sanitizeProductConfig */
  static sanitizeConfig(config) {
    return this.sanitizeProductConfig(config);
  }

  static getEnabledCodes(productConfig) {
    const fields = productConfig?.enabled_fields || {};
    return Object.entries(fields)
      .filter(([, cfg]) => cfg?.enabled)
      .map(([code]) => code);
  }

  static getFieldMapping(productConfig) {
    return productConfig?.enabled_fields || {};
  }

  static getCustomRules(productConfig) {
    return (productConfig?.custom_rules || []).filter((r) => r.enabled !== false);
  }
}

export default TuyaLogsRoutineConfigModel;
