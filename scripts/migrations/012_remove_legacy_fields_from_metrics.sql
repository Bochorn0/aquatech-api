-- Migration: Remove legacy fields from metrics table
-- This migration removes old fields that are no longer needed with the new configuration system
-- Run this migration after 011_alter_metrics_table_for_configuration.sql
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/012_remove_legacy_fields_from_metrics.sql

-- Remove legacy columns
ALTER TABLE metrics 
  DROP COLUMN IF EXISTS tds_range,
  DROP COLUMN IF EXISTS production_volume_range,
  DROP COLUMN IF EXISTS rejected_volume_range,
  DROP COLUMN IF EXISTS flow_rate_speed_range,
  DROP COLUMN IF EXISTS active_time,
  DROP COLUMN IF EXISTS metrics_description;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Legacy fields removed from metrics table';
END $$;
