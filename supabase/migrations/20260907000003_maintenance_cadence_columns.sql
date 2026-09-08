-- Migration: add configurable cadence options to the three time-based
-- maintenance trackers (Filter Replacement, Bacteriological Test,
-- Physical & Chemical Test). Backwash is refill-count based — not touched.
--
-- schedule_type DEFAULT 'day_count' means every existing station continues
-- exactly as before; the owner must explicitly open Settings and save a
-- different type to change behaviour.
--
-- Column reference:
--   schedule_type               'day_count' | 'date' | 'weekday'
--   due_day                     1–31  (used when schedule_type = 'date')
--   due_week_number             1–5   (1=first … 4=fourth, 5=last; used when 'weekday')
--   due_weekday                 0–6   (0=Sun … 6=Sat; used when 'weekday')
--   frequency_cadence           'monthly' | 'quarterly' | 'custom'
--                               (used when schedule_type ≠ 'day_count')
--   frequency_interval_months   ≥ 1   (used when frequency_cadence = 'custom')

ALTER TABLE station_settings

  -- ── Filter Replacement ────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS filter_replacement_schedule_type text
    NOT NULL DEFAULT 'day_count'
    CHECK (filter_replacement_schedule_type IN ('day_count', 'date', 'weekday')),

  ADD COLUMN IF NOT EXISTS filter_replacement_due_day integer
    CHECK (filter_replacement_due_day BETWEEN 1 AND 31),

  ADD COLUMN IF NOT EXISTS filter_replacement_due_week_number integer
    CHECK (filter_replacement_due_week_number BETWEEN 1 AND 5),

  ADD COLUMN IF NOT EXISTS filter_replacement_due_weekday integer
    CHECK (filter_replacement_due_weekday BETWEEN 0 AND 6),

  ADD COLUMN IF NOT EXISTS filter_replacement_frequency_cadence text
    CHECK (filter_replacement_frequency_cadence IN ('monthly', 'quarterly', 'custom')),

  ADD COLUMN IF NOT EXISTS filter_replacement_frequency_interval_months integer
    CHECK (filter_replacement_frequency_interval_months >= 1),

  -- ── Bacteriological Test ──────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS bacteriological_test_schedule_type text
    NOT NULL DEFAULT 'day_count'
    CHECK (bacteriological_test_schedule_type IN ('day_count', 'date', 'weekday')),

  ADD COLUMN IF NOT EXISTS bacteriological_test_due_day integer
    CHECK (bacteriological_test_due_day BETWEEN 1 AND 31),

  ADD COLUMN IF NOT EXISTS bacteriological_test_due_week_number integer
    CHECK (bacteriological_test_due_week_number BETWEEN 1 AND 5),

  ADD COLUMN IF NOT EXISTS bacteriological_test_due_weekday integer
    CHECK (bacteriological_test_due_weekday BETWEEN 0 AND 6),

  ADD COLUMN IF NOT EXISTS bacteriological_test_frequency_cadence text
    CHECK (bacteriological_test_frequency_cadence IN ('monthly', 'quarterly', 'custom')),

  ADD COLUMN IF NOT EXISTS bacteriological_test_frequency_interval_months integer
    CHECK (bacteriological_test_frequency_interval_months >= 1),

  -- ── Physical & Chemical Test ──────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS physical_chemical_test_schedule_type text
    NOT NULL DEFAULT 'day_count'
    CHECK (physical_chemical_test_schedule_type IN ('day_count', 'date', 'weekday')),

  ADD COLUMN IF NOT EXISTS physical_chemical_test_due_day integer
    CHECK (physical_chemical_test_due_day BETWEEN 1 AND 31),

  ADD COLUMN IF NOT EXISTS physical_chemical_test_due_week_number integer
    CHECK (physical_chemical_test_due_week_number BETWEEN 1 AND 5),

  ADD COLUMN IF NOT EXISTS physical_chemical_test_due_weekday integer
    CHECK (physical_chemical_test_due_weekday BETWEEN 0 AND 6),

  ADD COLUMN IF NOT EXISTS physical_chemical_test_frequency_cadence text
    CHECK (physical_chemical_test_frequency_cadence IN ('monthly', 'quarterly', 'custom')),

  ADD COLUMN IF NOT EXISTS physical_chemical_test_frequency_interval_months integer
    CHECK (physical_chemical_test_frequency_interval_months >= 1);
