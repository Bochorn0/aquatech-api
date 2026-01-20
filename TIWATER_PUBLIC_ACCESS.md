# TI Water Public Access - Configuration

## 📋 Overview

The TI Water website is a **public-facing site** that needs to access the API without authentication. This document describes how public access is configured.

## 🔓 Public Endpoints (No Authentication Required)

### Products Endpoints
All product read operations are **public** - anyone can view the catalog:

- ✅ `GET /api/v2.0/tiwater/products` - Get all products (with filters)
- ✅ `GET /api/v2.0/tiwater/products/stats` - Get product statistics
- ✅ `GET /api/v2.0/tiwater/products/code/:code` - Get product by code
- ✅ `GET /api/v2.0/tiwater/products/:productId` - Get product by ID

**Protected (Admin Only):**
- 🔒 `POST /api/v2.0/tiwater/products` - Create product
- 🔒 `PATCH /api/v2.0/tiwater/products/:productId` - Update product
- 🔒 `PUT /api/v2.0/tiwater/products/:productId` - Update product
- 🔒 `DELETE /api/v2.0/tiwater/products/:productId` - Delete product

### Quotes Endpoints
Quote creation is **public** - customers can create quotes without authentication:

- ✅ `POST /api/v2.0/tiwater/quotes` - Create new quote (PUBLIC)

**Protected (Requires Authentication):**
- 🔒 `GET /api/v2.0/tiwater/quotes` - Get all quotes (requires auth)
- 🔒 `GET /api/v2.0/tiwater/quotes/stats` - Get quote statistics (requires auth)
- 🔒 `GET /api/v2.0/tiwater/quotes/:quoteId` - Get quote by ID (requires auth)
- 🔒 `PATCH /api/v2.0/tiwater/quotes/:quoteId` - Update quote (requires auth)
- 🔒 `PUT /api/v2.0/tiwater/quotes/:quoteId` - Update quote (requires auth)
- 🔒 `DELETE /api/v2.0/tiwater/quotes/:quoteId` - Delete quote (admin only)

## 🔐 Security Considerations

### Current Approach
- **Read operations** (products) are public - appropriate for a product catalog
- **Quote creation** is public - customers need to create quotes without login
- **Quote management** (view/edit/delete) requires authentication - protects customer data

### Recommended Enhancements (Optional)

#### 1. Rate Limiting
Consider adding rate limiting to public endpoints to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit';

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to public routes
router.get('/', publicLimiter, getProducts);
router.post('/', publicLimiter, createQuote);
```

#### 2. CORS Configuration
Ensure CORS is properly configured for the TI_water domain:

```javascript
const corsOptions = {
  origin: ['https://tiwater.com.mx', 'http://localhost:3040'],
  credentials: true
};
app.use('/api/v2.0/tiwater', cors(corsOptions));
```

#### 3. Input Validation
Add input validation for public endpoints to prevent malicious data:

```javascript
import { body, validationResult } from 'express-validator';

router.post('/', [
  body('clientName').trim().isLength({ min: 1, max: 255 }),
  body('clientEmail').optional().isEmail(),
  body('items').isArray().notEmpty()
], createQuote);
```

#### 4. API Key (Alternative Solution)
If you want an additional layer of security, you could use a static API key:

```javascript
// Middleware for API key (optional)
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.TIWATER_API_KEY;
  
  if (!validKey || apiKey === validKey) {
    return next();
  }
  
  return res.status(401).json({ message: 'Invalid API key' });
};

// Apply to public routes
router.get('/', validateApiKey, getProducts);
```

## 📝 Frontend Integration

The TI_water frontend can now call these endpoints without authentication tokens:

```typescript
// In TI_water frontend
import { CONFIG } from 'src/config-global';
import axios from 'axios';

// Get products (no auth needed)
const getProducts = async () => {
  const response = await axios.get(`${CONFIG.API_BASE_URL_TIWATER}/products`);
  return response.data;
};

// Create quote (no auth needed)
const createQuote = async (quoteData) => {
  const response = await axios.post(
    `${CONFIG.API_BASE_URL_TIWATER}/quotes`,
    quoteData
  );
  return response.data;
};
```

## ✅ Benefits of This Approach

1. **User-Friendly**: Customers don't need to create accounts to view products or request quotes
2. **Lower Friction**: Quote creation is simple - just fill out the form
3. **Secure**: Sensitive operations (edit/delete quotes) still require authentication
4. **Flexible**: Admin operations remain protected with full auth system

## 🔄 Alternative: Guest Token System

If you want to track quote creators without full authentication, you could implement a "guest token" system:

1. Generate a simple guest token when a quote is created
2. Return the token to the client
3. Use the token to allow limited access (view/update that specific quote)
4. Token expires after a certain time

This would allow customers to:
- Create quotes without login
- View and update their quotes using the guest token
- But not access other users' quotes

Would require additional implementation but provides better user experience for quote management.

## 📊 Summary

**Current Configuration:**
- ✅ Products: Public read, Protected write
- ✅ Quotes: Public create, Protected read/update/delete
- ✅ Simple and secure
- ✅ No authentication needed for basic operations

**Future Enhancements (Optional):**
- Rate limiting
- Input validation
- API key for additional security layer
- Guest token system for quote management
