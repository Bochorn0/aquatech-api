-- Reglas y agenda de visitas por cliente.
-- Al agendar se crea un Google Meet; el recordatorio usa notification_days_before.

CREATE TABLE IF NOT EXISTS visit_rules (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('visita_tecnica', 'instalacion', 'mantenimiento')),
    interval_months INTEGER,
    interval_key INTEGER GENERATED ALWAYS AS (COALESCE(interval_months, 0)) STORED,
    label VARCHAR(120) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
    notification_days_before INTEGER NOT NULL DEFAULT 7 CHECK (notification_days_before BETWEEN 0 AND 90),
    reminder_hour INTEGER NOT NULL DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
    start_time TIME NOT NULL DEFAULT '10:00',
    horizon_months INTEGER NOT NULL DEFAULT 24 CHECK (horizon_months BETWEEN 1 AND 60),
    guests JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT visit_rules_interval_check CHECK (
        (event_type = 'visita_tecnica' AND interval_months BETWEEN 1 AND 36)
        OR (event_type <> 'visita_tecnica' AND interval_months IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS visit_rules_client_type_interval_uidx
    ON visit_rules (client_id, event_type, interval_key);

CREATE TABLE IF NOT EXISTS scheduled_visits (
    id BIGSERIAL PRIMARY KEY,
    series_id UUID NOT NULL,
    rule_id BIGINT REFERENCES visit_rules(id) ON DELETE SET NULL,
    client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255),
    punto_venta_id BIGINT REFERENCES puntoventa(id) ON DELETE SET NULL,
    punto_venta_name VARCHAR(255),
    codigo_tienda VARCHAR(100),
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('visita_tecnica', 'instalacion', 'mantenimiento')),
    interval_months INTEGER,
    title VARCHAR(255) NOT NULL,
    notes TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    time_zone VARCHAR(64) NOT NULL DEFAULT 'America/Tijuana',
    guests JSONB NOT NULL DEFAULT '[]'::jsonb,
    notification_days_before INTEGER NOT NULL DEFAULT 7 CHECK (notification_days_before BETWEEN 0 AND 90),
    reminder_hour INTEGER NOT NULL DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
    google_event_id VARCHAR(255),
    meet_link TEXT,
    calendar_link TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
    reminder_sent_at TIMESTAMPTZ,
    reminder_claimed_at TIMESTAMPTZ,
    reminder_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS scheduled_visits_upcoming_idx
    ON scheduled_visits (status, starts_at);

CREATE INDEX IF NOT EXISTS scheduled_visits_client_idx
    ON scheduled_visits (client_id, starts_at);

CREATE INDEX IF NOT EXISTS scheduled_visits_series_idx
    ON scheduled_visits (series_id);

CREATE INDEX IF NOT EXISTS scheduled_visits_reminder_idx
    ON scheduled_visits (status, reminder_sent_at, starts_at);
