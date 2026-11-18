/* Glossarium (formerly Four-Language Translator). Every lookup reads the local data files in ./data (kept in IndexedDB).
   Nothing is generated or requested at lookup time. Word forms come from forms.js, learner helpers from learn.js,
   the interface texts from i18n.js; the extra views (explore, practice, my words, settings) are in views.js. */
(function () {
'use strict';

/* ---------- regions and settings ---------- */
const REG = { en: ['us', 'gb'], de: ['de', 'ch', 'at'], fr: ['fr', 'ca', 'be', 'ch'], pt: ['br', 'pt'], cs: ['cz'], it: ['it', 'ch'], es: ['es', 'mx', 'ar'], nl: ['nl', 'be'], sv: ['se'], la: ['cl', 'ec'] };
const BASE = { en: 'us', de: 'de', fr: 'fr', pt: 'br', cs: 'cz', it: 'it', es: 'es', nl: 'nl', sv: 'se', la: 'cl' };
const RNAME_EN = { us: 'United States', gb: 'United Kingdom', de: 'Germany', ch: 'Switzerland', at: 'Austria', fr: 'France', ca: 'Canada', be: 'Belgium', br: 'Brazil', pt: 'Portugal', cz: 'Czechia', it: 'Italy', es: 'Spain', mx: 'Mexico', ar: 'Argentina', nl: 'Netherlands', se: 'Sweden', cl: 'Classical', ec: 'Church Latin' };
const RNAME = new Proxy(RNAME_EN, { get: (o, k) => typeof k === 'string' && o[k] ? t('region.' + k, o[k]) : o[k] });
const LOCALE = { en: { us: 'en-US', gb: 'en-GB' }, de: { de: 'de-DE', ch: 'de-CH', at: 'de-AT' }, fr: { fr: 'fr-FR', ca: 'fr-CA', be: 'fr-BE', ch: 'fr-CH' }, pt: { br: 'pt-BR', pt: 'pt-PT' }, cs: { cz: 'cs-CZ' }, it: { it: 'it-IT', ch: 'it-CH' }, es: { es: 'es-ES', mx: 'es-MX', ar: 'es-AR' }, nl: { nl: 'nl-NL', be: 'nl-BE' }, sv: { se: 'sv-SE' }, la: { cl: 'it-IT', ec: 'it-IT' } };     // no device has a Latin voice: Italian reads it the Church way
/* every setting with its default (Settings › Reset to defaults puts these back) */
const DEFAULTS = {
  // display
  ui: null, theme: 'system', textSize: 100, compact: true, anim: true, gcolor: true, variants: true, gsw: true, links: false,
  examples: 2, level: 'medium', sugg: 8, order: ['en', 'de', 'fr', 'pt'], speak: null, learning: null, myLevel: 'A2',
  // audio
  slow: false, autoplay: false, playAll: false, sounds: true, badges: true, voice: { en: '', de: '', fr: '', pt: '' },
  main: { en: 'us', de: 'de', fr: 'fr', pt: 'br' }
};
const S = JSON.parse(JSON.stringify(DEFAULTS));
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[’`]/g, "'").trim();
const I18N = window.FLTI18N || {};
function t(key, en, vars) {
  const L = S.ui || 'en';
  let s = (L !== 'en' && I18N[L] && I18N[L][key]) || en;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}



/* ---------- flags ---------- */
const FLAG_ART = {
  it: '<rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#CE2B37"/>',
  es: '<rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/>',
  ar: '<rect width="60" height="40" fill="#74ACDF"/><rect y="13.33" width="60" height="13.34" fill="#fff"/><circle cx="30" cy="20" r="4" fill="#F6B40E" stroke="#85340A" stroke-width=".6"/>',
  mx: '<rect width="20" height="40" fill="#006847"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#CE1126"/><circle cx="30" cy="20" r="5" fill="#8C5A2B"/>',
  nl: '<rect width="60" height="40" fill="#21468B"/><rect width="60" height="26.7" fill="#fff"/><rect width="60" height="13.3" fill="#AE1C28"/>',
  se: '<rect width="60" height="40" fill="#006AA7"/><rect x="18" width="7" height="40" fill="#FECC00"/><rect y="16.5" width="60" height="7" fill="#FECC00"/>',
  cl: '<rect width="60" height="40" fill="#7A1F1F"/><text x="30" y="26" text-anchor="middle" font-family="Georgia,serif" font-size="13" font-weight="700" fill="#E8C766">SPQR</text>',
  cz: '<rect width="60" height="40" fill="#fff"/><rect y="20" width="60" height="20" fill="#D7141A"/><path d="M0,0L30,20L0,40Z" fill="#11457E"/>',
us: '<rect width="60" height="40" fill="#B22234"/><path d="M0,4.62H60M0,10.77H60M0,16.92H60M0,23.08H60M0,29.23H60M0,35.38H60" stroke="#fff" stroke-width="3.08"/><rect width="26" height="21.54" fill="#3C3B6E"/><path d="M3,3H24M3,7H24M3,11H24M3,15H24M3,19H24" stroke="#fff" stroke-width="1.5" stroke-dasharray="0 4.1" stroke-linecap="round"/>',
gb: '<rect width="60" height="40" fill="#012169"/><path d="M0,0L60,40M60,0L0,40" stroke="#fff" stroke-width="7"/><path d="M0,0L60,40M60,0L0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0v40M0,20h60" stroke="#fff" stroke-width="12"/><path d="M30,0v40M0,20h60" stroke="#C8102E" stroke-width="7"/>',
de: '<rect width="60" height="40" fill="#000"/><rect y="13.33" width="60" height="26.67" fill="#DD0000"/><rect y="26.67" width="60" height="13.33" fill="#FFCE00"/>',
fr: '<rect width="60" height="40" fill="#EF4135"/><rect width="40" height="40" fill="#fff"/><rect width="20" height="40" fill="#0055A4"/>',
br: '<rect width="60" height="40" fill="#009C3B"/><path d="M30,4L55,20L30,36L5,20Z" fill="#FFDF00"/><circle cx="30" cy="20" r="9" fill="#002776"/><path d="M21.3,18Q30,15 38.9,22" fill="none" stroke="#fff" stroke-width="1.8"/>',
ch: '<rect width="60" height="40" fill="#DA291C"/><path d="M26,8h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#fff"/>',
at: '<rect width="60" height="40" fill="#C8102E"/><rect y="13.33" width="60" height="13.34" fill="#fff"/>',
pt: '<rect width="60" height="40" fill="#DA291C"/><rect width="24" height="40" fill="#046A38"/><circle cx="24" cy="20" r="7.5" fill="#FFE900"/><circle cx="24" cy="20" r="3.6" fill="#DA291C" stroke="#fff" stroke-width="1.4"/>',
be: '<rect width="60" height="40" fill="#EF3340"/><rect width="40" height="40" fill="#FDDA24"/><rect width="20" height="40" fill="#000"/>',
ca: '<rect width="60" height="40" fill="#fff"/><rect width="15" height="40" fill="#D80621"/><rect x="45" width="15" height="40" fill="#D80621"/><path d="M30,7L27.6,11.5L25,10.2L26.2,16.5L22.8,13.2L22.2,15L18,14.2L19.4,18.5L17.6,19.6L24.5,25L23.7,27.5L29.4,26.8L29.2,32.5H30.8L30.6,26.8L36.3,27.5L35.5,25L42.4,19.6L40.6,18.5L42,14.2L37.8,15L37.2,13.2L33.8,16.5L35,10.2L32.4,11.5Z" fill="#D80621"/>'
};
const SQUARE = { ch: '<rect width="32" height="32" fill="#DA291C"/><path d="M13,6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#fff"/>',       // Switzerland's flag is square
  ec: `<path fill="#fff" d="M256 0h256v512H256z"/> <path fill="#ffe000" d="M0 0h256v512H0z"/> <g stroke="#000" stroke-linejoin="round" stroke-width="3.2"> <g fill="#ce9d09" stroke-linecap="round" transform="scale(.2048)"> <g id="va-a"> <path fill="#fff" d="m1781 990.3 16.2 3.8 25.6 4.2 11.8 1.3-2 50s-2.9 33-7.8 48.9c-3.6 11.7-15.7 33.2-15.7 33.2l-7.7 11.7-45.4-39.3s7.8-11 10.6-17c3.5-7.5 7.7-23.8 7.7-23.8l4.4-26 2.4-32.7zm-57 151.5 41.4 36s-8.4 7.4-13.4 9.7a74 74 0 0 1-31.6 7.3 58 58 0 0 1-22.3-6.2c-15.7-7.2-33-14.7-43.2-28.7-3.6-5-5-11.6-4.9-17.7.2-7 6.3-19.9 6.3-19.9s2.4 8.7 5.1 12a49 49 0 0 0 17.6 12.4 43 43 0 0 0 36.2 1.1c3.3-1.3 8.9-6 8.9-6z"/> <path fill="#fff" d="M1658.7 877.7s3.2 6.6 4.2 10.1q2.9 9 3 18.6a79 79 0 0 1-3.2 18.6 171 171 0 0 1-10.3 26.3c-2.6 5.4-6 10.3-8.6 15.8-4.1 8.7-7 18-10.6 26.8-3 7.5-6.9 14.7-9.2 22.4-3 10.2-4.5 20.9-6 31.4a230 230 0 0 0-2.3 27.5c0 11 .3 22 2.3 32.6s5 21.2 9.8 31a79 79 0 0 0 31.8 34.8c5.5 3.4 11.9 5.3 18 7.8 8.3 3.3 25.4 9.3 25.4 9.3s-23.6-11.6-31.8-21.4a68 68 0 0 1-12.8-28.9 112 112 0 0 1-1.2-36.6 196 196 0 0 1 9.2-38.3c4.2-13.2 10-25.9 15.4-38.6 3.9-9.3 8.3-18.2 12-27.5q6.9-16.4 12.4-33.2c2.1-6.9 4.8-13.7 5.4-20.9a76 76 0 0 0-2.2-23.4 89 89 0 0 0-11.8-30.6 41 41 0 0 0-14.8-13.2c-5.7-2.9-12.5-5.4-18.9-4.1-2 .4-5.2 3.7-5.2 3.7"/> <path fill="#fff" d="M1711.6 945.6s4.4-18 5.2-27.2q.8-11.8-.6-23.7c-1-8.7-1.5-17.8-4.9-25.9a68 68 0 0 0-38.2-37 92 92 0 0 0-28-4.8 130 130 0 0 0-38 4c-4 1.4-11.7 5.7-11.7 5.7l30 49s9.3-5.6 14.5-7a55 55 0 0 1 17-1.2c5.8.4 11.7 1 17 3.3a57 57 0 0 1 17.6 13.3 74 74 0 0 1 15 22c3 7.5 3.5 16 4.6 24.2.3 1.7.5 5.3.5 5.3"/> <path d="M1717 906.7s-5.3-16.6-10.3-23.5a64 64 0 0 0-22.3-19.8c-9.4-4.7-31-6.2-31-6.2l11.4 21-20-.4-10.3-17.4-19.3 8.7-9.5-15.7 20.4-9.4-9.4-15.2 20.4-2 8.9 14.7s15.9 0 23.6 1.7a58 58 0 0 1 27.5 14.4 68 68 0 0 1 12 14.2c3 5.1 6.5 16.7 6.5 16.7z"/> <path d="m1581.7 845 31.8 46.7m-18-54.8-15 8.8-14.3 11 31 47.1 13.7-10.6 14.1-8.2zm58.3 199 17.9-37 19.1 7.7 7.8-19-19-9 9.8-21.3-14-6.3-10.6 20.5-19.2-8-8.4 20 18.6 7.7-17.2 36.7zm143.2-11.1 18.1-.4v21l17.6.9-3 21.4-16.4-1s-2.7 12.5-5.1 18.4c-2.5 6.2-9.7 17.4-9.7 17.4l-19.4-4.8s7-11 9.7-17c2.4-5.4 5.7-16.6 5.7-16.6l-20-2.5 3.5-20.2 18.1 1.2z"/> </g> <use xlink:href="#va-a" width="100%" height="100%" transform="matrix(-1 0 0 1 3717.8 0)"/> <path fill="#fff" d="m1756.7 735.6-27.5 29.4 17 51 9.6 35.8-27.7 25.8 50.7 71-17.4 19.9a12 12 0 0 0-2.1 8.6q.5 4.3 3.6 7.3c4.5 4.1 11.3 5.1 17.3 6.7 21 5.6 42.9 8 64.6 9.7 4.7.4 14 0 14 0s9.4.4 14.1 0c21.8-1.6 43.6-4.1 64.7-9.7 6-1.6 12.7-2.6 17.3-6.7a12 12 0 0 0 1.4-15.9l-16.3-36 51.8-55.4-19.7-17.9-.5-43.2 17-51-25.5-25.7-23-61.2s-4.7-17.1-8.8-25c-2.4-4.6-5.8-8.7-9.2-12.8-4-4.9-8-9.9-12.8-13.9a85 85 0 0 0-14.6-9c-5.5-2.9-11-6-16.9-7.5-6.1-1.5-19-1.5-19-1.5s-12.7 0-18.9 1.5c-6 1.6-11.4 4.6-16.8 7.5a85 85 0 0 0-14.6 9c-4.9 4-8.9 9-12.9 13.9-3.3 4-6.7 8.2-9.1 12.9-4.1 7.8-8.9 24.9-8.9 24.9z"/> <path d="M1963.3 933.1s-3.2-2.8-5-4a65 65 0 0 0-12-6c-5.5-2.2-11.5-3.3-17.3-4.7a197 197 0 0 0-44.3-5.7c-8.6 0-25.8 1.3-25.8 1.3s-17.2-1.3-25.8-1.3a195 195 0 0 0-44.3 5.7c-5.9 1.4-11.8 2.5-17.4 4.7a65 65 0 0 0-12 6c-1.7 1.2-5 4-5 4m218.8-42.7s-5.2-5.2-8.6-5.9a9 9 0 0 0-6.6 1.5 13 13 0 0 0-4 15.2c.8 2 2 4.3 4.1 5.2 4.8 1.9 15.4-2 15.4-2zm5.1-3.6c5.8.2 8 3.2 9.5 6.5m-243.2-2.9-.3 14s10.5 3.9 15.3 2c2-.9 3.4-3.1 4.2-5.2a13 13 0 0 0-4-15.2 9 9 0 0 0-6.6-1.5c-3.5.7-8.6 6-8.6 6zm-5.2-3.6c-5.8.2-8 3.2-9.4 6.5m198.1 1.4-8.4-1m-130 1 8.4-1m76 .8c-2.9-.4-7.6-4.2-7.6-4.2m-22.8 4.2c2.8-.4 7.6-4.2 7.6-4.2m141-19.3s-4.3 3.3-7.4 3.8l-1.2.7s-2 5.7-3.6 8.2a45 45 0 0 1-6.5 6.2s-4.8-4.1-7.7-5q-3.2-.8-6 .3a11 11 0 0 0-4.8 4.3c-1.4 2-2.7 4.6-2.6 7 .1 3 3.9 8.3 3.9 8.3l-2.6 4.5-3.7 2.3a90 90 0 0 1-19-7.5 19 19 0 0 1-4.4-9s4.5-2.7 5.6-5c1.2-2.5 1.6-6 .2-8.4-1.6-2.6-5.3-4-8.4-4a9 9 0 0 0-6.3 2.7c-1.6 1.8-3 4.5-2.5 7 .4 2.4 4.7 5.7 4.7 5.7s-1.8 4.6-3.8 5.5c-6 2.5-10 4-15.3 4.8a39 39 0 0 1-16.3 0 17 17 0 0 1-9-5.5c-.6-.9-.8-3-.8-3s6.5-1.7 9-3.7c2.6-2 5.3-4.6 5.9-7.8.5-3.2-1.2-6.6-3-9.2a18 18 0 0 0-7.6-6c-1.3-.6-4.3-.7-4.3-.7l-1 .9a15 15 0 0 1-4.7 3.8h-.1l-.2.1-1.1.6-.8.1-2.4.8s3.8 1.2 5 2.8q.9 1.4 1 3.3l.2 2q0 1.8-.7 3.4a9 9 0 0 1-1.7 3.5q-.7.9-1.6 1.4 0 0 0 0l-.2.1q-1.6 1-3.3 1.5c-1.4.4-4.2.1-4.3.1s5.5 0 7.6-1.6l.2-.1a11 11 0 0 0 3.8-7.2v-3q-.4-2.5-2.2-4.2c-2.4-2.1-9.3-2.4-9.4-2.4s-7 .3-9.4 2.4a8 8 0 0 0-2.3 4.2v3.1l.5 2.3q1 3 3.3 4.9l.2.1c2.2 1.6 7.6 1.6 7.7 1.6-.1 0-3 .3-4.3 0q-1.8-.6-3.4-1.6h-.1v-.1q-1-.5-1.7-1.4a9 9 0 0 1-1.7-3.5q-.5-1.6-.7-3.3l.2-2.1q.3-1.9 1.1-3.3c1.1-1.6 5-2.8 5-2.8l-2.5-.8-.7-.1-1.2-.6h-.1l-.1-.1a15 15 0 0 1-4.8-3.8l-1-.9s-3 0-4.2.7a18 18 0 0 0-7.6 6c-1.8 2.6-3.5 6-3 9.2s3.3 5.8 5.8 7.8c2.6 2 9 3.7 9 3.7s-.2 2.1-.8 3a17 17 0 0 1-9 5.5 39 39 0 0 1-16.3 0 59 59 0 0 1-15.2-4.8c-2-1-3.9-5.5-3.9-5.5s4.4-3.3 4.8-5.8c.4-2.4-1-5-2.6-6.9a9 9 0 0 0-6.2-2.8c-3.1 0-6.8 1.5-8.4 4.1-1.5 2.4-1 5.9.2 8.4 1 2.3 5.6 5 5.6 5a19 19 0 0 1-4.5 9 89 89 0 0 1-19 7.5l-3.6-2.3-2.6-4.5s3.7-5.2 3.8-8.2c.2-2.5-1.1-5-2.5-7.1a11 11 0 0 0-4.8-4.3q-2.8-1.1-6-.2c-3 .8-7.7 4.9-7.7 4.9s-4.8-3.8-6.5-6.2a49 49 0 0 1-3.7-8.2l-1.2-.7c-3-.5-7.3-3.8-7.3-3.8l-4.4 1s-4.1 2.1-4.2 4c0 2.8 3.8 4 5.5 6l4.1 5.7c1.2 1.8 2.9 3.4 3.5 5.5.6 2.3-1 5 0 7.2 1.2 2.7 3.7 5.4 6.7 6 2.6.5 7.6-2.6 7.6-2.6l-.2 19.9 10.3 9.3 9.7 20.3-3.8 5.2 1.1 10c7.5-9.6 20.5-13.8 32.2-17.2 15.7-4.5 44.6-4.8 58-4.7l7.3.1s44.3-1.4 65.2 4.6c11.7 3.4 24.7 7.6 32.2 17.2l1.2-10-3.9-5.2 9.7-20.3 10.3-9.3-.1-19.9s5 3.1 7.6 2.6c3-.6 5.5-3.3 6.7-6 1-2.2-.7-4.9 0-7.2.6-2 2.2-3.7 3.4-5.5q2-3 4.2-5.6c1.7-2.1 5.5-3.3 5.4-6 0-2-4.1-4.2-4.1-4.2zm-148.4-2.6c1 1 3 2.8 4.8 3.8l.2.1q.8.4 2 .7c2.8.8 7.8.3 8 .3h0c.1 0 5.1.5 8-.3l2-.7.2-.1c1.7-1 3.7-2.9 4.8-3.8q.8-1 1.3-2.2c1.1-2.7 1-6.1-.2-8.7-1.6-3-5.2-4.5-8.1-6.3-2.5-1.5-8-3.7-8-3.7a69 69 0 0 0-8 3.7c-3 1.8-6.6 3.3-8.1 6.3-1.3 2.6-1.4 6-.2 8.7q.5 1.2 1.3 2.2"/> <path d="M1980.8 829.8s-11-5-16.6-6.9c-10.4-3.3-21.3-5.2-32-7.3-12.5-2.4-25.2-3-37.6-6-3.9-.8-7.5-2.7-11.5-3.5-5.4-1.1-11-2.9-16.4-1.7-3 .6-7.8 4.6-7.8 4.6s-4.9-4-7.8-4.6c-5.4-1.2-11.1.6-16.5 1.7-4 .8-7.6 2.7-11.4 3.6-12.4 2.9-25.2 3.5-37.7 6-10.7 2-21.5 3.9-32 7.2-5.6 1.8-16.5 6.9-16.5 6.9m197.4-45.1s5.4-2.9 7.3-5a10 10 0 0 0 2.7-5.3 9 9 0 0 0-2.3-6.5 9 9 0 0 0-6.2-2.2q-3 0-5.3 1.8a9 9 0 0 0-3 5.6c-.3 1.8.5 3.7 1.3 5.3a33 33 0 0 0 5.5 6.3m-151 0s4.1-3.8 5.4-6.3a9 9 0 0 0 1.4-5.3 9 9 0 0 0-3-5.6 8 8 0 0 0-5.3-1.8 9 9 0 0 0-6.3 2.2 9 9 0 0 0-2.2 6.5c.1 2 1.3 3.7 2.6 5.2 2 2.2 7.3 5 7.3 5zm-41.2 18-11.9 15.6s0 4 .8 5.8a24 24 0 0 0 5.9 5.7l.8 21.4-11.3 19.6-1 .2 7.3 3.8 1 .1c4.4-.3 7-5.2 10.9-7.4q7.3-4 15.2-7.2a240 240 0 0 1 50-15.1 142 142 0 0 1 29.5-1.2c6.6.5 19.4 3.4 19.5 3.4 0 0 12.9-3 19.5-3.4a141 141 0 0 1 57.8 8.3 240 240 0 0 1 36.9 15.2c3.8 2.2 6.5 7 10.8 7.4h1l7.3-4-1-.1-11.3-19.6.9-21.4s4.6-3.3 5.8-5.7c1-1.7.8-5.8.8-5.8l-11.9-15.6s-6 6-9.9 7.3q-3.2.9-6.5 0c-2.5-.8-4.4-2.9-6.5-4.5a84 84 0 0 1-12.9-12.1 70 70 0 0 1-5.3-8.7s-12.9 10.1-20.6 12.1c-7.6 2-16 1.6-23.5-.6-1.9-.6-5-3-5-3a42 42 0 0 0-26.4-8 42 42 0 0 0-26.4 8s-3.2 2.4-5 3a45 45 0 0 1-23.6.6 82 82 0 0 1-20.6-12.1s-3.1 6-5.3 8.7a84 84 0 0 1-12.9 12.1c-2 1.6-4 3.7-6.5 4.5q-3.2.9-6.4 0a37 37 0 0 1-10-7.3"/> <path d="M1985.9 796.4s.4-5.7-.2-8.5a21 21 0 0 0-3.1-7c-1.5-2.3-5.7-6-5.7-6m-1.4 27.8s3.4.1 4.9-.6c2.6-1.3 6-6.3 6-6.3s6.7 4.6 10.4 4c1.8-.2 3.2-1.8 4.2-3.4a8 8 0 0 0 1.2-5.7c-.3-1.5-1.6-2.6-2.8-3.6-2.3-2-6.4-1.7-7.9-4.2-1.2-2-.5-4.9.2-7.1 1.4-4.8 4.7-8.7 7.5-12.8 1.7-2.6 5.3-4.4 5.6-7.5.2-1.6-2-4.6-2-4.6s-5.2-.1-7.7.6c-4 1.2-8.3 3-11.2 6.1-2.4 2.6-3 6.4-4.3 9.7-1 2.5-2.5 7.7-2.5 7.7s-6 0-8.7 1.2a17 17 0 0 0-8.7 7.7c-1.2 2.7-1 6.2 0 9 1.1 3 3.5 5.3 6.1 7 2.9 1.8 9.7 2.8 9.7 2.8M1740.8 775s-4.1 3.6-5.6 5.8a21 21 0 0 0-3.2 7.1c-.6 2.8-.1 8.5-.1 8.5m-17-45.5s-2.2 3-2 4.6c.4 3.1 4 5 5.7 7.5 2.7 4.1 6 8 7.5 12.8.6 2.2 1.3 5 .1 7-1.4 2.6-5.6 2.4-7.8 4.3-1.2 1-2.5 2.1-2.9 3.6a8 8 0 0 0 1.2 5.7c1 1.6 2.5 3.2 4.3 3.4 3.6.6 10.3-4 10.3-4s3.5 5 6 6.3c1.5.7 5 .6 5 .6s6.8-1 9.7-2.9c2.5-1.6 5-4 6-6.8 1-2.9 1.3-6.4 0-9.1a17 17 0 0 0-8.7-7.7c-2.6-1.3-8.7-1.2-8.7-1.2s-1.4-5.2-2.4-7.7c-1.3-3.3-2-7.1-4.4-9.7a25 25 0 0 0-11.2-6.1c-2.5-.7-7.7-.6-7.7-.6m135.6 14.3 8.4-2.4 8.3 2.4m-14.5 20s-6.5-5.8-7.7-9.8a8 8 0 0 1 .4-5.5c1.2-2.2 5.9-4.7 5.9-4.7s-7.1-3.4-9-6.6a9 9 0 0 1-.5-6.3 17 17 0 0 1 5.8-8c3.2-2.7 11.3-5.4 11.3-5.4s8 2.7 11.2 5.3a17 17 0 0 1 5.9 8.1c.5 2 .4 4.4-.6 6.3-1.9 3.2-9 6.6-9 6.6s4.8 2.5 6 4.7c.8 1.6.9 3.7.3 5.5-1.2 4-7.7 9.9-7.7 9.9l-6.1.4zm22.7-26.8s13.4 5.7 18 11.1c1.2 1.5 2.3 3.5 2.2 5.5-.5 7-10.3 18.2-10.3 18.2l-20-8.3h-12.9l-20 8.3s-9.8-11.3-10.2-18.2c-.2-2 1-4 2.2-5.5 4.5-5.4 18-11.1 18-11.1"/> <path d="m1844.4 669.2 8-6.2 6.5.2-6.6-.2s-3.6-2.4-4.6-4.2a9 9 0 0 1-1-6c.5-2.7 2-5.5 4.4-6.9 2.3-1.3 7.8-.5 7.8-.5s5.5-.8 7.7.5c2.4 1.4 3.9 4.2 4.5 6.8.4 2 0 4.3-1 6-1 1.9-4.6 4.3-4.6 4.3l-6.7.2 6.5-.2 8 6.2m52.7 5.1-2.7 4.7m32.6-20-7.5 1m8.5 8.8-11.5.6m-1.5-13.8c1.5 1 4.2 2.9 4.6 4.6a10 10 0 0 1-3.1 9.2c-2.4 2-9.3 1.5-9.3 1.5m-181.7 33.6 17-4.2c8-2 16-4.2 24.2-5.7q14-2.4 28-3.5c11.8-.9 35.3-.6 35.3-.6s23.5-.3 35.2.6q14 1 28 3.5c8.2 1.5 16.2 3.8 24.3 5.7l17 4.2m-171.6-30.2 2.7 4.7m-32.7-20 7.5 1m-8.5 8.8 11.5.6m-6.4 16s12.5-3.2 18.8-4.5q10.5-2.2 21-3.7 12-1.4 24.3-2c9.6-.4 28.9-.3 28.9-.3s19.2 0 28.9.4a284 284 0 0 1 45.2 5.6c6.3 1.3 18.9 4.5 18.9 4.5M1781.6 671s-6.8.5-9.2-1.5c-2.5-2-4-6-3.2-9.2.7-2.4 5.6-5.2 5.6-5.2m63.1 74c-12 .8-24 1.5-35.8 3.7a220 220 0 0 0-36.2 9.7c-11.1 4-22.9 22.6-32 15.2-2-1.6.7-5 1.6-7.4a43 43 0 0 1 7.8-12.6c2.4-2.7 8-3 8.5-6.6.5-2.6-3.4-4-4.3-6.6a17 17 0 0 1-.5-10c1.2-4.1 6.5-6.2 7.7-10.3 1-3.6-2.5-7.8-.9-11.2 2.2-4.2 11.4-2.7 12-7.4.4-2.3-3.8-3-4.5-5.1-.6-1.6.3-3.3.3-5 0-2.1.4-4.5-.6-6.5-.9-1.7-3.7-2.1-4.3-4a6 6 0 0 1 1.1-5.4c1-1 3.7.4 4.3-.9 1.4-2.6-2.5-5.3-3.7-8-1.4-3.2-3.2-6.3-4-9.7-.6-2.7-3-7-.6-8.3 2.8-1.6 5.5 3.2 8 5.1 3.4 2.5 7.2 4.8 9.5 8.3 1.7 2.5.7 6.5 3 8.6 2.6 2.5 7.7.5 10.4 2.9 2.4 2 4.5 5.5 3.8 8.5s-7.6 2.9-7 5.8c.9 3.4 7 3.2 10.4 2.5 2-.3 3.5-2.2 5.1-3.4 1.4-1 2.4-2.2 4-2.8 1.6-.8 5.3-1 5.3-1l-2.1-.5s-3.2-2.5-3.5-4.3a6 6 0 0 1 1.6-5 8 8 0 0 1 5.5-2.2c1.7 0 3.5.7 4.6 1.9a6 6 0 0 1 1.7 4.8 6 6 0 0 1-2.3 3.7 13 13 0 0 1-4.6 1.5l2.3.6 6.1 8.5 26.6-1.5s3.3-3.3 2.6-5.2q-1-2.7-5.7-2.5c-8.5.4-10.3-6.8-10-12 .3-4.4 5.5-7.3 9.5-9 4-1.5 10.8 3.7 12.6-.1 1.5-3.3-5.8-5-7-8.5-.5-1.5-.5-3.4.2-4.8 1.8-3.6 5.7-6 9.4-7.7 1.6-.7 5-.8 5-.8s3.6.1 5.1.8c3.7 1.7 7.6 4.1 9.4 7.7.7 1.4.7 3.3.2 4.8-1.1 3.5-8.5 5.2-7 8.5 1.8 3.8 8.7-1.4 12.6.2s9.2 4.5 9.5 8.9c.3 5.2-1.4 12.4-10 12q-4.7-.2-5.7 2.5c-.6 1.9 2.7 5.2 2.7 5.2l26.5 1.5 6.1-8.5 2.3-.6s-3.3-.5-4.5-1.5a6 6 0 0 1-2.3-3.7c-.2-1.7.5-3.6 1.6-4.8s3-1.9 4.6-1.9q3.2 0 5.5 2.2c1.2 1.2 2 3.2 1.6 5s-3.5 4.3-3.5 4.3l-2.1.5s3.7.2 5.4 1c1.5.6 2.6 1.9 3.9 2.8 1.7 1.2 3.1 3 5.1 3.4 3.5.7 9.6 1 10.3-2.5.7-3-6.1-2.9-6.8-5.8-.7-3 1.3-6.5 3.7-8.5 2.7-2.4 7.9-.4 10.5-2.9 2.2-2 1.3-6 3-8.6 2.3-3.5 6-5.8 9.4-8.3 2.5-1.9 5.3-6.7 8-5.1 2.4 1.4 0 5.6-.6 8.3-.8 3.4-2.6 6.5-4 9.7-1.2 2.7-5 5.4-3.7 8 .7 1.3 3.3-.2 4.3.9a6 6 0 0 1 1.1 5.4c-.6 1.9-3.4 2.3-4.3 4-1 2-.5 4.4-.5 6.6 0 1.6.8 3.3.3 4.9-.8 2.1-5 2.8-4.6 5.1.7 4.7 9.9 3.2 12 7.4 1.7 3.4-1.9 7.6-.9 11.2 1.2 4.1 6.5 6.2 7.8 10.3 1 3.2.4 6.8-.6 10-.8 2.5-4.7 4-4.3 6.6.6 3.6 6.2 3.9 8.6 6.6q4.9 5.5 7.7 12.6c1 2.3 3.7 5.8 1.7 7.4-9.2 7.4-21-11.1-32-15.2a220 220 0 0 0-72-13.4c-7-.4-21-.4-21-.4s-14 0-21 .4m31.1-133.7-10.1.1-10.2-.1m17-33.9c2.6-5.6-2-9.7-6.8-13.8-4.8 4-9.4 8.2-6.8 13.8m14.1 46.8c3.9.2 8.6 4.2 11.6 1.7 1.3-1.2.7-3.7 0-5.3-1.6-3.8-8.4-4.7-8.7-8.8-.3-3.5 5.1-5.2 6.3-8.5q.8-2.7 0-5.3c-2.8-6.6-14.5-7-16.6-13.7-.9-3 6-6.5 6.8-6.9 4.4-1.9 9.7 2.7 14 .8 3-1.2 6.1-4.1 6-7.3 0-3.4-3.6-6.3-6.8-7.7-6.1-2.6-16.2 6-20 .5-3.4-5.1 8.7-11.1 7-17-.7-2.9-7-5.3-7-5.3s-6.1 2.4-6.9 5.3c-1.6 5.9 10.5 11.9 7 17-3.7 5.5-13.8-3.1-20-.5-3.1 1.4-6.8 4.3-6.8 7.7 0 3.2 3.1 6 6 7.3 4.3 1.9 9.7-2.7 14-.8.9.4 7.7 4 6.8 6.9-2 6.7-13.7 7-16.5 13.7a8 8 0 0 0 0 5.3c1.1 3.3 6.6 5 6.3 8.5-.3 4.1-7.2 5-8.7 8.8-.7 1.6-1.4 4.1 0 5.3 3 2.5 7.7-1.5 11.6-1.7 2.4-.2 7.3 0 7.3 0s4.8-.2 7.3 0"/> <path fill="none" d="M1953.7 953.5s-7.1-3-10.8-4.3a258 258 0 0 0-20-6.5c-6.6-1.8-13.2-3.7-20-4.5-14.6-1.6-44-.2-44-.2s-29.4-1.4-44 .2c-6.8.8-13.5 2.7-20 4.5a258 258 0 0 0-30.9 10.8M1966 731s-12-4.8-18.1-6.9q-7.6-2.7-15.5-4.8-9.6-2.3-19.4-3.5a387 387 0 0 0-54.1-3.4s-17.2.1-25.8.6a377 377 0 0 0-47.8 6.3q-7.8 2-15.4 4.8c-6.1 2.1-18 6.9-18 6.9m-14.2 120.4s17.5-6 26.4-8.7c9.1-2.8 18.2-6 27.5-8 11.2-2.5 22.6-3.7 34-5 11-1.1 33.3-2.3 33.3-2.3s22.2 1.2 33.3 2.4c11.3 1.2 22.8 2.4 34 4.8 9.3 2 18.3 5.3 27.5 8.1l26.4 8.7"/> </g> <g fill="#ccc" transform="scale(.2048)"> <g id="va-b"> <path d="m1533.3 904 101.2 86.8s-5.2 11.2-7.3 17a143 143 0 0 0-9.3 41l-118-108c1.7-24.7 15.6-33.5 33.4-36.8z"/> <path d="m1519 958.2-24.3 27.2 15.2 14.6-23.5 22.8-15.2-15.1-25.5 27.2-.2 33.7 58 45.5 20.1-14.9-1.1-32.3 15.4 8.6 15.5-9.4.8 29.1-12.6-9.1-13.7 18-1.4 32 43.7 39 53-47.1-4-14.1-2.2-12.7-1.3-25.1 2-27.5z"/> <path d="m1494.7 985.4-.6 30 15.6-15.3z"/> <path fill="none" d="m1572 1140.4-1.9 34.3m-18.6-139.7.6 31.8m-14.8-17.3.9 25.8m-14.5-36.3.6 29m-21.4 15.2.3 30.6m24.7-9.7 44 37 45.1-39.6m-171-66.9 57.6 49.2 18.9-16.9-15-12.6 16.7-15.7 12.9 11.1 14.5-14.8 19 18.3-17.2 13.4 16 14.6-15.2 14"/> <path d="m1901.3 1229.3 48.7 44.6 10.7 31.5-62.6-6.7-35.7-35.3-38-35.2-164-142.1s3.5-13.1 5.6-19.5q5-13.9 10.6-27.5l3-6.8 183 162.3z"/> <path d="M1942.7 1236c27 38 72.7 73.7 86.5 90.9 13.9 17.2 22.8 33.5 2.6 55.5s-43 9.5-61.1-2.6-49.6-51.3-94.8-81.3z"/> <path d="m1926.7 1299.8-35.2-16m41-38.2c2.4 8 .5 16.8 3.6 24.4 3 7.6 14 20 14 20s-7 1-10.3 2.2c-4.7 1.9-12 2.7-13.1 7.7-1 4.3 4 8 7 11.2q4.7 4.5 10.4 7.6c6.1 3.6 12.4 7.6 19.4 8.9 8.7 1.6 25.1-10.8 26.6-2 .6 3.6-7.4 1.3-10.7 3-7.8 3.8-11.6 12-4.8 17.8 4.4 3.7 11.3 2.4 17 2.9 5.5.4 11.7-2.8 16.5 0 5.6 3.2 12.7 11 9.7 16.8-3 6-14.5 5.8-20 2-4-3-2.9-9.5-3.5-14.4v-4.4"/> <circle cx="2154.7" cy="1480.1" r="129.7"/> <path fill="#fff" d="M2106.1 1485.7a40.5 40.5 0 1 0 40.5 40.4l14-.6a40.5 40.5 0 1 0 40.5-40.5l.6-7.9a40.5 40.5 0 1 0-40.5-40.5l-14-1.2a40.5 40.5 0 1 0-40.5 40.5z"/> <circle cx="2154.7" cy="1446.1" r="14.6"/> <circle cx="2189.4" cy="1480.1" r="14.6"/> <circle cx="2155.3" cy="1511.2" r="14.6"/> <circle cx="2119.3" cy="1480.1" r="14.6"/> <path fill="#fff" d="M2152.2 1558.4c-5.3 11-12.6 16-21.9 22a63 63 0 0 0 43.8 0 54 54 0 0 1-21.9-22zm-76.5-80.2c-11-5.3-16-12.6-22-22a63 63 0 0 0 0 44 53 53 0 0 1 22-22zm159.2 3.6c11-5.3 16-12.6 22-21.9a63 63 0 0 1 0 43.9c-4.7-9.3-12-16-22-22zm-78.4-80.8c-5.3-11-12.6-16-22-22a63 63 0 0 1 44 0 53 53 0 0 0-22 22z"/> </g> <g fill="#ce9d09"> <g id="va-c"> <path d="M1533.5 903.8s.7-5 0-7.4a23 23 0 0 0-6.6-10.2 20 20 0 0 0-9.2-4.6 25 25 0 0 0-17.7 4.2l-15 6.2-5.5 17.7s-3.2 5.6-4 8.7a23 23 0 0 0-.5 10.1c1 3.9 3.2 7.6 6.3 10.2a19 19 0 0 0 10.3 4 28 28 0 0 0 8.3-1.9c1.6-18.6 9.9-32.8 33.5-36.9z"/> <path d="m1500.3 885.6-38.8-17-3.1 3 21 38.2s6-8.7 9.4-12.7c3.6-4.1 11.5-11.5 11.5-11.5z"/> <circle cx="1457.3" cy="865.3" r="16"/> <path d="M1566.2 932.3c3.4 28 7.3 55.9 16 83.8l31 28.5c-6.5-29.3-18.4-58.5-18.3-87.7z"/> <path d="m1613 972.4-85.4-6.4 27.2 25 78 3.3 1.2-4zm105.4 94.6a62 62 0 0 0-37.9 37c-6.4.7-12.3.7-14.4-4a59 59 0 0 1 35.7-47.8c15-2.8 12.2 8.9 16.6 14.7zm27.5 25.8a62 62 0 0 0-37.9 37.2c-6.3.5-12.3.6-14.4-4.1a59 59 0 0 1 35.8-47.8c15-2.8 12.1 8.9 16.5 14.7zm312.8 261.9a72 72 0 0 0-15.1 1.5c.3 8-3 16.6-11.8 26.2a33 33 0 0 1-23.7 12s-2.8 17.7 2.6 23.3c6.3 6.6 27.1 3.9 27.1 3.9l1.8-1.1a130 130 0 0 1 31.9-39.8l.3-1.3s3-16.5-2.1-21.5c-2.4-2.3-6.6-3-11 0z"/> <circle cx="2254.5" cy="1375.4" r="17.7"/> <circle cx="2260.6" cy="1580" r="17.7"/> <circle cx="2062.1" cy="1591.6" r="17.7"/> </g> </g> </g> <g fill="#ce9d09" transform="matrix(-.2048 0 0 .2048 761.5 0)"> <use xlink:href="#va-b" width="100%" height="100%"/> <use xlink:href="#va-c" width="100%" height="100%" fill="#ccc"/> </g> <g fill="#fa0204" transform="scale(.2048)"> <path id="va-d" d="M1869.2 1175.8c0 5.4-4.5 7.4-13.3 7.4q-12.9.1-12.7-7.9c.2-8 4-6.7 12.7-6.7 8.8 0 13.3 1.8 13.3 7.2z"/> <use xlink:href="#va-d" width="100%" height="100%" x="6.4" y="14.3"/> <path d="M1877.3 1208.7c-1.7 5-6.7 5.6-15 2.7-8.2-3-11.2-6.6-9.4-11.7s6-5 14.3-2.1c8.2 2.9 12 6 10.1 11z"/> <path id="va-e" d="M1877.5 1222.5c-1 5.3-5.9 6.4-14.4 4.7q-12.7-2.5-11-10.3c1-5.3 5.3-5.8 13.8-4s12.7 4.3 11.6 9.6z"/> <use xlink:href="#va-e" width="100%" height="100%" x="4" y="16.1"/> <path d="M1921.7 1216.2c-2.6-.7-2.3-5.3-1.6-7.9 1.2-4 8.4-9.1 8.4-9.1s1.8 5.6 1 8.2c-1.2 3.7-4 9.8-7.8 8.8z"/> <path d="M1912.3 1224.4c-2.8-.6-3.2-5.5-2.5-8.3 1.2-4.3 9.7-9.3 9.7-9.3s1.5 6 .5 8.8c-1.3 3.7-3.9 9.7-7.7 8.8zm-10.8 15.6c-4.3-1.1-3.8-8.8-2.6-13 1-3.6 3.7-9.2 7.2-8.3 4.2 1 4.2 8.3 3.1 12.5-.9 3.8-4 9.8-7.7 8.8z"/> <path d="M1888.7 1252.2c-4.2-1-6-7.6-5.1-11.9s5.3-10.4 9.7-9.4c4.5 1 6 8.3 5 12.8-1 4.1-5.4 9.4-9.6 8.5zm-2.2 7.4c-1 5-7.5 6.8-11.5 5.5s-9.5-7.1-8.4-12.5c1.2-5.4 8.2-6.8 12.3-5.2 3.9 1.5 8.7 7.2 7.6 12.2zm-85-49.3s5.1 2.5 7.3 4.8c2.3 2.4 5.1 3.3 3.7 6.9s-5.8 2.4-8.1-.2c-2.1-2.3-3-11.5-3-11.5zm25.3 8.7c5.3 1.1 5.1 7.2 2.5 11-2.8 3.8-10.9 8.9-16.4 7.8s-4.8-7.8-1.8-11.7c2.9-3.6 10.6-8 15.7-7z"/> <path id="va-f" d="M1844.3 1230.5c4.8 2.2 3.4 8.1 0 11.2-3.6 3.2-12.6 6.3-17.7 4-5.2-2.2-3-8.6.8-11.7 3.6-3 12-5.6 16.9-3.5z"/> <use xlink:href="#va-f" width="100%" height="100%" x="14" y="10.7"/> <path d="M1863 1250.7c4.8.7 6 7.4 4.6 11.7-1.6 4.5-7.5 10.6-12.5 9.8s-6-8-4.2-12.6c1.6-4.2 7.3-9.7 12-9z"/> <path d="M1875.1 1265.3c4 2.3 3 9.6.4 13.6-2.7 4.1-9.8 8.6-14 6.2-4.2-2.5-2.7-10.3.2-14.4 2.8-3.8 9.5-7.6 13.4-5.4zm-86.1-39.9c4.3-.3 7.2 6 7.1 10.6 0 4.9-3.3 12.4-7.7 12.8s-7.3-6.7-7-11.6c.1-4.6 3.4-11.4 7.6-11.8z"/> <path d="M1803 1237.7c4 .9 5 7.8 3.5 12.2-1.6 4.6-7 10.8-11.3 9.8s-5-8.6-3.2-13.2c1.6-4.3 6.8-9.8 11-8.9z"/> <path d="M1815.8 1246.2c5 1.2 6 9.8 4.2 15.3-1.8 5.7-8.2 13.4-13.4 12.2s-5.8-10.7-3.7-16.5c1.9-5.3 8-12.1 12.9-11z"/> <path d="M1826.2 1256.8c5-.6 9 7 9.3 12.8.3 6-3 15.4-8.2 16-5.3.7-9.2-7.9-9.3-14-.1-5.6 3.3-14.2 8.2-14.8z"/> <path id="va-g" d="M1838.6 1265.7c4.5-.6 8.2 5.8 8.4 10.5.3 5-2.7 12.8-7.4 13.4-4.9.6-8.4-6.6-8.5-11.6 0-4.7 3-11.8 7.5-12.3z"/> <use xlink:href="#va-g" width="100%" height="100%" x="12.8" y="10.4"/> <path id="va-h" d="M1929.3 1250.9c-3.3 2.8-9.7.3-12.6-2.9-3.1-3.3-5.3-10.5-1.8-13.5 3.4-3 10.2.2 13.2 3.6 2.7 3.3 4.4 10 1.2 12.8z"/> <use xlink:href="#va-h" width="100%" height="100%" x="-7" y="12.8"/> <use xlink:href="#va-h" width="100%" height="100%" x="-19.5" y="23.5"/> <path d="M1905.2 1281.2c-1.1 4.1-8 5.6-12.1 4.5-4.4-1-10.2-5.8-9-10.2 1.3-4.4 8.7-5.6 13-4.3 4.2 1.2 9.2 5.9 8 10z"/> <path d="M1887.2 1278.2c3.6 2.5 2.8 10.5.4 14.9-2.6 4.5-9 9.5-12.9 6.8s-2.5-11.3.2-15.8c2.5-4.2 8.7-8.4 12.3-6z"/> <path d="M1869.6 1287.5c4 2.4 3 9.6.4 13.6-2.7 4.1-9.8 8.6-14 6.2-4.2-2.5-2.7-10.3.2-14.4 2.8-3.8 9.5-7.6 13.4-5.4z"/> <path id="va-i" d="M1831.3 1313c-3.4 3.1-.7 11.2 2.8 15.2 3.7 4.2 11.8 8.1 15.4 4.7s.3-12-3.6-16.1c-3.7-3.9-11.2-7-14.6-3.9z"/> <use xlink:href="#va-i" width="100%" height="100%" x="-7.3" y="13.8"/> <path id="va-j" d="M1820.8 1339.5c-4.3 1.8-4.8 10.2-3 15.3 1.8 5.3 7.9 11.9 12.5 10 4.6-1.8 4.7-11 2.6-16.3-2-4.9-7.8-10.7-12-9z"/> <use xlink:href="#va-j" width="100%" height="100%" x="-10.5" y="14.9"/> <path id="va-k" d="M1802.7 1371c-4.6 1-6.5 9.3-5.5 14.6 1 5.5 6 13 10.8 11.9s6.4-10.2 5.2-15.7c-1.2-5.1-6-11.8-10.5-10.8z"/> <use xlink:href="#va-k" width="100%" height="100%" x="-10.1" y="15.9"/> <path id="va-l" d="M1784 1403.3c-4.6.2-8 8-8 13.3 0 5.6 3.5 13.9 8.4 13.7s8.2-8.8 8-14.5c-.2-5.3-3.7-12.7-8.3-12.5z"/> <use xlink:href="#va-l" width="100%" height="100%" x="-10.3" y="19.2"/> <use xlink:href="#va-l" width="100%" height="100%" x="-22.4" y="37"/> <use xlink:href="#va-l" width="100%" height="100%" x="-34.9" y="52.3"/> <use xlink:href="#va-l" width="100%" height="100%" x="-47.8" y="66.5"/> <use xlink:href="#va-l" width="100%" height="100%" x="-62" y="78.1"/> <use xlink:href="#va-l" width="100%" height="100%" x="-75.6" y="90.6"/> <path d="m1692.8 1500.2-5.3 20.6s3 7.3 6 7c5.5-.6 7-9 8-14.5 1-8.4-8.7-13.1-8.7-13.1zm324.4 13.1c1.6 6 15.3 11.3 15.3 11.3l-6.7-27.8c-5.7.2-9.5 12.4-8.6 16.4z"/> <path d="M2016 1491c-4.3-1.8-10.5 4-12.7 8.9-2.3 5.1-2.4 14 2.2 15.9 4.6 1.8 11-4.8 13.1-10 2-5 1.7-13.1-2.6-14.9z"/> <path id="va-m" d="M2000.8 1478.7c-4.7-.3-8.7 7.2-9.2 12.5-.5 5.6 2.2 14.1 7.1 14.4 5 .2 9-8 9.3-13.7.3-5.3-2.6-13-7.2-13.2z"/> <use xlink:href="#va-m" width="100%" height="100%" x="-13.4" y="-13.7"/> <use xlink:href="#va-m" width="100%" height="100%" x="-25.9" y="-29.2"/> <use xlink:href="#va-m" width="100%" height="100%" x="-38.7" y="-42.3"/> <use xlink:href="#va-m" width="100%" height="100%" x="-49" y="-60.3"/> <use xlink:href="#va-m" width="100%" height="100%" x="-60.3" y="-76.4"/> <use xlink:href="#va-m" width="100%" height="100%" x="-70.6" y="-93.5"/> <use xlink:href="#va-m" width="100%" height="100%" x="-79.8" y="-113.3"/> <use xlink:href="#va-m" width="100%" height="100%" x="-89.8" y="-131.2"/> <use xlink:href="#va-m" width="100%" height="100%" x="-98" y="-152.5"/> <path d="M1883.8 1304.6s-1.6 26.6 8 28.3c6.1 1.1 10.9-14.9 10.9-14.9z"/> <path id="va-n" d="M1862 1610.8c-2.9 3.6 1 11.2 5 14.7 4.3 3.6 12.9 6.2 15.9 2.3s-1.5-11.9-6-15.4c-4-3.2-12-5.3-14.9-1.6z"/> <use xlink:href="#va-n" width="100%" height="100%" x="18.3" y="-2.2"/> <use xlink:href="#va-n" width="100%" height="100%" x="36.8" y="-5.8"/> <path id="va-o" d="M1916.2 1603.8c-2.3 4 2.6 11 7.1 13.8 4.8 3 13.7 4.3 16 0 2.5-4.4-3.2-11.6-8.1-14.4-4.6-2.6-12.8-3.4-15 .6z"/> <use xlink:href="#va-o" width="100%" height="100%" x="20" y="-3.2"/> <path id="va-p" d="M1953.5 1595.4c-2 4.3 3.6 10.7 8.4 13.1 5 2.5 14 3 16-1.5s-4.4-11.2-9.5-13.5c-4.8-2.2-13-2.3-15 2z"/> <use xlink:href="#va-p" width="100%" height="100%" x="18.9" y="-5.6"/> <path id="va-q" d="M1991.3 1583.9c-1.7 4.4 4.2 10.5 9.1 12.5 5.2 2.2 14.2 2.2 15.9-2.4 1.7-4.7-5-11-10.3-13-5-1.8-13.1-1.4-14.7 2.9z"/> <use xlink:href="#va-q" width="100%" height="100%" x="19.2" y="-6.2"/> <use xlink:href="#va-q" width="100%" height="100%" x="37.7" y="-14"/> <use xlink:href="#va-q" width="100%" height="100%" x="57.5" y="-22.2"/> <use xlink:href="#va-q" width="100%" height="100%" x="77.5" y="-28.6"/> <use xlink:href="#va-q" width="100%" height="100%" x="79.9" y="-44.3"/> <path d="M2066.7 1534.9s13.6 2 14.8-2.9c1.6-6.5-15.4-12.7-15.4-12.7z"/> <path id="va-r" d="M1701.6 1575.6c-4 2.5-3 10.9-.4 15.5 2.7 4.9 9.8 10.4 14 7.8s2.8-11.7-.2-16.5c-2.7-4.5-9.4-9.2-13.4-6.8z"/> <use xlink:href="#va-r" width="100%" height="100%" x="18.9" y="7.8"/> <use xlink:href="#va-r" width="100%" height="100%" x="37" y="10.6"/> <use xlink:href="#va-r" width="100%" height="100%" x="56.8" y="15.5"/> <use xlink:href="#va-r" width="100%" height="100%" x="74.7" y="18.1"/> <use xlink:href="#va-r" width="100%" height="100%" x="92.3" y="21.7"/> <use xlink:href="#va-r" width="100%" height="100%" x="110.4" y="26.7"/> <use xlink:href="#va-r" width="100%" height="100%" x="128.3" y="29.9"/> <use xlink:href="#va-r" width="100%" height="100%" x="146.6" y="32.7"/> <path d="M1648.2 1517.5c-4.2-2.1-11 3-13.6 7.6-2.7 5-3.8 13.8.6 16 4.4 2.3 11.5-3.6 14-8.6 2.5-4.7 3-12.9-1-15z"/> <path d="M1642 1534.4c-4.4-1.6-10.4 4.4-12.4 9.4-2 5.2-2 14.1 2.7 15.8 4.7 1.6 10.9-5.2 12.8-10.5 1.8-5 1.3-13.1-3-14.7z"/> <path d="M1647.7 1550c-4.5-1.2-10 5.3-11.5 10.4-1.6 5.4-.6 14.3 4.2 15.5s10.3-6.1 11.8-11.6c1.3-5.1 0-13.2-4.5-14.4z"/> <path d="M1662.4 1556.3c-4.5-1.3-10.2 5-11.9 10-1.7 5.4-1 14.3 3.7 15.7s10.5-5.8 12.1-11.2c1.5-5 .5-13.2-4-14.5z"/> <path id="va-s" d="M1672 1558.8c-4.6 1.1-6.3 9.4-5.2 14.7 1.1 5.5 6.2 12.8 11 11.6s6.2-10.3 4.8-15.8c-1.2-5-6.2-11.6-10.7-10.5z"/> <use xlink:href="#va-s" width="100%" height="100%" x="16.8" y="6.2"/> <use xlink:href="#va-i" width="100%" height="100%" x="8.6" y="-11.2"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.7" y="6.5"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.9" y="26.7"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.7" y="47.9"/> <use xlink:href="#va-i" width="100%" height="100%" x="5.6" y="68.6"/> <use xlink:href="#va-i" width="100%" height="100%" x="2.2" y="87.7"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.7" y="109.1"/> <use xlink:href="#va-i" width="100%" height="100%" x="2.2" y="126.4"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.7" y="143.5"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.7" y="163.9"/> <use xlink:href="#va-i" width="100%" height="100%" x="3.4" y="183.9"/> <use xlink:href="#va-i" width="100%" height="100%" x="3.7" y="203.1"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.4" y="223.5"/> <use xlink:href="#va-i" width="100%" height="100%" x="4.4" y="243.3"/> <use xlink:href="#va-i" width="100%" height="100%" x="3.7" y="263.1"/> <use xlink:href="#va-i" width="100%" height="100%" x="2.5" y="283.2"/> <use xlink:href="#va-i" width="100%" height="100%" x="2.5" y="305.1"/> <use xlink:href="#va-i" width="100%" height="100%" x="1.9" y="327.9"/> <use xlink:href="#va-i" width="100%" height="100%" x="1.9" y="349.3"/> <use xlink:href="#va-i" width="100%" height="100%" x="1.9" y="369"/> <use xlink:href="#va-i" width="100%" height="100%" x="1.3" y="391.3"/> <path id="va-t" d="M1882.2 1303.2c2.5 3.7-1.3 10.8-5.1 14-4 3.2-12 5.4-14.5 1.5-2.6-4 1.9-11.4 6-14.6 4-3 11.2-4.6 13.6-1z"/> <use xlink:href="#va-t" width="100%" height="100%" x="2.7" y="16.1"/> <use xlink:href="#va-t" width="100%" height="100%" x="2.4" y="34.1"/> <use xlink:href="#va-t" width="100%" height="100%" x="2.1" y="52.4"/> <use xlink:href="#va-t" width="100%" height="100%" x="1.8" y="69.1"/> <use xlink:href="#va-t" width="100%" height="100%" x="2.7" y="87.1"/> <use xlink:href="#va-t" width="100%" height="100%" x="1.5" y="104.4"/> <path d="M1883.3 1426c2.6 3.9-1.5 11.3-5.7 14.5-4.5 3.4-13.2 5.7-16 1.6s2-11.8 6.6-15c4.4-3.1 12.4-4.8 15-1z"/> <path id="va-u" d="M1882 1443.6c3.5 3.2.8 11.3-2.7 15.3-3.7 4.2-11.8 8-15.3 4.7-3.6-3.5-.3-12 3.6-16.2 3.6-3.8 11.1-7 14.5-3.8z"/> <use xlink:href="#va-u" width="100%" height="100%" x=".6" y="20.4"/> <use xlink:href="#va-u" width="100%" height="100%" x=".9" y="40.5"/> <use xlink:href="#va-u" width="100%" height="100%" x=".3" y="62.1"/> <use xlink:href="#va-u" width="100%" height="100%" x=".9" y="82.2"/> <use xlink:href="#va-u" width="100%" height="100%" x=".3" y="102.6"/> <use xlink:href="#va-u" width="100%" height="100%" x=".6" y="123"/> <use xlink:href="#va-u" width="100%" height="100%" x=".6" y="143.7"/> <use xlink:href="#va-u" width="100%" height="100%" x="-.3" y="164.4"/> <use xlink:href="#va-u" width="100%" height="100%" x=".9" y="183.3"/> <use xlink:href="#va-u" width="100%" height="100%" x=".9" y="203.1"/> <use xlink:href="#va-u" width="100%" height="100%" x=".3" y="224.4"/> <use xlink:href="#va-u" width="100%" height="100%" x=".3" y="245.4"/> </g> <g transform="scale(.2048)"> <path fill="#fa0204" d="M1849.6 1848.3a77 77 0 0 0 48.3.4l-17.5-28"/> <path fill="#ce9d09" d="m1888.3 1776.2-31.7-8.2s.4-35.2 20.4-32.1c16.6 2.5 12 40.3 11.3 40.3z"/> <circle cx="1872.9" cy="1723" r="12.9" fill="#ce9d09"/> <path fill="#fa0204" d="M1885.4 1791.9c7 17.8 11.3 33.2 4.7 53.3m7.6 3.5c-10.2-8.3-36.6-5.9-48-.4-4.4 0-16.4-83.2 25.7-81.2 38.8 2 25 82 22.3 81.6z"/> </g> <g transform="scale(.2048)"> <path fill="#fa0204" d="M1815.2 1866.3a47 47 0 0 0 54.2.5l-40.2-42"/> <circle cx="1843.4" cy="1738.3" r="12.9" fill="#ce9d09"/> <path fill="#ce9d09" d="m1859.3 1780-32.7-.6s-4.2-26.6 16.2-27.8c16.9-1 17.2 28.4 16.5 28.4z"/> <path fill="#fa0204" d="M1843.6 1860.7c-6.3-13.9-6.9-31-5.2-49.5m-9.4 50.4c-7.7-13.2-9.1-30-3-51.2m43.4 56.6c-5-6.2-40.3-8.8-54.1-.4-5 0-18.6-93.8 29-91.5 43.6 2.1 28 92.3 25 91.9z"/> </g> </g>` };      // and so is the Vatican's (Church Latin): the drawn flag with the keys and the tiara (flag-icons, MIT)
const SQUARE_VB = { ec: '0 0 512 512' };
const flag = (c, mini) => SQUARE[c] ? `<svg class="flag sq${mini ? ' mini' : ''}" viewBox="${SQUARE_VB[c] || '0 0 32 32'}" aria-hidden="true">${SQUARE[c]}</svg>`
  : FLAG_ART[c] ? `<svg class="flag${mini ? ' mini' : ''}" viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true">${FLAG_ART[c]}</svg>` : '';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm11.5 3a4 4 0 0 0-2-3.46v6.92a4 4 0 0 0 2-3.46zm-2-8.3v2.1a7 7 0 0 1 0 12.4v2.1a9 9 0 0 0 0-16.6z"/></svg>';
const LANGS = [
  { id: 'en', name: 'English', ph: 'type a word…', code: 'EN' },
  { id: 'de', name: 'German', ph: 'Wort eingeben…', code: 'DE' },
  { id: 'fr', name: 'French', ph: 'saisir un mot…', code: 'FR' },
  { id: 'pt', name: 'Portuguese', ph: 'digite uma palavra…', code: 'PT' },
  { id: 'cs', name: 'Czech', ph: 'napište slovo…', code: 'CS' },
  { id: 'it', name: 'Italian', ph: 'scrivi una parola…', code: 'IT' },
  { id: 'es', name: 'Spanish', ph: 'escribe una palabra…', code: 'ES' },
  { id: 'nl', name: 'Dutch', ph: 'typ een woord…', code: 'NL' },
  { id: 'sv', name: 'Swedish', ph: 'skriv ett ord…', code: 'SV' },
  { id: 'la', name: 'Latin', ph: 'verbum scribe…', code: 'LA' }
];
/* the boxes on screen: 2 to 4 languages chosen from LANGS, in the reader's order (Settings › My languages) */
const MIN_SLOTS = 2, MAX_SLOTS = 4;
const UI_LANGS = ['en', 'de', 'fr', 'pt', 'cs', 'it', 'es', 'nl', 'sv', 'la'];
const LNAME_EN = { en: 'English', de: 'German', fr: 'French', pt: 'Portuguese', cs: 'Czech', it: 'Italian', es: 'Spanish', nl: 'Dutch', sv: 'Swedish', la: 'Latin' };
const LNAME = new Proxy(LNAME_EN, { get: (o, k) => typeof k === 'string' && o[k] ? t('lang.' + k, o[k]) : o[k] });
/* languages whose data has been checked by hand less: shown with a "beta" label where a language is chosen */
const BETA = new Set(['cs', 'it', 'nl', 'sv', 'la']);
const betaName = l => BETA.has(l) ? LNAME[l] + ' (' + t('lang.beta', 'beta') + ')' : LNAME[l];
const betaTag = l => BETA.has(l) ? ` <span class="beta-tag" title="${esc(t('lang.beta.tip', 'Less checked by hand than English, German, French, Portuguese and Spanish. Mistakes are more likely.'))}">${esc(t('lang.beta', 'beta'))}</span>` : '';
const CEFR = { A1: 'basic', A2: 'elementary', B1: 'intermediate', B2: 'upper intermediate', C1: 'advanced', C2: 'academic' };
const TRY = ['Haus', 'gehen', 'gut', 'Zeit', 'helfen', 'schön', 'anfangen', 'Kind'];


/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString({ de: 'de-CH', fr: 'fr-CH', pt: 'pt-BR', cs: 'cs-CZ', it: 'it-IT', es: 'es-ES', nl: 'nl-NL', sv: 'sv-SE', la: 'it-IT' }[S.ui] || 'en-US');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function cleanOrder(o) {        // 2 to 4 different languages the app knows; otherwise the default four
  const ids = LANGS.map(l => l.id), x = Array.isArray(o) ? o.filter((l, k) => ids.includes(l) && o.indexOf(l) === k).slice(0, MAX_SLOTS) : [];
  return x.length >= MIN_SLOTS ? x : DEFAULTS.order.slice();
}
function loadSettings() {
  const saved = store.get('flt:settings4', {});
  Object.assign(S, JSON.parse(JSON.stringify(DEFAULTS)), saved, { main: Object.assign({}, DEFAULTS.main, saved.main || {}), voice: Object.assign({}, DEFAULTS.voice, saved.voice || {}) });
  Object.keys(REG).forEach(l => { if (!REG[l].includes(S.main[l])) S.main[l] = BASE[l]; });
  S.order = cleanOrder(S.order);
  if (!S.ui || !UI_LANGS.includes(S.ui)) { const n = (navigator.language || 'en').slice(0, 2); S.ui = UI_LANGS.includes(n) ? n : 'en'; }
}
loadSettings();
const saveSettings = () => store.set('flt:settings4', S);
/* personal data, only on this device: favourites, known words, notes, own lists, history, practice mistakes */
const P = Object.assign({ favs: {}, known: {}, notes: {}, lists: [], history: [], mistakes: [], looks: {}, offered: {}, last: null, srs: {} }, store.get('flt:me1', {}));
const saveP = () => { store.set('flt:me1', P); if (window.FLTViews) FLTViews.counter(); if (window.FLTSync) FLTSync.changed(); };
let recent = store.get('flt:recent3', { en: [], de: [], fr: [], pt: [] });
let toastTimer = 0;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = esc(msg) + (action ? ` <button class="chip" id="toast-act">${esc(action.label)}</button>` : '');
  if (action) $('#toast-act').addEventListener('click', () => { action.fn(); el.textContent = ''; });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.textContent = ''; }, action ? 12000 : 6000);
}
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const animOn = () => S.anim && !reducedMotion();
/* level: stored (Claude, Wiktionary) or estimated from the frequency rank */
function levelOf(e) {
  if (!e) return null;
  if (e.level) return { l: e.level, est: false };
  if (e.level_ch) return { l: e.level_ch, est: true };          // Swiss words: hand-set level (the frequency list is from Germany)
  const l = FLTLearn.estimateLevel(e.frequency_rank);
  return l ? { l, est: true } : null;
}
const LVORD = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const lvlBadge = (e, small) => { const v = levelOf(e); return v ? `<span class="lvl ${v.l}${small ? ' sm' : ''}" lang="en" title="${esc(v.est ? t('lvl.est', 'Level estimated from how often the word is used') : t('lvl.stored', 'Level'))}">${v.l}${small ? '' : ' · ' + esc(t('cefr.' + v.l, CEFR[v.l]))}</span>` : ''; };
/* Marks the letters of `form` that are not in `base` (Tisch -> Tisch<b>e</b>, Haus -> H<b>ä</b>us<b>er</b>). */
function regularForm(lang, w, k) {        // what a regular verb would have here (to compare with the real form)
  const st = w.slice(0, -2), end = w.slice(-2);
  if (lang === 'en') return /e$/.test(w) ? w + 'd' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ied' : w + 'ed';
  if (lang === 'fr') {
    if (k === 1) return end === 'er' ? st + 'e' : end === 'ir' ? st + 'is' : end === 're' ? st + 's' : null;
    return end === 'er' ? st + 'é' : end === 'ir' ? st + 'i' : end === 're' ? st + 'u' : null;
  }
  if (lang === 'it') {
    const st3 = w.slice(0, -3), e3 = w.slice(-3); if (!['are', 'ere', 'ire'].includes(e3)) return null;
    return k === 1 ? st3 + 'o' : st3 + { are: 'ato', ere: 'uto', ire: 'ito' }[e3];
  }
  if (lang === 'es') {
    if (!['ar', 'er', 'ir'].includes(end)) return null;
    return k === 1 ? st + 'o' : k === 2 ? st + (end === 'ar' ? 'é' : 'í') : st + (end === 'ar' ? 'ado' : 'ido');
  }
  if (lang === 'pt') {
    if (/[ao]r$/.test(w) && !/(ar|er|ir)$/.test(w)) return null;          // pôr and its compounds: all irregular
    if (k === 1) return st + 'o';
    if (k === 2) return end === 'ar' ? st + 'ei' : st + 'i';
    return end === 'ar' ? st + 'ado' : st + 'ido';
  }
  return null;
}
/* a verb form marked as a whole when it is not the regular one (English, French, Portuguese) */
const irrForm = (lang, lemma, k, f) => { const r = regularForm(lang, lemma, k); return r && fold(r) === fold(f) ? esc(f) : `<b class="chg">${esc(f)}</b>`; };
function diffMarkRaw(base, form, vowelsOnly) { return diffMark(base, form, vowelsOnly); }
function diffMark(base, form, vowelsOnly) {
  const a = String(base), b = String(form), n = a.length, m = b.length;
  if (!a || !b || n * m > 4000) return esc(b);
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i].toLowerCase() === b[j].toLowerCase() ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keep = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) { if (a[i].toLowerCase() === b[j].toLowerCase()) { keep[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  let out = '', open = false;
  for (let j = 0; j < m; j++) {
    const hi = !keep[j] && (!vowelsOnly || /[aeiouyäöüàâéèêëîïôûœãõáíóú]/i.test(b[j]));
    if (hi && !open) { out += '<b class="chg">'; open = true; }
    if (!hi && open) { out += '</b>'; open = false; }
    out += esc(b[j]);
  }
  return out + (open ? '</b>' : '');
}
function similar(a, b) {      // 0..1, folded spelling
  a = fold(a); b = fold(b); if (!a || !b) return 0;
  const n = a.length, m = b.length; let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) { const cur = [i]; for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return 1 - prev[m] / Math.max(n, m);
}
const cleanTyped = s => String(s || '').replace(/\s+/g, ' ').replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '').trim();



/* ---------- data: ./data files, kept in IndexedDB ----------
   core-<lang>.json      the most frequent words, card data: loaded on the first visit
   details-<lang>.json   examples and background of the core words: loaded right after
   ext/<lang>/<k>.json   all other words (extended and long tail) and the inflected forms, by first letters:
                         loaded when a word starting with those letters is typed, looked up or shown */
const D = { byId: new Map(), idx: {}, frows: {}, count: {}, entries: {}, top: {}, manifest: null, ready: false, details: false, buckets: new Map(), db: null,
  loaded: new Set(), detailsLoaded: new Set(), linksLoaded: new Set(), extrLoaded: new Set() };          // the languages whose common words (and their details) are on this page
LANGS.forEach(l => { D.idx[l.id] = []; D.frows[l.id] = []; D.count[l.id] = 0; D.entries[l.id] = 0; D.top[l.id] = []; });
const DB_NAME = 'flt-data', FILES = 'files';
function idbOpen() {
  return new Promise((res, rej) => {
    let r; try { r = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => r.result.createObjectStore(FILES);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const idbReq = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction(FILES, mode), q = fn(t.objectStore(FILES)); t.oncomplete = () => res(q.result); t.onerror = t.onabort = () => rej(t.error); });
const idbGet = (db, k) => idbReq(db, 'readonly', s => s.get(k));
const idbPut = (db, k, v) => idbReq(db, 'readwrite', s => s.put(v, k));
const idbClear = db => idbReq(db, 'readwrite', s => s.clear());
async function readJson(r, file) {             // data files are stored gzip-compressed (.json.gz) to keep the site small
  if (!file.endsWith('.gz')) return r.json();
  const buf = await r.arrayBuffer(), b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buf));   // already unpacked on the way
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to unpack the word lists. Please update it.');
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
}

/* Saving to the device copies the whole object on the main thread, so during the first load the saves wait until the
   app is usable (a few hundred milliseconds sooner on a first visit) */
const saveQ = [];
function saveLater(k, v) {
  if (D.ready) { idbPut(D.db, k, v).catch(() => {}); return; }
  saveQ.push([k, v]);
}
function flushSaves() {
  const next = () => { const x = saveQ.shift(); if (!x || !D.db) return; idbPut(D.db, x[0], x[1]).catch(() => {}).then(() => setTimeout(next, 30)); };
  setTimeout(next, 1200);
}
async function getFile(file, sha) {          // saved copy on this device, otherwise the network
  let rec = null;
  if (D.db) { try { rec = await idbGet(D.db, file); } catch (e) {} }
  if (rec && rec.sha === sha) return rec.data;
  const r = await fetch('data/' + file + '?v=' + sha);
  if (!r.ok) throw new Error('A data file could not be loaded (' + file + ').');
  const data = await readJson(r, file);
  if (D.db) saveLater(file, { sha, data });      // saved in the background
  return data;
}
async function loadData(progress) {
  let manifest = null;
  const mf = fetch('data/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);   // in parallel with opening the database
  try { D.db = await idbOpen(); } catch (e) { D.db = null; }
  manifest = await mf;
  if (!manifest && D.db) { try { manifest = await idbGet(D.db, 'manifest'); } catch (e) {} }
  if (!manifest) throw new Error('The dictionary data could not be loaded. Connect to the internet once so the app can save its data on this device.');
  const has = new Set(manifest.files.filter(f => f.tier === 'core').map(f => f.lang));
  S.order = cleanOrder(S.order.filter(l => has.has(l)));       // a language this data version does not have yet is dropped
  const out = {}, core = manifest.files.filter(f => f.tier === 'core' && S.order.includes(f.lang));
  let done = 0;
  progress('Loading the dictionary data…');
  // the translations between the chosen languages come in small pair files (links/de-fr.json), loaded together with the words
  const lk = pairFiles(manifest, 'links', S.order), links = [];
  await Promise.all([...core.map(async f => { out[f.lang] = await getFile(f.file, f.sha256); done++; progress(`Loading the dictionary data (${done} of ${core.length})…`); }),
    ...lk.map(async f => { links.push([f, await getFile(f.file, f.sha256)]); })]);
  out.__links = links;
  if (D.db) saveLater('manifest', manifest);
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const keep = manifest.files.filter(f => ['core', 'details', 'ext', 'links', 'extr'].includes(f.tier)).map(f => 'data/' + f.file + '?v=' + f.sha256);
    navigator.serviceWorker.controller.postMessage({ type: 'prune', keep });
  }
  return { manifest, out };
}
async function loadDetails() {
  const det = D.manifest.files.filter(f => f.tier === 'details' && D.loaded.has(f.lang) && !D.detailsLoaded.has(f.lang));
  det.forEach(f => D.detailsLoaded.add(f.lang));
  await Promise.all(det.map(async f => {
    const d = await getFile(f.file, f.sha256);
    for (const id in d) {
      const e = D.byId.get(id), x = d[id]; if (!e) continue;
      e.examples = (x.examples || []).map(ex => ex.credit !== undefined ? Object.assign({}, ex, { credits: { [e.lang]: ex.credit }, translations: {}, translation_ids: {} }) : ex); e.more = x.more; e.origin = x.origin;
      (x.senses || []).forEach((y, i) => { if (e.senses[i]) Object.assign(e.senses[i], y); });
      if (corrFor(id).length) applyCorr(e);
    }
  }));
  await loadPairs('extr', [...D.detailsLoaded]);
  // idioms become searchable: typing "auf jemanden Häuser bauen" opens Haus
  for (const lang of new Set(det.map(f => f.lang))) {
    const rows = D.idx[lang]; let added = 0;
    for (const e of D.byId.values()) if (e.lang === lang && e.tier === 'core' && e.more && e.more.idioms) for (const x of e.more.idioms) {
      const w = String(x).split(' — ')[0].trim(); if (w.length < 5 || !/\s/.test(w)) continue;
      rows.push({ k: fold(w), w, id: e.id, r: e.frequency_rank || 1e9, a: 2 }); added++;
    }
    if (added) rows.sort(rowSort);
  }
  D.details = true;
}
const stripKey = (lang, k) => lang === 'en' ? k.replace(/^to\s+/, '') : lang === 'de' ? k.replace(/^sich\s+/, '') : lang === 'fr' ? k.replace(/^(se\s+|s')/, '') : lang === 'cs' ? k.replace(/\s+(se|si)$/, '') : lang === 'nl' ? k.replace(/^zich\s+/, '') : lang === 'sv' ? k.replace(/\s+sig$/, '') : lang === 'es' ? k.replace(/(ar|er|ir)se$/, '$1') : lang === 'it' ? k.replace(/(ar|er|ir)si$/, '$1e') : k.replace(/-se$/, '');
const rowSort = (a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.a - b.a || a.r - b.r;
/* Corrections of reported mistakes: manifest.json "corrections" (format in docs/CORRECTIONS.md). They are applied to
   every entry as it is loaded, and again when its examples and background arrive. */
let CORR = null;
function corrFor(id) {
  if (!CORR) { CORR = new Map(); for (const c of (D.manifest && D.manifest.corrections) || []) { const k = c.entry; if (k) { if (!CORR.has(k)) CORR.set(k, []); CORR.get(k).push(c); } } }
  return CORR.get(id) || [];
}
function setPath(o, path, v) {
  const p = String(path).split('.'); let x = o;
  for (let i = 0; i < p.length - 1; i++) { const k = /^\d+$/.test(p[i]) ? +p[i] : p[i]; if (x[k] == null) x[k] = /^\d+$/.test(p[i + 1]) ? [] : {}; x = x[k]; }
  x[/^\d+$/.test(p[p.length - 1]) ? +p[p.length - 1] : p[p.length - 1]] = v;
}
function applyCorr(e) {
  for (const c of corrFor(e.id)) {
    try {
      if (c.hide) e.hidden = true;
      if (c.set) for (const k in c.set) setPath(e, k, c.set[k]);
      const s = c.sense != null ? e.senses[c.sense] : null;
      if (c.remove_translation) for (const sn of (s ? [s] : e.senses)) { const L = c.remove_translation.lang; if (sn.translations[L]) sn.translations[L] = sn.translations[L].filter(x => x !== c.remove_translation.target); }
      if (c.add_translation && s) { const L = c.add_translation.lang, tg = c.add_translation.target, a = (s.translations[L] || []).filter(x => x !== tg); s.translations[L] = c.add_translation.first === false ? a.concat([tg]) : [tg].concat(a); }
      if (c.hide_example && e.examples) e.examples = e.examples.filter(x => x.id !== c.hide_example.id);
      if (c.example_translation && e.examples) { const x = e.examples.find(y => y.id === c.example_translation.id); if (x) { const L = c.example_translation.lang; if (c.example_translation.text) x.translations[L] = c.example_translation.text; else delete x.translations[L]; } }
    } catch (err) {}
  }
  return e;
}
function addRows(lang, entries) {
  const rows = D.idx[lang];
  for (const e of entries) {
    applyCorr(e);
    if (e.hidden) continue;
    D.byId.set(e.id, e);
    rows.push({ k: fold(e.lemma), w: e.lemma, id: e.id, r: e.frequency_rank || 1e9, a: 0 });
    for (const v of e.regional_variants || []) if (v.form && fold(v.form) !== fold(e.lemma)) rows.push({ k: fold(v.form), w: v.form, id: e.id, r: e.frequency_rank || 1e9, a: 1 });
  }
  rows.sort(rowSort);
}
function indexLang(lang, entries) {
  addRows(lang, entries || []);
  const c = (D.manifest.counts || {})[lang];
  D.count[lang] = (c && c.words_for_suggestions) || D.idx[lang].length;
  D.entries[lang] = (c && c.entries) || (entries || []).length;
  D.top[lang] = D.idx[lang].filter(x => !x.a && x.r < 1e9).sort((a, b) => a.r - b.r).slice(0, 60);
  D.loaded.add(lang);
}
const pairFiles = (m, tier, langs) => m.files.filter(f => f.tier === tier && langs.includes(f.lang) && langs.includes(f.to));
function mergeLinks(f, d) {          // per entry, per sense: the ids in the other language
  D.linksLoaded.add(f.file);
  for (const id in d) { const e = D.byId.get(id); if (!e) continue; d[id].forEach((ids, k) => { if (e.senses[k] && ids.length) e.senses[k].translations[f.to] = ids; }); if (corrFor(id).length) applyCorr(e); }
}
function mergeExamples(f, d) {      // per entry, per example: [sentence, Tatoeba id, contributor] in the other language
  D.extrLoaded.add(f.file);
  for (const id in d) {
    const e = D.byId.get(id); if (!e || !e.examples) continue;
    d[id].forEach((x, k) => { const ex = e.examples[k]; if (!ex || !x) return;
      (ex.translations = ex.translations || {})[f.to] = x[0]; if (x[1]) (ex.translation_ids = ex.translation_ids || {})[f.to] = x[1]; if (x[2]) (ex.credits = ex.credits || {})[f.to] = x[2]; });
    if (corrFor(id).length) applyCorr(e);
  }
}
async function loadPairs(tier, langs) {
  const done = tier === 'links' ? D.linksLoaded : D.extrLoaded, merge = tier === 'links' ? mergeLinks : mergeExamples;
  await Promise.all(pairFiles(D.manifest, tier, langs).filter(f => !done.has(f.file)).map(async f => merge(f, await getFile(f.file, f.sha256))));
}
function buildIndex(out) {
  const links = out.__links || []; delete out.__links;
  for (const lang of Object.keys(out)) indexLang(lang, out[lang]);
  for (const [f, d] of links) mergeLinks(f, d);
  for (const l of LANGS) if (!D.count[l.id]) { const c = (D.manifest.counts || {})[l.id]; if (c) { D.count[l.id] = c.words_for_suggestions; D.entries[l.id] = c.entries; } }
  D.ready = true;
  if (saveQ.length) flushSaves();
}
/* a language added in Settings: its common words, then their examples and background */
async function loadLang(lang) {
  if (D.loaded.has(lang)) return;
  const f = D.manifest.files.find(x => x.tier === 'core' && x.lang === lang); if (!f) throw new Error('No data for ' + lang);
  indexLang(lang, await getFile(f.file, f.sha256));
  await loadPairs('links', [...D.loaded]);
  loadDetails().then(() => { if (state.status === 'done') render(false); }).catch(() => {});
}
const dataLangs = () => (D.manifest ? [...new Set(D.manifest.files.filter(f => f.tier === 'core').map(f => f.lang))] : LANGS.map(l => l.id)).filter(l => LANGS.some(x => x.id === l));
/* the extended and long-tail tiers carry only some fields: fill in the rest as empty */
function expand(e) {
  const x = Object.assign({ level: null, frequency_rank: null, ipa: { default: null, regional: {} }, noun: null, verb: null, adjective: null, governs: [],
    regional_variants: [], swiss_german: null, synonyms: [], synonyms_text: [], examples: [], usage_note: null, verified: false }, e);
  x.more = { definition: null, collocations: [], idioms: [], word_family: [], antonyms: [], etymology: null, learner_mistake: null };
  x.origin = e.origin || {};
  if (x.pos === 'noun') x.noun = Object.assign({ gender: null, plural: null, plural_alt: [], plural_rule: null, plural_regular: null, genitive: null, irregular_forms: {} }, e.noun || {});
  if (x.pos === 'verb') x.verb = Object.assign({ regular: null, class: null, aux: null, aux_regional: {}, principal_parts: null, present_3sg: null, irregular_forms: {} }, e.verb || {});
  x.senses = (e.senses || []).map(s => { const o = Object.assign({ gloss: null, gloss_en: null, register: null, route: {} }, s); o.gloss_en = cleanGloss(o.gloss_en); return o; });
  return x;
}
/* buckets: same folding as build/build_tiers.py */
const bfold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/’/g, "'").trim();
const bkey = (w, n) => { const f = bfold(w); let k = ''; for (let i = 0; i < n; i++) { const c = f[i]; k += (c && c >= 'a' && c <= 'z') ? c : '_'; } return k; };
function bucketOf(lang, word) {
  const bs = (D.manifest && D.manifest.buckets && D.manifest.buckets[lang]) || {};
  for (let n = 1; n <= 4; n++) { const k = bkey(word, n); if (bs[k]) return k; }
  return null;
}
function loadBucket(lang, k) {
  if (!k) return Promise.resolve();
  const key = lang + '/' + k;
  if (!D.buckets.has(key)) {
    const sha = D.manifest.buckets[lang][k];
    const file = (D.manifest.bucket_file || 'ext/<lang>/<prefix>.json.gz').replace('<lang>', lang).replace('<prefix>', k);
    D.buckets.set(key, getFile(file, sha).then(d => {
      addRows(lang, (d.entries || []).filter(e => !D.byId.has(e.id)).map(expand));
      const fr = D.frows[lang];
      for (const f in d.forms || {}) fr.push({ k: fold(f), w: f, ids: d.forms[f] });
      fr.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
    }).catch(err => { D.buckets.delete(key); throw err; }));
  }
  return D.buckets.get(key);
}
const ensureWord = (lang, word) => loadBucket(lang, bucketOf(lang, word));
const idParts = id => { const p = id.split(':'); return { lang: p[0], lemma: p[1] }; };
async function ensureIds(ids) {
  const need = new Map();
  for (const id of ids) if (!D.byId.has(id)) { const { lang, lemma } = idParts(id); const k = bucketOf(lang, lemma); if (k) need.set(lang + '/' + k, [lang, k]); }
  await Promise.all([...need.values()].map(([l, k]) => loadBucket(l, k).catch(() => {})));
}
function lower(rows, q) { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].k < q) lo = m + 1; else hi = m; } return lo; }
function findLoaded(lang, word) {
  const rows = D.idx[lang], k0 = fold(word), keys = [k0, stripKey(lang, k0)];
  for (const k of keys) {
    const hit = [];
    for (let i = lower(rows, k); i < rows.length && rows[i].k === k; i++) hit.push(rows[i]);
    if (hit.length) {
      hit.sort((a, b) => (a.w === word ? 0 : 1) - (b.w === word ? 0 : 1) || a.a - b.a || a.r - b.r);
      const seen = new Set();
      return hit.filter(x => !seen.has(x.id) && seen.add(x.id)).map(x => D.byId.get(x.id));
    }
  }
  return [];
}
function formRows(lang, word) {
  const rows = D.frows[lang], out = [];
  for (const k of new Set([fold(word), stripKey(lang, fold(word))])) for (let i = lower(rows, k); i < rows.length && rows[i].k === k; i++) out.push(rows[i]);
  return out;
}
/* A typed word can be a dictionary word ("went", an old noun), an inflected form of another word ("went" of go),
   or both. The best match comes first: exact spelling before spelling without accents, frequent tiers before
   rare ones, the word itself before a form, then frequency, then the word class with more translations. */
const TIER = { core: 0, ext: 1, tail: 2 };
const POSR = { verb: 0, noun: 1, adjective: 2, adverb: 3 };
async function find(lang, word) {
  const w = word.trim(), lw = w.toLowerCase(), sk = stripKey(lang, lw);
  // the letter file may be missing offline: then only the words already on this device can be found
  let missing = false;
  const ssw = w.replace(/ß/g, 'ss');               // Swiss spelling: Strasse is Straße
  const loading = Promise.all([ensureWord(lang, sk), sk !== lw ? ensureWord(lang, w) : null].map(p => p && p.catch(() => { missing = true; })));
  // a common word spelled exactly as typed is already on the device: answer at once, the letter file loads meanwhile
  if (!findLoaded(lang, w).some(e => e.tier === 'core' && (e.lemma === w || e.lemma.replace(/ß/g, 'ss') === ssw))) await loading;
  const exact = x => (x === w || x.replace(/ß/g, 'ss') === ssw) ? 0 : (x.toLowerCase() === lw || stripKey(lang, x.toLowerCase()) === sk) ? 1 : 2;
  const cand = new Map();
  const put = (e, ex, isForm) => {
    const nTr = e.senses.reduce((a, s) => a + Object.values(s.translations).reduce((b, l) => b + l.length, 0), 0);
    // a word class with translations into the user's other languages comes before one without (ripe: the adjective, not the rare verb)
    const noTr = e.senses.some(s => S.order.some(l => l !== e.lang && (s.translations[l] || []).length)) ? 0 : 1;
    const key = [ex, TIER[e.tier] || 0, isForm, noTr, e.frequency_rank || 1e9, e.pos_order || 0, -(e.pos_share == null ? 0.5 : e.pos_share), -nTr, POSR[e.pos] == null ? 9 : POSR[e.pos]];     // pos_order: which of several entries with one spelling opens first (build/pos_share.py)
    const old = cand.get(e.id);
    if (!old || cmpKey(key, old.key) < 0) cand.set(e.id, { e, key, isForm });
  };
  for (const e of findLoaded(lang, w)) put(e, exact(e.lemma), 0);
  const fr = formRows(lang, w);
  if (fr.length) {
    await ensureIds(fr.flatMap(r => r.ids));
    for (const r of fr) for (const id of r.ids) {
      const e = D.byId.get(id); if (!e) continue;
      // a modal verb has no -s or participle: "cans" is the plural of the noun, not a form of "can"
      if (e.lang === 'en' && e.verb && e.verb.class === 'modal' && fold(r.w) !== fold(e.verb.principal_parts && e.verb.principal_parts[1] || '')) continue;
      put(e, exact(r.w), 1);
    }
  }
  let list = [...cand.values()].sort((a, b) => cmpKey(a.key, b.key));
  if (list.some(x => x.e.senses.length)) list = list.filter(x => x.e.senses.length);     // an entry with no meaning left is never shown
  if (!list.length && !word.__alt && lang === 'de' && /ae|oe|ue/i.test(w)) {      // Baer, schoen, Muell: ä ö ü typed as ae oe ue
    const alt = Object.assign(new String(w.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/Ae/g, 'Ä').replace(/Oe/g, 'Ö').replace(/Ue/g, 'Ü')), { __alt: 1 });
    if (String(alt) !== w) { const r = await find(lang, alt); if (r.hits.length) return r; }
  }
  if (!list.length && missing) throw new Error('letter file not on this device');
  return { hits: list.map(x => x.e), form: list.length && list[0].isForm ? w : null };
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; }
function suggest(lang, raw, n) {
  const q = stripKey(lang, fold(raw)), out = [], seen = new Set();
  const add = (w, tag, id) => { if (out.length < n && !seen.has(w)) { seen.add(w); out.push({ w, tag, id }); } };
  (recent[lang] || []).filter(w => !q || fold(w).startsWith(q)).forEach(w => { const x = D.ready ? findLoaded(lang, w)[0] : null; add(w, 'recent', x && x.id); });
  if (!D.ready) return out;
  if (!q) { D.top[lang].forEach(x => add(x.w, '', x.id)); return out; }
  const rows = D.idx[lang], c = [];
  for (let i = lower(rows, q); i < rows.length && rows[i].k.startsWith(q) && c.length < 3000; i++) c.push(rows[i]);
  c.sort((a, b) => (a.k === q ? 0 : 1) - (b.k === q ? 0 : 1) || a.r - b.r || a.k.length - b.k.length);
  c.forEach(x => add(x.w, x.a === 2 ? '→ ' + (D.byId.get(x.id) || {}).lemma : '', x.id));
  const fr = D.frows[lang], fc = [];
  for (let i = lower(fr, q); i < fr.length && fr[i].k.startsWith(q) && fc.length < 400; i++) fc.push(fr[i]);
  fc.sort((a, b) => (a.k === q ? 0 : 1) - (b.k === q ? 0 : 1) || a.k.length - b.k.length);
  fc.forEach(x => add(x.w, '→ ' + idParts(x.ids[0]).lemma));
  return out;
}

/* ---------- senses and translations ---------- */
const hiddenRoute = (s, lang) => !!((s.hidden && s.hidden.includes(lang)) || (s.route && s.route[lang] === 'via-en-unchecked'));      // kept in the data, never shown
/* Regional order (data: senses[].regional {id: ["BR"] | ["+CH"] | ["-CH"] | []}, see build/regions.py):
   a word marked for the reader's region comes first if the list also has a word for another region or the marker
   is "+R"; words marked only for other regions (or "-R") come last; the rest keep their order. */
const plainRegions = mk => mk ? mk.filter(x => !/^[+-]/.test(x)) : null;
function regionScore(s, lang, ids) {
  const m = s.regional || {}, R = S.main[lang].toUpperCase();
  const pair = ids.some(t => { const p = plainRegions(m[t]); return p && p.length && !p.includes(R); });
  return t => {
    const mk = m[t]; if (!mk) return 1;
    if (mk.includes('+' + R)) return 0;
    if (mk.includes('-' + R)) return 2;
    const p = plainRegions(mk);
    if (!mk.length) return 2;
    if (!p.length) return 1;
    return p.includes(R) ? (pair ? 0 : 1) : 2;
  };
}
function trIds(s, lang) {
  if (hiddenRoute(s, lang)) return [];
  const ids = (s.translations[lang] || []).filter(id => D.byId.has(id));
  if (!s.regional || ids.length < 2) return ids;
  const sc = regionScore(s, lang, ids), k = new Map(ids.map((t, i) => [t, sc(t) * 1000 + i]));
  return ids.slice().sort((a, b) => k.get(a) - k.get(b));
}
// where a word is used, if only in some regions: from the sense it was reached through, else from the entry
function usedIn(e, s) {
  const p = s && s.regional ? plainRegions(s.regional[e.id]) : null;
  if (p && (p.length || (s.regional[e.id] || []).length === 0)) return p;
  return e.used_in || null;
}
function visibleSenses(e) {
  return e.senses.map((s, i) => ({ s, i })).filter(({ s }) => !(e.lang !== 'de' && hiddenRoute(s, 'de')) && S.order.some(l => l !== e.lang && trIds(s, l).length));
}
const linkedIds = e => [...e.senses.flatMap(s => Object.values(s.translations).flat()), ...(e.synonyms || [])].filter(id => S.order.includes(id.slice(0, id.indexOf(':'))));      // only the languages on screen


/* ---------- state ---------- */
let state = { status: 'loading', msg: 'Loading the dictionary data…', src: { lang: 'de', word: 'stehen' }, entry: null, sense: 0, pick: {}, forms: {}, more: {}, det: {}, panel: {}, others: [], error: '', trail: [], fresh: false };
let seq = 0, commitTimer = 0, typingGen = 0;     // typingGen: a lookup made another way cancels a pending as-you-type lookup
/* opts: live (typed, not yet committed), noRoute (opened from the address), noPlay */
async function openEntry(e, sense, word, form, opts) {
  opts = opts || {};
  const my = ++seq;
  try { await ensureIds(linkedIds(e)); } catch (err) {}
  if (my !== seq) return;
  const vis = visibleSenses(e);
  const si = (sense != null && e.senses[sense]) ? sense : (vis.length ? vis[0].i : 0);
  const same = state.entry === e;
  const trail = state.trail || [];
  state = { status: 'done', src: { lang: e.lang, word: word || e.lemma }, entry: e, sense: si, pick: {}, forms: {}, more: {}, det: {}, panel: {}, others: state.others || [], form: form || null, error: '', trail, fresh: !same };
  clearTimeout(commitTimer);
  if (opts.live) commitTimer = setTimeout(() => commit(e, opts), 2500); else commit(e, opts);
  render();
  if (!same && !opts.noPlay && !opts.live) autoAudio();
}
/* a lookup the reader stayed on: recent words, history, trail, address, "save it?" */
function commit(e, opts) {
  if (state.entry !== e) return;
  recent[e.lang] = [e.lemma, ...(recent[e.lang] || []).filter(x => x !== e.lemma)].slice(0, 8); store.set('flt:recent3', recent);
  P.history = [{ id: e.id, w: e.lemma, t: Date.now() }, ...P.history.filter(h => h.id !== e.id)].slice(0, 300);
  P.last = { id: e.id, sense: state.sense };
  P.looks[e.id] = (P.looks[e.id] || 0) + 1;
  state.trail = [...(state.trail || []).filter(x => x !== e.id), e.id].slice(-8);
  if (window.FLTProgress) FLTProgress.opened(e);
  saveP();
  if (P.looks[e.id] >= 3 && !P.favs[e.id] && !P.offered[e.id]) {
    P.offered[e.id] = 1; saveP();
    toast(t('save.offer', 'You looked up “{w}” {n} times. Save it to your words?', { w: e.lemma, n: P.looks[e.id] }), { label: t('save.yes', '☆ Save'), fn: () => { toggleFav(e); render(false); } });
  }
  if (!opts.noRoute) setRoute(e, state.sense, false);
  if (opts.live) { const s = $('#status .trail'); if (s) render(false); }
}
async function translate(lang, word, opts) {
  opts = opts || {};
  word = cleanTyped(word); if (!word) return;
  if (!opts.live) typingGen++;
  if (!D.ready) { toast(t('msg.loading', 'The dictionary data is still loading.')); return; }
  const my = ++seq;
  let res;
  const slow = opts.live ? 0 : setTimeout(() => { if (my === seq) { const st = $('#status'); if (st) st.innerHTML = `<span>${esc(t('msg.looking', 'Looking up “{w}”…', { w: word }))}</span>`; } }, 200);
  try { res = await find(lang, word); clearTimeout(slow); }
  catch (err) { clearTimeout(slow); if (my === seq && !opts.live) { state = Object.assign({}, state, { status: 'error', error: t('msg.offline', 'The data for this word is not on this device yet. Connect to the internet once to load it.'), near: [] }); render(); } return; }
  if (my !== seq) return;
  if (!res.hits.length) {
    if (opts.live) return;             // while typing, a half word is not an error
    const near = suggest(lang, word.slice(0, Math.max(2, word.length - 2)), 5).map(x => x.w);
    state = Object.assign({}, state, { status: 'error', src: { lang, word }, entry: null, near,
      error: t('msg.notfound', '“{w}” is not in the {lang} data. The app holds {n} {lang} words and forms and makes no entries up.', { w: word, lang: LNAME[lang], n: num(D.count[lang]) }) });
    render(); return;
  }
  state.others = res.hits;
  return openEntry(res.hits[0], null, word, res.form, opts);
}
/* ---------- address of a word: #/de/Tisch or #/de/Tisch/2 (sense). The back button works. ---------- */
function routeOf(e, sense) { return '#/' + e.lang + '/' + encodeURIComponent(e.lemma) + (e.pos ? '~' + e.pos : '') + (sense ? '/' + sense : ''); }
function setRoute(e, sense, replace) {
  const h = routeOf(e, sense);
  if (location.hash === h) return;
  try { history[replace ? 'replaceState' : 'pushState'](null, '', h); } catch (err) {}
}
async function openRoute() {
  const m = /^#\/(en|de|fr|pt|cs|it|es|nl|sv|la)\/([^/]+)(?:\/(\d+))?$/.exec(location.hash || ''); if (!m || !D.ready) return false;
  if (!S.order.includes(m[1])) { try { await setLanguages([...S.order.slice(0, MAX_SLOTS - 1), m[1]]); } catch (err) { return false; } }      // a link to a word in a language that is not on screen (from a word page): bring that language in
  const [w, pos] = decodeURIComponent(m[2]).split('~'), lang = m[1];
  const r = await find(lang, w).catch(() => ({ hits: [] }));
  const hit = r.hits.find(x => x.lemma === w && (!pos || x.pos === pos)) || r.hits[0];
  if (!hit) return false;
  state.others = r.hits;
  await openEntry(hit, m[3] ? +m[3] : null, w, null, { noRoute: true });
  return true;
}
window.addEventListener('popstate', () => { openRoute(); });

function quad() {
  const e = state.entry, s = e.senses[state.sense], q = {}, alts = {};
  q[e.lang] = e;
  for (const l of S.order) {
    if (l === e.lang) continue;
    const ids = s ? trIds(s, l) : [];
    alts[l] = ids;
    q[l] = ids.length ? D.byId.get(ids[Math.min(state.pick[l] || 0, ids.length - 1)]) : null;
  }
  return { q, alts, sense: s };
}

/* ---------- regional view of one entry ---------- */
const ss = s => String(s).replace(/ß/g, 'ss');
const H_ASPIRE = new Set('hache haie haine hall halte hamac hamburger hameau hamster hanche handicap hangar harcèlement hardi harem hareng haricot harpe hasard hâte hausse haut hauteur héros hibou hiérarchie hockey homard honte hoquet hors housse hublot huit hurlement hutte'.split(' '));
function article(lang, e, word, plural) {
  const g = e.noun && e.noun.gender; if (!g || lang === 'cs') return '';          // Czech has no articles
  if (lang === 'de') return plural ? 'die' : ({ m: 'der', f: 'die', n: 'das' }[g] || '');
  if (lang === 'fr') {
    if (plural) return 'les';
    const w = word.toLowerCase();
    if (/^[aeiouyàâéèêîôûœ]/.test(w) || (w[0] === 'h' && !H_ASPIRE.has(w))) return "l'";
    return { m: 'le', f: 'la', 'm/f': 'le/la' }[g] || '';
  }
  if (lang === 'pt') return plural ? ({ m: 'os', f: 'as', 'm/f': 'os/as' }[g] || '') : ({ m: 'o', f: 'a', 'm/f': 'o/a' }[g] || '');
  if (lang === 'es') return plural ? ({ m: 'los', f: 'las', 'm/f': 'los/las' }[g] || '') : ({ m: 'el', f: 'la', 'm/f': 'el/la' }[g] || '');
  if (lang === 'it') {       // il libro, lo studente, l'amico; la casa, l'acqua; plural i/gli, le
    const w = word.toLowerCase(), vow = /^[aeiouàèéìòù]/.test(w), lo = /^(s[^aeiouàèéìòù]|z|gn|ps|pn|x|y|i[aeiou])/.test(w);
    if (g === 'f') return plural ? 'le' : vow ? "l'" : 'la';
    if (g === 'm') return plural ? (vow || lo ? 'gli' : 'i') : vow ? "l'" : lo ? 'lo' : 'il';
    return g === 'm/f' ? (plural ? 'i/le' : 'il/la') : '';
  }
  if (lang === 'nl') return plural ? 'de' : ({ m: 'de', f: 'de', c: 'de', 'm/f': 'de', n: 'het' }[g] || '');
  if (lang === 'sv') return plural ? '' : ({ c: 'en', n: 'ett', m: 'en', f: 'en' }[g] || '');      // en bil, ett hus
  return '';         // Czech and Latin have no articles
}
const withArt = (a, w) => a ? (a.endsWith("'") ? a + w : a + ' ' + w) : w;
/* English verbs are shown with "to" (to go, to walk); modal verbs cannot take it (can, must) */
const MODAL_EN = new Set(['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'cannot', "can't", "couldn't", "mustn't", "shouldn't", "won't", "wouldn't", "shan't", "mayn't", "mightn't", "needn't", "oughtn't", 'can not', 'could not', 'must not', 'should not', 'will not', 'would not', 'may not', 'might not', 'shall not', 'need not', 'ought to']);
// English glosses built automatically sometimes put "to" before modal verbs ("to cannot", "to must") or before words that are not verbs at all.
const GLOSS_JUNK = new Set(['to necessary', 'to allowed', 'to duty', 'to power', 'to be to', 'to owe, to duty']);
function cleanGloss(g) {
  if (!g || !/\bto /.test(g)) return g;
  const parts = g.split(/,\s*/), keepWill = parts.some(p => /^to (bequeath|wish|want|desire|make over)$/.test(p)), keepCan = parts.some(p => /^to (bottle|pack|preserve|tin|jar)$/.test(p));
  const out = [];
  for (let p of parts) {
    if (GLOSS_JUNK.has(p)) continue;
    const m = p.match(/^to (.+)$/);
    if (m && MODAL_EN.has(m[1]) && !(m[1] === 'will' && keepWill) && !(m[1] === 'can' && keepCan)) p = m[1];
    if (!out.includes(p)) out.push(p);
  }
  return out.join(', ') || g;
}
function withTo(id, w) { return w && /^en:/.test(id) && /:verb$/.test(id) && !MODAL_EN.has(w) && !/n['’]t$/i.test(w) && !/^to /i.test(w) ? 'to ' + w : w; }
// Spanish: Wiktionary gives one transcription (Spain: θ for z/ce/ci, ʝ for ll/y). Mexico and Argentina are derived by rule:
// seseo (θ -> s) in both, and in Argentina (Río de la Plata) the ll/y sound is ʃ (sheísmo): calle [ˈkaʃe], yo [ʃo].
function ipaRegional(e) {
  const reg = e.ipa.regional || {};
  if (e.lang !== 'es' || !e.ipa.default) return reg;
  const out = Object.assign({}, reg), d = e.ipa.default, mx = d.replace(/θ/g, 's'), ar = mx.replace(/ɟ͡ʝ|ɟʝ|ʝ/g, 'ʃ');
  if (!out.MX && mx !== d) out.MX = mx;
  if (!out.AR && ar !== d) out.AR = ar;
  return out;
}
// Argentina: vos instead of tú (voseo). Present: hablás, comés, vivís; imperative: hablá, comé, viví.
function voseo(lemma) {
  let w = lemma, pre = '';
  if (/[aei]rse$/.test(w)) { w = w.slice(0, -2); pre = 'te '; }
  const SP = { ser: ['sos', 'sé'], ir: ['vas', 'andá'], haber: ['has', ''], estar: ['estás', 'estate'], dar: ['das', 'da'], ver: ['ves', 've'] };
  if (SP[w]) return [pre + SP[w][0], SP[w][1] && (pre ? SP[w][1] + 'te' : SP[w][1])];
  const m = w.match(/^(.*)([aei])r$/); if (!m) return null;
  const acc = { a: 'á', e: 'é', i: 'í' }[m[2]];
  return [pre + m[1] + acc + 's', pre ? m[1] + acc + 'te' : m[1] + acc];
}
function regionView(e) {
  const lang = e.lang, main = S.main[lang], R = main.toUpperCase(), isBase = main === BASE[lang];
  const v = isBase ? null : (e.regional_variants || []).find(x => x.region === R);
  const o = { word: (v && v.form) || e.lemma, note: v ? v.note : null, changed: !!(v && v.form && v.form !== e.lemma) };
  o.article = o.changed && v.article ? v.article : null;      // Sahne -> der Rahm: the Swiss word has its own gender
  // the same word with another gender in this region (das Tram in Switzerland, die Tram in Germany)
  const gOf = r => (e.noun && e.noun.gender_regional && e.noun.gender_regional[r.toUpperCase()]) || (e.noun && e.noun.gender);
  o.gender = o.article ? ({ der: 'm', die: 'f', das: 'n' }[o.article] || (e.noun && e.noun.gender)) : e.noun ? gOf(main) : null;
  if (!o.article && e.noun && o.gender !== e.noun.gender && lang === 'de') o.article = { m: 'der', f: 'die', n: 'das' }[o.gender] || null;
  const reg = ipaRegional(e);
  o.ipa = (!isBase && reg[R]) || e.ipa.default; o.narrow = !!e.ipa.narrow && o.ipa === e.ipa.default;
  o.ipaFrom = !isBase && !reg[R] && o.ipa ? BASE[lang] : null;     // no transcription of its own: the base region's is shown, and said so
  if (o.changed) { o.ipa = v.ipa || null; o.narrow = false; o.ipaFrom = null; }    // another word: the common word's pronunciation does not fit
  o.aux = e.verb ? ((!isBase && e.verb.aux_regional && e.verb.aux_regional[R]) || e.verb.aux) : null;
  o.plural = (v && v.plural) || (e.noun && !o.changed ? e.noun.plural : null);
  o.word = withTo(e.id, o.word);
  // the other regions, where they differ
  o.accents = []; o.groups = [];
  for (const r of REG[lang]) {
    if (r === main) continue;
    const RR = r.toUpperCase(), base = r === BASE[lang];
    const ip = (!base && reg[RR]) || e.ipa.default;
    if (ip && ip !== o.ipa && !o.changed) { const a = o.accents.find(x => x.ipa === ip); if (a) a.regions.push(r); else o.accents.push({ regions: [r], ipa: ip, narrow: !!e.ipa.narrow && ip === e.ipa.default }); }
    const rv = base ? null : (e.regional_variants || []).find(x => x.region === RR);
    const parts = [];
    const w = (rv && rv.form) || e.lemma;
    const gR = e.noun && e.noun.gender_regional && e.noun.gender_regional[RR];
    const artR = rv && rv.article ? rv.article : gR && lang === 'de' ? { m: 'der', f: 'die', n: 'das' }[gR] : e.noun ? article(lang, e, w) : '';
    if (w !== o.word || (e.noun && lang === 'de' && (gR || e.noun.gender) !== o.gender)) parts.push(withArt(artR, w));
    if (rv && rv.plural && rv.plural !== o.plural) parts.push('pl. ' + rv.plural);
    const ax = e.verb ? ((!base && e.verb.aux_regional && e.verb.aux_regional[RR]) || e.verb.aux) : null;
    if (ax && ax !== o.aux) parts.push('auxiliary ' + ax);
    const note = rv ? rv.note : null;
    if (!parts.length && !note) continue;
    const sig = JSON.stringify([parts, note]), g = o.groups.find(x => x.sig === sig);
    if (g) g.regions.push(r); else o.groups.push({ sig, regions: [r], parts, note });
  }
  return o;
}

/* ---------- tables of forms ---------- */
const PERS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
const CASES = [['nom', 'Nominativ'], ['acc', 'Akkusativ'], ['dat', 'Dativ'], ['gen', 'Genitiv']];
const DE_ART = { m: { nom: 'der', acc: 'den', dat: 'dem', gen: 'des' }, f: { nom: 'die', acc: 'die', dat: 'der', gen: 'der' }, n: { nom: 'das', acc: 'das', dat: 'dem', gen: 'des' }, pl: { nom: 'die', acc: 'die', dat: 'den', gen: 'der' } };
const frJe = w => /^[aeiouyhàâéèêîôûœ]/i.test(w) ? "j'" + w : 'je ' + w;
function canForms(e) {
  const b = e[e.pos]; if (!b || !['noun', 'verb', 'adjective'].includes(e.pos)) return false;
  const multi = /[ '’]/.test(e.lemma);
  if (e.lang === 'cs') return csTables(e).some(x => x.rows.length);
  if (NEWL.includes(e.lang)) return moreTables(e).some(x => x.rows.length);
  if (e.pos === 'verb') return !!b.principal_parts && (e.lang === 'en' || !multi);
  if (e.pos === 'noun') return e.lang === 'de' ? !!(b.gender && (b.genitive || b.plural)) : !!b.plural;
  if (e.lang === 'de') return !multi;
  if (e.lang === 'en') return !!b.comparison;
  return !!b.agreement || !multi;
}
const NEWL = ['it', 'es', 'nl', 'sv', 'la'];
/* Italian, Spanish, Dutch, Swedish, Latin: the forms as Wiktionary gives them (no rules) */
function moreTables(e) {
  const b = e[e.pos] || {}, L = e.lang, sec = (title, rows) => ({ title, rows: rows.filter(r => r && r[1]) });
  if (e.pos === 'noun') {
    if (L === 'la' && b.cases) {
      const N = [['nom', 'nominative'], ['gen', 'genitive'], ['dat', 'dative'], ['acc', 'accusative'], ['abl', 'ablative'], ['voc', 'vocative']];
      return [sec('Cases: singular · plural' + (b.plural_rule ? ' (' + b.plural_rule + ')' : ''), N.map(([k, n]) => b.cases[k] ? [n, [b.cases[k][0], b.cases[k][1]].map(x => x || '—').join(' · '), false] : null))];
    }
    if (L === 'sv' && b.cases) return [sec('Indefinite · definite', [['singular', `${article('sv', e, e.lemma)} ${b.cases.ind[0] || e.lemma} · ${b.cases.def[0] || '—'}`, false], ['plural', `${b.cases.ind[1] || '—'} · ${b.cases.def[1] || '—'}`, false]])];
    return [sec('Number', [['singular', withArt(article(L, e, e.lemma), e.lemma), false], ['plural', b.plural ? withArt(article(L, e, b.plural, true), b.plural) : null, b.plural_regular === false], ...(b.plural_alt || []).map(x => ['also', x, false])])];
  }
  if (e.pos === 'verb') {
    const p = b.principal_parts || [], lab = { it: ['infinitive', 'io (present)', 'participle'], es: ['infinitive', 'yo (present)', 'yo (preterite)', 'participle'], nl: ['infinitive', 'past', 'participle'],
      sv: ['infinitive', 'present', 'preterite', 'supine'], la: ['I … (present)', 'infinitive', 'perfect', 'supine'] }[L];
    const rows = p.map((x, i) => x ? [lab[i] || '', x, b.regular === false && i > 0] : null);
    if (b.present_3sg && L !== 'sv') rows.push([{ it: 'lui/lei', es: 'él/ella', nl: 'hij/zij', la: 'he/she' }[L] || '3rd person', b.present_3sg, false]);
    if (b.aux && ['it', 'nl'].includes(L)) rows.push(['auxiliary', b.aux, false]);
    if (L === 'es' && S.main.es === 'ar') { const v = voseo(e.lemma); if (v) { rows.push(['vos (present, Argentina)', v[0], false]); if (v[1]) rows.push(['vos (imperative, Argentina)', v[1], false]); } }
    return [sec((b.class ? b.class + ': ' : '') + 'principal parts', rows)];
  }
  if (e.pos === 'adjective') {
    const a = b.agreement, T = [];
    const lab = { it: ['masculine', 'feminine', 'masculine plural', 'feminine plural'], es: ['masculine', 'feminine', 'masculine plural', 'feminine plural'], nl: ['base', 'with -e (de-words, plural)'],
      sv: ['en-words', 'ett-words', 'plural / definite'], la: ['masculine', 'feminine', 'neuter'] }[L];
    if (a) T.push(sec('Agreement', a.map((x, i) => [lab[i] || '', x, false])));
    if (b.comparison) T.push(sec('Comparison', [['positive', e.lemma, false], ['comparative', b.comparison[0], false], ['superlative', b.comparison[1], false]]));
    return T;
  }
  return [];
}
function csTables(e) {          // Czech: the forms come from Wiktionary's tables as stored (no rules)
  const b = e[e.pos] || {}, sec = (title, rows) => ({ title, rows: rows.filter(Boolean) });
  if (e.pos === 'noun' && b.cases) {
    const N = [['nom', '1 nominativ (who? what?)'], ['gen', '2 genitiv (of whom?)'], ['dat', '3 dativ (to whom?)'], ['acc', '4 akuzativ (whom? what?)'], ['voc', '5 vokativ (calling)'], ['loc', '6 lokál (about whom?)'], ['ins', '7 instrumentál (with whom?)']];
    return [sec('Pády (cases): singular · plural', N.map(([k, n]) => b.cases[k] ? [n, [b.cases[k][0], b.cases[k][1]].map(x => x || '—').join(' · '), false] : null))];
  }
  if (e.pos === 'verb' && b.conj) {
    const c = b.conj, pr = ['já', 'ty', 'on/ona/ono', 'my', 'vy', 'oni'], T = [];
    if (c.present) T.push(sec(b.class === 'perfective' ? 'Budoucí čas (future: a perfective verb has no present)' : 'Přítomný čas (present)', c.present.map((x, i) => x ? [pr[i], x, false] : null)));
    if (b.class !== 'perfective') T.push(sec('Budoucí čas (future)', [['já', 'budu ' + e.lemma, false], ['on/ona', 'bude ' + e.lemma, false]]));
    if (c.past) T.push(sec('Minulý čas (past)', [c.past.m ? ['on', c.past.m, false] : null, c.past.m ? ['já (man)', c.past.m + ' jsem', false] : null, c.past.f ? ['ona', c.past.f, false] : null, c.past.n ? ['ono', c.past.n, false] : null, c.past.pl ? ['oni', c.past.pl, false] : null]));
    if (c.imperative) T.push(sec('Rozkazovací způsob (commands)', [c.imperative[0] ? ['ty', c.imperative[0] + '!', false] : null, c.imperative[1] ? ['vy', c.imperative[1] + '!', false] : null]));
    return T;
  }
  if (e.pos === 'adjective') {
    const a = b.agreement, T = [];
    if (a) T.push(sec('Shoda (agreement)', [['masculine', a[0], false], ['feminine', a[1], false], ['neuter', a[2], false], a[3] ? ['plural (people)', a[3], false] : null]));
    if (b.comparison) T.push(sec('Stupňování (comparison)', [['positive', e.lemma, false], ['comparative', b.comparison[0], false], ['superlative', b.comparison[1], false]]));
    return T;
  }
  return [];
}
function tables(e, rv) {
  if (e.lang === 'cs') return csTables(e);
  if (NEWL.includes(e.lang)) return moreTables(e);
  const f = FLTForms.forms(e), r = FLTForms.regularForms(e), b = e[e.pos], lang = e.lang, pos = e.pos;
  const stored = b.irregular_forms || {};
  const irr = k => {
    if (f[k] == null) return false;
    if (pos === 'verb') return r[k] != null && f[k] !== r[k];
    if (pos === 'noun') return (k in stored) || (/pl$/.test(k) && b.plural_regular === false);
    if (lang === 'de' || lang === 'en') return (k === 'comp' || k === 'sup') && b.comparison_regular === false;
    return r[k] != null && f[k] !== r[k];
  };
  const row = (label, k, pre, post) => f[k] ? [label, (pre || '') + f[k] + (post || ''), irr(k)] : null;
  const sec = (title, rows) => ({ title, rows: rows.filter(Boolean) });
  const tense = (title, t, pron, wrap) => sec(title, PERS.map((p, i) => f[t + '.' + p] ? [typeof pron[i] === 'function' ? '' : pron[i], wrap ? wrap(f[t + '.' + p], i) : f[t + '.' + p], irr(t + '.' + p)] : null));
  let T = [];
  if (pos === 'verb' && lang === 'de') {
    const pr = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie'];
    const aux = (rv.aux || 'haben').split('/').map(a => a === 'sein' ? 'ist' : 'hat').join('/');
    T = [tense('Präsens (present)', 'praes', pr), tense('Präteritum (simple past)', 'praet', pr),
      sec('Perfekt (perfect)', [f.part2 ? ['er/sie/es', aux + ' ' + f.part2, irr('part2')] : null]),
      tense('Konjunktiv I', 'konj1', pr), tense('Konjunktiv II', 'konj2', pr),
      sec('Imperativ (commands)', [row('du', 'imp.sg', '', '!'), row('ihr', 'imp.pl', '', '!')]),
      sec('Partizipien (participles)', [row('Partizip I', 'part1'), row('Partizip II', 'part2')])];
  } else if (pos === 'noun' && lang === 'de') {
    const g = b.gender;
    T = [sec('Deklination (cases)', [
      ...CASES.map(([c, name]) => f[c + '.sg'] ? [name + ' Sg.', (g && DE_ART[g] ? DE_ART[g][c] + ' ' : '') + f[c + '.sg'], irr(c + '.sg')] : null),
      ...CASES.map(([c, name]) => f[c + '.pl'] ? [name + ' Pl.', DE_ART.pl[c] + ' ' + f[c + '.pl'], irr(c + '.pl')] : null)])];
  } else if (pos === 'adjective' && lang === 'de') {
    const deg = (typ) => sec(typ[1], [['nom', 'Nominativ'], ['gen', 'Genitiv'], ['dat', 'Dativ'], ['acc', 'Akkusativ']].map(([c, name]) =>
      [name, ['m', 'f', 'n', 'pl'].map(x => f['pos.' + typ[0] + '.' + c + '.' + x]).join(' · '), false]));
    T = [sec('Steigerung (comparison)', [['Positiv', e.lemma, false], row('Komparativ', 'comp'), row('Superlativ', 'sup')]),
      deg(['strong', 'Stark: no article (m · f · n · pl)']), deg(['weak', 'Schwach: after der, die, das']), deg(['mixed', 'Gemischt: after ein, kein, mein'])];
    if (b.comparison === null && !stored.comp) T[0].rows = T[0].rows.slice(0, 1);
  } else if (pos === 'verb' && lang === 'en' && b.class === 'modal') {
    const NEG = { can: "cannot / can't", could: "could not / couldn't", may: 'may not', might: "might not / mightn't", must: "must not / mustn't", shall: "shall not / shan't", should: "should not / shouldn't", will: "will not / won't", would: "would not / wouldn't", ought: "ought not to" };
    const to = e.lemma === 'ought' ? ' to' : '';
    T = [sec('Modal verb', [['I / you / he / she / we / they', e.lemma + to + ' go', false], f.past ? ['past and conditional', f.past + ' go', false] : null, NEG[e.lemma] ? ['negative', NEG[e.lemma], false] : null,
      ['', 'No -s, no -ing form, no participle: he ' + e.lemma + to + ', not he ' + e.lemma + 's', false]])];
  } else if (pos === 'verb' && lang === 'en') {
    T = [sec('Forms', [['base form', e.lemma, false], row('he / she / it', '3sg'), row('-ing form', 'ing'), row('past', 'past'), row('past participle', 'pp'), f.pp ? ['perfect', 'has ' + f.pp, irr('pp')] : null])];
  } else if (pos === 'verb' && lang === 'fr') {
    const pr = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];
    const w = (x, i) => i === 0 ? frJe(x) : pr[i] + ' ' + x;
    const que = (x, i) => (i === 0 ? 'que ' + frJe(x) : (i === 2 || i === 5 ? "qu'" : 'que ') + pr[i] + ' ' + x);
    const tt = (title, t, wrap) => sec(title, PERS.map((p, i) => f[t + '.' + p] ? ['', wrap(f[t + '.' + p], i), irr(t + '.' + p)] : null));
    const etre = rv.aux === 'être';
    T = [tt('Présent', 'pres', w), tt('Imparfait', 'impf', w),
      sec('Passé composé', [f.pp ? ['', (etre ? 'je suis ' : "j'ai ") + f.pp + (etre ? '(e)' : ''), irr('pp')] : null]),
      tt('Futur simple', 'fut', w), tt('Conditionnel', 'cond', w), tt('Subjonctif présent', 'subj', que), tt('Passé simple', 'ps', w), tt('Subjonctif imparfait', 'subjimpf', que),
      sec('Impératif', [row('tu', 'imp.2sg', '', ' !'), row('nous', 'imp.1pl', '', ' !'), row('vous', 'imp.2pl', '', ' !')]),
      sec('Participes', [row('présent', 'ppres'), row('passé', 'pp')])];
  } else if (pos === 'verb' && lang === 'pt') {
    const pr = ['eu', 'tu', 'ele/ela/você', 'nós', 'vós', 'eles/elas/vocês'];
    T = [tense('Presente', 'pres', pr), tense('Pretérito perfeito', 'pret', pr), tense('Pretérito imperfeito', 'impf', pr),
      tense('Mais-que-perfeito', 'plup', pr), tense('Futuro do presente', 'fut', pr), tense('Futuro do pretérito (condicional)', 'cond', pr),
      tense('Presente do subjuntivo', 'subj', pr), tense('Imperfeito do subjuntivo', 'subjimpf', pr), tense('Futuro do subjuntivo', 'subjfut', pr),
      tense('Infinitivo pessoal', 'infpers', pr),
      sec('Imperativo', [row('tu', 'imp.2sg'), row('você', 'imp.3sg'), row('nós', 'imp.1pl'), row('vós', 'imp.2pl'), row('vocês', 'imp.3pl')]),
      sec('Formas nominais', [row('infinitivo', 'inf'), row('gerúndio', 'ger'), row('particípio', 'pp')])];
  } else if (pos === 'noun') {
    const pl = b.plural;
    T = [sec(lang === 'en' ? 'Number' : lang === 'fr' ? 'Nombre' : 'Número', [[lang === 'en' ? 'singular' : lang === 'fr' ? 'singulier' : 'singular', withArt(article(lang, e, e.lemma), e.lemma), false],
      pl ? [lang === 'fr' ? 'pluriel' : 'plural', withArt(article(lang, e, pl, true), pl), b.plural_regular === false] : null])];
  } else if (pos === 'adjective' && lang === 'en') {
    T = [sec('Comparison', [['positive', e.lemma, false], row('comparative', 'comp'), row('superlative', 'sup')])];
  } else if (pos === 'adjective') {
    const a = b.agreement || [e.lemma, f['f.sg'], f['m.pl'], f['f.pl']];
    const L = lang === 'fr' ? ['masculin singulier', 'féminin singulier', 'masculin pluriel', 'féminin pluriel'] : ['masculino singular', 'feminino singular', 'masculino plural', 'feminino plural'];
    const K = [null, 'f.sg', 'm.pl', 'f.pl'];
    T = [sec(lang === 'fr' ? 'Accord' : 'Concordância', a.map((x, i) => x ? [L[i], x, !!K[i] && r[K[i]] != null && x !== r[K[i]]] : null))];
  }
  return T.filter(t => t.rows.length);
}


/* ---------- audio: the device's own voices only ---------- */
let voices = [];
try {
  if ('speechSynthesis' in window) { const lv = () => { voices = speechSynthesis.getVoices() || []; if (window.FLTViews) FLTViews.voicesChanged(); }; lv(); speechSynthesis.addEventListener('voiceschanged', lv); }
  else document.documentElement.classList.add('no-audio');
} catch (e) {}
const vlang = v => String(v.lang || '').toLowerCase().replace('_', '-');
function voicesFor(lang) { return voices.filter(v => vlang(v).slice(0, 2) === lang); }
function voiceFor(lang) {
  const loc = LOCALE[lang][S.main[lang]].toLowerCase();
  if (S.voice[lang]) { const v = voices.find(x => x.name === S.voice[lang]); if (v) return v; }
  return voices.find(v => vlang(v) === loc) || voices.find(v => vlang(v).slice(0, 2) === loc.slice(0, 2));
}
let speaking = null, loop = null;
/* o: slow, btn (gets sound waves), onboundary, onend */
function speak(text, lang, o) {
  o = o || {};
  text = String(text || '').replace(/\s*\(.*?\)/g, '').trim(); if (!text) return false;
  try {
    if (!('speechSynthesis' in window)) throw 0;
    const v = voiceFor(lang);
    if (!v && voices.length) { toast(t('audio.novoice', 'No {lang} voice is installed on this device. Settings › Audio shows how to add one.', { lang: LNAME[lang] })); return false; }
    if (!o.queue) { speechSynthesis.cancel(); stopWaves(); }
    const u = new SpeechSynthesisUtterance(text);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = LOCALE[lang][S.main[lang]];
    u.rate = (o.slow || S.slow) ? 0.6 : 0.95;
    if (o.onboundary) u.onboundary = o.onboundary;
    u.onstart = () => { if (o.btn) { o.btn.classList.add('speaking'); speaking = o.btn; } };
    u.onend = u.onerror = () => { if (o.btn) o.btn.classList.remove('speaking'); if (o.onend) o.onend(); };
    speechSynthesis.speak(u);
    return true;
  } catch (e) { toast(t('audio.none', 'This browser cannot read text aloud.')); return false; }
}
function stopWaves() { document.querySelectorAll('.speaking').forEach(b => b.classList.remove('speaking')); document.querySelectorAll('.ex .on').forEach(b => b.classList.remove('on')); }
function speakAll(items) {          // one after the other
  try { speechSynthesis.cancel(); } catch (e) {}
  stopWaves();
  const next = i => { if (i >= items.length) return; const it = items[i]; speak(it.text, it.lang, { queue: true, btn: it.btn, onend: () => setTimeout(() => next(i + 1), 350) }); };
  next(0);
}
function headwords() {
  const { q } = quad();
  return S.order.filter(l => q[l]).map(l => { const rv = regionView(q[l]), art = q[l].pos === 'noun' ? article(l, q[l], rv.word) : ''; return { text: withArt(art, rv.word), lang: l, btn: document.querySelector(`#cards .card[data-lang="${l}"] .hwrow .say`) }; });
}
function autoAudio() {
  if (S.playAll) setTimeout(() => speakAll(headwords()), 300);
  else if (S.autoplay) setTimeout(() => { const h = headwords().find(x => x.lang === state.entry.lang); if (h) speak(h.text, h.lang, { btn: h.btn }); }, 300);
}
function toggleLoop(lang) {
  if (loop === lang) { loop = null; try { speechSynthesis.cancel(); } catch (e) {} stopWaves(); render(false); return; }
  loop = lang; render(false);
  const go = () => { if (loop !== lang || !state.entry) return; const h = headwords().find(x => x.lang === lang); if (!h) { loop = null; return; } speak(h.text, lang, { queue: true, btn: h.btn, onend: () => setTimeout(go, 900) }); };
  try { speechSynthesis.cancel(); } catch (e) {}
  go();
}
/* reads one example sentence and lights up each word as it is spoken (where the voice reports word boundaries) */
function speakExample(li, text, lang, slow) {
  const spans = [...li.querySelectorAll('.w')];
  speak(text, lang, { slow, btn: li.querySelector('.say'), onboundary: ev => {
    if (ev.name && ev.name !== 'word') return;
    let cur = null; for (const s of spans) if (+s.dataset.o <= ev.charIndex) cur = s;
    spans.forEach(s => s.classList.toggle('on', s === cur));
  }, onend: () => spans.forEach(s => s.classList.remove('on')) });
}
const sayBtn = (text, lang, sm, extra) => `<button class="say${sm ? ' sm' : ''}" data-say="${esc(text)}" data-lang="${lang}"${extra || ''} aria-label="${esc(t('audio.listen', 'Listen'))}" title="${esc(t('audio.listen.tip', 'Listen (hold for slow)'))}">${SPEAKER}<i class="wave"></i></button>`;

/* ---------- record yourself and compare ---------- */
let recorder = null;
async function recordCompare(text, lang, btn) {
  if (recorder) { if (recorder.state === 'recording') recorder.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast(t('rec.none', 'This browser cannot record sound.')); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { toast(t('rec.denied', 'The microphone is not allowed. Allow it in the browser to record yourself.')); return; }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  recorder.onstop = () => {
    stream.getTracks().forEach(x => x.stop()); recorder = null; btn.classList.remove('on');
    if (!chunks.length) return;
    const url = URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || 'audio/webm' }));
    toast(t('rec.play', 'First the voice, then you.'));
    speak(text, lang, { onend: () => { const au = new Audio(url); au.onended = () => URL.revokeObjectURL(url); au.play().catch(() => {}); } });
  };
  recorder.start(); btn.classList.add('on');
  toast(t('rec.go', 'Recording… say “{w}”, then tap 🎙 again (stops by itself after 4 seconds).', { w: text }));
  setTimeout(() => { if (recorder && recorder.state === 'recording') recorder.stop(); }, 4000);
}

/* ---------- render ---------- */
const GENDER = { m: 'masculine', f: 'feminine', n: 'neuter', 'm/f': 'masculine or feminine', c: 'common gender' };
const gname = g => t('gender.' + g, GENDER[g] || g);
const gclass = g => ({ m: 'g-m', f: 'g-f', n: 'g-n', 'm/f': 'g-mf', c: 'g-m' }[g] || '');
const artHtml = (a, g) => a ? `<span class="art ${gclass(g)}" title="${esc(gname(g))}">${esc(a)}</span>` : '';
const CASENAME = { Akk: 'Akkusativ', Dat: 'Dativ', Gen: 'Genitiv', Nom: 'Nominativ' };
const gram = (key, label) => FLTLearn.GRAMMAR[key] ? `<button class="gram" data-gram="${key}" aria-label="${esc(t('gram.open', 'Grammar: {t}', { t: FLTLearn.GRAMMAR[key].title }))}" title="${esc(FLTLearn.GRAMMAR[key].title)}">${label || 'ⓘ'}</button>` : '';
const GRAM_TITLES = [[/Präteritum/, 'praeteritum'], [/Konjunktiv/, 'konjunktiv'], [/Perfekt/, 'perfect_de'], [/Deklination/, 'cases'], [/Stark|Schwach|Gemischt/, 'adj_endings'],
  [/Passé composé/, 'fr_passe'], [/Subjonctif/, 'fr_subj'], [/Infinitivo pessoal/, 'pt_infpers'], [/Futuro do subjuntivo/, 'pt_futsubj']];
const badge = r => r === true ? `<span class="reg ok">${esc(t('reg.ok', 'regular'))}</span>` : r === false ? `<span class="reg bad">${esc(t('reg.bad', 'irregular'))}</span>` : '';
const ipaHtml = (ipa, narrow, lang, word) => `<button class="ipa"${word ? ` data-say="${esc(word)}" data-lang="${lang}" title="${esc(t('audio.ipa', 'Tap to hear'))}"` : ''}>${narrow ? '[' : '/'}${esc(ipa)}${narrow ? ']' : '/'}</button>`;
const lemmaOf = id => { const x = D.byId.get(id); return x ? withTo(id, x.lemma) : null; };
const ROW = { usedin: 'Used in', verb: 'Verb', gov: 'Prep. + case', govx: 'Followed by', also: 'Also', gsw: 'Swiss German', elsewhere: 'Elsewhere', gender: 'Gender',
  agree: 'Agreement', compare: 'Compare', freq: 'Frequency', syn: 'Synonyms', ant: 'Opposites', fam: 'Word family', like: 'Words like this', looks: 'Looks like', vars: 'Variants', std: 'Elsewhere' };
const rowName = k => t('row.' + k, ROW[k]);
function wikiLink(lang, word) {
  return `<a href="https://en.wiktionary.org/wiki/${encodeURIComponent(word)}${({ en: '#English', de: '#German', fr: '#French', pt: '#Portuguese' })[lang]}" target="_blank" rel="noopener">Wiktionary</a>`;
}
/* The same example sentences on all four cards, in the same order: each card shows the sentence's own direct
   Tatoeba translation, or a dash where there is none (never a different sentence). Sentences translated into all
   languages come first. */
function exampleList(q) {
  const src = state.entry;
  const donor = (src.examples && src.examples.length) ? src : (q.de && q.de.examples.length ? q.de : Object.values(q).find(x => x && x.examples.length));
  if (!donor) return { donor: null, list: [] };
  let list = donor.examples.slice();
  if (S.level === 'easy') list.sort((a, b) => a.text.length - b.text.length);
  if (S.level === 'advanced') list.sort((a, b) => b.text.length - a.text.length);
  const missing = x => LANGS.filter(l => l.id !== donor.lang && q[l.id] && !(x.translations && x.translations[l.id])).length;
  list = list.map((x, i) => [x, missing(x), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]).slice(0, +S.examples);
  return { donor, list };
}
function formSet(e) {
  const s = new Set([fold(e.lemma)]);
  try { const f = FLTForms.forms(e); for (const k in f) if (f[k]) String(f[k]).split(/[ ,/]+/).forEach(x => x && s.add(fold(x))); } catch (err) {}
  const rv = regionView(e); s.add(fold(rv.word));
  return s;
}
/* a sentence as tappable words; the looked-up word is marked */
function sentenceHtml(text, hl, forms) {
  let out = '', last = 0;
  const re = /\p{L}[\p{L}\p{M}'’-]*/gu; let m;
  while ((m = re.exec(text))) {
    const a = m.index, b = a + m[0].length;
    out += esc(text.slice(last, a));
    const on = hl ? (a < hl[1] && b > hl[0]) : (forms && forms.has(fold(m[0])));
    const w = `<span class="w" data-w="${esc(m[0])}" data-o="${a}">${esc(m[0])}</span>`;
    out += on ? '<mark>' + w + '</mark>' : w;
    last = b;
  }
  return out + esc(text.slice(last));
}
function examplesBlock(lang, ex, e) {
  if (!ex.donor) return (!D.details && state.entry && state.entry.tier === 'core') ? `<p class="note" lang="en">${esc(t('ex.loading', 'Loading example sentences…'))}</p>` : '';
  const items = [], forms = lang === ex.donor.lang ? null : formSet(e);
  for (const x of ex.list) {
    let text, hl = null;
    if (lang === ex.donor.lang) { text = x.text; hl = x.hl; } else text = x.translations && x.translations[lang];
    if (!text) { items.push(`<li class="none" lang="en">— ${esc(t('ex.none', 'no direct translation of this sentence'))}</li>`); continue; }
    const who = x.origin === 'tatoeba' ? 'Tatoeba ' + (lang === ex.donor.lang ? x.id : (x.translation_ids && x.translation_ids[lang]) || x.id).replace('t:', '#') + ((x.credits && x.credits[lang]) ? ' · ' + x.credits[lang] : '') + ' · CC BY 2.0 FR' : t('src.ai', 'Written by AI');
    const eu = lang === 'pt' && x.variant && x.variant.pt === 'PT' && S.main.pt !== 'pt'
      ? `<span class="exvar" title="${esc(t('ex.eu', 'European Portuguese: Tatoeba has no Brazilian translation of this sentence'))}">${flag('pt', true)}</span>` : '';
    items.push(`<li title="${esc(who)}" data-text="${esc(text)}">${eu}${sentenceHtml(text, hl, forms)}${sayBtn(text, lang, true, ' data-ex="1"')}</li>`);
  }
  return items.some(x => !x.includes('class="none"')) ? `<ul class="ex" lang="${lang}">${items.join('')}</ul>` : '';
}
function formsBlock(e, rv) {
  const fs = state.forms[e.lang]; if (!fs || !fs.open) return '';
  const T = tables(e, rv);
  const anyIrr = T.some(x => x.rows.some(r => r[2]));
  return `<div class="forms">${T.map((x, k) => `<section><h3>${esc(x.title)} ${(GRAM_TITLES.find(g => g[0].test(x.title)) || [])[1] ? gram(GRAM_TITLES.find(g => g[0].test(x.title))[1]) : ''}<button class="say sm" data-act="readtable" data-k="${k}" aria-label="${esc(t('forms.read', 'Read this table aloud'))}" title="${esc(t('forms.read', 'Read this table aloud'))}">${SPEAKER}<i class="wave"></i></button></h3><table>${x.rows.map(r => `<tr>${r[0] ? `<th scope="row">${esc(r[0])}</th>` : ''}<td${r[0] ? '' : ' colspan="2"'}${r[2] ? ' class="irr"' : ''}>${r[2] ? '<span class="irr-i" aria-hidden="true">!</span>' : ''}${esc(r[1])}</td></tr>`).join('')}</table></section>`).join('')}</div>${anyIrr ? `<p class="note" lang="en">${esc(t('forms.irr', 'Forms in red with ! are irregular.'))}</p>` : ''}`;
}
function sourcesLine(e, ex, lang) {
  const o = Object.values(e.origin || {}), parts = [];
  if (o.includes('wiktionary')) parts.push('Wiktionary (CC BY-SA 4.0)');
  if (ex.donor && ex.list.some(x => x.origin === 'tatoeba')) parts.push(t('src.tatoeba', 'example sentences from Tatoeba (CC BY 2.0 FR)'));
  const ai = Object.entries(e.origin || {}).filter(([, v]) => v === 'claude').map(([k]) => ({ level: 'level', swiss_german: 'Swiss German form', usage_note: 'note', 'more.learner_mistake': 'common mistake', 'examples.library': 'some sentences', senses: 'a translation link' }[k] || k.replace(/^more\./, '').replace(/_/g, ' ')));
  if (ai.length) parts.push(t('src.aiparts', 'written by AI') + ': ' + [...new Set(ai)].join(', '));
  const lv = levelOf(e); if (lv && lv.est) parts.push(t('src.lvlest', 'level estimated from word frequency'));
  if (o.includes('generated')) parts.push(t('src.rule', 'regular/irregular labels and tables of forms built by rule'));
  if (e.tier && e.tier !== 'core') parts.push(t('src.short', 'short entry: this word has only basic data so far'));
  return parts.length ? `<div><h3>${esc(t('src.title', 'Sources'))}</h3><p>${esc(parts.join('; '))}.</p></div>` : '';
}
function moreBlock(e, ex) {
  const ms = state.more[e.lang]; if (!ms || !ms.open) return '';
  if (!e.more && e.tier === 'core' && !D.details) return `<div class="extra" lang="en"><p>${esc(t('more.loading', 'Loading the background of this word…'))}</p></div>`;
  const d = e.more || {}, lang = e.lang;
  const list = (k, ttl, a) => a && a.length ? `<div><h3>${esc(t(k, ttl))}</h3><ul>${a.map(x => { const [w, g] = String(x).split(' — '); return `<li><b lang="${lang}">${esc(w)}</b>${g ? ` <span lang="${lang === 'de' && ttl === 'Idioms' ? 'de' : 'en'}">· ${esc(g)}</span>` : ''}</li>`; }).join('')}</ul></div>` : '';
  const body = `${d.definition ? `<div><h3>${esc(t('more.def', 'Definition'))}</h3><p>${esc(d.definition)}</p></div>` : ''}
    ${list('more.coll', 'Common combinations', d.collocations)}${list('more.idioms', 'Idioms', d.idioms)}
    ${d.etymology ? `<div><h3>${esc(t('more.origin', 'Origin'))}</h3><p>${esc(d.etymology)}</p></div>` : ''}
    ${d.learner_mistake ? `<div><h3>${esc(t('more.mistake', 'Common mistake'))}</h3><p>${esc(d.learner_mistake)}</p></div>` : ''}`;
  return `<div class="extra" lang="en">${body.trim() ? body : `<p>${esc(t('more.none', 'No background is stored for this word yet.'))}</p>`}${sourcesLine(e, ex, lang)}<p>${window.FLTReport ? window.FLTReport.entryButton(e.id) : ''}</p></div>`;
}
/* the short grammar line under the headword: "der Tisch · die Tische", "geht · ging · ist gegangen" */
const csGender = n => ({ m: n.animate === true ? 'masculine animate' : n.animate === false ? 'masculine inanimate' : 'masculine', f: 'feminine', n: 'neuter' }[n.gender] || '');
function summary(e, rv, art) {
  const lang = e.lang, n = e.noun, v = e.verb, a = e.adjective, parts = [];
  if (e.pos === 'noun' && n) {
    if (lang === 'cs') parts.push(`<span class="form ${gclass(n.gender)}">${esc(csGender(n))}</span>${gram('gender_cs')}`);
    else if (lang === 'la') parts.push(`<span class="form ${gclass(n.gender)}">${esc(gname(n.gender))}</span>${n.genitive ? ` · <span class="sub inl">genitive</span> <span class="form" lang="la">${esc(n.genitive)}</span>` : ''}${gram('cases_la')}`);
    else if (lang !== 'en') parts.push(`${artHtml(art, rv.gender || n.gender)}${art && !art.endsWith("'") ? ' ' : ''}<span class="form">${esc(rv.word)}</span>${gram({ de: 'gender_de', nl: 'gender_nl', sv: 'gender_sv' }[lang] || 'gender_romance')}`);
    if (rv.plural) { const pa = lang === 'en' ? '' : article(lang, e, rv.plural, true); parts.push(`${pa ? `<span class="art g-pl">${esc(pa)}</span> ` : ''}<span class="form">${diffMark(rv.word, rv.plural)}</span>${n.plural_regular === false && !rv.changed ? ' ' + badge(false) : ''}${lang === 'de' ? gram('plural_de') : ''}`); }
    else if (n.plural === null && lang !== 'en' && e.tier === 'core') parts.push(`<span class="sub inl">${esc(t('sum.nopl', 'no plural'))}</span>`);
  } else if (e.pos === 'verb' && v && lang === 'cs') {           // Czech: aspect (and its partner), já-form, past
    const c = v.conj || {};
    if (v.class) parts.push(`<span class="sub inl">${esc(t('cs.asp.' + v.class, v.class))}${v.aspect_pair ? ` · ${esc(t('cs.asp.pair.' + v.class, v.class === 'perfective' ? 'imperfective' : 'perfective'))}: <button class="lnk" data-go="cs:${esc(v.aspect_pair)}" lang="cs">${esc(v.aspect_pair)}</button>` : ''}</span>${gram('aspect_cs')}`);
    if (c.present && c.present[0]) parts.push(`<span class="form">já ${esc(c.present[0])}</span>`);
    if (c.past && c.past.m) parts.push(`<span class="form">on ${esc(c.past.m)}</span>`);
  } else if (e.pos === 'verb' && v) {
    const pp = v.principal_parts;
    if (pp) {
      const base = e.lemma, irr = v.regular === false;
      const diffMark = (a, b, vowels) => irr ? diffMarkRaw(a, b, vowels) : esc(b);
      if (lang === 'de') { const ax = (rv.aux || 'haben').split('/').map(x => x === 'sein' ? 'ist' : 'hat').join('/'); const p2 = pp[2] && pp[2].startsWith('ge') && !base.startsWith('ge') ? 'ge' + diffMark(base, pp[2].slice(2), true) : pp[2] && diffMark(base, pp[2], true); [v.present_3sg && diffMark(base, v.present_3sg, true), pp[1] && diffMark(base, pp[1], true), p2 ? esc(ax) + ' ' + p2 : null].filter(Boolean).forEach(x => parts.push(`<span class="form">${x}</span>`)); }
      else if (lang === 'en' && v.class === 'modal') { if (pp[1]) parts.push(`<span class="form">${esc(pp[1])}</span>`); parts.push(`<span class="sub inl">${esc(t('sum.modal', 'modal verb: no -s, no participle'))}</span>`); }
      else if (lang === 'en') { const f = FLTForms.forms(e); [f['3sg'] && esc(f['3sg']), pp[1] && (irr ? irrForm('en', base, 1, pp[1]) : esc(pp[1])), pp[2] && 'has ' + (irr ? irrForm('en', base, 2, pp[2]) : esc(pp[2]))].filter(Boolean).forEach(x => parts.push(`<span class="form">${x}</span>`)); }
      else if (lang === 'fr') [pp[1] ? esc(frJe(pp[1])) : null, pp[2] ? (rv.aux === 'être' ? 'je suis ' + esc(pp[2]) + '(e)' : "j'ai " + esc(pp[2])) : null].filter(Boolean).forEach(x => parts.push(`<span class="form">${x}</span>`));
      else pp.slice(1).forEach((x, k) => { if (x) parts.push(`<span class="form">${irr ? irrForm(lang, base, k + 1, x) : esc(x)}</span>`); });
    }
    if (rv.aux && (lang === 'de' || lang === 'fr')) parts.push(`<button class="aux"${lang === 'de' ? ' data-gram="perfect_de"' : lang === 'fr' ? ' data-gram="fr_passe"' : ''} title="${esc(t('row.aux', 'Auxiliary'))}">+ ${esc(rv.aux.replace('/', ' / '))}</button>`);
  } else if (e.pos === 'adjective' && a) {
    if (a.comparison) parts.push(`<span class="form">${a.comparison.filter(Boolean).map(x => diffMark(e.lemma, x)).join(' · ')}</span>`);
    else if (a.agreement) parts.push(`<span class="form">${a.agreement.filter(Boolean).map(esc).join(' · ')}</span>`);
  }
  return parts.length ? `<div class="sum" lang="${lang}">${parts.join('<span class="dot"> · </span>')}</div>` : '';
}
/* gender rule from the ending, checked against the data: shown only where it holds for 80 % of the nouns */
const gstat = {};
function genderStats(lang) {
  if (gstat[lang]) return gstat[lang];
  const rules = FLTLearn.GENDER_RULES.filter(r => r[0] === lang), st = rules.map(r => ({ end: r[1], g: r[2], n: 0, ok: 0 }));
  for (const e of D.byId.values()) {
    if (e.lang !== lang || e.pos !== 'noun' || e.tier !== 'core' || !e.noun || !['m', 'f', 'n'].includes(e.noun.gender)) continue;
    const w = e.lemma.toLowerCase();
    for (const s of st) if (w.endsWith(s.end) && w.length > s.end.length + 1) { s.n++; if (e.noun.gender === s.g) s.ok++; }
  }
  return (gstat[lang] = st.filter(s => s.n >= 8 && s.ok / s.n >= 0.8));
}
function genderHint(e) {
  if (e.pos !== 'noun' || !e.noun || !['m', 'f', 'n'].includes(e.noun.gender) || !['de', 'fr', 'pt'].includes(e.lang)) return '';
  const w = e.lemma.toLowerCase(), r = genderStats(e.lang).filter(s => w.endsWith(s.end) && w.length > s.end.length + 1).sort((a, b) => b.end.length - a.end.length)[0];
  if (!r) return '';
  const pct = Math.round(100 * r.ok / r.n), art = { de: { m: 'der', f: 'die', n: 'das' }, fr: { m: 'le', f: 'la' }, pt: { m: 'o', f: 'a' } }[e.lang][r.g];
  if (r.g === e.noun.gender) return `<p class="tip" lang="en">💡 ${t('hint.gender', 'Nouns ending in <b>-{end}</b> are usually {g} ({art}): {p} % of {n} nouns here.', { end: esc(r.end), g: esc(gname(r.g)), art: artHtml(art, r.g), p: pct, n: r.n })}</p>`;
  return `<p class="tip" lang="en">💡 ${t('hint.gender.exc', 'Exception: most nouns ending in <b>-{end}</b> are {g} ({art}, {p} %), this one is not.', { end: esc(r.end), g: esc(gname(r.g)), art: artHtml(art, r.g), p: pct })}</p>`;
}
function falseFriends(e) {
  const mine = new Set([S.speak, ...S.order].filter(Boolean));      // only languages on screen or the one I speak
  return FLTLearn.FALSE_FRIENDS.filter(x => ((x[0] === e.lang && x[1] === e.lemma) && mine.has(x[2])) || ((x[2] === e.lang && x[3] === e.lemma) && mine.has(x[0])))
    .map(x => { const other = x[0] === e.lang ? [x[2], x[3]] : [x[0], x[1]]; return `<p class="warn" lang="en">⚠ ${t('ff.title', 'False friend with {lang} “{w}”.', { lang: esc(LNAME[other[0]]), w: esc(other[1]) })} ${esc(x[4])}</p>`; }).join('');
}
/* verbs with the same vowel change (singen sang gesungen ~ trinken trank getrunken); nouns with the same plural */
const likeCache = {};
const vowelOf = (w, lang) => { let s = String(w || '').toLowerCase(); if (lang === 'de') s = s.replace(/(en|n|t|e|et)$/, ''); const g = s.match(/[aeiouyäöü]+/g); return g ? g[g.length - 1] : ''; };
function likeKey(e) {
  if (e.pos === 'verb' && e.verb && e.verb.principal_parts && e.verb.regular === false) { const p = e.verb.principal_parts; return 'v|' + [p[0], p[1], (p[2] || '').replace(/^ge/, '')].map(x => vowelOf(x, e.lang)).join('-'); }
  if (e.pos === 'noun' && e.noun && e.noun.plural && (e.lang === 'de' || e.noun.plural_regular === false)) {
    const w = e.lemma, p = e.noun.plural, un = s => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
    if (p.startsWith(w)) return 'n|' + e.noun.gender + '|' + p.slice(w.length);
    if (un(p).startsWith(w)) return 'n|' + e.noun.gender + '|¨' + p.slice(w.length);
    return null;
  }
  return null;
}
function likeThis(e) {
  const k = likeKey(e); if (!k) return [];
  const ck = e.lang + k;
  if (!likeCache[ck]) {
    const out = [];
    for (const x of D.byId.values()) if (x.lang === e.lang && x.tier === 'core' && x.pos === e.pos && likeKey(x) === k) out.push(x);
    likeCache[ck] = out.sort((a, b) => (a.frequency_rank || 1e9) - (b.frequency_rank || 1e9));
  }
  return likeCache[ck].filter(x => x !== e).slice(0, 8);
}
function familyOf(e) {
  const out = [], seen = new Set([fold(e.lemma)]);
  for (const w of (e.more && e.more.word_family) || []) { const x = findLoaded(e.lang, String(w).split(' — ')[0])[0]; if (x && !seen.has(fold(x.lemma))) { seen.add(fold(x.lemma)); out.push(x); } if (out.length >= 5) break; }
  const k = fold(e.lemma);
  if (k.length >= 4 && ['noun', 'verb', 'adjective'].includes(e.pos)) {
    for (const r of D.idx[e.lang]) {
      if (out.length >= 10) break;
      if (r.a || r.k === k || !r.k.includes(k) || seen.has(r.k)) continue;
      const x = D.byId.get(r.id); if (!x || x.tier !== 'core' || /\s/.test(x.lemma)) continue;
      seen.add(r.k); out.push(x);
    }
  }
  return out;
}
const chip = (x, cls) => `<button class="chip${cls ? ' ' + cls : ''}" data-id="${esc(x.id)}" lang="${x.lang}">${esc(withTo(x.id, x.lemma))}</button>`;
const isFav = e => !!P.favs[e.id];
function toggleFav(e) { if (P.favs[e.id]) delete P.favs[e.id]; else P.favs[e.id] = { w: e.lemma, t: Date.now() }; saveP(); if (window.FLTProgress) FLTProgress.saved(); }
function card(lang, e, alts, ex, i, q) {
  const l = LANGS.find(x => x.id === lang);
  if (!e) return `<article class="card empty" data-lang="${lang}" style="--i:${i}"><span class="tab">${l.code}</span><p class="note" lang="en">${esc(t('card.none', 'No {lang} translation for this meaning in the data.', { lang: LNAME[lang] }))}</p></article>`;
  const pos = e.pos, rv = regionView(e), n = e.noun, v = e.verb, a = e.adjective;
  const art = pos === 'noun' ? (rv.article || article(lang, e, rv.word)) : '';
  const sn = state.entry && state.entry.senses[state.sense];
  const ess = [], det = [], notes = [];
  // essentials, in the same order on every card
  const ui = usedIn(e, e === state.entry ? null : sn), R = S.main[lang].toUpperCase();
  if (ui && !ui.includes(R)) ess.push(['usedin', ui.length ? ui.map(r => flag(r.toLowerCase(), true) + esc(RNAME[r.toLowerCase()])).join(' &nbsp;') + ` <span class="sub">${esc(t('usedin.not', 'not usual in {r}', { r: RNAME[S.main[lang]] }))}</span>` : `<span class="sub">${esc(t('usedin.other', 'regional (not one of the regions offered here)'))}</span>`]);
  if (v && (v.regular !== null || v.class)) ess.push(['verb', `${badge(v.regular)}${v.regular !== null ? ' ' + gram('irregular_' + lang) : ''}${/separable|trennbar/i.test(v.class || '') ? gram('separable') : ''}${v.class && !['regular', 'irregular'].includes(v.class) ? `<span class="sub">${esc(t('vclass.' + v.class, v.class) + (lang === 'de' ? ' verb' : ''))}</span>` : ''}`]);
  if (e.governs && e.governs.length) ess.push([lang === 'de' ? 'gov' : 'govx',
    `<ul class="gov">${e.governs.map(g => { const cases = g.case ? g.case.split('/') : []; const pat = g.pattern || (e.lemma + (g.prep ? ' ' + g.prep : '')); return `<li><span class="pat">${esc(pat)}</span>${cases.map(c => ` <button class="case c-${esc(c)}" data-gram="cases" title="${esc(CASENAME[c] || c)}">${esc(c)}</button>`).join('')}${g.meaning ? `<span class="sub" lang="en">${esc(g.meaning)}</span>` : ''}</li>`; }).join('')}</ul>`]);
  const chipFlags = id => { const p = sn && sn.regional ? plainRegions(sn.regional[id]) : null; return p && p.length ? p.map(r => flag(r.toLowerCase(), true)).join('') : ''; };
  if (alts && alts.length > 1) ess.push(['also', alts.map((id, k) => D.byId.get(id) === e ? '' : `<button class="chip" data-pick="${lang}:${k}" lang="${lang}">${chipFlags(id)}${esc(lemmaOf(id))}</button>`).join(' ')]);
  if (lang === 'de' && e.standard) {          // a Swiss word: what Germany and Austria say (Velo -> das Fahrrad), on the front of the card
    const gs = [];
    for (const r of REG.de) { if (r === 'ch') continue; const w = e.standard[r.toUpperCase()] || e.standard.DE, g = gs.find(x => x.w === w); if (g) g.r.push(r); else gs.push({ w, r: [r] }); }
    ess.push(['std', gs.map(g => `<div class="stdg">${g.r.map(r => `<span class="nowrap">${flag(r, true)}${esc(RNAME[r])}</span>`).join(' &nbsp;')}: <b class="form nowrap" lang="de">${esc(g.w)}</b></div>`).join('')]);
  }
  if (S.gsw && lang === 'de' && e.swiss_german) ess.push(['gsw', `${flag('ch', true)}<span class="form" lang="gsw">${esc(e.swiss_german.form)}</span><span class="sub" lang="en">${esc(t('gsw.sub', 'spoken dialect'))}${e.swiss_german.approximate ? ', ' + esc(t('gsw.approx', 'spelling is approximate')) : ''}</span>`]);
  // details (folded in compact mode)
  if (rv.accents.length) det.push(['elsewhere', rv.accents.map(x => `<span style="white-space:nowrap;margin-right:10px">${x.regions.map(r => flag(r, true)).join('')}${ipaHtml(x.ipa, x.narrow)}</span>`).join('')]);
  if (n && n.gender && lang !== 'en') det.push(['gender', `${artHtml(art || article(lang, e, e.lemma), n.gender)} <span class="form">${esc(gname(n.gender))}</span>${n.plural_rule ? `<span class="sub">${esc(n.plural_rule)}</span>` : ''}${n.plural_alt && n.plural_alt.length ? `<span class="sub">${esc(t('sum.also', 'also'))}: ${esc(n.plural_alt.join(', '))}</span>` : ''}`]);
  if (a && a.agreement && a.comparison) det.push(['agree', `<span class="form">${esc(a.agreement.filter(Boolean).join(' · '))}</span>`]);
  if (a && a.comparison) det.push(['compare', badge(a.comparison_regular)]);
  const syn = (e.synonyms || []).map(id => D.byId.get(id)).filter(Boolean).slice(0, 8), synT = (e.synonyms_text || []).slice(0, 4);
  if (syn.length || synT.length) det.push(['syn', syn.map(x => chip(x)).join(' ') + synT.map(w => ` <button class="chip" data-go="${lang}:${esc(w)}" lang="${lang}">${esc(w)}</button>`).join('')]);
  const ants = ['adjective', 'adverb', 'verb', 'preposition'].includes(pos) && e.more && e.more.antonyms ? e.more.antonyms.slice(0, 4) : [];
  if (ants.length) det.push(['ant', ants.map(w => `<button class="chip" data-go="${lang}:${esc(w)}" lang="${lang}">↔ ${esc(w)}</button>`).join(' ')]);
  const fam = familyOf(e); if (fam.length) det.push(['fam', fam.map(x => chip(x)).join(' ')]);
  const like = likeThis(e); if (like.length) det.push(['like', like.map(x => chip(x)).join(' ')]);
  const looks = q ? S.order.filter(o => o !== lang && q[o] && ['noun', 'verb', 'adjective', 'adverb'].includes(q[o].pos) && e.lemma.length >= 4 && q[o].lemma.length >= 4 && similar(e.lemma, q[o].lemma) >= 0.6
    && !FLTLearn.FALSE_FRIENDS.some(x => (x[1] === e.lemma && x[3] === q[o].lemma) || (x[3] === e.lemma && x[1] === q[o].lemma))) : [];
  if (looks.length) det.push(['looks', looks.map(o => `<span class="nowrap">${flag(S.main[o], true)}<span lang="${o}">${esc(withTo(q[o].id, q[o].lemma))}</span></span>`).join(' &nbsp;') + `<span class="sub">${esc(t('looks.sub', 'similar word: easier to remember'))}</span>`]);
  const fq = e.level_ch ? null : FLTLearn.freqLabel(e.frequency_rank);
  if (e.level_ch) det.push(['freq', `<span class="form">${esc(t('freq.ch', 'common in Switzerland'))}</span><span class="sub">${esc(t('freq.ch.sub', 'Swiss word. The frequency list (film subtitles) comes from Germany, so it does not show how common it is here.'))}</span>`]);
  if (fq) det.push(['freq', `<span class="form">${esc(t('freq.' + fq, fq))}</span><span class="sub">${esc(t('freq.rank', 'number {n} in the frequency list (film subtitles)', { n: num(e.frequency_rank) }))}</span>`]);
  if (S.variants && rv.groups.length) det.push(['vars', `<ul class="vars">${rv.groups.map(g => `<li><span class="where" lang="en">${g.regions.map(r => flag(r, true) + esc(RNAME[r])).join(' &nbsp;')}</span>${g.parts.length ? `<span class="form">${esc(g.parts.join(' · '))}</span>` : ''}${g.note ? `<span class="sub" lang="en">${esc(g.note)}</span>` : ''}</li>`).join('')}</ul>`]);
  // notes
  notes.push(falseFriends(e));
  notes.push(genderHint(e));
  if (e.usage_note) notes.push(`<p class="note" lang="en"><b>${esc(t('note.note', 'Note'))}</b> ${esc(e.usage_note)}</p>`);
  if (rv.note && S.main[lang] !== BASE[lang]) notes.push(`<p class="note" lang="en"><b>${esc(t('note.in', 'In {r}', { r: RNAME[S.main[lang]] }))}</b> ${esc(rv.note)}</p>`);
  if (P.notes[e.id]) notes.push(`<p class="mynote"><b>${esc(t('note.mine', 'My note'))}</b> ${esc(P.notes[e.id])}</p>`);
  const fs = state.forms[lang], ms = state.more[lang], ds = state.det[lang], pan = state.panel[lang];
  const showDet = !S.compact || (ds && ds.open);
  const rowsHtml = rs => rs.map(([k, y]) => `<dt lang="en">${esc(rowName(k))}</dt><dd>${y}</dd>`).join('');
  const head = withArt(art, rv.word), fav = isFav(e), known = !!P.known[e.id];
  const lv = lvlBadge(e);
  let html = `<article class="card${known ? ' known' : ''}" lang="${LOCALE[lang][S.main[lang]]}" data-id="${esc(e.id)}" data-lang="${lang}" style="--i:${i}">
    <span class="tab">${l.code}</span>
    <div class="hwrow"><button class="star${fav ? ' on' : ''}" data-act="fav" aria-pressed="${fav}" aria-label="${esc(fav ? t('act.unsave', 'Remove from my words') : t('act.save', 'Save to my words'))}" title="${esc(fav ? t('act.unsave', 'Remove from my words') : t('act.save', 'Save to my words'))}">${fav ? '★' : '☆'}</button><h2 class="hw${rv.word.length > 13 ? ' xl' : rv.word.length > 8 ? ' lg' : ''}">${art ? artHtml(art, rv.gender || (n && n.gender)) + (art.endsWith("'") ? '' : ' ') : ''}${esc(rv.word)}</h2>${sayBtn(head, lang)}<button class="loop${loop === lang ? ' on' : ''}" data-act="loop" aria-pressed="${loop === lang}" aria-label="${esc(t('audio.loop', 'Repeat the word'))}" title="${esc(t('audio.loop', 'Repeat the word'))}">⟲</button></div>
    <div class="pron">${rv.ipa ? (rv.ipaFrom ? `<span class="ipafrom" lang="en" title="${esc(t('ipa.from.tip', 'Wiktionary has no separate transcription for {r}; this is the pronunciation of {b}', { r: RNAME[S.main[lang]], b: RNAME[rv.ipaFrom] }))}">${flag(rv.ipaFrom, true)}</span>` : '') + ipaHtml(rv.ipa, rv.narrow, lang, head) + (rv.ipaFrom ? `<span class="sub ipanote" lang="en">${esc(t('ipa.asin', 'as in {b}', { b: RNAME[rv.ipaFrom] }))}</span>` : '') : ''}<span class="pos" lang="en">${esc(t('pos.' + pos, pos))}${n && n.gender ? ' · ' + esc((rv.article && { der: 'm', die: 'f', das: 'n' }[rv.article]) || n.gender) : ''}</span>${lv}${regTag(e === state.entry ? sn : null)}${e.verified ? `<span class="ver" lang="en" title="${esc(t('ver.tip', 'Checked by a person'))}">✓ ${esc(t('ver', 'checked'))}</span>` : ''}</div>
    ${summary(e, rv, art)}
    <div class="acts" lang="en">
      <button class="act${known ? ' on' : ''}" data-act="known" aria-pressed="${known}">${known ? '✓ ' + esc(t('act.known', 'Known')) : esc(t('act.know', 'I know this'))}</button>
      <button class="act${pan === 'note' ? ' on' : ''}" data-act="note">✎ ${esc(t('act.note', 'Note'))}</button>
      <button class="act${pan === 'list' ? ' on' : ''}" data-act="list">＋ ${esc(t('act.list', 'List'))}</button>
      <button class="act" data-act="link">🔗 ${esc(t('act.link', 'Link'))}</button>
      <button class="act talk-b" data-act="talk" title="${esc(t('act.talk.tip', 'Questions, tips and regional notes about this word'))}">💬 ${esc(t('act.talk', 'Discuss'))}<span class="talk-n" data-tn="${esc(e.id)}"></span></button>
      <button class="act rec-b" data-act="record" title="${esc(t('rec.tip', 'Record yourself saying the word, then hear it next to the voice'))}">🎙 ${esc(t('act.record', 'Record me'))}</button>
    </div>
    <div class="cnotes" data-cn="${esc(e.id)}"></div>
    ${pan === 'note' ? `<div class="pan"><textarea id="note-${lang}" rows="3" aria-label="${esc(t('act.note', 'Note'))}">${esc(P.notes[e.id] || '')}</textarea><div class="row"><button class="btn sm" data-act="note-save">${esc(t('btn.save', 'Save'))}</button>${P.notes[e.id] ? `<button class="btn sm" data-act="note-del">${esc(t('btn.delete', 'Delete'))}</button>` : ''}</div></div>` : ''}
    ${pan === 'list' ? `<div class="pan">${P.lists.map((L, k) => `<label class="ck"><input type="checkbox" data-act="list-tog" data-k="${k}"${L.ids.includes(e.id) ? ' checked' : ''}> ${esc(L.name)} <small>${L.ids.length}</small></label>`).join('')}<div class="row"><input class="text" id="newlist-${lang}" placeholder="${esc(t('list.new', 'New list…'))}"><button class="btn sm" data-act="list-new">${esc(t('btn.add', 'Add'))}</button></div></div>` : ''}
    ${ess.length ? `<dl>${rowsHtml(ess)}</dl>` : ''}
    ${det.length && showDet ? `<dl class="det">${rowsHtml(det)}</dl>` : ''}
    ${det.length && S.compact ? `<button class="more" data-extra="det" data-lang="${lang}" aria-expanded="${showDet}">${showDet ? esc(t('det.hide', 'Fewer details')) : esc(t('det.show', 'All details ({n})', { n: det.length }))}</button>` : ''}
    ${canForms(e) ? `<button class="more" data-extra="forms" data-lang="${lang}" lang="en" aria-expanded="${fs && fs.open ? 'true' : 'false'}">${fs && fs.open ? esc(t('forms.hide', 'Hide forms')) : esc(t('forms.show', 'See more forms'))}</button>${formsBlock(e, rv)}` : ''}
    ${examplesBlock(lang, ex, e)}
    ${notes.join('')}
    <button class="more" data-extra="more" data-lang="${lang}" lang="en" aria-expanded="${ms && ms.open ? 'true' : 'false'}">${ms && ms.open ? esc(t('more.hide', 'Hide background')) : esc(t('more.show', 'More about this word'))}</button>${moreBlock(e, ex)}
    ${S.links ? `<div class="links" lang="en">${wikiLink(lang, e.lemma)}</div>` : ''}
  </article>`;
  if (lang === 'de' && S.main.de === 'ch') html = html.replace(/ß/g, 'ss');      // Swiss spelling has no ß
  return html;
}
function regTag(s) { return s && s.register ? `<button class="regtag" data-gram="register" lang="en">${esc(t('regi.' + s.register, s.register))}</button>` : ''; }
function gendersLine(q) {
  if (state.entry.pos !== 'noun') return '';
  const g = ['de', 'fr', 'pt'].filter(l => q[l] && q[l].noun && q[l].noun.gender && q[l].pos === 'noun').map(l => ({ l, g: q[l].noun.gender, a: article(l, q[l], regionView(q[l]).word) }));
  if (g.length < 2) return '';
  const same = g.every(x => x.g === g[0].g);
  return `<span class="genders">${esc(t('st.gender', 'Gender:'))} ${g.map(x => `${flag(S.main[x.l], true)}${artHtml(x.a || x.g, x.g)}`).join(' ')}${same ? '' : ` <small>${esc(t('st.gender.diff', 'differs'))}</small>`}</span>`;
}
function idiomOf(e) {
  const w = state.src && state.src.word; if (!w || state.form || fold(w) === fold(e.lemma) || !e.more || !e.more.idioms) return null;
  const hit = e.more.idioms.map(x => String(x).split(' — ')[0].trim()).find(x => fold(x) === fold(w));
  return hit || null;
}
function render(fill) {
  const st = $('#status'), cards = $('#cards');
  if (state.status === 'loading') {
    st.innerHTML = `<span>${esc(state.msg)}</span>`;
    cards.innerHTML = S.order.map(l => `<article class="card loading" data-lang="${l}"><span class="tab">${l.toUpperCase()}</span><div class="sk big"></div><div class="sk"></div><div class="sk" style="width:80%"></div><div class="sk" style="width:65%"></div></article>`).join('');
    return;
  }
  if (state.status === 'error') {
    st.innerHTML = `<span class="err">${esc(state.error)}</span>` + ((state.near || []).length ? `<span>${esc(t('st.close', 'Close to it:'))}</span>${state.near.map(w => `<button class="chip" data-go="${esc(state.src.lang)}:${esc(w)}">${esc(w)}</button>`).join('')}` : '');
    cards.innerHTML = ''; return;
  }
  const e = state.entry, { q, alts, sense } = quad(), ex = exampleList(q);
  if (fill !== false) LANGS.forEach(l => { const x = q[l.id]; let w = x ? regionView(x).word : ''; if (l.id === 'de' && S.main.de === 'ch') w = ss(w); const inp = $('#in-' + l.id); if (inp && document.activeElement !== inp) inp.value = w; syncClear(l.id); });
  const vis = visibleSenses(e).filter(x => x.i !== state.sense).slice(0, 5);
  const others = (state.others || []).filter(x => x !== e && fold(x.lemma) === fold(e.lemma)).slice(0, 4);      // only words spelled the same (not Fahrrad, found through its Swiss form Velo)
  let srcWord = regionView(e).word; if (e.lang === 'de' && S.main.de === 'ch') srcWord = ss(srcWord);
  const trail = (state.trail || []).filter(id => id !== e.id).slice(-5).map(id => D.byId.get(id)).filter(Boolean);
  st.innerHTML = (state.form && fold(state.form) !== fold(e.lemma) ? `<span>${t('st.form', '<b>{f}</b> is a form of <b>{w}</b>.', { f: esc(state.form), w: esc(srcWord) })}</span>` : '')
    + (idiomOf(e) ? `<span>${t('st.idiom', '“{i}” is an idiom with <b>{w}</b>.', { i: esc(idiomOf(e)), w: esc(srcWord) })}</span>` : '')
    + `<span>${esc(t('st.from', 'From {lang}:', { lang: LNAME[e.lang] }))} <b>${esc(srcWord)}</b>${sense && sense.gloss_en ? ` · ${esc(sense.gloss_en)}` : ''}${regTag(sense)}</span>`
    + `<button class="chip play" data-act="playall" title="${esc(t('st.playall.tip', 'Play the word in all four languages'))}">▶ ${esc(t('st.playall', 'all four'))}</button>`
    + gendersLine(q)
    + (vis.length ? `<span>${esc(t('st.senses', 'Other senses:'))}</span>${vis.map(x => `<button class="chip" data-sense="${x.i}">${esc(x.s.gloss_en || '…')}${x.s.register ? `<small>${esc(t('regi.' + x.s.register, x.s.register))}</small>` : ''}</button>`).join('')}` : '')
    + (others.length ? `<span>${esc(t('st.same', 'Same spelling:'))}</span>${others.map(x => `<button class="chip" data-id="${esc(x.id)}">${esc(withTo(x.id, x.lemma))}<small>${esc(t('pos.' + x.pos, x.pos))}</small></button>`).join('')}` : '')
    + (trail.length ? `<span class="trail">${esc(t('st.trail', 'Back to:'))} ${trail.map(x => `<button class="chip" data-id="${esc(x.id)}" lang="${x.lang}">${esc(withTo(x.id, x.lemma))}</button>`).join('<span class="sep">›</span>')}</span>` : '');
  if (!state.fresh) cards.classList.remove('enter');        // only a new word slides in, not a re-drawn card
  cards.innerHTML = S.order.map((l, i) => card(l, q[l], alts[l], ex, i, q)).join('');
  if (state.fresh && animOn()) { cards.classList.remove('enter'); void cards.offsetWidth; cards.classList.add('enter'); clearTimeout(render.t); render.t = setTimeout(() => cards.classList.remove('enter'), 900); }
  state.fresh = false;
  if (window.FLTViews) FLTViews.afterRender();
  if (window.FLTForum) FLTForum.cards(q);
}

/* ---------- search: one box for any language, and one slot per language ---------- */
function syncClear(lang) { const i = $('#in-' + lang), b = $('#clr-' + lang); if (i && b) b.hidden = !i.value; }
/* a suggestion shows "to swim" when the word is mainly an English verb (the verb opens first) */
const chSpell = (id, w) => (S.main.de === 'ch' && /^de:/.test(id || '')) ? String(w).replace(/ß/g, 'ss') : w;   // Swiss spelling while typing
const typedW = it => chSpell(it.id || (it.lang ? it.lang + ':' : ''), it.w);
function sugLabel(it) {
  if (!it.id || !/^en:/.test(it.id)) return typedW(it);
  if (/:verb$/.test(it.id)) return withTo(it.id, it.w);
  const v = D.byId.get('en:' + it.w + ':verb'), me = D.byId.get(it.id);
  return v && (v.pos_share == null ? !(me && me.frequency_rank === v.frequency_rank) : v.pos_share > 0.5) ? withTo(v.id, it.w) : it.w;
}
function suggestHtml(it, lang) {
  const e = it.id ? D.byId.get(it.id) : null;
  const art = e && e.pos === 'noun' ? article(e.lang, e, e.lemma) : '';
  return `${lang ? flag(S.main[lang], true) : ''}${art ? `<span class="art ${gclass(e.noun.gender)}">${esc(art)}</span> ` : ''}${esc(sugLabel(it))}${e ? lvlBadge(e, true) : ''}${it.tag ? `<small>${esc(it.tag === 'recent' ? t('sg.recent', 'recent') : it.tag)}</small>` : ''}`;
}
/* the input behaviour shared by the slots and the any-language box */
function wireInput(input, list, cfg) {
  let sel = -1, items = [], timer = 0;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; };
  const paint = () => { [...list.children].forEach((li, i) => { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); if (i === sel) li.scrollIntoView({ block: 'nearest' }); }); };
  const open = () => {
    items = cfg.items(input.value);
    if (!items.length || (items.length === 1 && fold(items[0].w) === fold(input.value))) { close(); return; }
    list.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}">${suggestHtml(it, it.lang && cfg.flags ? it.lang : null)}</li>`).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); sel = -1;
  };
  const pick = it => { input.value = typedW(it); close(); cfg.go(it); };
  input.addEventListener('input', () => {
    open(); if (cfg.after) cfg.after();
    const v = input.value;
    clearTimeout(timer);
    if (D.ready && v.trim()) {
      Promise.all(cfg.langs().map(l => ensureWord(l, stripKey(l, fold(v))).catch(() => {}))).then(() => { if (document.activeElement === input && input.value === v) open(); });
      const gen = typingGen;
      timer = setTimeout(() => { if (gen === typingGen && input.value === v && cleanTyped(v).length >= 2) cfg.live(cleanTyped(v)); }, 450);     // results as you type
    }
  });
  input.addEventListener('paste', ev => {          // pasted text: spaces and punctuation around the word removed
    const s = (ev.clipboardData || window.clipboardData).getData('text'); if (s == null) return;
    ev.preventDefault();
    const c = cleanTyped(s), a = input.selectionStart, b = input.selectionEnd;
    input.value = input.value.slice(0, a) + c + input.value.slice(b);
    input.dispatchEvent(new Event('input'));
  });
  input.addEventListener('focus', open);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' && !list.hidden) { ev.preventDefault(); sel = (sel + 1) % items.length; paint(); }
    else if (ev.key === 'ArrowUp' && !list.hidden) { ev.preventDefault(); sel = (sel - 1 + items.length) % items.length; paint(); }
    else if (ev.key === 'Escape') { if (!list.hidden) close(); else input.blur(); }
    else if (ev.key === 'Enter' || ev.keyCode === 13) { ev.preventDefault(); enter(); }
  });
  /* Enter opens the selected or the top suggestion. Phone keyboards often send no Enter key while a word is being
     typed, only a form submission, so the form's submit does the same. */
  async function enter() {
    clearTimeout(timer);
    const v = cleanTyped(input.value);
    if (v) items = cfg.items(input.value);
    const exact = items.find(it => fold(it.w) === fold(v)), chosen = sel >= 0 && !list.hidden ? items[sel] : null;
    close();
    let it = chosen || exact;
    if (!it && v) {      // a word that exists as typed (Rahm) wins over the first suggestion (Rahmen); a part of a word (Kartof) opens the suggestion
      const real = (await Promise.all(cfg.langs().map(l => find(l, v).catch(() => ({ hits: [] }))))).some(r => r.hits.some(h => fold(h.lemma) === fold(v)));
      it = real ? { w: v } : (items[0] || { w: v });
    }
    if (!it) it = items[0] || null;
    if (!it) return;
    input.value = typedW(it); cfg.go(it);
    if (matchMedia('(pointer: coarse)').matches) input.blur();      // on a phone: close the keyboard so the cards show
  }
  input.closest('form').addEventListener('submit', ev => { ev.preventDefault(); enter(); });
  list.addEventListener('mousedown', ev => { const li = ev.target.closest('li'); if (li) { ev.preventDefault(); pick(items[+li.dataset.i]); } });
}
function buildSlots() {
  const order = S.order.map(id => LANGS.find(l => l.id === id));
  $('#slots').innerHTML = order.map((l, k) => `
   <div class="slot" data-lang="${l.id}" style="--i:${k}">
     <div class="slot-head"><span id="flag-${l.id}" class="fl">${flag(S.main[l.id])}</span><select class="lang-pick" id="lp-${l.id}" aria-label="${esc(t('slot.lang', 'Language of this box'))}">${dataLangs().map(x => `<option value="${x}"${x === l.id ? ' selected' : ''}>${esc(betaName(x))}</option>`).join('')}</select><kbd class="key" title="${esc(t('kb.slot', 'Press {n} to jump here', { n: k + 1 }))}">${k + 1}</kbd>
       <select id="var-${l.id}" aria-label="${esc(t('slot.variant', 'Main variant of {lang}', { lang: LNAME[l.id] }))}">${REG[l.id].map(r => `<option value="${r}"${r === S.main[l.id] ? ' selected' : ''}>${esc(RNAME[r])}</option>`).join('')}</select>
     </div>
     <form class="field" autocomplete="off">
       <input id="in-${l.id}" type="text" placeholder="${esc(t('ph.' + l.id, l.ph))}" aria-label="${esc(t('slot.word', '{lang} word', { lang: LNAME[l.id] }))}" role="combobox" aria-expanded="false" aria-controls="sg-${l.id}" autocapitalize="off" spellcheck="false" lang="${l.id}">
       <button type="button" class="clr" id="clr-${l.id}" aria-label="${esc(t('slot.clear', 'Clear'))}" hidden>×</button>
       ${SR ? `<button type="button" class="mic" id="mic-${l.id}" aria-label="${esc(t('mic', 'Speak a word'))}" title="${esc(t('mic', 'Speak a word'))}">🎤</button>` : ''}
     </form>
     ${CHARS[l.id] ? `<div class="chars" id="chars-${l.id}" hidden>${CHARS[l.id].map(c => `<button type="button" data-ch="${c}" tabindex="-1">${c}</button>`).join('')}</div>` : ''}
     <ul class="sugg" id="sg-${l.id}" role="listbox" hidden></ul>
     <span class="count" id="cnt-${l.id}">${D.ready ? esc(t('slot.count', '{n} words', { n: num(D.count[l.id]) })) : '&nbsp;'}</span>
   </div>`).join('');
  order.forEach(l => {
    const input = $('#in-' + l.id), list = $('#sg-' + l.id);
    $('#lp-' + l.id).addEventListener('change', ev => {         // another language in this box; if it is already in another box, the two swap
      const o = S.order.slice(), i = o.indexOf(l.id), v = ev.target.value, j = o.indexOf(v);
      if (j >= 0) o[j] = l.id; o[i] = v; setLanguages(o);
    });
    $('#var-' + l.id).addEventListener('change', ev => {
      S.main[l.id] = ev.target.value; saveSettings();
      const fl = $('#flag-' + l.id); fl.innerHTML = flag(S.main[l.id]);
      if (animOn()) { fl.classList.remove('flip'); void fl.offsetWidth; fl.classList.add('flip'); }
      if (state.status === 'done') render();
      sszKey();
    });
    $('#clr-' + l.id).addEventListener('click', () => { input.value = ''; syncClear(l.id); input.focus(); });
    input.addEventListener('input', () => syncClear(l.id));
    wireInput(input, list, {
      langs: () => [l.id],
      items: v => suggest(l.id, v, +S.sugg),
      go: it => translate(l.id, it.w),
      live: v => translate(l.id, v, { live: true })
    });
    const bar = $('#chars-' + l.id);
    if (bar) {          // special characters under the box while typing
      sszKey();
      input.addEventListener('focus', () => { bar.hidden = false; });
      input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) bar.hidden = true; }, 150));
      bar.addEventListener('mousedown', ev => {
        const b = ev.target.closest('[data-ch]'); if (!b) return; ev.preventDefault();
        const a = input.selectionStart, z = input.selectionEnd; input.value = input.value.slice(0, a) + b.dataset.ch + input.value.slice(z);
        input.setSelectionRange(a + 1, a + 1); input.dispatchEvent(new Event('input'));
      });
    }
    const mic = $('#mic-' + l.id);
    if (mic) mic.addEventListener('click', () => {          // voice input
      try {
        const r = new SR(); r.lang = LOCALE[l.id][S.main[l.id]]; r.interimResults = false; r.maxAlternatives = 1;
        mic.classList.add('on');
        r.onresult = ev => { const w = cleanTyped(ev.results[0][0].transcript); input.value = w; syncClear(l.id); translate(l.id, w); };
        r.onerror = ev => toast(t('mic.err', 'Voice input did not work ({e}).', { e: ev.error || '?' }));
        r.onend = () => mic.classList.remove('on');
        r.start();
      } catch (err) { mic.classList.remove('on'); toast(t('mic.none', 'This browser cannot listen to speech.')); }
    });
  });
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
function sszKey() { document.querySelectorAll('#chars-de [data-ch="ß"]').forEach(b => { b.hidden = S.main.de === 'ch'; }); }   // no ß key in Swiss German
const CHARS = { de: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'], fr: ['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ï', 'ô', 'û', 'ù', 'ç', 'œ'], pt: ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'], cs: ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'],
  it: ['à', 'è', 'é', 'ì', 'ò', 'ù'], es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'], nl: ['é', 'ë', 'ï', 'ij'], sv: ['å', 'ä', 'ö'], la: ['ā', 'ē', 'ī', 'ō', 'ū'] };
/* any-language box: suggestions from all four languages; the language is the one that has the word */
function anySuggest(v) {
  const q = stripKey('en', fold(v)); if (!q) return [];
  const out = [];
  for (const l of S.order) for (const it of suggest(l, v, 5)) if (it.tag !== 'recent') out.push(Object.assign({ lang: l, ex: fold(it.w) === q ? 0 : 1 }, it));
  const rk = it => { const e = it.id && D.byId.get(it.id); return e && e.frequency_rank || 1e9; };
  return out.sort((a, b) => a.ex - b.ex || rk(a) - rk(b) || S.order.indexOf(a.lang) - S.order.indexOf(b.lang)).slice(0, +S.sugg);
}
async function detect(v) {        // which language has this word? the reader's order breaks ties
  await Promise.all(S.order.map(l => ensureWord(l, stripKey(l, fold(v))).catch(() => {})));
  let best = null;
  for (const l of S.order) {
    const r = await find(l, v).catch(() => ({ hits: [] }));
    const h = r.hits[0]; if (!h) continue;
    const exact = h.lemma === v ? 0 : fold(h.lemma) === fold(v) ? 1 : 2;
    const key = [exact, TIER[h.tier] || 0, h.frequency_rank || 1e9];
    if (!best || cmpKey(key, best.key) < 0) best = { l, key };
  }
  return best && best.l;
}
function buildAny() {
  const input = $('#in-any'), list = $('#sg-any');
  wireInput(input, list, {
    flags: true,
    langs: () => S.order,
    items: anySuggest,
    after: () => { $('#clr-any').hidden = !input.value; },
    go: async it => { const l = it.lang || await detect(it.w); if (l) translate(l, it.w); else toast(t('any.none', '“{w}” is in none of the four languages here.', { w: it.w })); },
    live: async v => { const l = await detect(v); if (l && input.value.trim() === v) translate(l, v, { live: true }); }
  });
  $('#clr-any').addEventListener('click', () => { input.value = ''; $('#clr-any').hidden = true; input.focus(); });
}
function paintRecent() {
  const el = $('#recent-any'); if (!el) return;
  const h = P.history.slice(0, 8);
  el.innerHTML = h.length ? `<span>${esc(t('any.recent', 'Recent:'))}</span>` + h.map(x => `<button class="chip" data-open="${esc(x.id)}" lang="${x.id.slice(0, 2)}">${flag(S.main[x.id.slice(0, 2)], true)}${esc(withTo(x.id, x.w))}</button>`).join('') : '';
}
async function openId(id, sense) {
  if (!D.byId.has(id)) await ensureIds([id]);
  const e = D.byId.get(id); if (!e) { toast(t('msg.offline', 'The data for this word is not on this device yet. Connect to the internet once to load it.')); return; }
  state.others = findLoaded(e.lang, e.lemma); await openEntry(e, sense);
  const top = $('#slots'); if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: animOn() ? 'smooth' : 'auto' });
}
/* word of the day: a word of the language being learned, at the reader's level, the same all day */
/* words that should never be the word of the day: vulgar, offensive, sexual or crude (by their labels or their English meaning) */
const RUDE_REG = /vulgar|offensive|derogatory|slang|euphemistic/;
const RUDE_GLOSS = /\b(boob|boobs|tits?|titty|breasts?|nipples?|penis|dick|cock|prick|vagina|pussy|cunt|vulva|testicles?|balls|scrotum|butt|buttocks|arse|ass|arsehole|asshole|bum|anus|fuck\w*|shit\w*|crap|piss\w*|fart\w*|turd|poo|bitch\w*|bastard|whore|slut|hooker|prostitut\w*|sex\w*|erotic|horny|naked|nude|condom|orgasm|masturbat\w*|rape|drunk|idiot|stupid|moron|dumb|damn\w*|bloody|hell|kill\w*|murder\w*|suicide|corpse|vomit\w*|puke|diarrh\w*|excrement|faeces|feces|urine|urinate|drugs?|cocaine|heroin|weed|nazi\w*)\b/i;
function unsuitable(e) {
  return (e.senses || []).some(s => (s.register && RUDE_REG.test(s.register)) || RUDE_GLOSS.test(s.gloss_en || ''));
}
function wordOfDay() {
  const lang = S.learning || (S.order[1] || 'de'), lv = S.myLevel;
  const c = [];
  for (const r of D.idx[lang]) { if (r.a) continue; const e = D.byId.get(r.id); if (e && e.tier === 'core' && ['noun', 'verb', 'adjective'].includes(e.pos) && !P.known[e.id] && !unsuitable(e)) { const x = levelOf(e); if (x && x.l === lv) c.push(e); } }
  if (!c.length) return null;
  c.sort((a, b) => a.id < b.id ? -1 : 1);
  const day = Math.floor(Date.now() / 864e5);
  return c[(day * 2654435761 >>> 0) % c.length];
}
function paintWotd() {
  const el = $('#wotd'); if (!el || !D.ready) return;
  const e = wordOfDay();
  el.innerHTML = e ? `<span>${esc(t('wotd', 'Word of the day'))} ${lvlBadge(e, true)}</span><button class="chip" data-open="${esc(e.id)}" lang="${e.lang}">${flag(S.main[e.lang], true)}${e.pos === 'noun' ? artHtml(article(e.lang, e, e.lemma), e.noun && e.noun.gender) + ' ' : ''}${esc(withTo(e.id, e.lemma))}</button>` : '';
}

/* ---------- display settings: theme, text size, motion ---------- */
function applyDisplay() {
  const r = document.documentElement;
  if (S.theme === 'system') delete r.dataset.theme; else r.dataset.theme = S.theme;
  r.style.setProperty('--zoom', String((+S.textSize || 100) / 100));
  r.classList.toggle('anim', animOn());
  r.classList.toggle('compact', !!S.compact);
  r.classList.toggle('nogcolor', !S.gcolor);
  r.lang = S.ui;
}
function applyTexts() {         // the fixed texts of the page, in the interface language
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t, el.dataset.en || (el.dataset.en = el.textContent)); });
  document.querySelectorAll('[data-tph]').forEach(el => { el.placeholder = t(el.dataset.tph, el.dataset.enph || (el.dataset.enph = el.placeholder)); });
  document.querySelectorAll('[data-tal]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tal, el.dataset.enal || (el.dataset.enal = el.getAttribute('aria-label')))); });
}

/* ---------- clicks ---------- */
document.addEventListener('click', ev => {
  const g = ev.target.closest('[data-gram]'); if (g && window.FLTViews) { ev.stopPropagation(); FLTViews.grammar(g.dataset.gram); return; }
  const o = ev.target.closest('[data-open]'); if (o) { openId(o.dataset.open); return; }
  const gw = ev.target.closest('.panel [data-go], #explore [data-go]');     // a word link in a page (False friends): look it up
  if (gw) { const i = gw.dataset.go.indexOf(':'); translate(gw.dataset.go.slice(0, i), gw.dataset.go.slice(i + 1)); const c = $('#cards'); if (c) setTimeout(() => c.scrollIntoView({ behavior: animOn() ? 'smooth' : 'auto', block: 'start' }), 300); return; }
}, true);
$('#status').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'playall') { speakAll(headwords()); return; }
  if (b.dataset.go) { const i = b.dataset.go.indexOf(':'); translate(b.dataset.go.slice(0, i), b.dataset.go.slice(i + 1)); }
  else if (b.dataset.sense) { state.sense = +b.dataset.sense; state.pick = {}; setRoute(state.entry, state.sense, true); render(); }
  else if (b.dataset.id) openId(b.dataset.id);
});
let pressTimer = 0, longPressed = null;          // the speaker that was just held down: the click ending that press is ignored
$('#cards').addEventListener('pointerdown', ev => {          // hold the speaker: slow
  const s = ev.target.closest('.say[data-say]'); if (!s) return;
  longPressed = null; clearTimeout(pressTimer);
  pressTimer = setTimeout(() => { longPressed = s; sayFrom(s, true); setTimeout(() => { if (longPressed === s) longPressed = null; }, 1500); }, 500);     // the click that ends this press is ignored, not a later one
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(k => $('#cards').addEventListener(k, () => clearTimeout(pressTimer)));
function sayFrom(s, slow) {
  if (s.dataset.ex) { const li = s.closest('li'); speakExample(li, li.dataset.text, s.dataset.lang, slow); }
  else speak(s.dataset.say, s.dataset.lang, { slow, btn: s.classList.contains('say') ? s : null });
}
$('#cards').addEventListener('contextmenu', ev => { if (ev.target.closest('.say')) ev.preventDefault(); });
$('#cards').addEventListener('click', ev => {
  const cardEl = ev.target.closest('.card'), e = cardEl && D.byId.get(cardEl.dataset.id), lang = cardEl && cardEl.dataset.lang;
  const s = ev.target.closest('[data-say]'); if (s) { if (longPressed === s) { longPressed = null; return; } sayFrom(s, false); return; }
  const w = ev.target.closest('.ex .w'); if (w) { translate(lang, w.dataset.w); return; }        // tap a word of a sentence
  const p = ev.target.closest('[data-pick]'); if (p) { const [l, i] = p.dataset.pick.split(':'); state.pick[l] = +i; render(); return; }
  const g = ev.target.closest('[data-go]'); if (g) { const i = g.dataset.go.indexOf(':'); translate(g.dataset.go.slice(0, i), g.dataset.go.slice(i + 1)); return; }
  const c = ev.target.closest('.chip[data-id]'); if (c) { openId(c.dataset.id); return; }
  const b = ev.target.closest('[data-extra]');
  if (b) { const k = b.dataset.extra, l = b.dataset.lang, cur = state[k][l] || (state[k][l] = { open: false }); cur.open = !cur.open; render(false); return; }
  const a = ev.target.closest('[data-act]'); if (!a || !e) return;
  const act = a.dataset.act;
  if (act === 'fav') { toggleFav(e); render(false); if (animOn()) { const st = document.querySelector(`#cards .card[data-lang="${lang}"] .star`); if (st) st.classList.add('pop'); } toast(isFav(e) ? t('fav.added', 'Saved to your words.') : t('fav.removed', 'Removed from your words.')); }
  else if (act === 'known') { const was = !!P.known[e.id]; if (was) delete P.known[e.id]; else P.known[e.id] = { w: e.lemma, t: Date.now() }; saveP(); render(false);
    const c = window.FLTProgress && FLTProgress.levelCount ? FLTProgress.levelCount(e) : null;
    toast(was ? t('known.off', '“{w}” is no longer marked as known.', { w: e.lemma }) : c ? t('known.on.lvl', '✓ “{w}” marked as known. {lang} {lvl}: {k} of {n} words.', { w: e.lemma, lang: LNAME[e.lang], lvl: c.lvl, k: num(c.k), n: num(c.n) }) : t('known.on', '✓ “{w}” marked as known.', { w: e.lemma }), { label: t('nav.progress', 'Progress'), fn: () => { const b = $('#progress-toggle'); if (b && $('#progress').hidden) b.click(); const pg = $('#progress'); if (pg) pg.scrollIntoView({ behavior: 'smooth' }); } }); if (window.FLTProgress) { FLTProgress.saved(); const pg = $('#progress'); if (pg && !pg.hidden) FLTProgress.paint(); } }
  else if (act === 'talk') { if (window.FLTForum) FLTForum.openWord(e); }
  else if (act === 'note' || act === 'list') { state.panel[lang] = state.panel[lang] === act ? null : act; render(false); const f = $(act === 'note' ? '#note-' + lang : '#newlist-' + lang); if (f && act === 'note') f.focus(); }
  else if (act === 'note-save') { const v = $('#note-' + lang).value.trim(); if (v) P.notes[e.id] = v; else delete P.notes[e.id]; saveP(); state.panel[lang] = null; render(false); }
  else if (act === 'note-del') { delete P.notes[e.id]; saveP(); state.panel[lang] = null; render(false); }
  else if (act === 'list-new') { const inp = $('#newlist-' + lang), name = inp.value.trim(); if (!name) return; let L = P.lists.find(x => x.name === name); if (!L) P.lists.push(L = { name, ids: [], w: {} }); if (!L.ids.includes(e.id)) { L.ids.push(e.id); L.w = L.w || {}; L.w[e.id] = e.lemma; } saveP(); render(false); toast(t('list.added', 'Added to “{l}”.', { l: name })); }
  else if (act === 'link') { const url = location.href.split('#')[0] + routeOf(e, null); try { navigator.clipboard.writeText(url).then(() => toast(t('link.copied', 'Link copied: {u}', { u: url })), () => toast(url)); } catch (err) { toast(url); } }
  else if (act === 'loop') toggleLoop(lang);
  else if (act === 'record') { const rv = regionView(e); recordCompare(withArt(e.pos === 'noun' ? (rv.article || article(lang, e, rv.word)) : '', rv.word), lang, a); }
  else if (act === 'readtable') {
    const T = tables(e, regionView(e)), x = T[+a.dataset.k]; if (!x) return;
    const lab = r => r[0] && /^[\p{Ll}/ ]+$/u.test(r[0]) && r[0].length < 20 ? r[0] + ' ' : '';
    speakAll(x.rows.map((r, i) => ({ text: lab(r) + r[1], lang: e.lang, btn: i === 0 ? a : null })));
  }
});
$('#cards').addEventListener('change', ev => {
  const a = ev.target.closest('[data-act="list-tog"]'); if (!a) return;
  const cardEl = a.closest('.card'), e = D.byId.get(cardEl.dataset.id), L = P.lists[+a.dataset.k]; if (!e || !L) return;
  if (a.checked) { if (!L.ids.includes(e.id)) L.ids.push(e.id); L.w = L.w || {}; L.w[e.id] = e.lemma; } else L.ids = L.ids.filter(x => x !== e.id);
  saveP();
});
/* keyboard: / any-language box, 1-4 the slots, Esc leaves a box, ? the list of keys */
document.addEventListener('keydown', ev => {
  const tag = (ev.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === '/') { ev.preventDefault(); $('#in-any').focus(); }
  else if (/^[1-4]$/.test(ev.key)) { const l = S.order[+ev.key - 1]; ev.preventDefault(); const i = $('#in-' + l); i.focus(); i.select(); }
  else if (ev.key === '?') toast(t('kb.help', 'Keys: / search in any language · 1–4 jump to a language · Enter open the top suggestion · Esc leave the box'));
  else if (ev.key === 'Escape' && window.FLTViews) FLTViews.closePanels();
});

/* ---------- boot ---------- */
function paintCounts() { S.order.forEach(l => { const el = $('#cnt-' + l); if (el) el.textContent = t('slot.count', '{n} words', { n: num(D.count[l]) }); }); }
function paintTotal() {
  const el = $('#lex-total'); if (!el) return;
  const ls = dataLangs().filter(l => D.count[l]);
  el.textContent = t('foot.total', '{n} words and forms, {e} entries:', { n: num(ls.reduce((a, l) => a + D.count[l], 0)), e: num(ls.reduce((a, l) => a + D.entries[l], 0)) }) + ' ' + ls.map(l => `${LNAME[l]} ${num(D.entries[l])}`).join(', ') + '.';
}
/* Settings › My languages: 2 to 4 boxes, any of the app's languages, in this order */
async function setLanguages(order) {
  const o = cleanOrder(order.filter(l => dataLangs().includes(l)));
  for (const l of o) if (!D.loaded.has(l)) { state.msg = t('lang.loading', 'Loading {lang}…', { lang: LNAME[l] }); toast(state.msg); await loadLang(l); }
  S.order = o; if (S.learning && !o.includes(S.learning)) S.learning = o.find(l => l !== S.speak) || null;
  saveSettings(); buildSlots(); paintCounts(); paintTotal();
  if (window.FLTViews) FLTViews.syncLangs();
  if (state.entry) { const e = state.entry; await openEntry(e, state.sense, null, null, { noRoute: true, noPlay: true }); } else render();
}
function showUpdate() {          // a bar at the top of the page that stays until it is used
  if ($('#upd-bar')) return;
  const b = document.createElement('div'); b.id = 'upd-bar';
  b.innerHTML = `<span>${esc(t('upd', 'A new version of the app is ready.'))}</span><button class="btn sm primary" type="button">${esc(t('upd.btn2', 'Update now'))}</button>`;
  b.querySelector('button').addEventListener('click', () => location.reload());
  const w = $('.wrap'); w.insertBefore(b, w.firstChild);
}
function offlineNote(text) { const el = $('#offline-state'); if (el) el.textContent = text; }
async function start() {
  applyDisplay(); applyTexts(); buildAny(); buildSlots(); render();
  if (window.FLTViews) FLTViews.init(API);
  try {
    const { manifest, out } = await loadData(msg => { state.msg = msg; if (state.status === 'loading') render(); });
    D.manifest = manifest; buildIndex(out);
    paintCounts();
    paintTotal();
    loadDetails().then(() => { if (state.status === 'done') render(false); if (window.FLTViews) FLTViews.dataReady(); }).catch(() => {});
    paintRecent(); paintWotd();
    if (window.FLTViews) FLTViews.dataReady();
    let opened = await openRoute().catch(() => false);
    if (!opened && P.last && P.last.id) { await ensureIds([P.last.id]); const e = D.byId.get(P.last.id); if (e) { state.others = findLoaded(e.lang, e.lemma); await openEntry(e, P.last.sense, null, null, { noRoute: true, noPlay: true }); opened = true; } }
    if (!opened) { const fl = S.learning && S.order.includes(S.learning) ? S.learning : S.order.includes('de') ? 'de' : S.order[1] || S.order[0];
      const first = (fl === 'de' && findLoaded('de', 'stehen')[0]) || D.byId.get((D.top[fl][5] || D.top[fl][0]).id); state.others = findLoaded(first.lang, first.lemma); await openEntry(first, null, null, null, { noRoute: true, noPlay: true }); }
  } catch (err) {
    state = Object.assign(state, { status: 'error', error: String(err && err.message || err), near: [] }); render();
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // a new version of the app: say so, with a button to load it
    const hadController = !!navigator.serviceWorker.controller;
    const loadedAt = Date.now();
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController) return; if (Date.now() - loadedAt < 8000) location.reload(); else showUpdate(); });      // just opened: take the new version at once; in use: ask
    // installed on the home screen (iOS) the app is rarely reloaded: look for a new version whenever it comes back to the screen, and every 30 minutes
    const look = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') look(); });
    setInterval(look, 30 * 60 * 1000);
    navigator.serviceWorker.register('sw.js').then(r => { r.update().catch(() => {}); return navigator.serviceWorker.ready; }).then(() => offlineNote(t('foot.offline', 'Saved on this device: the app also works without an internet connection.')))
      .catch(() => offlineNote(t('foot.nooffline', 'Offline use is not available in this browser.')));
  } else offlineNote(t('foot.needweb', 'Offline use needs the app to be opened from its web address.'));
}
const API = { BETA, betaName, betaTag, regularForm, setLanguages, dataLangs, cleanOrder, MIN_SLOTS, MAX_SLOTS, UI_LANGS,  D, S, P, DEFAULTS, t, esc, num, flag, fold, LNAME, RNAME, REG, BASE, LOCALE, LANGS, CEFR, LVORD, levelOf, lvlBadge, article, artHtml, gclass, gname, withArt, regionView,
  getFile, loadLang, cleanGloss, find, findLoaded, translate, openEntry, openId, ensureIds, ensureWord, speak, speakAll, withTo, voicesFor, voiceFor, get voices() { return voices; }, saveP, saveSettings, loadSettings, toast, render, applyDisplay, applyTexts,
  buildSlots, paintRecent, paintWotd, tables, canForms, routeOf, firstTr: null, trIds, toggleFav, diffMark, animOn, quad, visibleSenses, idParts, sentenceHtml, regionScore, get state() { return state; } };
window.FLT = Object.assign(API, { ready: null });
window.FLT.ready = start();
})();
