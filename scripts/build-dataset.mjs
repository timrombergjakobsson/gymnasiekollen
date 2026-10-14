// Bygger data/dataset.json av de rå Excel-uttagen från Gymnasieantagningen Storsthlm.
// Körs som: node scripts/build-dataset.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const YEARS = [2024, 2025, 2026];
const ROOT = new URL('..', import.meta.url).pathname;

// Gy25: 6 högskoleförberedande + 12 yrkesprogram. Övriga koder är riksrekryterande
// yrkesutbildningar, introduktionsprogram eller påbyggnad.
const PROGRAMS = {
  EK: { name: 'Ekonomiprogrammet',                    type: 'hf',    behorighet: 'hf-so' },
  ES: { name: 'Estetiska programmet',                 type: 'hf',    behorighet: 'hf' },
  HU: { name: 'Humanistiska programmet',              type: 'hf',    behorighet: 'hf-so' },
  NA: { name: 'Naturvetenskapsprogrammet',            type: 'hf',    behorighet: 'hf-no' },
  SA: { name: 'Samhällsvetenskapsprogrammet',         type: 'hf',    behorighet: 'hf-so' },
  TE: { name: 'Teknikprogrammet',                     type: 'hf',    behorighet: 'hf-no' },
  BA: { name: 'Bygg- och anläggningsprogrammet',      type: 'yrke',  behorighet: 'yrke' },
  BF: { name: 'Barn- och fritidsprogrammet',          type: 'yrke',  behorighet: 'yrke' },
  EE: { name: 'El- och energiprogrammet',             type: 'yrke',  behorighet: 'yrke' },
  FR: { name: 'Frisör- och stylistprogrammet',        type: 'yrke',  behorighet: 'yrke' },
  FS: { name: 'Försäljnings- och serviceprogrammet',  type: 'yrke',  behorighet: 'yrke' },
  FT: { name: 'Fordons- och transportprogrammet',     type: 'yrke',  behorighet: 'yrke' },
  HT: { name: 'Hotell- och turismprogrammet',         type: 'yrke',  behorighet: 'yrke' },
  IN: { name: 'Industritekniska programmet',          type: 'yrke',  behorighet: 'yrke' },
  NB: { name: 'Naturbruksprogrammet',                 type: 'yrke',  behorighet: 'yrke' },
  RL: { name: 'Restaurang- och livsmedelsprogrammet', type: 'yrke',  behorighet: 'yrke' },
  VF: { name: 'VVS- och fastighetsprogrammet',        type: 'yrke',  behorighet: 'yrke' },
  VO: { name: 'Vård- och omsorgsprogrammet',          type: 'yrke',  behorighet: 'yrke' },
  IB: { name: 'International Baccalaureate',          type: 'hf',    behorighet: 'hf' },
  DS: { name: 'Design och sömnadstekniska utbildningen', type: 'riks', behorighet: 'yrke' },
  FI: { name: 'Finsnickeriutbildningen',              type: 'riks',  behorighet: 'yrke' },
  FL: { name: 'Flygteknikutbildningen',               type: 'riks',  behorighet: 'yrke' },
  FO: { name: 'Floristutbildningen',                  type: 'riks',  behorighet: 'yrke' },
  GU: { name: 'Guldsmedsutbildningen',                type: 'riks',  behorighet: 'yrke' },
  MA: { name: 'Marinteknikutbildningen',              type: 'riks',  behorighet: 'yrke' },
  SJ: { name: 'Sjöfartsutbildningen',                 type: 'riks',  behorighet: 'yrke' },
  TA: { name: 'Tågteknikutbildningen',                type: 'riks',  behorighet: 'yrke' },
  VI: { name: 'Vidareutbildning, fjärde tekniska året', type: 'pabyggnad', behorighet: 'pabyggnad' },
  IM: { name: 'Introduktionsprogram',                 type: 'im',    behorighet: 'im' },
};

// Storsthlms samverkansområde omfattar även Håbo (Uppsala län) och Gnesta
// (Södermanlands län). Appen listar bara Stockholms län.
const UTANFOR_STOCKHOLMS_LAN = new Set(['Håbo', 'Gnesta']);

const num = (v) => (v == null || v === '' ? null : Number(v));
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function readYear(year) {
  const rows = JSON.parse(readFileSync(`${ROOT}data/rows${year}.json`, 'utf8'));
  const header = rows[0].cells;
  const col = {};
  for (const [ref, label] of Object.entries(header)) col[label.replace('Ar', 'År')] = ref;
  return rows.slice(1).map((r) => {
    const get = (label) => r.cells[col[label]];
    const studievag = (get('Studievag') || '').replace(/\s+/g, ' ').trim();
    const base = studievag.split(' - ')[0];
    return {
      kommun: get('Kommun'),
      skola: (get('Skola') || '').trim(),
      org: get('Organistionsform') || null,
      code: get('StudieVagKod'),
      studievag,
      inriktning: studievag.includes(' - ') ? studievag.slice(base.length + 3) : null,
      program: base.split(' ').pop(),
      grans: num(get('Antagningsgrans')),
      median: num(get('Median')),
      platser: num(get('AntalPlatser')),
      antagna: num(get('AntalAntagna')),
      reserver: num(get('AntalReserver')),
      lediga: num(get('AntalLedigaPlatser')),
    };
  }).filter((r) => r.skola && r.studievag && !UTANFOR_STOCKHOLMS_LAN.has(r.kommun));
}

const byYear = Object.fromEntries(YEARS.map((y) => [y, readYear(y)]));
const latest = byYear[2026];

// Index tidigare år på kommun|skola|studievag för trendjämförelse.
const history = {};
for (const y of YEARS.slice(0, -1)) {
  history[y] = new Map();
  for (const r of byYear[y]) history[y].set(`${norm(r.kommun)}|${norm(r.skola)}|${norm(r.studievag)}`, r);
}

const schools = [];
const schoolIndex = new Map();
const rows = [];

for (const r of latest) {
  const key = `${norm(r.kommun)}|${norm(r.skola)}`;
  if (!schoolIndex.has(key)) {
    schoolIndex.set(key, schools.length);
    schools.push({ namn: r.skola, kommun: r.kommun, org: r.org === 'F' ? 'fristående' : 'kommunal' });
  }
  const histKey = `${norm(r.kommun)}|${norm(r.skola)}|${norm(r.studievag)}`;
  rows.push({
    s: schoolIndex.get(key),
    p: PROGRAMS[r.program] ? r.program : 'IM',
    kod: r.code,
    inr: r.inriktning,
    g: [history[2024].get(histKey)?.grans ?? null, history[2025].get(histKey)?.grans ?? null, r.grans],
    med: r.median,
    pl: r.platser,
    an: r.antagna,
    res: r.reserver,
    led: r.lediga,
  });
}

const kommuner = [...new Set(schools.map((s) => s.kommun))].sort((a, b) => a.localeCompare(b, 'sv'));

const dataset = {
  meta: {
    kalla: 'Gymnasieantagningen Storsthlm – slutantagningsresultat',
    kallaUrl: 'https://gymnasieantagningen.storsthlm.se/antagningsgranser-elevnojdhet/ladda-ned-antagningsstatistik/',
    hamtad: new Date().toISOString().slice(0, 10),
    ar: YEARS,
    senasteAr: 2026,
    antalSkolor: schools.length,
    antalUtbildningar: rows.length,
  },
  program: PROGRAMS,
  kommuner,
  skolor: schools,
  utbildningar: rows,
};

writeFileSync(`${ROOT}data/dataset.json`, JSON.stringify(dataset));
console.log(`skolor: ${schools.length}  utbildningar: ${rows.length}  kommuner: ${kommuner.length}`);
const withHist = rows.filter((r) => r.g[1] != null).length;
console.log(`matchade mot 2025: ${withHist}  mot 2024: ${rows.filter((r) => r.g[0] != null).length}`);
console.log(`storlek: ${(JSON.stringify(dataset).length / 1024).toFixed(0)} kB`);
