// The route between the stamps, in Anna's own line (data/route.config.json), dotted in the stamps' ink.
// A first-time visitor couldn't tell which stamp to start with, so with a mouse the route grows as you
// stamp: in from the left edge to Ukraine, then on to each next chapter. On touch the stamps go in any
// order, so the whole route draws once instead. Phones move the stamps (narrowX), so they get no route.
// It passes under the stamps, and the dots step aside under the note.

const NS = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const phone = matchMedia('(max-width: 640px)');
const WHOLE_ROUTE = 2600; // ms, touch

const DEFAULT_ROUTE = { points: [], dot: 2.25, spacing: 8, opacity: 0.5, clearance: 10, leg: 900 };

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const n = (v) => v.toFixed(1);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

async function loadRoute() {
  try {
    const res = await fetch('data/route.config.json');
    if (res.ok) return { ...DEFAULT_ROUTE, ...(await res.json()) };
  } catch {}
  return DEFAULT_ROUTE;
}

// A smooth curve through the points: centripetal Catmull-Rom (no loops or cusps where the points
// bunch up), written out as cubic Béziers. Both ends carry straight on
function smoothPath(points) {
  const a = points[0];
  const z = points.at(-1);
  const pts = [{ x: 2 * a.x - points[1].x, y: 2 * a.y - points[1].y }, ...points, { x: 2 * z.x - points.at(-2).x, y: 2 * z.y - points.at(-2).y }];
  const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y) ** 0.5 || 1e-3;
  let d = `M${n(a.x)} ${n(a.y)}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const d1 = dist(p0, p1);
    const d2 = dist(p1, p2);
    const d3 = dist(p2, p3);
    const m1 = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2;
    const m2 = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2;
    const c1 = { x: (d1 * d1 * p2.x - d2 * d2 * p0.x + m1 * p1.x) / (3 * d1 * (d1 + d2)), y: (d1 * d1 * p2.y - d2 * d2 * p0.y + m1 * p1.y) / (3 * d1 * (d1 + d2)) };
    const c2 = { x: (d3 * d3 * p1.x - d2 * d2 * p3.x + m2 * p2.x) / (3 * d3 * (d3 + d2)), y: (d3 * d3 * p1.y - d2 * d2 * p3.y + m2 * p2.y) / (3 * d3 * (d3 + d2)) };
    d += ` C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return d;
}

// How far along the route each stamp sits: the closest point to its centre, never behind the last one
function stops(path, centres) {
  const total = path.getTotalLength();
  const samples = [];
  for (let l = 0; l <= total; l += 3) {
    const { x, y } = path.getPointAtLength(l);
    samples.push({ l, x, y });
  }
  let from = 0;
  return centres.map((c) => {
    const away = (k) => Math.hypot(samples[k].x - c.x, samples[k].y - c.y);
    let best = from;
    for (let k = from; k < samples.length; k++) if (away(k) < away(best)) best = k;
    from = best;
    return samples[best].l;
  });
}

export function stampRoute(hero) {
  const config = loadRoute();
  const note = hero.querySelector('.stamp-note');
  let stamps = [];
  let reached = -1; // the chapter the route has reached
  let layer = null;
  let anim;

  // The dots are revealed by a solid stroke in a mask, so they never slide while it draws.
  // The same mask cuts the route away under each stamp, and under the note's words
  function build(route) {
    const box = hero.getBoundingClientRect();
    const rects = stamps.map((s) => s.getBoundingClientRect());
    const d = smoothPath(route.points.map(([x, y]) => ({ x: x * box.width, y: y * box.height })));
    const svg = el('svg', { class: 'stamp-route', viewBox: `0 0 ${box.width} ${box.height}`, 'aria-hidden': 'true' });
    svg.style.setProperty('--route-dot', `${route.dot}px`);
    svg.style.setProperty('--route-spacing', `${route.spacing}px`);
    svg.style.setProperty('--route-opacity', route.opacity);
    const mask = el('mask', { id: 'stamp-route-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: box.width, height: box.height });
    const reveal = el('path', { d, class: 'stamp-route-reveal' });
    mask.append(reveal);
    for (const r of rects) {
      // The box includes the tilt, so the ink sits a little inside it
      const w = r.width * 0.92 + route.clearance * 2;
      const h = r.height * 0.92 + route.clearance * 2;
      const x = r.left - box.left + (r.width - w) / 2;
      const y = r.top - box.top + (r.height - h) / 2;
      mask.append(el('rect', { x: n(x), y: n(y), width: n(w), height: n(h), rx: n(Math.min(w, h) * 0.3) }));
    }
    const noteHole = el('rect', { class: 'stamp-route-gap', rx: 6 });
    const closingHole = el('rect', { class: 'stamp-route-gap', rx: 6 });
    mask.append(noteHole, closingHole);
    const defs = el('defs');
    defs.append(mask);
    svg.append(defs, el('path', { d, class: 'stamp-route-dots', mask: 'url(#stamp-route-mask)' }));
    hero.querySelector('.stamps').before(svg);

    const total = reveal.getTotalLength();
    const at = stops(reveal, rects.map((r) => ({ x: (r.left + r.right) / 2 - box.left, y: (r.top + r.bottom) / 2 - box.top })));
    reveal.style.strokeDasharray = `${total} ${total}`;
    let shown = 0;
    const show = (len) => { shown = len; reveal.style.strokeDashoffset = total - len; };
    show(0);

    // The note's words, and the closing line once it shows
    const clear = (hole, text, on) => {
      hole.toggleAttribute('data-on', on);
      if (!on) return;
      const range = document.createRange();
      range.selectNodeContents(text);
      const r = range.getBoundingClientRect();
      const pad = 10;
      hole.setAttribute('x', n(r.left - box.left - pad));
      hole.setAttribute('y', n(r.top - box.top - pad));
      hole.setAttribute('width', n(r.width + pad * 2));
      hole.setAttribute('height', n(r.height + pad * 2));
    };
    const clearText = () => {
      clear(noteHole, note, !!note.textContent);
      const closing = hero.querySelector('.hero-closing');
      if (closing) {
        watch.observe(closing, { attributes: true, attributeFilter: ['style'] });
        clear(closingHole, closing, closing.style.visibility !== 'hidden');
      }
    };
    const watch = new MutationObserver(clearText);
    watch.observe(note, { childList: true, attributes: true, attributeFilter: ['style'] });
    watch.observe(hero, { childList: true });
    clearText();

    return {
      to: (i) => at[Math.min(i, at.length - 1)],
      shown: () => shown,
      show,
      remove() { watch.disconnect(); svg.remove(); },
    };
  }

  function draw(to, duration, ease) {
    cancelAnimationFrame(anim);
    const from = layer.shown();
    if (reduced || duration <= 0) { layer.show(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      layer.show(from + (to - from) * ease(t));
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  async function reach(i, { animate = true } = {}) {
    const route = await config;
    if (route.points.length < 2 || phone.matches || !stamps.length) return;
    reached = i;
    layer ??= build(route);
    const to = layer.to(i);
    // A long leg takes a little longer than a short one
    const duration = fine ? route.leg * Math.min(1.6, Math.max(0.6, Math.abs(to - layer.shown()) / 260)) : WHOLE_ROUTE;
    draw(to, animate ? duration : 0, fine ? easeOut : easeInOut);
  }

  function rebuild() {
    cancelAnimationFrame(anim);
    layer?.remove();
    layer = null;
    if (reached >= 0) reach(reached, { animate: false });
  }
  addEventListener('resize', rebuild);
  phone.addEventListener('change', rebuild);

  return {
    start(list) {
      stamps = list;
      layer?.remove();
      layer = null;
      reach(fine ? 0 : list.length - 1);
    },
    // The mouse stamps in order: the route runs on to the next chapter
    reach: (i) => fine && reach(i),
  };
}
