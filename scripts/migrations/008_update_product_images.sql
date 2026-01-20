-- Migration: Update product images based on catalog_source and page_number
-- This script assumes images were extracted using the extract-pdf-images-simple.js script
-- Images are saved as: CATALOG_NAME-page_number.png in /assets/product-images/
--
-- Usage: After extracting images from PDFs, run this script to update the database
-- psql -U TIWater_user -d ti_water -f scripts/migrations/008_update_product_images.sql

BEGIN;

-- Function to generate image URL from catalog_source and page_number
-- Example: 'TI Water General.pdf' + page 5 → '/assets/product-images/TI_Water_General-5.png'
UPDATE tiwater_products
SET images = jsonb_build_array(
  '/assets/product-images/' || 
  LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(catalog_source, '\.pdf$', '', 'gi'),
        '[^a-zA-Z0-9]+', '_', 'g'
      ),
      '^_+|_+$', '', 'g'
    )
  ) || 
  '-' || page_number::text || '.png'
)::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE page_number IS NOT NULL 
  AND catalog_source IS NOT NULL
  AND (images IS NULL OR images = '[]'::jsonb);

-- Verify updated products
SELECT 
  id,
  code,
  name,
  catalog_source,
  page_number,
  images
FROM tiwater_products
WHERE images IS NOT NULL 
  AND images != '[]'::jsonb
ORDER BY catalog_source, page_number;

COMMIT;

-- Display success message
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM tiwater_products
  WHERE images IS NOT NULL 
    AND images != '[]'::jsonb;
    
  RAISE NOTICE '✅ Updated % product(s) with image URLs', updated_count;
  RAISE NOTICE '📝 Make sure images are extracted to TI_water/public/assets/product-images/';
END $$;
