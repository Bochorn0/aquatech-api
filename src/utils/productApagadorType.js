/**
 * Infer "Apagador" (Tuya smart switch) from status codes so API matches dashboard behavior.
 * Does not override explicit types we treat as non-switch (Nivel, etc.).
 */

const KEEP_TYPES = new Set(['nivel', 'metrica', 'pressure', 'tiwater']);

export function statusHasSwitch1(status) {
  return Array.isArray(status) && status.some((s) => s && s.code === 'switch_1');
}

/**
 * @param {string|undefined|null} productType
 * @param {Array|undefined|null} status
 * @returns {string}
 */
export function inferApagadorProductType(productType, status) {
  const t = String(productType ?? '').trim().toLowerCase();
  if (t === 'apagador') return 'Apagador';
  if (!statusHasSwitch1(status)) return (productType && String(productType).trim()) || 'Osmosis';
  if (KEEP_TYPES.has(t)) return (productType && String(productType).trim()) || 'Osmosis';
  return 'Apagador';
}

/**
 * Shallow clone with product_type inferred from status when applicable.
 * @param {object} product
 * @returns {object}
 */
export function withInferredApagadorProductType(product) {
  if (!product || typeof product !== 'object') return product;
  const inferred = inferApagadorProductType(product.product_type, product.status);
  if (inferred === product.product_type) return product;
  return { ...product, product_type: inferred };
}
