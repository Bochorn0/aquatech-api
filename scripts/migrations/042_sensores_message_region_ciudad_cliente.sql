-- Add topic-derived hierarchy to sensores_message: CLIENTE/REGION/CIUDAD/CODIGO_TIENDA/data
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/042_sensores_message_region_ciudad_cliente.sql

ALTER TABLE sensores_message
  ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cliente_identifier VARCHAR(255) DEFAULT NULL;

COMMENT ON COLUMN sensores_message.region IS 'Topic segment: REGION from CLIENTE/REGION/CIUDAD/CODIGO_TIENDA/data';
COMMENT ON COLUMN sensores_message.ciudad IS 'Topic segment: CIUDAD from CLIENTE/REGION/CIUDAD/CODIGO_TIENDA/data';
COMMENT ON COLUMN sensores_message.cliente_identifier IS 'Topic segment: CLIENTE from CLIENTE/REGION/CIUDAD/CODIGO_TIENDA/data';

CREATE INDEX IF NOT EXISTS idx_sensores_message_region ON sensores_message (region);
CREATE INDEX IF NOT EXISTS idx_sensores_message_ciudad ON sensores_message (ciudad);
CREATE INDEX IF NOT EXISTS idx_sensores_message_cliente_identifier ON sensores_message (cliente_identifier);

DO $$
BEGIN
  RAISE NOTICE '✅ sensores_message: region, ciudad, cliente_identifier columns added (042)';
END $$;
