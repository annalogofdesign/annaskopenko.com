// Hero: the passport stamps of my journey land once, in order.
// Stamping one again tells that chapter in a small note beside it. With a mouse the cursor
// carries the next chapter's stamp, so visitors stamp their way through in order; once all
// seven are stamped, a closing line points on to the work.
// The stamps themselves come from site/lab/stamps.html: journey.js is the content,
// data/stamps.config.json the look, stamp-render.js draws them.

import { JOURNEY } from './journey.js';
import { DEFAULT_CONFIG, layoutJourney, loadLogos, stampSVG } from './stamp-render.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const dur = (ms) => (reduced ? 0 : ms);

const STAMP_INTERVAL = 520;
const PRESS_DURATION = 265;
const NOTE_HOLD = 4500;
const CLOSING_DELAY = 700; // after the last press settles
const NOTE_GAP = 10;
const NOTE_MARGIN = 12;
const NOTE_ABOVE_PENALTY = 600; // px² of overlap a note will accept elsewhere before it goes above its stamp
// The note slides out from its stamp
const NOTE_ENTER = { right: 'translateX(-8px)', left: 'translateX(8px)', below: 'translateY(-6px)', above: 'translateY(6px)' };

// Squash on contact, overshoot, settle. `lifted` starts from a stamp already on the page
function press(stamp, lifted = false) {
  stamp.firstElementChild.animate([
    { offset: 0, opacity: lifted ? 1 : 0, transform: `translateY(-6px) scale(${lifted ? 1.05 : 1.03})`, easing: 'cubic-bezier(0.895, 0.03, 0.685, 0.22)' },
    { offset: 0.34, opacity: 1, transform: 'translateY(3px) scale(0.84)', easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' },
    { offset: 0.62, opacity: 1, transform: 'translateY(-1.5px) scale(1.07)', easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' },
    { offset: 1, opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: dur(PRESS_DURATION), fill: 'backwards' });
}

let audio;
function thud() {
  audio ??= new AudioContext();
  const now = audio.currentTime;
  const out = audio.createGain();
  out.gain.value = 0.3;
  out.connect(audio.destination);

  const osc = audio.createOscillator();
  const body = audio.createGain();
  osc.frequency.setValueAtTime(96, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
  body.gain.setValueAtTime(1, now);
  body.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(body).connect(out);
  osc.start(now);
  osc.stop(now + 0.2);

  const buffer = audio.createBuffer(1, audio.sampleRate * 0.05, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const slap = audio.createBufferSource();
  const lowpass = audio.createBiquadFilter();
  const slapGain = audio.createGain();
  slap.buffer = buffer;
  lowpass.frequency.value = 1400;
  slapGain.gain.value = 0.5;
  slap.connect(lowpass).connect(slapGain).connect(out);
  slap.start(now);
}

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// Text boxes are bigger than their words, so measure the text itself
function textRect(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect();
}

// The chapter you just stamped, told in a small note beside its stamp
function stampNote(hero) {
  const el = document.createElement('p');
  el.className = 'stamp-note';
  el.setAttribute('aria-live', 'polite');
  hero.append(el);
  let timer;
  let seq = 0;
  let anchor;

  // The note sits beside the stamp on the side facing the headline, or hangs below it when the
  // headline is in the way. It never goes up into the bar that holds the name. On a tight screen
  // it takes whichever spot covers the least of the headline, the other stamps and the nav
  function place() {
    if (!anchor) return;
    el.style.left = el.style.top = '0';
    // Balanced lines leave the box wider than its words; shrink it so it only claims what it uses
    el.style.width = '';
    el.style.width = `${Math.ceil(textRect(el).width) + 1}px`;
    const frame = hero.getBoundingClientRect();
    const s = anchor.getBoundingClientRect();
    const { width: w, height: h } = el.getBoundingClientRect();
    const name = hero.querySelector('.hero-name').getBoundingClientRect();
    const taken = [
      textRect(hero.querySelector('.hero-headline')),
      { left: frame.left, right: frame.right, top: frame.top, bottom: name.bottom },
      textRect(hero.querySelector('.hero-nav')),
      ...[...hero.querySelectorAll('.hero-closing')].map(textRect),
      ...[...hero.querySelectorAll('.stamp')].map((node) => node.getBoundingClientRect()),
    ];
    const cy = (s.top + s.bottom) / 2;
    const leftHalf = (s.left + s.right) / 2 < (frame.left + frame.right) / 2;
    const flush = leftHalf ? s.left : s.right - w; // lines up with the stamp's outer edge
    const right = { side: 'right', left: s.right + NOTE_GAP, top: cy - h / 2 };
    const left = { side: 'left', left: s.left - NOTE_GAP - w, top: cy - h / 2 };
    const spots = [
      leftHalf ? right : left,
      { side: 'below', left: flush, top: s.bottom + NOTE_GAP },
      leftHalf ? left : right,
      { side: 'above', left: flush, top: s.top - NOTE_GAP - h },
    ];
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
    const best = spots.map((c) => {
      const x = clamp(c.left, frame.left + NOTE_MARGIN, frame.right - NOTE_MARGIN - w);
      const y = clamp(c.top, frame.top + NOTE_MARGIN, frame.bottom - NOTE_MARGIN - h);
      const rect = { left: x, top: y, right: x + w, bottom: y + h };
      const cost = taken.reduce((sum, r) => sum + overlap(rect, r), c.side === 'above' ? NOTE_ABOVE_PENALTY : 0);
      return { ...c, left: x, top: y, cost };
    }).reduce((a, b) => (b.cost < a.cost ? b : a));
    el.dataset.side = best.side;
    el.dataset.align = best.side === 'left' || (!leftHalf && best.side !== 'right') ? 'end' : 'start';
    el.style.left = `${best.left - frame.left}px`;
    el.style.top = `${best.top - frame.top}px`;
  }
  addEventListener('resize', place);

  const fadeOut = (duration) => {
    const from = getComputedStyle(el).opacity;
    el.getAnimations().forEach((a) => a.cancel());
    return el.animate([{ opacity: from }, { opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
  };

  function hide() {
    const mine = ++seq;
    fadeOut(dur(200)).then(() => { if (mine === seq) el.textContent = ''; });
  }

  async function show(stamp, text, { instant = false } = {}) {
    clearTimeout(timer);
    const mine = ++seq;
    if (el.textContent && !instant) {
      await fadeOut(dur(120));
      if (mine !== seq) return;
    }
    el.getAnimations().forEach((a) => a.cancel());
    el.textContent = text;
    anchor = stamp;
    place();
    el.animate(
      [{ opacity: 0, transform: NOTE_ENTER[el.dataset.side] }, { opacity: 1, transform: 'none' }],
      { duration: instant ? 0 : dur(280), easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' },
    );
    timer = setTimeout(hide, NOTE_HOLD);
  }

  return { show, rect: () => textRect(el) };
}

function seenThisSession() {
  try {
    const seen = sessionStorage.getItem('journey-seen') === '1';
    sessionStorage.setItem('journey-seen', '1');
    return seen;
  } catch {
    return false;
  }
}

async function loadConfig() {
  try {
    const res = await fetch('data/stamps.config.json');
    if (res.ok) return { ...DEFAULT_CONFIG, ...(await res.json()) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

// With a mouse, the cursor carries the next chapter's stamp across the hero. Over its own
// place it lines itself up, and a click stamps it there; then the cursor picks up the next one.
// Touch and keyboard press the stamps directly, in any order
function stampInHand(hero, { layout, config, logos, onStamp }) {
  const carry = document.createElement('div');
  carry.className = 'stamp-carry';
  carry.setAttribute('aria-hidden', 'true');
  hero.append(carry);
  let stamps = [];
  let next = 0;
  let held = -1;
  let ready = false;
  let busy = false;
  let pointer = null;
  let frame;

  const done = () => next >= stamps.length;

  function hold(i) {
    if (i === held) return;
    held = i;
    const { chapter, rotate, width } = layout(i);
    carry.innerHTML = `<span class="stamp-carry-inner" style="width:calc(${width} * var(--u-stamp)); rotate:${rotate}deg">${stampSVG(chapter, config, logos, `carry-${chapter.key}`)}</span>`;
  }

  function show(visible) {
    carry.toggleAttribute('data-visible', visible);
    hero.toggleAttribute('data-carry', visible);
    if (!visible) carry.removeAttribute('data-snapped');
  }

  // 1:1 with the pointer, except over its own place, where it settles into position
  function follow() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (held < 0 || !pointer || !carry.hasAttribute('data-visible')) return;
      const box = hero.getBoundingClientRect();
      const home = stamps[held].getBoundingClientRect();
      const snapped = pointer.x >= home.left && pointer.x <= home.right && pointer.y >= home.top && pointer.y <= home.bottom;
      const x = snapped ? (home.left + home.right) / 2 : pointer.x;
      const y = snapped ? (home.top + home.bottom) / 2 : pointer.y;
      carry.toggleAttribute('data-snapped', snapped);
      carry.style.transform = `translate(${x - box.left}px, ${y - box.top}px)`;
    });
  }

  function track(target) {
    const visible = ready && !busy && !done() && !target.closest('a, .hero-name');
    if (visible) hold(next);
    show(visible);
    follow();
  }

  function advance(i) {
    if (!fine || i !== next) return; // touch and keyboard stamp in any order
    stamps[next].removeAttribute('data-next');
    next += 1;
    stamps[next]?.setAttribute('data-next', '');
  }

  if (fine) {
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY };
      track(e.target);
    });
    hero.addEventListener('pointerleave', () => show(false));
    hero.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType !== 'mouse' || !carry.hasAttribute('data-snapped')) return;
      const i = next;
      busy = true;
      show(false);
      onStamp(i);
      // Let the press finish before the next stamp is picked up
      setTimeout(() => {
        busy = false;
        const under = pointer && document.elementFromPoint(pointer.x, pointer.y);
        if (under && hero.contains(under)) track(under);
      }, dur(PRESS_DURATION) + 160);
    });
    addEventListener('scroll', follow, { passive: true });
  }

  return {
    // The mouse stamps on pointerdown while a stamp is in hand, so its click must not press twice
    handles: (e) => fine && e.detail !== 0 && !done(),
    advance,
    start(list) {
      stamps = list;
      next = 0;
      held = -1;
      ready = fine;
      if (fine) stamps[0].setAttribute('data-next', '');
    },
  };
}

// Once every chapter is stamped, a line under the headline points on to the work
function closingLine(hero) {
  const el = document.createElement('p');
  el.className = 'hero-closing';
  el.innerHTML = 'That’s the journey so far. <a href="#work">See the work</a> or <a href="#about">read about me</a>.';
  el.style.visibility = 'hidden'; // measurable, but not seen or focusable until revealed
  const headline = hero.querySelector('.hero-headline');
  const place = () => { el.style.top = `${textRect(headline).bottom - hero.getBoundingClientRect().top + 20}px`; };
  return {
    // In place but unseen, so the last note can find its spot around it
    prepare() {
      if (el.isConnected) return false;
      hero.append(el);
      place();
      addEventListener('resize', place);
      return true;
    },
    rect: () => textRect(el),
    reveal(delay) {
      el.style.visibility = '';
      el.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: dur(280), delay: dur(delay), easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      );
    },
  };
}

async function init(hero) {
  const [config, logos] = await Promise.all([loadConfig(), loadLogos(JOURNEY, 'assets/logos/')]);
  const layer = hero.querySelector('.stamps');
  const note = stampNote(hero);
  const closing = closingLine(hero);
  const instant = reduced || seenThisSession();
  let placed = layoutJourney(JOURNEY, config);
  let stamps = [];
  const stamped = new Set();

  function stampChapter(i, { keyboard = false } = {}) {
    const stamp = stamps[i];
    stamps.forEach((s) => s.removeAttribute('data-fresh'));
    stamp.setAttribute('data-fresh', '');
    press(stamp, true);
    thud();
    hand.advance(i);
    stamped.add(i);
    const last = stamped.size === stamps.length && closing.prepare();
    const shown = note.show(stamp, JOURNEY[i].note, { instant: keyboard }); // keyboard presses don't animate the text
    // On a crowded screen the last note can only sit where the closing line goes; then the line waits for it to fade
    if (last) shown.then(() => closing.reveal(overlap(note.rect(), closing.rect()) ? NOTE_HOLD + 200 : PRESS_DURATION + CLOSING_DELAY));
  }

  const hand = stampInHand(hero, { layout: (i) => placed[i], config, logos, onStamp: (i) => stampChapter(i) });

  const makeStamps = () => {
    placed = layoutJourney(JOURNEY, config);
    return placed.map(({ chapter, x, narrowX, y, rotate, width, opacity }, i) => {
      const stamp = document.createElement('button');
      stamp.type = 'button';
      stamp.className = 'stamp';
      stamp.setAttribute('aria-label', chapter.note);
      stamp.style.cssText = `--x:${x}%; --x-narrow:${narrowX}%; --rest:${opacity}; top:${y}%; width:calc(${width} * var(--u-stamp)); rotate:${rotate}deg; opacity:${opacity}`;
      stamp.innerHTML = `<span class="stamp-inner">${stampSVG(chapter, config, logos)}</span>`;
      stamp.addEventListener('click', (e) => {
        if (hand.handles(e)) return;
        stampChapter(i, { keyboard: e.detail === 0 });
      });
      return stamp;
    });
  };
  stamps = makeStamps();

  // Dev only: localhost:4321/?tweak puts the lab's controls on the real hero
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && new URLSearchParams(location.search).has('tweak')) {
    import('./lab/panel.js').then(({ mountStampPanel }) => mountStampPanel({
      config,
      collapsible: true,
      onChange: () => {
        stamps = makeStamps();
        stamped.clear();
        layer.replaceChildren(...stamps);
        hand.start(stamps);
      },
    }));
  }

  if (instant) {
    layer.append(...stamps);
    hand.start(stamps);
    return;
  }

  stamps.forEach((stamp, i) => setTimeout(() => {
    layer.append(stamp);
    press(stamp);
    if (i === stamps.length - 1) setTimeout(() => hand.start(stamps), PRESS_DURATION);
  }, 500 + i * STAMP_INTERVAL));
}

const hero = document.querySelector('[data-hero]');
if (hero) init(hero);

// The hero's paper holds a whole number of large squares, so its bottom edge lands on a major line like
// the top one. Each large square is a whole pixel (about 110–130px, so cells of 22–26px) and the hero is
// at most a few pixels shorter than its natural height. Measured from the window, never from the result
const paper = document.querySelector('.hero');
if (paper) {
  const fitGrid = () => {
    paper.style.minHeight = '';
    const natural = paper.offsetHeight;
    const majors = Math.max(1, Math.round(natural / 120));
    const major = Math.floor(natural / majors);
    paper.style.setProperty('--grid-cell', `${major / 5}px`);
    paper.style.minHeight = `${major * majors}px`;
  };
  fitGrid();
  addEventListener('resize', fitGrid);
}
