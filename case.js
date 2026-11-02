// Case study pages: the contents list in the left rail marks the section you're reading.
// The animations play themselves (work/<case>/*.html): only on screen, and held still under reduced motion.

const links = [...document.querySelectorAll('.cs-toc a')];
const sections = links.map((a) => document.querySelector(a.hash));

let frame;
function sync() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const line = innerHeight * 0.4;
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    let active = sections.findLastIndex((s) => s.getBoundingClientRect().top < line);
    if (atBottom) active = sections.length - 1; // the last section can never reach the line
    links.forEach((a, i) => {
      if (i === Math.max(active, 0)) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });
}
if (links.length) {
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
}
