import type { Database } from '../data/db';
import { db } from '../data/db';
import { config } from '../lib/config';
export type Job = {
  id: number;
  key: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  lock_token: string;
};
export async function enqueue(
  key: string,
  kind: string,
  payload: unknown,
  runAt = new Date(),
  database?: Database,
) {
  return (
    await (database || (await db())).query(
      'INSERT INTO jobs(key,kind,payload,run_at) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO NOTHING RETURNING id',
      [key, kind, JSON.stringify(payload), runAt.toISOString()],
    )
  ).rows;
}
export async function reserve(
  service: 'tmdb' | 'saa',
  units: number,
  interactive = false,
) {
  const c = config();
  const dailyLimit =
    service === 'saa'
      ? Math.floor(c.SAA_DAILY_BUDGET * (1 - c.BUDGET_BUFFER))
      : c.TMDB_DAILY_BUDGET;
  // Keep a small part of the existing cap available for explicitly submitted
  // title searches; bulk discovery must not consume the entire daily allowance.
  const daily =
    service === 'saa' && !interactive
      ? Math.max(0, dailyLimit - Math.min(100, Math.floor(dailyLimit * 0.1)))
      : dailyLimit;
  const monthly =
    service === 'saa'
      ? Math.floor(c.SAA_MONTHLY_BUDGET * (1 - c.BUDGET_BUFFER))
      : c.TMDB_DAILY_BUDGET * 31;
  const r = await (
    await db()
  ).query<{ ok: boolean }>('SELECT reserve_budget($1,$2,$3,$4) AS ok', [
    service,
    units,
    daily,
    monthly,
  ]);
  return r.rows[0].ok;
}
export function backoff(
  attempt: number,
  retryAfter = 0,
  random = Math.random(),
) {
  return Math.max(
    retryAfter,
    Math.min(3600000, 1000 * 2 ** attempt) * (0.8 + random * 0.4),
  );
}
