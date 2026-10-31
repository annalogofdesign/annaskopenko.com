// A slim top bar takes over from the hero nav once it scrolls off the top,
// and marks the section you're in, plus which case study you've reached.

const dock = document.querySelector('[data-dock]');
const heroNav = document.querySelector('.hero-nav');

if (dock && heroNav) {
  const links = [...dock.querySelectorAll('.dock-nav a')];
  const sections = links.map((a) => document.querySelector(a.hash));
  const cases = [...document.querySelectorAll('.case')];
  const count = dock.querySelector('[data-count]');
  const pad = (n) => String(n).padStart(2, '0');

  const setShown = (shown) => {
    dock.toggleAttribute('data-shown', shown);
    dock.inert = !shown;
  };
  new IntersectionObserver(([entry]) => {
    setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(heroNav);

  let frame;
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const line = innerHeight * 0.4;
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      let active = sections.findLastIndex((s) => s.getBoundingClientRect().top < line);
      if (atBottom) active = sections.length - 1; // the last section can never reach the line
      links.forEach((a, i) => {
        if (i === active) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      const reached = cases.findLastIndex((c) => c.getBoundingClientRect().top < line);
      count.textContent = `${pad(Math.max(reached, 0) + 1)} / ${pad(cases.length)}`;
    });
  };
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
}
