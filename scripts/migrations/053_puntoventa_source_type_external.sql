-- Allow source_type = 'external' for meter push providers (Linghu, etc.)

ALTER TABLE puntoventa DROP CONSTRAINT IF EXISTS puntoventa_source_type_check;

ALTER TABLE puntoventa
  ADD CONSTRAINT puntoventa_source_type_check
  CHECK (source_type IN ('mqtt', 'tuya', 'hybrid', 'external'));

COMMENT ON COLUMN puntoventa.source_type IS
  'Data origin for V2: mqtt, tuya, hybrid (mqtt+tuya), external (provider push → sensores*)';
