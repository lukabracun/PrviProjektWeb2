import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function initDb(): Promise<void> {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS passes (
      id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name      TEXT NOT NULL,
      document  TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status    TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'CANCELLED'))
    )
  `);
}

export async function getCounts(): Promise<{ total: number; active: number }> {
    const result = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
    FROM passes
  `);
    return result.rows[0];
}