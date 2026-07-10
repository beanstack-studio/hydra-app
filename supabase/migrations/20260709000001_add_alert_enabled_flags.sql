-- Mute toggle for login alert popups, independent of nav/card badges.
-- Default TRUE so existing stations keep current behaviour (alert fires when overdue).

ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS backwash_alert_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS filter_replacement_alert_enabled boolean NOT NULL DEFAULT true;
