import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { locales, defaultMarkets } from '../i18n/config';
import { identifyEditorial } from '../content/identify-editorial';
import { IdentifyExperience } from '../ui/identify-experience';

test('The server-rendered description form cannot send a private memory before hydration', () => {
  for (const locale of locales) {
    const html = renderToStaticMarkup(
      createElement(IdentifyExperience, {
        locale,
        market: defaultMarkets[locale],
        aiEnabled: false,
        examples: identifyEditorial[locale].examples,
      }),
    );
    const form = html.match(/<form\b[^>]*>/)?.[0] ?? '';
    const textarea = html.match(/<textarea\b[^>]*>/)?.[0] ?? '';
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    const submit =
      buttons.find((button) => /\btype="submit"/.test(button)) ?? '';
    const microphone =
      buttons.find((button) =>
        button.includes('data-analytics-control="voice_start"'),
      ) ?? '';
    assert.match(form, /\bmethod="post"/i, locale);
    assert.match(textarea, /\sdisabled(?:=|\s|>)/, locale);
    assert.doesNotMatch(textarea, /\sname=/, locale);
    assert.match(submit, /\sdisabled(?:=|\s|>)/, locale);
    assert.match(microphone, /\sdisabled(?:=|\s|>)/, locale);
  }
});
