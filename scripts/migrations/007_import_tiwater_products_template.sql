-- Migration: Template for importing TI Water products from catalogs
-- 
-- Instructions:
-- 1. Extract product information from PDF catalogs
-- 2. Fill in the template below with actual product data
-- 3. Run this migration: psql -U TIWater_user -d ti_water -f scripts/migrations/007_import_tiwater_products_template.sql
--
-- Product fields:
--   code: Unique product code (e.g., "TW-GEN-001")
--   name: Product name
--   description: Detailed description
--   category: general | presurizadores | valvulas_sistemas | sumergibles | plomeria
--   price: Unit price (numeric, can be NULL if not available)
--   specifications: JSON object with technical specs (optional)
--   images: JSON array of image URLs/paths (optional)
--   catalog_source: Source PDF filename
--   page_number: Page number in PDF
--   is_active: true/false

BEGIN;

-- Example: Products from "TI Water General.pdf"
INSERT INTO tiwater_products (
  code, 
  name, 
  description, 
  category, 
  price, 
  specifications,
  catalog_source, 
  page_number, 
  is_active
)
VALUES
  -- Template row - Copy and modify for each product
  (
    'TW-GEN-XXX',                    -- code: Replace XXX with sequential number
    'Nombre del Producto',           -- name: Product name from PDF
    'Descripción detallada...',      -- description: Full product description
    'general',                       -- category: general | presurizadores | valvulas_sistemas | sumergibles | plomeria
    1000.00,                         -- price: Price from PDF (or NULL if not available)
    '{"spec1": "value1"}',           -- specifications: JSON with technical specs (or NULL)
    'TI Water General.pdf',          -- catalog_source: PDF filename
    1,                               -- page_number: Page where product appears
    true                             -- is_active: true for active products
  )
  -- Add more products below, one per row...

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  specifications = EXCLUDED.specifications,
  catalog_source = EXCLUDED.catalog_source,
  page_number = EXCLUDED.page_number,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- Verify products imported
SELECT 
  category,
  COUNT(*) as product_count,
  MIN(price) as min_price,
  MAX(price) as max_price,
  AVG(price) as avg_price
FROM tiwater_products
GROUP BY category
ORDER BY category;
