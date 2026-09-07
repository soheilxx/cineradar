import test from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema } from '../lib/contact-schema';

test('contact requests require a usable reply address, including direct API submissions', () => {
  const message = {
    locale: 'de',
    market: 'de',
    name: 'Test Person',
    subject: 'Angebotsfehler',
    message: 'Bitte prüfen Sie diesen Titel.',
  };
  for (const email of [undefined, '', ' ', 'invalid', 'person@']) {
    assert.equal(contactSchema.safeParse({ ...message, email }).success, false);
  }
  assert.equal(
    contactSchema.parse({ ...message, email: ' person@example.com ' }).email,
    'person@example.com',
  );
  assert.equal(
    contactSchema.safeParse({
      ...message,
      email: 'person@example.com',
      website: 'spam',
    }).success,
    false,
  );
  for (const field of ['name', 'subject'])
    assert.equal(
      contactSchema.safeParse({
        ...message,
        email: 'person@example.com',
        [field]: '',
      }).success,
      false,
    );
});
