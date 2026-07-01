-- Restock history: tracks every supplier + price logged when a supply item is restocked.
-- References supplies(id) — the Inventory page uses the supplies table, not inventory.

CREATE TABLE IF NOT EXISTS restock_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id     uuid        NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  supply_id      uuid        NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  supplier       text        NOT NULL,
  price_per_unit numeric     NOT NULL,
  qty_added      numeric     NOT NULL,
  total_cost     numeric     GENERATED ALWAYS AS (price_per_unit * qty_added) STORED,
  restocked_at   date        NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY restock_history_station_member ON public.restock_history
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);
