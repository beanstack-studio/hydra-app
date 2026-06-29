-- Drop tables that are no longer referenced anywhere in the codebase.
-- Confirmed zero .from('settings') and .from('delivery_zones') references in src/.

DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS delivery_zones;
