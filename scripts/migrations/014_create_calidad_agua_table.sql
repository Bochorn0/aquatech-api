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

-- Insert mock data for each state capital in Mexico (Current + 2 months historical)
INSERT INTO calidad_agua (municipio, ciudad, estado, calidad, tds_minimo, tds_maximo, owner, createdat) VALUES
-- North Region - Current (February 2026)
('Mexicali', 'Mexicali', 'Baja California', 2.8, 1.8, 3.8, NULL, '2026-02-01'),
('Tijuana', 'Tijuana', 'Baja California', 2.5, 1.5, 3.5, NULL, '2026-02-01'),
('La Paz', 'La Paz', 'Baja California Sur', 2.3, 1.3, 3.3, NULL, '2026-02-01'),
('Hermosillo', 'Hermosillo', 'Sonora', 2.3, 1.2, 3.5, NULL, '2026-02-01'),
('Chihuahua', 'Chihuahua', 'Chihuahua', 2.1, 1.0, 3.2, NULL, '2026-02-01'),
('Saltillo', 'Saltillo', 'Coahuila', 2.4, 1.4, 3.4, NULL, '2026-02-01'),
('Durango', 'Durango', 'Durango', 2.0, 1.0, 3.0, NULL, '2026-02-01'),
('Monterrey', 'Monterrey', 'Nuevo León', 2.6, 1.6, 3.6, NULL, '2026-02-01'),
('Culiacán', 'Culiacán', 'Sinaloa', 2.2, 1.2, 3.2, NULL, '2026-02-01'),

-- Central North Region - Current
('Zacatecas', 'Zacatecas', 'Zacatecas', 1.9, 0.9, 2.9, NULL, '2026-02-01'),
('Aguascalientes', 'Aguascalientes', 'Aguascalientes', 2.1, 1.1, 3.1, NULL, '2026-02-01'),
('San Luis Potosí', 'San Luis Potosí', 'San Luis Potosí', 2.3, 1.3, 3.3, NULL, '2026-02-01'),
('Guanajuato', 'Guanajuato', 'Guanajuato', 2.2, 1.2, 3.2, NULL, '2026-02-01'),
('Querétaro', 'Querétaro', 'Querétaro', 2.4, 1.4, 3.4, NULL, '2026-02-01'),

-- West Region - Current
('Tepic', 'Tepic', 'Nayarit', 2.0, 1.0, 3.0, NULL, '2026-02-01'),
('Guadalajara', 'Guadalajara', 'Jalisco', 2.5, 1.5, 3.5, NULL, '2026-02-01'),
('Colima', 'Colima', 'Colima', 1.8, 0.8, 2.8, NULL, '2026-02-01'),
('Morelia', 'Morelia', 'Michoacán', 2.1, 1.1, 3.1, NULL, '2026-02-01'),

-- Central Region - Current
('Ciudad de México', 'Ciudad de México', 'Ciudad de México', 2.7, 1.7, 3.7, NULL, '2026-02-01'),
('Toluca', 'Toluca', 'Estado de México', 2.6, 1.6, 3.6, NULL, '2026-02-01'),
('Pachuca', 'Pachuca', 'Hidalgo', 2.2, 1.2, 3.2, NULL, '2026-02-01'),
('Tlaxcala', 'Tlaxcala', 'Tlaxcala', 2.0, 1.0, 3.0, NULL, '2026-02-01'),
('Puebla', 'Puebla', 'Puebla', 2.4, 1.4, 3.4, NULL, '2026-02-01'),
('Cuernavaca', 'Cuernavaca', 'Morelos', 2.3, 1.3, 3.3, NULL, '2026-02-01'),

-- South Region - Current
('Chilpancingo', 'Chilpancingo', 'Guerrero', 1.9, 0.9, 2.9, NULL, '2026-02-01'),
('Oaxaca', 'Oaxaca', 'Oaxaca', 2.1, 1.1, 3.1, NULL, '2026-02-01'),
('Tuxtla Gutiérrez', 'Tuxtla Gutiérrez', 'Chiapas', 2.0, 1.0, 3.0, NULL, '2026-02-01'),
('Villahermosa', 'Villahermosa', 'Tabasco', 1.8, 0.8, 2.8, NULL, '2026-02-01'),

-- Southeast Region - Current
('Mérida', 'Mérida', 'Yucatán', 2.5, 1.5, 3.5, NULL, '2026-02-01'),
('Campeche', 'Campeche', 'Campeche', 2.2, 1.2, 3.2, NULL, '2026-02-01'),
('Chetumal', 'Chetumal', 'Quintana Roo', 2.3, 1.3, 3.3, NULL, '2026-02-01'),

-- East Region - Current
('Xalapa', 'Xalapa', 'Veracruz', 2.1, 1.1, 3.1, NULL, '2026-02-01'),

-- ============================================================================
-- HISTORICAL DATA - JANUARY 2026
-- ============================================================================
('Mexicali', 'Mexicali', 'Baja California', 2.9, 1.9, 3.9, NULL, '2026-01-15'),
('Tijuana', 'Tijuana', 'Baja California', 2.6, 1.6, 3.6, NULL, '2026-01-15'),
('La Paz', 'La Paz', 'Baja California Sur', 2.2, 1.2, 3.2, NULL, '2026-01-15'),
('Hermosillo', 'Hermosillo', 'Sonora', 2.4, 1.3, 3.6, NULL, '2026-01-15'),
('Chihuahua', 'Chihuahua', 'Chihuahua', 2.0, 0.9, 3.1, NULL, '2026-01-15'),
('Saltillo', 'Saltillo', 'Coahuila', 2.5, 1.5, 3.5, NULL, '2026-01-15'),
('Durango', 'Durango', 'Durango', 1.9, 0.9, 2.9, NULL, '2026-01-15'),
('Monterrey', 'Monterrey', 'Nuevo León', 2.7, 1.7, 3.7, NULL, '2026-01-15'),
('Culiacán', 'Culiacán', 'Sinaloa', 2.3, 1.3, 3.3, NULL, '2026-01-15'),
('Zacatecas', 'Zacatecas', 'Zacatecas', 1.8, 0.8, 2.8, NULL, '2026-01-15'),
('Aguascalientes', 'Aguascalientes', 'Aguascalientes', 2.0, 1.0, 3.0, NULL, '2026-01-15'),
('San Luis Potosí', 'San Luis Potosí', 'San Luis Potosí', 2.4, 1.4, 3.4, NULL, '2026-01-15'),
('Guanajuato', 'Guanajuato', 'Guanajuato', 2.3, 1.3, 3.3, NULL, '2026-01-15'),
('Querétaro', 'Querétaro', 'Querétaro', 2.5, 1.5, 3.5, NULL, '2026-01-15'),
('Tepic', 'Tepic', 'Nayarit', 1.9, 0.9, 2.9, NULL, '2026-01-15'),
('Guadalajara', 'Guadalajara', 'Jalisco', 2.6, 1.6, 3.6, NULL, '2026-01-15'),
('Colima', 'Colima', 'Colima', 1.7, 0.7, 2.7, NULL, '2026-01-15'),
('Morelia', 'Morelia', 'Michoacán', 2.2, 1.2, 3.2, NULL, '2026-01-15'),
('Ciudad de México', 'Ciudad de México', 'Ciudad de México', 2.8, 1.8, 3.8, NULL, '2026-01-15'),
('Toluca', 'Toluca', 'Estado de México', 2.7, 1.7, 3.7, NULL, '2026-01-15'),
('Pachuca', 'Pachuca', 'Hidalgo', 2.3, 1.3, 3.3, NULL, '2026-01-15'),
('Tlaxcala', 'Tlaxcala', 'Tlaxcala', 1.9, 0.9, 2.9, NULL, '2026-01-15'),
('Puebla', 'Puebla', 'Puebla', 2.5, 1.5, 3.5, NULL, '2026-01-15'),
('Cuernavaca', 'Cuernavaca', 'Morelos', 2.4, 1.4, 3.4, NULL, '2026-01-15'),
('Chilpancingo', 'Chilpancingo', 'Guerrero', 2.0, 1.0, 3.0, NULL, '2026-01-15'),
('Oaxaca', 'Oaxaca', 'Oaxaca', 2.2, 1.2, 3.2, NULL, '2026-01-15'),
('Tuxtla Gutiérrez', 'Tuxtla Gutiérrez', 'Chiapas', 1.9, 0.9, 2.9, NULL, '2026-01-15'),
('Villahermosa', 'Villahermosa', 'Tabasco', 1.9, 0.9, 2.9, NULL, '2026-01-15'),
('Mérida', 'Mérida', 'Yucatán', 2.6, 1.6, 3.6, NULL, '2026-01-15'),
('Campeche', 'Campeche', 'Campeche', 2.3, 1.3, 3.3, NULL, '2026-01-15'),
('Chetumal', 'Chetumal', 'Quintana Roo', 2.4, 1.4, 3.4, NULL, '2026-01-15'),
('Xalapa', 'Xalapa', 'Veracruz', 2.2, 1.2, 3.2, NULL, '2026-01-15'),

-- ============================================================================
-- HISTORICAL DATA - DECEMBER 2025
-- ============================================================================
('Mexicali', 'Mexicali', 'Baja California', 3.0, 2.0, 4.0, NULL, '2025-12-15'),
('Tijuana', 'Tijuana', 'Baja California', 2.7, 1.7, 3.7, NULL, '2025-12-15'),
('La Paz', 'La Paz', 'Baja California Sur', 2.1, 1.1, 3.1, NULL, '2025-12-15'),
('Hermosillo', 'Hermosillo', 'Sonora', 2.5, 1.4, 3.7, NULL, '2025-12-15'),
('Chihuahua', 'Chihuahua', 'Chihuahua', 1.9, 0.8, 3.0, NULL, '2025-12-15'),
('Saltillo', 'Saltillo', 'Coahuila', 2.6, 1.6, 3.6, NULL, '2025-12-15'),
('Durango', 'Durango', 'Durango', 1.8, 0.8, 2.8, NULL, '2025-12-15'),
('Monterrey', 'Monterrey', 'Nuevo León', 2.8, 1.8, 3.8, NULL, '2025-12-15'),
('Culiacán', 'Culiacán', 'Sinaloa', 2.4, 1.4, 3.4, NULL, '2025-12-15'),
('Zacatecas', 'Zacatecas', 'Zacatecas', 1.7, 0.7, 2.7, NULL, '2025-12-15'),
('Aguascalientes', 'Aguascalientes', 'Aguascalientes', 1.9, 0.9, 2.9, NULL, '2025-12-15'),
('San Luis Potosí', 'San Luis Potosí', 'San Luis Potosí', 2.5, 1.5, 3.5, NULL, '2025-12-15'),
('Guanajuato', 'Guanajuato', 'Guanajuato', 2.4, 1.4, 3.4, NULL, '2025-12-15'),
('Querétaro', 'Querétaro', 'Querétaro', 2.6, 1.6, 3.6, NULL, '2025-12-15'),
('Tepic', 'Tepic', 'Nayarit', 1.8, 0.8, 2.8, NULL, '2025-12-15'),
('Guadalajara', 'Guadalajara', 'Jalisco', 2.7, 1.7, 3.7, NULL, '2025-12-15'),
('Colima', 'Colima', 'Colima', 1.6, 0.6, 2.6, NULL, '2025-12-15'),
('Morelia', 'Morelia', 'Michoacán', 2.3, 1.3, 3.3, NULL, '2025-12-15'),
('Ciudad de México', 'Ciudad de México', 'Ciudad de México', 2.9, 1.9, 3.9, NULL, '2025-12-15'),
('Toluca', 'Toluca', 'Estado de México', 2.8, 1.8, 3.8, NULL, '2025-12-15'),
('Pachuca', 'Pachuca', 'Hidalgo', 2.4, 1.4, 3.4, NULL, '2025-12-15'),
('Tlaxcala', 'Tlaxcala', 'Tlaxcala', 1.8, 0.8, 2.8, NULL, '2025-12-15'),
('Puebla', 'Puebla', 'Puebla', 2.6, 1.6, 3.6, NULL, '2025-12-15'),
('Cuernavaca', 'Cuernavaca', 'Morelos', 2.5, 1.5, 3.5, NULL, '2025-12-15'),
('Chilpancingo', 'Chilpancingo', 'Guerrero', 2.1, 1.1, 3.1, NULL, '2025-12-15'),
('Oaxaca', 'Oaxaca', 'Oaxaca', 2.3, 1.3, 3.3, NULL, '2025-12-15'),
('Tuxtla Gutiérrez', 'Tuxtla Gutiérrez', 'Chiapas', 1.8, 0.8, 2.8, NULL, '2025-12-15'),
('Villahermosa', 'Villahermosa', 'Tabasco', 2.0, 1.0, 3.0, NULL, '2025-12-15'),
('Mérida', 'Mérida', 'Yucatán', 2.7, 1.7, 3.7, NULL, '2025-12-15'),
('Campeche', 'Campeche', 'Campeche', 2.4, 1.4, 3.4, NULL, '2025-12-15'),
('Chetumal', 'Chetumal', 'Quintana Roo', 2.5, 1.5, 3.5, NULL, '2025-12-15'),
('Xalapa', 'Xalapa', 'Veracruz', 2.3, 1.3, 3.3, NULL, '2025-12-15');

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
    RAISE NOTICE '✅ Mock data inserted: 96 records (32 cities x 3 months)';
END $$;
