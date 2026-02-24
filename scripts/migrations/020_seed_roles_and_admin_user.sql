-- Migration: Seed default roles and default client for admin
-- Run after 018 and 019
-- Admin user is created by scripts/seed-admin-user.js (uses bcrypt)

-- Insert default roles if not exist
INSERT INTO roles (name, protected, permissions, dashboard_version)
VALUES 
  ('admin', TRUE, ARRAY['/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/usuarios', '/equipos', '/controladores', '/puntoVenta', '/personalizacion']::TEXT[], 'both'),
  ('cliente', TRUE, ARRAY['/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion']::TEXT[], 'both')
ON CONFLICT (name) DO NOTHING;

-- Ensure we have at least one client for admin (create default if clients table is empty)
INSERT INTO clients (name, email, phone, protected)
SELECT 'LCC Default', 'admin@lcc.com.mx', NULL, FALSE
WHERE NOT EXISTS (SELECT 1 FROM clients LIMIT 1);
