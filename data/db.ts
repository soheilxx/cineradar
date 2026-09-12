import { config } from '../lib/config';
// Request/background queries must release server CPU and locks when a plan
// regresses. Migrations use their own Client and are not subject to this cap.
const STATEMENT_TIMEOUT_MS = 30000;
interface TransactionConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  release(destroy?: boolean): void;
}

/** SET LOCAL must run before the statement on the same borrowed connection. */
export async function queryWithStatementTimeout<T>(
  connection: TransactionConnection,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  let discard = false;
  try {
    await connection.query(
      `BEGIN; SET LOCAL statement_timeout='${STATEMENT_TIMEOUT_MS}ms'`,
    );
    const result = await connection.query(sql, params);
    await connection.query('COMMIT');
    return { rows: result.rows as T[] };
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    connection.release(discard);
  }
}
export interface Database {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  close?: () => Promise<void>;
}
let cached: Promise<Database> | undefined;
export async function db(): Promise<Database> {
  if (cached) return cached;
  cached = (async () => {
    const c = config();
    if (!c.DATABASE_URL) throw new Error('DATABASE_URL missing');
    if (c.DATABASE_DRIVER === 'neon') {
      const { neon } = await import('@neondatabase/serverless');
      const client = neon(c.DATABASE_URL);
      return {
        async query<T>(sql: string, params: unknown[] = []) {
          // HTTP queries have no durable session. Set the timeout in a separate
          // command before the real statement, on the same transaction/backend.
          const results = await client.transaction(
            [
              client.query("SELECT set_config('statement_timeout',$1,true)", [
                String(STATEMENT_TIMEOUT_MS),
              ]),
              client.query(sql, params),
            ],
            {
              fetchOptions: {
                signal: AbortSignal.timeout(STATEMENT_TIMEOUT_MS + 5000),
              },
            },
          );
          return { rows: results[1] as T[] };
        },
      };
    }
    const { Pool } = await import('pg');
    // Neon PgBouncer rejects unsupported startup GUCs and does not retain
    // session settings between transactions. Direct PG supports startup GUCs.
    const pooledNeon = new URL(c.DATABASE_URL).hostname.includes('-pooler.');
    const pool = new Pool({
      connectionString: c.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: pooledNeon ? undefined : STATEMENT_TIMEOUT_MS,
    });
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        if (pooledNeon)
          return queryWithStatementTimeout<T>(
            await pool.connect(),
            sql,
            params,
          );
        const r = await pool.query(sql, params);
        return { rows: r.rows as T[] };
      },
      close: () => pool.end(),
    };
  })();
  return cached;
}
