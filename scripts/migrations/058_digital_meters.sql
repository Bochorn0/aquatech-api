-- Local copy of digital meters pulled from the meter platform.
-- The controller detail reads this table. The platform is queried only to refresh it.

CREATE TABLE IF NOT EXISTS digital_meters (
  device_code VARCHAR(64) PRIMARY KEY,
  device_type TEXT,
  install_address TEXT,
  online BOOLEAN,
  liters_forward DOUBLE PRECISION,
  raw_forward DOUBLE PRECISION,
  last_report_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_digital_meters_updated_at ON digital_meters (updated_at DESC);

CREATE TABLE IF NOT EXISTS digital_meter_readings (
  id BIGSERIAL PRIMARY KEY,
  device_code VARCHAR(64) NOT NULL REFERENCES digital_meters (device_code) ON DELETE CASCADE,
  liters_forward DOUBLE PRECISION,
  raw_forward DOUBLE PRECISION,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_digital_meter_readings_observed
  ON digital_meter_readings (device_code, observed_at);

COMMENT ON TABLE digital_meters IS 'Latest known digital meter, so the portal can list them without calling the platform on every dropdown.';
COMMENT ON TABLE digital_meter_readings IS 'Stored meter reports. A new row is kept only when the observed time changes.';
