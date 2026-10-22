-- Si 054 se aplicó con reglas globales, pásalas a reglas por cliente.

ALTER TABLE visit_rules ADD COLUMN IF NOT EXISTS client_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visit_rules_client_id_fkey'
  ) THEN
    ALTER TABLE visit_rules
      ADD CONSTRAINT visit_rules_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE visit_rules DROP CONSTRAINT IF EXISTS visit_rules_type_interval_key;

DELETE FROM visit_rules
WHERE client_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_visits s WHERE s.rule_id = visit_rules.id
  );

ALTER TABLE visit_rules DROP CONSTRAINT IF EXISTS visit_rules_interval_check;
ALTER TABLE visit_rules ADD CONSTRAINT visit_rules_interval_check CHECK (
    (event_type = 'visita_tecnica' AND interval_months BETWEEN 1 AND 36)
    OR (event_type <> 'visita_tecnica' AND interval_months IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS visit_rules_client_type_interval_uidx
    ON visit_rules (client_id, event_type, interval_key);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM visit_rules WHERE client_id IS NULL) THEN
    ALTER TABLE visit_rules ALTER COLUMN client_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE scheduled_visits ADD COLUMN IF NOT EXISTS client_id BIGINT;
ALTER TABLE scheduled_visits ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_visits_client_id_fkey'
  ) THEN
    ALTER TABLE scheduled_visits
      ADD CONSTRAINT scheduled_visits_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE scheduled_visits sv
SET client_id = pv.clientid::bigint
FROM puntoventa pv
WHERE sv.punto_venta_id = pv.id
  AND sv.client_id IS NULL
  AND pv.clientid ~ '^[0-9]+$';

CREATE INDEX IF NOT EXISTS scheduled_visits_client_idx
    ON scheduled_visits (client_id, starts_at);
