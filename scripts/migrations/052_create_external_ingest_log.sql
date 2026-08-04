-- Optional ingest audit / idempotency for external provider pushes

CREATE TABLE IF NOT EXISTS external_ingest_log (
  id                  BIGSERIAL PRIMARY KEY,
  provider            TEXT NOT NULL,
  external_device_id  TEXT NULL,
  idempotency_key     TEXT NOT NULL,
  status              TEXT NOT NULL,
  codigo_tienda       TEXT NULL,
  sensores_message_id BIGINT NULL,
  error               TEXT NULL,
  payload             JSONB NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_ingest_idempotency
  ON external_ingest_log (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_external_ingest_received
  ON external_ingest_log (provider, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_ingest_status
  ON external_ingest_log (status, received_at DESC);

COMMENT ON TABLE external_ingest_log IS
  'Idempotency + audit trail for externalProviders webhook ingest';
