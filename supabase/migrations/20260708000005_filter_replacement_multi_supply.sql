-- Filter Replacement: support multiple linked supplies per replacement cycle.
--
-- station_settings.filter_replacement_supplies  JSONB — stores [{supply_id, qty}]
-- filter_replacement_logs.supply_deductions     JSONB — stores [{supply_id, qty_deducted}]
--
-- The old single-column pair (filter_replacement_supply_id / filter_replacement_supply_qty
-- and linked_supply_id / qty_deducted) is kept intact so existing rows remain valid;
-- the app reads the new JSONB column first and falls back to the old columns.

-- ── station_settings ─────────────────────────────────────────────────────────

ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS filter_replacement_supplies JSONB;

-- Migrate any existing single-supply setting into the new JSONB array.
UPDATE station_settings
SET filter_replacement_supplies = jsonb_build_array(
  jsonb_build_object(
    'supply_id', filter_replacement_supply_id::text,
    'qty',       COALESCE(filter_replacement_supply_qty, 1)
  )
)
WHERE filter_replacement_supply_id IS NOT NULL
  AND filter_replacement_supplies  IS NULL;

-- ── filter_replacement_logs ───────────────────────────────────────────────────

ALTER TABLE filter_replacement_logs
  ADD COLUMN IF NOT EXISTS supply_deductions JSONB;

-- Migrate any existing single-supply log entries into the new JSONB array.
UPDATE filter_replacement_logs
SET supply_deductions = jsonb_build_array(
  jsonb_build_object(
    'supply_id',    linked_supply_id::text,
    'qty_deducted', COALESCE(qty_deducted, 1)
  )
)
WHERE linked_supply_id    IS NOT NULL
  AND supply_deductions   IS NULL;
