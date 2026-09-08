import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { locales, defaultMarkets, type Locale } from '../i18n/config';
import { identifyEditorial } from '../content/identify-editorial';
import { identifyExampleLabels } from '../content/identify';
import { IdentifyExperience } from '../ui/identify-experience';

const variants = ['page', 'home'] as const;
function composer(locale: Locale, variant: (typeof variants)[number]) {
  return createElement(IdentifyExperience, {
    key: variant,
    locale,
    market: defaultMarkets[locale],
    aiEnabled: false,
    examples: identifyEditorial[locale].examples,
    variant,
  });
}

test('The server-rendered description form cannot send a private memory before hydration', () => {
  for (const locale of locales)
    for (const variant of variants) {
      const context = `${locale}/${variant}`;
      const html = renderToStaticMarkup(composer(locale, variant));
      const form = html.match(/<form\b[^>]*>/)?.[0] ?? '';
      const textarea = html.match(/<textarea\b[^>]*>/)?.[0] ?? '';
      const buttons = html.match(/<button\b[^>]*>/g) ?? [];
      const submits = buttons.filter((button) =>
        /\btype="submit"/.test(button),
      );
      const microphone =
        buttons.find((button) =>
          button.includes('data-analytics-control="voice_start"'),
        ) ?? '';
      assert.match(form, /\bmethod="post"/i, context);
      assert.match(textarea, /\sdisabled(?:=|\s|>)/, context);
      assert.doesNotMatch(textarea, /\sname=/, context);
      assert.equal(submits.length, 1, context);
      assert.match(submits[0], /\sdisabled(?:=|\s|>)/, context);
      assert.match(microphone, /\sdisabled(?:=|\s|>)/, context);
    }
});

test('Homepage and page composers have distinct IDs and resolvable labels and ARIA references', () => {
  for (const locale of locales) {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        ...variants.map((variant) => composer(locale, variant)),
      ),
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${locale}: duplicate IDs`);
    for (const reference of html.matchAll(
      /\s(?:for|aria-controls|aria-describedby|aria-labelledby)="([^"]+)"/g,
    ))
      for (const id of reference[1].split(/\s+/))
        assert.ok(ids.includes(id), `${locale}: unresolved reference ${id}`);

    const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? [];
    assert.equal(forms.length, 2, locale);
    let depth = 0;
    for (const tag of html.matchAll(/<\/?form\b[^>]*>/g)) {
      depth += tag[0].startsWith('</') ? -1 : 1;
      assert.ok(depth >= 0 && depth <= 1, `${locale}: nested forms`);
    }
    assert.equal(depth, 0, locale);
    for (const form of forms) {
      const textarea = form.match(/<textarea\b[^>]*>/)?.[0] ?? '';
      const inputId = textarea.match(/\sid="([^"]+)"/)?.[1];
      assert.ok(inputId, `${locale}: unnamed textarea ID`);
      assert.ok(
        form.includes(`for="${inputId}"`),
        `${locale}: label targets the other composer`,
      );
      const describedBy = textarea.match(/\saria-describedby="([^"]+)"/)?.[1];
      assert.ok(describedBy, `${locale}: missing textarea help reference`);
      for (const id of describedBy.split(/\s+/))
        assert.ok(
          form.includes(`id="${id}"`),
          `${locale}: help targets the other composer`,
        );
    }
  }
});

test('The primary submit precedes closed optional filters and example actions in document order', () => {
  for (const locale of locales)
    for (const variant of variants) {
      const context = `${locale}/${variant}`;
      const html = renderToStaticMarkup(composer(locale, variant));
      const submit = [...html.matchAll(/<button\b[^>]*>/g)].find((match) =>
        /\btype="submit"/.test(match[0]),
      );
      assert.ok(submit, context);
      const optionalFilters = [
        ...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g),
      ].find((match) => /<fieldset\b/.test(match[0]));
      assert.ok(optionalFilters, `${context}: filters must be a disclosure`);
      assert.doesNotMatch(
        optionalFilters[0].split('>')[0],
        /\sopen(?:=|\s|$)/,
        `${context}: filters start closed`,
      );
      assert.ok(
        submit.index < optionalFilters.index,
        `${context}: primary action follows optional filters`,
      );

      const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)];
      for (const label of identifyExampleLabels[locale]) {
        const encodedLabel = renderToStaticMarkup(
          createElement('span', null, label),
        ).slice(6, -7);
        const example = buttons.find((match) =>
          match[0].includes(encodedLabel),
        );
        assert.ok(example, `${context}: missing example action`);
        assert.ok(
          submit.index < example.index,
          `${context}: primary action follows examples`,
        );
      }
    }
});
