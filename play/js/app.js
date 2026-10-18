// Duo Clash on the web: the same accounts, couples, rooms and video call as the iPhone app, so a
// couple can play with one on a laptop or an Android phone and the other on an iPhone.
//   welcome: a name and a face, and the account is made (no email, no password, like the app)
//   pair:    your code to give, or theirs to type; duoclash.app/play/#pair/123456 pairs straight away
//   home:    the two of you, this week's points, the call, the games and any game waiting to be joined
//   room:    #room/<id>, the game itself, with the two cameras beside it
import { call, Failure, token } from './api.js';
import { avatarSVG, AVATARS, face } from './avatar.js';
import { Call } from './call.js';
import { icon } from './icons.js';
import { RoomLine, secondsLeft } from './room.js';
import xox from './games/xox.js';
import fourRow from './games/fourRow.js';

// The games the web plays so far; the rest are the app's until they're here too.
const PLAYABLE = { xox, fourRow };
const CATALOG = window.GAMES ?? [];
const gameTitle = (id) => CATALOG.find((game) => game.id === id)?.title ?? 'A game';
const poster = (id) => `../assets/games/${id}-poster.jpg`;
const APP_STORE = 'https://apps.apple.com/app/id6820255172';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const language = () => (navigator.language || 'en').split('-')[0].toLowerCase();

const app = $('.app');
const view = $('#view');
const tiles = $('#call');
const state = { me: null, couple: null, waiting: null };
const session = new Call();
const line = new RoomLine();
let poll = null;
let tick = null;
let before = null; // the room as it was before the last change, for what's new on the board
let opened = null; // the room whose line is open

// Small things

function toast(text, kind = '') {
  const box = $('#toast');
  box.textContent = text;
  box.className = `toast show ${kind}`;
  clearTimeout(box.hide);
  box.hide = setTimeout(() => (box.className = 'toast'), 3600);
}

function show(name, html) {
  app.dataset.view = name;
  view.innerHTML = html;
  view.scrollTop = 0;
  renderTiles();
}

function stopPolling() {
  clearInterval(poll);
  poll = null;
}

function partner() {
  return state.couple?.members.find((member) => member.id !== state.me?.id) ?? null;
}

function applyHome(home) {
  state.me = home.me;
  const groups = home.groups ?? [];
  state.couple = groups.find((group) => group.members.length >= 2) ?? null;
  state.waiting = groups.find((group) => group.members.length < 2) ?? null;
  renderBar();
}

function renderBar() {
  const me = state.me;
  $('#who').innerHTML = me ? `${face(me, 30)}<span>${esc(me.name)}</span>` : '';
  $('#more').hidden = !me;
}

// Start

async function boot() {
  const invite = location.hash.match(/^#pair\/(\d{6})$/)?.[1];
  if (invite) sessionStorage.setItem('invite', invite);
  if (!token.get()) return welcome();
  try {
    applyHome(await call('GET', 'me'));
  } catch (error) {
    if (error.status === 401) {
      token.set(null);
      return welcome();
    }
    return offline(error);
  }
  route();
}

function offline(error) {
  show('welcome', `<section class="center"><div class="card narrow">
    <div class="glyph">${icon('wifiOff')}</div>
    <h1>Can’t reach Duo Clash</h1>
    <p class="dim">${esc(error.message)}</p>
    <button class="primary" data-retry>Try again</button>
  </div></section>`);
  $('[data-retry]').onclick = boot;
}

/** Where the address says to be: a room, or home (or pairing first, when there's nobody yet). */
function route() {
  stopPolling();
  if (!state.me) return welcome();
  if (!state.couple) {
    if (location.hash.startsWith('#room/')) history.replaceState(null, '', location.pathname);
    return pair();
  }
  const roomId = location.hash.match(/^#room\/([\w-]+)$/)?.[1];
  if (roomId) return enterRoom(roomId);
  if (opened) leaveRoom();
  home();
}

addEventListener('hashchange', route);

// Welcome

function welcome() {
  let avatar = Math.floor(Math.random() * AVATARS);
  show('welcome', `<section class="center"><form class="card narrow" data-welcome>
    <img class="logo" src="../assets/icon-512.png" alt="" width="72" height="72">
    <h1>Play face to face</h1>
    <p class="dim">Duo Clash in your browser. Pick a name and a face, pair with your person, and play on a video call. They can be on a laptop, an Android phone or the iPhone app.</p>
    <label class="field"><span>Your name</span><input name="name" maxlength="20" autocomplete="nickname" placeholder="Leo" required></label>
    <div class="field"><span>Your face</span><div class="avatars">${Array.from({ length: AVATARS }, (_, i) => `
      <button type="button" class="avatar ${i === avatar ? 'on' : ''}" data-avatar="${i}" aria-label="Face ${i + 1}">${avatarSVG(i)}</button>`).join('')}
    </div></div>
    <button class="primary wide" type="submit">Continue</button>
    <p class="fine">By continuing you agree to the <a href="../terms.html">Terms</a> and the <a href="../privacy.html">Privacy Policy</a>.</p>
  </form></section>`);
  const form = $('[data-welcome]');
  form.addEventListener('click', (event) => {
    const button = event.target.closest('[data-avatar]');
    if (!button) return;
    avatar = Number(button.dataset.avatar);
    form.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('on', b === button));
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      const made = await call('POST', 'accounts', { name: form.name.value, avatar });
      token.set(made.token);
      applyHome(await call('GET', 'me'));
      route();
    } catch (error) {
      toast(error.message, 'bad');
      submit.disabled = false;
    }
  });
  form.name.focus();
}

// Pairing

async function pair() {
  const invite = sessionStorage.getItem('invite');
  if (invite) {
    sessionStorage.removeItem('invite');
    try {
      await call('POST', 'groups/join', { code: invite });
      applyHome(await call('GET', 'me'));
      if (state.couple) {
        toast(`Paired with ${partner()?.name}. Time to play.`);
        history.replaceState(null, '', location.pathname);
        return route();
      }
    } catch (error) {
      toast(error.message, 'bad');
    }
  }
  if (!state.waiting) {
    try {
      const made = await call('POST', 'groups');
      state.waiting = made.group;
    } catch (error) {
      return offline(error);
    }
  }
  const code = state.waiting.code;
  const link = `${location.origin}${location.pathname}#pair/${code}`;
  show('pair', `<section class="center"><div class="card pairing">
    <div class="half">
      <p class="eyebrow">${icon('link')} Your code</p>
      <h1>Send this to your person</h1>
      <div class="code" aria-label="Your code ${code}">${[...code].map((d) => `<span>${d}</span>`).join('')}</div>
      <p class="dim">They type it in Duo Clash on their iPhone, or open your link in any browser.</p>
      <div class="row">
        <button class="primary" data-copy>${icon('copy')} Copy link</button>
        ${navigator.share ? `<button class="ghost" data-share>Share</button>` : ''}
      </div>
      <p class="waiting"><i></i> Waiting for them to pair</p>
    </div>
    <form class="half other" data-join>
      <p class="eyebrow">${icon('check')} Got their code?</p>
      <h2>Type it here</h2>
      <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" class="code-input" required>
      <button class="primary wide" type="submit">Pair</button>
    </form>
  </div></section>`);
  $('[data-copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. Send it to your person.');
    } catch {
      toast(link);
    }
  };
  $('[data-share]')?.addEventListener('click', () => navigator.share({ title: 'Duo Clash', text: `Pair with me on Duo Clash: ${code}`, url: link }).catch(() => {}));
  const form = $('[data-join]');
  form.code.addEventListener('input', () => (form.code.value = form.code.value.replace(/\D/g, '').slice(0, 6)));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await call('POST', 'groups/join', { code: form.code.value });
      applyHome(await call('GET', 'me'));
      toast(`Paired with ${partner()?.name}. Time to play.`);
      route();
    } catch (error) {
      toast(error.message, 'bad');
    }
  });
  // The other side pairing with this code shows up here.
  poll = setInterval(async () => {
    try {
      applyHome(await call('GET', 'me'));
      if (state.couple) {
        toast(`${partner()?.name} paired with you. Time to play.`);
        route();
      }
    } catch {}
  }, 3000);
}

// Home

function home() {
  const them = partner();
  const playable = CATALOG.filter((game) => PLAYABLE[game.id]);
  const later = CATALOG.filter((game) => !PLAYABLE[game.id]);
  show('home', `<section class="home">
    <div class="duo">
      <div class="faces">${face(state.me, 56)}${face(them, 56)}</div>
      <div>
        <p class="eyebrow">${icon('trophy')} This week</p>
        <h1>You &amp; ${esc(them?.name)}</h1>
        <div class="board" data-board></div>
      </div>
      <div class="call-cta" data-cta></div>
    </div>
    <div data-rooms></div>
    <div class="shelf-head"><h2>Play now</h2><p class="dim">Tap a game: ${esc(them?.name)} gets a notification and joins you.</p></div>
    <div class="games">${playable.map((game) => `
      <button class="game" data-open="${game.id}">
        <img src="${poster(game.id)}" alt="" loading="lazy" width="480" height="640">
        <span class="cap"><b>${esc(game.title)}</b><small>${esc(game.kind)}</small></span>
      </button>`).join('')}
    </div>
    <div class="shelf-head"><h2>Coming to the web</h2><p class="dim">On the iPhone app today. New ones land here every week.</p></div>
    <div class="games later">${later.map((game) => `
      <div class="game off">
        <img src="${poster(game.id)}" alt="" loading="lazy" width="480" height="640">
        <span class="cap"><b>${esc(game.title)}</b><small>${icon('phone')} iPhone app</small></span>
      </div>`).join('')}
    </div>
  </section>`);
  renderCouple();
  view.querySelector('.games').addEventListener('click', (event) => {
    const button = event.target.closest('[data-open]');
    if (button) openRoom(button.dataset.open, button);
  });
  poll = setInterval(refreshCouple, 3000);
}

async function refreshCouple() {
  if (!state.couple) return;
  try {
    const { group } = await call('GET', `groups/${state.couple.id}`);
    const known = new Set((state.couple.rooms ?? []).map((room) => room.id));
    state.couple = group;
    // A game the partner just opened: said out loud, not only listed.
    const fresh = (group.rooms ?? []).find((room) => !known.has(room.id) && room.host !== state.me.id && room.phase === 'lobby');
    if (fresh) {
      toast(`${partner()?.name} opened ${gameTitle(fresh.game)}. Join them.`);
      document.title = `${partner()?.name} opened ${gameTitle(fresh.game)} · Duo Clash`;
    }
    if (app.dataset.view === 'home') renderCouple();
  } catch (error) {
    // Unpaired from the other side.
    if (error.code === 'group_gone' || error.status === 404 || error.status === 403) {
      session.hangUp();
      applyHome(await call('GET', 'me').catch(() => ({ me: state.me, groups: [] })));
      toast('You’re not paired any more.');
      route();
    }
  }
}

function renderCouple() {
  const couple = state.couple;
  const them = partner();
  const points = (id) => couple.board?.find((row) => row.id === id)?.points ?? 0;
  const board = $('[data-board]');
  if (board) {
    const days = Math.max(1, Math.ceil((couple.weekEndsAt - Date.now()) / 86400000));
    board.innerHTML = `<span><b>${points(state.me.id)}</b> you</span><span class="vs">vs</span><span><b>${points(them?.id)}</b> ${esc(them?.name)}</span><span class="dim">· ${days} day${days === 1 ? '' : 's'} left</span>`;
  }
  const cta = $('[data-cta]');
  if (cta) {
    const theyreIn = (couple.call ?? []).includes(them?.id);
    if (session.on) cta.innerHTML = `<button class="ghost" data-hang>${icon('hangUp')} End call</button>`;
    else cta.innerHTML = `<button class="primary ${theyreIn ? 'pulse' : ''}" data-ring>${icon('video')} ${theyreIn ? `Join ${esc(them?.name)}’s call` : 'Video call'}</button>`;
    $('[data-ring]', cta)?.addEventListener('click', () => session.start(couple.id, { ring: !theyreIn }));
    $('[data-hang]', cta)?.addEventListener('click', () => session.hangUp());
  }
  const rooms = $('[data-rooms]');
  if (rooms) {
    const open = (couple.rooms ?? []).filter((room) => room.phase !== 'finished');
    rooms.innerHTML = open.map((room) => {
      const host = room.players.find((player) => player.id === room.host);
      const mine = room.host === state.me.id;
      const can = Boolean(PLAYABLE[room.game]);
      return `<div class="waiting-room">
        <img src="${poster(room.game)}" alt="">
        <div><b>${mine ? `Your ${esc(gameTitle(room.game))} is open` : `${esc(host?.name ?? them?.name)} opened ${esc(gameTitle(room.game))}`}</b>
        <small>${can ? (room.phase === 'lobby' ? 'Waiting in the lobby' : 'Under way') : 'This one is on the iPhone app for now'}</small></div>
        ${can ? `<button class="primary" data-join="${room.id}">${icon('play')} ${mine ? 'Back in' : 'Join'}</button>` : ''}
      </div>`;
    }).join('');
    rooms.querySelectorAll('[data-join]').forEach((button) => (button.onclick = () => joinRoom(button.dataset.join)));
  }
}

async function openRoom(game, button) {
  if (button) button.disabled = true;
  try {
    const { room } = await call('POST', `groups/${state.couple.id}/rooms`, { game, seats: 2, language: language() });
    line.open(room.id, room);
    opened = room.id;
    location.hash = `#room/${room.id}`;
  } catch (error) {
    toast(error.message, 'bad');
    if (button) button.disabled = false;
  }
}

function joinRoom(id) {
  location.hash = `#room/${id}`;
}

// The room

function enterRoom(id) {
  if (opened !== id) {
    line.open(id);
    opened = id;
  }
  // The call goes on from one game to the next; walking into a game joins it, without ringing.
  if (!session.on) session.start(state.couple.id, { ring: false });
  show('room', `<section class="room">
    <div class="room-top">
      <button class="round" data-back aria-label="Back">${icon('back')}</button>
      <h1 data-title></h1>
      <span class="pill" data-target></span>
    </div>
    <p class="status" data-status></p>
    <div class="board-wrap"><div class="board" data-game></div><div class="overlay" data-overlay></div></div>
  </section>`);
  $('[data-back]').onclick = () => (location.hash = '');
  renderRoom();
  clearInterval(tick);
  tick = setInterval(renderClock, 200);
}

function leaveRoom() {
  line.close();
  line.room = null;
  opened = null;
  before = null;
  clearInterval(tick);
  renderTiles();
}

const nameOf = (id) => (id === state.me?.id ? 'You' : line.room?.players.find((player) => player.id === id)?.name ?? partner()?.name ?? 'They');

line.addEventListener('room', () => {
  if (app.dataset.view === 'room') renderRoom();
  before = structuredClone(line.room);
});
line.addEventListener('problem', () => toast(line.problem.error, 'bad'));
line.addEventListener('refused', () => {
  toast(line.refusal.error, 'bad');
  opened = null;
  line.room = null;
  if (location.hash.startsWith('#room/')) location.hash = '';
});

function renderRoom() {
  const room = line.room;
  const title = $('[data-title]');
  if (!title) return;
  if (!room) {
    title.textContent = 'Joining…';
    $('[data-overlay]').innerHTML = `<div class="sheet"><div class="spinner"></div></div>`;
    renderTiles();
    return;
  }
  const game = PLAYABLE[room.game];
  const me = state.me.id;
  title.textContent = gameTitle(room.game);
  $('[data-target]').innerHTML = room.target ? `${icon('flag')} First to ${room.target} point${room.target === 1 ? '' : 's'}` : '';
  $('[data-target]').hidden = !room.target;
  const send = (type, fields) => line.send(type, fields);
  const board = $('[data-game]');
  if (game && room.phase !== 'lobby' && room.phase !== 'countdown') {
    game.render(board, { room, me, send, before, name: nameOf });
    $('[data-status]').textContent = room.paused ? `Waiting for ${partner()?.name} to come back` : room.phase === 'finished' ? '' : game.status({ room, me, name: nameOf });
  } else {
    board.innerHTML = '';
    $('[data-status]').textContent = '';
  }
  renderOverlay(room, game);
  renderTiles();
}

function renderOverlay(room, game) {
  const overlay = $('[data-overlay]');
  const me = state.me.id;
  const them = room.players.find((player) => player.id !== me);
  const theirName = esc(them?.name ?? partner()?.name);
  if (!game) {
    overlay.innerHTML = `<div class="sheet"><img class="art" src="${poster(room.game)}" alt="">
      <h2>${esc(gameTitle(room.game))} is on the iPhone app for now</h2>
      <p class="dim">It’s coming to the web soon. Pick one of the web games instead.</p>
      <button class="primary" data-home>Back to games</button></div>`;
    $('[data-home]', overlay).onclick = () => (location.hash = '');
    return;
  }
  if (room.phase === 'lobby') {
    const mine = room.players.find((player) => player.id === me);
    overlay.innerHTML = `<div class="sheet"><img class="art" src="${poster(room.game)}" alt="">
      <h2>${esc(gameTitle(room.game))}</h2>
      <p class="dim how">${esc(CATALOG.find((g) => g.id === room.game)?.how ?? '')}</p>
      <div class="seats">${[mine, them].map((player, i) => player
        ? `<span class="seat ${player.ready ? 'ready' : ''}">${face(player, 34)}<b>${player.id === me ? 'You' : esc(player.name)}</b><small>${player.ready ? `${icon('check')} Ready` : player.here ? 'Getting ready' : 'Away'}</small></span>`
        : `<span class="seat empty"><span class="face" style="--size:34px"></span><b>${theirName}</b><small>On the way</small></span>`).join('')}</div>
      ${mine?.ready
        ? `<p class="dim">You’re ready. It starts when ${theirName} is.</p>`
        : `<button class="primary wide" data-ready>I’m ready</button>`}
    </div>`;
    $('[data-ready]', overlay)?.addEventListener('click', () => line.send('ready'));
    return;
  }
  if (room.phase === 'countdown') {
    overlay.innerHTML = `<div class="count" data-count></div>`;
    renderClock();
    return;
  }
  if (room.phase === 'finished') {
    const you = room.players.find((player) => player.id === me);
    const result = !them || you.score === them.score ? 'A draw' : you.score > them.score ? 'You won' : `${theirName} won`;
    const rematch = room.rematch;
    let actions;
    if (rematch && rematch.yes.includes(me)) {
      actions = `<p class="dim">Waiting for ${theirName} to say they’re in…</p>`;
    } else if (rematch) {
      actions = `<p>${theirName} wants ${rematch.game === room.game ? 'another round' : `to play ${esc(gameTitle(rematch.game))}`}.</p>
        <button class="primary wide" data-again="${rematch.game}">I’m in</button>`;
    } else {
      const others = Object.keys(PLAYABLE).filter((id) => id !== room.game);
      actions = `${room.rematchFailed ? `<p class="dim">${theirName} didn’t join that one.</p>` : ''}
        <button class="primary wide" data-again="${room.game}">${icon('again')} Play again</button>
        <div class="row">${others.map((id) => `<button class="ghost" data-again="${id}">${esc(gameTitle(id))}</button>`).join('')}
        <button class="ghost" data-home>${icon('grid')} All games</button></div>`;
    }
    overlay.innerHTML = `<div class="sheet result">
      <p class="eyebrow">${icon('trophy')} Game over</p>
      <h2>${result}</h2>
      <div class="score"><span>${face(you, 44)}<b>${you?.score ?? 0}</b></span><i>–</i><span><b>${them?.score ?? 0}</b>${face(them, 44)}</span></div>
      ${actions}
    </div>`;
    overlay.querySelectorAll('[data-again]').forEach((button) => (button.onclick = () => line.send('again', { game: button.dataset.again })));
    $('[data-home]', overlay)?.addEventListener('click', () => (location.hash = ''));
    return;
  }
  overlay.innerHTML = room.paused ? `<div class="sheet small"><div class="spinner"></div><p>${theirName} left the game. It goes on when they’re back.</p></div>` : '';
}

/** The parts that move with the clock: the 3-2-1. */
function renderClock() {
  const count = $('[data-count]');
  if (!count || line.room?.phase !== 'countdown') return;
  const left = Math.ceil(secondsLeft(line) ?? 0);
  const text = left > 0 ? String(left) : 'Go';
  if (count.textContent !== text) {
    count.textContent = text;
    count.classList.remove('beat');
    void count.offsetWidth;
    count.classList.add('beat');
  }
}

// The two cameras

const partnerVideo = $('[data-remote]');
const myVideo = $('[data-local]');

function renderTiles() {
  const inRoom = app.dataset.view === 'room';
  const room = inRoom ? line.room : null;
  const them = partner();
  tiles.hidden = !(inRoom || session.on);
  tiles.dataset.call = session.status;
  if (myVideo.srcObject !== session.local) myVideo.srcObject = session.local;
  if (partnerVideo.srcObject !== session.remote) partnerVideo.srcObject = session.remote;
  const hasPartner = Boolean(session.remote) && session.status === 'connected' && !session.partnerAway;
  const hasMe = Boolean(session.local) && session.camera;
  tiles.querySelector('.tile.them').classList.toggle('live', hasPartner);
  tiles.querySelector('.tile.you').classList.toggle('live', hasMe);
  const game = room && PLAYABLE[room.game];
  const people = { them: room?.players.find((player) => player.id !== state.me?.id) ?? them, you: room?.players.find((player) => player.id === state.me?.id) ?? state.me };
  for (const [key, person] of Object.entries(people)) {
    const tile = tiles.querySelector(`.tile.${key}`);
    tile.querySelector('.who').innerHTML = face(person, 72);
    tile.querySelector('.label').textContent = key === 'you' ? 'You' : person?.name ?? '';
    const playing = room && room.phase !== 'lobby' && game;
    tile.querySelector('.badge').textContent = playing ? person?.score ?? 0 : '';
    tile.querySelector('.badge').hidden = !playing;
    const mark = playing && game.mark ? game.mark(room, person?.id) : null;
    tile.querySelector('.mark').innerHTML = mark ? mark.svg : '';
    tile.querySelector('.mark').style.setProperty('--c', mark?.color ?? 'transparent');
    tile.querySelector('.mark').classList.toggle('fill', Boolean(mark?.fill));
    const turn = room?.xox?.turn ?? room?.drop?.turn;
    tile.classList.toggle('turn', Boolean(playing && room.phase === 'racing' && turn === person?.id));
  }
  const note = tiles.querySelector('.note');
  note.textContent = session.status === 'failed' ? `${them?.name} can’t see you yet`
    : session.partnerAway ? `${them?.name}’s connection dropped`
    : session.status === 'waiting' ? `Waiting for ${them?.name} to join the call`
    : session.status === 'connecting' ? 'Connecting…'
    : session.status === 'idle' && inRoom ? 'Camera off' : '';
  note.hidden = !note.textContent || hasPartner;
  $('[data-mic]').innerHTML = icon(session.mic ? 'mic' : 'micOff');
  $('[data-mic]').classList.toggle('off', !session.mic);
  $('[data-cam]').innerHTML = icon(session.camera ? 'video' : 'videoOff');
  $('[data-cam]').classList.toggle('off', !session.camera);
  $('[data-hang]').hidden = !session.on;
  $('[data-start]').hidden = session.on || !state.couple;
}

$('[data-mic]').onclick = () => session.toggleMic();
$('[data-cam]').onclick = () => session.toggleCamera();
$('[data-hang]').onclick = () => session.hangUp();
$('[data-start]').onclick = () => state.couple && session.start(state.couple.id, { ring: true });
session.addEventListener('change', () => {
  renderTiles();
  if (app.dataset.view === 'home') renderCouple();
  if (session.status === 'failed' && session.failure) toast(session.failure, 'bad');
});

// The menu: unpair, the account, the app

const menu = $('#menu');
$('#more').onclick = () => {
  const them = partner();
  menu.innerHTML = `<form method="dialog" class="menu">
    <div class="me">${face(state.me, 44)}<div><b>${esc(state.me.name)}</b><small>${them ? `Paired with ${esc(them.name)}` : 'Not paired yet'}</small></div></div>
    <a class="item" href="${APP_STORE}" target="_blank" rel="noopener">${icon('phone')} Get the iPhone app</a>
    ${them ? `<button class="item" value="unpair" type="button" data-unpair>${icon('leave')} Unpair from ${esc(them.name)}</button>` : ''}
    <button class="item bad" type="button" data-delete>Delete my account</button>
    <button class="ghost wide" value="close">Close</button>
  </form>`;
  menu.showModal();
  $('[data-unpair]', menu)?.addEventListener('click', async () => {
    if (!confirm(`Unpair from ${them.name}? Your points and stakes together go for both of you.`)) return;
    try {
      session.hangUp();
      applyHome(await call('DELETE', `groups/${state.couple.id}/me`));
      menu.close();
      location.hash = '';
      route();
    } catch (error) {
      toast(error.message, 'bad');
    }
  });
  $('[data-delete]', menu).addEventListener('click', async () => {
    if (!confirm('Delete your account? Your couple, points and everything that’s yours go, for good.')) return;
    try {
      session.hangUp();
      await call('DELETE', 'me');
      token.set(null);
      Object.assign(state, { me: null, couple: null, waiting: null });
      renderBar();
      menu.close();
      location.hash = '';
      welcome();
    } catch (error) {
      toast(error.message, 'bad');
    }
  });
};
menu.addEventListener('click', (event) => event.target === menu && menu.close());

addEventListener('focus', () => (document.title = 'Duo Clash · Play'));
boot();
