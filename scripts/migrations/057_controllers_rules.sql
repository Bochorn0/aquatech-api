-- Reglas de automatización que el controlador hidráulico lee en cada sincronización.
-- El firmware espera este JSON en la respuesta de GET/PATCH /controllers/:id.

ALTER TABLE controllers
  ADD COLUMN IF NOT EXISTS rules JSONB;
