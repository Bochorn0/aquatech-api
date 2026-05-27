import ProductModel from '../models/postgres/product.model.js';
import ProductLogModel from '../models/postgres/productLog.model.js';
import { getClient } from '../config/postgres.config.js';
import { validateMergeDuplicateIds } from '../utils/productMerge.validation.js';
import {
  flowVolumesLitersFromStatus,
  sumVolumeLiterFields,
} from '../utils/productStatusDisplay.js';
import * as tuyaService from '../services/tuya.service.js';

export { validateMergeDuplicateIds };

async function loadMergeContext(oldDeviceId, newDeviceId) {
  const validation = validateMergeDuplicateIds(oldDeviceId, newDeviceId);
  if (!validation.ok) {
    return { validation, errors: validation.errors };
  }

  const errors = [];
  const { oldDeviceId: oldId, newDeviceId: newId } = validation;

  const oldRow = await ProductModel.findByExactDeviceId(oldId);
  const newRow = await ProductModel.findByExactDeviceId(newId);

  if (!oldRow) errors.push(`Equipo viejo no encontrado: ${oldId}`);
  if (!newRow) errors.push(`Equipo nuevo no encontrado: ${newId}`);

  if (oldRow && newRow) {
    const newMerged = Array.isArray(newRow.merged_from_device_ids)
      ? newRow.merged_from_device_ids.map(String)
      : [];
    if (newMerged.includes(oldId)) {
      errors.push('El equipo viejo ya está listado en merged_from_device_ids del equipo nuevo.');
    }

    const superseded = await ProductModel.getSupersededDeviceIdSet();
    if (superseded.has(oldId)) {
      const canonical = await ProductModel.findByDeviceId(oldId);
      const canonicalId = canonical ? String(canonical.device_id ?? canonical.id ?? '') : '';
      if (canonicalId && canonicalId !== newId && !canonicalId.startsWith('_')) {
        errors.push(`El equipo viejo ya fue absorbido por otro canónico (${canonicalId}).`);
      }
    }
  }

  return {
    validation,
    errors,
    oldRow,
    newRow,
    oldId,
    newId,
  };
}

async function countPuntoventaMetaRefs(oldDeviceId, oldPk) {
  const client = await getClient();
  try {
    const patterns = [`%${oldDeviceId}%`];
    if (oldPk != null) patterns.push(`%${String(oldPk)}%`);
    const result = await client.query(
      `SELECT id, name, code, codigo_tienda, meta
       FROM puntoventa_v1
       WHERE meta IS NOT NULL
         AND (meta::text LIKE $1${oldPk != null ? ' OR meta::text LIKE $2' : ''})`,
      patterns
    );
    const rows = result.rows || [];
    const warnings = [];
    if (oldPk != null) {
      const numericHits = rows.filter((r) => {
        const text = JSON.stringify(r.meta ?? {});
        return new RegExp(`(^|[^0-9])${oldPk}([^0-9]|$)`).test(text);
      });
      if (numericHits.length > 0) {
        warnings.push(
          `${numericHits.length} punto(s) de venta referencian el id numérico Postgres (${oldPk}) en meta; revise manualmente si product_ids usa ids numéricos.`
        );
      }
    }
    return {
      count: rows.length,
      puntos: rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code || r.codigo_tienda,
      })),
      warnings,
    };
  } finally {
    client.release();
  }
}

async function volumesFromLogsFallback(deviceId, postgresId) {
  const ids = [String(deviceId)];
  if (postgresId != null) ids.push(String(postgresId));
  const byDevice = await ProductLogModel.getMaxVolumesByDeviceIds(ids);
  let prod = 0;
  let rej = 0;
  for (const id of ids) {
    const row = byDevice.get(id);
    if (!row) continue;
    prod = Math.max(prod, Number(row.production_volume) || 0);
    rej = Math.max(rej, Number(row.rejected_volume) || 0);
  }
  if (prod <= 0 && rej <= 0) {
    return { production_liters: null, rejection_liters: null, source: 'none' };
  }
  return {
    production_liters: Math.round(prod * 100) / 100,
    rejection_liters: Math.round(rej * 100) / 100,
    source: 'product_logs_max',
  };
}

function volumesFromStoredStatus(row, deviceId) {
  const status = row?.status;
  const vol = flowVolumesLitersFromStatus(status, deviceId);
  const hasAny = vol.production_liters != null || vol.rejection_liters != null;
  if (!hasAny) return null;
  return { ...vol, source: 'products.status' };
}

async function resolveProductVolumes(row, deviceId, { preferTuyaLive = false } = {}) {
  const empty = { production_liters: null, rejection_liters: null, source: 'none' };
  const fromStatus = volumesFromStoredStatus(row, deviceId);
  let live = null;
  if (preferTuyaLive) {
    try {
      const tuya = await tuyaService.getDeviceDetail(deviceId);
      if (tuya?.success && Array.isArray(tuya?.data?.status)) {
        const vol = flowVolumesLitersFromStatus(tuya.data.status, deviceId);
        if (vol.production_liters != null || vol.rejection_liters != null) {
          live = { ...vol, source: 'tuya_live' };
        }
      }
    } catch (_) {
      // Tuya optional for preview
    }
  }
  let fromLogs = empty;
  try {
    fromLogs = await volumesFromLogsFallback(deviceId, row?._id ?? row?.id);
  } catch (_) {
    fromLogs = empty;
  }
  const primary = live || fromStatus || fromLogs || empty;
  return {
    production_liters: primary.production_liters ?? null,
    rejection_liters: primary.rejection_liters ?? null,
    source: primary.source ?? 'none',
    stored_db: fromStatus,
    tuya_live: live,
    logs_max: fromLogs.source === 'product_logs_max' ? fromLogs : null,
  };
}

/**
 * Read-only preview for admin merge UI.
 */
export async function buildMergeDuplicatePreview(oldDeviceId, newDeviceId) {
  const ctx = await loadMergeContext(oldDeviceId, newDeviceId);
  if (ctx.errors?.length) {
    return { ok: false, errors: ctx.errors };
  }

  const { oldRow, newRow, oldId, newId } = ctx;
  const oldPk = oldRow._id != null ? oldRow._id : oldRow.id;

  const [oldLogsCount, newLogsCount, puntoventaRefs, oldVolumes, newVolumes] = await Promise.all([
    ProductLogModel.count({ product_id: oldId }),
    ProductLogModel.count({ product_id: newId }),
    countPuntoventaMetaRefs(oldId, oldPk),
    resolveProductVolumes(oldRow, oldId, { preferTuyaLive: false }),
    resolveProductVolumes(newRow, newId, { preferTuyaLive: true }),
  ]);

  const newMerged = Array.isArray(newRow.merged_from_device_ids)
    ? newRow.merged_from_device_ids.map(String)
    : [];

  const oldForSum = {
    production_liters: oldVolumes.production_liters,
    rejection_liters: oldVolumes.rejection_liters,
  };
  const newForSum = {
    production_liters: newVolumes.production_liters,
    rejection_liters: newVolumes.rejection_liters,
  };
  const expected_after_merge = sumVolumeLiterFields(oldForSum, newForSum);

  return {
    ok: true,
    oldDeviceId: oldId,
    newDeviceId: newId,
    old: {
      device_id: oldId,
      name: oldRow.name,
      postgres_id: oldPk,
      product_logs_count: oldLogsCount,
      production_liters: oldVolumes.production_liters,
      rejection_liters: oldVolumes.rejection_liters,
      volume_source: oldVolumes.source,
    },
    new: {
      device_id: newId,
      name: newRow.name,
      postgres_id: newRow._id != null ? newRow._id : newRow.id,
      product_logs_count: newLogsCount,
      merged_from_device_ids: newMerged,
      production_liters: newVolumes.production_liters,
      rejection_liters: newVolumes.rejection_liters,
      volume_source: newVolumes.source,
      stored_db: newVolumes.stored_db,
      tuya_live: newVolumes.tuya_live,
    },
    expected_after_merge,
    puntoventa_affected_count: puntoventaRefs.count,
    puntoventa_samples: puntoventaRefs.puntos.slice(0, 5),
    warnings: puntoventaRefs.warnings,
    summary: {
      product_logs_to_repoint: oldLogsCount,
      old_row_will_be_deleted: true,
      merged_from_will_include: [...new Set([...newMerged, oldId])],
      expected_production_liters: expected_after_merge.production_liters,
      expected_rejection_liters: expected_after_merge.rejection_liters,
    },
  };
}

/**
 * Merge duplicate Tuya products: repoint logs, update puntoventa meta, append merged_from, delete OLD row.
 */
export async function executeMergeDuplicateProducts(oldDeviceId, newDeviceId) {
  const preview = await buildMergeDuplicatePreview(oldDeviceId, newDeviceId);
  if (!preview.ok) {
    return { ok: false, errors: preview.errors };
  }

  const oldId = String(preview.oldDeviceId || '');
  const newId = String(preview.newDeviceId || '');
  const oldPk = preview.old.postgres_id;
  const newPk = preview.new.postgres_id;
  const mergedFrom = preview.summary.merged_from_will_include;
  if (!oldId || !newId || !oldPk || !newPk) {
    return {
      ok: false,
      errors: ['No se pudo resolver old/new ids para fusionar. Vuelve a previsualizar e intenta de nuevo.'],
    };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const logsResult = await client.query(
      `UPDATE product_logs
       SET product_id = $1,
           product_device_id = $2,
           updatedat = CURRENT_TIMESTAMP
       WHERE product_id = $3
          OR product_device_id = $4
          OR product_device_id = $5`,
      [newPk, newId, oldPk, oldId, `_${oldId}`]
    );

    const pvResult = await client.query(
      `UPDATE puntoventa_v1
       SET meta = replace(meta::text, $1, $2)::jsonb,
           updatedat = CURRENT_TIMESTAMP
       WHERE meta IS NOT NULL
         AND meta::text LIKE $3`,
      [oldId, newId, `%${oldId}%`]
    );

    await client.query(
      `UPDATE products
       SET merged_from_device_ids = $1::jsonb,
           updatedat = CURRENT_TIMESTAMP
       WHERE device_id = $2`,
      [JSON.stringify(mergedFrom), newId]
    );

    const deleteResult = await client.query(`DELETE FROM products WHERE device_id = $1`, [oldId]);

    await client.query('COMMIT');

    return {
      ok: true,
      oldDeviceId: oldId,
      newDeviceId: newId,
      product_logs_updated: logsResult.rowCount ?? 0,
      puntoventa_updated: pvResult.rowCount ?? 0,
      products_deleted: deleteResult.rowCount ?? 0,
      merged_from_device_ids: mergedFrom,
      warnings: preview.warnings,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
