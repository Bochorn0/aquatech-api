// src/middlewares/tiwater-api-key.middleware.js
// Middleware to validate TI Water API key for public frontend access

import config from '../config/config.js';

/**
 * Middleware to validate TI Water API key
 * Validates the X-TIWater-API-Key header against environment variable
 * 
 * Usage:
 *   router.get('/', validateTiWaterApiKey, getProducts);
 */
export const validateTiWaterApiKey = (req, res, next) => {
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validApiKey = process.env.TIWATER_API_KEY || config.TIWATER_API_KEY;

  // If no API key is configured, allow access (backward compatibility)
  if (!validApiKey) {
    console.warn('[TIWater API Key] ⚠️  No API key configured. Allowing access without validation.');
    return next();
  }

  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({ 
      message: 'API key is required. Please provide X-TIWater-API-Key header.',
      error: 'Missing API Key'
    });
  }

  // Validate API key
  if (apiKey !== validApiKey) {
    console.warn('[TIWater API Key] ⚠️  Invalid API key attempt from:', req.ip);
    return res.status(401).json({ 
      message: 'Invalid API key.',
      error: 'Unauthorized'
    });
  }

  // API key is valid, proceed
  next();
};

/**
 * Optional: Middleware to validate API key with hash comparison
 * More secure option that uses hashed comparison instead of plain text
 * 
 * Usage:
 *   router.get('/', validateTiWaterApiKeyHash, getProducts);
 */
export const validateTiWaterApiKeyHash = async (req, res, next) => {
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validApiKeyHash = process.env.TIWATER_API_KEY_HASH || config.TIWATER_API_KEY_HASH;

  // If no hash is configured, fallback to simple key validation
  if (!validApiKeyHash) {
    return validateTiWaterApiKey(req, res, next);
  }

  if (!apiKey) {
    return res.status(401).json({ 
      message: 'API key is required. Please provide X-TIWater-API-Key header.',
      error: 'Missing API Key'
    });
  }

  try {
    // Hash the provided API key and compare with stored hash
    const crypto = await import('crypto');
    const providedKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    if (providedKeyHash !== validApiKeyHash) {
      console.warn('[TIWater API Key] ⚠️  Invalid API key hash attempt from:', req.ip);
      return res.status(401).json({ 
        message: 'Invalid API key.',
        error: 'Unauthorized'
      });
    }

    // API key hash is valid, proceed
    next();
  } catch (error) {
    console.error('[TIWater API Key] Error validating hash:', error);
    return res.status(500).json({ 
      message: 'Error validating API key.',
      error: 'Internal Server Error'
    });
  }
};
