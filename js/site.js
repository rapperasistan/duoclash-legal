// duoclash.app: the moving parts. No libraries.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const games = window.GAMES || [];
  const art = (id, kind = 'poster') => `assets/games/${id}-${kind}.jpg`;
  const CATEGORY = { words: 'Words', numbers: 'Numbers', memory: 'Memory & speed', logic: 'Strategy' };

  // Header gets its line once the page moves.
  const top = $('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // The ticker: every game, twice over so the loop never shows a seam.
  const ticker = $('[data-ticker]');
  if (ticker) {
    const names = games.map((g) => `<span>${g.title}</span>`).join('');
    ticker.innerHTML = names + names;
  }

  // The versus screen: a few moments from a night of games, one after another.
  const scenes = [
    { game: 'Guess the Celebrity', round: 'Round 5 · first to 3', her: 'her-1', him: 'him-2', score: [2, 2], pop: ['her', '😂'] },
    { game: 'Guess the Celebrity', round: 'Match point', her: 'her-4', him: 'him-4', score: [3, 2], pop: ['her', '🏆'] },
    { game: 'Four in a Row', round: 'Round 2 · first to 3', her: 'her-2', him: 'him-3', score: [0, 1], pop: ['him', '😏'] },
    { game: 'Chess', round: '10 min + 5 s', her: 'her-3', him: 'him-1', score: [1, 0], pop: ['her', '♛'] },
  ];
  const cams = { her: $('.cam.her'), him: $('.cam.him') };
  const swap = (cam, src) => {
    const [shown, next] = $$('img', cam);
    next.src = `assets/faces/${src}.jpg`;
    next.onload = () => {
      next.classList.remove('next');
      shown.classList.add('next');
      cam.appendChild(shown);
    };
  };
  const pop = (who, emoji) => {
    const cam = cams[who];
    const bubble = document.createElement('span');
    bubble.className = 'react';
    bubble.textContent = emoji;
    const box = cam.getBoundingClientRect();
    const stage = $('.versus').getBoundingClientRect();
    bubble.style.left = `${box.left - stage.left + box.width * 0.72}px`;
    bubble.style.top = `${box.top - stage.top + 14}px`;
    $('.versus').appendChild(bubble);
    setTimeout(() => bubble.remove(), 1700);
  };
  let scene = 0;
  const play = () => {
    const s = scenes[scene % scenes.length];
    swap(cams.her, s.her);
    swap(cams.him, s.him);
    $('[data-game]').textContent = s.game;
    $('[data-round]').textContent = s.round;
    $('[data-score="her"]').textContent = s.score[0];
    $('[data-score="him"]').textContent = s.score[1];
    $('[data-pts="her"]').textContent = s.score[0];
    $('[data-pts="him"]').textContent = s.score[1];
    setTimeout(() => pop(...s.pop), 450);
    scene++;
  };
  if (cams.her && !still) setTimeout(() => { play(); setInterval(play, 3600); }, 2600);

  // Things that wait to be seen.
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('seen');
      const demo = entry.target.dataset.demo;
      if (demo && demos[demo]) demos[demo](entry.target);
      seen.unobserve(entry.target);
    }
  }, { threshold: 0.25 });

  const demos = {
    // The code typed in, a digit at a time.
    code(step) {
      const digits = $$('.digits b', step);
      const paired = $('.paired', step);
      const run = () => {
        digits.forEach((d) => d.classList.remove('typed'));
        paired.classList.remove('on');
        digits.forEach((d, i) => setTimeout(() => d.classList.add('typed'), 400 + i * 260));
        setTimeout(() => paired.classList.add('on'), 400 + digits.length * 260 + 250);
      };
      run();
      if (!still) setInterval(run, 7000);
    },
    // The call coming in on a locked phone.
    call(step) {
      const banner = $('.banner', step);
      const run = () => {
        banner.classList.remove('on');
        setTimeout(() => banner.classList.add('on'), 500);
      };
      run();
      if (!still) setInterval(run, 6000);
    },
    // A quick game of four in a row; red wins on a slant.
    drop(step) {
      const board = $('[data-board]', step);
      board.innerHTML = '<i></i>'.repeat(42);
      const cells = $$('i', board);
      const moves = [[2, 'r'], [3, 'y'], [3, 'r'], [4, 'y'], [5, 'r'], [4, 'y'], [4, 'r'], [5, 'y'], [6, 'r'], [5, 'y'], [5, 'r']];
      const run = () => {
        cells.forEach((c) => (c.className = ''));
        const height = Array(7).fill(0);
        moves.forEach(([col, who], i) => {
          setTimeout(() => {
            const row = 5 - height[col]++;
            const cell = cells[row * 7 + col];
            cell.className = who;
            requestAnimationFrame(() => requestAnimationFrame(() => cell.classList.add('in')));
            if (i === moves.length - 1) {
              // Bottom row, column 2, up to the fourth row, column 5: four on a slant.
              setTimeout(() => [[5, 2], [4, 3], [3, 4], [2, 5]].forEach(([r, c]) => cells[r * 7 + c].classList.add('win')), 500);
            }
          }, 300 + i * 520);
        });
      };
      run();
      if (!still) setInterval(run, 300 + moves.length * 520 + 3200);
    },
  };

  $$('.reveal').forEach((el) => seen.observe(el));

  // The games: a poster each, filtered by kind, opened in a card.
  const grid = $('[data-grid]');
  const dialog = $('[data-dialog]');
  let order = [...games];
  let current = 0;
  if (grid) {
    $('[data-count]').textContent = games.length;
    grid.innerHTML = games.map((g, i) => `
      <button class="poster reveal" data-id="${g.id}" data-cat="${g.category}" style="transition-delay:${(i % 6) * 40}ms" aria-label="${g.title}: how to play">
        <img src="${art(g.id)}" alt="" loading="lazy" width="480" height="640">
        <span class="cap"><b>${g.title}</b><small>${g.kind}</small></span>
      </button>`).join('');
    $$('.poster', grid).forEach((el) => seen.observe(el));

    // Counts on the filters.
    $$('[data-filter]').forEach((btn) => {
      const f = btn.dataset.filter;
      const n = f === 'all' ? games.length : games.filter((g) => g.category === f).length;
      btn.insertAdjacentHTML('beforeend', `<sup>${n}</sup>`);
      btn.addEventListener('click', () => {
        $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        $$('.poster', grid).forEach((p) => p.classList.toggle('hide', f !== 'all' && p.dataset.cat !== f));
        order = games.filter((g) => f === 'all' || g.category === f);
      });
    });

    const open = (id, push = true) => {
      const index = order.findIndex((g) => g.id === id);
      const g = index >= 0 ? order[index] : games.find((x) => x.id === id);
      if (!g) return;
      current = Math.max(0, index);
      $('[data-d-art]').src = art(g.id);
      $('[data-d-kind]').textContent = `${CATEGORY[g.category]} · ${g.kind}`;
      $('[data-d-title]').textContent = g.title;
      $('[data-d-how]').textContent = g.how;
      const facts = ['2 players', 'On a video call', g.language];
      $('[data-d-facts]').innerHTML = facts.map((f) => `<span>${f}</span>`).join('');
      if (!dialog.open) dialog.showModal();
      if (push) history.replaceState(null, '', `#play/${g.id}`);
    };
    const close = () => {
      dialog.close();
    };
    dialog.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
    grid.addEventListener('click', (e) => {
      const poster = e.target.closest('.poster');
      if (poster) open(poster.dataset.id);
    });
    $('[data-close]').addEventListener('click', close);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    const step = (by) => open(order[(current + by + order.length) % order.length].id);
    $('[data-prev]').addEventListener('click', () => step(-1));
    $('[data-next]').addEventListener('click', () => step(1));
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    // A link straight to a game: duoclash.app/#play/chess
    const deep = location.hash.match(/^#play\/(\w+)/);
    if (deep) setTimeout(() => open(deep[1], false), 300);
  }

  // The week's countdown, ticking, and the points counting up when seen.
  const countdown = $('[data-countdown]');
  if (countdown) {
    let left = 4 * 86400 + 6 * 3600 + 12 * 60 + 40;
    const pad = (n) => String(n).padStart(2, '0');
    const draw = () => {
      const d = Math.floor(left / 86400), h = Math.floor(left / 3600) % 24, m = Math.floor(left / 60) % 60, s = left % 60;
      countdown.textContent = `${d}D ${pad(h)}:${pad(m)}:${pad(s)}`;
    };
    draw();
    setInterval(() => { left = Math.max(0, left - 1); draw(); }, 1000);
  }
  const counters = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const to = Number(el.dataset.countTo);
      if (still) { el.textContent = to; continue; }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1100);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counters.unobserve(el);
    }
  }, { threshold: 0.6 });
  $$('[data-count-to]').forEach((el) => counters.observe(el));
})();
