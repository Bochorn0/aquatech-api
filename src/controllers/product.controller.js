import ProductModel from '../models/postgres/product.model.js';
import CityModel from '../models/postgres/city.model.js';
import UserModel from '../models/postgres/user.model.js';
import ClientModel from '../models/postgres/client.model.js';
import ControllerModel from '../models/postgres/controller.model.js';
import ProductLogModel from '../models/postgres/productLog.model.js';
import * as tuyaService from '../services/tuya.service.js';
import config from '../config/config.js';
import moment from 'moment';
import { devLog, devWarn } from '../utils/devLogger.js';
import { getClient } from '../config/postgres.config.js';

// IDs de productos tipo "Nivel"
const productos_nivel = [
  'ebe24cce942e6266b1wixy',
  'ebbe9512565e8a06a2ucnr',
  // Agregar más IDs de productos tipo Nivel aquí
];

const drives = ["Humalla", "Piaxtla", "Tierra Blanca", "Estadio", "Sarzana", "Buena vista", "Valle marquez", "Aeropuerto", "Navarrete", "Planta2", "Pinos", "Perisur"];

function getRawStatusValue(status, code) {
  return Number((status || []).find((s) => s.code === code)?.value) || 0;
}

function upsertRawStatusValue(status, code, value) {
  const out = Array.isArray(status) ? JSON.parse(JSON.stringify(status)) : [];
  const idx = out.findIndex((s) => s.code === code);
  if (idx >= 0) out[idx] = { ...out[idx], value };
  else out.push({ code, value });
  return out;
}

/** Add legacy baseline from merged rows stored in products table (raw 0.1L). */
async function mergeOsmosisTotalsWithProductTableBaseline(canonicalStatus, mergedFromDeviceIds) {
  if (!Array.isArray(mergedFromDeviceIds) || mergedFromDeviceIds.length === 0) {
    return canonicalStatus;
  }
  const mergedRows = await ProductModel.findManyByExactDeviceIds(mergedFromDeviceIds);
  const foundIds = new Set(mergedRows.map((p) => String(p.id)));
  const missingIds = mergedFromDeviceIds.filter((id) => !foundIds.has(String(id)));

  let baselineRawProd = mergedRows.reduce(
    (acc, p) => acc + getRawStatusValue(p.status, 'flowrate_total_1'),
    0
  );
  let baselineRawRej = mergedRows.reduce(
    (acc, p) => acc + getRawStatusValue(p.status, 'flowrate_total_2'),
    0
  );

  // If old merged rows were deleted from products table, fallback to product_logs max for those device ids.
  // product_logs stores liters, so convert to Tuya raw (0.1L) by *10 for display merge.
  if (missingIds.length > 0) {
    const expandedForLogs = [
      ...new Set(missingIds.flatMap((id) => [String(id), `_${String(id)}`])),
    ];
    const historicalByMergedDeviceId = await ProductLogModel.getMaxVolumesByDeviceIds(expandedForLogs);
    for (const mid of missingIds) {
      const a = historicalByMergedDeviceId.get(String(mid));
      const b = historicalByMergedDeviceId.get(`_${String(mid)}`);
      const prod = Math.max(Number(a?.production_volume) || 0, Number(b?.production_volume) || 0);
      const rej = Math.max(Number(a?.rejected_volume) || 0, Number(b?.rejected_volume) || 0);
      if (prod <= 0 && rej <= 0) continue;
      baselineRawProd += prod * 10;
      baselineRawRej += rej * 10;
    }
  }

  if (baselineRawProd <= 0 && baselineRawRej <= 0) return canonicalStatus;

  let mergedStatus = canonicalStatus;
  mergedStatus = upsertRawStatusValue(
    mergedStatus,
    'flowrate_total_1',
    getRawStatusValue(canonicalStatus, 'flowrate_total_1') + baselineRawProd
  );
  mergedStatus = upsertRawStatusValue(
    mergedStatus,
    'flowrate_total_2',
    getRawStatusValue(canonicalStatus, 'flowrate_total_2') + baselineRawRej
  );
  return mergedStatus;
}

async function mergeOsmosisTotalsSafe(canonicalStatus, mergedFromDeviceIds, context = 'unknown') {
  try {
    return await mergeOsmosisTotalsWithProductTableBaseline(canonicalStatus, mergedFromDeviceIds);
  } catch (err) {
    devWarn(`[mergeOsmosisTotalsSafe] ${context}: ${err.message}`);
    return canonicalStatus;
  }
}

/**
 * Live row (ebdd) is listed without the _ebdd row when both exist. Add stored totals from the locked
 * canonical row (same Tuya raw 0.1L units as mergeOsmosisTotals baseline).
 */
function addLockedCanonicalFlowTotalsToStatus(status, liveDeviceId, dbProductsList) {
  const lid = String(liveDeviceId || '');
  if (!lid || lid.startsWith('_')) return status;
  const locked = (dbProductsList || []).find(
    (p) =>
      p &&
      String(p.id ?? p.device_id ?? '').startsWith('_') &&
      Array.isArray(p.merged_from_device_ids) &&
      p.merged_from_device_ids.length === 1 &&
      String(p.merged_from_device_ids[0]) === lid
  );
  if (!locked) return status;
  const add1 = getRawStatusValue(locked.status, 'flowrate_total_1');
  const add2 = getRawStatusValue(locked.status, 'flowrate_total_2');
  if (add1 <= 0 && add2 <= 0) return status;
  let out = upsertRawStatusValue(
    status,
    'flowrate_total_1',
    getRawStatusValue(status, 'flowrate_total_1') + add1
  );
  out = upsertRawStatusValue(
    out,
    'flowrate_total_2',
    getRawStatusValue(out, 'flowrate_total_2') + add2
  );
  return out;
}

/** When dbProductsList is empty, loads the locked `_…` row from DB (detail endpoint has no full list). */
async function ensureLockedCanonicalFlowTotalsMerged(status, liveDeviceId, dbProductsList) {
  const lid = String(liveDeviceId || '');
  if (!lid || lid.startsWith('_')) return status;
  let list = dbProductsList;
  if (!Array.isArray(list) || list.length === 0) {
    const locked = await ProductModel.findLockedCanonicalForLiveDeviceId(lid);
    list = locked ? [locked] : [];
  }
  return addLockedCanonicalFlowTotalsToStatus(status, lid, list);
}

function anyMergedDeviceOnline(canonicalTuya, mergedFromDeviceIds, allTuyaData) {
  if (canonicalTuya?.online) return true;
  for (const mid of mergedFromDeviceIds || []) {
    const p = (allTuyaData || []).find((t) => t && String(t.id) === String(mid));
    if (p?.online) return true;
  }
  return false;
}

/** Tuya API uses the physical device id; after a lock the DB row id is `_` + id with live id in merged_from_device_ids. */
function resolveTuyaLiveDeviceIdForTuyaApi(product) {
  if (!product) return null;
  const did = String(product.id ?? product.device_id ?? '');
  const merged = Array.isArray(product.merged_from_device_ids) ? product.merged_from_device_ids : [];
  if (did.startsWith('_') && merged.length > 0) return String(merged[0]);
  return did || null;
}

function collectProductLogDeviceIds(routeOrCanonicalId, product) {
  const ids = new Set();
  if (routeOrCanonicalId != null && String(routeOrCanonicalId)) ids.add(String(routeOrCanonicalId));
  if (product) {
    const pid = String(product.id ?? '');
    if (pid) ids.add(pid);
    const live = resolveTuyaLiveDeviceIdForTuyaApi(product);
    if (live) ids.add(live);
  }
  return [...ids];
}

export const getAllProducts = async (req, res) => {
  try {
    const user = req.user;
    const query = req.query;
    const tuyaUserIds = config.TUYA_USER_IDS?.length ? config.TUYA_USER_IDS : ['az1739408936787MhA1Y'];

    // const realProducts = {data: [{}]}
    const ONLINE_THRESHOLD_MS = 5000; // 5 segundos
    const now = Date.now();
    const realProducts = await tuyaService.getAllDevicesForUserIds(tuyaUserIds);
    const tuyaNotConfigured = !realProducts.success && (realProducts.error || '').includes('not configured');
    const hasTuyaList = Array.isArray(realProducts.data) && realProducts.data.length > 0;
    if (!realProducts.success && !tuyaNotConfigured && !hasTuyaList) {
      const msg =
        realProducts.errors?.length > 0
          ? realProducts.errors.map((e) => `${e.userId}: ${e.error}`).join('; ')
          : realProducts.error;
      return res.status(400).json({
        message: msg || 'Tuya error',
        code: realProducts.code,
        errors: realProducts.errors,
      });
    }
    const clientes = await ClientModel.find();
    // mocked products 
    if (query.mocked) {
      const mockProducts = await mockedProducts();
      return res.status(200).json(mockProducts);
    }
    const filtros = {};
    const q1 = (key) => {
      const v = query[key];
      if (v == null || v === '') return '';
      const raw = Array.isArray(v) ? v[0] : v;
      return String(raw).trim();
    };
    const queryCity = q1('city');
    const queryState = q1('state');
    const queryDrive = q1('drive');
    const queryStatus = q1('status');
    const queryCliente = q1('cliente');

    // Cliente query: absent, empty string, or "All" means "no client filter" (all clients) for users without
    // an assigned client_id (e.g. admin). Users with client_id still get scoped to their client when param is empty.
    const id = user.id;
    const userData = await UserModel.findById(id);
    const userClientId = userData?.client_id != null ? String(userData.client_id) : null;

    if (queryCliente && queryCliente !== 'All') {
      filtros.client_id = queryCliente;
      filtros.cliente = queryCliente;
    } else if (userClientId) {
      filtros.client_id = userClientId;
      filtros.cliente = userClientId;
    }

    const currentclient = clientes.find(c => String(c.id) === String(filtros.cliente || filtros.client_id));
    if (currentclient?.name === 'All') {
      delete filtros.cliente;
      delete filtros.client_id;
    }

    // Set city and state filters
    if (queryCity && queryCity !== 'All') {
      filtros.city = queryCity;
    }
    if (queryState && queryState !== 'All') {
      filtros.state = queryState;
    }
    // Set drive filter
    if (queryDrive && queryDrive !== 'All') {
      filtros.drive = queryDrive;
    }
    // Status (online) — applied after Tuya merge only; DB column can be stale vs live list
    if (queryStatus && queryStatus !== 'All') {
      filtros.online = queryStatus === 'Online';
    }

    // Convert and filter by `create_time` (Unix timestamp)
    if (query.startDate && query.endDate && query.startDate !== 'null' && query.endDate !== 'null') {
      const startTimestamp = Math.floor(new Date(query.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(query.endDate).getTime() / 1000);

      if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
        filtros.create_time = { $gte: startTimestamp, $lte: endTimestamp };
      } else {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }

    /** SQL filters: exclude `online` so lista uses live Tuya online + in-memory filter */
    const findFilters = { ...filtros };
    if (findFilters.online !== undefined) {
      delete findFilters.online;
    }

    devLog('Fetching products from Tuya (source of truth) with filters:', filtros);

    const clientesList = await ClientModel.find();
    const defaultCliente = clientesList.find(c => c.name === 'Caffenio') || clientesList.find(c => c.name === 'All') || clientesList[0];
    const defCliente = clientes.find(c => c.name === 'Caffenio') || clientes.find(c => c.name === 'All') || clientes[0];

    // Tuya may still list replaced devices; DB merge lists them under merged_from_device_ids — hide from equipos list
    const supersededDeviceIds = await ProductModel.getSupersededDeviceIdSet();
    const allTuyaList = Array.isArray(realProducts.data) ? realProducts.data : [];
    /** After lock, live id stays in merged_from; hide Tuya duplicate only until a row with device_id = live id exists. */
    let supersededIdsStillHidden = new Set(supersededDeviceIds);
    let tuyaDevicesVisible = [];

    const isLockedCanonRow = (p) =>
      p &&
      p.id &&
      String(p.id).startsWith('_') &&
      Array.isArray(p.merged_from_device_ids) &&
      p.merged_from_device_ids.length > 0;

    // Sync Tuya → PostgreSQL (non-blocking: Tuya is source of truth)
    let dbProducts = [];
    try {
      devLog('🔄 [Sincronización] Iniciando sincronización de productos de Tuya con PostgreSQL...');
      let productosActualizados = 0;
      let productosInsertados = 0;
      let productosConError = 0;

      // Full Tuya list: superseded filter hid locked live ids from sync before, so no new row was ever inserted.
      // Insert only when no row has device_id === Tuya id (canonical locked row uses _+id, not a match).
      for (const tuyaProduct of allTuyaList.filter((p) => p && p.id)) {
        try {
          const existingProduct = await ProductModel.findByExactDeviceId(tuyaProduct.id);
          if (existingProduct) {
            productosActualizados++;
            continue;
          }
          // Store Tuya product in DB only when it doesn't exist
          const clientId = tuyaProduct.cliente || defaultCliente?.id;
          const productData = {
            ...tuyaProduct,
            client_id: clientId,
            cliente: clientId,
            product_type: tuyaProduct.product_type || (productos_nivel.includes(tuyaProduct.id) ? 'Nivel' : 'Osmosis'),
            city: tuyaProduct.city || 'Hermosillo',
            state: tuyaProduct.state || 'Sonora',
            drive: tuyaProduct.drive,
          };
          await ProductModel.create(productData);
          productosInsertados++;
          devLog(`➕ [Sincronización] Producto almacenado desde Tuya: ${tuyaProduct.name} (id: ${tuyaProduct.id})`);
        } catch (error) {
          productosConError++;
          console.error(`❌ [Sincronización] Error almacenando producto ${tuyaProduct.id} (${tuyaProduct.name}):`, error.message);
        }
      }
      devLog(`🔄 [Sincronización] Completada: ${productosInsertados} nuevos almacenados, ${productosActualizados} ya existían, ${productosConError} con error`);

      dbProducts = await ProductModel.find(findFilters);
      devLog(`📦 Found ${dbProducts.length} products in database`);

      supersededIdsStillHidden = new Set(
        [...supersededDeviceIds].filter(
          (sid) => !dbProducts.some((p) => p && String(p.id) === String(sid))
        )
      );
      tuyaDevicesVisible = allTuyaList.filter(
        (p) => p && p.id && !supersededIdsStillHidden.has(p.id)
      );
    } catch (dbErr) {
      devWarn('[getAllProducts] DB sync/query failed, using Tuya data only:', dbErr.message);
      supersededIdsStillHidden = new Set(supersededDeviceIds);
      tuyaDevicesVisible = allTuyaList.filter(
        (p) => p && p.id && !supersededIdsStillHidden.has(p.id)
      );
    }

    devLog(`🌐 Found ${allTuyaList.length} products from Tuya (${tuyaDevicesVisible.length} visible after merge suppress list)`);

    const dbProductsMap = new Map();
    dbProducts.forEach(p => {
      dbProductsMap.set(p.id, p);
    });

    const allTuyaById = new Map(allTuyaList.map((d) => [String(d.id), d]));

    // When Tuya not configured, use DB products only; otherwise combine Tuya + DB + locked canonical rows
    let products;
    if (tuyaNotConfigured) {
      products = dbProducts.filter((p) => p && p.id && !supersededIdsStillHidden.has(String(p.id)));
    } else {
      const fromVisible = await Promise.all(tuyaDevicesVisible.map(async (realProduct) => {
      const dbProduct = dbProductsMap.get(realProduct.id);
      if (dbProduct) {
        const merged = dbProduct.merged_from_device_ids || [];
        const isOsmosisRow =
          String(dbProduct.product_type || 'Osmosis').toLowerCase() === 'osmosis' &&
          !productos_nivel.includes(realProduct.id);
        let status = realProduct.status;
        let online = realProduct.online;
        if (merged.length > 0 && isOsmosisRow) {
          status = await mergeOsmosisTotalsSafe(realProduct.status, merged, 'getAllProducts');
          online = anyMergedDeviceOnline(realProduct, merged, allTuyaList);
        }
        return {
          ...dbProduct,
          online,
          name: realProduct.name,
          ip: realProduct.ip,
          status,
          update_time: realProduct.update_time,
          active_time: realProduct.active_time,
        };
      }
      // No DB record: use Tuya data with defaults
      return {
        ...realProduct,
        id: realProduct.id,
        cliente: defCliente?.id,
        client_id: defCliente?.id,
        product_type: productos_nivel.includes(realProduct.id) ? 'Nivel' : 'Osmosis',
        city: realProduct.city || 'Hermosillo',
        state: realProduct.state || 'Sonora',
      };
    }));

      const lockedDbCandidates = dbProducts.filter((p) => {
        if (!isLockedCanonRow(p)) return false;
        const merged = (p.merged_from_device_ids || []).map(String);
        const hasLiveExactRow = merged.some((mid) =>
          dbProducts.some((r) => r && String(r.device_id ?? r.id) === String(mid))
        );
        return !hasLiveExactRow;
      });
      const lockedCanon = await Promise.all(
        lockedDbCandidates.map(async (dbProduct) => {
          const merged = (dbProduct.merged_from_device_ids || []).map(String);
          const liveTuya = merged.map((mid) => allTuyaById.get(mid)).find(Boolean);
          if (!liveTuya) {
            return { ...dbProduct, online: false };
          }
          const isOsmosisRow =
            String(dbProduct.product_type || 'Osmosis').toLowerCase() === 'osmosis' &&
            !productos_nivel.includes(liveTuya.id);
          let status = liveTuya.status;
          let online = liveTuya.online;
          if (merged.length > 0 && isOsmosisRow) {
            status = await mergeOsmosisTotalsSafe(liveTuya.status, merged, 'getAllProducts:locked');
            online = anyMergedDeviceOnline(liveTuya, merged, allTuyaList);
          }
          return {
            ...dbProduct,
            online,
            name: liveTuya.name,
            ip: liveTuya.ip,
            status,
            update_time: liveTuya.update_time,
            active_time: liveTuya.active_time,
          };
        })
      );

      products = [...fromVisible, ...lockedCanon];
    }

    if (tuyaNotConfigured) {
      devLog(`📦 [Tuya not configured] Using ${dbProducts.length} products from database only`);
    }
    devLog(`✅ Total products to show: ${products.length}`);

    // Aplicar transformaciones y filtros
    const filteredProducts = await Promise.all(products.map(async (product) => {
      // Determinar si está online
      product.online = product.online || false;
      
      // Tipo de producto especial
      if (productos_nivel.includes(product.id)) {
        product.product_type = 'Nivel';
      }

      // Buscar y asignar cliente
      const cliente = clientes.find(cliente => 
        cliente._id.toString() === (product.cliente?._id?.toString() || product.cliente?.toString())
      );
      product.cliente = cliente || clientes.find(c => c.name === 'All') || clientes[0];

      const isOsmosisForLockPair =
        String(product.product_type || 'Osmosis').toLowerCase() === 'osmosis' &&
        !productos_nivel.includes(product.id);
      if (isOsmosisForLockPair && product.status && Array.isArray(product.status)) {
        const pid = String(product.id || '');
        if (pid && !pid.startsWith('_')) {
          product.status = addLockedCanonicalFlowTotalsToStatus(product.status, pid, dbProducts);
        }
      }
      
      // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
      // COMENTADO PARA MEJORAR RENDIMIENTO - Esta sección consulta ProductLog para obtener valores de flowrate
      // const isOsmosis = product.product_type === 'Osmosis' || product.product_type === 'osmosis';
      
      // if (isOsmosis && product.status && Array.isArray(product.status)) {
      //   const flowSpeed1 = product.status.find(s => s.code === 'flowrate_speed_1');
      //   const flowSpeed2 = product.status.find(s => s.code === 'flowrate_speed_2');
      
      //   const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
      //   const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
      
      //   if (needsFlowSpeed1 || needsFlowSpeed2) {
      //     devLog(`🔍 [getAllProducts] Producto ${product.id}: flowrate en 0, consultando ProductLogModel...`);
      
      //     try {
      //       // Obtener el registro más reciente de ProductLog
      //       const latestLog = await ProductLogModel.findOne({ product_id: product.id })
      //         .sort({ date: -1 })
      //         .limit(1);
      
      //       if (latestLog) {
      //         devLog(`✅ [getAllProducts] Log encontrado para ${product.id}`);
      
      //         if (needsFlowSpeed1 && latestLog.flujo_produccion) {
      //           if (flowSpeed1) {
      //             flowSpeed1.value = latestLog.flujo_produccion;
      //           } else {
      //             product.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
      //           }
      //           devLog(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
      //         }
      
      //         if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
      //           if (flowSpeed2) {
      //             flowSpeed2.value = latestLog.flujo_rechazo;
      //           } else {
      //             product.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
      //           }
      //           devLog(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
      //         }
      //       } else {
      //         devLog(`⚠️ [getAllProducts] No se encontraron logs para ${product.id}`);
      //       }
      //     } catch (logError) {
      //       console.error(`❌ [getAllProducts] Error obteniendo logs para ${product.id}:`, logError.message);
      //     }
      //   }
      // }
      
      // Aplicar transformaciones a los status
      const PRODUCTOS_ESPECIALES = [
        'ebf9738480d78e0132gnru',
        'ebea4ffa2ab1483940nrqn'
      ];
      if (product.status && Array.isArray(product.status)) {
        product.status = product.status.map((stat) => {
          const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
          const flujos_total_codes = ["flowrate_total_1", "flowrate_total_2"];
          
          if (PRODUCTOS_ESPECIALES.includes(product.id) && flujos_codes.includes(stat.code)) {
            stat.value = (stat.value * 1.6).toFixed(2);
            if (flujos_total_codes.includes(stat.code)) {
              stat.value = (stat.value / 10).toFixed(2);
            }
          } else if (flujos_total_codes.includes(stat.code)) {
            // Tuya sends flowrate_total_1/2 in 0.1 L units; convert to liters for all products
            stat.value = (Number(stat.value) / 10).toFixed(2);
          }
          
          const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];
          if (arrayCodes.includes(stat.code) && stat.value > 0) {
            stat.value = (stat.value / 10).toFixed(2);
          }
          
          return stat;
        });
      }

      return product;
    }));

    // Aplicar filtros adicionales después de combinar
    let finalProducts = filteredProducts;

    const rowClientIdString = (p) => {
      const c = p.cliente ?? p.client_id;
      if (c && typeof c === 'object') return String((c._id ?? c.id) ?? '');
      return String(c ?? '');
    };

    // Filtrar por cliente si es necesario (misma lógica que el segundo pase, para filas bloqueadas con solo client_id)
    if (filtros.cliente || filtros.client_id) {
      const cid = String(filtros.cliente || filtros.client_id);
      finalProducts = finalProducts.filter((p) => rowClientIdString(p) === cid);
    }

    // Filtrar por ciudad
    if (filtros.city) {
      finalProducts = finalProducts.filter(p => p.city === filtros.city);
    }

    // Filtrar por estado
    if (filtros.state) {
      finalProducts = finalProducts.filter(p => p.state === filtros.state);
    }

    // Filtrar por drive
    if (filtros.drive) {
      finalProducts = finalProducts.filter(p => p.drive === filtros.drive);
    }

    // Filtrar por status online/offline
    if (filtros.online !== undefined) {
      finalProducts = finalProducts.filter(p => p.online === filtros.online);
    }

    // Filtrar por rango de fechas
    if (filtros.create_time) {
      finalProducts = finalProducts.filter(p => 
        p.create_time >= filtros.create_time.$gte && 
        p.create_time <= filtros.create_time.$lte
      );
    }

    devLog(`🎯 Final products after filters: ${finalProducts.length}`);

    // 🔽 EXTRA: incluir productos sólo locales que no están en Tuya (visible list only)
    const idsTuya = new Set(tuyaDevicesVisible.map(p => p.id));
    const productosLocales = dbProducts.filter(
      (p) => !idsTuya.has(p.id) && !supersededIdsStillHidden.has(p.id) && !isLockedCanonRow(p)
    );
    const productosLocalesAdaptados = productosLocales.map((dbProduct) => ({
      ...dbProduct,
      online: false,
      // Mantén el resto de campos tal como en la BD
    }));

    // Combina: base ya filtrada + sólo-locales (evita duplicar filas que el primer pase ya excluyó por cliente/ciudad/etc.)
    let todosLosProductos = [...finalProducts, ...productosLocalesAdaptados];

    // 🔽 Vuelve a aplicar los filtros extra (post-combinados)
    if (filtros.cliente || filtros.client_id) {
      const cid = String(filtros.cliente || filtros.client_id);
      todosLosProductos = todosLosProductos.filter((p) => rowClientIdString(p) === cid);
    }
    if (filtros.city) {
      todosLosProductos = todosLosProductos.filter(p => p.city === filtros.city);
    }
    if (filtros.state) {
      todosLosProductos = todosLosProductos.filter(p => p.state === filtros.state);
    }
    if (filtros.drive) {
      todosLosProductos = todosLosProductos.filter(p => p.drive === filtros.drive);
    }
    if (filtros.online !== undefined) {
      todosLosProductos = todosLosProductos.filter(p => p.online === filtros.online);
    }
    if (filtros.create_time) {
      todosLosProductos = todosLosProductos.filter(p => 
        p.create_time >= filtros.create_time.$gte && 
        p.create_time <= filtros.create_time.$lte
      );
    }

    // One row per Tuya device_id (Tuya branch wins over duplicate local row)
    const seenDeviceIds = new Set();
    todosLosProductos = todosLosProductos.filter((p) => {
      const id = p.id != null ? String(p.id) : '';
      if (!id) return true;
      if (seenDeviceIds.has(id)) return false;
      seenDeviceIds.add(id);
      return true;
    });

    devLog(`🎯 Final products after filters (combinados): ${todosLosProductos.length}`);
    res.json(todosLosProductos);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

export const generateAllProducts = async (req, res) => {
  try {
    const mapedResults = await mockedProducts();
    res.status(200).json(mapedResults);
  } catch (error) {
      console.error("Error generating product data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};

export const saveAllProducts = async (req, res) => {
  try {
    const mapedResults = await mockedProducts();
    const storedProducts = [];
    for (const p of mapedResults) {
      try {
        const created = await ProductModel.create({ ...p, client_id: p.cliente || (await ClientModel.find())[0]?.id });
        if (created) storedProducts.push(created);
      } catch (e) {
        devWarn('saveAllProducts skip:', e.message);
      }
    }
    devLog(`${storedProducts.length} products saved to database.`);
    res.status(200).json(storedProducts);
  } catch (error) {
      console.error("Error generating product data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};

export const mockedProducts = async () => {
  try {
  const tuyaUserIds = config.TUYA_USER_IDS?.length ? config.TUYA_USER_IDS : ['az1739408936787MhA1Y'];
  const realProducts = await tuyaService.getAllDevicesForUserIds(tuyaUserIds);
  if (!realProducts.success) {
    return res.status(400).json({ message: realProducts.error, code: realProducts.code });
  }
  realProducts.data.map((product) => {
      product.city = "Hermosillo";
      product.state = "Sonora";
      product.drive = "TEST-APP";
  });
  const randomValue = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const baseData = {
      id: 'eb5741b947793cb5d0ozyb',
      active_time: Date.now(),
      biz_type: 0,
      category: "js",
      create_time: Date.now(),
      icon: "smart/icon/bay17049404440506Gfw/21e41e127c1218287e740739d48af02c.png",
      owner_id: "234238561",
      product_id: "lztrcjsskc1hlltu",
      product_name: "Sample Product",
      sub: false,
      time_zone: "-07:00",
      update_time: Date.now(),
  };

  // Generate 1000 random records
  const startDate = moment('2024-01-01').unix();
  const endDate = moment('2025-01-01').unix();
  const clientes = await getClients();
  const mexicoCities = await getCities();  
  realProducts.data.map((product) => {
    product.cliente = clientes.find(cliente => cliente.name === 'Aquatech')?.id;
    if(!product.lat || !product.lon) {
      product.lat = '29.0729';
      product.lon = '-110.9559';
    }
    
  });
  const mockedData = { result: realProducts.data };
  for (let i = 0; i < 1000; i++) {
    const cliente = clientes[randomValue(0, clientes.length - 1)];
    let drive = cliente.name
    if(['Caffenio', 'All'].includes(cliente.name)) {
      drive =  drives[randomValue(0, drives.length - 1)];
    } 
    const { lat, lon } =  getRandomCoordinateInMexico(mexicoCities);
    const cityData = getClosestCity(lat, lon, mexicoCities);
    const city = cityData.city;
    const state = cityData.state;
      mockedData.result.push({
          ...baseData,
          id: `device_${i}`,
          name: `Device CB-5 - #${i}`,
          create_time: startDate + Math.random() * (endDate - startDate),
          model: `model_${randomValue(100, 999)}`,
          online: Math.random() < 0.5,
          ip: `${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}`,
          lat,
          lon,
          uid: `user_${randomValue(1000, 9999)}`,
          uuid: `${randomValue(100000, 999999)}`,
          // city: cities[randomValue(0, cities.length - 1)],  // Random city
          city,  // Random client,
          state,  // Random
          cliente: cliente._id,  // Random client,
          drive,
          status: [
            { code: "tds_out", value: randomValue(50, 200) },
            { code: "water_overflow", value: Math.random() < 0.5 },
            { code: "water_wash", value: Math.random() < 0.5 },
            { code: "filter_element_1", value: randomValue(0, 180) },
            { code: "filter_element_2", value: randomValue(0, 270) },
            { code: "filter_element_3", value: randomValue(0, 270) },
            { code: "filter_element_4", value: randomValue(0, 270) },
            { code: "flowrate_total_1", value: randomValue(100, 900) },
            { code: "flowrate_total_2", value: randomValue(50, 1200) },
            { code: "flowrate_speed_1", value: randomValue(100, 1200) },
            { code: "flowrate_speed_2", value: randomValue(50, 800) },
            { code: "temperature", value: randomValue(20, 40) }
        ],
      });
    }

    // Process the product status to adjust certain flowrate values
    const mapedResults = mockedData.result.map((product) => {
        product.status.map((stat) => {
          // "flowrate_total_1", "flowrate_total_2",
            const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];
            if (arrayCodes.includes(stat.code) && stat.value > 0) {
                stat.value = stat.value / 10;
            }
            return stat;
        });
        return product;
    });
    return mapedResults;
  } catch (error) {
    console.error("Error generating product data:", error);
    return error;
  }
}

/**
 * Create a new product (for Personalización V1 - add new product).
 * Body: name, device_id (optional; generated if missing), cliente, city, state, product_type.
 */
export const createProduct = async (req, res) => {
  try {
    const { name, device_id, cliente, city, state, product_type } = req.body;
    const deviceId = (device_id ?? req.body.deviceId ?? '').toString().trim() || `manual-${Date.now()}`;
    const productName = (name ?? req.body.name ?? '').toString().trim() || 'Sin nombre';
    const productType = (product_type ?? req.body.product_type ?? 'Osmosis').toString().trim() || 'Osmosis';
    const existing = await ProductModel.findByDeviceId(deviceId);
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un producto con ese device_id' });
    }
    const productData = {
      id: deviceId,
      device_id: deviceId,
      name: productName,
      city: city ?? null,
      state: state ?? null,
      cliente: cliente ?? null,
      client_id: cliente ?? null,
      product_type: productType,
      status: [],
    };
    const created = await ProductModel.create(productData);
    if (!created) {
      return res.status(500).json({ message: 'Error al crear producto' });
    }
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
};

/**
 * Update a product's cliente, city, state, and product_type (for Equipos / personalización).
 * Params id can be MongoDB _id or Tuya device id.
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente, city, state, product_type, tuya_logs_routine_enabled } = req.body;
    const update = {
      ...(cliente != null && { cliente }),
      ...(city != null && { city }),
      ...(state != null && { state }),
      ...(product_type != null && { product_type }),
      ...(typeof tuya_logs_routine_enabled === 'boolean' && { tuya_logs_routine_enabled }),
    };
    const product = await ProductModel.update(id, update);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Error updating product' });
  }
};

/**
 * Delete a product by id (MongoDB _id or Tuya device id). Admin only.
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ProductModel.delete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Error deleting product' });
  }
};

/**
 * Admin: "lock" selected products — archive logs under `_` + device_id and point the row at the live Tuya id via merged_from_device_ids.
 * Body: { deviceIds: string[] } (plain Tuya device ids, not already `_`-prefixed).
 */
export const lockProducts = async (req, res) => {
  try {
    const { deviceIds } = req.body || {};
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere deviceIds (arreglo de ids de equipo).' });
    }
    const results = { locked: [], skipped: [], errors: [] };

    for (const rawId of deviceIds) {
      const input = String(rawId || '').trim();
      if (!input || input.startsWith('_')) {
        results.skipped.push({ deviceId: input, reason: 'vacío o ya bloqueado' });
        continue;
      }

      let row = await ProductModel.findByExactDeviceId(input);
      let plainDeviceId = row ? String(row.device_id ?? row.id ?? '') : '';
      if (!row && /^\d+$/.test(input)) {
        const byPk = await ProductModel.findById(parseInt(input, 10));
        if (byPk) {
          row = byPk;
          plainDeviceId = String(byPk.device_id ?? byPk.id ?? '');
        }
      }
      if (!row || !plainDeviceId) {
        results.errors.push({ deviceId: input, error: 'Producto no encontrado' });
        continue;
      }

      const newDeviceId = `_${plainDeviceId}`;
      const clash = await ProductModel.findByExactDeviceId(newDeviceId);
      if (clash) {
        results.errors.push({ deviceId: input, error: `Ya existe device_id ${newDeviceId}` });
        continue;
      }
      const prevMerged = Array.isArray(row.merged_from_device_ids)
        ? row.merged_from_device_ids.map(String)
        : [];
      const merged = [...new Set([...prevMerged, plainDeviceId])];

      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE product_logs SET product_device_id = '_' || product_device_id, updatedat = CURRENT_TIMESTAMP WHERE product_device_id = $1`,
          [plainDeviceId]
        );
        await client.query(
          `UPDATE products SET device_id = $1, merged_from_device_ids = $2::jsonb, updatedat = CURRENT_TIMESTAMP WHERE device_id = $3`,
          [newDeviceId, JSON.stringify(merged), plainDeviceId]
        );
        await client.query('COMMIT');
        results.locked.push({
          input,
          from: plainDeviceId,
          to: newDeviceId,
          merged_from_device_ids: merged,
        });
      } catch (e) {
        await client.query('ROLLBACK');
        results.errors.push({ deviceId: input, error: e.message });
      } finally {
        client.release();
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('lockProducts:', error);
    return res.status(500).json({ message: 'Error al bloquear productos', error: error.message });
  }
};

const PRODUCTOS_ESPECIALES = ['ebf9738480d78e0132gnru', 'ebea4ffa2ab1483940nrqn'];

function extractStatusValue(status, code) {
  return (status || []).find((s) => s && s.code === code)?.value;
}

/**
 * Apply the same display conversion rules used by getProductById for:
 * - flowrate_total_* (divide by 10)
 * - special products: flowrate_speed_* and flowrate_total_* *= 1.6 then totals ÷10
 */
function applyDisplayConversionsToStatus(status, tuyaDetailId) {
  const out = Array.isArray(status) ? JSON.parse(JSON.stringify(status)) : [];
  if (!Array.isArray(out)) return [];

  const isSpecial = PRODUCTOS_ESPECIALES.includes(String(tuyaDetailId || ''));
  const flujos_total_codes = ['flowrate_total_1', 'flowrate_total_2'];
  if (isSpecial) {
    const flujos_codes = ['flowrate_speed_1', 'flowrate_speed_2', 'flowrate_total_1', 'flowrate_total_2'];
    out.map((stat) => {
      if (flujos_codes.includes(stat.code)) {
        stat.value = (Number(stat.value) * 1.6).toFixed(2);
      }
      if (flujos_total_codes.includes(stat.code)) {
        stat.value = (Number(stat.value) / 10).toFixed(2);
      }
      return stat;
    });
    return out;
  }

  return out.map((stat) => {
    if (flujos_total_codes.includes(stat.code)) stat.value = (Number(stat.value) / 10).toFixed(2);
    return stat;
  });
}

function statusToMergedDisplayFields(status) {
  // UI requested: flowrate_total_*, tds, ettc..
  return {
    flowrate_total_1: extractStatusValue(status, 'flowrate_total_1'),
    flowrate_total_2: extractStatusValue(status, 'flowrate_total_2'),
    tds_out: extractStatusValue(status, 'tds_out'),
    flowrate_speed_1: extractStatusValue(status, 'flowrate_speed_1'),
    flowrate_speed_2: extractStatusValue(status, 'flowrate_speed_2'),
    temperature: extractStatusValue(status, 'temperature'),
    filter_element_1: extractStatusValue(status, 'filter_element_1'),
    filter_element_2: extractStatusValue(status, 'filter_element_2'),
    filter_element_3: extractStatusValue(status, 'filter_element_3'),
    filter_element_4: extractStatusValue(status, 'filter_element_4'),
  };
}

/**
 * Admin: list locked canonical rows `_...` that map 1:1 to a live device id.
 * This drives the "Productos mezclados" tab (Personalización v1).
 */
export const getMergedProductsList = async (req, res) => {
  try {
    const lockedRows = await ProductModel.findLockedCanonicalRowsForMergedPairs();

    // Show all locked canonical merges (not only Osmosis).
    const rawItems = [];
    for (const row of lockedRows) {
      const oldDeviceId = String(row.id || row.device_id || '');
      const merged = Array.isArray(row.merged_from_device_ids) ? row.merged_from_device_ids : [];
      if (!oldDeviceId || merged.length === 0) continue;
      const switchedDate = row.update_time ? Number(row.update_time) : null;
      for (const liveId of merged) {
        const liveDeviceId = String(liveId);
        if (!liveDeviceId || liveDeviceId.startsWith('_')) continue;
        rawItems.push({ liveDeviceId, oldDeviceId, switchedDate });
      }
    }

    // De-dupe by liveDeviceId (a live device should only have one locked canonical row).
    const dedup = new Map();
    for (const it of rawItems) {
      if (!dedup.has(it.liveDeviceId)) dedup.set(it.liveDeviceId, it);
    }
    return res.json(Array.from(dedup.values()));
  } catch (error) {
    console.error('[getMergedProductsList]', error);
    return res.status(500).json({ message: 'Error al obtener productos mezclados', error: error.message });
  }
};

/**
 * Admin: detail diff old (_... row) vs new (Tuya live status merged with stored baseline).
 */
export const getMergedProductDetail = async (req, res) => {
  try {
    let { liveDeviceId } = req.params;
    try {
      liveDeviceId = decodeURIComponent(String(liveDeviceId || ''));
    } catch (_) {
      liveDeviceId = String(req.params.liveDeviceId || '');
    }
    if (!liveDeviceId || String(liveDeviceId).startsWith('_')) {
      return res.status(400).json({ message: 'liveDeviceId inválido' });
    }

    const oldLocked = await ProductModel.findLockedCanonicalForLiveDeviceId(liveDeviceId);
    if (!oldLocked) return res.status(404).json({ message: 'Par merge no encontrado' });

    const oldDeviceId = String(oldLocked.id || oldLocked.device_id || '');
    const switchedDate = oldLocked.update_time ? Number(oldLocked.update_time) : null;

    const tuyaDetailId = resolveTuyaLiveDeviceIdForTuyaApi(oldLocked) || liveDeviceId;

    // OLD: stored status from `_...` row (no Tuya sync, so we preserve old totals)
    const oldConvertedStatus = applyDisplayConversionsToStatus(oldLocked.status, tuyaDetailId);
    const oldFields = statusToMergedDisplayFields(oldConvertedStatus);

    const oldProductLogsCount = await ProductLogModel.count({ product_device_id: oldDeviceId });
    const newProductLogsCount = await ProductLogModel.count({ product_device_id: liveDeviceId });

    // NEW (for this endpoint): fetch current Tuya status only.
    // Do NOT apply the merge logic here; users want the "real" live product values.
    const tuyaResponse = await tuyaService.getDeviceDetail(tuyaDetailId);
    if (!tuyaResponse?.success || !tuyaResponse?.data?.status) {
      return res.status(400).json({
        message: 'No se pudieron obtener valores actuales desde Tuya para el detalle del merge',
        code: tuyaResponse?.code,
        error: tuyaResponse?.error,
      });
    }

    const newRawStatus = tuyaResponse.data.status;

    const newConvertedStatus = applyDisplayConversionsToStatus(newRawStatus, tuyaDetailId);
    const newFields = statusToMergedDisplayFields(newConvertedStatus);

    return res.json({
      liveDeviceId,
      oldDeviceId,
      switchedDate,
      old: { device_id: oldDeviceId, ...oldFields, product_logs_count: oldProductLogsCount },
      new: { device_id: liveDeviceId, ...newFields, product_logs_count: newProductLogsCount },
    });
  } catch (error) {
    console.error('[getMergedProductDetail]', error);
    return res.status(500).json({ message: 'Error al obtener el detalle de productos mezclados', error: error.message });
  }
};

/**
 * Returns the Unix timestamp (seconds) to show as "Última vez actualizado":
 * the greater of product.update_time and the date of the latest ProductLog
 * that has at least one non-zero value (tds, production_volume, rejected_volume,
 * temperature, flujo_produccion, flujo_rechazo).
 */
async function getLastUpdatedDisplay(productId, updateTimeSeconds, productForLogIds = null) {
  try {
    const deviceIds = productForLogIds ? collectProductLogDeviceIds(productId, productForLogIds) : [String(productId)];
    const latestLog =
      deviceIds.length > 1
        ? await ProductLogModel.findLatestWithDataAmong(deviceIds)
        : await ProductLogModel.findLatestWithData(String(productId));

    const productTime = updateTimeSeconds && Number(updateTimeSeconds) > 0 ? Number(updateTimeSeconds) : 0;
    if (!latestLog || !latestLog.date) return productTime || undefined;
    const logTime = Math.floor(new Date(latestLog.date).getTime() / 1000);
    return Math.max(productTime, logTime);
  } catch (err) {
    console.error('[getLastUpdatedDisplay]', err.message);
    return updateTimeSeconds && Number(updateTimeSeconds) > 0 ? Number(updateTimeSeconds) : undefined;
  }
}

export const getProductById = async (req, res) => {
  try {
    let { id } = req.params;
    try {
      id = decodeURIComponent(String(id || ''));
    } catch (_) {
      id = String(req.params.id || '');
    }
    const ONLINE_THRESHOLD_MS = 5000; // 5 segundos
    const now = Date.now();
    devLog('Fetching product details for:', id);

    // Check if the product exists in MongoDB
    let product = await ProductModel.findByDeviceId(id);

    if (product) {
      devLog('Product found in MongoDB. Fetching latest details from Tuya API...');
      product.online = product.last_time_active && (now - product.last_time_active <= ONLINE_THRESHOLD_MS);
      const tuyaDetailId = resolveTuyaLiveDeviceIdForTuyaApi(product) || id;

      // Fetch the latest details from Tuya API
      const response = await tuyaService.getDeviceDetail(tuyaDetailId);
      
      devLog('response product detail', response)
      if (!response.success) {
        if (product) {
          const lastDisplayFail = await getLastUpdatedDisplay(id, product.update_time, product);
          const outFail = { ...product };
          const mergedFail = Array.isArray(outFail.merged_from_device_ids) ? outFail.merged_from_device_ids : [];
          const isOsmosisFail = String(outFail.product_type || 'Osmosis').toLowerCase() === 'osmosis';
          if (isOsmosisFail && mergedFail.length > 0) {
            outFail.status = await mergeOsmosisTotalsSafe(outFail.status, mergedFail, 'getProductById:tuya-fail');
          }
          if (isOsmosisFail && outFail.status && Array.isArray(outFail.status)) {
            const lidFail = String(outFail.id || id || '');
            if (lidFail && !lidFail.startsWith('_')) {
              outFail.status = await ensureLockedCanonicalFlowTotalsMerged(outFail.status, lidFail, null);
            }
          }
          outFail.last_updated_display = lastDisplayFail != null ? lastDisplayFail : outFail.update_time;
          const productosEspecialesFail = ['ebf9738480d78e0132gnru', 'ebea4ffa2ab1483940nrqn'];
          if (outFail.status && Array.isArray(outFail.status) && !productosEspecialesFail.includes(tuyaDetailId)) {
            outFail.status = outFail.status.map((s) => {
              if (s.code === 'flowrate_total_1' || s.code === 'flowrate_total_2') s.value = (Number(s.value) / 10).toFixed(2);
              return s;
            });
          }
          return res.json(outFail);
        }
        return res.status(400).json({ message: response.error, code: response.code });
      }
      if (response && response.data) {
        const updatedData = response.data; // Assuming this is the correct structure

        // Update Postgres with the latest data from Tuya
        product = await ProductModel.update(id, updatedData);
        const PRODUCTOS_ESPECIALES = [
          'ebf9738480d78e0132gnru',
          'ebea4ffa2ab1483940nrqn'
        ];
        const isOsmosis = product.product_type === 'Osmosis' || product.product_type === 'osmosis';
        const mergedCurrent = Array.isArray(product.merged_from_device_ids) ? product.merged_from_device_ids : [];
        if (isOsmosis && mergedCurrent.length > 0) {
          product.status = await mergeOsmosisTotalsSafe(product.status, mergedCurrent, 'getProductById:tuya-success');
        }
        devLog(`Product ${id} updated in MongoDB.`);
        
        // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
        
        if (isOsmosis && product.status && Array.isArray(product.status)) {
          const flowSpeed1 = product.status.find(s => s.code === 'flowrate_speed_1');
          const flowSpeed2 = product.status.find(s => s.code === 'flowrate_speed_2');
          
          const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
          const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
          
          if (needsFlowSpeed1 || needsFlowSpeed2) {
            devLog(`🔍 [getProductById] Producto ${id}: flowrate en 0, consultando ProductLogModel...`);
            
            try {
              const logDevIds = collectProductLogDeviceIds(id, product);
              const logRows = await ProductLogModel.find({ product_device_ids: logDevIds, _limit: 1 });
              const latestLog = logRows[0];
              
              if (latestLog) {
                devLog(`✅ [getProductById] Log encontrado para ${id}`);
                
                if (needsFlowSpeed1 && latestLog.flujo_produccion) {
                  if (flowSpeed1) {
                    flowSpeed1.value = latestLog.flujo_produccion;
                  } else {
                    product.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
                  }
                  devLog(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
                }
                
                if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
                  if (flowSpeed2) {
                    flowSpeed2.value = latestLog.flujo_rechazo;
                  } else {
                    product.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
                  }
                  devLog(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
                }
              } else {
                devLog(`⚠️ [getProductById] No se encontraron logs para ${id}`);
              }
            } catch (logError) {
              console.error(`❌ [getProductById] Error obteniendo logs para ${id}:`, logError.message);
            }
          }
        }

        if (isOsmosis && product.status && Array.isArray(product.status)) {
          const lidDetail = String(product.id || id || '');
          if (lidDetail && !lidDetail.startsWith('_')) {
            product.status = await ensureLockedCanonicalFlowTotalsMerged(product.status, lidDetail, null);
          }
        }
        
        const flujos_total_codes = ['flowrate_total_1', 'flowrate_total_2'];
        if (PRODUCTOS_ESPECIALES.includes(tuyaDetailId)) {
          const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
          product.status.map((stat) => {
            if (flujos_codes.includes(stat.code)) {
              stat.value = (stat.value * 1.6).toFixed(2);
            }
            if (flujos_total_codes.includes(stat.code)) {
              stat.value = (stat.value / 10).toFixed(2);
            }
            return stat;
          });
        } else {
          product.status = product.status.map((stat) => {
            if (flujos_total_codes.includes(stat.code)) {
              stat.value = (Number(stat.value) / 10).toFixed(2);
            }
            return stat;
          });
        }
        const lastDisplay = await getLastUpdatedDisplay(id, product.update_time, product);
        const out = { ...product };
        out.last_updated_display = lastDisplay != null ? lastDisplay : out.update_time;
        return res.json(out);
      }

      // If Tuya API doesn't return data, return the existing MongoDB product
      devLog('Tuya API did not return data. Returning existing MongoDB product.');
      const lastDisplayExisting = await getLastUpdatedDisplay(id, product.update_time, product);
      const outExisting = { ...product };
      const mergedExisting = Array.isArray(outExisting.merged_from_device_ids) ? outExisting.merged_from_device_ids : [];
      const isOsmosisExisting = String(outExisting.product_type || 'Osmosis').toLowerCase() === 'osmosis';
      if (isOsmosisExisting && mergedExisting.length > 0) {
        outExisting.status = await mergeOsmosisTotalsSafe(outExisting.status, mergedExisting, 'getProductById:existing-fallback');
      }
      if (isOsmosisExisting && outExisting.status && Array.isArray(outExisting.status)) {
        const lidEx = String(outExisting.id || id || '');
        if (lidEx && !lidEx.startsWith('_')) {
          outExisting.status = await ensureLockedCanonicalFlowTotalsMerged(outExisting.status, lidEx, null);
        }
      }
      outExisting.last_updated_display = lastDisplayExisting != null ? lastDisplayExisting : outExisting.update_time;
      // Apply same flowrate_total_1/2 ÷10 for display (Tuya uses 0.1 L units)
      const productosEspeciales = ['ebf9738480d78e0132gnru', 'ebea4ffa2ab1483940nrqn'];
      const flujosTotalCodes = ['flowrate_total_1', 'flowrate_total_2'];
      if (outExisting.status && Array.isArray(outExisting.status) && !productosEspeciales.includes(tuyaDetailId)) {
        outExisting.status = outExisting.status.map((stat) => {
          if (flujosTotalCodes.includes(stat.code)) stat.value = (Number(stat.value) / 10).toFixed(2);
          return stat;
        });
      }
      return res.json(outExisting);
    } 

    // If product does not exist in MongoDB, fetch from Tuya API
    devLog('Product not found in MongoDB. Fetching from Tuya API...');
    const response = await tuyaService.getDeviceDetail(id);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }

    if (!response || !response.data) {
      return res.status(404).json({ message: 'Device not found in Tuya API' });
    }

    // Obtener cliente por defecto (Caffenio preferentemente)
    const clientes = await ClientModel.find();
    const defaultCliente = clientes.find(c => c.name === 'Caffenio') || clientes.find(c => c.name === 'All') || clientes[0];

    // Save the new product to Postgres
    const productData = {
      ...response.data,
      cliente: defaultCliente?.id,
      product_type: productos_nivel.includes(response.data.id) ? 'Nivel' : 'Osmosis',
      city: response.data.city || 'Hermosillo',
      state: response.data.state || 'Sonora',
    };

    const newProductModel = await ProductModel.create(productData);
    if (!newProductModel) {
      return res.status(500).json({ message: 'Failed to create product' });
    }

    devLog(`Product ${id} saved to Postgres.`);
    
    // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
    const isOsmosis = newProductModel.product_type === 'Osmosis' || newProductModel.product_type === 'osmosis';
    const mergedNew = Array.isArray(newProductModel.merged_from_device_ids) ? newProductModel.merged_from_device_ids : [];
    if (isOsmosis && mergedNew.length > 0) {
      newProductModel.status = await mergeOsmosisTotalsSafe(newProductModel.status, mergedNew, 'getProductById:new-product');
    }
    
    if (isOsmosis && newProductModel.status && Array.isArray(newProductModel.status)) {
      const flowSpeed1 = newProductModel.status.find(s => s.code === 'flowrate_speed_1');
      const flowSpeed2 = newProductModel.status.find(s => s.code === 'flowrate_speed_2');
      
      const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
      const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
      
      if (needsFlowSpeed1 || needsFlowSpeed2) {
        devLog(`🔍 [getProductById - new] Producto ${id}: flowrate en 0, consultando ProductLogModel...`);
        
        try {
          // Obtener el registro más reciente de ProductLog
          const latestLog = await ProductLogModel.findOne({ product_id: id });
          
          if (latestLog) {
            devLog(`✅ [getProductById - new] Log encontrado para ${id}`);
            
            if (needsFlowSpeed1 && latestLog.flujo_produccion) {
              if (flowSpeed1) {
                flowSpeed1.value = latestLog.flujo_produccion;
              } else {
                newProductModel.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
              }
              devLog(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
            }
            
            if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
              if (flowSpeed2) {
                flowSpeed2.value = latestLog.flujo_rechazo;
              } else {
                newProductModel.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
              }
              devLog(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
            }
          } else {
            devLog(`⚠️ [getProductById - new] No se encontraron logs para ${id}`);
          }
        } catch (logError) {
          console.error(`❌ [getProductById - new] Error obteniendo logs para ${id}:`, logError.message);
        }
      }
    }

    if (isOsmosis && newProductModel.status && Array.isArray(newProductModel.status)) {
      const lidNew = String(newProductModel.id || id || '');
      if (lidNew && !lidNew.startsWith('_')) {
        newProductModel.status = await ensureLockedCanonicalFlowTotalsMerged(newProductModel.status, lidNew, null);
      }
    }
    
    const PRODUCTOS_ESPECIALES = [
      'ebf9738480d78e0132gnru',
      'ebea4ffa2ab1483940nrqn'
    ];
    const flujos_total_codes = ['flowrate_total_1', 'flowrate_total_2'];
    if (PRODUCTOS_ESPECIALES.includes(newProductModel.id)) {
      const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
      newProductModel.status.map((stat) => {
        if (flujos_codes.includes(stat.code)) {
          stat.value = (stat.value * 1.6).toFixed(2);
        }
        if (flujos_total_codes.includes(stat.code)) {
          stat.value = (stat.value / 10).toFixed(2);
        }
        return stat;
      });
    } else if (newProductModel.status && Array.isArray(newProductModel.status)) {
      newProductModel.status = newProductModel.status.map((stat) => {
        if (flujos_total_codes.includes(stat.code)) {
          stat.value = (Number(stat.value) / 10).toFixed(2);
        }
        return stat;
      });
    }
    const lastDisplayNew = await getLastUpdatedDisplay(id, newProductModel.update_time, newProductModel);
    const outNew = { ...newProductModel };
    outNew.last_updated_display = lastDisplayNew != null ? lastDisplayNew : outNew.update_time;
    res.json(outNew);
    
  } catch (error) {
    console.error('Error fetching product details:', error);
    try {
      const fallback = await ProductModel.findByDeviceId(req.params.id);
      if (fallback) {
        const mergedFallback = Array.isArray(fallback.merged_from_device_ids) ? fallback.merged_from_device_ids : [];
        const isOsmosisFallback = String(fallback.product_type || 'Osmosis').toLowerCase() === 'osmosis';
        let out = { ...fallback };
        if (isOsmosisFallback && mergedFallback.length > 0) {
          out.status = await mergeOsmosisTotalsSafe(out.status, mergedFallback, 'getProductById:catch-fallback');
        }
        if (isOsmosisFallback && out.status && Array.isArray(out.status)) {
          const lidFb = String(out.id || req.params.id || '');
          if (lidFb && !lidFb.startsWith('_')) {
            out.status = await ensureLockedCanonicalFlowTotalsMerged(out.status, lidFb, null);
          }
        }
        const flujosTotalCodes = ['flowrate_total_1', 'flowrate_total_2'];
        if (out.status && Array.isArray(out.status)) {
          out.status = out.status.map((stat) => {
            if (flujosTotalCodes.includes(stat.code)) stat.value = (Number(stat.value) / 10).toFixed(2);
            return stat;
          });
        }
        const lastDisplay = await getLastUpdatedDisplay(req.params.id, out.update_time, fallback);
        out.last_updated_display = lastDisplay != null ? lastDisplay : out.update_time;
        return res.json(out);
      }
    } catch (fallbackErr) {
      console.error('[getProductById][catch-fallback]', fallbackErr.message);
    }
    res.status(500).json({ message: 'Error fetching product details' });
  }
};

export const getProductLogsById = async (req, res) => {
  try {
    const id = req.params.id || req.query?.id || req.query?.params?.id;
    const queryParams = req.query.params || req.query;
    const {
      start_date = queryParams.start_date,
      end_date = queryParams.end_date,
      limit = queryParams.limit ?? 100,
      last_row_key = queryParams.last_row_key ?? null,
    } = queryParams;

    if (!id) {
      return res.status(400).json({ message: 'Missing required parameter: id' });
    }

    const product = await ProductModel.findByDeviceId(id);
    const tuyaLogId = product ? (resolveTuyaLiveDeviceIdForTuyaApi(product) || id) : id;
    const logDeviceIds = product ? collectProductLogDeviceIds(id, product) : [String(id)];
    const logWriteDeviceId = tuyaLogId;

    const productType = product?.product_type || 'Osmosis';
    const isNivel = productType === 'Nivel' || productType === 'nivel';
    devLog('Fetching product logs for:', { id, tuyaLogId, productType });

    // ====== FUNCIÓN PARA APLICAR CONVERSIONES ======
    const applySpecialProductLogic = (fieldName, value) => {
      if (value == null || value === 0) return value;

      const PRODUCTOS_ESPECIALES = [
        'ebf9738480d78e0132gnru',
        'ebea4ffa2ab1483940nrqn'
      ];

      const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
      const flujos_total_codes = ["flowrate_total_1", "flowrate_total_2"];
      const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];

      let convertedValue = value;

      // 1. Si es producto especial y es código de flujo: multiplicar por 1.6
      if (PRODUCTOS_ESPECIALES.includes(tuyaLogId) && flujos_codes.includes(fieldName)) {
        convertedValue = convertedValue * 1.6;
        
        // 2. Si es total (flowrate_total_1 o flowrate_total_2): dividir por 10
        if (flujos_total_codes.includes(fieldName)) {
          convertedValue = convertedValue / 10;
        }
      }

      // 3. Si es flowrate_speed_1 o flowrate_speed_2: siempre dividir por 10 (conversión a L/s)
      if (arrayCodes.includes(fieldName) && convertedValue > 0) {
        convertedValue = convertedValue / 10;
      }
      
      return parseFloat(convertedValue.toFixed(2));
    };

    // ====== Preparar filtros para Tuya ======
    const numericLimit = parseInt(limit, 10) || 100;
    const numericStartDate = start_date ? Number(start_date) : Date.now() - 24 * 60 * 60 * 1000;
    const numericEndDate = end_date ? Number(end_date) : Date.now();

    const tuyaFieldsByType = {
      Osmosis: 'flowrate_speed_1,flowrate_speed_2,flowrate_total_1,flowrate_total_2,tds_out',
      Nivel: 'liquid_level_percent,liquid_depth',
    };
    const fields = tuyaFieldsByType[productType] || tuyaFieldsByType.Osmosis;

    const filters = {
      id: tuyaLogId,
      start_date: numericStartDate,
      end_date: numericEndDate,
      fields,
      size: numericLimit * 5,
      last_row_key,
    };

    devLog('📊 Filtros para Tuya:', filters);

    let rawLogs = [];
    let source = 'database';

    // ====== Intentar obtener desde Tuya ======
    try {
      const response = await tuyaService.getDeviceLogs(filters);
      if (response.success && response.data && response.data.logs?.length > 0) {
        rawLogs = isNivel
          ? mapTuyaLogsNivel(response.data.logs)
          : mapTuyaLogs(response.data.logs);
        source = 'tuya';
        devLog(`✅ Logs obtenidos desde Tuya (${rawLogs.length})`);
      } else {
        devWarn('⚠️ No se encontraron logs en Tuya');
      }
    } catch (err) {
      devWarn('⚠️ Error al obtener logs de Tuya:', err.message);
    }

    // ====== Si Tuya no devolvió datos: para Nivel, intentar sync-on-read (guardar en ProductLog y luego leer de DB) ======
    if (!rawLogs.length) {
      if (isNivel) {
        try {
          const productForSync = await ProductModel.findByDeviceId(id);
          if (productForSync) {
            const nivelCodes = ['liquid_level_percent', 'liquid_depth'];
            const allTuyaLogs = [];
            for (const code of nivelCodes) {
              try {
                const resp = await tuyaService.getDeviceLogsForRoutine({
                  id: tuyaLogId,
                  start_date: numericStartDate,
                  end_date: numericEndDate,
                  fields: code,
                  size: Math.min(numericLimit * 5, 100),
                });
                if (resp.success && resp.data?.logs?.length > 0) {
                  allTuyaLogs.push(...resp.data.logs);
                }
                await new Promise((r) => setTimeout(r, 200));
              } catch (codeErr) {
                devWarn(`[getProductLogsById] Nivel sync: error fetching ${code}:`, codeErr.message);
              }
            }
            if (allTuyaLogs.length > 0) {
              const groupedByTs = {};
              allTuyaLogs.forEach((log) => {
                const ts = log.event_time;
                if (!groupedByTs[ts]) {
                  groupedByTs[ts] = {
                    product_id: id,
                    producto: productForSync._id,
                    date: new Date(ts),
                    source: 'tuya',
                    flujo_produccion: null,
                    flujo_rechazo: null,
                  };
                }
                if (log.code === 'liquid_level_percent') groupedByTs[ts].flujo_rechazo = Number(log.value) || 0;
                if (log.code === 'liquid_depth') groupedByTs[ts].flujo_produccion = Number(log.value) || 0;
              });
              const toSave = Object.values(groupedByTs).filter(
                (l) => (l.flujo_produccion != null && l.flujo_produccion !== 0) || (l.flujo_rechazo != null && l.flujo_rechazo !== 0)
              );
              if (toSave.length > 0) {
                const dates = toSave.map((l) => l.date);
                const existing = await ProductLogModel.findByDatesForDeviceIds(logDeviceIds, dates);
                const existingSet = new Set(existing.map((e) => (e.date instanceof Date ? e.date : new Date(e.date)).getTime()));
                const toInsert = toSave
                  .filter((l) => !existingSet.has(l.date.getTime()))
                  .map((l) => ({
                    product_id: logWriteDeviceId,
                    product_device_id: logWriteDeviceId,
                    producto: l.producto,
                    date: l.date,
                    flujo_produccion: l.flujo_produccion ?? undefined,
                    flujo_rechazo: l.flujo_rechazo ?? undefined,
                    source: 'tuya',
                  }));
                if (toInsert.length > 0) {
                  await ProductLogModel.insertMany(toInsert);
                  devLog(`📥 [getProductLogsById] Nivel sync-on-read: guardados ${toInsert.length} logs en ProductLog`);
                }
              }
            }
          }
        } catch (nivelSyncErr) {
          devWarn('[getProductLogsById] Nivel sync-on-read error:', nivelSyncErr.message);
        }
      }

      devLog('🔁 Consultando logs desde base de datos local...');
      const query = { product_device_ids: logDeviceIds, _limit: parseInt(limit, 10) * 5 };

      if (start_date && end_date) {
        query.date = {
          $gte: new Date(Number(start_date)),
          $lte: new Date(Number(end_date)),
        };
      }

      rawLogs = await ProductLogModel.find(query);

      // Asegurar que todos los logs de MongoDB tengan source='database'
      rawLogs = rawLogs.map((log) => ({
        ...log,
        source: 'database',
      }));

      devLog(`✅ Logs obtenidos desde DB (${rawLogs.length})`);
    } else {
      // Si los logs vienen de Tuya, asegurar que todos tengan source='tuya'
      rawLogs = rawLogs.map(log => ({
        ...log,
        source: 'tuya', // Forzar source='tuya' para logs de Tuya
      }));
    }

    // ====== AGRUPAR LOGS POR TIMESTAMP (redondeado a segundos) ======
    const groupedLogs = {};
    
    rawLogs.forEach(log => {
      // Usar el timestamp como clave, redondeado a segundos para agrupar
      const logDate = log.date ? new Date(log.date) : new Date(log.createdAt || Date.now());
      const timestamp = Math.floor(logDate.getTime() / 1000) * 1000; // Redondear a segundos
      
      // Usar el source del log individual (ya establecido correctamente arriba)
      const logSource = log.source;
      
      if (!groupedLogs[timestamp]) {
        groupedLogs[timestamp] = {
          date: new Date(timestamp),
          createdAt: log.createdAt || new Date(timestamp),
          source: logSource, // Usar el origen real del log (ya establecido correctamente)
          _id: log._id,
          producto: log.producto,
          product_id: log.product_id || id,
          // Inicializar todos los campos
          tds: null,
          production_volume: null,
          rejected_volume: null,
          flujo_produccion: null,
          flujo_rechazo: null,
          tiempo_inicio: null,
          tiempo_fin: null,
        };
      } else {
        // Si ya existe un log en este timestamp, priorizar 'tuya' sobre 'database'
        // Esto asegura que si hay mezcla de orígenes, se muestre 'tuya'
        if (logSource === 'tuya' && groupedLogs[timestamp].source === 'database') {
          groupedLogs[timestamp].source = 'tuya';
        }
      }

      // Agregar valores si existen y no son 0
      if (log.tds != null && log.tds !== 0) {
        groupedLogs[timestamp].tds = log.tds;
      }
      if (log.production_volume != null && log.production_volume !== 0) {
        groupedLogs[timestamp].production_volume = log.production_volume;
      }
      if (log.rejected_volume != null && log.rejected_volume !== 0) {
        groupedLogs[timestamp].rejected_volume = log.rejected_volume;
      }
      if (log.flujo_produccion != null && log.flujo_produccion !== 0) {
        groupedLogs[timestamp].flujo_produccion = log.flujo_produccion;
      }
      if (log.flujo_rechazo != null && log.flujo_rechazo !== 0) {
        groupedLogs[timestamp].flujo_rechazo = log.flujo_rechazo;
      }
      if (log.tiempo_inicio != null) {
        groupedLogs[timestamp].tiempo_inicio = log.tiempo_inicio;
      }
      if (log.tiempo_fin != null) {
        groupedLogs[timestamp].tiempo_fin = log.tiempo_fin;
      }
    });

    // ====== SYNC TUYA LOGS TO ProductLogs (when fetched from Tuya) ======
    // When the detail page fetches logs from Tuya, persist any missing entries to MongoDB
    // so reports and other consumers see them. Deduplicate by (product_id, date).
    if (source === 'tuya' && Object.keys(groupedLogs).length > 0) {
      try {
        const product = await ProductModel.findByDeviceId(id);
        if (product) {
          const logsToSync = Object.values(groupedLogs).map(entry => ({
            ...entry,
            product_id: id,
            producto: product._id,
          }));
          const hasValidData = (log) => {
            const v = (x) => x != null && x !== 0;
            return v(log.tds) || v(log.production_volume) || v(log.rejected_volume) || v(log.flujo_produccion) || v(log.flujo_rechazo);
          };
          const logsWithData = logsToSync.filter(hasValidData);
          if (logsWithData.length > 0) {
            const dates = logsWithData.map((l) => l.date);
            const existing = await ProductLogModel.findByDatesForDeviceIds(logDeviceIds, dates);
            const existingSet = new Set(existing.map((e) => (e.date instanceof Date ? e.date : new Date(e.date)).getTime()));
            const toInsert = logsWithData
              .filter((l) => !existingSet.has(l.date.getTime()))
              .map((l) => ({
                product_id: logWriteDeviceId,
                product_device_id: logWriteDeviceId,
                producto: l.producto,
                date: l.date,
                tds: l.tds ?? undefined,
                production_volume: l.production_volume ?? undefined,
                rejected_volume: l.rejected_volume ?? undefined,
                flujo_produccion: l.flujo_produccion ?? undefined,
                flujo_rechazo: l.flujo_rechazo ?? undefined,
                tiempo_inicio: l.date ? Math.floor(l.date.getTime() / 1000) : undefined,
                tiempo_fin: l.date ? Math.floor(l.date.getTime() / 1000) : undefined,
                source: 'tuya',
              }));
            if (toInsert.length > 0) {
              await ProductLogModel.insertMany(toInsert);
              devLog(`📥 [getProductLogsById] Synced ${toInsert.length} Tuya logs to ProductLogs (${logsWithData.length - toInsert.length} already in DB)`);
            }
          }
        }
      } catch (syncErr) {
        console.error('❌ [getProductLogsById] Error syncing Tuya logs to ProductLogs:', syncErr.message);
      }
    }

    // ====== APLICAR CONVERSIONES (solo Osmosis) Y CONVERTIR A ARRAY ======
    const groupedArray = Object.values(groupedLogs)
      .map(log => {
        if (!isNivel) {
          if (log.flujo_produccion != null) {
            log.flujo_produccion = applySpecialProductLogic('flowrate_speed_1', log.flujo_produccion);
          }
          if (log.flujo_rechazo != null) {
            log.flujo_rechazo = applySpecialProductLogic('flowrate_speed_2', log.flujo_rechazo);
          }
          if (log.production_volume != null) {
            log.production_volume = applySpecialProductLogic('flowrate_total_1', log.production_volume);
          }
          if (log.rejected_volume != null) {
            log.rejected_volume = applySpecialProductLogic('flowrate_total_2', log.rejected_volume);
          }
        }
        return log;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordenar descendente
      .slice(0, parseInt(limit)); // Limitar resultados

    const nextLastRowKey = groupedArray.length > 0 ? groupedArray[groupedArray.length - 1]._id : null;

    return res.json({
      success: true,
      data: groupedArray,
      next_last_row_key: nextLastRowKey,
      source,
    });

  } catch (error) {
    console.error('❌ Error fetching product logs:', error);
    return res.status(500).json({ message: 'Error fetching product logs' });
  }
};

function mapTuyaLogs(tuyaData) {
  const grouped = {};

  tuyaData.forEach(item => {
    const ts = item.event_time;
    if (!grouped[ts]) grouped[ts] = { date: ts, source: 'tuya' };

    switch (item.code) {
      case 'flowrate_speed_1':
        grouped[ts].flujo_produccion = Number(item.value);
        break;
      case 'flowrate_speed_2':
        grouped[ts].flujo_rechazo = Number(item.value);
        break;
      case 'flowrate_total_1':
        grouped[ts].production_volume = Number(item.value);
        break;
      case 'flowrate_total_2':
        grouped[ts].rejected_volume = Number(item.value);
        break;
      case 'tds_out':
        grouped[ts].tds = Number(item.value);
        break;
    }
  });

  return Object.values(grouped).sort((a, b) => b.date - a.date);
}

/** Map Tuya device logs for Nivel products: liquid_level_percent → flujo_rechazo, liquid_depth → flujo_produccion */
function mapTuyaLogsNivel(tuyaData) {
  const grouped = {};

  tuyaData.forEach(item => {
    const ts = item.event_time;
    if (!grouped[ts]) grouped[ts] = { date: ts, source: 'tuya' };

    switch (item.code) {
      case 'liquid_level_percent':
        grouped[ts].flujo_rechazo = Number(item.value);
        break;
      case 'liquid_depth':
        grouped[ts].flujo_produccion = Number(item.value);
        break;
    }
  });

  return Object.values(grouped).sort((a, b) => b.date - a.date);
}




// logs for products from logs table local logs
// export const getProductLogsById = async (req, res) => {
//   try {
//     devLog('Fetching product logs for:', req.query);

//     const {
//       id,
//       start_date,
//       end_date,
//       fields,
//       limit = 20,
//       last_row_key = null,
//     } = req.query.params || {};

//     if (!id) {
//       return res.status(400).json({ message: 'Missing required parameter: id' });
//     }

//     const query = {
//       product_id: id,
//     };

//     if (start_date && end_date) {
//       query.createdAt = {
//         $gte: new Date(Number(start_date)),
//         $lte: new Date(Number(end_date)),
//       };
//     }

//     const logs = await ProductLogModel.find(query)
//       .sort({ createdAt: -1 }) // orden descendente por fecha
//       .limit(parseInt(limit));

//     const nextLastRowKey = logs.length > 0 ? logs[logs.length - 1]._id : null;

//     return res.json({
//       success: true,
//       data: logs,
//       next_last_row_key: nextLastRowKey,
//     });

//   } catch (error) {
//     console.error('Error fetching product logs:', error);
//     return res.status(500).json({ message: 'Error fetching product logs' });
//   }
// };

// Save a product from Tuya API to Postgres
export const saveProduct = async (req, res) => {
  try {
    devLog('Fetching product from Tuya API...');
    const { id } = req.params;
    const response = await tuyaService.getDeviceDetail(id);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }

    const clientes = await ClientModel.find();
    const defaultCliente = clientes.find(c => c.name === 'Caffenio') || clientes.find(c => c.name === 'All') || clientes[0];
    const productData = {
      ...response.data,
      cliente: defaultCliente?.id,
      product_type: productos_nivel.includes(response.data?.id) ? 'Nivel' : 'Osmosis',
      city: response.data?.city || 'Hermosillo',
      state: response.data?.state || 'Sonora',
    };

    const newProduct = await ProductModel.create(productData);
    if (!newProduct) {
      return res.status(500).json({ message: 'Failed to create product' });
    }
    devLog(`Product ${id} saved to Postgres.`);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ message: 'Error saving product' });
  }
};

// Fetch and update product metrics
export const getProductMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ProductModel.findByDeviceId(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const tuyaDetailId = resolveTuyaLiveDeviceIdForTuyaApi(product) || id;
    devLog('Fetching status from Tuya API...');
    const response = await tuyaService.getDeviceDetail(tuyaDetailId);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }

    const status = Array.isArray(response.data?.status) ? response.data.status : (response.data?.status ?? []);
    const updated = await ProductModel.update(id, { status, update_time: Date.now() });
    if (!updated) {
      return res.status(500).json({ message: 'Failed to update product' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error fetching product metrics:', error);
    res.status(500).json({ message: 'Error fetching product metrics' });
  }
};

// Execute commands on a device
export const sendDeviceCommands = async (req, res) => {
  try {
    devLog('Executing device commands...', req.body);
    const { id, commands } = req.body; // Extract from request body

    if (!id || !commands || !Array.isArray(commands)) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
      return res.status(400).json({ message: "Invalid request payload" });
    }

    const productRow = await ProductModel.findByDeviceId(id);
    const tuyaCmdId = resolveTuyaLiveDeviceIdForTuyaApi(productRow) || id;
    devLog(`Sending commands to device ${tuyaCmdId} (ruta ${id}):`, commands);

    const response = await tuyaService.executeCommands({ id: tuyaCmdId, commands });
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }
    devLog('response commands:', response);
    // await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating delay
    // const response = { executed: true };
    const deviceData = await tuyaService.getDeviceDetail(tuyaCmdId);
    if (!deviceData.success) {
      return res.status(400).json({ message: deviceData.error, code: deviceData.code });
    }

    res.json({executed: true, deviceData: deviceData.result});
  } catch (error) {
    console.error("Error executing device command:", error);
    res.status(500).json({ message: "Error executing device command" });
  }
};


/* ======================================================
   🔧 Funciones auxiliares para cada tipo de producto
   ====================================================== */

// 🧩 — OSMOSIS
async function handleOsmosisProduct(product, data) {
  devLog('🧩 [Osmosis] Procesando actualización...');
  const {
    pressure_valve1_psi,
    pressure_valve2_psi,
    pressure_difference_psi,
    relay_state,
    temperature,
    timestamp,
    flujo_prod,
    flujo_rech,
    tds
  } = data;

  // Función helper para actualizar o crear status
  const updateStatus = (code, value) => {
    if (value == null) return; // No actualizar si el valor es null o undefined
    
    const existingStatus = product.status.find(st => st.code === code);
    if (existingStatus) {
      existingStatus.value = Number(value);
      devLog(`🔄 [Osmosis] ${code} actualizado: ${value}`);
    } else {
      product.status.push({ code, value: Number(value) });
      devLog(`➕ [Osmosis] ${code} agregado: ${value}`);
    }
  };

  // Función helper para sumar a un status existente
  const addToStatus = (code, valueToAdd, defaultValue = 0) => {
    if (valueToAdd == null || valueToAdd === 0) return; // No sumar si el valor es null, undefined o 0
    
    const existingStatus = product.status.find(st => st.code === code);
    const currentValue = existingStatus ? Number(existingStatus.value) || defaultValue : defaultValue;
    const newValue = Math.round((currentValue + Number(valueToAdd)) * 100) / 100; // Redondear a 2 decimales
    
    if (existingStatus) {
      existingStatus.value = newValue;
      devLog(`➕ [Osmosis] ${code} incrementado: ${currentValue.toFixed(2)} + ${Number(valueToAdd).toFixed(4)} = ${newValue.toFixed(2)}`);
    } else {
      product.status.push({ code, value: newValue });
      devLog(`➕ [Osmosis] ${code} creado con valor: ${newValue.toFixed(2)}`);
    }
  };

  // Actualizar valores directamente (reemplazar, no sumar)
  // Usar los códigos correctos que existen en el producto
  if (flujo_prod != null) {
    updateStatus('flowrate_speed_1', flujo_prod);
    
    // Acumular en flowrate_total_1 usando el timestamp para calcular el tiempo real transcurrido
    if (timestamp != null) {
      const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : Number(timestamp);
      const lastTimestampStatus = product.status.find(s => s.code === 'last_flow_timestamp');
      const lastTimestamp = lastTimestampStatus ? (typeof lastTimestampStatus.value === 'string' ? parseInt(lastTimestampStatus.value, 10) : Number(lastTimestampStatus.value)) : null;
      
      if (lastTimestamp != null && !isNaN(lastTimestamp) && !isNaN(timestampNum) && timestampNum > lastTimestamp) {
        // Calcular tiempo transcurrido en milisegundos
        const deltaTimeMs = timestampNum - lastTimestamp;
        // Calcular litros acumulados: flujo_prod (L/min) * tiempo (ms) / 60000 (ms por minuto)
        const litrosPorIntervalo = (Number(flujo_prod) * deltaTimeMs) / 60000;
        addToStatus('flowrate_total_1', litrosPorIntervalo, 0);
        devLog(`⏱️ [Osmosis] Tiempo transcurrido: ${deltaTimeMs}ms, Litros acumulados: ${litrosPorIntervalo.toFixed(4)} L`);
      } else if (lastTimestamp == null) {
        // Primera vez, usar un valor conservador (asumir 1 segundo si no hay timestamp previo)
        const litrosPorIntervalo = Number(flujo_prod) / 60;
        addToStatus('flowrate_total_1', litrosPorIntervalo, 0);
        devLog(`⏱️ [Osmosis] Primera llamada, usando 1 segundo por defecto`);
      }
      
      // Actualizar el último timestamp
      updateStatus('last_flow_timestamp', timestampNum);
    } else {
      // Si no hay timestamp, usar el método anterior (asumir 1 segundo)
      const litrosPorIntervalo = Number(flujo_prod) / 60;
      addToStatus('flowrate_total_1', litrosPorIntervalo, 0);
    }
  }
  
  if (flujo_rech != null) {
    updateStatus('flowrate_speed_2', flujo_rech);
    
    // Acumular en flowrate_total_2 usando el timestamp para calcular el tiempo real transcurrido
    if (timestamp != null) {
      const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : Number(timestamp);
      const lastTimestampStatus = product.status.find(s => s.code === 'last_flow_timestamp');
      const lastTimestamp = lastTimestampStatus ? (typeof lastTimestampStatus.value === 'string' ? parseInt(lastTimestampStatus.value, 10) : Number(lastTimestampStatus.value)) : null;
      
      if (lastTimestamp != null && !isNaN(lastTimestamp) && !isNaN(timestampNum) && timestampNum > lastTimestamp) {
        // Calcular tiempo transcurrido en milisegundos
        const deltaTimeMs = timestampNum - lastTimestamp;
        // Calcular litros acumulados: flujo_rech (L/min) * tiempo (ms) / 60000 (ms por minuto)
        const litrosPorIntervalo = (Number(flujo_rech) * deltaTimeMs) / 60000;
        addToStatus('flowrate_total_2', litrosPorIntervalo, 0);
        devLog(`⏱️ [Osmosis] Tiempo transcurrido: ${deltaTimeMs}ms, Litros rechazo acumulados: ${litrosPorIntervalo.toFixed(4)} L`);
      } else if (lastTimestamp == null) {
        // Primera vez, usar un valor conservador (asumir 1 segundo si no hay timestamp previo)
        const litrosPorIntervalo = Number(flujo_rech) / 60;
        addToStatus('flowrate_total_2', litrosPorIntervalo, 0);
      }
    } else {
      // Si no hay timestamp, usar el método anterior (asumir 1 segundo)
      const litrosPorIntervalo = Number(flujo_rech) / 60;
      addToStatus('flowrate_total_2', litrosPorIntervalo, 0);
    }
  }

  if (tds != null) {
    updateStatus('tds_out', tds);
  }

  if (temperature != null) {
    updateStatus('temperature', temperature);
  }

  // Actualizar otros status si existen
  if (pressure_difference_psi != null) {
    updateStatus('pressure_difference', pressure_difference_psi);
  }

  if (relay_state != null) {
    updateStatus('relay_state', relay_state);
  }

  const currentRelay = relay_state;
  const startTime = product.status.find(s => s.code === 'start_time');

  if (currentRelay === true && !startTime) {
    product.status.push({ code: 'start_time', value: timestamp });
    devLog('▶️ [Osmosis] Ciclo iniciado');
  } else if (currentRelay === false && startTime) {
    const elapsed = Math.max(0, timestamp - startTime.value);
    devLog(`⏱️ [Osmosis] Ciclo completado en ${elapsed} ms`);

    const litrosProd = (pressure_valve1_psi / 100) * (elapsed / 1000);
    const litrosRech = (pressure_valve2_psi / 100) * (elapsed / 1000);

    // Nota: Los flujos ahora se actualizan directamente arriba, pero mantenemos esta lógica
    // por si acaso se necesita más adelante para acumulación de volúmenes
    devLog(
      `💧 [Osmosis] Volumen producción: ${litrosProd.toFixed(2)} L | Volumen rechazo: ${litrosRech.toFixed(2)} L`
    );

    // Eliminar start_time tras finalizar ciclo
    product.status = product.status.filter(s => s.code !== 'start_time');
  }

  await ProductModel.update(product.id, product);
  devLog('💾 [Osmosis] Datos de osmosis actualizados correctamente');

  // Guardar log en ProductLog si hay datos relevantes
  if (flujo_prod != null || flujo_rech != null || tds != null || temperature != null) {
    try {
      // Convertir timestamp a Date
      let logDate = new Date();
      if (timestamp) {
        const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        // Si el timestamp parece ser en milisegundos (más de 13 dígitos) o si es muy grande, usarlo directamente
        // Si es pequeño, podría ser relativo, usar Date.now()
        if (!isNaN(timestampNum) && timestampNum > 1000000000000) {
          logDate = new Date(timestampNum);
        } else if (!isNaN(timestampNum) && timestampNum > 0) {
          // Asumir que es un timestamp relativo en milisegundos desde algún inicio
          // Por ahora usar Date.now() para logs en tiempo real
          logDate = new Date();
        }
      }

      const logData = {
        producto: product._id,
        product_id: product.id || product._id.toString(),
        flujo_produccion: flujo_prod != null ? Number(flujo_prod) : null,
        flujo_rechazo: flujo_rech != null ? Number(flujo_rech) : null,
        tds: tds != null ? Number(tds) : null,
        temperature: temperature != null ? Number(temperature) : null,
        date: logDate,
        source: 'esp32',
      };

      // Verificar si ya existe un log similar (evitar duplicados basado en fecha y product_id)
      const existingLog = await ProductLogModel.findOne({
        product_id: logData.product_id,
        date: {
          $gte: new Date(logDate.getTime() - 1000), // 1 segundo antes
          $lte: new Date(logDate.getTime() + 1000), // 1 segundo después
        },
      });

      if (!existingLog) {
        await ProductLogModel.create(logData);
        devLog(`📝 [Osmosis] Log guardado en ProductLog - TDS: ${tds}, Flujo Prod: ${flujo_prod}, Flujo Rech: ${flujo_rech}`);
      } else {
        devLog(`⏭️ [Osmosis] Log duplicado omitido para fecha ${logDate.toISOString()}`);
      }
    } catch (logError) {
      console.error('❌ [Osmosis] Error guardando log en ProductLog:', logError.message);
      // No lanzar el error para no interrumpir el flujo principal
    }
  }

  return { success: true, message: 'Datos de osmosis actualizados', product };
}

// ⚙️ — PRESIÓN
// 🔧 Lógica específica para productos de tipo "pressure"
async function handlePressureProduct(product, data) {
  // devLog('🔧 [handlePressure] Iniciando procesamiento del producto de tipo Pressure...');
  
  // Acceso seguro y normalización de nombres
  const inPsi  = data.pressure_valve1_psi ?? data.presion_in;
  const outPsi = data.pressure_valve2_psi ?? data.presion_out;
  const pressure_difference_psi = data.pressure_difference_psi;
  const relay_state             = data.relay_state;
  const temperature             = data.temperature;
  const voltage_in              = data.voltage_in;
  const voltage_out             = data.voltage_out;

  // devLog('📦 [handlePressure] Datos recibidos:', {
  //   inPsi, outPsi, pressure_difference_psi, relay_state, temperature, voltage_in, voltage_out
  // });

  // Solo los códigos estándar para Pressure (incluyendo voltajes para monitoreo)
  const allowedCodes = ['presion_in', 'presion_out', 'pressure_difference_psi', 'relay_state', 'temperature', 'voltage_in', 'voltage_out'];
  if (!Array.isArray(product.status)) {
    // devLog('🧩 [handlePressure] No existe array de status, creando uno nuevo.');
    product.status = [];
  }
  product.status = product.status.filter(s => allowedCodes.includes(s.code));

  // devLog('📋 [handlePressure] Status actual antes de actualizar:', JSON.stringify(product.status, null, 2));

  // Sólo almacena los códigos normalizados
  const updates = [
    { code: 'presion_in', value: inPsi },
    { code: 'presion_out', value: outPsi },
    { code: 'pressure_difference_psi', value: pressure_difference_psi },
    { code: 'relay_state', value: relay_state },
    { code: 'temperature', value: temperature },
    { code: 'voltage_in', value: voltage_in },
    { code: 'voltage_out', value: voltage_out },
  ];

  for (const { code, value } of updates) {
    // Validación estándar: omitir valores null o undefined
    if (value === undefined || value === null) {
      // devLog(`⚠️ [handlePressure] Valor omitido para '${code}' (undefined o null)`);
      continue;
    }

    // Validación adicional para voltajes: deben ser números válidos (opcionales)
    if ((code === 'voltage_in' || code === 'voltage_out')) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 5) {
        // devLog(`⚠️ [handlePressure] Valor de voltaje inválido para '${code}': ${value} (omitido)`);
        continue;
      }
    }

    const existing = product.status.find((s) => s.code === code);
    if (existing) {
      // devLog(`🔁 [handlePressure] Actualizando '${code}' de ${existing.value} → ${value}`);
      existing.value = value;
    } else {
      // devLog(`➕ [handlePressure] Agregando nuevo status '${code}' = ${value}`);
      product.status.push({ code, value });
    }
  }

  try {
    await ProductModel.update(product.id, product);
  } catch (err) {
    console.error('❌ [handlePressure] Error al guardar producto:', err);
    throw err;
  }

  // Verificación post-save
  const refreshed = await ProductModel.findById(product._id);
  // devLog('🧩 [handlePressure] Status final guardado en DB:', JSON.stringify(refreshed.status, null, 2));

  return { success: true, message: 'Datos de presión actualizados', product: refreshed };
}


// 🌊 — NIVEL
async function handleLevelProduct(product, data) {
  devLog('🌊 [Nivel] Procesando actualización...');
  const { liquid_depth, liquid_state, liquid_level_percent, max_set, mini_set } = data;

  if (!product.status) product.status = [];

  const updates = [
    { code: 'liquid_state', value: liquid_state },
    { code: 'liquid_depth', value: liquid_depth },
    { code: 'liquid_level_percent', value: liquid_level_percent },
    { code: 'max_set', value: max_set },
    { code: 'mini_set', value: mini_set },
  ];

  for (const { code, value } of updates) {
    if (value === undefined || value === null) continue;

    const existing = product.status.find(s => s.code === code);
    if (existing) {
      existing.value = value;
      devLog(`🔁 [Nivel] Actualizado '${code}' = ${value}`);
    } else {
      product.status.push({ code, value });
      devLog(`➕ [Nivel] Agregado nuevo status '${code}' = ${value}`);
    }
  }

  await ProductModel.update(product.id, product);
  devLog('💾 [Nivel] Datos de nivel actualizados correctamente');
  return { success: true, message: 'Datos de nivel actualizados', product };
}

/* ======================================================
   🎯 Función principal
   ====================================================== */

export const componentInput = async (req, res) => {
  try {
     devLog('📥 [componentInput] Body recibido:', req.body);

    const {
      productId = '',
      pressure_valve1_psi = null,
      pressure_valve2_psi = null,
      presion_in = null,
      presion_out = null,
      pressure_difference_psi = null,
      relay_state = null,
      temperature = null,
      liquid_depth = null,
      liquid_state = null,
      liquid_level_percent = null,
      max_set = null,
      mini_set = null,
      timestamp = null,
      flujo_prod = null,
      flujo_rech = null,
      tds = null,
      voltage_in = null,
      voltage_out = null
    } = req.body;

    if (!productId) {
      // devLog('⚠️ [componentInput] Faltan datos requeridos');
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const product = await ProductModel.findByIdOrDeviceId(productId);
    if (!product) {
      // devLog('❌ [componentInput] Producto no encontrado');
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // devLog(`✅ [componentInput] Producto encontrado: ${product.name} (${product.product_type || product.type})`);

    const data = {
      // Para Pressure: admite presion_in / presion_out o pressure_valve1_psi / pressure_valve2_psi
      pressure_valve1_psi: pressure_valve1_psi ?? presion_in,
      pressure_valve2_psi: pressure_valve2_psi ?? presion_out,
      pressure_difference_psi,
      relay_state,
      temperature,
      liquid_depth,
      liquid_state,
      liquid_level_percent,
      max_set,
      mini_set,
      timestamp,
      voltage_in,
      voltage_out,
      // Para Osmosis: flujos y TDS
      flujo_prod,
      flujo_rech,
      tds,
    };

    let result;

    switch (product.product_type || product.type) {
      case 'osmosis':
      case 'Osmosis':
        result = await handleOsmosisProduct(product, data);
        break;

      case 'Pressure':
      case 'Presión':
      case 'Presion':
        result = await handlePressureProduct(product, data);
        break;

      case 'nivel':
      case 'Nivel':
        result = await handleLevelProduct(product, data);
        break;

      default:
        await ProductModel.update(product.id, product);
        result = { success: true, message: 'Producto actualizado sin lógica especial', product };
        break;
    }

    return res.json(result);
  } catch (error) {
    console.error('🔥 [componentInput] Error inesperado:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// 🔁 Actualiza o reemplaza valores
const updateStatusValue = (product, code, newValue) => {
  const index = product.status.findIndex(s => s.code === code);
  if (index !== -1) {
    product.status[index].value = newValue;
  } else {
    product.status.push({ code, value: newValue });
  }
};

// 🔼 Suma acumulativa a valores existentes
const sumStatusValue = (product, code, increment) => {
  const index = product.status.findIndex(s => s.code === code);
  if (index !== -1) {
    product.status[index].value += increment;
  } else {
    product.status.push({ code, value: increment });
  }
};

  
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (angle) => (Math.PI * angle) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getClosestCity(lat, lon, mexicoCities) {
  let closestCity = mexicoCities[0];
  let minDistance = haversine(lat, lon, closestCityModel.lat, closestCityModel.lon);

  for (const city of mexicoCities) {
      const distance = haversine(lat, lon, city.lat, city.lon);
      if (distance < minDistance) {
          minDistance = distance;
          closestCity = city;
      }
  }

  return closestCity;
};

async function getCities() {
  try {
    const mexicoCities = await CityModel.findAll();
    return mexicoCities;
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ message: 'Error fetching active users' });
  }
}

async function getClients() {
  try {
    const clients = await ClientModel.find();
    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
}

function getRandomCoordinateInMexico(mexicoCities) {
  // // Select two random cities
  // const city1 = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];
  // const city2 = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];

  // // Ensure latitudes and longitudes are valid (lat1 < lat2 and lon1 < lon2)
  // const latMin = Math.min(city1.lat, city2.lat);
  // const latMax = Math.max(city1.lat, city2.lat);
  // const lonMin = Math.min(city1.lon, city2.lon);
  // const lonMax = Math.max(city1.lon, city2.lon);

  // // Generate random coordinates between the two cities
  // const lat = (Math.random() * (latMax - latMin) + latMin).toFixed(4);
  // const lon = (Math.random() * (lonMax - lonMin) + lonMin).toFixed(4);
    // Select a random city from the list
    const city = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];
    // Return the coordinates of the randomly selected city
    const lat = city.lat.toFixed(4);
    const lon = city.lon.toFixed(4);
    return { lat, lon };
}
// cities detailed
// const mexicoCities = [
//   { state: "Aguascalientes", city: "Jesus Maria", lat: 21.9614, lon: -102.3436 },
//   { state: "Aguascalientes", city: "Calvillo", lat: 21.8456, lon: -102.7181 },
  
//   { state: "Baja California", city: "Mexicali", lat: 32.6245, lon: -115.4523 },
//   { state: "Baja California", city: "Ensenada", lat: 31.8667, lon: -116.5997 },

//   { state: "Baja California Sur", city: "Cabo San Lucas", lat: 22.8909, lon: -109.9124 },
//   { state: "Baja California Sur", city: "San Jose del Cabo", lat: 23.0631, lon: -109.7028 },

//   { state: "Campeche", city: "Ciudad del Carmen", lat: 18.6516, lon: -91.8078 },
//   { state: "Campeche", city: "Champoton", lat: 19.3447, lon: -90.7261 },

//   { state: "Chiapas", city: "Tapachula", lat: 14.9031, lon: -92.2575 },
//   { state: "Chiapas", city: "San Cristobal de las Casas", lat: 16.737, lon: -92.6376 },

//   { state: "Chihuahua", city: "Ciudad Juarez", lat: 31.7398, lon: -106.485 },
//   { state: "Chihuahua", city: "Delicias", lat: 28.1915, lon: -105.4717 },

//   { state: "Coahuila", city: "Torreon", lat: 25.5428, lon: -103.4068 },
//   { state: "Coahuila", city: "Monclova", lat: 26.9007, lon: -101.4208 },

//   { state: "Colima", city: "Manzanillo", lat: 19.05, lon: -104.3333 },
//   { state: "Colima", city: "Tecoman", lat: 18.9167, lon: -103.8833 },

//   { state: "Durango", city: "Gomez Palacio", lat: 25.5647, lon: -103.4966 },
//   { state: "Durango", city: "Lerdo", lat: 25.5388, lon: -103.5248 },

//   { state: "Guanajuato", city: "Irapuato", lat: 20.6761, lon: -101.3563 },
//   { state: "Guanajuato", city: "Celaya", lat: 20.5233, lon: -100.815 },

//   { state: "Guerrero", city: "Zihuatanejo", lat: 17.6383, lon: -101.5515 },
//   { state: "Guerrero", city: "Chilpancingo", lat: 17.5514, lon: -99.5058 },

//   { state: "Hidalgo", city: "Tizayuca", lat: 19.8367, lon: -98.9808 },
//   { state: "Hidalgo", city: "Tulancingo", lat: 20.0833, lon: -98.3667 },

//   { state: "Jalisco", city: "Zapopan", lat: 20.7167, lon: -103.4 },
//   { state: "Jalisco", city: "Puerto Vallarta", lat: 20.6534, lon: -105.2253 },

//   { state: "Mexico", city: "Ecatepec", lat: 19.6097, lon: -99.06 },
//   { state: "Mexico", city: "Naucalpan", lat: 19.4785, lon: -99.2396 },

//   { state: "Michoacan", city: "Uruapan", lat: 19.4167, lon: -102.05 },
//   { state: "Michoacan", city: "Zamora", lat: 19.9856, lon: -102.2839 },

//   { state: "Morelos", city: "Jiutepec", lat: 18.8826, lon: -99.1775 },
//   { state: "Morelos", city: "Cuautla", lat: 18.8121, lon: -98.9542 },

//   { state: "Nayarit", city: "Bahia de Banderas", lat: 20.8031, lon: -105.2048 },
//   { state: "Nayarit", city: "Compostela", lat: 21.2333, lon: -104.9 },

//   { state: "Nuevo Leon", city: "San Nicolas de los Garza", lat: 25.7492, lon: -100.289 },
//   { state: "Nuevo Leon", city: "San Pedro Garza Garcia", lat: 25.6578, lon: -100.4022 },

//   { state: "Oaxaca", city: "Salina Cruz", lat: 16.1667, lon: -95.2 },
//   { state: "Oaxaca", city: "Juchitan de Zaragoza", lat: 16.4342, lon: -95.0203 },

//   { state: "Puebla", city: "Tehuacan", lat: 18.4667, lon: -97.4 },
//   { state: "Puebla", city: "Atlixco", lat: 18.9, lon: -98.4333 },

//   { state: "Queretaro", city: "San Juan del Rio", lat: 20.3833, lon: -99.9833 },
//   { state: "Queretaro", city: "El Marques", lat: 20.5667, lon: -100.2833 },

//   { state: "Quintana Roo", city: "Playa del Carmen", lat: 20.6296, lon: -87.0739 },
//   { state: "Quintana Roo", city: "Chetumal", lat: 18.5036, lon: -88.305 },

//   { state: "San Luis Potosi", city: "Ciudad Valles", lat: 21.9833, lon: -99.0167 },
//   { state: "San Luis Potosi", city: "Matehuala", lat: 23.65, lon: -100.65 },

//   { state: "Sinaloa", city: "Mazatlan", lat: 23.2167, lon: -106.4167 },
//   { state: "Sinaloa", city: "Los Mochis", lat: 25.7903, lon: -108.99 },

//   { state: "Sonora", city: "Nogales", lat: 31.305, lon: -110.9442 },
//   { state: "Sonora", city: "Cajeme", lat: 27.4926, lon: -109.9304 },

//   { state: "Tamaulipas", city: "Reynosa", lat: 26.0922, lon: -98.2772 },
//   { state: "Tamaulipas", city: "Matamoros", lat: 25.8697, lon: -97.5025 },

//   { state: "Veracruz", city: "Coatzacoalcos", lat: 18.1333, lon: -94.45 },
//   { state: "Veracruz", city: "Orizaba", lat: 18.85, lon: -97.1 },

//   { state: "Yucatan", city: "Valladolid", lat: 20.6897, lon: -88.2011 },
//   { state: "Yucatan", city: "Tizimin", lat: 21.1422, lon: -88.1508 }
// ];


/* ======================================================
   🔄 RUTINA DE LOGS - Fetch logs from Tuya and save to DB
   ====================================================== */

/**
 * Runs the actual logs fetch in the background (no HTTP response).
 * Used so the API can return 202 immediately and not block login/other requests.
 */
async function runFetchLogsRoutineInBackground() {
  // Re-fetch product list for this run
  const enabledProducts = await ProductModel.find({ tuya_logs_routine_enabled: true });
  const productosWhitelist = (enabledProducts || []).map((p) => ({
    id: p.id,
    type: p.product_type || 'Osmosis',
  }));
  if (!productosWhitelist || productosWhitelist.length === 0) {
    devWarn('⚠️ [fetchLogsRoutine] No hay productos con rutina de logs habilitada');
    return;
  }
  devLog('🔄 [fetchLogsRoutine] Iniciando rutina en segundo plano...');
  devLog(`📋 [fetchLogsRoutine] Procesando ${productosWhitelist.length} productos...`);
  await doFetchLogsRoutineWork(productosWhitelist);
}

/**
 * Core work for fetchLogsRoutine (shared by background and optional sync path).
 * Safe to run at any cron interval (e.g. every 5, 15, or 30 min): each run fetches the last 1 hour
 * from Tuya and skips inserts for (product_id, date) that already exist, so no data is missed.
 */
async function doFetchLogsRoutineWork(productosWhitelist) {
  try {
    // ====== CONFIGURACIÓN DE TIEMPO ======
    const now = Date.now();
    // Ventana de búsqueda: 1 hora. Tuya (cuenta dev) solo devuelve máx 100 registros por código,
    // así que una ventana corta asegura que pedimos "lo más reciente" y no cambia la cantidad.
    const timeRangeMs = 60 * 60 * 1000; // 1 hora
    const startTime = now - timeRangeMs;
    
    // Crear objetos Date
    const nowDate = new Date(now);
    const startDate = new Date(startTime);
    
    // Formatear para zona horaria de Hermosillo
    const formatOptions = {
      timeZone: 'America/Hermosillo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const nowLocal = nowDate.toLocaleString('es-MX', formatOptions);
    const startLocal = startDate.toLocaleString('es-MX', formatOptions);
    
    devLog(`⏰ [fetchLogsRoutine] Hora actual del servidor:`);
    devLog(`   - Hermosillo: ${nowLocal}`);
    devLog(`   - UTC: ${nowDate.toISOString()}`);
    devLog(`   - Timestamp: ${now}`);
    
    devLog(`⏰ [fetchLogsRoutine] Rango de búsqueda (última 1 hora, Tuya dev limit 100/código):`);
    devLog(`   - Desde (Hermosillo): ${startLocal}`);
    devLog(`   - Hasta (Hermosillo): ${nowLocal}`);
    devLog(`   - Timestamps: ${startTime} a ${now}`);

    // ====== CÓDIGOS DE LOGS POR TIPO DE PRODUCTO ======
    const logCodesByType = {
      'Osmosis': [
        'flowrate_speed_1',
        'flowrate_speed_2',
        'flowrate_total_1',
        'flowrate_total_2',
        'tds_out'
      ],
      'Nivel': [
        'liquid_depth',
        'liquid_level_percent'
      ]
    };

    const results = {
      success: [],
      errors: [],
      totalLogsInserted: 0,
    };

    /** Tuya error 28841004 = "Trial Edition quota used up". Abort routine immediately to avoid blocking login/API for minutes. */
    const TUYA_QUOTA_EXCEEDED_CODE = 28841004;
    let tuyaQuotaExceeded = false;

    // ====== PROCESAR CADA PRODUCTO ======
    for (const productConfig of productosWhitelist) {
      if (tuyaQuotaExceeded) break;
      const productId = productConfig.id;
      const productType = productConfig.type;
      const logCodes = logCodesByType[productType] || logCodesByType['Osmosis'];
      try {
        devLog(`\n📦 [fetchLogsRoutine] Procesando producto: ${productId} (Tipo: ${productType})`);

        // Verificar que el producto existe en la BD
        const product = await ProductModel.findByDeviceId(productId);
        if (!product) {
          devWarn(`⚠️ [fetchLogsRoutine] Producto ${productId} no encontrado en BD`);
          results.errors.push({
            productId,
            error: 'Product not found in database',
          });
          continue;
        }

        const tuyaDeviceId = resolveTuyaLiveDeviceIdForTuyaApi(product) || productId;

        // ====== OBTENER LOGS DE TUYA POR CADA CÓDIGO (SEPARADO) ======
        // Es importante hacer consultas separadas ya que cada una tiene límite de 100 registros
        const allTuyaLogs = [];
        let totalLogsFetched = 0;

        for (const code of logCodes) {
          try {
            devLog(`🔍 [fetchLogsRoutine] Obteniendo logs de código '${code}' para ${tuyaDeviceId} (fila ${productId})...`);
            
            const filters = {
              id: tuyaDeviceId,
              start_date: startTime,
              end_date: now,
              fields: code, // ⚠️ IMPORTANTE: Solo un código a la vez
              size: 100, // Últimos 100 logs por código
            };

            const response = await tuyaService.getDeviceLogsForRoutine(filters);

            if (response.code === TUYA_QUOTA_EXCEEDED_CODE) {
              tuyaQuotaExceeded = true;
              devWarn(`⚠️ [fetchLogsRoutine] Tuya Trial quota exceeded (${TUYA_QUOTA_EXCEEDED_CODE}). Aborting routine to avoid blocking API/login.`);
              break;
            }
            if (response.success && response.data && response.data.logs && response.data.logs.length > 0) {
              const codeLogs = response.data.logs;
              allTuyaLogs.push(...codeLogs);
              totalLogsFetched += codeLogs.length;
              devLog(`  ✅ ${codeLogs.length} logs obtenidos para código '${code}'`);
            } else {
              devLog(`  ⚠️ No se encontraron logs para código '${code}'`);
            }

            // Pequeña pausa entre requests para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (codeError) {
            console.error(`  ❌ Error obteniendo logs para código '${code}':`, codeError.message);
          }
        }

        if (allTuyaLogs.length === 0) {
          devWarn(`⚠️ [fetchLogsRoutine] No se encontraron logs en Tuya para ${productId}`);
          results.errors.push({
            productId,
            error: 'No logs found in Tuya',
          });
          continue;
        }

        devLog(`✅ [fetchLogsRoutine] Total ${totalLogsFetched} logs obtenidos de Tuya para ${productId} (${logCodes.length} códigos)`);

        // ====== AGRUPAR LOGS POR TIMESTAMP ======
        const groupedLogs = {};

        allTuyaLogs.forEach(log => {
          const timestamp = log.event_time;
          
          if (!groupedLogs[timestamp]) {
            groupedLogs[timestamp] = {
              product_id: tuyaDeviceId,
              product_device_id: tuyaDeviceId,
              producto: product._id,
              date: new Date(timestamp),
              source: 'tuya',
              // Valores por defecto
              tds: 0,
              production_volume: 0,
              rejected_volume: 0,
              temperature: 0,
              flujo_produccion: 0,
              flujo_rechazo: 0,
              tiempo_inicio: Math.floor(timestamp / 1000),
              tiempo_fin: Math.floor(timestamp / 1000),
            };
          }

          // Mapear cada código según el tipo de producto
          if (productType === 'Osmosis') {
            switch (log.code) {
              case 'flowrate_speed_1':
                groupedLogs[timestamp].flujo_produccion = Number(log.value) || 0;
                break;
              case 'flowrate_speed_2':
                groupedLogs[timestamp].flujo_rechazo = Number(log.value) || 0;
                break;
              case 'flowrate_total_1':
                // Tuya reports totals in 0.1 L steps; store liters like API display / reporte mensual
                groupedLogs[timestamp].production_volume = (Number(log.value) || 0) / 10;
                break;
              case 'flowrate_total_2':
                groupedLogs[timestamp].rejected_volume = (Number(log.value) || 0) / 10;
                break;
              case 'tds_out':
                groupedLogs[timestamp].tds = Number(log.value) || 0;
                break;
            }
          } else if (productType === 'Nivel') {
            // Para productos tipo Nivel, mapear a campos disponibles
            switch (log.code) {
              case 'liquid_depth':
                // Mapear liquid_depth a flujo_produccion temporalmente
                groupedLogs[timestamp].flujo_produccion = Number(log.value) || 0;
                break;
              case 'liquid_level_percent':
                // Mapear liquid_level_percent a flujo_rechazo temporalmente
                groupedLogs[timestamp].flujo_rechazo = Number(log.value) || 0;
                break;
            }
          }
        });

        // ====== FILTRAR LOGS CON VALORES EN 0 ======
        const logsToSave = Object.values(groupedLogs).filter(log => {
          // Verificar que al menos un valor sea diferente de 0
          const hasValidData = 
            (log.tds !== 0) ||
            (log.production_volume !== 0) ||
            (log.rejected_volume !== 0) ||
            (log.flujo_produccion !== 0) ||
            (log.flujo_rechazo !== 0);
          
          return hasValidData;
        });

        devLog(`💾 [fetchLogsRoutine] ${logsToSave.length} logs con datos válidos para guardar (de ${Object.values(groupedLogs).length} totales)`);

        let insertedCount = 0;
        let duplicateCount = 0;
        let skippedZeros = Object.values(groupedLogs).length - logsToSave.length;

        for (const logData of logsToSave) {
          try {
            // Verificar si ya existe un log similar (evitar duplicados)
            const existingLog = await ProductLogModel.findOne({
              product_id: tuyaDeviceId,
              date: logData.date,
            });

            if (!existingLog) {
              await ProductLogModel.create(logData);
              insertedCount++;
            } else {
              duplicateCount++;
            }
          } catch (saveError) {
            console.error(`❌ [fetchLogsRoutine] Error guardando log individual:`, saveError.message);
          }
        }

        if (skippedZeros > 0) {
          devLog(`⏭️ [fetchLogsRoutine] ${skippedZeros} logs omitidos por tener todos los valores en 0`);
        }
        if (duplicateCount > 0) {
          devLog(`⏭️ [fetchLogsRoutine] ${duplicateCount} logs ya existían (duplicados omitidos) para ${productId}`);
        }

        devLog(`✅ [fetchLogsRoutine] ${insertedCount} logs insertados para ${productId}`);
        
        results.success.push({
          productId,
          logsInserted: insertedCount,
          totalLogsFromTuya: totalLogsFetched,
          codesFetched: logCodes.length,
        });

        results.totalLogsInserted += insertedCount;

      } catch (productError) {
        console.error(`❌ [fetchLogsRoutine] Error procesando producto ${productId}:`, productError.message);
        results.errors.push({
          productId,
          error: productError.message,
        });
      }
    }

    if (tuyaQuotaExceeded) {
      devLog('✅ [fetchLogsRoutine] Rutina abortada por cuota Tuya agotada');
      return;
    }

    // ====== FIN ======
    devLog('✅ [fetchLogsRoutine] Rutina completada');
    devLog(`📊 [fetchLogsRoutine] Resumen: ${results.success.length} exitosos, ${results.errors.length} errores`);
    devLog(`📊 [fetchLogsRoutine] Total logs insertados: ${results.totalLogsInserted}`);
  } catch (error) {
    console.error('❌ [fetchLogsRoutine] Error general en rutina:', error);
    throw error;
  }
}

/**
 * Routine para obtener logs de productos whitelist y guardarlos en la BD.
 * Responde 202 de inmediato y ejecuta la rutina en segundo plano para no bloquear login/otros requests.
 * Se puede llamar manualmente o por cron.
 */
export const fetchLogsRoutine = async (req, res) => {
  try {
    const enabledProducts = await ProductModel.find({ tuya_logs_routine_enabled: true });
    const productosWhitelist = (enabledProducts || []).map((p) => ({
      id: p.id,
      type: p.product_type || 'Osmosis',
    }));

    if (!productosWhitelist || productosWhitelist.length === 0) {
      devWarn('⚠️ [fetchLogsRoutine] No hay productos con rutina de logs habilitada');
      return res.status(400).json({
        success: false,
        message: 'No products with Tuya logs routine enabled. Enable them in Personalización > Productos rutina logs.',
      });
    }

    res.status(202).json({
      success: true,
      message: 'Logs routine started in background. Check server logs for completion.',
      startedAt: new Date().toISOString(),
      productsQueued: productosWhitelist.length,
    });

    setImmediate(() => {
      runFetchLogsRoutineInBackground().catch((err) => {
        console.error('❌ [fetchLogsRoutine] Background run failed:', err.message);
      });
    });
  } catch (error) {
    console.error('❌ [fetchLogsRoutine] Error starting routine:', error);
    return res.status(500).json({
      success: false,
      message: 'Error executing logs routine',
      error: error.message,
    });
  }
};

/**
 * Convierte fecha + hora local (Hermosillo) a timestamp ms
 */
function buildTimestamp(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD
  // timeStr: HH:mm:ss
  const localDate = new Date(`${dateStr}T${timeStr}-07:00`); // Hermosillo fijo
  return localDate.getTime();
}

/**
 * Genera arreglo de fechas entre start y end (inclusive)
 */
function getDateRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export const generarLogsPorFecha = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;

    if (!dateStart || !dateEnd) {
      return res.status(400).json({
        success: false,
        message: 'dateStart y dateEnd son requeridos',
      });
    }

    const PRODUCT_ID = 'ebea4ffa2ab1483940nrqn';

    const LOG_CODES = [
      // 'flowrate_speed_1', // Comentado: genera muchos registros
      // 'flowrate_speed_2', // Comentado: genera muchos registros
      'flowrate_total_1',
      'flowrate_total_2',
      'tds_out',
    ];

    const WINDOWS = [
      { label: 'mañana', start: '06:00:00', end: '06:01:00' },
      { label: 'tarde', start: '18:00:00', end: '18:01:00' },
    ];

    const product = await ProductModel.findByDeviceId(PRODUCT_ID);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado',
      });
    }

    const dates = getDateRange(dateStart, dateEnd);

    let totalInserted = 0;
    let totalFetched = 0;

    // Todos los códigos en un solo string separado por comas
    const allCodesString = LOG_CODES.join(',');

    // Delay entre ventana mañana y tarde
    const DELAY_BETWEEN_WINDOWS = 100; // 100ms

    for (const date of dates) {
      devLog(`📅 Procesando fecha ${date}`);

      // Procesar ventana de la mañana
      const morningWindow = WINDOWS[0];
      const morningStartTime = buildTimestamp(date, morningWindow.start);
      const morningEndTime = buildTimestamp(date, morningWindow.end);

      devLog(`⏰ Ventana ${morningWindow.label}: ${morningWindow.start} - ${morningWindow.end}`);
      devLog(`   Timestamps: ${morningStartTime} - ${morningEndTime}`);
      devLog(`   Fechas: ${new Date(morningStartTime).toISOString()} - ${new Date(morningEndTime).toISOString()}`);

      let morningLogs = [];
      try {
        // Un solo request con todos los códigos juntos
        const response = await tuyaService.getDeviceLogsForRoutine({
          id: PRODUCT_ID,
          start_date: morningStartTime,
          end_date: morningEndTime,
          fields: allCodesString, // Todos los códigos juntos separados por comas
          size: 100,
        });

        if (response?.success && response?.data?.logs?.length) {
          morningLogs = response.data.logs;
          totalFetched += morningLogs.length;
          devLog(`  ✅ ${morningLogs.length} logs obtenidos para ventana ${morningWindow.label}`);
          
          // Mostrar detalles de los logs obtenidos
          const codesCount = {};
          morningLogs.forEach(log => {
            codesCount[log.code] = (codesCount[log.code] || 0) + 1;
          });
          devLog(`   Códigos encontrados:`, codesCount);
          
          // Mostrar algunos ejemplos de logs
          if (morningLogs.length > 0) {
            devLog(`   Ejemplo de logs (primeros 3):`);
            morningLogs.slice(0, 3).forEach((log, idx) => {
              devLog(`     [${idx + 1}] code: ${log.code}, value: ${log.value}, time: ${new Date(log.event_time).toISOString()}`);
            });
          }
        } else {
          devWarn(`  ⚠️ No se obtuvieron logs para ventana ${morningWindow.label}`);
          if (response && !response.success) {
            devWarn(`   Error: ${response.error || 'Sin datos'}`);
            if (response.code) {
              devWarn(`   Código de error: ${response.code}`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error ventana ${morningWindow.label}:`, err.message);
      }

      // Sleep de 100ms entre ventana mañana y tarde
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_WINDOWS));

      // Procesar ventana de la tarde
      const afternoonWindow = WINDOWS[1];
      const afternoonStartTime = buildTimestamp(date, afternoonWindow.start);
      const afternoonEndTime = buildTimestamp(date, afternoonWindow.end);

      devLog(`⏰ Ventana ${afternoonWindow.label}: ${afternoonWindow.start} - ${afternoonWindow.end}`);
      devLog(`   Timestamps: ${afternoonStartTime} - ${afternoonEndTime}`);
      devLog(`   Fechas: ${new Date(afternoonStartTime).toISOString()} - ${new Date(afternoonEndTime).toISOString()}`);

      let afternoonLogs = [];
      try {
        // Un solo request con todos los códigos juntos
        const response = await tuyaService.getDeviceLogsForRoutine({
          id: PRODUCT_ID,
          start_date: afternoonStartTime,
          end_date: afternoonEndTime,
          fields: allCodesString, // Todos los códigos juntos separados por comas
          size: 100,
        });

        if (response?.success && response?.data?.logs?.length) {
          afternoonLogs = response.data.logs;
          totalFetched += afternoonLogs.length;
          devLog(`  ✅ ${afternoonLogs.length} logs obtenidos para ventana ${afternoonWindow.label}`);
          
          // Mostrar detalles de los logs obtenidos
          const codesCount = {};
          afternoonLogs.forEach(log => {
            codesCount[log.code] = (codesCount[log.code] || 0) + 1;
          });
          devLog(`   Códigos encontrados:`, codesCount);
          
          // Mostrar algunos ejemplos de logs
          if (afternoonLogs.length > 0) {
            devLog(`   Ejemplo de logs (primeros 3):`);
            afternoonLogs.slice(0, 3).forEach((log, idx) => {
              devLog(`     [${idx + 1}] code: ${log.code}, value: ${log.value}, time: ${new Date(log.event_time).toISOString()}`);
            });
          }
        } else {
          devWarn(`  ⚠️ No se obtuvieron logs para ventana ${afternoonWindow.label}`);
          if (response && !response.success) {
            devWarn(`   Error: ${response.error || 'Sin datos'}`);
            if (response.code) {
              devWarn(`   Código de error: ${response.code}`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error ventana ${afternoonWindow.label}:`, err.message);
      }

      // Combinar logs de ambas ventanas
      const allLogs = [...morningLogs, ...afternoonLogs];

      if (!allLogs.length) continue;

      /**
       * Agrupar por timestamp
       */
      const grouped = {};

      for (const log of allLogs) {
        const ts = log.event_time;

        if (!grouped[ts]) {
          grouped[ts] = {
            product_id: PRODUCT_ID,
            producto: product._id,
            date: new Date(ts),
            source: 'tuya',
            tds: 0,
            production_volume: 0,
            rejected_volume: 0,
            flujo_produccion: 0,
            flujo_rechazo: 0,
            tiempo_inicio: Math.floor(ts / 1000),
            tiempo_fin: Math.floor(ts / 1000),
          };
        }

        switch (log.code) {
          // case 'flowrate_speed_1': // Comentado: no se usa
          //   grouped[ts].flujo_produccion = Number(log.value) || 0;
          //   break;
          // case 'flowrate_speed_2': // Comentado: no se usa
          //   grouped[ts].flujo_rechazo = Number(log.value) || 0;
          //   break;
          case 'flowrate_total_1':
            grouped[ts].production_volume = Number(log.value) || 0;
            break;
          case 'flowrate_total_2':
            grouped[ts].rejected_volume = Number(log.value) || 0;
            break;
          case 'tds_out':
            grouped[ts].tds = Number(log.value) || 0;
            break;
        }
      }

      const logsToSave = Object.values(grouped).filter(log =>
        log.tds ||
        log.production_volume ||
        log.rejected_volume
        // log.flujo_produccion || // Comentado: no se usa
        // log.flujo_rechazo // Comentado: no se usa
      );

      devLog(`  📊 Logs agrupados: ${Object.keys(grouped).length} timestamps únicos`);
      devLog(`  💾 Logs a guardar: ${logsToSave.length} (filtrados con datos válidos)`);

      for (const logData of logsToSave) {
        const exists = await ProductLogModel.findOne({
          product_id: PRODUCT_ID,
          date: logData.date,
        });

        if (!exists) {
          await ProductLogModel.create(logData);
          totalInserted++;
          devLog(`  ✅ Guardado log para fecha ${new Date(logData.date).toISOString()} - TDS: ${logData.tds}, Prod: ${logData.production_volume}, Rech: ${logData.rejected_volume}`);
        } else {
          devLog(`  ⏭️  Log ya existe para fecha ${new Date(logData.date).toISOString()}, omitido`);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Generación histórica completada',
      summary: {
        dateStart,
        dateEnd,
        totalFetched,
        totalInserted,
      },
    });

  } catch (error) {
    console.error('❌ Error generación histórica:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
