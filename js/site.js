// duoclash.app: the game list, its cards, and things settling in as they come into view. No libraries.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const games = window.GAMES || [];
  const art = (id) => `assets/games/${id}-poster.jpg`;
  const CATEGORY = { words: 'Words', numbers: 'Numbers', memory: 'Memory & speed', logic: 'Strategy' };

  // The header gets its line once the page moves.
  const top = $('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('seen');
      seen.unobserve(entry.target);
    }
  }, { threshold: 0.15 });
  $$('.reveal').forEach((el) => seen.observe(el));
  $$('[data-count]').forEach((el) => (el.textContent = games.length));

  // Every game as a poster, and one more tile asking for the next one.
  const grid = $('[data-grid]');
  const dialog = $('[data-dialog]');
  if (!grid) return;
  let order = [...games];
  let current = 0;
  grid.innerHTML = games.map((g) => `
    <button class="poster" data-id="${g.id}" data-cat="${g.category}" aria-label="${g.title}: how to play">
      <img src="${art(g.id)}" alt="" loading="lazy" width="480" height="640">
      <span class="cap"><b>${g.title}</b><small>${g.kind}</small></span>
    </button>`).join('') + `
    <a class="poster soon" href="mailto:support@duoclash.app?subject=Game%20idea%20for%20Duo%20Clash">
      <span><span class="plus">+</span><b>Your idea here</b><small>Tell us the game you want next</small></span>
    </a>`;

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
