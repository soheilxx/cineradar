import { randomUUID } from 'node:crypto';
import type { Database } from '../data/db';

/** A minute schedule must not multiply all workers when a run takes >60s.
 * Expiry exceeds the hosted function's 300s maximum and recovers killed runs.
 */
export async function withCronLease<T>(
  database: Database,
  task: () => Promise<T>,
): Promise<T | null> {
  const token = randomUUID();
  const claim = await database.query<{ key: string }>(
    `INSERT INTO operations(key,data) VALUES('cron-lease',jsonb_build_object('token',$1::text,'until',now()+interval '330 seconds'))
    ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()
      WHERE (operations.data->>'until')::timestamptz<=now()
    RETURNING key`,
    [token],
  );
  if (!claim.rows.length) return null;
  try {
    return await task();
  } finally {
    await database.query(
      "DELETE FROM operations WHERE key='cron-lease' AND data->>'token'=$1",
      [token],
    );
  }
}
