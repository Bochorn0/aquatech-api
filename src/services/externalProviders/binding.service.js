/**
 * Resolve external device → tienda binding.
 */

import DeviceBindingModel from '../../models/postgres/deviceBinding.model.js';
import { ExternalProviderUnmappedError } from './types.js';

/**
 * @param {string} provider
 * @param {{ externalDeviceId: string, imei?: string }} reading
 */
export async function resolveBinding(provider, reading) {
  let binding = await DeviceBindingModel.findActiveByExternalId(
    provider,
    reading.externalDeviceId
  );

  if (!binding && reading.imei) {
    binding = await DeviceBindingModel.findActiveByImei(provider, reading.imei);
  }

  if (!binding) {
    throw new ExternalProviderUnmappedError(provider, reading.externalDeviceId);
  }

  return binding;
}

export async function upsertBinding(data) {
  return DeviceBindingModel.upsert(data);
}

export default { resolveBinding, upsertBinding };
