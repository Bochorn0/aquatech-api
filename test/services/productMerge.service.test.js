import {
  validateMergeDuplicateIds,
} from '../../src/utils/productMerge.validation.js';

describe('productMerge.service validateMergeDuplicateIds', () => {
  it('rejects missing ids', () => {
    const r = validateMergeDuplicateIds('', '');
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects same old and new', () => {
    const r = validateMergeDuplicateIds('abc123', 'abc123');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('distintos'))).toBe(true);
  });

  it('rejects locked (_ prefixed) ids', () => {
    expect(validateMergeDuplicateIds('_oldid', 'newid').ok).toBe(false);
    expect(validateMergeDuplicateIds('oldid', '_newid').ok).toBe(false);
  });

  it('accepts valid pair', () => {
    const r = validateMergeDuplicateIds(' eb3a4ee3ad618b4696anyi ', ' eb49196e47e2711139bfx9 ');
    expect(r.ok).toBe(true);
    expect(r.oldDeviceId).toBe('eb3a4ee3ad618b4696anyi');
    expect(r.newDeviceId).toBe('eb49196e47e2711139bfx9');
    expect(r.errors).toEqual([]);
  });
});
