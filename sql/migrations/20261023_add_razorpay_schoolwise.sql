-- =============================================================
-- Migration: Add School-wise Razorpay Gateway & Test Credentials
-- File: sql/migrations/20261023_add_razorpay_schoolwise.sql
-- =============================================================

BEGIN;

-- 1. Add Razorpay and fee session configuration columns to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS fee_session_start VARCHAR(20) DEFAULT 'april',
  ADD COLUMN IF NOT EXISTS fee_frequency VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS razorpay_key_id VARCHAR(255) DEFAULT 'rzp_test_school_dummy_key',
  ADD COLUMN IF NOT EXISTS razorpay_key_secret VARCHAR(255) DEFAULT 'mock_rzp_secret_dummy_test',
  ADD COLUMN IF NOT EXISTS razorpay_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS razorpay_test_mode BOOLEAN NOT NULL DEFAULT true;

-- Update existing schools with default test credentials if null
UPDATE schools
SET
  fee_session_start = COALESCE(fee_session_start, 'april'),
  fee_frequency = COALESCE(fee_frequency, 'monthly'),
  razorpay_key_id = COALESCE(razorpay_key_id, 'rzp_test_school_dummy_key'),
  razorpay_key_secret = COALESCE(razorpay_key_secret, 'mock_rzp_secret_dummy_test'),
  razorpay_enabled = COALESCE(razorpay_enabled, true),
  razorpay_test_mode = COALESCE(razorpay_test_mode, true);

-- 2. Add transaction reference columns to fee_receipts
ALTER TABLE fee_receipts
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

-- 3. Create index for fast Razorpay transaction lookups
CREATE INDEX IF NOT EXISTS idx_fee_receipts_rzp_payment ON fee_receipts(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_rzp_order ON fee_receipts(razorpay_order_id);

COMMIT;
