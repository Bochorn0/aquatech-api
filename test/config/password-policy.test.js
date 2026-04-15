import {
  getPasswordMinLength,
  getPasswordMaxLength,
  getBcryptRounds,
  validatePasswordPlaintext,
} from '../../src/config/password-policy.js';

describe('password-policy', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('defaults min length to 8', () => {
    delete process.env.PASSWORD_MIN_LENGTH;
    expect(getPasswordMinLength()).toBe(8);
  });

  it('clamps PASSWORD_MIN_LENGTH between 8 and 128', () => {
    process.env.PASSWORD_MIN_LENGTH = '6';
    expect(getPasswordMinLength()).toBe(8);
    process.env.PASSWORD_MIN_LENGTH = '14';
    expect(getPasswordMinLength()).toBe(14);
  });

  it('defaults bcrypt rounds to 12 and clamps 10–14', () => {
    delete process.env.BCRYPT_ROUNDS;
    expect(getBcryptRounds()).toBe(12);
    process.env.BCRYPT_ROUNDS = '8';
    expect(getBcryptRounds()).toBe(10);
    process.env.BCRYPT_ROUNDS = '20';
    expect(getBcryptRounds()).toBe(14);
  });

  it('validatePasswordPlaintext rejects short and accepts ok length', () => {
    delete process.env.PASSWORD_MIN_LENGTH;
    expect(validatePasswordPlaintext('short').ok).toBe(false);
    expect(validatePasswordPlaintext('longenough').ok).toBe(true);
  });

  it('getPasswordMaxLength respects env bounds', () => {
    process.env.PASSWORD_MAX_LENGTH = '200';
    expect(getPasswordMaxLength()).toBe(200);
  });
});
