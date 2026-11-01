'use strict';

const KEY = 'steady.v1';
const $ = (s) => document.querySelector(s);

/* ---------- dates ---------- */
function dayStr(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}
function shiftDay(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  return dayStr(new Date(y, m - 1, d + n));
}
let today = dayStr();

/* ---------- state ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function normalize(s) {
  const ok = (t) => t && typeof t.id === 'string' && typeof t.title === 'string';
  return {
    daily: (Array.isArray(s.daily) ? s.daily : []).filter(ok)
      .map((t) => ({ ...t, history: Array.isArray(t.history) ? t.history : [] })),
    once: (Array.isArray(s.once) ? s.once : []).filter(ok),
    done: (Array.isArray(s.done) ? s.done : []).filter(ok),
    type: s.type === 'daily' ? 'daily' : 'once',
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return normalize(s);
  } catch { /* fall through to empty state */ }
  return { daily: [], once: [], done: [], type: 'once' };
}
let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast('Could not save. Browser storage is full or blocked.');
  }
}

/* ---------- toast + undo ---------- */
let undoSnap = null;
let toastTimer = 0;
const snapshot = () => JSON.stringify(state);
function toast(msg, snap = null) {
  const t = $('#toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('button').hidden = !snap;
  undoSnap = snap;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), snap ? 6000 : 3500);
}
$('#toast button').addEventListener('click', () => {
  if (undoSnap) {
    state = normalize(JSON.parse(undoSnap));
    undoSnap = null;
    save();
    render();
  }
  $('#toast').classList.remove('show');
});

/* ---------- daily helpers ---------- */
const doneToday = (t) => t.history.includes(today);
function streak(t) {
  const set = new Set(t.history);
  let d = set.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (set.has(d)) { n++; d = shiftDay(d, -1); }
  return n;
}

/* ---------- rendering ---------- */
const ICON = {
  grip: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/></g></svg>',
  check: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v; // only used with the static ICON strings above
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.forEach((c) => c && e.append(c));
  return e;
}

function fmtWhen(day) {
  if (!day) return '';
  if (day === today) return 'today';
  if (day === shiftDay(today, -1)) return 'yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function row(t, kind, index) {
  const done = kind === 'daily' ? doneToday(t) : kind === 'done';
  const li = el('li', { class: 'item' + (done ? ' is-done' : ''), 'data-id': t.id });
  if (kind !== 'done') {
    li.append(el('button', {
      class: 'handle', type: 'button', html: ICON.grip,
      'aria-label': `Reorder "${t.title}": drag, or press up and down arrows`,
      title: 'Drag to reorder (or focus and press ↑/↓)',
    }));
  }
  li.append(el('button', {
    class: 'check', type: 'button', role: 'checkbox', html: ICON.check,
    'aria-checked': String(done), 'aria-label': `${done ? 'Mark not done' : 'Mark done'}: ${t.title}`,
  }));
  li.append(el('span', {
    class: 'title', tabindex: kind === 'done' ? null : '0',
    title: kind === 'done' ? null : 'Click to edit', text: t.title,
  }));
  if (kind === 'once' && index === 0) li.append(el('span', { class: 'badge', text: 'Start here' }));
  if (kind === 'daily') {
    const s = streak(t);
    if (s >= 2) li.append(el('span', { class: 'streak', title: `${s} days in a row`, text: `${s} days` }));
  }
  if (kind === 'done') li.append(el('span', { class: 'when', text: fmtWhen(t.doneOn) }));
  li.append(el('button', { class: 'del', type: 'button', html: ICON.x, 'aria-label': `Delete ${t.title}`, title: 'Delete' }));
  return li;
}

function render() {
  today = dayStr();
  $('#dailyList').replaceChildren(...state.daily.map((t, i) => row(t, 'daily', i)));
  $('#onceList').replaceChildren(...state.once.map((t, i) => row(t, 'once', i)));
  $('#doneList').replaceChildren(...state.done.map((t, i) => row(t, 'done', i)));

  const nDaily = state.daily.length;
  const dd = state.daily.filter(doneToday).length;
  $('#dailyMeta').textContent = nDaily ? `${dd} of ${nDaily}` : '';
  $('#dailyBar').style.width = nDaily ? `${(dd / nDaily) * 100}%` : '0';
  $('#dailyBar').parentElement.hidden = !nDaily;
  $('#dailyEmpty').hidden = nDaily > 0;

  const nOnce = state.once.length;
  $('#onceMeta').textContent = nOnce ? `${nOnce} left` : '';
  $('#onceEmpty').hidden = nOnce > 0;
  $('#onceHint').hidden = nOnce < 2;
  $('#focusNote').textContent = nOnce > 1
    ? `${nOnce - 1} more waiting. They can wait. Just this one.`
    : nOnce === 1 ? 'Last one on the list.' : '';

  $('#doneSec').hidden = state.done.length === 0;
  $('#doneCount').textContent = state.done.length;

  const finished = dd + state.done.filter((t) => t.doneOn === today).length;
  const dateText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#date').textContent = finished ? `${dateText} · ${finished} done today` : dateText;

  document.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === state.type)));
}

/* ---------- actions ---------- */
const find = (kind, id) => state[kind].find((t) => t.id === id);

function toggle(kind, id, li) {
  if (kind === 'daily') {
    const t = find(kind, id);
    if (!t) return;
    if (doneToday(t)) t.history = t.history.filter((d) => d !== today);
    else t.history = [...t.history, today].slice(-400);
    save();
    render();
    return;
  }
  if (kind === 'once') {
    if (li.classList.contains('leaving')) return;
    const snap = snapshot();
    li.classList.add('leaving');
    li.querySelector('.check').setAttribute('aria-checked', 'true');
    setTimeout(() => {
      const t = find('once', id);
      if (!t) return;
      state.once = state.once.filter((x) => x.id !== id);
      state.done = [{ ...t, doneOn: today, doneAt: Date.now() }, ...state.done].slice(0, 300);
      save();
      render();
      const left = state.once.length;
      toast(left ? 'Done. One less thing.' : 'Done. List cleared.', snap);
    }, 170);
    return;
  }
  // kind === 'done': put it back at the top of the to-do list
  const snap = snapshot();
  const t = find('done', id);
  if (!t) return;
  state.done = state.done.filter((x) => x.id !== id);
  const { doneOn, doneAt, ...rest } = t;
  state.once.unshift(rest);
  save();
  render();
  toast('Moved back to the top of To do.', snap);
}

function remove(kind, id) {
  const snap = snapshot();
  state[kind] = state[kind].filter((t) => t.id !== id);
  save();
  render();
  toast('Deleted.', snap);
}

function move(kind, id, delta) {
  const a = state[kind];
  const i = a.findIndex((t) => t.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  save();
  render();
}

let editing = false;
function startEdit(li, kind, id) {
  const t = find(kind, id);
  if (!t || editing) return;
  editing = true;
  li.classList.add('editing');
  const input = el('input', { class: 'edit', maxlength: '200', 'aria-label': 'Edit task', enterkeyhint: 'done' });
  input.value = t.title;
  li.querySelector('.title').replaceWith(input);
  li.querySelector('.badge, .streak')?.remove();

  const del = li.querySelector('.del');
  const index = state[kind].indexOf(t);
  const topBtn = index > 0 ? el('button', { class: 'mini', type: 'button', text: 'Move to top' }) : null;
  if (topBtn) del.before(topBtn);

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    editing = false;
    if (commit) {
      const v = input.value.trim();
      if (!v) { remove(kind, id); return; }
      t.title = v;
      save();
    }
    render();
  };

  // Keep focus in the input when pressing these buttons, so blur doesn't fire first.
  [del, topBtn].forEach((b) => b && b.addEventListener('mousedown', (e) => e.preventDefault()));
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    finished = true;
    editing = false;
    remove(kind, id);
  }, { once: true });
  topBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = state[kind];
    a.splice(a.indexOf(t), 1);
    a.unshift(t);
    finish(true);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

/* ---------- events ---------- */
const main = $('main');

main.addEventListener('click', (e) => {
  const li = e.target.closest('.item');
  if (!li || li.classList.contains('editing')) return;
  const kind = li.parentElement.dataset.list;
  const id = li.dataset.id;
  if (e.target.closest('.check')) toggle(kind, id, li);
  else if (e.target.closest('.del')) remove(kind, id);
  else if (e.target.closest('.title') && kind !== 'done') startEdit(li, kind, id);
});

main.addEventListener('keydown', (e) => {
  const li = e.target.closest('.item');
  if (!li || li.classList.contains('editing')) return;
  const kind = li.parentElement.dataset.list;
  const id = li.dataset.id;
  if (kind === 'done') return;
  const onHandle = e.target.classList.contains('handle');
  const onTitle = e.target.classList.contains('title');
  if ((onHandle || (onTitle && e.altKey)) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    move(kind, id, e.key === 'ArrowUp' ? -1 : 1);
    const sel = onHandle ? '.handle' : '.title';
    document.querySelector(`[data-list="${kind}"] [data-id="${id}"] ${sel}`)?.focus();
  } else if (onTitle && e.key === 'Enter') {
    e.preventDefault();
    startEdit(li, kind, id);
  }
});

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#addInput');
  const title = input.value.trim();
  if (!title) return;
  const t = state.type === 'daily'
    ? { id: uid(), title, history: [] }
    : { id: uid(), title, created: Date.now() };
  state[state.type].push(t);
  save();
  render();
  input.value = '';
  const newRow = document.querySelector(`[data-id="${t.id}"]`);
  newRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  state.type = b.dataset.type;
  save();
  render();
  $('#addInput').focus();
}));

$('#doneToggle').addEventListener('click', () => {
  const list = $('#doneList');
  list.hidden = !list.hidden;
  $('#doneToggle').setAttribute('aria-expanded', String(!list.hidden));
});

function setFocus(on) {
  document.body.classList.toggle('focus', on);
  $('#focusBtn').setAttribute('aria-pressed', String(on));
  $('h1').textContent = on ? 'Focus' : 'Today';
}
$('#focusBtn').addEventListener('click', () => setFocus(!document.body.classList.contains('focus')));

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input, textarea, [contenteditable], dialog');
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n' || e.key === '/') {
    e.preventDefault();
    if (document.body.classList.contains('focus')) setFocus(false);
    $('#addInput').focus();
  } else if (e.key === 'f') {
    setFocus(!document.body.classList.contains('focus'));
  }
});

/* ---------- drag to reorder (mouse + touch via pointer events) ---------- */
let dragging = false;
main.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.handle');
  if (!h || e.button > 0 || editing) return;
  e.preventDefault();
  const li = h.closest('.item');
  const list = li.parentElement;
  const r = li.getBoundingClientRect();
  const ph = el('li', { class: 'placeholder' });
  ph.style.height = `${r.height}px`;
  list.insertBefore(ph, li);
  Object.assign(li.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` });
  li.classList.add('dragging');
  document.body.classList.add('is-dragging');
  dragging = true;

  const offset = e.clientY - r.top;
  let y = e.clientY;
  let raf = 0;
  h.setPointerCapture(e.pointerId);

  const place = () => {
    li.style.top = `${y - offset}px`;
    let before = null;
    for (const s of list.children) {
      if (s === li || s === ph) continue;
      const b = s.getBoundingClientRect();
      if (y < b.top + b.height / 2) { before = s; break; }
    }
    if (before) { if (ph.nextElementSibling !== before) list.insertBefore(ph, before); }
    else if (list.lastElementChild !== ph) list.append(ph);
  };
  const tick = () => {
    const edge = 72;
    let dy = 0;
    if (y < edge) dy = -Math.ceil((edge - y) / 5);
    else if (y > innerHeight - edge) dy = Math.ceil((y - (innerHeight - edge)) / 5);
    if (dy) { window.scrollBy(0, dy); place(); }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onMove = (ev) => { y = ev.clientY; place(); };
  const onEnd = () => {
    cancelAnimationFrame(raf);
    h.removeEventListener('pointermove', onMove);
    h.removeEventListener('pointerup', onEnd);
    h.removeEventListener('pointercancel', onEnd);
    h.removeEventListener('lostpointercapture', onEnd);
    list.insertBefore(li, ph);
    ph.remove();
    li.classList.remove('dragging');
    li.removeAttribute('style');
    document.body.classList.remove('is-dragging');
    dragging = false;
    const kind = list.dataset.list;
    const byId = new Map(state[kind].map((t) => [t.id, t]));
    const order = [...list.children].map((c) => byId.get(c.dataset.id)).filter(Boolean);
    if (order.length === state[kind].length) state[kind] = order;
    save();
    render();
  };
  h.addEventListener('pointermove', onMove);
  h.addEventListener('pointerup', onEnd);
  h.addEventListener('pointercancel', onEnd);
  h.addEventListener('lostpointercapture', onEnd);
});

/* ---------- menu: backup / restore / install ---------- */
const menu = $('#menu');
$('#menuBtn').addEventListener('click', () => menu.showModal());
menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'steady', version: 1, exported: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `steady-backup-${today}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Backup downloaded.');
});

$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || (!Array.isArray(data.daily) && !Array.isArray(data.once))) throw new Error('not a backup');
    if (!confirm('Replace your current list with this backup?')) return;
    const snap = snapshot();
    state = normalize(data);
    save();
    render();
    menu.close();
    toast('Backup restored.', snap);
  } catch {
    toast('That file is not a Steady backup.');
  }
});
document.querySelector('label.btn').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#importFile').click(); }
});

$('#clearDoneBtn').addEventListener('click', () => {
  if (!state.done.length) { toast('Done list is already empty.'); return; }
  const snap = snapshot();
  state.done = [];
  save();
  render();
  menu.close();
  toast('Done list cleared.', snap);
});

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#installBtn').hidden = true;
});

/* ---------- keep fresh: midnight rollover, other tabs ---------- */
const refresh = () => { if (!editing && !dragging) render(); };
setInterval(() => { if (dayStr() !== today) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); refresh(); } });

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Ask the browser not to evict our data under storage pressure (best effort).
navigator.storage?.persist?.().catch(() => {});
