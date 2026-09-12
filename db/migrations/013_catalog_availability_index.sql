-- General catalog availability checks do not constrain provider or offer type.
-- Give them the same covering validity lookup as the filtered shelves, without
-- scanning the unconstrained middle column of those wider indexes per title.
CREATE INDEX IF NOT EXISTS offers_market_title_validity
  ON offers(market,title_id) INCLUDE(expires_at);
