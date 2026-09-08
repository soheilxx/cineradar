import { db, type Database } from '../data/db';
import { config } from '../lib/config';
import { mediaStats, registerMediaSources } from '../data/media/repository';
import { runMediaBatch } from '../jobs/media';

const command = process.argv[2] || 'status';
const summarize = (states: Awaited<ReturnType<typeof mediaStats>>) =>
  states.map(({ bytes, ...state }) => ({ ...state, logicalBytes: bytes }));
let database: Database | undefined;
try {
  if (!['status', 'enqueue', 'run'].includes(command))
    throw new Error('Expected status, enqueue or run');
  const c = config();
  if (!c.mediaEnabled) {
    console.log(JSON.stringify({ enabled: false, states: [] }, null, 2));
  } else {
    database = await db();
    if (command === 'status') {
      console.log(
        JSON.stringify(
          { enabled: true, states: summarize(await mediaStats(database)) },
          null,
          2,
        ),
      );
    } else if (command === 'enqueue') {
      let total = 0;
      // Registration is independent of downloading and does not consume provider API calls.
      for (let batch = 0; batch < 100; batch++) {
        const count = await registerMediaSources(database, 1000);
        total += count;
        if (count === 0) break;
      }
      console.log(
        JSON.stringify(
          {
            enabled: true,
            registered: total,
            states: summarize(await mediaStats(database)),
          },
          null,
          2,
        ),
      );
    } else {
      const result = await runMediaBatch({
        maxJobs: 40,
        maxDurationMs: 60000,
        database,
      });
      console.log(
        JSON.stringify(
          {
            ...result,
            ...('states' in result && result.states
              ? { states: summarize(result.states) }
              : {}),
          },
          null,
          2,
        ),
      );
    }
  }
} finally {
  await database?.close?.();
}
