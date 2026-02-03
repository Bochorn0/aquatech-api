-- Migration: Create calidad_agua table (v2.0 - PostgreSQL)
-- This table stores water quality data by region/city
-- Run this migration after setting up PostgreSQL
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/014_create_calidad_agua_table.sql

-- Create calidad_agua table
CREATE TABLE IF NOT EXISTS calidad_agua (
    id BIGSERIAL PRIMARY KEY,
    
    -- Location information
    municipio VARCHAR(255) NOT NULL,
    ciudad VARCHAR(255) NOT NULL,
    estado VARCHAR(255) NOT NULL,
    
    -- Water quality metrics
    calidad DOUBLE PRECISION NOT NULL,
    tds_minimo DOUBLE PRECISION,
    tds_maximo DOUBLE PRECISION,
    
    -- Ownership
    owner VARCHAR(255) DEFAULT NULL,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_calidad_agua_estado ON calidad_agua (estado);
CREATE INDEX IF NOT EXISTS idx_calidad_agua_ciudad ON calidad_agua (ciudad);
CREATE INDEX IF NOT EXISTS idx_calidad_agua_municipio ON calidad_agua (municipio);
CREATE INDEX IF NOT EXISTS idx_calidad_agua_calidad ON calidad_agua (calidad);
CREATE INDEX IF NOT EXISTS idx_calidad_agua_createdat ON calidad_agua (createdat DESC);

-- Create function to automatically update updatedat timestamp
CREATE OR REPLACE FUNCTION update_calidad_agua_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedat
DROP TRIGGER IF EXISTS update_calidad_agua_updatedat ON calidad_agua;
CREATE TRIGGER update_calidad_agua_updatedat
    BEFORE UPDATE ON calidad_agua
    FOR EACH ROW
    EXECUTE FUNCTION update_calidad_agua_updatedat_column();

-- Insert mock data for each state capital in Mexico
INSERT INTO calidad_agua (municipio, ciudad, estado, calidad, tds_minimo, tds_maximo, owner) VALUES
-- North Region
('Mexicali', 'Mexicali', 'Baja California', 2.8, 1.8, 3.8, NULL),
('Tijuana', 'Tijuana', 'Baja California', 2.5, 1.5, 3.5, NULL),
('La Paz', 'La Paz', 'Baja California Sur', 2.3, 1.3, 3.3, NULL),
('Hermosillo', 'Hermosillo', 'Sonora', 2.3, 1.2, 3.5, NULL),
('Chihuahua', 'Chihuahua', 'Chihuahua', 2.1, 1.0, 3.2, NULL),
('Saltillo', 'Saltillo', 'Coahuila', 2.4, 1.4, 3.4, NULL),
('Durango', 'Durango', 'Durango', 2.0, 1.0, 3.0, NULL),
('Monterrey', 'Monterrey', 'Nuevo León', 2.6, 1.6, 3.6, NULL),
('Culiacán', 'Culiacán', 'Sinaloa', 2.2, 1.2, 3.2, NULL),

-- Central North Region
('Zacatecas', 'Zacatecas', 'Zacatecas', 1.9, 0.9, 2.9, NULL),
('Aguascalientes', 'Aguascalientes', 'Aguascalientes', 2.1, 1.1, 3.1, NULL),
('San Luis Potosí', 'San Luis Potosí', 'San Luis Potosí', 2.3, 1.3, 3.3, NULL),
('Guanajuato', 'Guanajuato', 'Guanajuato', 2.2, 1.2, 3.2, NULL),
('Querétaro', 'Querétaro', 'Querétaro', 2.4, 1.4, 3.4, NULL),

-- West Region
('Tepic', 'Tepic', 'Nayarit', 2.0, 1.0, 3.0, NULL),
('Guadalajara', 'Guadalajara', 'Jalisco', 2.5, 1.5, 3.5, NULL),
('Colima', 'Colima', 'Colima', 1.8, 0.8, 2.8, NULL),
('Morelia', 'Morelia', 'Michoacán', 2.1, 1.1, 3.1, NULL),

-- Central Region
('Ciudad de México', 'Ciudad de México', 'Ciudad de México', 2.7, 1.7, 3.7, NULL),
('Toluca', 'Toluca', 'Estado de México', 2.6, 1.6, 3.6, NULL),
('Pachuca', 'Pachuca', 'Hidalgo', 2.2, 1.2, 3.2, NULL),
('Tlaxcala', 'Tlaxcala', 'Tlaxcala', 2.0, 1.0, 3.0, NULL),
('Puebla', 'Puebla', 'Puebla', 2.4, 1.4, 3.4, NULL),
('Cuernavaca', 'Cuernavaca', 'Morelos', 2.3, 1.3, 3.3, NULL),

-- South Region
('Chilpancingo', 'Chilpancingo', 'Guerrero', 1.9, 0.9, 2.9, NULL),
('Oaxaca', 'Oaxaca', 'Oaxaca', 2.1, 1.1, 3.1, NULL),
('Tuxtla Gutiérrez', 'Tuxtla Gutiérrez', 'Chiapas', 2.0, 1.0, 3.0, NULL),
('Villahermosa', 'Villahermosa', 'Tabasco', 1.8, 0.8, 2.8, NULL),

-- Southeast Region
('Mérida', 'Mérida', 'Yucatán', 2.5, 1.5, 3.5, NULL),
('Campeche', 'Campeche', 'Campeche', 2.2, 1.2, 3.2, NULL),
('Chetumal', 'Chetumal', 'Quintana Roo', 2.3, 1.3, 3.3, NULL),

-- East Region
('Xalapa', 'Xalapa', 'Veracruz', 2.1, 1.1, 3.1, NULL);

-- Add comments for documentation
COMMENT ON TABLE calidad_agua IS 'Water quality data by region/city (v2.0)';
COMMENT ON COLUMN calidad_agua.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN calidad_agua.municipio IS 'Municipality name';
COMMENT ON COLUMN calidad_agua.ciudad IS 'City name';
COMMENT ON COLUMN calidad_agua.estado IS 'State name';
COMMENT ON COLUMN calidad_agua.calidad IS 'Water quality index';
COMMENT ON COLUMN calidad_agua.tds_minimo IS 'Minimum TDS (Total Dissolved Solids)';
COMMENT ON COLUMN calidad_agua.tds_maximo IS 'Maximum TDS (Total Dissolved Solids)';
COMMENT ON COLUMN calidad_agua.owner IS 'Owner identifier';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ calidad_agua table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedat created';
    RAISE NOTICE '✅ Mock data inserted for 32 cities across Mexico';
END $$;
