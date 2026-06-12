import { getCorsOptions, getHelmetOptions } from '../../src/config/http-security.js';

function corsAllow(opts, origin) {
  return new Promise((resolve, reject) => {
    opts.origin(origin, (err, ok) => {
      if (err) reject(err);
      else resolve(ok);
    });
  });
}

describe('getCorsOptions', () => {
  const originalCors = process.env.CORS_ORIGINS;
  const originalCred = process.env.CORS_CREDENTIALS;

  afterEach(() => {
    if (originalCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCors;
    if (originalCred === undefined) delete process.env.CORS_CREDENTIALS;
    else process.env.CORS_CREDENTIALS = originalCred;
  });

  it('returns undefined when CORS_ORIGINS is unset (permissive / backward compatible)', () => {
    delete process.env.CORS_ORIGINS;
    expect(getCorsOptions()).toBeUndefined();
  });

  it('allows origins in CORS_ORIGINS', async () => {
    process.env.CORS_ORIGINS = 'https://app.example.com,http://localhost:5173';
    const opts = getCorsOptions();
    expect(await corsAllow(opts, 'https://app.example.com')).toBe(true);
    expect(await corsAllow(opts, 'http://localhost:5173')).toBe(true);
  });

  it('denies origins not in the list', async () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    const opts = getCorsOptions();
    expect(await corsAllow(opts, 'https://other.com')).toBe(false);
  });

  it('allows requests with no Origin (server-to-server, curl)', async () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';
    const opts = getCorsOptions();
    expect(await corsAllow(opts, undefined)).toBe(true);
  });

  it('normalizes trailing slashes in allowlist and Origin header', async () => {
    process.env.CORS_ORIGINS = 'https://www.lcc.com.mx/,https://lcc.com.mx';
    const opts = getCorsOptions();
    expect(await corsAllow(opts, 'https://www.lcc.com.mx')).toBe(true);
    expect(await corsAllow(opts, 'https://lcc.com.mx/')).toBe(true);
  });

  it('allows multiple production front origins (www + apex)', async () => {
    process.env.CORS_ORIGINS = 'https://www.lcc.com.mx,https://lcc.com.mx';
    const opts = getCorsOptions();
    expect(await corsAllow(opts, 'https://www.lcc.com.mx')).toBe(true);
    expect(await corsAllow(opts, 'https://lcc.com.mx')).toBe(true);
    expect(await corsAllow(opts, 'https://evil.example')).toBe(false);
  });
});

describe('getHelmetOptions', () => {
  it('disables CSP for JSON API responses', () => {
    const o = getHelmetOptions();
    expect(o.contentSecurityPolicy).toBe(false);
  });
});
