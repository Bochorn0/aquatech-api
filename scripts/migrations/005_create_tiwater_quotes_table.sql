-- Migration: Create ti_water quotes and quote_items tables
-- These tables store quotation data for the TI Water quotes system
-- Run this migration after setting up PostgreSQL and products table
-- Usage: psql -U tiwater_user -d ti_water -f scripts/migrations/005_create_tiwater_quotes_table.sql

-- Create quotes table
CREATE TABLE IF NOT EXISTS tiwater_quotes (
    id BIGSERIAL PRIMARY KEY,
    
    -- Quote identification
    quote_number VARCHAR(100) UNIQUE NOT NULL,       -- Quote number (e.g., "COT-2024-001")
    
    -- Client information
    client_name VARCHAR(255) NOT NULL,               -- Client name
    client_email VARCHAR(255) DEFAULT NULL,          -- Client email
    client_phone VARCHAR(50) DEFAULT NULL,           -- Client phone
    client_address TEXT DEFAULT NULL,                -- Client address
    
    -- Quote details
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,      -- Subtotal before taxes
    tax DECIMAL(15, 2) DEFAULT 0,                    -- Tax amount (IVA or other)
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- Total amount
    
    -- Quote metadata
    notes TEXT DEFAULT NULL,                         -- General notes
    valid_until DATE DEFAULT NULL,                   -- Quote validity date
    status VARCHAR(50) DEFAULT 'draft',              -- Status: draft, sent, accepted, rejected, expired
    
    -- User tracking
    created_by VARCHAR(255) DEFAULT NULL,            -- User who created the quote
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create quote_items table (products in a quote)
CREATE TABLE IF NOT EXISTS tiwater_quote_items (
    id BIGSERIAL PRIMARY KEY,
    
    -- Foreign key to quote
    quote_id BIGINT NOT NULL REFERENCES tiwater_quotes(id) ON DELETE CASCADE,
    
    -- Foreign key to product
    product_id BIGINT NOT NULL REFERENCES tiwater_products(id) ON DELETE RESTRICT,
    
    -- Item details
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,      -- Quantity ordered
    unit_price DECIMAL(15, 2) NOT NULL,              -- Unit price at time of quote
    discount DECIMAL(15, 2) DEFAULT 0,               -- Discount amount
    subtotal DECIMAL(15, 2) NOT NULL,                -- Item subtotal (quantity * unit_price - discount)
    
    -- Item metadata
    notes TEXT DEFAULT NULL,                         -- Item-specific notes
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for quotes table
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_quote_number ON tiwater_quotes (quote_number);
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_status ON tiwater_quotes (status);
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_client_name ON tiwater_quotes (client_name);
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_created_at ON tiwater_quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_created_by ON tiwater_quotes (created_by);
CREATE INDEX IF NOT EXISTS idx_tiwater_quotes_valid_until ON tiwater_quotes (valid_until);

-- Create indexes for quote_items table
CREATE INDEX IF NOT EXISTS idx_tiwater_quote_items_quote_id ON tiwater_quote_items (quote_id);
CREATE INDEX IF NOT EXISTS idx_tiwater_quote_items_product_id ON tiwater_quote_items (product_id);

-- Create function to automatically update updated_at timestamp for quotes
CREATE OR REPLACE FUNCTION update_tiwater_quotes_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to automatically update updated_at timestamp for quote_items
CREATE OR REPLACE FUNCTION update_tiwater_quote_items_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    -- Also update parent quote's updated_at
    UPDATE tiwater_quotes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.quote_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_tiwater_quotes_updated_at ON tiwater_quotes;
CREATE TRIGGER update_tiwater_quotes_updated_at
    BEFORE UPDATE ON tiwater_quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_tiwater_quotes_updated_at_column();

DROP TRIGGER IF EXISTS update_tiwater_quote_items_updated_at ON tiwater_quote_items;
CREATE TRIGGER update_tiwater_quote_items_updated_at
    BEFORE UPDATE ON tiwater_quote_items
    FOR EACH ROW
    EXECUTE FUNCTION update_tiwater_quote_items_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE tiwater_quotes IS 'Quotations for TI Water products';
COMMENT ON COLUMN tiwater_quotes.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN tiwater_quotes.quote_number IS 'Unique quote number/identifier';
COMMENT ON COLUMN tiwater_quotes.client_name IS 'Client name';
COMMENT ON COLUMN tiwater_quotes.subtotal IS 'Subtotal before taxes';
COMMENT ON COLUMN tiwater_quotes.tax IS 'Tax amount (IVA or other)';
COMMENT ON COLUMN tiwater_quotes.total IS 'Total amount including taxes';
COMMENT ON COLUMN tiwater_quotes.status IS 'Quote status: draft, sent, accepted, rejected, expired';

COMMENT ON TABLE tiwater_quote_items IS 'Individual items/products within a quote';
COMMENT ON COLUMN tiwater_quote_items.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN tiwater_quote_items.quote_id IS 'Foreign key to tiwater_quotes';
COMMENT ON COLUMN tiwater_quote_items.product_id IS 'Foreign key to tiwater_products';
COMMENT ON COLUMN tiwater_quote_items.quantity IS 'Quantity of the product';
COMMENT ON COLUMN tiwater_quote_items.unit_price IS 'Unit price at time of quote';
COMMENT ON COLUMN tiwater_quote_items.subtotal IS 'Item subtotal (quantity * unit_price - discount)';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ tiwater_quotes table created successfully';
    RAISE NOTICE '✅ tiwater_quote_items table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update triggers for updated_at created';
END $$;
