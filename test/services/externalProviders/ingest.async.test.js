import { isAsyncMode, linghuAck } from '../../../src/services/externalProviders/ingest.service.js';

describe('externalProviders ingest helpers', () => {
  const prev = process.env.EXTERNAL_INGEST_ASYNC;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXTERNAL_INGEST_ASYNC;
    else process.env.EXTERNAL_INGEST_ASYNC = prev;
  });

  it('isAsyncMode reads EXTERNAL_INGEST_ASYNC', () => {
    process.env.EXTERNAL_INGEST_ASYNC = 'true';
    expect(isAsyncMode()).toBe(true);
    process.env.EXTERNAL_INGEST_ASYNC = 'false';
    expect(isAsyncMode()).toBe(false);
    delete process.env.EXTERNAL_INGEST_ASYNC;
    expect(isAsyncMode()).toBe(false);
  });

  it('linghuAck shape', () => {
    expect(linghuAck()).toEqual({ code: '200', message: '' });
    expect(linghuAck(false, 'x')).toEqual({ code: '400', message: 'x' });
  });
});
