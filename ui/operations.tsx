import { admin } from '@/lib/security';
import { config } from '@/lib/config';
import { db } from '@/data/db';
import { t } from '@/i18n/messages';
import { path } from '@/i18n/routes';
import type { Locale } from '@/i18n/config';
import { PageHeading } from './pages';
export async function OperationsPage({
  locale,
  market,
}: {
  locale: Locale;
  market: string;
}) {
  const c = config();
  const returnTo = path(locale, market, 'ops');
  if (!(await admin()))
    return (
      <>
        <PageHeading locale={locale} title={t(locale, 'ops')} />
        <form
          action="/api/admin/login"
          method="post"
          className="panel login-form"
        >
          <label>
            {t(locale, 'password')}
            <input
              type="password"
              name="key"
              required
              autoComplete="current-password"
              minLength={24}
            />
          </label>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            className="button primary"
            disabled={!c.ADMIN_KEY || !c.DATABASE_URL}
          >
            {t(locale, 'login')}
          </button>
          {!c.ADMIN_KEY && <p className="hint">{t(locale, 'disabled')}</p>}
        </form>
      </>
    );
  const d = await db();
  const [jobs, budgets, ops, reports, quarantines, metrics] = await Promise.all(
    [
      d.query<{
        id: number;
        kind: string;
        state: string;
        attempts: number;
        error_code: string | null;
        run_at: string;
        heartbeat: string | null;
      }>(
        'SELECT id,kind,state,attempts,error_code,run_at,heartbeat FROM jobs ORDER BY id DESC LIMIT 50',
      ),
      d.query<{ service: string; period: string; consumed: number }>(
        'SELECT * FROM budgets ORDER BY period DESC LIMIT 10',
      ),
      d.query<{ key: string; data: { paused?: boolean; heartbeat?: string } }>(
        'SELECT * FROM operations',
      ),
      d.query<{
        id: number;
        message: string;
        email: string | null;
        name: string | null;
        subject: string | null;
        resolved: boolean;
        created_at: string;
      }>(
        'SELECT id,message,email,name,subject,resolved,created_at FROM reports ORDER BY id DESC LIMIT 30',
      ),
      d.query<{ id: number; scope: string; reason: string; at: string }>(
        'SELECT id,scope,reason,at FROM quarantines ORDER BY id DESC LIMIT 10',
      ),
      d.query<{
        market: string;
        titles: number;
        overdue: number;
        oldest: string | null;
      }>(
        "SELECT market,count(*) AS titles,count(*) FILTER(WHERE checked_at<now()-interval '36 hours' OR checked_at IS NULL) AS overdue,min(checked_at) AS oldest FROM snapshots GROUP BY market",
      ),
    ],
  );
  const paused = ops.rows.find((r) => r.key === 'sync')?.data.paused;
  const heartbeat = ops.rows.find((r) => r.key === 'scheduler')?.data.heartbeat;
  const healthy = heartbeat && Date.now() - Date.parse(heartbeat) < 300000;
  const action = (name: string, id?: number) => (
    <form action="/api/admin/action" method="post">
      <input type="hidden" name="action" value={name} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {id && <input type="hidden" name="id" value={id} />}
      <button className="button">
        {t(
          locale,
          name === 'retry'
            ? 'retry'
            : name === 'resolve'
              ? 'resolve'
              : name === 'pause'
                ? 'pause'
                : name === 'resume'
                  ? 'resume'
                  : 'logout',
        )}
      </button>
    </form>
  );
  return (
    <>
      <PageHeading locale={locale} title={t(locale, 'ops')} />
      <div className="page-toolbar">
        {action(paused ? 'resume' : 'pause')}
        {action('logout')}
      </div>
      <div className="ops-grid">
        <div className="panel">
          <span>{t(locale, 'heartbeat')}</span>
          <strong>
            {ops.rows.find((r) => r.key === 'scheduler')?.data.heartbeat ||
              t(locale, 'noData')}
          </strong>
        </div>
        <div className="panel">
          <span>{t(locale, 'jobs')}</span>
          <strong>
            {jobs.rows.filter((r) => r.state === 'queued').length}
          </strong>
        </div>
        <div className="panel">
          <span>{t(locale, 'data')}</span>
          <strong>
            {c.SYNC_ENABLED === 'true' && !paused && healthy
              ? t(locale, 'operational')
              : t(locale, healthy ? 'disabled' : 'stale')}
          </strong>
        </div>
      </div>
      <h2>{t(locale, 'jobs')}</h2>
      <div className="ops-grid">
        {metrics.rows.map((row) => (
          <div className="panel" key={row.market}>
            <strong>{row.market.toUpperCase()}</strong>
            <p>{t(locale, 'results', { count: Number(row.titles) })}</p>
            <p>
              {t(locale, 'stale')}: {row.overdue}
            </p>
            <p>
              {row.oldest
                ? new Date(row.oldest).toISOString()
                : t(locale, 'noData')}
            </p>
          </div>
        ))}
      </div>
      <div className="table-scroll">
        <table className="ops-table">
          <tbody>
            {jobs.rows.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>{j.kind}</td>
                <td>{j.state}</td>
                <td>{j.error_code}</td>
                <td>{new Date(j.run_at).toISOString()}</td>
                <td>
                  {['dead', 'paused'].includes(j.state) &&
                    action('retry', j.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="section">
        <h2>{t(locale, 'budget')}</h2>
        <div className="table-scroll">
          <table className="ops-table">
            <tbody>
              {budgets.rows.map((b) => (
                <tr key={b.service + b.period}>
                  <td>{b.service}</td>
                  <td>{b.period}</td>
                  <td>{b.consumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <h2>{t(locale, 'reports')}</h2>
        {reports.rows.map((r) => (
          <article className="panel" key={r.id}>
            {r.subject && <h3>{r.subject}</h3>}
            {r.name && <p>{r.name}</p>}
            <p>{r.message}</p>
            {r.email && <p>{r.email}</p>}
            {!r.resolved && action('resolve', r.id)}
          </article>
        ))}
      </section>
      {quarantines.rows.length > 0 && (
        <section className="section">
          <h2>{t(locale, 'data')}</h2>
          {quarantines.rows.map((q) => (
            <p key={q.id}>
              {q.scope}: {q.reason}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
