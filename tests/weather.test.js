import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  LOCATIONS,
  SYMBOLS,
  PHRASES,
  IRONIC_JOY,
  ERROR_PHRASES,
  ERROR_DETAILS,
  errorKind,
  errorDetailText,
  IRONIC_CHANCE,
  buildUrl,
  clean,
  localDayKey,
  dayKeysFrom,
  personaCategory,
  pickPhrase,
  pickErrorPhrase,
  currentFrom,
  buildDailyForecast,
  formatDayLabel,
  windLabel
} from '../weather.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'mullsjo.json'), 'utf8'));

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

test('four locations, Mullsjo first/default, verified coordinates', () => {
  assert.equal(LOCATIONS.length, 4);
  assert.equal(LOCATIONS[0].name, 'Mullsjö');
  const byName = Object.fromEntries(LOCATIONS.map((l) => [l.name, l]));
  assert.deepEqual(byName['Mullsjö'], { name: 'Mullsjö', lat: 57.917, lon: 13.88 });
  assert.deepEqual(byName['Smålandsstenar'], { name: 'Smålandsstenar', lat: 57.166, lon: 13.411 });
  assert.deepEqual(byName['Gislaved'], { name: 'Gislaved', lat: 57.303, lon: 13.536 });
  assert.deepEqual(byName['Jönköping'], { name: 'Jönköping', lat: 57.782, lon: 14.156 });
});

test('buildUrl targets the SMHI snow1g point forecast endpoint', () => {
  const url = buildUrl({ lat: 57.917, lon: 13.88 });
  assert.match(url, /^https:\/\/opendata-download-metfcst\.smhi\.se\//);
  assert.match(url, /category\/snow1g\/version\/1/);
  assert.match(url, /geotype\/point\/lon\/13\.88\/lat\/57\.917\/data\.json$/);
  // no API key may ever leak into the request
  assert.doesNotMatch(url, /key|token|apikey/i);
});

/* ------------------------------------------------------------------ */
/* Wsymb2 symbol table                                                 */
/* ------------------------------------------------------------------ */

test('Wsymb2 table covers codes 1-27 with Swedish text, icon and category', () => {
  for (let code = 1; code <= 27; code++) {
    const s = SYMBOLS[code];
    assert.ok(s, `missing symbol code ${code}`);
    assert.equal(typeof s.text, 'string');
    assert.ok(s.text.length > 2, `symbol ${code} text too short`);
    assert.equal(typeof s.icon, 'string');
    assert.ok(s.icon.length > 0, `symbol ${code} has no icon`);
    assert.ok(
      ['sun', 'cloud', 'rain', 'snow', 'fog', 'thunder'].includes(s.kind),
      `symbol ${code} has bad kind ${s.kind}`
    );
  }
});

test('Wsymb2 anchors match the official scale', () => {
  assert.equal(SYMBOLS[1].kind, 'sun');
  assert.equal(SYMBOLS[5].kind, 'cloud');
  assert.equal(SYMBOLS[6].kind, 'cloud');
  assert.equal(SYMBOLS[7].kind, 'fog');
  assert.equal(SYMBOLS[8].kind, 'rain');
  assert.equal(SYMBOLS[11].kind, 'thunder');
  assert.equal(SYMBOLS[19].kind, 'rain');
  assert.equal(SYMBOLS[21].kind, 'thunder');
  assert.equal(SYMBOLS[27].kind, 'snow');
});

/* ------------------------------------------------------------------ */
/* Persona category selection                                          */
/* ------------------------------------------------------------------ */

test('personaCategory maps symbols to the five persona buckets', () => {
  assert.equal(personaCategory(1, 2), 'sun');
  assert.equal(personaCategory(2, 2), 'sun');
  assert.equal(personaCategory(5, 2), 'cloud');
  assert.equal(personaCategory(7, 2), 'cloud'); // fog folds into cloud
  assert.equal(personaCategory(18, 2), 'rain');
  assert.equal(personaCategory(21, 2), 'rain'); // thunder folds into rain
  assert.equal(personaCategory(23, 2), 'rain'); // sleet folds into rain
  assert.equal(personaCategory(26, 2), 'snow');
});

test('strong wind overrides the symbol category', () => {
  assert.equal(personaCategory(1, 12), 'wind');
  assert.equal(personaCategory(19, 14), 'wind');
  // just below threshold keeps the symbol category
  assert.equal(personaCategory(1, 9.9), 'sun');
});

test('personaCategory tolerates missing wind data', () => {
  assert.equal(personaCategory(1, null), 'sun');
  assert.equal(personaCategory(1, undefined), 'sun');
});

/* ------------------------------------------------------------------ */
/* Persona phrases                                                     */
/* ------------------------------------------------------------------ */

test('at least 15 distinct Swedish phrases, every category stocked', () => {
  const categories = ['rain', 'sun', 'cloud', 'snow', 'wind'];
  const all = [];
  for (const c of categories) {
    assert.ok(Array.isArray(PHRASES[c]), `category ${c} missing`);
    assert.ok(PHRASES[c].length >= 3, `category ${c} has only ${PHRASES[c].length} phrases`);
    all.push(...PHRASES[c]);
  }
  all.push(...IRONIC_JOY);
  assert.ok(all.length >= 15, `only ${all.length} phrases total`);
  assert.equal(new Set(all).size, all.length, 'duplicate phrases found');
  for (const p of all) {
    assert.equal(typeof p, 'string');
    assert.ok(p.trim().length > 10, `phrase too short: ${p}`);
  }
});

test('sunshine phrases are sour, not cheerful', () => {
  // The pessimist rule: sun must still be bad news.
  const sour = PHRASES.sun.filter((p) => /regn|ovädr|torka|snart|ändå|fäll|förhoppning/i.test(p));
  assert.ok(sour.length >= 3, `only ${sour.length} sun phrases carry the pessimism`);
});

test('ironic joy phrases turn sour inside the same phrase', () => {
  assert.ok(IRONIC_JOY.length >= 3);
  for (const p of IRONIC_JOY) {
    assert.match(p, /\.\.\.|…/, `ironic phrase lacks the turn: ${p}`);
    assert.match(p, /[A-ZÅÄÖ]{3,}/, `ironic phrase lacks shouted joy: ${p}`);
  }
});

test('pickPhrase is deterministic for a given rng and stays in category', () => {
  // rng above IRONIC_CHANCE -> category pool
  const high = () => 0.99;
  const got = pickPhrase('rain', high);
  assert.ok(PHRASES.rain.includes(got));
  assert.equal(pickPhrase('rain', high), got, 'not deterministic');
});

test('pickPhrase reaches every phrase in a category', () => {
  for (const cat of ['rain', 'sun', 'cloud', 'snow', 'wind']) {
    const seen = new Set();
    const n = PHRASES[cat].length;
    for (let i = 0; i < n; i++) {
      // first draw escapes the ironic branch, second draw indexes the pool
      const rng = seq([0.99, i / n]);
      seen.add(pickPhrase(cat, rng));
    }
    assert.equal(seen.size, n, `category ${cat}: reached ${seen.size}/${n} phrases`);
  }
});

test('low rng occasionally yields ironic over-the-top joy', () => {
  const got = pickPhrase('rain', seq([0, 0]));
  assert.ok(IRONIC_JOY.includes(got), `expected ironic joy, got: ${got}`);
});

test('ironic joy is occasional, not the default', () => {
  assert.ok(IRONIC_CHANCE > 0 && IRONIC_CHANCE <= 0.25, `IRONIC_CHANCE=${IRONIC_CHANCE} is not "occasional"`);
});

test('unknown category falls back without throwing', () => {
  const got = pickPhrase('tornado', () => 0.99);
  assert.equal(typeof got, 'string');
  assert.ok(got.length > 0);
});

test('error phrases are Swedish and grumpy', () => {
  assert.ok(ERROR_PHRASES.length >= 3);
  assert.equal(new Set(ERROR_PHRASES).size, ERROR_PHRASES.length);
  const got = pickErrorPhrase(() => 0);
  assert.ok(ERROR_PHRASES.includes(got));
});

/* ------------------------------------------------------------------ */
/* Sentinels                                                           */
/* ------------------------------------------------------------------ */

test('clean maps the 9999 missing-value sentinel to null', () => {
  assert.equal(clean(9999), null);
  assert.equal(clean(undefined), null);
  assert.equal(clean(null), null);
  assert.equal(clean(0), 0);
  assert.equal(clean(13.3), 13.3);
});

test('clean must NOT eat real sub-zero temperatures', () => {
  // -9 is SMHI's sentinel for precipitation_frozen_part only. It is also a
  // perfectly normal Swedish winter temperature, so clean() may not drop it.
  assert.equal(clean(-9), -9);
  assert.equal(clean(-4.5), -4.5);
  assert.equal(clean(-20), -20);
});

/* ------------------------------------------------------------------ */
/* Local day handling (Europe/Stockholm)                               */
/* ------------------------------------------------------------------ */

test('localDayKey uses Swedish local time, not UTC', () => {
  // 22:30Z in October is 00:30 the NEXT day in Stockholm (CEST, +02:00)
  assert.equal(localDayKey(new Date('2026-10-06T22:30:00Z')), '2026-10-07');
  assert.equal(localDayKey(new Date('2026-10-06T10:00:00Z')), '2026-10-06');
  // winter time (CET, +01:00): 23:30Z is still the next day
  assert.equal(localDayKey(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(localDayKey(new Date('2026-12-31T22:30:00Z')), '2026-12-31');
});

test('dayKeysFrom is rolling: it starts at today and spans 7 days', () => {
  const keys = dayKeysFrom(new Date('2026-10-06T08:00:00Z'), 7);
  assert.deepEqual(keys, [
    '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
    '2026-10-10', '2026-10-11', '2026-10-12'
  ]);
});

test('dayKeysFrom shifts with the clock (no hardcoded dates)', () => {
  const a = dayKeysFrom(new Date('2026-10-06T08:00:00Z'), 7);
  const b = dayKeysFrom(new Date('2026-10-07T08:00:00Z'), 7);
  assert.notDeepEqual(a, b);
  assert.equal(b[0], '2026-10-07');
  assert.equal(a[1], b[0], 'consecutive days must overlap by one');
});

test('dayKeysFrom crosses month, year and DST boundaries', () => {
  assert.deepEqual(dayKeysFrom(new Date('2026-12-29T12:00:00Z'), 5),
    ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(dayKeysFrom(new Date('2027-02-26T12:00:00Z'), 4),
    ['2027-02-26', '2027-02-27', '2027-02-28', '2027-03-01']);
  // DST ends 2026-10-25 in Sweden; day arithmetic must not slip
  assert.deepEqual(dayKeysFrom(new Date('2026-10-24T12:00:00Z'), 3),
    ['2026-10-24', '2026-10-25', '2026-10-26']);
});

/* ------------------------------------------------------------------ */
/* Current conditions                                                  */
/* ------------------------------------------------------------------ */

test('currentFrom picks the newest entry at or before now', () => {
  const data = seriesOf([
    ['2026-10-06T10:00:00Z', { air_temperature: 1 }],
    ['2026-10-06T11:00:00Z', { air_temperature: 2 }],
    ['2026-10-06T12:00:00Z', { air_temperature: 3 }]
  ]);
  assert.equal(currentFrom(data, new Date('2026-10-06T11:30:00Z')).temp, 2);
  assert.equal(currentFrom(data, new Date('2026-10-06T11:00:00Z')).temp, 2);
});

test('currentFrom falls back to the first entry when the forecast starts in the future', () => {
  const data = seriesOf([['2026-10-06T11:00:00Z', { air_temperature: 13.3 }]]);
  assert.equal(currentFrom(data, new Date('2026-10-06T10:45:00Z')).temp, 13.3);
});

test('currentFrom exposes temp, wind, precipitation and symbol', () => {
  const now = new Date(fixture.timeSeries[0].time);
  const cur = currentFrom(fixture, now);
  assert.equal(typeof cur.temp, 'number');
  assert.equal(typeof cur.wind, 'number');
  assert.equal(typeof cur.precip, 'number');
  assert.equal(typeof cur.symbol, 'number');
  assert.ok(cur.symbol >= 1 && cur.symbol <= 27);
  assert.ok(SYMBOLS[cur.symbol]);
});

test('currentFrom returns null on an empty series', () => {
  assert.equal(currentFrom({ timeSeries: [] }, new Date()), null);
});

/* ------------------------------------------------------------------ */
/* Rolling daily forecast                                              */
/* ------------------------------------------------------------------ */

test('buildDailyForecast returns exactly 7 rolling days starting today', () => {
  const now = new Date('2026-10-06T11:00:00Z');
  const days = buildDailyForecast(fixture, now, 7);
  assert.equal(days.length, 7);
  assert.equal(days[0].key, '2026-10-06');
  assert.equal(days[6].key, '2026-10-12');
  const keys = days.map((d) => d.key);
  assert.equal(new Set(keys).size, 7);
});

test('buildDailyForecast tracks a moving clock', () => {
  const a = buildDailyForecast(fixture, new Date('2026-10-07T11:00:00Z'), 7);
  assert.equal(a[0].key, '2026-10-07');
  const b = buildDailyForecast(fixture, new Date('2026-10-08T11:00:00Z'), 7);
  assert.equal(b[0].key, '2026-10-08');
});

test('daily min/max bracket the real hourly temperatures', () => {
  const now = new Date('2026-10-06T11:00:00Z');
  const days = buildDailyForecast(fixture, now, 7);
  for (const d of days) {
    if (d.min === null) continue;
    assert.ok(d.min <= d.max, `${d.key}: min ${d.min} > max ${d.max}`);
    assert.ok(d.min > -60 && d.max < 60, `${d.key}: implausible temps`);
  }
  // day 1 of the fixture must have samples
  assert.ok(days[0].min !== null);
  assert.equal(typeof days[0].symbol, 'number');
});

test('daily precipitation sums interval accumulations, it is not treated as mm/h', () => {
  // One 6-hour interval carrying 2.4 mm must contribute 2.4 mm, not 14.4 mm.
  const data = {
    timeSeries: [{
      time: '2026-10-10T06:00:00Z',
      intervalParametersStartTime: '2026-10-10T00:00:00Z',
      data: { air_temperature: 8, wind_speed: 3, precipitation_amount_mean: 2.4, symbol_code: 18 }
    }]
  };
  const days = buildDailyForecast(data, new Date('2026-10-10T07:00:00Z'), 1);
  assert.equal(days[0].precip, 2.4);
});

test('daily precipitation adds up across several intervals of one day', () => {
  const data = seriesOf([
    ['2026-10-10T06:00:00Z', { precipitation_amount_mean: 1.5, air_temperature: 5, symbol_code: 18 }],
    ['2026-10-10T12:00:00Z', { precipitation_amount_mean: 0.5, air_temperature: 9, symbol_code: 19 }],
    ['2026-10-10T18:00:00Z', { precipitation_amount_mean: 1.0, air_temperature: 7, symbol_code: 18 }]
  ]);
  const days = buildDailyForecast(data, new Date('2026-10-10T07:00:00Z'), 1);
  assert.equal(days[0].precip, 3);
  assert.equal(days[0].min, 5);
  assert.equal(days[0].max, 9);
});

test('days with no data are present but empty rather than missing', () => {
  const data = seriesOf([['2026-10-10T12:00:00Z', { air_temperature: 9, symbol_code: 1 }]]);
  const days = buildDailyForecast(data, new Date('2026-10-10T07:00:00Z'), 3);
  assert.equal(days.length, 3);
  assert.equal(days[1].min, null);
  assert.equal(days[1].max, null);
  assert.equal(days[1].symbol, null);
});

test('daily symbol prefers the worst daytime weather', () => {
  // overcast morning, moderate rain midday -> the day is a rain day
  const data = seriesOf([
    ['2026-10-10T07:00:00Z', { air_temperature: 8, symbol_code: 6 }],
    ['2026-10-10T12:00:00Z', { air_temperature: 10, symbol_code: 19 }],
    ['2026-10-10T16:00:00Z', { air_temperature: 9, symbol_code: 6 }]
  ]);
  const days = buildDailyForecast(data, new Date('2026-10-10T07:00:00Z'), 1);
  assert.equal(days[0].symbol, 19);
});

test('sentinel temperatures do not poison min/max', () => {
  const data = seriesOf([
    ['2026-10-10T07:00:00Z', { air_temperature: 9999, symbol_code: 1 }],
    ['2026-10-10T12:00:00Z', { air_temperature: 10, symbol_code: 1 }]
  ]);
  const days = buildDailyForecast(data, new Date('2026-10-10T07:00:00Z'), 1);
  assert.equal(days[0].min, 10);
  assert.equal(days[0].max, 10);
});

/* ------------------------------------------------------------------ */
/* Swedish presentation                                                */
/* ------------------------------------------------------------------ */

test('formatDayLabel says Idag / Imorgon then Swedish weekdays', () => {
  const today = '2026-10-06'; // a Tuesday
  assert.equal(formatDayLabel('2026-10-06', today), 'Idag');
  assert.equal(formatDayLabel('2026-10-07', today), 'Imorgon');
  assert.equal(formatDayLabel('2026-10-08', today), 'Torsdag');
  assert.equal(formatDayLabel('2026-10-10', today), 'Lördag');
  assert.equal(formatDayLabel('2026-10-11', today), 'Söndag');
});

test('windLabel is Swedish and scales with speed', () => {
  assert.match(windLabel(1), /lugnt|svag/i);
  assert.match(windLabel(12), /hård|frisk|blåst/i);
  assert.equal(typeof windLabel(null), 'string');
});

/* ------------------------------------------------------------------ */
/* Error detail line: Swedish only, never the raw Error string         */
/* ------------------------------------------------------------------ */

/* Browser error strings that must never reach the DOM. */
const RAW_BROWSER_ERRORS = [
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
  'Unexpected token < in JSON at position 0',
  'The operation was aborted.',
  'undefined'
];

test('every error detail message is Swedish, grumpy and free of English', () => {
  const values = Object.values(ERROR_DETAILS);
  assert.ok(values.length >= 3, 'need at least network/http/data variants');
  for (const msg of values) {
    assert.equal(typeof msg, 'string');
    assert.ok(msg.length > 15, `too short: ${msg}`);
    assert.match(msg, /[åäöÅÄÖ]/, `no Swedish letters: ${msg}`);
    assert.doesNotMatch(
      msg,
      /\b(Failed|Error|Fetch|Network|Unexpected|Load|undefined|null|NaN|TypeError|SyntaxError)\b/i,
      `English/technical leakage: ${msg}`
    );
  }
  assert.equal(new Set(values).size, values.length, 'detail messages must be distinct');
});

test('errorKind classifies failures without reading the message text', () => {
  assert.equal(errorKind(new TypeError('Failed to fetch')), 'network');
  assert.equal(errorKind(new TypeError('Load failed')), 'network');
  assert.equal(errorKind(new SyntaxError('Unexpected token <')), 'data');
  assert.equal(errorKind(Object.assign(new Error('whatever'), { kind: 'http' })), 'http');
  assert.equal(errorKind(Object.assign(new Error('whatever'), { kind: 'data' })), 'data');
  assert.equal(errorKind(new Error('something odd')), 'unknown');
  assert.equal(errorKind(null), 'unknown');
  assert.equal(errorKind('a bare string'), 'unknown');
  assert.equal(errorKind(Object.assign(new Error('x'), { kind: 'not-a-kind' })), 'unknown');
});

test('errorDetailText always returns a known Swedish line, never the raw error', () => {
  const allowed = new Set(Object.values(ERROR_DETAILS));
  const cases = [
    ...RAW_BROWSER_ERRORS.map((m) => new TypeError(m)),
    ...RAW_BROWSER_ERRORS.map((m) => new SyntaxError(m)),
    ...RAW_BROWSER_ERRORS.map((m) => new Error(m)),
    ...RAW_BROWSER_ERRORS,
    null,
    undefined,
    { message: 'Failed to fetch' },
    Object.assign(new Error('Failed to fetch'), { kind: 'http' })
  ];
  for (const err of cases) {
    const text = errorDetailText(err);
    assert.ok(allowed.has(text), `off-table text for ${String(err)}: ${text}`);
    for (const raw of RAW_BROWSER_ERRORS) {
      assert.ok(!text.includes(raw), `leaked "${raw}" into the UI: ${text}`);
    }
  }
});

test('error detail and error persona phrases never collide', () => {
  for (const d of Object.values(ERROR_DETAILS)) {
    assert.ok(!ERROR_PHRASES.includes(d), `detail duplicates a persona phrase: ${d}`);
  }
});

/* Static lock: nothing in the DOM glue may push an Error string into the page. */
test('app.js never writes an error message into the DOM', () => {
  const src = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const offenders = src
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => /\.(textContent|innerHTML|innerText|title)\s*=/.test(line))
    .filter(({ line }) => /\.message|\bString\(\s*err|\$\{\s*err\b/.test(line));
  assert.deepEqual(offenders, [], `raw error text rendered at ${JSON.stringify(offenders)}`);
  assert.ok(
    /errorDetailText\s*\(/.test(src),
    'app.js must map failures through errorDetailText()'
  );
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function seq(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function seriesOf(pairs) {
  return {
    timeSeries: pairs.map(([time, data]) => ({
      time,
      intervalParametersStartTime: time,
      data: { wind_speed: 3, precipitation_amount_mean: 0, symbol_code: 1, ...data }
    }))
  };
}
