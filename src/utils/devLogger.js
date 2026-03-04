/**
 * Logging that is disabled in production (NODE_ENV=production) so Azure/prod logs stay clean.
 * Use devLog/devWarn for verbose/debug logs; use console.error for real errors you want in prod.
 */
const isProduction = process.env.NODE_ENV === 'production';

export const devLog = isProduction ? () => {} : (...args) => console.log(...args);
export const devWarn = isProduction ? () => {} : (...args) => console.warn(...args);
