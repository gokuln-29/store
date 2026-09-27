-- Fuzzy product search uses the indexable `<%` (word similarity) operator. Its threshold is a
-- setting, so fix it for this database: 0.5 tolerates one or two typos in a word.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET pg_trgm.word_similarity_threshold = 0.5', current_database());
END $$;
