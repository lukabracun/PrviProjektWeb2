import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export type PassStatus = 'ACTIVE' | 'CANCELLED';

export interface Pass {
  id: string;
  name: string;
  document: string;
  issuedAt: Date;
  status: PassStatus;
}

const PASS_COLUMNS = `id, name, document, issued_at AS "issuedAt", status`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

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

export async function listPasses(): Promise<Pass[]> {
  const result = await pool.query<Pass>(
    `SELECT ${PASS_COLUMNS} FROM passes ORDER BY issued_at DESC`
  );
  return result.rows;
}

export function toApiJson(pass: Pass) {
  return {
    id: pass.id,
    name: pass.name,
    document: pass.document,
    issuedAt: pass.issuedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: pass.status,
  };
}

export async function getPass(id: string): Promise<Pass | null> {
  if (!isValidId(id)) return null;
  const result = await pool.query<Pass>(
    `SELECT ${PASS_COLUMNS} FROM passes WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createPass(name: string, document: string): Promise<Pass> {
  const result = await pool.query<Pass>(
    `INSERT INTO passes (name, document) VALUES ($1, $2) RETURNING ${PASS_COLUMNS}`,
    [name, document]
  );
  return result.rows[0];
}

export async function cancelPass(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  const result = await pool.query(
    `UPDATE passes SET status = 'CANCELLED' WHERE id = $1`,
    [id]
  );
  return result.rowCount === 1;
}

export async function deletePass(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  const result = await pool.query(`DELETE FROM passes WHERE id = $1`, [id]);
  return result.rowCount === 1;
}
