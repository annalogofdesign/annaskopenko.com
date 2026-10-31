// Draws the wordmark wherever the page asks for it, from the config the lab saved.
// data-wordmark holds the size relative to the hero (the top bar runs smaller).

import { DEFAULT_WORDMARK, wordmarkHTML } from './wordmark.js';

const slots = [...document.querySelectorAll('[data-wordmark]')];

if (slots.length) {
  const config = { ...DEFAULT_WORDMARK };
  try {
    const res = await fetch(new URL('data/wordmark.config.json', import.meta.url));
    if (res.ok) Object.assign(config, await res.json());
  } catch {}

  slots.forEach((slot) => {
    const scale = Number(slot.dataset.wordmark) || 1;
    const px = config.wordSize * scale;
    // A real stamp shows less of its texture the smaller it's pressed, and below ~40px
    // the roughness just eats the monogram's thin strokes
    const badge = px * config.badgeSize;
    const texture = config.texture * Math.min(1, Math.max(0.25, badge / 40));
    // Same shape as the rest of the page: scales with the viewport, never below legible
    slot.innerHTML = wordmarkHTML({ ...config, texture }, { size: `clamp(${Math.round(px * 0.8)}px, calc(${px} * var(--u)), ${px}px)` });
  });
}
