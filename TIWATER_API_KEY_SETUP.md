# TI Water API Key Setup Guide

## 📋 Overview

Instead of public endpoints, TI Water uses an **API Key** system to secure access. This provides better security while still allowing the frontend to access the API without user authentication.

## 🔑 API Key Configuration

### 1. Generate an API Key

Generate a strong, random API key. You can use any method you prefer:

```bash
# Option 1: Using OpenSSL
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using online generator
# https://randomkeygen.com/
```

Example output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

### 2. Set Environment Variable

Add the API key to your `.env` file in `Aquatech_api`:

```env
# TI Water API Key (for frontend access)
TIWATER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 3. Optional: Use Hashed API Key (More Secure)

For additional security, you can use a SHA256 hash instead of storing the plain API key:

```bash
# Generate hash of your API key
echo -n "your-api-key-here" | shasum -a 256

# Or using Node.js
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('your-api-key-here').digest('hex'))"
```

Then set the hash in `.env`:

```env
# TI Water API Key Hash (SHA256) - More secure option
TIWATER_API_KEY_HASH=abc123def456...hash-value-here...
```

If using hashed keys, update the routes to use `validateTiWaterApiKeyHash` instead of `validateTiWaterApiKey`.

## 🚀 Frontend Configuration

### Update TI_water Frontend

Add the API key to your frontend configuration. You can:

1. **Store in environment variable** (recommended for production)
2. **Store in config file** (for development)

#### Option 1: Environment Variable (Recommended)

Create `.env` file in `TI_water`:

```env
VITE_TIWATER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

Then update `src/config-global.ts`:

```typescript
export const CONFIG: ConfigValue = {
  appName: 'TI Water',
  appVersion: packageJson.version,
  API_BASE_URL,
  API_BASE_URL_TIWATER,
  PORT,
  TIWATER_API_KEY: import.meta.env.VITE_TIWATER_API_KEY || '',
};
```

#### Option 2: Direct in Config (Development Only)

Update `src/config-global.ts`:

```typescript
export const CONFIG: ConfigValue = {
  appName: 'TI Water',
  appVersion: packageJson.version,
  API_BASE_URL,
  API_BASE_URL_TIWATER,
  PORT,
  TIWATER_API_KEY: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
};
```

**⚠️ Warning:** Never commit API keys to version control! Use environment variables or `.env` files that are in `.gitignore`.

## 📝 Using API Key in API Calls

### Axios Configuration

Create an axios instance with the API key in headers:

```typescript
// src/api/axiosHelper.ts or similar
import axios from 'axios';
import { CONFIG } from 'src/config-global';

// Create axios instance for TI Water API
export const tiwaterApi = axios.create({
  baseURL: CONFIG.API_BASE_URL_TIWATER,
  headers: {
    'Content-Type': 'application/json',
    'X-TIWater-API-Key': CONFIG.TIWATER_API_KEY,
  },
});

// Helper functions
export const get = async (url: string) => {
  const response = await tiwaterApi.get(url);
  return response.data;
};

export const post = async (url: string, data: any) => {
  const response = await tiwaterApi.post(url, data);
  return response.data;
};
```

### Usage in Components

```typescript
import { get, post } from 'src/api/axiosHelper';

// Get products
const products = await get('/products');

// Create quote
const quote = await post('/quotes', {
  clientName: 'John Doe',
  items: [...]
});
```

## 🔒 Security Best Practices

### 1. Use Strong API Keys
- Use at least 32 characters
- Use random, unpredictable strings
- Don't use words or patterns

### 2. Rotate API Keys Periodically
- Change the key every 3-6 months
- Update both backend and frontend simultaneously
- Revoke old keys immediately

### 3. Restrict API Key Usage
- Use different keys for different environments (dev, staging, prod)
- Never expose API keys in client-side code if possible (but for frontend, this is acceptable)
- Monitor API key usage for unusual patterns

### 4. Use HTTPS Only
- Always use HTTPS in production
- Never send API keys over unencrypted connections

### 5. Consider IP Whitelisting (Future Enhancement)
- Restrict API key usage to specific IP addresses
- Useful for additional security layer

## 🛠️ Alternative: Hash-Based Authentication

If you want even more security, you can use hashed API keys:

### Backend Setup

1. Generate API key hash (as shown above)
2. Store only the hash in `.env`
3. Update routes to use `validateTiWaterApiKeyHash`

```javascript
// In routes file
import { validateTiWaterApiKeyHash } from '../middlewares/tiwater-api-key.middleware.js';

router.get('/', validateTiWaterApiKeyHash, getProducts);
```

### How It Works

1. Frontend sends plain API key in header
2. Backend hashes the received key
3. Backend compares hash with stored hash
4. If hashes match, access is granted

**Benefits:**
- Even if database/logs are compromised, plain API key is not exposed
- More secure than plain text comparison

**Trade-offs:**
- Slightly more computation (negligible)
- Same frontend implementation

## 📊 Comparison: Plain Key vs Hash

| Aspect | Plain API Key | Hashed API Key |
|--------|--------------|----------------|
| **Setup** | Simple | Slightly more complex |
| **Security** | Good | Better |
| **Performance** | Fast | Slightly slower (negligible) |
| **Frontend** | Same | Same |
| **Debugging** | Easier | Harder (can't see original) |

## ✅ Testing

### Test API Key Validation

```bash
# Test without API key (should fail)
curl -X GET http://localhost:3009/api/v2.0/tiwater/products

# Test with invalid API key (should fail)
curl -X GET http://localhost:3009/api/v2.0/tiwater/products \
  -H "X-TIWater-API-Key: invalid-key"

# Test with valid API key (should succeed)
curl -X GET http://localhost:3009/api/v2.0/tiwater/products \
  -H "X-TIWater-API-Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

## 🚨 Troubleshooting

### API Key Not Working

1. **Check environment variable:**
   ```bash
   echo $TIWATER_API_KEY  # Should show your key
   ```

2. **Verify header name:**
   - Use `X-TIWater-API-Key` or `X-API-Key`
   - Check case sensitivity

3. **Check server logs:**
   - Look for API key validation messages
   - Check for warnings about missing API keys

4. **Restart server:**
   - Environment variables are loaded at startup
   - Restart required after changing `.env`

### Frontend Issues

1. **Check API key in config:**
   ```typescript
   console.log(CONFIG.TIWATER_API_KEY); // Should not be empty
   ```

2. **Verify header is sent:**
   - Check Network tab in browser DevTools
   - Look for `X-TIWater-API-Key` header

3. **Check CORS:**
   - Ensure CORS is configured for your domain
   - API key header should be allowed

## 📚 Summary

**Current Setup:**
- ✅ API Key authentication (plain text comparison)
- ✅ Protected endpoints (no public access)
- ✅ Simple implementation
- ✅ Easy to manage

**Recommended Steps:**
1. Generate strong API key
2. Set `TIWATER_API_KEY` in backend `.env`
3. Add API key to frontend config
4. Use `X-TIWater-API-Key` header in all requests
5. (Optional) Upgrade to hashed keys for better security

**Security Level:**
- 🔒 Protected endpoints (no public access)
- 🔑 API Key required for all TI Water endpoints
- 🛡️ Admin operations still use full JWT auth
