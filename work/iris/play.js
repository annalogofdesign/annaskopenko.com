// Plays a 1600×1000 drawing that defines window.render(t) inside a case study frame:
// scales it to the frame, runs it only while it's on screen, and holds one frame under
// reduced motion. ?t=4.2 holds that moment, for checking a frame.
// <script src="play.js" data-still="6"></script> after the drawing's own script.
(() => {
  const STILL = Number(document.currentScript.dataset.still || 0);
  const fit = () => { document.body.style.transform = `scale(${innerWidth / 1600})`; };
  addEventListener('resize', fit);
  fit();
  const at = new URLSearchParams(location.search).get('t');
  const still = at !== null || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = false, loaded = false, raf, last, t = 0;
  const loop = (now) => {
    t += last === undefined ? 0 : (now - last) / 1000;
    last = now;
    render(t);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!loaded) return;
    if (still) return render(at !== null ? Number(at) : STILL);
    if (!visible || raf) return;
    last = undefined;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = undefined; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); })
    .observe(document.documentElement);
  // Start once the fonts and every image (masks included, via a hidden <img>) are in,
  // so a slow image can't miss its own entrance
  const images = [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => {})));
  Promise.all([document.fonts.ready, ...images]).then(() => { loaded = true; window.place?.(); start(); });
})();
