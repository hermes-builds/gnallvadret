# Gnällvädret

Vädret för fyra småländska orter, kommenterat av en butter gubbe som aldrig
blir nöjd. Regnar det är det eländigt. Skiner solen är det också eländigt,
för snart regnar det ändå.

**Live:** https://hermes-builds.github.io/gnallvadret/

![Gnällvädret på mobil](https://img.shields.io/badge/mobil-375px-informational)

## Vad appen gör

- **Fyra platser** med väljare — Mullsjö (förvalt), Smålandsstenar, Gislaved
  och Jönköping. Valet sparas i `localStorage` och ligger kvar nästa gång.
- **Vädret just nu**: temperatur, vädersymbol, vind (med riktning) samt
  nedbörd och luftfuktighet.
- **Rullande 7-dygnsprognos**: idag plus sex dygn framåt, räknat från
  klockan just nu — inga hårdkodade datum. Per dygn visas lägsta och högsta
  temperatur, dygnets dominerande vädersymbol och summerad nedbörd.
- **Den buttre gubben**: 33 olika svenska repliker — 28 valda efter
  väderläget (regn 6, sol 6, moln 6, snö 5, blåst 5) och slumpade inom
  kategorin, plus 5 utbrott av översvallande glädje som surnar inom samma
  mening. Blåser det över 10 m/s tar blåsten över som samtalsämne.
  Därtill 4 sura repliker för felläget.
- **Felläge** på svenska i samma sura tonläge om API-anropet strular, med en
  "Försök igen"-knapp. Detaljraden hämtas alltid ur tabellen `ERROR_DETAILS`
  (nät / HTTP / obegriplig data / okänt) — webbläsarens egna engelska
  felsträngar som "Failed to fetch" renderas aldrig, de går till
  `console.error`.

Gränssnittet är helt på svenska. Mobile first: byggt och verifierat i 375px
bredd, med tumvänliga träffytor på minst 44px.

## Datakälla

SMHI öppna data, punktprognos — ingen API-nyckel, CORS tillåtet för
webbläsare (`access-control-allow-origin: *`):

```
https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/{lon}/lat/{lat}/data.json
```

### Not om API-versionen

Den tidigare specifikationen pekade på `pmp3g/version/2`. **Det API:et
avvecklades av SMHI den 31 mars 2026 och svarar nu HTTP 404** på samtliga
endpoints, inklusive sin egen rot. Appen använder därför SMHI:s egen
ersättare `snow1g/version/1` — samma leverantör, samma domän, fortfarande
nyckelfri. Open-Meteo behövdes aldrig som reserv, eftersom SMHI:s nya API
fungerar direkt från webbläsaren.

Skillnader mot det gamla API:et som koden hanterar:

| PMP3gv2 | SNOW1gv1 |
| --- | --- |
| `validTime` | `time` |
| `parameters: [{name, values:[v]}]` | platt `data: {namn: värde}` |
| `t` | `air_temperature` |
| `ws` | `wind_speed` |
| `pmean` | `precipitation_amount_mean` |
| `Wsymb2` | `symbol_code` (samma skala 1–27) |

Vädersymbolerna följer SMHI:s **Wsymb2**-skala (1–27), mappad till svensk
text och ikon i `weather.js`.

Två detaljer i datan som är lätta att göra fel på, och som koden hanterar:

- `precipitation_amount_mean` är **ackumulerad nedbörd i mm över
  intervallet** `intervalParametersStartTime → time`, inte mm/h. Prognosen
  går från 1-timmesintervall till 6- och 12-timmesintervall längre fram, så
  värdena summeras rakt av per dygn.
- `9999` är SMHI:s markör för saknat värde och filtreras bort. Observera att
  `-9` *inte* filtreras — det är en helt normal svensk vintertemperatur.

Dygnsindelningen görs i **svensk lokaltid** (`Europe/Stockholm`), inte UTC,
så att "idag" betyder idag även sent på kvällen.

## Köra lokalt

Ingen byggkedja, inga beroenden. Allt ligger i repo-roten.

```bash
python3 -m http.server 8199
# öppna http://127.0.0.1:8199/
```

## Tester

Logiken i `weather.js` är fri från DOM-beroenden och testas med Node:s
inbyggda testkörare — inga npm-paket behövs.

```bash
npm test          # 36 tester: Wsymb2, personaregler, rullande dygn,
                  # tidszon, nedbördssummering, sentinelvärden
```

Utöver det finns en browser-verifiering som kör appen i en 375px mobil-
viewport mot live-data från SMHI och kontrollerar CORS, platsväljaren,
den rullande prognosen, felläget och att inget spiller över kanten.
Playwright är medvetet *inte* ett beroende i `package.json` — appen ska
förbli byggstegsfri:

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers npx playwright install chromium

# med http.server igång i repo-roten:
NODE_PATH=/tmp/pw/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers \
  node tests/e2e.mjs
```

## Filer

| Fil | Roll |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Mobile-first stil, 375px och uppåt |
| `weather.js` | All logik: Wsymb2, persona, dygnsaggregering, formatering |
| `app.js` | Hämtning och DOM-rendering |
| `tests/weather.test.js` | Enhetstester (`node --test`) |
| `tests/e2e.mjs` | Browser-verifiering i mobilviewport |

## Platser och koordinater

Koordinaterna är kontrollerade mot OpenStreetMap (Nominatim) så att de
träffar rätt tätort, inte bara rätt kommun.

| Plats | Lat | Lon |
| --- | --- | --- |
| Mullsjö | 57.917 | 13.880 |
| Smålandsstenar | 57.166 | 13.411 |
| Gislaved | 57.303 | 13.536 |
| Jönköping | 57.782 | 14.156 |

## Licens

Väderdata från SMHI öppna data (Creative Commons Erkännande 4.0).
