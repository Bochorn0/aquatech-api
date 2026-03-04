-- Add optional color to regions (for map styling: hex e.g. #1976d2 or null for default)
ALTER TABLE regions ADD COLUMN IF NOT EXISTS color VARCHAR(20) NULL;
COMMENT ON COLUMN regions.color IS 'Optional hex color for map (e.g. #1976d2). Null = use default palette.';
