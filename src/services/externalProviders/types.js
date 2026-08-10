/**
 * Shared constants / shapes for external meter providers (agnostic layer).
 */

export const EXTERNAL_SOURCE_PREFIX = 'external:';

export function externalSourceTag(providerId) {
  return `${EXTERNAL_SOURCE_PREFIX}${providerId}`;
}

/** Default resourceType so V2 dashboard filters keep working. */
export const DEFAULT_EXTERNAL_RESOURCE_TYPE = 'tiwater';

/**
 * @typedef {Object} NormalizedMetric
 * @property {string} name
 * @property {string} type
 * @property {number|null} value
 * @property {string} [unit]
 */

/**
 * @typedef {Object} NormalizedReading
 * @property {string} provider
 * @property {string} externalDeviceId
 * @property {string} [imei]
 * @property {Date} observedAt
 * @property {string} idempotencyKey
 * @property {NormalizedMetric[]} metrics
 * @property {Record<string, number|boolean|string>} [alarms]
 * @property {object} [raw]
 */

export class ExternalProviderValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ExternalProviderValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

export class ExternalProviderAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ExternalProviderAuthError';
    this.statusCode = 401;
  }
}

export class ExternalProviderUnmappedError extends Error {
  constructor(provider, externalDeviceId) {
    super(`No active binding for ${provider}:${externalDeviceId}`);
    this.name = 'ExternalProviderUnmappedError';
    this.provider = provider;
    this.externalDeviceId = externalDeviceId;
    this.statusCode = 202; // accepted but not persisted to a store
  }
}
