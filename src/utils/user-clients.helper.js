import UserModel from '../models/postgres/user.model.js';
import RoleModel from '../models/postgres/role.model.js';

export async function getAllowedClientIdsForRequest(req) {
  const userId = req?.user?.id;
  if (!userId) return [];
  const user = await UserModel.findById(userId);
  if (!user) return [];
  const ids = Array.isArray(user.client_ids) ? user.client_ids : [];
  const normalized = ids
    .map((id) => parseInt(String(id), 10))
    .filter((id) => !isNaN(id));
  return [...new Set(normalized)];
}

/** True when the user is restricted to an explicit list of client IDs (non-empty). Empty list = no restriction (e.g. full access). */
export function isAllowedClientsRestriction(allowedClientIds) {
  return Array.isArray(allowedClientIds) && allowedClientIds.length > 0;
}

function clientNameIsAll(name) {
  return String(name ?? '').trim().toLowerCase() === 'all';
}

/**
 * Single load for product routes: assigned client IDs, admin flag, and whether "All" is in the user's client whitelist
 * (same effect as admin for product listing/editing: no client scoping).
 */
export async function getProductAccessContext(req) {
  const userId = req?.user?.id;
  if (!userId) {
    return { allowedClientIds: [], isAdmin: false, hasAllClientsWhitelist: false };
  }
  const user = await UserModel.findById(userId);
  if (!user) {
    return { allowedClientIds: [], isAdmin: false, hasAllClientsWhitelist: false };
  }
  const role =
    req?.user?.role != null ? await RoleModel.findById(req.user.role) : null;
  const isAdmin = role != null && String(role.name).toLowerCase() === 'admin';
  const ids = Array.isArray(user.client_ids) ? user.client_ids : [];
  const allowedClientIds = [
    ...new Set(
      ids
        .map((id) => parseInt(String(id), 10))
        .filter((id) => !isNaN(id))
    ),
  ];
  const clients = Array.isArray(user.clients) ? user.clients : [];
  const names = Array.isArray(user.client_names) ? user.client_names : [];
  const hasAllClientsWhitelist =
    clients.some((c) => clientNameIsAll(c?.name)) ||
    names.some((n) => clientNameIsAll(n));
  return { allowedClientIds, isAdmin, hasAllClientsWhitelist };
}

/** True when the user must be limited to assigned clients only (not admin, not "All" whitelist, and at least one assigned client). */
export function isClientScopedProductAccess(ctx) {
  if (!ctx) return false;
  if (ctx.isAdmin || ctx.hasAllClientsWhitelist) return false;
  return isAllowedClientsRestriction(ctx.allowedClientIds);
}

/** Resolve products.client_id / cliente from a product row (number, string, or populated object). */
export function normalizeClientIdFromProduct(product) {
  if (!product) return null;
  const c = product.client_id ?? product.cliente;
  if (c != null && typeof c === 'object') {
    const v = c._id ?? c.id;
    if (v == null || v === '') return null;
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
  }
  if (c == null || c === '') return null;
  const n = parseInt(String(c), 10);
  return Number.isNaN(n) ? null : n;
}

/** Parse cliente from request body (id, _id, or numeric string). Undefined = field omitted. */
export function parseClientIdFromBody(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'object') {
    const v = value.id != null ? value.id : value._id;
    if (v == null || v === '') return null;
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
  }
  const s = String(value).trim();
  if (s === '') return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/** Whether clientId is allowed for a restricted user. Unrestricted (empty allowed list) => always true. */
export function clientIdInAllowedList(clientId, allowedClientIds) {
  if (!isAllowedClientsRestriction(allowedClientIds)) return true;
  if (clientId == null) return false;
  const n = parseInt(String(clientId), 10);
  if (Number.isNaN(n)) return false;
  return allowedClientIds.includes(n);
}

