-- Migration: Add /notificaciones permission to admin role
-- Allows admins to access the notifications dashboard

UPDATE roles
SET permissions = array_append(permissions, '/notificaciones')
WHERE name = 'admin'
  AND NOT ('/notificaciones' = ANY(permissions));
