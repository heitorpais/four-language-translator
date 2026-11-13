/* Glossarium: the default profile pictures, drawn as small emblems in the colours of the old-library look.
   Each is an SVG 64×64; a picture is stored in a profile as "preset:<name>". */
(function () {
'use strict';
const BG = { wine: '#7a1f1f', ink: '#2c4f86', moss: '#3b6b34', ochre: '#9a7428', plum: '#5e2d7a', slate: '#4a5560', walnut: '#6b4428', teal: '#2f6b6b' };
const G = '#f3e6c4';          // parchment-gold lines
const s = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${bg}"/><circle cx="32" cy="32" r="29" fill="none" stroke="${G}" stroke-opacity=".35" stroke-width="1"/><g fill="none" stroke="${G}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const PRESETS = {
  book: s(BG.wine, '<path d="M14 22c6-2 12-1 18 3 6-4 12-5 18-3v22c-6-2-12-1-18 3-6-4-12-5-18-3z"/><path d="M32 25v22"/>'),
  quill: s(BG.ink, '<path d="M44 14c-10 2-18 10-22 24l-4 12"/><path d="M44 14c0 10-6 20-18 24"/><path d="M28 30l6 2M25 37l5 1"/><path d="M16 50h16"/>'),
  owl: s(BG.walnut, '<path d="M20 22l4 4M44 22l-4 4"/><circle cx="26" cy="31" r="5"/><circle cx="38" cy="31" r="5"/><path d="M32 36l-2 3h4z"/><path d="M20 26c-2 8-1 16 4 22h16c5-6 6-14 4-22"/><path d="M26 48v3M38 48v3"/>'),
  globe: s(BG.teal, '<circle cx="32" cy="32" r="15"/><path d="M17 32h30M32 17c-6 5-6 25 0 30M32 17c6 5 6 25 0 30M20 24h24M20 40h24"/>'),
  key: s(BG.ochre, '<circle cx="22" cy="32" r="7"/><path d="M29 32h20M43 32v6M48 32v5"/>'),
  lamp: s(BG.plum, '<path d="M16 40c4 4 22 4 28 0l6-6h-6"/><path d="M16 40c-2-4 0-8 6-8h14c4 0 6 3 8 8"/><path d="M26 32c0-3 2-5 4-5s4 2 4 5"/><path d="M30 22c-2-3 0-6 2-8 0 3 3 4 2 7"/>'),
  compass: s(BG.slate, '<circle cx="32" cy="32" r="15"/><path d="M32 19l4 13-4 13-4-13z"/><path d="M19 32h4M41 32h4"/>'),
  hourglass: s(BG.moss, '<path d="M22 16h20M22 48h20"/><path d="M24 16c0 8 8 12 8 16s-8 8-8 16M40 16c0 8-8 12-8 16s8 8 8 16"/><path d="M28 44h8"/>'),
  laurel: s(BG.wine, '<path d="M24 48c-8-6-10-18-4-28M40 48c8-6 10-18 4-28"/><path d="M21 40l-5-2M19 33l-5-3M19 26l-4-4M43 40l5-2M45 33l5-3M45 26l4-4"/><path d="M28 50l4-3 4 3"/>'),
  inkwell: s(BG.ink, '<path d="M22 34h20l-2 14H24z"/><path d="M26 34v-4h12v4"/><path d="M38 30l10-16"/><path d="M48 14c-2 4-4 6-7 8"/>'),
  scroll: s(BG.ochre, '<path d="M20 18h22c3 0 4 2 4 4s-1 4-4 4H24"/><path d="M20 18c-3 0-4 2-4 4s1 4 4 4h4v20c0 3 2 4 4 4h18c-3 0-4-2-4-4V26"/><path d="M30 32h10M30 38h10"/>'),
  column: s(BG.moss, '<path d="M18 18h28M20 22h24M18 48h28M20 44h24"/><path d="M24 22v22M30 22v22M34 22v22M40 22v22"/>'),
};
const svgUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/* any stored avatar value -> an image address; unknown or empty -> the first preset */
function avatarSrc(v) {
  if (typeof v === 'string' && v.startsWith('data:image/')) return v;
  const k = typeof v === 'string' && v.startsWith('preset:') ? v.slice(7) : '';
  return svgUrl(PRESETS[k] || PRESETS.book);
}
window.FLTAvatars = { PRESETS, names: Object.keys(PRESETS), avatarSrc };
})();
