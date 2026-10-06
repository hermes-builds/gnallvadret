/*
 * Gnällvädret — ren logik, inga DOM-beroenden.
 * Importeras både av index.html (browser) och av tests/ (node --test).
 */

export const TZ = 'Europe/Stockholm';

/* SMHI:s sentinel för saknat värde. Gäller alla numeriska parametrar. */
const MISSING = 9999;

/* Vind i m/s där blåsten tar över som samtalsämne. */
const WIND_TAKEOVER = 10;

/* Hur ofta gubben brister ut i ironisk översvallande glädje. */
export const IRONIC_CHANCE = 0.18;

export const LOCATIONS = [
  { name: 'Mullsjö', lat: 57.917, lon: 13.88 },
  { name: 'Smålandsstenar', lat: 57.166, lon: 13.411 },
  { name: 'Gislaved', lat: 57.303, lon: 13.536 },
  { name: 'Jönköping', lat: 57.782, lon: 14.156 }
];

const API_BASE =
  'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point';

export function buildUrl({ lat, lon }) {
  return `${API_BASE}/lon/${lon}/lat/${lat}/data.json`;
}

/*
 * Wsymb2, SMHI:s vädersymbolskala 1-27.
 * kind  = grov klass, driver persona-val och ikon.
 * sev   = hur illa det är, används för att välja dygnets dominerande symbol.
 */
export const SYMBOLS = {
  1:  { text: 'Klart',                          icon: '☀️', kind: 'sun',     sev: 0 },
  2:  { text: 'Mestadels klart',                icon: '🌤️', kind: 'sun',     sev: 1 },
  3:  { text: 'Växlande molnighet',             icon: '⛅',  kind: 'cloud',   sev: 2 },
  4:  { text: 'Halvklart',                      icon: '🌥️', kind: 'cloud',   sev: 3 },
  5:  { text: 'Molnigt',                        icon: '☁️', kind: 'cloud',   sev: 4 },
  6:  { text: 'Mulet',                          icon: '☁️', kind: 'cloud',   sev: 5 },
  7:  { text: 'Dimma',                          icon: '🌫️', kind: 'fog',     sev: 6 },
  8:  { text: 'Lätta regnskurar',               icon: '🌦️', kind: 'rain',    sev: 10 },
  9:  { text: 'Regnskurar',                     icon: '🌦️', kind: 'rain',    sev: 20 },
  10: { text: 'Kraftiga regnskurar',            icon: '🌧️', kind: 'rain',    sev: 30 },
  11: { text: 'Åskskurar',                      icon: '⛈️', kind: 'thunder', sev: 40 },
  12: { text: 'Lätta byar av snöblandat regn',  icon: '🌨️', kind: 'rain',    sev: 12 },
  13: { text: 'Byar av snöblandat regn',        icon: '🌨️', kind: 'rain',    sev: 22 },
  14: { text: 'Kraftiga byar av snöblandat regn', icon: '🌨️', kind: 'rain',  sev: 32 },
  15: { text: 'Lätta snöbyar',                  icon: '🌨️', kind: 'snow',    sev: 14 },
  16: { text: 'Snöbyar',                        icon: '🌨️', kind: 'snow',    sev: 24 },
  17: { text: 'Kraftiga snöbyar',               icon: '❄️', kind: 'snow',    sev: 34 },
  18: { text: 'Lätt regn',                      icon: '🌦️', kind: 'rain',    sev: 11 },
  19: { text: 'Regn',                           icon: '🌧️', kind: 'rain',    sev: 21 },
  20: { text: 'Kraftigt regn',                  icon: '🌧️', kind: 'rain',    sev: 31 },
  21: { text: 'Åska',                           icon: '⛈️', kind: 'thunder', sev: 41 },
  22: { text: 'Lätt snöblandat regn',           icon: '🌨️', kind: 'rain',    sev: 13 },
  23: { text: 'Snöblandat regn',                icon: '🌨️', kind: 'rain',    sev: 23 },
  24: { text: 'Kraftigt snöblandat regn',       icon: '🌨️', kind: 'rain',    sev: 33 },
  25: { text: 'Lätt snöfall',                   icon: '🌨️', kind: 'snow',    sev: 15 },
  26: { text: 'Snöfall',                        icon: '❄️', kind: 'snow',    sev: 25 },
  27: { text: 'Kraftigt snöfall',               icon: '❄️', kind: 'snow',    sev: 35 }
};

/* Fog och åska får ingen egen replikkategori — de hamnar där de hör hemma. */
const KIND_TO_PERSONA = {
  sun: 'sun',
  cloud: 'cloud',
  fog: 'cloud',
  rain: 'rain',
  thunder: 'rain',
  snow: 'snow'
};

/* ------------------------------------------------------------------ */
/* Den buttre gubben                                                   */
/* ------------------------------------------------------------------ */

export const PHRASES = {
  rain: [
    'Regn igen. Klart det. Man kunde ställt klockan efter eländet.',
    'Det öser ner. Precis som förra veckan. Och veckan innan. Och 1987.',
    'Nu regnar det, ja. Jag sa ju det. Ingen lyssnar på en gammal man.',
    'Ta med paraply. Inte för att det hjälper, blöt blir man ändå.',
    'Regnet trummar på taket som en granne man inte har valt.',
    'Sånt väder var det inte förr. Förr var det värre, men ändå på något vis bättre.'
  ],
  sun: [
    'Sol. Njut i tre minuter, sen regnar det ändå.',
    'Jo jo, solen skiner. Tjugo grader falska förhoppningar.',
    'Vackert väder, säger dom. Jag väntar bara på fällan.',
    'Blå himmel. Det är precis sånt som kommer före ovädret.',
    'Sol hela dagen. Nu blir det förstås torka i stället. Alltid något.',
    'Klart och fint — lagom till att man ska sitta inne och jobba.'
  ],
  cloud: [
    'Mulet. Grått. Som en måndag utan slut.',
    'Molnen ligger som ett blött lakan över hela Småland.',
    'Varken regn eller sol. Typiskt. Inte ens vädret vågar bestämma sig.',
    'Grått i grått. Man ser varken skugga eller mening.',
    'Himlen ser ut som insidan av en gammal frysbox.',
    'Dimma och disigt. Man ser inte handen framför sig, och det är kanske lika bra.'
  ],
  snow: [
    'Snö. Nu börjar eländet med skottning och blöta sockar.',
    'Vitt och vackert, säger folk. Jag säger halkolycka.',
    'Snöar det? Då står tågen. Och grannens bil i min infart.',
    'Först snö, sen slask, sen ryggskott. Ordningen är alltid densamma.',
    'Snöflingor. Små kalla lögner som smälter bort i mars.'
  ],
  wind: [
    'Blåsten tar tag i allt. Inklusive mitt tålamod.',
    'Det blåser så att trädgårdsmöblerna flyttar till Gislaved.',
    'Vind och regn. Två elände för priset av ett.',
    'Håll i hatten. Och i staketet. Och i hunden.',
    'Blåsigt. Soptunnan är redan på väg mot Jönköping utan mig.'
  ]
};

/* Översvallande glädje som surnar inom samma andetag. */
export const IRONIC_JOY = [
  'ÄNTLIGEN! Vilken praktdag! ... nej, vänta. Det där molnet ser lurigt ut.',
  'HERREGUD vad fantastiskt! Bästa vädret på tio år! ... nu kom en vindpust. Glöm det.',
  'Vilken LYCKA! Nu går jag ut och ... nej. Nej, det är nog bäst att stanna inne.',
  'JUBEL! Perfekt väder! ... fast barometern faller. Det här slutar illa.',
  'Oj vad HÄRLIGT det ser ut! ... och det är precis så det börjar varje gång.'
];

export const ERROR_PHRASES = [
  'Vädertjänsten svarar inte. Typiskt. Ingenting fungerar nu för tiden.',
  'Ingen data. SMHI har väl gått hem för dagen. Titta ut genom fönstret i stället.',
  'Det gick inte att hämta vädret. Men var lugn — det är nog dåligt ändå.',
  'Nätet strular. Förr ringde man och frågade. Då fick man svar.'
];

export function personaCategory(symbolCode, windSpeed) {
  const wind = clean(windSpeed);
  if (wind !== null && wind >= WIND_TAKEOVER) return 'wind';
  const sym = SYMBOLS[symbolCode];
  if (!sym) return 'cloud';
  return KIND_TO_PERSONA[sym.kind] || 'cloud';
}

export function pickPhrase(category, rng = Math.random) {
  const ironic = rng() < IRONIC_CHANCE;
  const pool = ironic ? IRONIC_JOY : PHRASES[category] || PHRASES.cloud;
  return pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)];
}

export function pickErrorPhrase(rng = Math.random) {
  return ERROR_PHRASES[Math.min(Math.floor(rng() * ERROR_PHRASES.length), ERROR_PHRASES.length - 1)];
}

/* ------------------------------------------------------------------ */
/* Datahygien och tid                                                  */
/* ------------------------------------------------------------------ */

export function clean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value === MISSING) return null;
  return value;
}

const dayKeyFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/* "2026-10-07" för svensk lokaltid, inte UTC. */
export function localDayKey(date) {
  return dayKeyFormatter.format(date);
}

/*
 * Rullande dygnsnycklar räknade från klockan just nu.
 * Datumaritmetiken görs på civilt datum i UTC så att sommartidsskiftet
 * inte kan knuffa oss en dag fel.
 */
export function dayKeysFrom(now, days) {
  const [y, m, d] = localDayKey(now).split('-').map(Number);
  const keys = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    keys.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`
    );
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Nuläget                                                             */
/* ------------------------------------------------------------------ */

export function currentFrom(data, now = new Date()) {
  const series = data?.timeSeries;
  if (!Array.isArray(series) || series.length === 0) return null;

  // Nyaste prognospunkten som inte ligger i framtiden. SMHI:s första punkt
  // ligger ofta strax framåt i tiden, då får den duga.
  let chosen = series[0];
  for (const entry of series) {
    if (new Date(entry.time) <= now) chosen = entry;
    else break;
  }

  const d = chosen.data || {};
  return {
    time: chosen.time,
    temp: clean(d.air_temperature),
    wind: clean(d.wind_speed),
    gust: clean(d.wind_speed_of_gust),
    windDir: clean(d.wind_from_direction),
    precip: clean(d.precipitation_amount_mean) ?? 0,
    precipProb: clean(d.probability_of_precipitation),
    humidity: clean(d.relative_humidity),
    symbol: clean(d.symbol_code)
  };
}

/* ------------------------------------------------------------------ */
/* Rullande 7-dygnsprognos                                             */
/* ------------------------------------------------------------------ */

/*
 * precipitation_amount_mean är ackumulerad nedbörd (mm) över intervallet
 * intervalParametersStartTime -> time, inte mm/h. Därför summeras värdena
 * rakt av. Varje intervall bokförs på det dygn dess mittpunkt hamnar i.
 */
export function buildDailyForecast(data, now = new Date(), days = 7) {
  const keys = dayKeysFrom(now, days);
  const buckets = new Map(keys.map((k) => [k, { temps: [], precip: 0, symbols: [] }]));

  for (const entry of data?.timeSeries || []) {
    const end = new Date(entry.time);
    const start = entry.intervalParametersStartTime
      ? new Date(entry.intervalParametersStartTime)
      : end;
    const d = entry.data || {};

    const tempBucket = buckets.get(localDayKey(end));
    if (tempBucket) {
      const t = clean(d.air_temperature);
      if (t !== null) tempBucket.temps.push(t);
      const sym = clean(d.symbol_code);
      if (sym !== null && SYMBOLS[sym]) tempBucket.symbols.push(sym);
    }

    const mid = new Date((start.getTime() + end.getTime()) / 2);
    const precipBucket = buckets.get(localDayKey(mid));
    if (precipBucket) {
      const p = clean(d.precipitation_amount_mean);
      if (p !== null && p > 0) precipBucket.precip += p;
    }
  }

  return keys.map((key) => {
    const b = buckets.get(key);
    const worst = b.symbols.reduce(
      (acc, s) => (acc === null || SYMBOLS[s].sev > SYMBOLS[acc].sev ? s : acc),
      null
    );
    return {
      key,
      min: b.temps.length ? Math.min(...b.temps) : null,
      max: b.temps.length ? Math.max(...b.temps) : null,
      precip: Math.round(b.precip * 10) / 10,
      symbol: worst
    };
  });
}

/* ------------------------------------------------------------------ */
/* Svensk presentation                                                 */
/* ------------------------------------------------------------------ */

const weekdayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', weekday: 'long' });

export function formatDayLabel(key, todayKey) {
  if (key === todayKey) return 'Idag';
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1));
  const tomorrowKey = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;
  if (key === tomorrowKey) return 'Imorgon';

  const [y, m, d] = key.split('-').map(Number);
  const name = weekdayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatDateShort(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${d}/${m}`;
}

export function windLabel(speed) {
  const v = clean(speed);
  if (v === null) return 'Okänd vind';
  if (v < 0.3) return 'Stiltje';
  if (v < 1.6) return 'Nästan lugnt';
  if (v < 3.4) return 'Svag vind';
  if (v < 8.0) return 'Måttlig vind';
  if (v < 10.8) return 'Frisk vind';
  if (v < 17.2) return 'Hård vind';
  if (v < 24.5) return 'Storm på väg';
  return 'Storm';
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];

export function windDirLabel(degrees) {
  const v = clean(degrees);
  if (v === null) return '';
  return COMPASS[Math.round(((v % 360) / 45)) % 8];
}

export function formatTemp(value) {
  if (value === null || value === undefined) return '–';
  return `${Math.round(value)}°`;
}

export function formatPrecip(value) {
  if (value === null || value === undefined) return '–';
  if (value === 0) return '0 mm';
  return `${value.toFixed(1)} mm`;
}
