import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

async function runMigration() {
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgres://${process.env.DB_USER || "postgres"}:${process.env.DB_PASSWORD || "admin123"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "school_management"}`,
  });

  const client = await pool.connect();
  try {
    console.log("🚀 Running Razorpay migration script...");
    await client.query("BEGIN;");

    // 1. Add columns to schools
    await client.query(`
      ALTER TABLE schools
        ADD COLUMN IF NOT EXISTS fee_session_start VARCHAR(20) DEFAULT 'april',
        ADD COLUMN IF NOT EXISTS fee_frequency VARCHAR(20) DEFAULT 'monthly',
        ADD COLUMN IF NOT EXISTS razorpay_key_id VARCHAR(255) DEFAULT 'rzp_test_school_dummy_key',
        ADD COLUMN IF NOT EXISTS razorpay_key_secret VARCHAR(255) DEFAULT 'mock_rzp_secret_dummy_test',
        ADD COLUMN IF NOT EXISTS razorpay_enabled BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS razorpay_test_mode BOOLEAN NOT NULL DEFAULT true;

      UPDATE schools
      SET
        fee_session_start = COALESCE(fee_session_start, 'april'),
        fee_frequency = COALESCE(fee_frequency, 'monthly'),
        razorpay_key_id = COALESCE(razorpay_key_id, 'rzp_test_school_dummy_key'),
        razorpay_key_secret = COALESCE(razorpay_key_secret, 'mock_rzp_secret_dummy_test'),
        razorpay_enabled = COALESCE(razorpay_enabled, true),
        razorpay_test_mode = COALESCE(razorpay_test_mode, true);
    `);

    // 2. Add columns to fee_receipts
    await client.query(`
      ALTER TABLE fee_receipts
        ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

      CREATE INDEX IF NOT EXISTS idx_fee_receipts_rzp_payment ON fee_receipts(razorpay_payment_id);
      CREATE INDEX IF NOT EXISTS idx_fee_receipts_rzp_order ON fee_receipts(razorpay_order_id);
    `);

    await client.query("COMMIT;");
    console.log("✅ Razorpay migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
