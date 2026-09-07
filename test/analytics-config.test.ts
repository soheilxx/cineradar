import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../lib/config';

const production = {
  APP_MODE: 'live',
  DEPLOYMENT_ENV: 'production',
  SITE_URL: 'https://cineradar.example',
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  TMDB_READ_ACCESS_TOKEN: 'test',
  SAA_API_KEY: 'test',
  SESSION_SECRET: 'x'.repeat(32),
  ADMIN_KEY: 'y'.repeat(24),
  OPERATOR_NAME: 'Test operator',
  OPERATOR_ADDRESS: 'Test address',
  CONTACT_EMAIL: 'support@example.test',
  LEGAL_APPROVED: 'true',
  LICENSES_CONFIRMED: 'true',
};

test('Analytics requires explicit production activation', () => {
  assert.equal(config(production).analyticsEnabled, false);
  assert.equal(
    config({ ...production, GA4_ENABLED: 'true' }).analyticsEnabled,
    true,
  );
  assert.equal(
    config({ ...production, GA4_DEBUG: 'true' }).analyticsEnabled,
    false,
  );
});

test('Preview deployments cannot collect Analytics even with flags copied from production', () => {
  assert.equal(
    config({
      ...production,
      DEPLOYMENT_ENV: 'preview',
      GA4_ENABLED: 'true',
      GA4_DEBUG: 'true',
    }).analyticsEnabled,
    false,
  );
});

test('Local Analytics QA requires an explicit debug flag and loopback origin', () => {
  assert.equal(config({ GA4_ENABLED: 'true' }).analyticsEnabled, false);
  assert.equal(config({ GA4_DEBUG: 'true' }).analyticsEnabled, true);
  assert.equal(
    config({ GA4_DEBUG: 'true', SITE_URL: 'http://127.0.0.1:3000' })
      .analyticsEnabled,
    true,
  );
  assert.equal(
    config({ GA4_DEBUG: 'true', SITE_URL: 'https://example.test' })
      .analyticsEnabled,
    false,
  );
});
