/*
 * Browser-verifiering av Gnällvädret i 375px mobilviewport mot LIVE SMHI-data.
 *
 * Playwright är medvetet ingen beroende i package.json — appen har inget
 * byggsteg och ska inte ha det. Kör så här:
 *
 *   python3 -m http.server 8199        # i repo-roten
 *   mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright
 *   PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers npx playwright install chromium
 *   NODE_PATH=/tmp/pw/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers \
 *     node <repo>/tests/e2e.mjs
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.E2E_URL || 'http://127.0.0.1:8199/index.html';
const SHOTS = process.env.E2E_SHOTS || '/tmp/pw';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'sv-SE',
  timezoneId: 'Europe/Stockholm'
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

const apiCalls = [];
page.on('response', (r) => {
  if (r.url().includes('smhi.se')) apiCalls.push({ url: r.url(), status: r.status() });
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#now:not([hidden])', { timeout: 30000 });

/* --- SMHI-anropet lyckades från browsern, dvs CORS funkar --- */
check('SMHI fetch succeeded from browser (CORS ok)',
  apiCalls.length === 1 && apiCalls[0].status === 200, JSON.stringify(apiCalls));
check('no console errors / uncaught exceptions',
  consoleErrors.length === 0, consoleErrors.join(' | '));

/* --- platsväljaren --- */
const activeName = (await page.locator('#places button[aria-pressed="true"]').textContent()).trim();
check('Mullsjö is the default location', activeName === 'Mullsjö', `got "${activeName}"`);

const placeNames = (await page.locator('#places button').allTextContents()).map((s) => s.trim());
check('all four locations in the picker',
  JSON.stringify(placeNames) === JSON.stringify(['Mullsjö', 'Smålandsstenar', 'Gislaved', 'Jönköping']),
  JSON.stringify(placeNames));

/* --- nuläget med riktiga värden --- */
const temp = (await page.locator('#now-temp').textContent()).trim();
const desc = (await page.locator('#now-desc').textContent()).trim();
const wind = (await page.locator('#now-wind').textContent()).trim();
const precip = (await page.locator('#now-precip').textContent()).trim();
check('current temperature rendered', /^-?\d+°$/.test(temp), temp);
check('current weather description in Swedish', desc.length > 2 && desc !== '–', desc);
check('current wind rendered', /\d/.test(wind), wind);
check('current precipitation rendered', /mm/.test(precip), precip);
const icon = (await page.locator('#now-icon').textContent()).trim();
check('weather symbol icon rendered', icon.length > 0 && icon !== '·', icon);

/* --- personan --- */
const quote = (await page.locator('#quote').textContent()).trim();
check('persona phrase shown (not the loading placeholder)',
  quote.length > 15 && !/Hämtar|rensar strupen/.test(quote), quote);

/* --- rullande 7-dygnsprognos --- */
check('7 forecast days rendered', (await page.locator('.day').count()) === 7);
const labels = (await page.locator('.day-name').allTextContents()).map((s) => s.trim());
check('first row is "Idag", second "Imorgon"',
  labels[0].startsWith('Idag') && labels[1].startsWith('Imorgon'), JSON.stringify(labels));

const dates = (await page.locator('.day-date').allTextContents()).map((s) => s.trim());
const parts = new Intl.DateTimeFormat('sv-SE',
  { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'numeric' }).formatToParts(new Date());
const dd = +parts.find((p) => p.type === 'day').value;
const mm = +parts.find((p) => p.type === 'month').value;
check('first forecast date equals today in Stockholm',
  dates[0] === `${dd}/${mm}`, `${dates[0]} vs ${dd}/${mm}`);
check('7 distinct dates', new Set(dates).size === 7, JSON.stringify(dates));

const temps = (await page.locator('.day-temp').allTextContents()).map((s) => s.trim());
check('every day has a temperature', temps.every((t) => /-?\d+°/.test(t)), JSON.stringify(temps));

/* --- mobil layout: inget får sticka utanför 375px --- */
const overflow = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const node of document.querySelectorAll('body *')) {
    const r = node.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      bad.push({ sel: node.tagName + '.' + node.className, left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  return { vw, scrollW: document.scrollingElement.scrollWidth, bad: bad.slice(0, 8) };
});
check('viewport is 375px', overflow.vw === 375, String(overflow.vw));
check('no horizontal page scroll at 375px', overflow.scrollW <= 375, `scrollWidth=${overflow.scrollW}`);
check('no element overflows the 375px viewport', overflow.bad.length === 0, JSON.stringify(overflow.bad));

const smallTargets = await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .filter((b) => b.getClientRects().length > 0)        // dolda knappar mäts inte
    .map((b) => ({ t: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44));
check('all visible buttons are at least 44px tall', smallTargets.length === 0, JSON.stringify(smallTargets));

const pickerRows = await page.evaluate(() =>
  new Set([...document.querySelectorAll('#places button')]
    .map((b) => Math.round(b.getBoundingClientRect().top))).size);
check('location picker wraps instead of scrolling sideways at 375px',
  pickerRows >= 2, `${pickerRows} row(s)`);

/* --- allt gränssnitt på svenska --- */
const bodyText = await page.locator('body').innerText();
const english = ['Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday', 'Sunday', 'Loading', 'Error', 'Wind', 'Humidity', 'Forecast', 'Rain', 'Clear sky',
  'Overcast', 'Cloudy', 'Snow', 'Retry'].filter((w) => new RegExp(`\\b${w}\\b`).test(bodyText));
check('no English words in the UI', english.length === 0, JSON.stringify(english));

await page.screenshot({ path: `${SHOTS}/shot-mullsjo-375.png`, fullPage: true });

/* --- väljaren byter faktiskt data --- */
await page.locator('#places button', { hasText: 'Jönköping' }).click();
await page.waitForFunction(
  () => /Jönköping/.test(document.getElementById('updated').textContent), null, { timeout: 30000 });
const afterActive = (await page.locator('#places button[aria-pressed="true"]').textContent()).trim();
check('picker switches active location', afterActive === 'Jönköping', afterActive);
check('second SMHI request fired for the new coordinates',
  apiCalls.length === 2 && apiCalls[1].status === 200 && apiCalls[1].url.includes('14.156'),
  JSON.stringify(apiCalls.map((a) => a.url.split('/point')[1])));
check('new location rendered a temperature',
  /^-?\d+°$/.test((await page.locator('#now-temp').textContent()).trim()));
check('forecast still 7 days after switching', (await page.locator('.day').count()) === 7);

await page.screenshot({ path: `${SHOTS}/shot-jonkoping-375.png`, fullPage: true });

/* --- valet minns över omladdning --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#now:not([hidden])', { timeout: 30000 });
check('selected location survives a reload',
  (await page.locator('#places button[aria-pressed="true"]').textContent()).trim() === 'Jönköping');

/* --- felläget --- */
const page2 = await ctx.newPage();
const err2 = [];
page2.on('pageerror', (e) => err2.push(e.message));
await page2.route('**/opendata-download-metfcst.smhi.se/**', (r) => r.abort('failed'));
await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
await page2.waitForSelector('#error:not([hidden])', { timeout: 30000 });
const errQuote = (await page2.locator('#error-quote').textContent()).trim();
const errMainQuote = (await page2.locator('#quote').textContent()).trim();
check('error state visible when the API fails', errQuote.length > 15, errQuote);
check('error text is Swedish and grumpy',
  /[åäöÅÄÖ]/.test(errQuote) && !/Failed|Error|undefined/.test(errQuote), errQuote);
check('persona also comments on the failure', errMainQuote.length > 15, errMainQuote);
check('error state does not repeat the same line twice',
  errMainQuote !== errQuote, `${errMainQuote} // ${errQuote}`);
check('retry button is a 44px tap target when visible',
  (await page2.locator('#retry').boundingBox()).height >= 44);
check('weather cards hidden during error',
  (await page2.locator('#now').isHidden()) && (await page2.locator('#week-section').isHidden()));
check('error state threw no uncaught exceptions', err2.length === 0, err2.join('|'));
await page2.screenshot({ path: `${SHOTS}/shot-error-375.png`, fullPage: true });

/* --- försök igen återhämtar sig --- */
await page2.unroute('**/opendata-download-metfcst.smhi.se/**');
await page2.locator('#retry').click();
await page2.waitForSelector('#now:not([hidden])', { timeout: 30000 });
check('retry button recovers after the API comes back', await page2.locator('#error').isHidden());

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log('  - ' + f.name + ' :: ' + f.detail);
  process.exit(1);
}
