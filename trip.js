// The trip by date, on the map: drag along a faint line for the whole trip and the map shows where Anna
// was that day. The route redraws in the order she travelled up to then, the stops she hadn't reached
// fade, and a ring marks the spot; on the last day the NOW stamp shows instead. Days and places come
// from data/trip.config.json ("visits"); without JS the map shows the whole route as built.

const NS = 'http://www.w3.org/2000/svg';
const DAY = 86400000;
const INSET = 5; // the marker's radius, so the first and last days sit on the line's ends

const at = (s) => new Date(s + 'T12:00:00');
const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

async function loadVisits() {
  try {
    const res = await fetch('data/trip.config.json');
    if (res.ok) return (await res.json()).visits || [];
  } catch {}
  return [];
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

async function init() {
  const wrap = document.querySelector('.away-map-wrap');
  const svg = wrap?.querySelector('.away-map');
  const visits = await loadVisits();
  if (!svg || !visits.length) return;

  const days = [];
  visits.forEach((v, i) => {
    for (let t = at(v.from); t <= at(v.to); t = new Date(+t + DAY)) days.push({ date: t, visit: i });
  });
  const last = days.length - 1;

  const stops = {};
  svg.querySelectorAll('.map-pin[data-stop]').forEach((pin) => {
    const c = pin.querySelector('circle');
    stops[pin.dataset.stop] = { x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), pin, label: svg.querySelector(`.map-stop[data-stop="${pin.dataset.stop}"]`) };
  });
  if (!visits.every((v) => stops[v.stop])) return;
  const route = svg.querySelector('.map-route');
  const stamp = svg.querySelector('.map-now-stamp');
  const here = document.createElementNS(NS, 'circle');
  here.setAttribute('class', 'map-here');
  here.setAttribute('r', 12);
  svg.append(here);

  const strip = el('div', 'trip');
  const caption = el('div', 'trip-caption');
  caption.setAttribute('aria-hidden', 'true'); // the slider's value text says the same
  const track = el('div', 'track');
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Day of the trip');
  track.setAttribute('aria-valuemin', 0);
  track.setAttribute('aria-valuemax', last);
  track.innerHTML = '<span class="track-rail"></span><span class="track-done"></span>';
  const done = track.querySelector('.track-done');
  const pos = (j) => `calc(${INSET}px + (100% - ${2 * INSET}px) * ${j / last})`;
  // A dot where each stop begins
  const firsts = days.flatMap((d, j) => (!j || d.visit !== days[j - 1].visit ? [j] : []));
  const dots = firsts.map((j) => {
    const dot = el('span', 'track-stop');
    dot.style.left = pos(j);
    track.append(dot);
    return { dot, day: j };
  });
  const mark = el('span', 'track-mark');
  track.append(mark);
  strip.append(caption, track);

  let value = last;
  const draw = (i) => {
    value = Math.max(0, Math.min(last, i));
    const day = days[value], visit = visits[day.visit];
    const seen = new Set(), path = [];
    for (let k = 0; k <= day.visit; k++) {
      const s = stops[visits[k].stop];
      seen.add(visits[k].stop);
      if (path[path.length - 1] !== s) path.push(s);
    }
    route.setAttribute('points', path.map((s) => `${s.x},${s.y}`).join(' '));
    for (const [name, s] of Object.entries(stops)) {
      s.pin.toggleAttribute('data-later', !seen.has(name));
      s.label?.toggleAttribute('data-later', !seen.has(name));
    }
    const s = stops[visit.stop];
    here.setAttribute('cx', s.x);
    here.setAttribute('cy', s.y);
    here.style.display = value === last ? 'none' : '';
    if (stamp) stamp.style.display = value === last ? '' : 'none';

    done.style.width = pos(value);
    mark.style.left = pos(value);
    dots.forEach(({ dot, day: j }) => dot.toggleAttribute('data-later', j > value));
    const when = value === last ? 'Today' : fmtDay(day.date);
    caption.innerHTML = `<span class="trip-day">${when}</span><span class="trip-place">${visit.place}${visit.area ? ` <small>· ${visit.area}</small>` : ''}</span>`;
    track.setAttribute('aria-valuenow', value);
    track.setAttribute('aria-valuetext', `${when}, ${visit.place}`);
  };

  const dayAt = (x) => {
    const r = track.getBoundingClientRect();
    return Math.round(((x - r.left - INSET) / (r.width - 2 * INSET)) * last);
  };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    draw(dayAt(e.clientX));
    const move = (ev) => { const j = Math.max(0, Math.min(last, dayAt(ev.clientX))); if (j !== value) draw(j); };
    const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
  });
  track.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    let to = null;
    if (step) to = value + step;
    if (e.key === 'Home') to = 0;
    if (e.key === 'End') to = last;
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      // A stop at a time
      const v = days[value].visit + (e.key === 'PageUp' ? 1 : -1);
      const j = days.findIndex((d) => d.visit === v);
      if (j >= 0) to = j;
    }
    if (to !== null) { e.preventDefault(); draw(to); }
  });

  // Shown until the line is first used, and not again on a later visit
  let used = false;
  try { used = localStorage.getItem('trip-hint') === '1'; } catch {}
  if (!used) {
    const hint = el('p', 'trip-hint');
    hint.textContent = 'drag to see where I’ve been';
    strip.append(hint);
    const gone = () => {
      hint.dataset.gone = '';
      hint.setAttribute('aria-hidden', 'true');
      try { localStorage.setItem('trip-hint', '1'); } catch {}
    };
    track.addEventListener('pointerdown', gone, { once: true });
    track.addEventListener('keydown', gone, { once: true });
  }

  wrap.append(strip);
  draw(last);
}

init();
