import { config } from '../lib/config';
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
          const r = await client.query(sql, params);
          return { rows: r as T[] };
        },
      };
    }
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: c.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        const r = await pool.query(sql, params);
        return { rows: r.rows as T[] };
      },
      close: () => pool.end(),
    };
  })();
  return cached;
}
