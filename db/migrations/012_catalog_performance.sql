-- Provider shelves previously scanned the full offers table because the
-- existing (market,title_id) index cannot narrow a market by provider or type.
-- expires_at keeps the validity check in the index for subscription/free rows.
CREATE INDEX IF NOT EXISTS offers_market_provider_title
  ON offers(market,provider_id,title_id) INCLUDE(expires_at);
CREATE INDEX IF NOT EXISTS offers_market_type_title
  ON offers(market,(data->>'type'),title_id) INCLUDE(expires_at);
