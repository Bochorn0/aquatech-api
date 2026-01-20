# TI Water Quotes System - Setup Guide

## 📋 Overview

This document describes the setup for the TI Water quotes system, which uses a separate PostgreSQL database from the existing timeseries database.

## 🗄️ Database Setup

### 1. Create the Database

Create a new PostgreSQL database for TI Water:

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE ti_water;

-- Or using psql command line:
-- createdb -U postgres ti_water

-- Grant privileges (adjust user as needed)
GRANT ALL PRIVILEGES ON DATABASE ti_water TO tiwater_user;
```

### 2. Environment Variables

Add the following environment variables to your `.env` file in `Aquatech_api`:

```env
# TI Water Database Configuration (separate from timeseries)
POSTGRES_TIWATER_HOST=localhost
POSTGRES_TIWATER_PORT=5432
POSTGRES_TIWATER_DB=ti_water
POSTGRES_TIWATER_USER=tiwater_user
POSTGRES_TIWATER_PASSWORD=your_password_here
POSTGRES_TIWATER_SSL=false
POSTGRES_TIWATER_MAX_CONNECTIONS=20
POSTGRES_TIWATER_IDLE_TIMEOUT=30000
POSTGRES_TIWATER_CONNECTION_TIMEOUT=2000

# Note: If these are not set, it will fallback to the regular POSTGRES_* variables
```

### 3. Run Migrations

Run the migration files to create the tables:

```bash
# Navigate to Aquatech_api directory
cd Aquatech_api

# Run products table migration
psql -U tiwater_user -d ti_water -f scripts/migrations/004_create_tiwater_products_table.sql

# Run quotes table migration
psql -U tiwater_user -d ti_water -f scripts/migrations/005_create_tiwater_quotes_table.sql
```

Or using the migration script:

```bash
# Run products migration
bash scripts/migrations/run-migration.sh scripts/migrations/004_create_tiwater_products_table.sql

# Run quotes migration
bash scripts/migrations/run-migration.sh scripts/migrations/005_create_tiwater_quotes_table.sql
```

## 🔌 API Endpoints

All TI Water endpoints are under `/api/v2.0/tiwater/`:

### Products Endpoints

- `GET /api/v2.0/tiwater/products` - Get all products (with filters)
- `GET /api/v2.0/tiwater/products/stats` - Get product statistics
- `GET /api/v2.0/tiwater/products/code/:code` - Get product by code
- `GET /api/v2.0/tiwater/products/:productId` - Get product by ID
- `POST /api/v2.0/tiwater/products` - Create new product (admin only)
- `PATCH /api/v2.0/tiwater/products/:productId` - Update product (admin only)
- `PUT /api/v2.0/tiwater/products/:productId` - Update product (admin only)
- `DELETE /api/v2.0/tiwater/products/:productId` - Delete product (admin only, soft delete)

### Quotes Endpoints

- `GET /api/v2.0/tiwater/quotes` - Get all quotes (with filters)
- `GET /api/v2.0/tiwater/quotes/stats` - Get quote statistics
- `GET /api/v2.0/tiwater/quotes/:quoteId` - Get quote by ID
- `POST /api/v2.0/tiwater/quotes` - Create new quote
- `PATCH /api/v2.0/tiwater/quotes/:quoteId` - Update quote
- `PUT /api/v2.0/tiwater/quotes/:quoteId` - Update quote
- `DELETE /api/v2.0/tiwater/quotes/:quoteId` - Delete quote (admin only)

## 📁 Files Created

### Backend (Aquatech_api)

1. **Database Configuration:**
   - `src/config/postgres-tiwater.config.js` - PostgreSQL connection for TI Water database

2. **Migrations:**
   - `scripts/migrations/004_create_tiwater_products_table.sql` - Products table
   - `scripts/migrations/005_create_tiwater_quotes_table.sql` - Quotes and quote_items tables

3. **Models:**
   - `src/models/postgres/tiwater-product.model.js` - Product model
   - `src/models/postgres/tiwater-quote.model.js` - Quote model

4. **Controllers:**
   - `src/controllers/tiwater-product.controller.js` - Product controller
   - `src/controllers/tiwater-quote.controller.js` - Quote controller

5. **Routes:**
   - `src/routes/tiwater-product.routes.js` - Product routes
   - `src/routes/tiwater-quote.routes.js` - Quote routes

6. **Updated Files:**
   - `src/index.js` - Added TI Water routes

### Frontend (TI_water)

1. **Configuration:**
   - `src/config-global.ts` - API configuration similar to Aquatech_front

## 🔐 Authentication

All endpoints require authentication using the existing `authenticate` middleware. Product creation and deletion require admin role.

## 📊 Database Schema

### tiwater_products
- `id` (BIGSERIAL PRIMARY KEY)
- `code` (VARCHAR, UNIQUE) - Product code
- `name` (VARCHAR) - Product name
- `description` (TEXT) - Product description
- `category` (VARCHAR) - Product category
- `price` (DECIMAL) - Unit price
- `specifications` (JSONB) - Technical specifications
- `images` (JSONB) - Array of image URLs/paths
- `catalog_source` (VARCHAR) - Source PDF file
- `page_number` (INTEGER) - Page in PDF
- `is_active` (BOOLEAN) - Active status
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### tiwater_quotes
- `id` (BIGSERIAL PRIMARY KEY)
- `quote_number` (VARCHAR, UNIQUE) - Quote number (auto-generated)
- `client_name` (VARCHAR) - Client name
- `client_email` (VARCHAR) - Client email
- `client_phone` (VARCHAR) - Client phone
- `client_address` (TEXT) - Client address
- `subtotal` (DECIMAL) - Subtotal before taxes
- `tax` (DECIMAL) - Tax amount
- `total` (DECIMAL) - Total amount
- `notes` (TEXT) - General notes
- `valid_until` (DATE) - Validity date
- `status` (VARCHAR) - Quote status: draft, sent, accepted, rejected, expired
- `created_by` (VARCHAR) - User who created
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### tiwater_quote_items
- `id` (BIGSERIAL PRIMARY KEY)
- `quote_id` (BIGINT, FK to tiwater_quotes) - Quote reference
- `product_id` (BIGINT, FK to tiwater_products) - Product reference
- `quantity` (DECIMAL) - Quantity ordered
- `unit_price` (DECIMAL) - Unit price at time of quote
- `discount` (DECIMAL) - Discount amount
- `subtotal` (DECIMAL) - Item subtotal
- `notes` (TEXT) - Item-specific notes
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## 🚀 Testing

### Test Database Connection

```bash
# Test PostgreSQL TI Water connection
cd Aquatech_api
node -e "
import('./src/config/postgres-tiwater.config.js').then(({default: pool}) => {
  pool.query('SELECT NOW()').then(res => {
    console.log('✅ Connected to TI Water database:', res.rows[0].now);
    process.exit(0);
  }).catch(err => {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  });
});
"
```

### Test API Endpoints

```bash
# Get all products (requires auth token)
curl -X GET http://localhost:3009/api/v2.0/tiwater/products \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create a product (requires admin auth token)
curl -X POST http://localhost:3009/api/v2.0/tiwater/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TW-TEST-001",
    "name": "Test Product",
    "description": "Test product description",
    "category": "general",
    "price": 1000.00
  }'
```

## 🔍 Notes

- The TI Water database is completely separate from the timeseries database
- All endpoints use `/api/v2.0/tiwater/` prefix
- Quote numbers are auto-generated in format: `COT-YYYY-NNN`
- Product deletion is soft delete (sets `is_active = false`)
- Quote deletion is hard delete (cascades to items)

## 📝 Next Steps

1. Create the database using the SQL commands above
2. Set environment variables in `.env`
3. Run migrations to create tables
4. Test API endpoints
5. Start implementing the frontend integration
