-- Migration: Insert default cities (v2.0 - PostgreSQL)
-- This script inserts default cities from MongoDB into PostgreSQL
-- Run this migration after creating the cities table
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/009_insert_default_cities.sql

-- Insert default cities (PostgreSQL will auto-generate IDs)
INSERT INTO cities (state, city, lat, lon) VALUES
    ('Aguascalientes', 'Aguascalientes', 21.8853, -102.2916),
    ('Baja California', 'Tijuana', 32.5149, -117.0382),
    ('Baja California Sur', 'La Paz', 24.1426, -110.3009),
    ('Campeche', 'Campeche', 19.8301, -90.5349),
    ('Chiapas', 'Tuxtla Gutierrez', 16.7531, -93.1167),
    ('Chihuahua', 'Chihuahua', 28.6329, -106.0691),
    ('Coahuila', 'Saltillo', 25.4381, -100.9762),
    ('Colima', 'Colima', 19.2433, -103.725),
    ('Durango', 'Durango', 24.0277, -104.6532),
    ('Guanajuato', 'Leon', 21.1221, -101.68),
    ('Guerrero', 'Acapulco', 16.8531, -99.8237),
    ('Hidalgo', 'Pachuca', 20.125, -98.7333),
    ('Jalisco', 'Guadalajara', 20.6597, -103.3496),
    ('Mexico', 'Toluca', 19.2826, -99.6557),
    ('Ciudad de Mexico', 'CDMX', 19.4326, -99.1332),
    ('Michoacan', 'Morelia', 19.705, -101.1944),
    ('Morelos', 'Cuernavaca', 18.9186, -99.2343),
    ('Nayarit', 'Tepic', 21.5061, -104.8937),
    ('Nuevo Leon', 'Monterrey', 25.6866, -100.3161),
    ('Oaxaca', 'Oaxaca de Juarez', 17.0654, -96.7237),
    ('Puebla', 'Puebla', 19.0414, -98.2063),
    ('Queretaro', 'Queretaro', 20.5881, -100.3881),
    ('Quintana Roo', 'Cancun', 21.1619, -86.8515),
    ('San Luis Potosi', 'San Luis Potosi', 22.1498, -100.9792),
    ('Sinaloa', 'Culiacan', 24.8071, -107.394),
    ('Sonora', 'Hermosillo', 29.0729, -110.9559),
    ('Tabasco', 'Villahermosa', 17.9869, -92.9303),
    ('Tamaulipas', 'Ciudad Victoria', 23.7369, -99.1411),
    ('Tlaxcala', 'Tlaxcala', 19.3139, -98.2403),
    ('Veracruz', 'Xalapa', 19.5438, -96.9103),
    ('Yucatan', 'Merida', 20.967, -89.623),
    ('Zacatecas', 'Zacatecas', 22.7709, -102.5832)
ON CONFLICT (state, city) DO NOTHING;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Default cities inserted successfully';
    RAISE NOTICE '✅ Cities that already exist were skipped (ON CONFLICT DO NOTHING)';
END $$;
