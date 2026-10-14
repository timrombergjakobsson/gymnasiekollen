import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dir = process.argv[2];               // unzipped dir
const out = process.argv[3];

function decode(s) {
  return s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&');
}

// shared strings
const ss = [];
const ssXml = readFileSync(`${dir}/xl/sharedStrings.xml`, 'utf8');
for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  let text = '';
  for (const t of m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += t[1];
  ss.push(decode(text));
}

const sheet = readFileSync(`${dir}/xl/worksheets/sheet1.xml`, 'utf8');
const rows = [];
for (const r of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const c of r[2].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>|<c\s([^>]*)\/>/g)) {
    const attrs = c[1] || c[3] || '';
    const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const body = c[2] || '';
    let val = null;
    if (type === 'inlineStr') {
      let text = '';
      for (const t of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += t[1];
      val = decode(text);
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (v != null) val = type === 's' ? ss[+v] : decode(v);
    }
    if (ref && val !== null && val !== '') cells[ref] = val;
  }
  rows.push({ n: +r[1], cells });
}
writeFileSync(out, JSON.stringify(rows));
console.log('rows:', rows.length);
console.log(JSON.stringify(rows.slice(0, 6), null, 1));
