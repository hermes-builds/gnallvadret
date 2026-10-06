/*
 * Gnällvädret — DOM-limmet. All väderlogik bor i weather.js.
 */

import {
  LOCATIONS,
  SYMBOLS,
  TZ,
  buildUrl,
  currentFrom,
  buildDailyForecast,
  personaCategory,
  pickPhrase,
  pickErrorPhrase,
  errorDetailText,
  failure,
  localDayKey,
  formatDayLabel,
  formatDateShort,
  formatTemp,
  formatPrecip,
  windLabel,
  windDirLabel
} from './weather.js';

const STORAGE_KEY = 'gnallvadret.plats';

const el = {
  places: document.getElementById('places'),
  quote: document.getElementById('quote'),
  now: document.getElementById('now'),
  nowIcon: document.getElementById('now-icon'),
  nowTemp: document.getElementById('now-temp'),
  nowDesc: document.getElementById('now-desc'),
  nowWind: document.getElementById('now-wind'),
  nowPrecip: document.getElementById('now-precip'),
  nowHumidity: document.getElementById('now-humidity'),
  weekSection: document.getElementById('week-section'),
  days: document.getElementById('days'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  errorQuote: document.getElementById('error-quote'),
  errorDetail: document.getElementById('error-detail'),
  retry: document.getElementById('retry'),
  updated: document.getElementById('updated')
};

let active = restoreLocation();

/* ---------- Platsväljare ---------- */

function restoreLocation() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* privat läge eller blockerad lagring — strunt samma */
  }
  return LOCATIONS.find((l) => l.name === saved) || LOCATIONS[0];
}

function rememberLocation(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* ignoreras med flit */
  }
}

function renderPlaces() {
  el.places.replaceChildren(
    ...LOCATIONS.map((loc) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = loc.name;
      b.setAttribute('aria-pressed', String(loc.name === active.name));
      b.addEventListener('click', () => {
        if (loc.name === active.name) return;
        active = loc;
        rememberLocation(loc.name);
        renderPlaces();
        load();
      });
      return b;
    })
  );
}

/* ---------- Lägen ---------- */

function showLoading() {
  el.loading.hidden = false;
  el.loading.textContent = `Hämtar väderdata för ${active.name}…`;
  el.error.hidden = true;
  el.quote.textContent = 'Gubben rensar strupen…';
}

function showError(err) {
  el.loading.hidden = true;
  el.now.hidden = true;
  el.weekSection.hidden = true;
  el.error.hidden = false;
  // En replik, en gång. Gubben ska inte upprepa sig som en trasig grammofon.
  el.quote.textContent = pickErrorPhrase();
  el.errorQuote.textContent = 'Ingen väderdata att gnälla på just nu.';
  // Gränssnittet får bara svenska feltexter ur tabellen. Det tekniska — som
  // webbläsarens engelska "Failed to fetch" — stannar i konsolen.
  el.errorDetail.textContent = errorDetailText(err);
  console.error('[gnallvadret] hämtning misslyckades', err);
}

/* ---------- Rendering ---------- */

function renderNow(cur) {
  const sym = SYMBOLS[cur.symbol];
  el.nowIcon.textContent = sym ? sym.icon : '❔';
  el.nowTemp.textContent = formatTemp(cur.temp);
  el.nowDesc.textContent = sym ? sym.text : 'Okänt väder';

  const dir = windDirLabel(cur.windDir);
  const speed = cur.wind === null ? '–' : `${cur.wind.toFixed(1)} m/s`;
  el.nowWind.textContent = dir ? `${speed} ${dir}` : speed;
  el.nowWind.title = windLabel(cur.wind);

  el.nowPrecip.textContent = formatPrecip(cur.precip);
  el.nowHumidity.textContent = cur.humidity === null ? '–' : `${Math.round(cur.humidity)} %`;

  el.now.hidden = false;
}

function renderWeek(days, todayKey) {
  el.days.replaceChildren(
    ...days.map((d) => {
      const li = document.createElement('li');
      li.className = 'day' + (d.key === todayKey ? ' is-today' : '');

      const name = document.createElement('span');
      name.className = 'day-name';
      name.textContent = formatDayLabel(d.key, todayKey);
      const date = document.createElement('span');
      date.className = 'day-date';
      date.textContent = formatDateShort(d.key);
      name.appendChild(date);

      const icon = document.createElement('span');
      icon.className = 'day-icon';
      const sym = d.symbol === null ? null : SYMBOLS[d.symbol];
      icon.textContent = sym ? sym.icon : '·';
      if (sym) icon.title = sym.text;

      const precip = document.createElement('span');
      precip.className = 'day-precip' + (d.precip > 0 ? '' : ' is-dry');
      precip.textContent = d.precip > 0 ? `${d.precip.toFixed(1)} mm` : '—';

      const temp = document.createElement('span');
      temp.className = 'day-temp';
      if (d.max === null) {
        temp.textContent = '–';
      } else {
        const max = document.createElement('span');
        max.className = 'day-max';
        max.textContent = formatTemp(d.max);
        const min = document.createElement('span');
        min.className = 'day-min';
        min.textContent = ` / ${formatTemp(d.min)}`;
        temp.append(max, min);
      }

      li.append(name, icon, precip, temp);
      return li;
    })
  );
  el.weekSection.hidden = false;
}

function renderUpdated(data) {
  const ref = data.referenceTime || data.createdTime;
  if (!ref) {
    el.updated.textContent = '';
    return;
  }
  const t = new Date(ref).toLocaleString('sv-SE', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  el.updated.textContent = `Prognos utfärdad ${t} — ${active.name}.`;
}

/* ---------- Hämtning ---------- */

async function load() {
  showLoading();
  try {
    const res = await fetch(buildUrl(active), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) throw failure('http', `SMHI svarade ${res.status} ${res.statusText}`);

    const data = await res.json();
    if (!data || !Array.isArray(data.timeSeries) || data.timeSeries.length === 0) {
      throw failure('data', 'Prognosen kom tom tillbaka');
    }

    const now = new Date();
    const cur = currentFrom(data, now);
    if (!cur) throw failure('data', 'Hittade ingen prognospunkt för just nu');

    renderNow(cur);
    renderWeek(buildDailyForecast(data, now, 7), localDayKey(now));
    renderUpdated(data);

    el.quote.textContent = pickPhrase(personaCategory(cur.symbol, cur.wind));
    el.loading.hidden = true;
    el.error.hidden = true;
  } catch (err) {
    showError(err);
  }
}

el.retry.addEventListener('click', load);

renderPlaces();
load();
