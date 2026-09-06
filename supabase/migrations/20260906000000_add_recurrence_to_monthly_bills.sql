-- Add recurring bill fields to monthly_bills
-- is_recurring: drives the toggle; false for all existing rows (default)
-- recurrence_cadence: 'monthly' | 'quarterly' | 'custom'
-- recurrence_interval_months: used only when cadence = 'custom'
-- reminder_day: day-of-month the owner wants reminders to start showing
-- payment_cap: optional total-payment limit for fixed-term loans (e.g. 60-month BPI)

ALTER TABLE monthly_bills
  ADD COLUMN IF NOT EXISTS is_recurring               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_cadence         text    CHECK (recurrence_cadence IN ('monthly', 'quarterly', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_interval_months integer CHECK (recurrence_interval_months >= 1),
  ADD COLUMN IF NOT EXISTS reminder_day               integer CHECK (reminder_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS payment_cap                integer CHECK (payment_cap >= 1);
