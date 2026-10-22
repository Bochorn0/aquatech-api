-- Permite series cada N semanas en citas sin regla guardada.

ALTER TABLE scheduled_visits
    ADD COLUMN IF NOT EXISTS interval_weeks INTEGER;

ALTER TABLE scheduled_visits
    DROP CONSTRAINT IF EXISTS scheduled_visits_interval_weeks_check;

ALTER TABLE scheduled_visits
    ADD CONSTRAINT scheduled_visits_interval_weeks_check
    CHECK (interval_weeks IS NULL OR interval_weeks BETWEEN 1 AND 52);
