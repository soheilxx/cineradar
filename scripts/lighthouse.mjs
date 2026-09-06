import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('docs/evidence', { recursive: true });
const chrome = await launch({
  chromePath: chromium
    .executablePath()
    .replace('chromium-1243', 'chromium_headless_shell-1243')
    .replace('chrome-win64', 'chrome-headless-shell-win64')
    .replace('chrome.exe', 'chrome-headless-shell.exe'),
  chromeFlags: ['--headless', '--no-sandbox'],
});
try {
  for (const [name, path] of [
    ['home', '/en/de/'],
    ['movie', '/en/de/movie/inception-27205/'],
    ['series', '/en/de/show/dark-70523/'],
  ]) {
    const r = await lighthouse('http://localhost:3000' + path, {
      port: chrome.port,
      output: ['json', 'html'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      logLevel: 'error',
    });
    await writeFile('docs/evidence/lighthouse-' + name + '.json', r.report[0]);
    await writeFile('docs/evidence/lighthouse-' + name + '.html', r.report[1]);
    console.log(
      JSON.stringify({
        name,
        scores: Object.fromEntries(
          Object.entries(r.lhr.categories).map(([k, v]) => [
            k,
            Math.round(v.score * 100),
          ]),
        ),
        lcp: r.lhr.audits['largest-contentful-paint'].numericValue,
        cls: r.lhr.audits['cumulative-layout-shift'].numericValue,
        issues: Object.values(r.lhr.audits)
          .filter((v) => v.score !== null && v.score < 0.9)
          .map((v) => ({ id: v.id, title: v.title, value: v.displayValue })),
      }),
    );
  }
} finally {
  try {
    chrome.kill();
  } catch {
    console.warn(
      'Browser exited; temporary profile cleanup deferred by Windows.',
    );
  }
}
