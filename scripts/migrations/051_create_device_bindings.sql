-- device_bindings: map external meter IDs (any provider) → tienda / puntoventa
-- Used by externalProviders ingest (Linghu push first).

CREATE TABLE IF NOT EXISTS device_bindings (
  id              SERIAL PRIMARY KEY,
  provider        TEXT NOT NULL,
  external_device_id TEXT NOT NULL,
  external_imei   TEXT NULL,
  puntoventa_id   INTEGER NULL,
  codigo_tienda   TEXT NOT NULL,
  client_id       INTEGER NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  meta            JSONB NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_bindings_provider_external
  ON device_bindings (provider, external_device_id);

CREATE INDEX IF NOT EXISTS idx_device_bindings_codigo_tienda
  ON device_bindings (codigo_tienda);

CREATE INDEX IF NOT EXISTS idx_device_bindings_provider_active
  ON device_bindings (provider, active)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_bindings_imei
  ON device_bindings (provider, external_imei)
  WHERE external_imei IS NOT NULL;

COMMENT ON TABLE device_bindings IS
  'Maps external provider device ids (e.g. Linghu device_number) to codigo_tienda / puntoventa';
