import { Pool } from "pg";

// Direct PostgreSQL connection via Supabase Transaction Pooler (port 6543).
// Required for pgvector queries — PostgREST cannot pass JS arrays as vector type.
// Never expose SUPABASE_TRANSACTION_POOLER_URL to the client.

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_TRANSACTION_POOLER_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
