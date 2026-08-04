import {
  verifyAuth,
  hasLinghuCredentials,
} from '../../../src/services/externalProviders/providers/linghu/linghu.provider.js';
import { ExternalProviderAuthError } from '../../../src/services/externalProviders/types.js';

function mockReq(headers = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get: (name) => lower[String(name).toLowerCase()] || '',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };
}

describe('linghu.provider verifyAuth (credentials from env)', () => {
  const saved = {};

  beforeEach(() => {
    for (const k of [
      'LINGHU_CLIENT_ID',
      'LINGHU_CLIENT_SECRET',
      'LINGHU_INGEST_SECRET',
      'EXTERNAL_PROVIDER_LINGHU_SECRET',
      'LINGHU_INGEST_ALLOW_INSECURE',
    ]) {
      saved[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('exposes hasLinghuCredentials', () => {
    expect(typeof hasLinghuCredentials).toBe('function');
  });

  it('fails closed when no secret in env', () => {
    delete process.env.LINGHU_CLIENT_ID;
    delete process.env.LINGHU_CLIENT_SECRET;
    delete process.env.LINGHU_INGEST_SECRET;
    delete process.env.EXTERNAL_PROVIDER_LINGHU_SECRET;
    delete process.env.LINGHU_INGEST_ALLOW_INSECURE;
    expect(() => verifyAuth(mockReq({}))).toThrow(ExternalProviderAuthError);
  });

  it('requires matching client id + secret from env', () => {
    process.env.LINGHU_CLIENT_ID = 'linghu-test-id';
    process.env.LINGHU_CLIENT_SECRET = 'linghu-test-secret';
    delete process.env.LINGHU_INGEST_ALLOW_INSECURE;

    expect(() => verifyAuth(mockReq({
      'x-linghu-client-secret': 'linghu-test-secret',
    }))).toThrow(/client id/i);

    expect(() => verifyAuth(mockReq({
      'x-linghu-client-id': 'wrong',
      'x-linghu-client-secret': 'linghu-test-secret',
    }))).toThrow(/client id/i);

    expect(() => verifyAuth(mockReq({
      'x-linghu-client-id': 'linghu-test-id',
      'x-linghu-client-secret': 'wrong',
    }))).toThrow(/client secret/i);

    expect(verifyAuth(mockReq({
      'x-linghu-client-id': 'linghu-test-id',
      'x-linghu-client-secret': 'linghu-test-secret',
    }))).toBe(true);
  });
});
