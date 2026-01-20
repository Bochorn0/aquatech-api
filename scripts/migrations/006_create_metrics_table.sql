-- Migration: Create metrics table (v2.0 - PostgreSQL)
-- This table stores metric configurations for clients and product types
-- Run this migration after setting up PostgreSQL
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/006_create_metrics_table.sql

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id BIGSERIAL PRIMARY KEY,
    
    -- Client reference (can be null for now, will be foreign key later)
    clientid INTEGER DEFAULT NULL,
    
    -- Punto de Venta reference (foreign key to puntoventa table)
    punto_venta_id INTEGER DEFAULT NULL,
    
    -- Metric ranges
    tds_range DECIMAL(10, 2) NOT NULL,
    production_volume_range DECIMAL(10, 2) NOT NULL,
    rejected_volume_range DECIMAL(10, 2) NOT NULL,
    flow_rate_speed_range DECIMAL(10, 2) NOT NULL,
    
    -- Additional fields
    active_time DECIMAL(10, 2) DEFAULT NULL,
    metrics_description TEXT DEFAULT NULL,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_metrics_clientid ON metrics (clientid);
CREATE INDEX IF NOT EXISTS idx_metrics_punto_venta_id ON metrics (punto_venta_id);
CREATE INDEX IF NOT EXISTS idx_metrics_createdat ON metrics (createdat DESC);

-- Create function to automatically update updatedat timestamp
CREATE OR REPLACE FUNCTION update_metrics_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedat
DROP TRIGGER IF EXISTS update_metrics_updatedat ON metrics;
CREATE TRIGGER update_metrics_updatedat
    BEFORE UPDATE ON metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_metrics_updatedat_column();

-- Add comments for documentation
COMMENT ON TABLE metrics IS 'Metric configurations for puntos de venta (v2.0)';
COMMENT ON COLUMN metrics.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN metrics.clientid IS 'Reference to client (foreign key to clients table)';
COMMENT ON COLUMN metrics.punto_venta_id IS 'Reference to punto de venta (foreign key to puntoventa table)';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ metrics table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedat created';
END $$;
