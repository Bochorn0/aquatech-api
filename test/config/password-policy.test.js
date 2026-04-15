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

  it('validatePasswordPlaintext rejects short, missing upper case, missing digit', () => {
    delete process.env.PASSWORD_MIN_LENGTH;
    delete process.env.PASSWORD_REQUIRE_UPPERCASE;
    delete process.env.PASSWORD_REQUIRE_DIGIT;
    expect(validatePasswordPlaintext('short').ok).toBe(false);
    expect(validatePasswordPlaintext('longenough').ok).toBe(false);
    expect(validatePasswordPlaintext('Longenough').ok).toBe(false);
    expect(validatePasswordPlaintext('longenough1').ok).toBe(false);
    expect(validatePasswordPlaintext('Validpass1').ok).toBe(true);
  });

  it('validatePasswordPlaintext can skip upper/digit when env false', () => {
    delete process.env.PASSWORD_MIN_LENGTH;
    process.env.PASSWORD_REQUIRE_UPPERCASE = 'false';
    process.env.PASSWORD_REQUIRE_DIGIT = 'false';
    expect(validatePasswordPlaintext('abcdefgh').ok).toBe(true);
  });

  it('getPasswordMaxLength respects env bounds', () => {
    process.env.PASSWORD_MAX_LENGTH = '200';
    expect(getPasswordMaxLength()).toBe(200);
  });
});
