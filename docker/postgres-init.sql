-- Runs once when the Postgres volume is first created.
-- Separate database for integration tests (see DATABASE_URL_TEST).
CREATE DATABASE ecom_test;
