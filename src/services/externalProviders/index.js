/**
 * Registry of external meter / telemetry providers.
 */

import linghuProvider from './providers/linghu/linghu.provider.js';

const providers = new Map();

function register(provider) {
  if (!provider?.id) throw new Error('Provider must have an id');
  providers.set(provider.id, provider);
}

register(linghuProvider);

export function getProvider(providerId) {
  const id = String(providerId || '').toLowerCase().trim();
  return providers.get(id) || null;
}

export function listProviders() {
  return [...providers.values()].map((p) => ({
    id: p.id,
    displayName: p.displayName,
  }));
}

export function requireProvider(providerId) {
  const p = getProvider(providerId);
  if (!p) {
    const err = new Error(`Unknown external provider: ${providerId}`);
    err.statusCode = 404;
    throw err;
  }
  return p;
}

export default { getProvider, listProviders, requireProvider };
