// The stamp at the end of the page, pressed onto the contact block the way a hand would: tilted, a
// little over the type, with its P.S. beside it. A pure function of the config (site/data/signoff.config.json,
// written by lab/signoff.html) plus where the type happens to sit. The stamp is dated the day you visit.

import { DEFAULT_CONFIG, stampSVG } from './stamp-render.js';

export const PRESS = 'https://annalogofdesign.github.io/passport-press/';

// Where a hand would press it. Each mode names an anchor on the contact block; dx/dy nudge from there
export const MODES = {
  headline: { label: 'End of the headline', shape: 'passport', size: 190, tilt: -8, dx: 70, dy: 74, psSide: 'below' },
  gutter: { label: 'Across the middle', shape: 'passport', size: 200, tilt: 6, dx: -30, dy: 90, psSide: 'right' },
  signature: { label: 'Signature', shape: 'passport', size: 180, tilt: -6, dx: -40, dy: 100, psSide: 'below' },
  rule: { label: 'Tied to the line', shape: 'passport', size: 190, tilt: 8, dx: 0, dy: 0, psSide: 'left' },
  center: { label: 'Centred below', shape: 'round', size: 170, tilt: -6, dx: 0, dy: 130, psSide: 'below' },
  // Not pressed over the block: a column of its own, beside the links. dx/dy nudge it within the column
  column: { label: 'Third column', shape: 'passport', stretch: 340, size: 300, tilt: -4, dx: 0, dy: 0, psSide: 'below' },
  // The headline, availability and links stacked on the left; the stamp and P.S. get the right half
  pair: { label: 'Two columns', shape: 'passport', stretch: 340, size: 420, tilt: -4, dx: 0, dy: 0, psSide: 'below' },
};

export const SHAPES = { passport: 'rect', round: 'circle' };

export const DEFAULT_SIGNOFF = {
  mode: 'gutter',
  seed: 4127,
  ...Object.fromEntries(Object.entries(MODES.gutter).filter(([k]) => k !== 'label')),
  stretch: 240, // the passport stamp's length in its own units: 240 is the hero's proportion
  ink: 0.86,
  overprint: true,
  psGap: 18,
};

const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function stampMarkup(config, stamps) {
  return stampSVG({
    key: `visit-${config.seed}`,
    status: 'current',
    top: 'annaskopenko.com',
    mark: { word: 'Visited' },
    date: today(),
    bottom: 'Thanks for stopping by',
    width: config.stretch,
    frames: { mixed: SHAPES[config.shape] ?? 'rect' },
  }, { ...DEFAULT_CONFIG, ...stamps, seed: config.seed, inkScheme: 'mono', inkA: 'green', inkOpacity: 1, doubleStrike: 0 }, {});
}

// The point each mode presses at, in the contact block's own coordinates
function anchor(contact, mode) {
  const box = contact.getBoundingClientRect();
  const at = (r, fx, fy) => ({ x: r.left - box.left + r.width * fx, y: r.top - box.top + r.height * fy });
  if (mode === 'headline') {
    const head = contact.querySelector('.contact-grid > .display');
    const range = document.createRange();
    range.selectNodeContents(head);
    const lines = [...range.getClientRects()];
    return at(lines[lines.length - 1], 1, 0.5); // the end of the last line
  }
  if (mode === 'gutter') {
    const grid = contact.querySelector('.contact-grid').getBoundingClientRect();
    return at(grid, 0.5, 1);
  }
  if (mode === 'center') return { x: box.width / 2, y: at(contact.querySelector('.contact-grid').getBoundingClientRect(), 0, 1).y };
  if (mode === 'signature') return at(contact.querySelector('.contact-links a:last-child').getBoundingClientRect(), 1, 1);
  return at(box, 0.6, 0); // the hairline the block starts on
}

/** Presses the stamp and its P.S. onto `contact`. Returns the element, so a lab can re-place it. */
export function placeSignoff(contact, config, stamps) {
  contact.querySelector('.signoff')?.remove();
  const el = document.createElement('div');
  el.className = `signoff signoff--${config.psSide}`;
  el.innerHTML = `<a class="signoff-stamp" href="${PRESS}" aria-label="Make your own stamp with Passport Press">${stampMarkup(config, stamps)}</a>
    <p class="signoff-ps">P.S. I made these stamps with Passport Press, a little tool I built. <a href="${PRESS}">Make your own</a>.</p>`;
  const grid = contact.querySelector('.contact-grid');
  const inGrid = config.mode === 'column' || config.mode === 'pair';
  grid.classList.toggle('contact-grid--signoff', config.mode === 'column');
  grid.classList.toggle('contact-grid--pair', config.mode === 'pair');
  // Two columns: the headline and the side text share the left column
  const main = grid.querySelector('.contact-main');
  if (config.mode === 'pair' && !main) {
    const wrap = document.createElement('div');
    wrap.className = 'contact-main';
    wrap.append(grid.querySelector(':scope > .display'), grid.querySelector(':scope > .contact-side'));
    grid.prepend(wrap);
  } else if (config.mode !== 'pair' && main) {
    main.replaceWith(...main.children);
  }
  (inGrid ? grid : contact).append(el);
  layout(contact, el, config);
  return el;
}

export function layout(contact, el, config) {
  el.style.setProperty('--size', `${config.size}px`);
  el.style.setProperty('--tilt', `${config.tilt}deg`);
  el.style.setProperty('--ink', config.ink);
  el.style.setProperty('--gap', `${config.psGap}px`);
  el.toggleAttribute('data-overprint', config.overprint);
  const inGrid = config.mode === 'column' || config.mode === 'pair';
  el.classList.toggle('signoff--column', inGrid);
  if (inGrid || matchMedia('(max-width: 860px)').matches) {
    el.style.left = el.style.top = '';
    el.style.translate = inGrid ? `${config.dx}px ${config.dy}px` : '';
    return;
  }
  el.style.translate = '';
  const a = anchor(contact, config.mode);
  const stamp = el.querySelector('.signoff-stamp');
  // The stamp's centre lands on the anchor plus the nudge; the P.S. rides along beside it
  el.style.left = `${a.x + config.dx - stamp.offsetLeft - stamp.offsetWidth / 2}px`;
  el.style.top = `${a.y + config.dy - stamp.offsetTop - stamp.offsetHeight / 2}px`;
}

// On the site: the stamp under the headline (index.html), drawn with today's date. The lab places
// its own and never has this slot when this runs
const slot = document.querySelector('[data-visit-stamp]');
if (slot) {
  const stamps = await (await fetch('data/stamps.config.json')).json();
  slot.innerHTML = stampMarkup({ seed: DEFAULT_SIGNOFF.seed, shape: 'passport', stretch: 240 }, stamps);
}
