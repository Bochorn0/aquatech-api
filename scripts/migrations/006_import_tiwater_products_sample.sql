-- Migration: Import sample products for TI Water
-- This is a template SQL file to import products from catalogs
-- 
-- Usage: psql -U TIWater_user -d ti_water -f scripts/migrations/006_import_tiwater_products_sample.sql
-- Or edit this file with your actual product data and run it

-- Note: Replace the sample data below with actual product information extracted from PDFs

-- Sample products from TI Water General catalog
INSERT INTO tiwater_products (code, name, description, category, price, catalog_source, page_number, is_active)
VALUES
  -- Products from "TI Water General.pdf"
  ('TW-GEN-001', 'Producto General 1', 'Descripción del producto general 1', 'general', 1500.00, 'TI Water General.pdf', 1, true),
  ('TW-GEN-002', 'Producto General 2', 'Descripción del producto general 2', 'general', 2000.00, 'TI Water General.pdf', 1, true),
  ('TW-GEN-003', 'Producto General 3', 'Descripción del producto general 3', 'general', 2500.00, 'TI Water General.pdf', 2, true),

  -- Products from "TI Water PRESURIZADORES.pdf"
  ('TW-PRES-001', 'Presurizador Modelo A', 'Sistema de presurización de agua para uso residencial', 'presurizadores', 3500.00, 'TI Water PRESURIZADORES.pdf', 1, true),
  ('TW-PRES-002', 'Presurizador Modelo B', 'Sistema de presurización de agua para uso comercial', 'presurizadores', 4500.00, 'TI Water PRESURIZADORES.pdf', 1, true),
  ('TW-PRES-003', 'Presurizador Modelo C', 'Sistema de presurización industrial', 'presurizadores', 5500.00, 'TI Water PRESURIZADORES.pdf', 2, true),

  -- Products from "TI Water valvulas y sistemas.pdf"
  ('TW-VALV-001', 'Válvula Check 1/2"', 'Válvula check de latón 1/2 pulgada', 'valvulas_sistemas', 150.00, 'TI Water valvulas y sistemas.pdf', 1, true),
  ('TW-VALV-002', 'Válvula Check 3/4"', 'Válvula check de latón 3/4 pulgada', 'valvulas_sistemas', 200.00, 'TI Water valvulas y sistemas.pdf', 1, true),
  ('TW-VALV-003', 'Sistema de Válvulas Completo', 'Sistema completo de válvulas para instalación', 'valvulas_sistemas', 1200.00, 'TI Water valvulas y sistemas.pdf', 2, true),

  -- Products from "TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf"
  ('TW-SUM-001', 'Bomba Sumergible 0.5 HP', 'Bomba sumergible de 0.5 caballos de fuerza', 'sumergibles', 3000.00, 'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf', 1, true),
  ('TW-SUM-002', 'Bomba Sumergible 1 HP', 'Bomba sumergible de 1 caballo de fuerza', 'sumergibles', 4000.00, 'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf', 1, true),
  ('TW-SUM-003', 'Accesorios para Bomba Sumergible', 'Kit de accesorios para bomba sumergible', 'sumergibles', 500.00, 'TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf', 2, true),

  -- Products from "TI Water Plomeria.pdf"
  ('TW-PLOM-001', 'Tubo PVC 1/2"', 'Tubo de PVC de 1/2 pulgada', 'plomeria', 50.00, 'TI Water Plomeria.pdf', 1, true),
  ('TW-PLOM-002', 'Tubo PVC 3/4"', 'Tubo de PVC de 3/4 pulgada', 'plomeria', 60.00, 'TI Water Plomeria.pdf', 1, true),
  ('TW-PLOM-003', 'Codo PVC 90°', 'Codo de PVC de 90 grados', 'plomeria', 25.00, 'TI Water Plomeria.pdf', 1, true)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  catalog_source = EXCLUDED.catalog_source,
  page_number = EXCLUDED.page_number,
  updated_at = CURRENT_TIMESTAMP;

-- Verify inserted products
SELECT 
  id,
  code,
  name,
  category,
  price,
  catalog_source,
  is_active
FROM tiwater_products
ORDER BY category, code;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Sample products imported successfully';
    RAISE NOTICE '📝 Remember to replace sample data with actual product information from PDFs';
END $$;
