// The wordmark: Anna's monogram, optionally framed and inked like a stamp, beside the lowercase name.
// A pure function of config, so the lab and the site draw the same mark.

import { MONOGRAM } from './monogram.js';
import { inkFilter, pressureMask } from './ink.js';

export const WORDMARK_INKS = {
  navy: 'oklch(0.23 0.028 219.7)',
  blue: 'oklch(0.45 0.13 258)',
  black: 'oklch(0.2 0 0)',
};

export const DEFAULT_WORDMARK = {
  // The mark
  art: 'monogram', // monogram | letters
  markScale: 0.56, // share of the badge the art fills
  markX: 50,
  markY: 50,
  frame: 'shape', // shape (follows the monogram) | rings | none
  frameGap: 5.5,
  frameStroke: 3.4,
  innerRing: true,
  innerGap: 4.5,
  innerStroke: 1.6,
  arcText: false,
  arcTop: 'anna skopenko',
  arcBottom: 'design engineer',
  arcSize: 11,
  texture: 0.45,
  textureSeed: 7,
  // The letters, when art is 'letters'
  monoFont: 'Iowan Old Style',
  monoItalic: false,
  monoWeight: 400,
  monoSize: 0.63,
  monoTracking: -0.02,
  monoX: 50.4,
  monoY: 65.1,
  // The name
  wordFont: 'Manrope',
  wordItalic: false,
  wordWeight: 400,
  wordSize: 21,
  wordTracking: 0.015,
  // Layout
  badgeSize: 1.45,
  gap: 0.45,
  ringY: 0.115,
  ink: 'navy',
  seed: 93876,
  pairing: 'contrast',
};

const stack = (name, generic) => `'${name}', ${generic}`;

// Filter and mask ids must be unique per mark on the page, or the first one wins everywhere
let marks = 0;
const nextUid = () => `wm${++marks}`;
const U = (t) => t.toUpperCase(); // SVG text ignores text-transform in Chrome

function art(c, uid) {
  if (c.art === 'monogram') {
    const scale = (c.markScale * 100) / MONOGRAM.height;
    return `<g transform="translate(${c.markX - (MONOGRAM.width * scale) / 2} ${c.markY - (MONOGRAM.height * scale) / 2}) scale(${scale.toFixed(4)})">
      <path d="${MONOGRAM.path}" fill="currentColor"/></g>`;
  }
  if (c.monoPath) return `<path d="${c.monoPath}" fill="currentColor" fill-rule="evenodd"/>`;
  return `<text x="${c.monoX}" y="${c.monoY}" text-anchor="middle" fill="currentColor" font-size="${c.monoSize * 100}" letter-spacing="${c.monoTracking * 100}"
    style="font-family:${stack(c.monoFont, 'serif')}; font-style:${c.monoItalic ? 'italic' : 'normal'}; font-weight:${c.monoWeight}; font-kerning:normal">as</text>`;
}

// The monogram's own outline, grown outwards by `out`: same corners, concentric
function shapeBox(c, out) {
  const scale = (c.markScale * 100) / MONOGRAM.height;
  return {
    w: MONOGRAM.width * scale + out * 2,
    h: MONOGRAM.height * scale + out * 2,
    r: MONOGRAM.radius * scale + out,
  };
}

// Rounded rectangle as a path, starting at the middle of the top edge (or the bottom, running the
// other way) so text set along it stays upright on both edges
function roundedPath({ w, h, r }, { fromBottom = false } = {}) {
  const x0 = c50 - w / 2;
  const x1 = c50 + w / 2;
  const y0 = c50 - h / 2;
  const y1 = c50 + h / 2;
  const sweep = fromBottom ? 0 : 1;
  const start = fromBottom ? y1 : y0;
  const far = fromBottom ? y0 : y1;
  const step = fromBottom ? -r : r;
  return `M ${c50} ${start} H ${x1 - r} A ${r} ${r} 0 0 ${sweep} ${x1} ${start + step}
    V ${far - step} A ${r} ${r} 0 0 ${sweep} ${x1 - r} ${far} H ${x0 + r}
    A ${r} ${r} 0 0 ${sweep} ${x0} ${far - step} V ${start + step}
    A ${r} ${r} 0 0 ${sweep} ${x0 + r} ${start} H ${c50}`;
}

const c50 = 50;

function frame(c) {
  if (c.frame === 'none') return '';
  if (c.frame === 'shape') {
    const rule = (out, weight) => {
      const box = shapeBox(c, out);
      return `<rect x="${(c50 - box.w / 2).toFixed(2)}" y="${(c50 - box.h / 2).toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" rx="${box.r.toFixed(2)}" fill="none" stroke="currentColor" stroke-width="${weight}"/>`;
    };
    return rule(c.frameGap, c.frameStroke)
      + (c.innerRing ? rule(c.frameGap + c.frameStroke / 2 + c.innerGap + c.innerStroke / 2, c.innerStroke) : '');
  }
  const outerR = 50 - c.frameStroke / 2;
  const innerR = outerR - c.frameStroke / 2 - c.innerGap - c.innerStroke / 2;
  return `<circle cx="50" cy="50" r="${outerR}" fill="none" stroke="currentColor" stroke-width="${c.frameStroke}"/>
    ${c.innerRing ? `<circle cx="50" cy="50" r="${innerR}" fill="none" stroke="currentColor" stroke-width="${c.innerStroke}"/>` : ''}`;
}

// Text running around the badge, the way a seal carries its own name.
// The baseline sits just inside the frame; the letters grow outwards into the band.
function arcs(c, uid) {
  if (!c.arcText || c.frame === 'none') return '';
  const line = (id, value, size) => `<text font-size="${size}" letter-spacing="${size * 0.14}" text-anchor="middle" fill="currentColor" style="font-family:${stack(c.wordFont, 'sans-serif')}; font-weight:500">
    <textPath href="#${id}" startOffset="0%">${U(value)}</textPath></text>`;

  if (c.frame === 'shape') {
    const band = c.frameGap + c.frameStroke / 2 + c.arcSize * 0.32;
    const box = shapeBox(c, band);
    return `<path id="at-${uid}" d="${roundedPath(box)}" fill="none" stroke="none"/>
      <path id="ab-${uid}" d="${roundedPath(box, { fromBottom: true })}" fill="none" stroke="none"/>
      ${c.arcTop ? line(`at-${uid}`, c.arcTop, c.arcSize) : ''}
      ${c.arcBottom ? line(`ab-${uid}`, c.arcBottom, c.arcSize * 0.92) : ''}`;
  }

  const outerR = 50 - c.frameStroke / 2;
  const innerR = outerR - c.frameStroke / 2 - c.innerGap - c.innerStroke / 2;
  const circle = (id, r, sweep) => `<path id="${id}" d="M 50 ${50 + (sweep ? r : -r)} A ${r} ${r} 0 1 ${sweep ? 1 : 0} 50 ${50 - (sweep ? r : -r)} A ${r} ${r} 0 1 ${sweep ? 1 : 0} 50 ${50 + (sweep ? r : -r)}" fill="none" stroke="none"/>`;
  return `${circle(`at-${uid}`, innerR - c.arcSize * 0.4, true)}${circle(`ab-${uid}`, innerR - c.arcSize * 0.1, false)}
    ${c.arcTop ? `<text font-size="${c.arcSize}" letter-spacing="${c.arcSize * 0.14}" text-anchor="middle" fill="currentColor" style="font-family:${stack(c.wordFont, 'sans-serif')}; font-weight:500"><textPath href="#at-${uid}" startOffset="50%">${U(c.arcTop)}</textPath></text>` : ''}
    ${c.arcBottom ? `<text font-size="${c.arcSize * 0.92}" letter-spacing="${c.arcSize * 0.13}" text-anchor="middle" fill="currentColor" style="font-family:${stack(c.wordFont, 'sans-serif')}; font-weight:500"><textPath href="#ab-${uid}" startOffset="50%">${U(c.arcBottom)}</textPath></text>` : ''}`;
}

export function markSVG(c, uid = nextUid()) {
  const inked = c.texture > 0;
  const body = `${frame(c)}${arcs(c, uid)}${art(c, uid)}`;
  const defs = inked
    ? `<defs>${inkFilter({ id: `ink-${uid}`, amount: c.texture, seedA: c.textureSeed, seedB: c.textureSeed * 3 + 5 })}${pressureMask({ id: `p-${uid}`, angle: (c.textureSeed * 47) % 360, amount: c.texture })}</defs>`
    : '';
  return `<svg viewBox="0 0 100 100" style="display:block; width:100%; height:100%; overflow:visible" aria-hidden="true" focusable="false">
    ${defs}${inked ? `<g mask="url(#p-${uid})"><g filter="url(#ink-${uid})">${body}</g></g>` : body}
  </svg>`;
}

// `size` is any CSS length, so the hero can clamp it and the top bar can scale it down
export function wordmarkHTML(c, { size = `${c.wordSize}px`, uid = nextUid() } = {}) {
  return `<span style="display:inline-flex; align-items:center; gap:${c.gap}em; color:${WORDMARK_INKS[c.ink]}; font-size:${size}; line-height:1.2">
    <span class="sr-only">Anna Skopenko</span>
    <span aria-hidden="true" style="display:block; flex:none; width:${c.badgeSize}em; height:${c.badgeSize}em; translate:0 ${c.ringY}em">${markSVG(c, uid)}</span>
    <span aria-hidden="true" style="font-family:${stack(c.wordFont, 'sans-serif')}; font-style:${c.wordItalic ? 'italic' : 'normal'}; font-weight:${c.wordWeight}; letter-spacing:${c.wordTracking}em; font-kerning:normal; white-space:nowrap">anna skopenko</span>
  </span>`;
}

export const ringSVG = markSVG; // old name, kept for the lab's size row
