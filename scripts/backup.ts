import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const mode = process.argv[2];
const target = process.argv[3];
if (!['backup', 'restore'].includes(mode) || !target)
  throw Error('Use backup <directory> or restore <dump-file>');
// Connection secrets travel in child environment, never process arguments.
const connection =
  mode === 'restore'
    ? process.env.RESTORE_DATABASE_URL
    : process.env.DATABASE_URL;
if (!connection) throw Error('Missing database connection');
if (mode === 'restore' && connection === process.env.DATABASE_URL)
  throw Error('Restore requires a separate target database');
const url = new URL(connection);
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  ...(url.searchParams.has('sslmode')
    ? { PGSSLMODE: url.searchParams.get('sslmode')! }
    : {}),
};
async function command(name: string, args: string[]) {
  await new Promise<void>((ok, fail) => {
    const p = spawn(name, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    p.stderr.resume();
    p.on('error', () => fail(Error(name + ' unavailable')));
    p.on('exit', (code) =>
      code === 0 ? ok() : fail(Error(name + ' failed; inspect server logs')),
    );
  });
}
if (mode === 'backup') {
  const directory = resolve(target);
  await mkdir(directory, { recursive: true });
  const file = resolve(
    directory,
    'cineradar-' + new Date().toISOString().replace(/[:.]/g, '-') + '.dump',
  );
  await command('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file',
    file,
  ]);
  await writeFile(
    file + '.json',
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        format: 'postgres-custom',
        restore:
          'npm run db:restore -- <dump-file>; requires separate RESTORE_DATABASE_URL',
      },
      null,
      2,
    ),
  );
  console.log('Backup created:', file);
} else {
  // Empty isolated database only: no destructive --clean / drop command.
  await command('pg_restore', [
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    '--no-acl',
    '--dbname',
    env.PGDATABASE,
    resolve(target),
  ]);
  console.log(
    'Restored into isolated target. Run readiness and record-count checks before switching traffic.',
  );
}
