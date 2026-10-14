# Gymnasiekollen

Ett verktyg för gymnasievalet i Stockholms län: alla utbildningar med antagnings-
gränser från slutantagningen, chansbedömning utifrån meritvärde, en rangordnad
vallista (max 30 val) och tidplanen för valet.

Källdatan täcker hela Storsthlms samverkansområde, som även omfattar Håbo
(Uppsala län) och Gnesta (Södermanlands län). De filtreras bort i
`scripts/build-dataset.mjs` via `UTANFOR_STOCKHOLMS_LAN` – ta bort kommunen ur
den mängden för att ta in den igen.

Publicerad som Artifact: `https://claude.ai/code/artifact/0586fe7c-a85e-4b1f-9b46-fd29313033c4`

## Struktur

| Fil | Roll |
| --- | --- |
| `src/app.template.html` | Hela appen. `__DATASET__` är platshållaren för datan. |
| `data/dataset.json` | Sammanslagen data, byggd av rådatan. |
| `data/rows20XX.json` | Rå Excel-uttag, ett per år. |
| `index.html` | Genererad, publicerbar fil (mall + data inbakad). Redigera inte direkt. |
| `scripts/xlsx2json.mjs` | Läser en uppackad `.xlsx` utan beroenden. |
| `scripts/build-dataset.mjs` | Slår ihop åren, klassar program, skriver `dataset.json`. |
| `scripts/build.mjs` | Bakar in datan i mallen, skriver `index.html`. |

## Bygga om

```sh
node scripts/build-dataset.mjs   # data/rows*.json -> data/dataset.json
node scripts/build.mjs           # mall + data      -> index.html
```

## Uppdatera med ett nytt år

Slutantagningen publiceras runt 1 juli. Nya filer hämtas från
[Ladda ned antagningsstatistik](https://gymnasieantagningen.storsthlm.se/antagningsgranser-elevnojdhet/ladda-ned-antagningsstatistik/).

```sh
curl -L -o /tmp/slut2027.xlsx "https://gymnasieantagningen.storsthlm.se/media/<id>/slutantagningsresultat-2027.xlsx"
unzip -o -q /tmp/slut2027.xlsx -d /tmp/x2027
node scripts/xlsx2json.mjs /tmp/x2027 data/rows2027.json
```

Lägg sedan till året i `YEARS` i `scripts/build-dataset.mjs` (senaste året sist —
det är det som blir `senasteAr` och driver chansbedömningen) och bygg om.

Kolumnerna i Excel-filen är `År, Kommun, Skola, Organistionsform, StudieVagKod,
Studievag, Antagningsgrans, Median, AntalPlatser, AntalAntagna, AntalReserver,
AntalLedigaPlatser`. 2024-filen saknar `Organistionsform`; parsern mappar på
kolumnnamn och klarar båda varianterna.

## Att veta om datan

- **Antagningsgräns** = meritvärdet hos den sist antagna i slutantagningen.
  **Gräns 0** = alla behöriga kom in, platser fanns kvar. Appen visar det som
  "alla in" och räknar det som god chans.
- Utbildningar med **färdighetsprov** har provpoäng inbakade i gränsen. Ligger
  gränsen över 340 flaggas raden som `provpoäng ingår` och undantas från
  chansbedömningen, eftersom den inte går att jämföra med ett rent meritvärde.
- Historik matchas på `kommun|skola|studievag`. Gy25-reformen bytte namn på flera
  program, så 2024 matchar bara ~51 % av 2026-raderna; omatchade år visas som `–`.
- Tidplanen i appen är 2026-omgångens datum. Datum för antagningen 2027
  publiceras under hösten 2026 och bör stämmas av mot
  [viktiga datum](https://gymnasieantagningen.storsthlm.se/viktiga-datum).

## Skollänkar och öppet hus

Ingen av dem finns i antagningsdatan:

- **Skollänkar.** Skolverkets skolenhetsregister
  (`api.skolverket.se/skolenhetsregistret/v1/skolenhet`) har bara skolenhetskod,
  kommunkod och namn — ingen webbadress. Skolnamnet länkar därför till en
  websökning som fallback. Klistrar man in skolans riktiga adress i fältet på
  valet i Vallistan används den i stället, överallt i appen. Inmatade adresser
  saneras i `stadaUrl()`: bara `http(s)` släpps igenom, bar domän får `https://`.
- **Öppet hus.** Varje skola publicerar sina egna datum, det finns ingen central
  källa. Datumen matas in i fliken Öppet hus och delas via `db`. De visas som
  märke på skolans rader i chanslistan och i vallistan.
- **Gymnasiemässan** ligger hårdkodad i `MASSAN` i mallen: 17–19 november 2026,
  Stockholmsmässan i Älvsjö. Behöver bytas för nästa år.

## Sparad data och delning

Meritvärde, betyg, vallista, anteckningar, hemsidor och öppet hus sparas i
`localStorage` – per webbläsare och enhet.

`db`-capability är medvetet **borttagen**. En artifact som deklarerar `db` är
organisationsintern och kan inte delas publikt, vilket gjorde appen oåtkomlig för
den den var byggd för. Koden för `db` ligger kvar i `connect()` och är testad
(`scratchpad/dbtest.mjs`); den aktiveras genom att publicera med
`capabilities: {db: {}}` igen. Publicera med `capabilities: {}` för att stänga av.

En backup av det gamla delade dokumentet ligger i `backup/state/app.json`
(gitignorerad – innehåller personuppgifter).

I stället delas tillståndet med en **kod** från fliken Vallistan:

- `skapaKod()` packar tillståndet till JSON, deflate-komprimerar via
  `CompressionStream` och base64url-kodar det. Prefix `GK1z` för komprimerat,
  `GK1r` för okomprimerat när `CompressionStream` saknas. En lista med tre val
  blir cirka 240 tecken.
- Betygen är personuppgifter och följer bara med om kryssrutan är i.
- `tillampaKod()` skriver bara över de fält som finns i koden, så en lista utan
  betyg inte nollställer mottagarens egna betyg.
- Ligger en kod i adressens hash (`#GK1...`) förifylls den vid inläsning. Det är
  bara användbart om sidan hostas fristående – inne i claude.ai kör sidan i en
  sandlåde-iframe på egen origin, så en claude.ai-URL kan inte bära koden.
- Koden fungerar också som backup av allt som är sparat lokalt.
