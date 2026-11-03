// Passport stamps as a pure function of (chapter, config). The same config, seed
// included, always draws the same stamps; every random draw comes from the seed.

// Real stamp-pad inks, in OKLCH
export const INKS = {
  navy: 'oklch(0.23 0.028 219.7)',
  black: 'oklch(0.2 0 0)',
  violet: 'oklch(0.42 0.14 298)',
  red: 'oklch(0.52 0.18 27)',
  blue: 'oklch(0.45 0.13 258)',
  green: 'oklch(0.48 0.09 160)',
};

export const DEFAULT_CONFIG = {
  seed: 1917,
  frames: 'mixed', // mixed | passport | postmark
  inkScheme: 'mono', // mono | duo | country
  inkA: 'navy',
  inkB: 'red',
  inkOpacity: 0.88,
  ageFade: 0.5,
  size: 1,
  rotation: 14,
  jitter: 1.5,
  roughness: 2,
  voids: 0.4,
  halo: 0.35,
  pressure: 0.35,
  doubleStrike: 0.25,
  rule: 1,
  logoSize: 1,
  pictograms: true,
  cornerMeaning: true,
  killerBars: true,
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One stream per stamp and purpose, so moving a knob never reshuffles another stamp
function rngFor(seed, salt) {
  let h = 2166136261 ^ seed;
  for (const ch of salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return mulberry32(h);
}

export async function loadLogos(journey, base) {
  const keys = [...new Set(journey.flatMap((c) => (c.mark.logo ? [c.mark.logo] : [])))];
  const entries = await Promise.all(keys.map(async (key) => {
    const src = await (await fetch(`${base}${key}.svg`)).text();
    return [key, {
      viewBox: src.match(/viewBox="([^"]+)"/)[1],
      inner: src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="#000"/g, 'fill="currentColor"'),
    }];
  }));
  return Object.fromEntries(entries);
}

export function inkFor(chapter, config) {
  if (config.inkScheme === 'country') return INKS[chapter.ink];
  if (config.inkScheme === 'duo' && chapter.status === 'current') return INKS[config.inkB];
  return INKS[config.inkA];
}

const isRound = (frame) => frame === 'circle' || frame === 'squared';

function frameSize(chapter, config) {
  const frame = chapter.frames[config.frames];
  if (isRound(frame)) {
    const duplex = config.frames === 'postmark' && config.killerBars;
    return { frame, W: duplex ? 300 : 210, H: 210, duplex };
  }
  // A flat stamp can be drawn longer than the hero's: everything inside is laid out from W
  return { frame, W: chapter.width ?? 240, H: chapter.bottom ? 168 : 150, duplex: false };
}

// Where each stamp lands, how far it tilts, and how much older chapters have faded
export function layoutJourney(journey, config) {
  return journey.map((chapter, i) => {
    const rng = rngFor(config.seed, `${chapter.key}:place`);
    const jx = (rng() * 2 - 1) * config.jitter;
    const jy = (rng() * 2 - 1) * config.jitter;
    const tilt = 0.45 + rng() * 0.55;
    const age = journey.length - 1 - i;
    return {
      chapter,
      x: chapter.x + jx,
      narrowX: (chapter.narrowX ?? chapter.x) + jx,
      y: chapter.y + jy,
      narrowY: (chapter.narrowY ?? chapter.y) + jy,
      rotate: chapter.rot * tilt * config.rotation,
      width: frameSize(chapter, config).W * 0.8 * config.size,
      opacity: config.inkOpacity * Math.max(0.1, 1 - (config.ageFade * age) / (journey.length - 1)),
    };
  });
}

const U = (t) => t.toUpperCase(); // SVG text ignores text-transform in Chrome

// Tighten tracking, then size, until capitals fit the width
function fit(text, maxWidth, size, tracking) {
  const n = text.length;
  let s = size;
  let t = tracking;
  const width = () => n * s * 0.68 + (n - 1) * t;
  while (width() > maxWidth && t > 0.6) t -= 0.2;
  while (width() > maxWidth && s > 7) s -= 0.5;
  return { size: s, attrs: `font-size="${s}" letter-spacing="${t.toFixed(2)}"` };
}

const text = (x, y, value, maxWidth, size, tracking, extra = '') =>
  `<text x="${x}" y="${y}" text-anchor="middle" ${fit(value, maxWidth, size, tracking).attrs} ${extra}>${U(value)}</text>`;

const PLANE = 'M0,-8 C0.9,-8 1.4,-7 1.4,-5.8 L1.4,-2 L8,2.2 L8,3.8 L1.4,1.8 L1.4,5.2 L3.4,6.8 L3.4,8 L0,7 L-3.4,8 L-3.4,6.8 L-1.4,5.2 L-1.4,1.8 L-8,3.8 L-8,2.2 L-1.4,-2 L-1.4,-5.8 C-1.4,-7 -0.9,-8 0,-8 Z';

// Taking off for chapters I've left, landing for the one I'm in
const pictogram = (x, y, status) =>
  `<path d="${PLANE}" transform="translate(${x} ${y}) rotate(${status === 'current' ? 135 : 45}) scale(0.95)"/>`;

const star = (x, y, r) => `<polygon points="${Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const rr = i % 2 ? r * 0.42 : r;
  return `${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr).toFixed(2)}`;
}).join(' ')}"/>`;

function centerMark(chapter, config, logos, uid, { x, y, w, h }) {
  const m = chapter.mark;
  const cx = x + w / 2;
  if (m.logo) {
    // Scale the logo box around its centre; `mark.scale` tunes one chapter, `logoSize` all of them
    const scale = (m.scale ?? 1) * config.logoSize;
    const lw = w * scale;
    const lh = h * scale;
    const logo = logos[m.logo];
    return `<svg x="${cx - lw / 2}" y="${y + h / 2 - lh / 2}" width="${lw}" height="${lh}" viewBox="${logo.viewBox}" preserveAspectRatio="xMidYMid meet">${logo.inner}</svg>`;
  }
  if (m.emblem === 'crescent') {
    const ex = x + 12;
    const ey = y + h / 2;
    const word = fit(m.word, w - 34, 21, 1.4);
    return `<mask id="cut-${uid}"><rect x="${ex - 16}" y="${ey - 16}" width="32" height="32" fill="#fff"/><circle cx="${ex + 5}" cy="${ey}" r="10.5" fill="#000"/></mask>
      <circle cx="${ex}" cy="${ey}" r="12.5" mask="url(#cut-${uid})"/>
      ${[0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return star(ex + 7 + Math.cos(a) * 5, ey + Math.sin(a) * 5, 2); }).join('')}
      <text x="${ex + 22}" y="${ey + word.size * 0.36}" ${word.attrs}>${U(m.word)}</text>`;
  }
  const word = fit(m.word, w, 26, 2.6);
  if (!m.sub) return `<text x="${cx}" y="${y + h / 2 + word.size * 0.36}" text-anchor="middle" ${word.attrs}>${U(m.word)}</text>`;
  return `<text x="${cx}" y="${y + h * 0.5}" text-anchor="middle" ${word.attrs}>${U(m.word)}</text>
    ${text(cx, y + h * 0.5 + 18, m.sub, w, 12, 3)}`;
}

function dateBand(cx, y, halfWidth, chapter, k) {
  return `<g fill="none" stroke-width="${k}"><line x1="${cx - halfWidth}" y1="${y}" x2="${cx + halfWidth}" y2="${y}"/><line x1="${cx - halfWidth}" y1="${y + 22}" x2="${cx + halfWidth}" y2="${y + 22}"/></g>
    ${text(cx, y + 15.5, chapter.date, halfWidth * 2 - 8, 12, 2.4, 'style="font-variant-numeric: tabular-nums"')}`;
}

function flatStamp(chapter, config, logos, uid, frame, W, H) {
  const k = config.rule;
  const cx = W / 2;
  const radius = config.cornerMeaning ? (chapter.status === 'current' ? 2 : 18) : 8;

  const inset = (d) => {
    if (frame === 'oval') return `<ellipse cx="${cx}" cy="${H / 2}" rx="${cx - d}" ry="${H / 2 - d}"/>`;
    if (frame === 'octagon') {
      const c = 26 - d * 0.4;
      return `<polygon points="${[[d + c, d], [W - d - c, d], [W - d, d + c], [W - d, H - d - c], [W - d - c, H - d], [d + c, H - d], [d, H - d - c], [d, d + c]].map((p) => p.join(',')).join(' ')}"/>`;
    }
    return `<rect x="${d}" y="${d}" width="${W - 2 * d}" height="${H - 2 * d}" rx="${Math.max(radius - (d - 3), 1)}"/>`;
  };
  const outer = frame === 'postage'
    ? `<g stroke-width="${5 * k}" stroke-dasharray="0.1 7" stroke-linecap="round">${inset(3)}</g>`
    : `<g stroke-width="${4 * k}">${inset(3)}</g>`;
  const frameMarkup = `${outer}<g stroke-width="${1.4 * k}">${inset(11)}</g>`;

  const narrow = frame === 'oval' ? 0.58 : frame === 'octagon' ? 0.66 : 0.8;
  const hasPictogram = config.pictograms && (frame === 'rect' || frame === 'postage');
  const topY = frame === 'oval' ? 44 : 36;
  const dateTop = frame === 'oval' ? 98 : 102;
  const topText = hasPictogram
    ? text(cx - 12, topY, chapter.top, W * narrow - 30, 12, 3)
    : text(cx, topY, chapter.top, W * narrow, 12, 3);

  return `${frameMarkup}
    <g fill="currentColor" stroke="none">
      ${topText}
      ${hasPictogram ? pictogram(W - 30, 31, chapter.status) : ''}
      ${centerMark(chapter, config, logos, uid, { x: 46, y: topY + 8, w: W - 92, h: dateTop - topY - 14 })}
    </g>
    <g fill="currentColor">${dateBand(cx, dateTop, W * (frame === 'oval' ? 0.28 : 0.38), chapter, k)}</g>
    ${chapter.bottom ? `<g fill="currentColor" stroke="none">${text(cx, dateTop + 40, chapter.bottom, W * narrow, 11, 2.2)}</g>` : ''}`;
}

function roundStamp(chapter, config, logos, uid, frame) {
  const k = config.rule;
  const c = 105;
  const R = frame === 'circle' ? 90 : 86;
  const corner = config.cornerMeaning ? (chapter.status === 'current' ? 2 : 14) : 6;
  const frameMarkup = frame === 'circle'
    ? `<circle cx="${c}" cy="${c}" r="100" stroke-width="${4 * k}"/><circle cx="${c}" cy="${c}" r="${R}" stroke-width="${1.4 * k}"/>`
    : `<rect x="3" y="3" width="204" height="204" rx="${corner}" stroke-width="${4 * k}"/><circle cx="${c}" cy="${c}" r="${R}" stroke-width="${1.4 * k}"/>`;
  // A seal puts the mark dead centre and moves the date onto the bottom arc
  const seal = chapter.layout === 'seal';
  const top = seal ? R - 13 : R - 16;
  const bottom = R - 6;
  // Full circles, so long names never clip at the end of the path; 50% lands at 12 and 6 o'clock
  const arcs = `<path id="at-${uid}" d="M ${c} ${c + top} A ${top} ${top} 0 1 1 ${c} ${c - top} A ${top} ${top} 0 1 1 ${c} ${c + top}" fill="none" stroke="none"/>
    <path id="ab-${uid}" d="M ${c} ${c - bottom} A ${bottom} ${bottom} 0 1 0 ${c} ${c + bottom} A ${bottom} ${bottom} 0 1 0 ${c} ${c - bottom}" fill="none" stroke="none"/>`;
  const arcText = (id, value, width, size, tracking) =>
    `<text ${fit(value, width, size, tracking).attrs} text-anchor="middle"><textPath href="#${id}" startOffset="50%">${U(value)}</textPath></text>`;
  const topText = arcText(`at-${uid}`, chapter.top, Math.PI * top * (seal ? 0.92 : 0.78), 12.5, 1.8);
  const bottomText = chapter.bottom
    ? arcText(`ab-${uid}`, chapter.bottom, Math.PI * bottom * (seal ? 0.6 : 0.78), 12, 2.4)
    : star(c, c + bottom - 4, 5);

  if (seal) {
    return `${frameMarkup}${arcs}
      <g fill="currentColor" stroke="none">
        ${topText}${bottomText}
        ${centerMark(chapter, config, logos, uid, { x: c - 49, y: c - 49, w: 98, h: 98 })}
      </g>`;
  }

  const markWidth = chapter.mark.logo ? 76 : 116;
  return `${frameMarkup}${arcs}
    <g fill="currentColor" stroke="none">
      ${topText}${bottomText}
      ${centerMark(chapter, config, logos, uid, { x: c - markWidth / 2, y: 43, w: markWidth, h: 74 })}
    </g>
    <g fill="currentColor">${dateBand(c, 122, 66, chapter, k)}</g>`;
}

// Postmark "killer" bars beside a round date stamp: the duplex
function killerBars(H) {
  const top = H / 2 - (4 * 10 + 3 * 7) / 2;
  return `<g fill="currentColor" stroke="none">${[0, 1, 2, 3].map((i) => `<rect x="220" y="${top + i * 17}" width="76" height="10"/>`).join('')}</g>`;
}

export function stampSVG(chapter, config, logos, uid = chapter.key) {
  const rng = rngFor(config.seed, `${chapter.key}:ink`);
  const grainSeed = Math.floor(rng() * 1000);
  const blotchSeed = Math.floor(rng() * 1000);
  const pressureAngle = rng() * 360;
  const strikeRoll = rng();
  const strikeX = (rng() * 2 - 1) * 3;
  const strikeY = (rng() * 2 - 1) * 3;

  const { frame, W, H, duplex } = frameSize(chapter, config);
  const art = (isRound(frame) ? roundStamp(chapter, config, logos, uid, frame) : flatStamp(chapter, config, logos, uid, frame, W, H))
    + (duplex ? killerBars(H) : '');
  const ghost = strikeRoll < config.doubleStrike
    ? `<g transform="translate(${strikeX.toFixed(2)} ${strikeY.toFixed(2)})" opacity="0.16">${art}</g>`
    : '';

  const body = 1 - config.halo * 0.45; // thick areas lighten, edges keep full ink: the rim
  const voidSlope = 1 + config.voids * 2.2;
  const voidIntercept = 2.2 - config.voids * 0.8;
  const low = Math.round((1 - config.pressure * 0.8) * 255);

  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" style="color:${inkFor(chapter, config)}; font-family:'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif; font-weight:700; overflow:visible">
    <defs>
      <filter id="f-${uid}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${grainSeed}" result="grain"/>
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="${config.roughness}" xChannelSelector="R" yChannelSelector="G" result="rough"/>
        <feMorphology in="rough" operator="erode" radius="0.8" result="inner"/>
        <feComposite in="rough" in2="inner" operator="out" result="rim"/>
        <feComponentTransfer in="rough" result="body"><feFuncA type="linear" slope="${body}"/></feComponentTransfer>
        <feMerge result="inked"><feMergeNode in="body"/><feMergeNode in="rim"/></feMerge>
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="${blotchSeed}" result="blotch"/>
        <feComponentTransfer in="blotch" result="coverage"><feFuncA type="linear" slope="${-voidSlope}" intercept="${voidIntercept}"/></feComponentTransfer>
        <feComposite in="inked" in2="coverage" operator="in"/>
      </filter>
      <linearGradient id="g-${uid}" gradientTransform="rotate(${pressureAngle.toFixed(1)} 0.5 0.5)">
        <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="rgb(${low} ${low} ${low})"/>
      </linearGradient>
      <mask id="p-${uid}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}">
        <rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="url(#g-${uid})"/>
      </mask>
    </defs>
    <g mask="url(#p-${uid})">
      <g filter="url(#f-${uid})" fill="none" stroke="currentColor">${ghost}${art}</g>
    </g>
  </svg>`;
}
