// src/middlewares/tiwater-api-key.middleware.js
// Middleware to validate TI Water API key for public frontend access

import jwt from 'jsonwebtoken';
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

/**
 * Middleware that accepts EITHER API Key OR JWT Token
 * Used for routes that can be accessed by both TI_water frontend (API key) and Aquatech_front dashboard (JWT)
 * 
 * Usage:
 *   router.get('/', validateTiWaterApiKeyOrAuth, getProducts);
 */
export const validateTiWaterApiKeyOrAuth = (req, res, next) => {
  // First, try to validate API key
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validApiKey = process.env.TIWATER_API_KEY || config.TIWATER_API_KEY;

  // If API key is provided and valid, proceed
  if (apiKey && validApiKey && apiKey === validApiKey) {
    return next();
  }

  // If no valid API key, try JWT authentication
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      message: 'Authentication required. Please provide X-TIWater-API-Key header or Authorization Bearer token.',
      error: 'Missing Authentication'
    });
  }

  // Validate JWT token
  const SECRET_KEY = config.SECRET_KEY;
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        message: 'Invalid or expired token. Please provide a valid X-TIWater-API-Key or Authorization Bearer token.',
        error: 'Unauthorized'
      });
    }
    req.user = decoded; // Attach user info from decoded token to request
    next(); // Proceed to the next middleware or route handler
  });
};
