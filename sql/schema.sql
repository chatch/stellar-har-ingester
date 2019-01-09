CREATE TABLE public.transactions
(
  ledger_sequence	int PRIMARY KEY,
  ingested_at 		timestamp DEFAULT CURRENT_TIMESTAMP,
  data			jsonb
)

CREATE TABLE public.ledger
(
  ledger_sequence	int PRIMARY KEY,
  ingested_at 		timestamp DEFAULT CURRENT_TIMESTAMP,
  data			jsonb
)

CREATE TABLE public.results
(
  ledger_sequence	int PRIMARY KEY,
  ingested_at 		timestamp DEFAULT CURRENT_TIMESTAMP,
  data			jsonb
)

-- General recommendation - set this to 10% of memory up to 1GB
SET maintenance_work_mem TO '900MB';

-- Ran this on table with the first 1,000,000 testnet ledgers
-- Took 8 minutes on my laptop with the above mem setting 
CREATE INDEX idx_transactions_data ON transactions USING GIN (data);

-- 10 seconds:
VACUUM transactions;

-- 9 minutes:
-- VACUUM FULL transactions;