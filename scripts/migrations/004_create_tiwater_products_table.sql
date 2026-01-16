-- Migration: Create ti_water products table
-- This table stores product information extracted from PDF catalogs
-- Run this migration after setting up PostgreSQL
-- Usage: psql -U tiwater_user -d ti_water -f scripts/migrations/004_create_tiwater_products_table.sql

-- Create products table
CREATE TABLE IF NOT EXISTS tiwater_products (
    id BIGSERIAL PRIMARY KEY,
    
    -- Product identification
    code VARCHAR(100) UNIQUE NOT NULL,              -- Product code (e.g., "TW-P001")
    name VARCHAR(255) NOT NULL,                      -- Product name
    description TEXT DEFAULT NULL,                   -- Detailed description
    category VARCHAR(100) DEFAULT NULL,              -- Category: general, presurizadores, valvulas_sistemas, sumergibles, plomeria
    
    -- Pricing
    price DECIMAL(15, 2) DEFAULT NULL,               -- Unit price
    
    -- Product details
    specifications JSONB DEFAULT NULL,               -- Technical specifications as JSON
    images JSONB DEFAULT NULL,                       -- Array of image URLs/paths
    
    -- Catalog information
    catalog_source VARCHAR(255) DEFAULT NULL,        -- Source PDF file name
    page_number INTEGER DEFAULT NULL,                -- Page number in the PDF
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,                  -- Whether the product is active/available
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tiwater_products_code ON tiwater_products (code);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_category ON tiwater_products (category);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_name ON tiwater_products (name);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_catalog_source ON tiwater_products (catalog_source);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_is_active ON tiwater_products (is_active);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_created_at ON tiwater_products (created_at DESC);

-- Full-text search index for name and description
CREATE INDEX IF NOT EXISTS idx_tiwater_products_name_search ON tiwater_products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- GIN index for JSONB fields (specifications and images)
CREATE INDEX IF NOT EXISTS idx_tiwater_products_specifications_gin ON tiwater_products USING GIN (specifications);
CREATE INDEX IF NOT EXISTS idx_tiwater_products_images_gin ON tiwater_products USING GIN (images);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tiwater_products_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_tiwater_products_updated_at ON tiwater_products;
CREATE TRIGGER update_tiwater_products_updated_at
    BEFORE UPDATE ON tiwater_products
    FOR EACH ROW
    EXECUTE FUNCTION update_tiwater_products_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE tiwater_products IS 'Products from TI Water catalogs extracted from PDFs';
COMMENT ON COLUMN tiwater_products.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN tiwater_products.code IS 'Unique product code/identifier';
COMMENT ON COLUMN tiwater_products.name IS 'Product name';
COMMENT ON COLUMN tiwater_products.description IS 'Detailed product description';
COMMENT ON COLUMN tiwater_products.category IS 'Product category: general, presurizadores, valvulas_sistemas, sumergibles, plomeria';
COMMENT ON COLUMN tiwater_products.price IS 'Unit price in local currency';
COMMENT ON COLUMN tiwater_products.specifications IS 'Technical specifications stored as JSON';
COMMENT ON COLUMN tiwater_products.images IS 'Array of image URLs/paths stored as JSON';
COMMENT ON COLUMN tiwater_products.catalog_source IS 'Source PDF file name';
COMMENT ON COLUMN tiwater_products.page_number IS 'Page number in the source PDF';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ tiwater_products table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updated_at created';
END $$;
