-- Migration: Create cities table (v2.0 - PostgreSQL)
-- This table stores city and state information with coordinates
-- Run this migration after setting up PostgreSQL
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/008_create_cities_table.sql

-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
    id BIGSERIAL PRIMARY KEY,
    
    -- Location information
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    
    -- Coordinates
    lat DECIMAL(10, 8) NOT NULL,
    lon DECIMAL(11, 8) NOT NULL,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on state + city combination
    UNIQUE(state, city)
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities (state);
CREATE INDEX IF NOT EXISTS idx_cities_city ON cities (city);
CREATE INDEX IF NOT EXISTS idx_cities_state_city ON cities (state, city);
CREATE INDEX IF NOT EXISTS idx_cities_createdat ON cities (createdat DESC);

-- Create function to automatically update updatedat timestamp
CREATE OR REPLACE FUNCTION update_cities_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedat
DROP TRIGGER IF EXISTS update_cities_updatedat ON cities;
CREATE TRIGGER update_cities_updatedat
    BEFORE UPDATE ON cities
    FOR EACH ROW
    EXECUTE FUNCTION update_cities_updatedat_column();

-- Add comments for documentation
COMMENT ON TABLE cities IS 'City and state information with coordinates (v2.0)';
COMMENT ON COLUMN cities.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN cities.state IS 'State name';
COMMENT ON COLUMN cities.city IS 'City name';
COMMENT ON COLUMN cities.lat IS 'Latitude coordinate';
COMMENT ON COLUMN cities.lon IS 'Longitude coordinate';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ cities table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedat created';
END $$;
