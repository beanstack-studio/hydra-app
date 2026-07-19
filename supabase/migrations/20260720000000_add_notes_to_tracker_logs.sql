-- Add optional notes column to both tracker log tables.
-- Stores freeform context the owner adds when logging a backwash or filter
-- replacement (e.g. "replaced early due to airlock", "visible sediment").
-- NULL = no note (the common case).

ALTER TABLE backwash_logs
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE filter_replacement_logs
  ADD COLUMN IF NOT EXISTS notes text;
