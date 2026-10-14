// Fogar in dataset.json i app-mallen, omsluter med fullständig HTML och skriver index.html.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const tpl = readFileSync(`${ROOT}src/app.template.html`, 'utf8');
const data = readFileSync(`${ROOT}data/dataset.json`, 'utf8');

if (!tpl.includes('__DATASET__')) throw new Error('mallen saknar platshållaren __DATASET__');
const body = tpl.replace('__DATASET__', () => data);

// Extract <title>, <style>, HTML content, and <script> from the template
const titleMatch = body.match(/<title>(.+?)<\/title>/);
const styleMatch = body.match(/<style>([\s\S]*?)<\/style>/);
const scriptMatch = body.match(/<script>([\s\S]*?)<\/script>/);

// Everything between </style> and <script> is the body HTML
const styleEnd = body.indexOf('</style>') + '</style>'.length;
const scriptStart = body.indexOf('<script>');
const bodyHtml = body.slice(styleEnd, scriptStart).trim();

const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${titleMatch?.[1] ?? 'Gymnasiekollen'}</title>
  <meta name="description" content="Jämför gymnasieskolor och se dina chanser baserat på meritvärde">
  <meta name="theme-color" content="#17527d" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0e1418" media="(prefers-color-scheme: dark)">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" href="icon-192.png">
  <link rel="icon" href="icon-192.png">
  <link rel="manifest" href="manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <style>${styleMatch?.[1] ?? ''}</style>
</head>
<body>
${bodyHtml}
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
${scriptMatch?.[1] ?? ''}
</script>
</body>
</html>`;

writeFileSync(`${ROOT}index.html`, html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} kB`);
