import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the server's .env file
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new pg.Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
  : new pg.Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "school_management",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "admin123",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

/**
 * Execute a query against the database pool.
 * @param text SQL query string
 * @param params array of query parameters
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error("Database query error:", err);
    throw err;
  }
}

/**
 * Convert a string to a valid, positive 32-bit integer deterministically.
 * If it is already a valid positive integer, returns it.
 */
export function toIntID(str: any): number {
  if (str === null || str === undefined) return 0;
  const s = String(str).trim();
  if (/^\d+$/.test(s)) {
    const val = parseInt(s, 10);
    if (val > 0 && val <= 2147483647) return val;
  }
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash) || 1;
  return (positiveHash % 2147483647) + 1;
}

/**
 * Convert a string to a valid, deterministic UUID (v4-like based on MD5 hash).
 * DEPRECATED: Delegating to toIntID for compatibility.
 */
export function toUUID(str: string): string {
  return String(toIntID(str));
}
