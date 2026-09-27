-- SAA normalizes availableSince with Date.toISOString() before persistence.
-- Lexicographic UTC order therefore equals timestamp order, without casting
-- and decompressing every historical offer on a "new this week" request.
-- Production can build this same index CONCURRENTLY before recording migration.
CREATE INDEX IF NOT EXISTS offers_market_started_title
  ON offers(market,(data->>'availableSince'),title_id) INCLUDE(expires_at)
  WHERE data->>'availableSince' IS NOT NULL;

ANALYZE offers;
