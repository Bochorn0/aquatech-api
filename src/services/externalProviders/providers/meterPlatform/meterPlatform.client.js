/**
 * Water/Gas meter management platform (HTTP/JSON + JWT).
 * Docs: Documentation/05_Water-Gas-Meter-WebManagementPlatform-API-Doc-EN.pdf
 * Vendor Q&A: Documentation/api_response.md
 *
 * Model: meters report via TCP to vendor master station; we PULL via REST.
 * Credentials only from .env / config — never hardcoded.
 */

import axios from 'axios';
import config from '../../../../config/config.js';

const DEFAULT_BASE = 'http://47.97.252.2/prod-api';
const DEFAULT_LOGIN_PATH = '/app/login';

/** In-memory token cache (process lifetime). */
let cachedToken = null;
let tokenExpiresAt = 0;

function getSettings() {
  return {
    baseUrl: String(config.METER_PLATFORM_BASE_URL || process.env.METER_PLATFORM_BASE_URL || DEFAULT_BASE)
      .trim()
      .replace(/\/$/, ''),
    username: String(config.METER_PLATFORM_USERNAME || process.env.METER_PLATFORM_USERNAME || '').trim(),
    password: String(config.METER_PLATFORM_PASSWORD || process.env.METER_PLATFORM_PASSWORD || '').trim(),
    loginPath: String(
      config.METER_PLATFORM_LOGIN_PATH || process.env.METER_PLATFORM_LOGIN_PATH || DEFAULT_LOGIN_PATH
    ).trim(),
  };
}

export function hasMeterPlatformCredentials() {
  const { username, password } = getSettings();
  return Boolean(username && password);
}

function missingCreds(extra = {}) {
  return {
    success: false,
    error:
      'Meter platform credentials not configured. Set METER_PLATFORM_USERNAME and METER_PLATFORM_PASSWORD in .env',
    data: null,
    ...extra,
  };
}

function unwrap(response) {
  const body = response?.data;
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Empty response', data: null, raw: body };
  }
  // RuoYi-style: { code: 200, msg, data }
  const code = body.code;
  if (code !== undefined && Number(code) !== 200) {
    return {
      success: false,
      error: body.msg || body.message || `API code ${code}`,
      data: body.data ?? null,
      raw: body,
    };
  }
  return { success: true, data: body.data !== undefined ? body.data : body, raw: body };
}

/**
 * Login and cache bearer token.
 * Tries configured login path; falls back to /login if first path fails with 404.
 */
export async function login({ force = false } = {}) {
  const { baseUrl, username, password, loginPath } = getSettings();
  if (!username || !password) return missingCreds();

  if (!force && cachedToken && Date.now() < tokenExpiresAt) {
    return { success: true, data: { token: cachedToken }, cached: true };
  }

  const paths = [loginPath];
  if (loginPath !== '/login') paths.push('/login');
  if (loginPath !== '/app/login') paths.push('/app/login');

  let lastError = null;
  for (const path of paths) {
    try {
      const res = await axios.post(
        `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
        { username, password },
        { timeout: 20000, validateStatus: () => true }
      );
      if (res.status === 404) {
        lastError = `Login path ${path} not found`;
        continue;
      }
      const parsed = unwrap(res);
      if (!parsed.success) {
        lastError = parsed.error;
        continue;
      }
      const token =
        parsed.data?.token
        || parsed.data?.access_token
        || parsed.raw?.token
        || null;
      if (!token) {
        lastError = 'Login succeeded but no token in response';
        continue;
      }
      cachedToken = token;
      // No expiry in docs — refresh hourly by default
      tokenExpiresAt = Date.now() + 55 * 60 * 1000;
      return { success: true, data: { token }, loginPath: path };
    } catch (err) {
      lastError = err.message;
    }
  }

  return { success: false, error: lastError || 'Login failed', data: null };
}

export function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function authedGet(path, params = {}) {
  if (!hasMeterPlatformCredentials()) return missingCreds();
  const auth = await login();
  if (!auth.success) return auth;

  const { baseUrl } = getSettings();
  try {
    const res = await axios.get(`${baseUrl}${path}`, {
      params,
      timeout: 30000,
      headers: { Authorization: `Bearer ${auth.data.token}` },
      validateStatus: () => true,
    });
    // Token expired → retry once
    if (res.status === 401) {
      clearTokenCache();
      const retryAuth = await login({ force: true });
      if (!retryAuth.success) return retryAuth;
      const retry = await axios.get(`${baseUrl}${path}`, {
        params,
        timeout: 30000,
        headers: { Authorization: `Bearer ${retryAuth.data.token}` },
        validateStatus: () => true,
      });
      return unwrap(retry);
    }
    return unwrap(res);
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

async function authedPost(path, body = {}) {
  if (!hasMeterPlatformCredentials()) return missingCreds();
  const auth = await login();
  if (!auth.success) return auth;

  const { baseUrl } = getSettings();
  try {
    const res = await axios.post(`${baseUrl}${path}`, body, {
      timeout: 30000,
      headers: { Authorization: `Bearer ${auth.data.token}` },
      validateStatus: () => true,
    });
    if (res.status === 401) {
      clearTokenCache();
      const retryAuth = await login({ force: true });
      if (!retryAuth.success) return retryAuth;
      const retry = await axios.post(`${baseUrl}${path}`, body, {
        timeout: 30000,
        headers: { Authorization: `Bearer ${retryAuth.data.token}` },
        validateStatus: () => true,
      });
      return unwrap(retry);
    }
    return unwrap(res);
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

/** Paged device list */
export async function getDeviceInfoList({ pageNum = 1, pageSize = 50 } = {}) {
  return authedGet('/getDeviceInfoList', { pageNum, pageSize });
}

/** Latest reported fields for one meter */
export async function getDeviceExtend(deviceCode) {
  const code = String(deviceCode || '').trim();
  if (!code) return { success: false, error: 'deviceCode required', data: null };
  return authedGet(`/device/deviceInfo/deviceExtend/${encodeURIComponent(code)}`);
}

/** Communication / report history */
export async function getConnRecordList(deviceCode, extraParams = {}) {
  const code = String(deviceCode || '').trim();
  if (!code) return { success: false, error: 'deviceCode required', data: null };
  return authedGet('/device/deviceConnRecord/list', { deviceCode: code, ...extraParams });
}

/** Day report / static list */
export async function getStaticList(extraParams = {}) {
  return authedGet('/device/static/list', extraParams);
}

/** Device profile by internal id */
export async function getDeviceInfo(id) {
  if (id == null || id === '') return { success: false, error: 'id required', data: null };
  return authedGet(`/device/deviceInfo/${encodeURIComponent(String(id))}`);
}

/**
 * Valve control — async on vendor side (applied when meter next comes online).
 * @param {string} deviceCode
 * @param {boolean} open - true open, false close
 */
export async function valueControl(deviceCode, open) {
  const code = String(deviceCode || '').trim();
  if (!code) return { success: false, error: 'deviceCode required', data: null };
  return authedPost('/valueControl', { deviceCode: code, action: Boolean(open) });
}

export async function getDeviceDetail(externalId) {
  return getDeviceExtend(externalId);
}

export async function listDevices(opts = {}) {
  return getDeviceInfoList(opts);
}

export default {
  login,
  clearTokenCache,
  hasMeterPlatformCredentials,
  getDeviceInfoList,
  getDeviceExtend,
  getConnRecordList,
  getStaticList,
  getDeviceInfo,
  valueControl,
  getDeviceDetail,
  listDevices,
  getSettings,
};
