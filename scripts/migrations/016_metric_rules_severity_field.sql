-- Migration: Document severity field in metric rules (JSONB)
-- The rules array in metrics.rules supports an explicit "severity" field per rule.
-- Values: 'normal' | 'preventivo' | 'critico'
-- This avoids inferring severity from labels. Use backfill script to populate existing rules.
--
-- Run backfill: node scripts/backfill-metric-rules-severity.js
-- Example: node scripts/backfill-metric-rules-severity.js --dry-run
--
-- Updated rules structure example:
-- rules: [
--   {"min": 50, "max": 70, "color": "#00B050", "label": "Normal", "severity": "normal"},
--   {"min": 35, "max": 49, "color": "#FFFF00", "label": "Warning", "severity": "preventivo"},
--   {"min": null, "max": 34, "color": "#EE0000", "label": "Critical", "severity": "critico"}
-- ]

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 016: metric rules severity field documented';
    RAISE NOTICE '   Run: node scripts/backfill-metric-rules-severity.js to backfill existing rules';
END $$;
