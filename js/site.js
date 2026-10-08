// duoclash.app: the game list, its cards, and things settling in as they come into view. No libraries.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const games = window.GAMES || [];
  const art = (id) => `assets/games/${id}-poster.jpg`;
  const CATEGORY = { words: 'Words', numbers: 'Numbers', memory: 'Memory & speed', logic: 'Strategy' };

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // On scroll, one frame at a time: the header frosts over, the hero's phones drift apart at their
  // own speeds, and the strip of screens slides sideways as the page goes down.
  const top = $('.top');
  const phones = $$('.fan .phone');
  const strip = $('.strip');
  let ticking = false;
  const frame = () => {
    ticking = false;
    const y = scrollY;
    top.style.setProperty('--s', clamp(y / 140, 0, 1).toFixed(3));
    if (still) return;
    if (y < innerHeight * 1.2) {
      [-0.16, -0.06, -0.24].forEach((k, i) => phones[i] && phones[i].style.setProperty('--p', `${(y * k).toFixed(1)}px`));
    }
    if (strip && innerWidth > 980) {
      const box = strip.getBoundingClientRect();
      const p = clamp((innerHeight - box.top) / (innerHeight + box.height), 0, 1);
      strip.scrollLeft = p * (strip.scrollWidth - strip.clientWidth);
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  frame();

  // The hero leans toward the pointer.
  const hero = $('.hero');
  const tilt = $('.fan .tilt');
  if (hero && tilt && fine && !still) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const yy = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
      tilt.style.setProperty('--rx', `${(-yy * 8).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); });
  }

  // The games count up the first time they're seen.
  $$('[data-count]').forEach((el) => {
    if (still) return;
    const to = games.length;
    const counter = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      counter.disconnect();
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / 1000);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    counter.observe(el);
  });

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('seen');
      seen.unobserve(entry.target);
    }
  }, { threshold: 0.15 });
  $$('.reveal').forEach((el) => seen.observe(el));

  // Every game as a poster, and one more tile asking for the next one.
  const grid = $('[data-grid]');
  const dialog = $('[data-dialog]');
  if (!grid) return;
  let order = [...games];
  let current = 0;
  grid.innerHTML = games.map((g, i) => `
    <button class="poster rv" style="--d:${(i % 8) * 0.05}s" data-id="${g.id}" data-cat="${g.category}" aria-label="${g.title}: how to play">
      <img src="${art(g.id)}" alt="" loading="lazy" width="480" height="640">
      <span class="cap"><b>${g.title}</b><small>${g.kind}</small></span>
    </button>`).join('') + `
    <a class="poster soon rv" style="--d:.2s" href="mailto:support@duoclash.app?subject=Game%20idea%20for%20Duo%20Clash">
      <span><span class="plus"><svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg></span><b>Your idea here</b><small>Tell us the game you want next</small></span>
    </a>`;

  $$('.poster.rv', grid).forEach((el) => seen.observe(el));
  if (fine && !still) {
    grid.addEventListener('pointermove', (e) => {
      const p = e.target.closest('.poster');
      if (!p) return;
      const r = p.getBoundingClientRect();
      p.style.setProperty('--ty', `${(((e.clientX - r.left) / r.width - 0.5) * 14).toFixed(2)}deg`);
      p.style.setProperty('--tx', `${(-((e.clientY - r.top) / r.height - 0.5) * 14).toFixed(2)}deg`);
    });
    grid.addEventListener('pointerout', (e) => {
      const p = e.target.closest('.poster');
      if (p && !p.contains(e.relatedTarget)) { p.style.setProperty('--ty', '0deg'); p.style.setProperty('--tx', '0deg'); }
    });
  }

  $$('[data-filter]').forEach((btn) => {
    const f = btn.dataset.filter;
    const n = f === 'all' ? games.length : games.filter((g) => g.category === f).length;
    btn.insertAdjacentHTML('beforeend', `<sup>${n}</sup>`);
    btn.addEventListener('click', () => {
      $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      $$('.poster[data-id]', grid).forEach((p) => p.classList.toggle('hide', f !== 'all' && p.dataset.cat !== f));
      order = games.filter((g) => f === 'all' || g.category === f);
    });
  });

  const open = (id) => {
    const index = order.findIndex((g) => g.id === id);
    const g = index >= 0 ? order[index] : games.find((x) => x.id === id);
    if (!g) return;
    current = Math.max(0, index);
    $('[data-d-art]').src = art(g.id);
    $('[data-d-kind]').textContent = `${CATEGORY[g.category]} · ${g.kind}`;
    $('[data-d-title]').textContent = g.title;
    $('[data-d-how]').textContent = g.how;
    $('[data-d-facts]').innerHTML = ['2 players', 'On a video call', g.language].map((f) => `<span>${f}</span>`).join('');
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, '', `#play/${g.id}`);
  };
  const step = (by) => open(order[(current + by + order.length) % order.length].id);
  grid.addEventListener('click', (e) => {
    const poster = e.target.closest('.poster[data-id]');
    if (poster) open(poster.dataset.id);
  });
  $('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
  $('[data-prev]').addEventListener('click', () => step(-1));
  $('[data-next]').addEventListener('click', () => step(1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  // A link straight to a game: duoclash.app/#play/chess
  const deep = location.hash.match(/^#play\/(\w+)/);
  if (deep) setTimeout(() => open(deep[1]), 300);
})();
