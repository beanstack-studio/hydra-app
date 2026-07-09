-- Optional supply deduction for Filter Replacement
-- When "Mark as Replaced" is clicked with a linked supply, automatically
-- deducts the specified qty from that supply's stock.

-- station_settings: which supply to deduct and how many units per replacement
ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS filter_replacement_supply_id  uuid
    REFERENCES supplies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS filter_replacement_supply_qty integer DEFAULT 1
    CHECK (filter_replacement_supply_qty >= 1);

-- filter_replacement_logs: record which supply was deducted on each replacement event
ALTER TABLE filter_replacement_logs
  ADD COLUMN IF NOT EXISTS linked_supply_id uuid,
  ADD COLUMN IF NOT EXISTS qty_deducted     integer;
