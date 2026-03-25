import UserModel from '../models/postgres/user.model.js';

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

