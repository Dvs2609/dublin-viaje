'use strict';
const PWA = /*__PWA__*/false;
const KEY = 'dublin-bolsillo-v1';
const BYID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const DAYKEYS = ['jue', 'vie', 'sab'];
const TRIP_DATES = { '2026-11-05': 'jue', '2026-11-06': 'vie', '2026-11-07': 'sab' };
const TAB_HASH = { explore: 'explorar', map: 'mapa', plan: 'plan', info: 'info' };

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const catVar = c => `var(--c-${c})`;

const IC = {
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l2-4 4-1 3 4 3 1M11 15l1-5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/></svg>'
};

// ---------- State ----------
function defState() {
  const days = {};
  for (const k of DAYKEYS) days[k] = { start: DAYS[k].start, from: 'hotel', back: true, limit: DAYS[k].limit || '', stops: [], notes: '' };
  return { hotel: null, day: 'jue', days, cat: 'all', ref: 'hotel', sort: 'rel', mapMode: 'all', tab: 'explore' };
}
function load() {
  const d = defState();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') {
      const days = {};
      for (const k of DAYKEYS) days[k] = { ...d.days[k], ...((o.days || {})[k] || {}) };
      return { ...d, ...o, days };
    }
  } catch (e) { /* storage unavailable */ }
  return d;
}
let S = load();
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }, 120); }

let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify({ days: S.days, hotel: S.hotel }); }
function restore() { if (!undoSnap) return; const u = JSON.parse(undoSnap); S.days = u.days; S.hotel = u.hotel; undoSnap = null; save(); renderAll(); }

// ---------- Geo & time ----------
let GPS = null;
const hotel = () => HOTELS[S.hotel || 'christchurch'];
const hotelPt = () => ({ lat: hotel().lat, lon: hotel().lon, n: 'Hotel ' + hotel().name });
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Straight-line distance × 1.25 for real streets, at ~4.7 km/h.
const walkMin = m => Math.max(1, Math.round(m * 1.25 / 78));
const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
const fmtMin = n => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) : ''}`;
const clampDur = n => Math.max(5, Math.min(360, Math.round(n / 5) * 5 || 5));
const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const fromMin = n => { n = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
const gpsInDublin = () => GPS && dist(GPS, hotelPt()) < 30000;

function startPt(dk) {
  if (S.days[dk].from === 'gps' && gpsInDublin()) return { lat: GPS.lat, lon: GPS.lon, n: 'Tu posición' };
  return hotelPt();
}
function refLabel() {
  if (S.ref === 'gps' && gpsInDublin()) return 'ti';
  const st = S.days[S.day].stops, p = S.ref === 'last' && st.length && BYID[st[st.length - 1].id];
  return p ? p.n : 'el hotel';
}
function refPt() {
  if (S.ref === 'gps' && gpsInDublin()) return { lat: GPS.lat, lon: GPS.lon, n: 'tu posición' };
  if (S.ref === 'last') {
    const st = S.days[S.day].stops;
    const p = st.length && BYID[st[st.length - 1].id];
    if (p) return p;
  }
  return hotelPt();
}

// ---------- Opening hours ----------
function hoursOn(p, dk) {
  if (!p.h) return null;
  if (dk && dk in p.h) return p.h[dk];
  return 'all' in p.h ? p.h.all : null;
}
function statusAt(p, dk, arr, dep) {
  const h = hoursOn(p, dk);
  if (h === null || h === undefined) return p.out && arr >= toMin(SUNSET) ? { cls: 'neutral', txt: 'ya de noche' } : null;
  if (h === false) return { cls: 'bad', txt: 'cerrado ese día' };
  const o = toMin(h[0]), c = toMin(h[1]);
  if (arr >= c) return { cls: 'bad', txt: `cerrado, cierra ${h[1]}` };
  if (arr < o) return { cls: 'warn', txt: `abre a las ${h[0]}` };
  if (dep > c) return { cls: 'warn', txt: `cierra a las ${h[1]}` };
  return { cls: 'good', txt: `abierto hasta ${h[1]}` };
}
function todayKey() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return TRIP_DATES[iso] || null;
}
function hoursLabel(p) {
  const dk = todayKey();
  const h = hoursOn(p, dk || S.day);
  if (h === null || h === undefined) return null;
  if (h === false) return { cls: 'bad', txt: dk ? 'cerrado hoy' : `cerrado el ${DAYS[S.day].short.toLowerCase()}` };
  if (!dk) return { cls: 'neutral', txt: `${h[0]}–${h[1]}` };
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  const o = toMin(h[0]), c = toMin(h[1]);
  if (now < o) return { cls: 'warn', txt: `abre ${h[0]}` };
  if (now >= c) return { cls: 'bad', txt: 'cerrado ya' };
  if (c - now <= 45) return { cls: 'warn', txt: `cierra ${h[1]}` };
  return { cls: 'good', txt: `abierto · cierra ${h[1]}` };
}

// ---------- Plan logic ----------
function computeDay(dk) {
  const d = S.days[dk];
  const start = startPt(dk);
  const startT = toMin(d.start) ?? toMin(DAYS[dk].start);
  let t = startT, prev = start, walkTot = 0, mTot = 0;
  const rows = [];
  d.stops.forEach((s, i) => {
    const p = BYID[s.id];
    if (!p) return;
    const m = dist(prev, p), w = walkMin(m);
    t += w; walkTot += w; mTot += m;
    const arr = t, dep = t + s.dur;
    rows.push({ i, s, p, m, w, arr, dep, st: statusAt(p, dk, arr, dep) });
    t = dep; prev = p;
  });
  let back = null;
  if (d.back && rows.length) {
    const m = dist(prev, hotelPt()), w = walkMin(m);
    back = { m, w, arr: t + w };
    walkTot += w; mTot += m; t += w;
  }
  return { start, startT, rows, back, end: t, walkTot, mTot };
}
function planHits(id) {
  const out = [];
  for (const k of DAYKEYS) { const i = S.days[k].stops.findIndex(s => s.id === id); if (i >= 0) out.push([k, i + 1]); }
  return out;
}
function toggleStop(id, dk) {
  const d = S.days[dk], p = BYID[id];
  const idx = d.stops.findIndex(s => s.id === id);
  snapshot();
  if (idx >= 0) { d.stops.splice(idx, 1); toast(`Quitado del ${DAYS[dk].label.split(' ·')[0].toLowerCase()}`, 'Deshacer', restore); }
  else { d.stops.push({ id, dur: p.dur }); toast(`Añadido al ${DAYS[dk].label.split(' ·')[0].toLowerCase()} · parada ${d.stops.length}`, 'Deshacer', restore); }
  save(); renderAll();
}
// Meals (anything with a meal slot) and visited stops stay where they are; the sights between them are
// reordered to minimise walking, with penalties for arriving when a place is closed or it is already dark.
const isMeal = s => !!BYID[s.id].meal;
function dayCost(dk, stops) {
  const d = S.days[dk];
  let t = toMin(d.start) ?? toMin(DAYS[dk].start), prev = startPt(dk), c = 0;
  for (const s of stops) {
    const p = BYID[s.id], m = dist(prev, p);
    c += m; t += walkMin(m);
    const st = s.done ? null : statusAt(p, dk, t, t + s.dur);
    if (st) c += { bad: 5000, warn: 800, neutral: 400 }[st.cls] || 0;
    t += s.dur; prev = p;
  }
  return d.back ? c + dist(prev, hotelPt()) : c;
}
function optimize(dk) {
  const d = S.days[dk];
  const list = d.stops.filter(s => BYID[s.id]);
  const movable = list.map(s => !s.done && !isMeal(s));
  if (movable.filter(Boolean).length < 2) { toast('Hacen falta al menos dos visitas pendientes para ordenar'); return; }
  const segs = [];
  for (let i = 0; i < list.length; i++) if (movable[i]) { let j = i; while (j + 1 < list.length && movable[j + 1]) j++; if (j > i) segs.push([i, j]); i = j; }
  // Seed: nearest neighbour inside each segment, kept only if it beats the current order.
  const seed = list.slice();
  for (const [a, b] of segs) {
    let cur = a > 0 ? BYID[seed[a - 1].id] : startPt(dk);
    const rest = seed.slice(a, b + 1);
    for (let k = a; k <= b; k++) {
      let bi = 0, bd = Infinity;
      rest.forEach((s, i) => { const dd = dist(cur, BYID[s.id]); if (dd < bd) { bd = dd; bi = i; } });
      seed[k] = rest.splice(bi, 1)[0]; cur = BYID[seed[k].id];
    }
  }
  let cur = dayCost(dk, seed) < dayCost(dk, list) ? seed : list.slice();
  let best = dayCost(dk, cur), improved = true, guard = 0;
  const tryIt = cand => { const c = dayCost(dk, cand); if (c < best - 1) { cur = cand; best = c; improved = true; } };
  while (improved && guard++ < 200) {
    improved = false;
    for (const [a, b] of segs) for (let i = a; i < b; i++) for (let j = i + 1; j <= b; j++) {
      tryIt(cur.slice(0, i).concat(cur.slice(i, j + 1).reverse(), cur.slice(j + 1)));
      const c2 = cur.slice(); c2.splice(j, 0, c2.splice(i, 1)[0]); tryIt(c2);
      const c3 = cur.slice(); c3.splice(i, 0, c3.splice(j, 1)[0]); tryIt(c3);
    }
  }
  snapshot();
  d.stops = cur;
  save(); renderAll();
  toast('Orden optimizado por distancia y horarios. Comidas y cenas no se mueven.', 'Deshacer', restore);
}
function loadTemplate(dk, ti, append) {
  const tpl = TEMPLATES[dk][ti];
  snapshot();
  const d = S.days[dk];
  const fresh = tpl.s.filter(([id]) => BYID[id]).map(([id, dur]) => ({ id, dur }));
  d.stops = append ? d.stops.concat(fresh.filter(f => !d.stops.some(s => s.id === f.id))) : fresh;
  save(); renderAll();
  toast(append ? 'Ruta añadida al final' : `Ruta "${tpl.n}" cargada`, 'Deshacer', restore);
}
// Google Maps takes at most 9 waypoints per link, so long days become several consecutive links.
function gmapsRoutes(dk) {
  const c = computeDay(dk);
  const stops = c.rows.filter(r => !r.s.done).map(r => r.p);
  if (!stops.length) return [];
  const f = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  const seq = [GPS && gpsInDublin() ? GPS : c.start, ...stops, ...(S.days[dk].back ? [hotelPt()] : [])];
  const urls = [];
  for (let i = 0; i < seq.length - 1; i += 10) {
    const leg = seq.slice(i, i + 11);
    let u = `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${f(leg[0])}&destination=${f(leg[leg.length - 1])}`;
    if (leg.length > 2) u += '&waypoints=' + encodeURIComponent(leg.slice(1, -1).map(f).join('|'));
    urls.push(u);
  }
  return urls;
}
const gmapsPlace = p => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

// ---------- UI helpers ----------
let toastT;
function toast(msg, act, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button type="button">${esc(act)}</button>` : '');
  t.hidden = false;
  if (act) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, act ? 5500 : 2800);
}
const pill = st => st ? `<span class="pill ${st.cls}">${esc(st.txt)}</span>` : '';
const daySeg = (act, cur, extra = '') => `<div class="seg" role="group" ${extra}>${DAYKEYS.map(k => `<button type="button" data-act="${act}" data-day="${k}" aria-pressed="${cur === k}">${DAYS[k].short}</button>`).join('')}</div>`;

function hotelBanner() {
  if (S.hotel) return '';
  return `<div class="banner"><div><b>¿En qué Leonardo estáis?</b> Hay dos en el centro. Lo uso para calcular distancias y rutas.</div>
    <div class="row">${Object.entries(HOTELS).map(([k, h]) => `<button class="btn small" data-act="hotel" data-id="${k}">${esc(h.name)}</button>`).join('')}</div></div>`;
}

// ---------- Explore ----------
function searchText(p) {
  return norm([p.k, CATS[p.c].n, p.d, p.meal, p.free ? 'gratis gratuito free' : '', p.out ? 'aire libre fuera' : 'lluvia cubierto dentro', p.pr].join(' '));
}
const WORD_FILTERS = { gratis: p => p.free, gratuito: p => p.free, free: p => p.free, lluvia: p => !p.out, llueve: p => !p.out, cubierto: p => !p.out };
function score(p, q) {
  if (!q) return 1;
  const n = norm(p.n), k = searchText(p), body = norm(p.t + ' ' + p.tip);
  let sc = 0;
  for (const w of q.split(/\s+/).filter(Boolean)) {
    if (WORD_FILTERS[w]) { if (!WORD_FILTERS[w](p)) return 0; sc += 1; continue; }
    let s = 0;
    if (n.startsWith(w)) s = 10; else if (n.includes(w)) s = 7; else if (k.includes(w)) s = 5; else if (body.includes(w)) s = 2;
    if (!s) return 0;
    sc += s;
  }
  return sc;
}
const FILTERS = [['all', 'Todo'], ['free', 'Gratis'], ['rain', 'Si llueve'], ...Object.entries(CATS).map(([k, v]) => [k, v.n])];
function renderCats() {
  $('#cats').innerHTML = FILTERS.map(([k, n]) => `<button class="chip" data-act="cat" data-id="${k}" aria-pressed="${S.cat === k}">${CATS[k] ? `<span class="dot" style="--c:${catVar(k)}"></span>` : ''}${esc(n)}</button>`).join('');
}
function renderList() {
  const q = norm($('#q').value.trim());
  $('#q-clear').hidden = !q;
  const ref = refPt();
  let items = PLACES.map((p, i) => ({ p, i, sc: score(p, q), m: dist(ref, p) })).filter(x => x.sc > 0);
  if (S.cat === 'free') items = items.filter(x => x.p.free);
  else if (S.cat === 'rain') items = items.filter(x => !x.p.out);
  else if (S.cat !== 'all') items = items.filter(x => x.p.c === S.cat);
  items.sort(S.sort === 'near' ? (a, b) => a.m - b.m : (a, b) => (b.sc - a.sc) || (a.i - b.i));
  const dk = S.day;
  $('#list').innerHTML = items.length ? items.map(({ p, m }) => {
    const idx = S.days[dk].stops.findIndex(s => s.id === p.id);
    const other = planHits(p.id).filter(([k]) => k !== dk).map(([k, n]) => `${DAYS[k].short} ${n}`).join(', ');
    const meta = [`<span class="district">${p.d}</span>`, p.meal ? esc(p.meal) : fmtMin(p.dur), esc(p.pr && p.c === 'comer' ? p.pr : p.p)];
    const hl = hoursLabel(p);
    return `<li class="item" style="--c:${catVar(p.c)}"><span class="bar"></span>
      <button class="item-main" data-act="open" data-id="${p.id}"><div class="item-name">${esc(p.n)}</div>
      <div class="item-meta">${meta.join('<span aria-hidden="true">·</span>')} ${pill(hl)} ${other ? `<span class="pill neutral">En plan: ${other}</span>` : ''}</div></button>
      <div class="item-side"><span class="walk">${walkMin(m)} min</span>
      <button class="add ${idx >= 0 ? 'in' : ''}" data-act="add" data-id="${p.id}" aria-label="${idx >= 0 ? 'Quitar del' : 'Añadir al'} ${esc(DAYS[dk].label)}">${idx >= 0 ? `${DAYS[dk].short} ${idx + 1}` : '+'}</button></div></li>`;
  }).join('') : `<li class="empty">Nada con "${esc($('#q').value)}". Prueba con otra palabra, por ejemplo "pub", "gratis" o "catedral".</li>`;
}
function renderExplore() {
  $('#hotel-banner').innerHTML = hotelBanner();
  $('#ref').value = S.ref; $('#sort').value = S.sort;
  let dayline = $('#dayline');
  if (!dayline) {
    dayline = document.createElement('div');
    dayline.id = 'dayline'; dayline.className = 'refline';
    $('.explore-tools').appendChild(dayline);
  }
  dayline.innerHTML = `<span>El botón + añade al</span>${daySeg('day', S.day, 'style="grid-auto-columns:auto"')}`;
  renderCats(); renderList();
}

// ---------- Detail sheet ----------
let sheetPushed = false, sheetId = null;
function nearList(p, food) {
  return PLACES.filter(x => x.id !== p.id && (food ? (x.c === 'comer' || x.meal) : (x.c !== 'comer' && x.c !== 'pub')))
    .map(x => ({ x, m: dist(p, x) })).sort((a, b) => a.m - b.m).slice(0, 4)
    .map(({ x, m }) => `<button data-act="open" data-id="${x.id}"><span class="dot" style="--c:${catVar(x.c)}"></span><span class="n">${esc(x.n)}</span><span class="walk">${walkMin(m)} min</span></button>`).join('');
}
function renderSheet() {
  const p = BYID[sheetId];
  if (!p) return;
  const ref = refPt(), m = dist(ref, p);
  const hits = planHits(p.id);
  $('#sheet-label').textContent = CATS[p.c].one;
  $('#sheet-body').innerHTML = `
    <div>
      <div class="d-cat"><span class="dot" style="--c:${catVar(p.c)}"></span>${esc(CATS[p.c].one)} <span class="district">${p.d}</span>${p.meal ? ` · ${esc(p.meal)}` : ''}</div>
      <h2 class="d-title" id="d-title">${esc(p.n)}</h2>
    </div>
    <div class="facts">
      <div><span>Visita</span><b>${fmtMin(p.dur)}</b></div>
      <div><span>Precio</span><b>${esc(p.p)}</b></div>
      <div><span>A pie</span><b>${walkMin(m)} min</b><small class="muted">${fmtDist(m)} desde ${esc(refLabel())}</small></div>
    </div>
    <div class="row">${pill(hoursLabel(p))}<span class="muted" style="font-size:13.5px">${esc(p.ht)}</span></div>
    <p class="prose">${esc(p.t)}</p>
    <p class="prose tipbox">${esc(p.tip)}</p>
    <div><div class="label" style="margin-bottom:6px">Añadir al plan</div>
      <div class="addrow">${DAYKEYS.map(k => { const h = hits.find(([d]) => d === k); return `<button class="btn ${h ? 'in' : ''}" data-act="add" data-id="${p.id}" data-day="${k}">${h ? `✓ ${DAYS[k].short} · ${h[1]}` : `+ ${DAYS[k].short}`}</button>`; }).join('')}</div>
    </div>
    <div class="row">
      <button class="btn" data-act="mapfocus" data-id="${p.id}">${IC.map}Ver en el mapa</button>
      <a class="btn" href="${gmapsPlace(p)}" target="_blank" rel="noopener">${IC.ext}Google Maps</a>
    </div>
    ${p.l.length ? `<div class="links"><div class="label">Entradas e info (necesita internet)</div>${p.l.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(t)}</span><small>${esc(new URL(u).hostname.replace('www.', ''))} ↗</small></a>`).join('')}</div>` : ''}
    <div class="near"><div class="label">Para comer o beber cerca</div>${nearList(p, true)}</div>
    <div class="near"><div class="label">Para ver cerca</div>${nearList(p, false)}</div>`;
}
function openDetail(id) {
  sheetId = id;
  renderSheet();
  const sh = $('#sheet');
  if (sh.hidden) {
    sh.hidden = false;
    try { history.pushState({ sheet: 1 }, ''); sheetPushed = true; } catch (e) { sheetPushed = false; }
  }
  $('#sheet-body').scrollTop = 0;
}
let afterPop = null;
function closeDetail(fromPop, then) {
  if ($('#sheet').hidden) { if (then) then(); return; }
  $('#sheet').hidden = true; sheetId = null;
  if (!fromPop && sheetPushed) {
    sheetPushed = false;
    // Run the follow-up once the history entry is gone, so it is not undone by the pending back().
    if (then) { afterPop = then; setTimeout(() => { if (afterPop === then) { afterPop = null; then(); } }, 500); }
    try { history.back(); } catch (e) { /* ignore */ }
    return;
  }
  sheetPushed = false;
  if (then) then();
}
window.addEventListener('popstate', () => {
  closeDetail(true);
  if (afterPop) { const f = afterPop; afterPop = null; f(); }
});

// ---------- Plan view ----------
function renderPlan() {
  const dk = S.day, d = S.days[dk], c = computeDay(dk);
  const sun = toMin(SUNSET);
  let sunShown = c.startT >= sun;
  const sunRow = arr => { if (sunShown || arr < sun) return ''; sunShown = true; return `<li class="tl-sun">Anochece sobre las ${SUNSET}: parques cerrados</li>`; };
  const walkRow = (w, m) => `<li class="tl-walk">${IC.walk}<span>${w} min a pie · ${fmtDist(m)}</span>${w > 25 ? '<span class="far">lejos: mejor bus, Luas o taxi</span>' : ''}</li>`;
  let tl = `<li class="tl-node"><span class="ic">${d.from === 'gps' && gpsInDublin() ? '•' : 'H'}</span><div><time>${fromMin(c.startT)}</time> · Salida desde <b>${esc(c.start.n)}</b></div></li>`;
  for (const r of c.rows) {
    tl += walkRow(r.w, r.m) + sunRow(r.arr);
    tl += `<li class="tl-stop ${r.s.done ? 'done' : ''}" style="--c:${catVar(r.p.c)}"><span class="num">${r.i + 1}</span>
      <div class="card">
        <div class="r1"><time>${fromMin(r.arr)}–${fromMin(r.dep)}</time>${pill(r.st)}</div>
        <button class="sname" data-act="open" data-id="${r.p.id}">${esc(r.p.n)}</button>
        <div class="ctrl">
          <button data-act="dur" data-i="${r.i}" data-v="-15" aria-label="15 minutos menos">−</button>
          <span class="durv">${fmtMin(r.s.dur)}</span>
          <button data-act="dur" data-i="${r.i}" data-v="15" aria-label="15 minutos más">+</button>
          <span class="sp"></span>
          <button data-act="mv" data-i="${r.i}" data-v="-1" aria-label="Subir" ${r.i === 0 ? 'disabled' : ''}>${IC.up}</button>
          <button data-act="mv" data-i="${r.i}" data-v="1" aria-label="Bajar" ${r.i === d.stops.length - 1 ? 'disabled' : ''}>${IC.down}</button>
          <button data-act="done" data-i="${r.i}" class="${r.s.done ? 'on' : ''}" aria-label="Marcar como hecho">${IC.check}</button>
          <button data-act="del" data-i="${r.i}" aria-label="Quitar">${IC.x}</button>
        </div>
      </div></li>`;
  }
  if (c.back) tl += walkRow(c.back.w, c.back.m) + sunRow(c.back.arr) + `<li class="tl-node"><span class="ic">H</span><div><time>${fromMin(c.back.arr)}</time> · De vuelta en el hotel</div></li>`;
  else if (c.rows.length) tl += sunRow(c.end);

  const lim = toMin(d.limit);
  let limitMsg = '';
  if (lim !== null && c.rows.length) {
    const diff = c.end - lim;
    limitMsg = diff > 0
      ? `<div class="banner limitmsg" style="background:var(--bad-soft)"><div><b style="color:var(--bad)">Os pasáis ${fmtMin(diff)}</b> de la hora límite (${d.limit}). Quitad o acortad alguna parada.</div></div>`
      : `<p class="muted limitmsg">Margen de ${fmtMin(-diff)} antes de las ${d.limit}.</p>`;
  }
  const urls = gmapsRoutes(dk);
  const tpls = TEMPLATES[dk].map((t, i) => `<div class="tpl-item"><b>${esc(t.n)}</b><p>${esc(t.d)}</p>
      <p>${t.s.map(([id]) => esc(BYID[id]?.n || id)).join(' → ')}</p>
      <div class="row"><button class="btn small primary" data-act="tpl" data-i="${i}">Cargar ruta</button><button class="btn small" data-act="tpladd" data-i="${i}">Añadir al final</button></div></div>`).join('');

  $('#view-plan').innerHTML = `${hotelBanner()}
    <div class="plan-head">
      ${daySeg('day', S.day)}
      <p class="day-note">${esc(DAYS[dk].note)}</p>
      <div class="settings">
        <label for="p-start">Salida<input type="time" id="p-start" value="${esc(d.start)}"></label>
        <label for="p-from">Desde<select id="p-from"><option value="hotel">el hotel</option><option value="gps" ${d.from === 'gps' ? 'selected' : ''}>mi posición</option></select></label>
        ${DAYS[dk].limit ? `<label for="p-limit">Hora límite<input type="time" id="p-limit" value="${esc(d.limit)}"></label>` : ''}
        <label class="check" for="p-back"><input type="checkbox" id="p-back" ${d.back ? 'checked' : ''}>Terminar volviendo al hotel</label>
      </div>
      ${c.rows.length ? `<div class="actions">
        <button class="btn" data-act="opt">${IC.shuffle}Optimizar orden</button>
        <button class="btn" data-act="mapday">${IC.map}Ver en el mapa</button>
        ${urls.map((u, n) => `<a class="btn" href="${u}" target="_blank" rel="noopener">${IC.ext}Ruta en Google Maps${urls.length > 1 ? ` (${n + 1}/${urls.length})` : ''}</a>`).join('')}
      </div>` : ''}
    </div>
    ${c.rows.length ? `<ol class="tl">${tl}</ol>
      <div class="totals">
        <div><b>${c.rows.length}</b><span>paradas</span></div>
        <div><b>${fmtDist(c.mTot)}</b><span>${fmtMin(c.walkTot)} a pie</span></div>
        <div><b>${fromMin(c.end)}</b><span>${c.back ? 'en el hotel' : 'fin'}</span></div>
      </div>${limitMsg}`
    : `<div class="empty">Todavía no hay paradas para el ${esc(DAYS[dk].label.split(' ·')[0].toLowerCase())}.<br>Añade sitios desde Explorar con el botón + o carga una ruta sugerida.</div>`}
    <details class="box" ${c.rows.length ? '' : 'open'}><summary>Rutas sugeridas para el ${esc(DAYS[dk].short.toLowerCase())}</summary><div class="tpl">${tpls}</div></details>
    <details class="box" ${d.notes ? 'open' : ''}><summary>Notas del día</summary><textarea id="p-notes" placeholder="Reservas, horas de entradas, ideas…">${esc(d.notes)}</textarea></details>
    ${c.rows.length ? `<p style="margin-top:12px"><button class="btn small" data-act="clear">Vaciar este día</button></p>` : ''}`;
}

// ---------- Info view ----------
function packPlan() {
  const o = { v: 1, h: S.hotel, d: {} };
  for (const k of DAYKEYS) { const d = S.days[k]; o.d[k] = { s: d.start, f: d.from, b: d.back ? 1 : 0, l: d.limit, n: d.notes, x: d.stops.map(s => [s.id, s.dur, s.done ? 1 : 0]) }; }
  return 'DUBLIN1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function unpackPlan(txt) {
  const m = /DUBLIN1:([A-Za-z0-9+/=]+)/.exec(txt || '');
  if (!m) throw new Error('code');
  const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  const days = {};
  for (const k of DAYKEYS) {
    const x = (o.d || {})[k] || {}, def = defState().days[k];
    days[k] = { start: x.s || def.start, from: x.f || 'hotel', back: x.b !== 0, limit: x.l ?? def.limit, notes: x.n || '',
      stops: (Array.isArray(x.x) ? x.x : []).filter(s => Array.isArray(s) && BYID[s[0]]).map(s => ({ id: s[0], dur: clampDur(+s[1] || BYID[s[0]].dur), done: !!s[2] })) };
  }
  return { hotel: HOTELS[o.h] ? o.h : S.hotel, days };
}
function offlineLine() {
  if (!PWA) return 'Esta copia funciona sin conexión mientras la página siga abierta en el navegador. Para tenerla siempre disponible, usa la versión instalable.';
  if (navigator.serviceWorker && navigator.serviceWorker.controller) return '✓ Guardada en este móvil: ya funciona sin conexión.';
  return 'Guardándose para usar sin conexión… Si no cambia, recarga la página una vez con internet.';
}
function renderInfo() {
  $('#view-info').innerHTML = `<div class="info">
    <section><h2 class="h2">Vuestro viaje</h2>
      <dl class="kv">
        <dt>Jue 5</dt><dd>Llegada al hotel sobre las 11–12 h. Dejar maletas, comer y centro hasta la cena.</dd>
        <dt>Vie 6</dt><dd>Excursión desde las 8:30–9:00 hasta la hora de cenar.</dd>
        <dt>Sáb 7</dt><dd>Mañana corta. Comer pronto y salir hacia el aeropuerto sobre las 13:15 (vuelo ~16:00).</dd>
      </dl></section>
    <section><h2 class="h2">Vuestro hotel</h2>
      <div class="hotelpick">${Object.entries(HOTELS).map(([k, h]) => `<label for="h-${k}"><input type="radio" name="hotel" id="h-${k}" value="${k}" ${S.hotel === k ? 'checked' : ''}><span><b>${esc(h.name)}</b><small>${esc(h.addr)}</small></span></label>`).join('')}</div></section>
    <section><h2 class="h2">Luz y tiempo</h2>
      <dl class="kv"><dt>${SUNRISE}</dt><dd>Amanece</dd><dt>${SUNSET}</dt><dd>Anochece. Los parques cierran a esa hora; dejad museos y pubs para la tarde.</dd><dt>6–11 °C</dt><dd>Chubascos frecuentes y viento. Mejor chubasquero con capucha que paraguas, y calzado que aguante agua.</dd></dl></section>
    <section><h2 class="h2">Al aeropuerto el sábado</h2>
      <p>Con vuelo hacia las 16:00, estad en el aeropuerto sobre las 14:00. Irlanda no está en Schengen: hay control de documentación.</p>
      <ul>
        <li><b>Taxi o app FREENOW:</b> 25–40 min, unos 30–40 € desde el centro. Lo más cómodo con maletas.</li>
        <li><b>Aircoach (700) o Dublin Express:</b> salen del centro (O'Connell Street y otras paradas), cada 15–30 min, unos 30–45 min, alrededor de 10 € por persona.</li>
        <li><b>Dublin Bus 16 o 41:</b> desde O'Connell Street, unos 2–3 €, pero 45–60 min y poco sitio para maletas.</li>
      </ul>
      <p class="muted">Precios y paradas aproximados: comprobad la parada más cercana al hotel antes del sábado.</p></section>
    <section><h2 class="h2">Moverse</h2>
      <ul>
        <li>El centro se recorre a pie: de Christ Church a Merrion Square hay unos 25 min.</li>
        <li><b>Luas (tranvía):</b> la línea roja va por los muelles del norte (Abbey St, Jervis, Four Courts, Smithfield) hasta Heuston, útil para la Guinness y Kilmainham. Billete en la máquina de la parada.</li>
        <li><b>Bus:</b> billete en la app TFI Go o con tarjeta Leap. En efectivo solo monedas y sin cambio.</li>
        <li>Se conduce por la izquierda: mirad a la derecha al cruzar.</li>
      </ul></section>
    <section><h2 class="h2">Excursión del viernes</h2>
      <p class="muted">Si ya la tenéis, mirad en el bono la hora y el punto de salida exacto. Si no, estas son las de Civitatis:</p>
      ${TRIPS.map(t => `<a class="trip" href="${esc(t.u)}" target="_blank" rel="noopener"><b><span>${esc(t.n)}</span><span>${esc(t.p)}</span></b><span>${esc(t.t)}</span></a>`).join('')}</section>
    <section><h2 class="h2">Consejos</h2>
      <ul>
        <li>Enchufes tipo G (británico): llevad adaptador.</li>
        <li>En los pubs se pide y se paga en la barra, sin propina. En restaurantes con servicio de mesa, un 10 % si os ha gustado.</li>
        <li>Muchas cocinas de pub cierran sobre las 21:00. La música tradicional suele empezar a partir de las 21:00.</li>
        <li>Con DNI basta. La tarjeta se acepta en casi todas partes. Emergencias: 112 o 999.</li>
      </ul></section>
    <section><h2 class="h2">Usar sin internet</h2>
      <p id="offline-status"><b>${esc(offlineLine())}</b></p>
      <ul>
        <li><b>Android (Chrome):</b> menú ⋮ → "Añadir a pantalla de inicio" o "Instalar aplicación".</li>
        <li><b>iPhone (Safari):</b> botón Compartir → "Añadir a pantalla de inicio".</li>
        <li>Abridla una vez con internet antes de salir. El plan se guarda en cada móvil.</li>
        <li>Funcionan sin internet: buscador, fichas, mapa, rutas y GPS. Necesitan internet: enlaces de entradas y Google Maps.</li>
        <li>Para navegar calle a calle sin datos, descargad la zona de Dublín en Google Maps (Mapas sin conexión) o en la app Organic Maps.</li>
      </ul></section>
    <section><h2 class="h2">Pasar el plan a otro móvil</h2>
      <p class="muted">Copiad el código y mandadlo por WhatsApp. En el otro móvil, pegadlo abajo y pulsad Importar.</p>
      <div class="row"><button class="btn primary" data-act="export">Copiar código del plan</button>${navigator.share ? '<button class="btn" data-act="share">Compartir</button>' : ''}</div>
      <textarea id="io" aria-label="Código del plan" placeholder="Pega aquí un código DUBLIN1:…"></textarea>
      <div class="row"><button class="btn" data-act="import">Importar plan</button><button class="btn" data-act="reset" id="reset-btn">Borrar todo el plan</button></div>
    </section>
    <p class="muted" style="font-size:12.5px">Horarios y precios orientativos de noviembre, preparados el 3 de noviembre de 2026. Pueden cambiar: comprobadlos en la web oficial antes de ir.</p>
  </div>`;
}

// ---------- Map ----------
const LAT0 = 53.345, LON0 = -6.265, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
const BASE = {
  river: [[53.3478, -6.3050], [53.3470, -6.2950], [53.3463, -6.2870], [53.3459, -6.2800], [53.3455, -6.2750], [53.3452, -6.2705], [53.3455, -6.2665], [53.3462, -6.2632], [53.3471, -6.2593], [53.3476, -6.2550], [53.3478, -6.2500], [53.3474, -6.2450], [53.3469, -6.2413], [53.3463, -6.2350], [53.3460, -6.2280]],
  canal: [[53.3330, -6.2850], [53.3318, -6.2720], [53.3316, -6.2650], [53.3320, -6.2560], [53.3332, -6.2480], [53.3345, -6.2430], [53.3385, -6.2385], [53.3410, -6.2370]],
  parks: [
    [[53.3396, -6.2614], [53.3396, -6.2569], [53.3369, -6.2569], [53.3369, -6.2614]],
    [[53.3413, -6.2510], [53.3405, -6.2470], [53.3385, -6.2480], [53.3393, -6.2520]],
    [[53.3364, -6.2630], [53.3364, -6.2602], [53.3345, -6.2602], [53.3345, -6.2630]],
    [[53.3400, -6.2723], [53.3400, -6.2708], [53.3388, -6.2708], [53.3388, -6.2723]],
    [[53.3545, -6.2652], [53.3545, -6.2635], [53.3535, -6.2635], [53.3535, -6.2652]],
    [[53.3492, -6.2950], [53.3560, -6.2965], [53.3640, -6.3150], [53.3650, -6.3400], [53.3540, -6.3450], [53.3478, -6.3080]]
  ],
  campus: [[[53.3448, -6.2595], [53.3447, -6.2525], [53.3425, -6.2515], [53.3426, -6.2592]], [[53.3436, -6.2690], [53.3436, -6.2655], [53.3420, -6.2655], [53.3420, -6.2690]]],
  streets: [
    { n: "O'CONNELL ST", at: 3, pts: [[53.3472, -6.2592], [53.3485, -6.2598], [53.3500, -6.2604], [53.3530, -6.2615]] },
    { n: 'GRAFTON ST', at: 1, pts: [[53.3440, -6.2597], [53.3420, -6.2600], [53.3398, -6.2607]] },
    { n: 'DAME ST', at: 1, pts: [[53.3443, -6.2600], [53.3442, -6.2640], [53.3441, -6.2668], [53.3435, -6.2700], [53.3433, -6.2716]] },
    { n: 'THOMAS ST', at: 1, pts: [[53.3433, -6.2716], [53.3431, -6.2770], [53.3430, -6.2820], [53.3425, -6.2870], [53.3422, -6.2960]] },
    { n: 'HENRY ST', at: 1, pts: [[53.3494, -6.2605], [53.3490, -6.2650], [53.3484, -6.2695]] },
    { n: 'PARNELL ST', at: 1, pts: [[53.3525, -6.2600], [53.3522, -6.2665], [53.3520, -6.2710]] },
    { n: 'PATRICK ST', at: 1, pts: [[53.3433, -6.2716], [53.3410, -6.2717], [53.3375, -6.2720]] },
    { n: 'NASSAU ST', at: 1, pts: [[53.3428, -6.2595], [53.3423, -6.2555], [53.3418, -6.2525]] },
    { n: 'WESTMORELAND ST', at: 1, pts: [[53.3471, -6.2593], [53.3455, -6.2595], [53.3443, -6.2600]] },
    { n: 'MERRION ST', at: 1, pts: [[53.3418, -6.2525], [53.3400, -6.2522], [53.3380, -6.2520]] },
    { n: "ST STEPHEN'S GREEN N", at: 9, pts: [[53.3398, -6.2614], [53.3398, -6.2565]] },
    { n: 'CAPEL ST', at: 1, pts: [[53.3463, -6.2690], [53.3490, -6.2697], [53.3520, -6.2705]] },
    { n: 'GEORGE ST', at: 1, pts: [[53.3442, -6.2640], [53.3425, -6.2637], [53.3405, -6.2640]] }
  ],
  water: [{ n: 'Río Liffey', lat: 53.3474, lon: -6.2520 }, { n: 'Río Liffey', lat: 53.3462, lon: -6.2810 }]
};
let mapReady = false, view = null, svg, markers = [], selId = null;
const SVGNS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const pathD = (pts, close) => pts.map(([la, lo], i) => { const [x, y] = proj(la, lo); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + (close ? 'Z' : '');
let riverEl;

function initMap() {
  svg = $('#map');
  const base = mk('g', {}, svg);
  BASE.campus.forEach(c => mk('path', { d: pathD(c, true), class: 'campus' }, base));
  BASE.parks.forEach(p => mk('path', { d: pathD(p, true), class: 'park' }, base));
  mk('path', { d: pathD(BASE.canal), class: 'canal' }, base);
  riverEl = mk('path', { d: pathD(BASE.river), class: 'river' }, base);
  BASE.streets.forEach(s => mk('path', { d: pathD(s.pts), class: 'st-edge' }, base));
  BASE.streets.forEach(s => mk('path', { d: pathD(s.pts), class: 'st' }, base));
  mk('g', { id: 'routeg' }, svg);
  mk('g', { id: 'lblg' }, svg);
  mk('g', { id: 'mkg' }, svg);
  mk('g', { id: 'topg' }, svg);
  const lg = $('#lblg');
  BASE.streets.forEach(s => {
    const a = s.pts[Math.min(s.at, s.pts.length - 1)], b = s.pts[Math.max(0, Math.min(s.at, s.pts.length - 1) - 1)];
    const [x, y] = proj((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const g = mk('g', { class: 'lbl' }, lg); const t = mk('text', { 'text-anchor': 'middle', y: 3 }, g); t.textContent = s.n;
    markers.push({ el: g, x, y, kind: 'street' });
  });
  BASE.water.forEach(w => {
    const [x, y] = proj(w.lat, w.lon);
    const g = mk('g', { class: 'lbl water' }, lg); const t = mk('text', { 'text-anchor': 'middle', y: 18 }, g); t.textContent = w.n;
    markers.push({ el: g, x, y, kind: 'street' });
  });
  attachMapEvents();
  new ResizeObserver(() => applyView()).observe(svg);
  mapReady = true;
}
function fitView(bounds) {
  const r = svg.getBoundingClientRect();
  const [x0, y0] = proj(bounds[1][0], bounds[0][1]), [x1, y1] = proj(bounds[0][0], bounds[1][1]);
  const aspect = (r.width || 400) / (r.height || 600);
  const w = Math.max(x1 - x0, (y1 - y0) * aspect) * 1.15;
  view = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w / aspect) / 2, w };
}
function centerOn(lat, lon, w) {
  const r = svg.getBoundingClientRect();
  const aspect = (r.width || 400) / (r.height || 600);
  const [x, y] = proj(lat, lon);
  view.w = w || view.w;
  view.x = x - view.w / 2; view.y = y - (view.w / aspect) / 2 + (view.w / aspect) * 0.08;
  applyView();
}
function applyView() {
  if (!svg || !view) return;
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const h = view.w * r.height / r.width;
  svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${h.toFixed(1)}`);
  const s = view.w / r.width;
  for (const m of markers) m.el.setAttribute('transform', `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${s.toFixed(4)})`);
  riverEl.style.strokeWidth = Math.max(38, s * 6) + 'px';
  svg.classList.toggle('labels', s < 1.5);
  $('#lblg').style.display = s < 4.5 ? '' : 'none';
}
function zoomAt(cx, cy, f) {
  const r = svg.getBoundingClientRect();
  const s = view.w / r.width;
  const ns = Math.min(40, Math.max(0.35, s * f));
  const wx = view.x + (cx - r.left) * s, wy = view.y + (cy - r.top) * s;
  view.w = ns * r.width; view.x = wx - (cx - r.left) * ns; view.y = wy - (cy - r.top) * ns;
  applyView();
}
function attachMapEvents() {
  const pts = new Map();
  let moved = 0, downId = null;
  svg.addEventListener('pointerdown', e => {
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { moved = 0; const t = e.target.closest && e.target.closest('[data-id]'); downId = t ? t.getAttribute('data-id') : null; }
    else downId = null;
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = [e.clientX, e.clientY];
    const r = svg.getBoundingClientRect(), s = view.w / r.width;
    if (pts.size === 1) {
      view.x -= (cur[0] - prev[0]) * s; view.y -= (cur[1] - prev[1]) * s;
      moved += Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]);
      pts.set(e.pointerId, cur);
      applyView();
    } else if (pts.size === 2) {
      const before = [...pts.values()];
      pts.set(e.pointerId, cur);
      const after = [...pts.values()];
      const d0 = Math.hypot(before[0][0] - before[1][0], before[0][1] - before[1][1]);
      const d1 = Math.hypot(after[0][0] - after[1][0], after[0][1] - after[1][1]);
      if (d0 < 1 || d1 < 1) return;
      const m0 = [(before[0][0] + before[1][0]) / 2, (before[0][1] + before[1][1]) / 2];
      const m1 = [(after[0][0] + after[1][0]) / 2, (after[0][1] + after[1][1]) / 2];
      const wx = view.x + (m0[0] - r.left) * s, wy = view.y + (m0[1] - r.top) * s;
      const ns = Math.min(40, Math.max(0.35, s * d0 / d1));
      view.w = ns * r.width; view.x = wx - (m1[0] - r.left) * ns; view.y = wy - (m1[1] - r.top) * ns;
      moved += 99;
      applyView();
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    const wasSingle = pts.size === 1;
    pts.delete(e.pointerId);
    if (e.type === 'pointerup' && wasSingle && moved < 10) selectOnMap(downId);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.18 : 1 / 1.18); }, { passive: false });
}
function renderMarkers() {
  if (!mapReady) return;
  markers = markers.filter(m => m.kind === 'street');
  const g = $('#mkg'), top = $('#topg'), rg = $('#routeg');
  g.innerHTML = ''; top.innerHTML = ''; rg.innerHTML = '';
  const mode = S.mapMode;
  const dayStops = mode !== 'all' ? S.days[mode].stops : [];
  const stopIdx = new Map(dayStops.map((s, i) => [s.id, i + 1]));
  if (mode !== 'all') {
    const c = computeDay(mode);
    if (c.rows.length) {
      const pts = [c.start, ...c.rows.map(r => r.p), ...(c.back ? [hotelPt()] : [])];
      mk('path', { d: pathD(pts.map(p => [p.lat, p.lon])), class: 'route' }, rg);
    }
  }
  const ordered = PLACES.slice().sort((a, b) => (stopIdx.has(a.id) ? 1 : 0) - (stopIdx.has(b.id) ? 1 : 0));
  for (const p of ordered) {
    const [x, y] = proj(p.lat, p.lon);
    const n = stopIdx.get(p.id);
    const cls = ['mk', n ? 'stop' : '', mode !== 'all' && !n ? 'dim' : '', selId === p.id ? 'sel' : ''].join(' ');
    const el = mk('g', { class: cls, 'data-id': p.id }, g);
    mk('circle', { r: n ? 11 : 7, fill: catVar(p.c) }, el);
    mk('circle', { r: 18, class: 'hit' }, el);
    if (n) { const t = mk('text', { class: 'num', 'text-anchor': 'middle', y: 4 }, el); t.textContent = n; }
    const t = mk('text', { class: 'name', x: n ? 14 : 10, y: 4 }, el); t.textContent = p.n;
    markers.push({ el, x, y });
  }
  const h = hotelPt(), [hx, hy] = proj(h.lat, h.lon);
  const he = mk('g', { class: 'mk stop' }, top);
  mk('rect', { x: -10, y: -10, width: 20, height: 20, rx: 5, fill: 'var(--ink)', stroke: 'var(--surface)', 'stroke-width': 2 }, he);
  const ht = mk('text', { 'text-anchor': 'middle', y: 4.5, style: 'fill:var(--bg);stroke:none;font-weight:800;font-size:12px' }, he); ht.textContent = 'H';
  const hn = mk('text', { class: 'name', x: 14, y: 4 }, he); hn.textContent = hotel().name;
  markers.push({ el: he, x: hx, y: hy });
  if (GPS && gpsInDublin()) {
    const [gx, gy] = proj(GPS.lat, GPS.lon);
    const ge = mk('g', {}, top);
    mk('circle', { r: 16, fill: '#2F7BEA', opacity: 0.18 }, ge);
    mk('circle', { r: 7, fill: '#2F7BEA', stroke: '#fff', 'stroke-width': 2.5 }, ge);
    markers.push({ el: ge, x: gx, y: gy });
  }
  $('#mapmode').innerHTML = [['all', 'Todo'], ...DAYKEYS.map(k => [k, 'Ruta ' + DAYS[k].short])].map(([k, n]) => `<button type="button" data-act="mapmode" data-day="${k}" aria-pressed="${mode === k}">${n}</button>`).join('');
  applyView();
  renderMapCard();
}
function selectOnMap(id) {
  selId = id && BYID[id] ? id : null;
  renderMarkers();
}
function renderMapCard() {
  const card = $('#mapcard');
  const p = selId && BYID[selId];
  $('#mapnote').hidden = !!p;
  if (!p) { card.hidden = true; return; }
  const m = dist(refPt(), p);
  const idx = S.days[S.day].stops.findIndex(s => s.id === p.id);
  card.hidden = false;
  card.innerHTML = `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="t">${esc(p.n)}</span><button class="btn small" data-act="mapclose" aria-label="Cerrar">${IC.x}</button></div>
    <div class="item-meta"><span class="dot" style="--c:${catVar(p.c)}"></span>${esc(CATS[p.c].one)} · ${walkMin(m)} min a pie · ${fmtMin(p.dur)} ${pill(hoursLabel(p))}</div>
    <div class="row"><button class="btn small primary" data-act="open" data-id="${p.id}">Ver ficha</button>
    <button class="btn small" data-act="add" data-id="${p.id}">${idx >= 0 ? `Quitar del ${DAYS[S.day].short}` : `+ Añadir al ${DAYS[S.day].short}`}</button></div>`;
}
function showMap(focusId, mode) {
  setTab('map');
  if (mode) S.mapMode = mode;
  if (focusId) selId = focusId;
  renderMarkers();
  if (focusId) { const p = BYID[focusId]; centerOn(p.lat, p.lon, Math.min(view.w, 1400)); }
  else if (mode && mode !== 'all') {
    const c = computeDay(mode);
    const all = [c.start, ...c.rows.map(r => r.p)];
    if (all.length > 1) {
      const la = all.map(p => p.lat), lo = all.map(p => p.lon);
      fitView([[Math.min(...la), Math.min(...lo)], [Math.max(...la), Math.max(...lo)]]);
      applyView();
    }
  }
}

// ---------- GPS ----------
let watchId = null, gpsWaiters = [];
function startGPS(cb) {
  if (cb) gpsWaiters.push(cb);
  if (!navigator.geolocation) { toast('Este navegador no da la posición'); return; }
  if (watchId !== null) { if (GPS) flushGPS(); return; }
  try {
    watchId = navigator.geolocation.watchPosition(pos => {
      const prev = GPS;
      GPS = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
      flushGPS();
      if (!prev || dist(prev, GPS) > 25) onGPSMove();
    }, () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null; gpsWaiters = [];
      toast('No se pudo obtener la posición. Revisa el permiso de ubicación.');
    }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 25000 });
  } catch (e) { watchId = null; toast('No se pudo obtener la posición'); }
}
function flushGPS() { const w = gpsWaiters; gpsWaiters = []; w.forEach(f => f()); }
function onGPSMove() {
  if (!gpsInDublin()) { toast('Estás lejos de Dublín: las distancias se miden desde el hotel'); return; }
  if (S.tab === 'explore') renderList();
  if (S.tab === 'map') renderMarkers();
  if (S.tab === 'plan' && S.days[S.day].from === 'gps') renderPlan();
}

// ---------- Tabs & rendering ----------
function setTab(t) {
  S.tab = t; save();
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  for (const k of Object.keys(TAB_HASH)) $(`#view-${k}`).hidden = k !== t;
  $('#main').style.overflowY = t === 'map' ? 'hidden' : 'auto';
  try { history.replaceState(history.state, '', '#' + TAB_HASH[t]); } catch (e) { /* ignore */ }
  if (t === 'map') {
    if (!mapReady) initMap();
    if (!view) fitView([[53.3375, -6.2760], [53.3535, -6.2470]]);
    renderMarkers();
  } else if (t === 'plan') renderPlan();
  else if (t === 'info') renderInfo();
  else renderExplore();
  $('#main').scrollTop = 0;
}
function renderAll() {
  if (S.tab === 'explore') renderExplore();
  if (S.tab === 'plan') renderPlan();
  if (S.tab === 'map') renderMarkers();
  if (S.tab === 'info') renderInfo();
  if (!$('#sheet').hidden) renderSheet();
}
function renderNet() {
  const on = navigator.onLine;
  const n = $('#net');
  n.textContent = on ? 'Con conexión' : 'Sin conexión';
  n.classList.toggle('on', !on);
  const os = $('#offline-status');
  if (os) os.innerHTML = `<b>${esc(offlineLine())}</b>`;
}

// ---------- Events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, i = +el.dataset.i, v = +el.dataset.v;
  const d = S.days[S.day];
  switch (a) {
    case 'open': openDetail(id); break;
    case 'add': toggleStop(id, el.dataset.day || S.day); break;
    case 'cat': S.cat = id; save(); renderCats(); renderList(); break;
    case 'day': S.day = el.dataset.day; save(); renderAll(); break;
    case 'hotel': S.hotel = id; save(); renderAll(); toast(`Hotel: ${HOTELS[id].name}`); break;
    case 'dur': d.stops[i].dur = clampDur(d.stops[i].dur + v); save(); renderPlan(); break;
    case 'mv': { const j = i + v; if (j < 0 || j >= d.stops.length) break; [d.stops[i], d.stops[j]] = [d.stops[j], d.stops[i]]; save(); renderPlan(); break; }
    case 'done': d.stops[i].done = !d.stops[i].done; save(); renderPlan(); break;
    case 'del': snapshot(); d.stops.splice(i, 1); save(); renderPlan(); toast('Parada quitada', 'Deshacer', restore); break;
    case 'opt': optimize(S.day); break;
    case 'tpl': loadTemplate(S.day, i, false); break;
    case 'tpladd': loadTemplate(S.day, i, true); break;
    case 'clear': snapshot(); d.stops = []; save(); renderPlan(); toast('Día vaciado', 'Deshacer', restore); break;
    case 'mapday': showMap(null, S.day); break;
    case 'mapfocus': closeDetail(false, () => showMap(id)); break;
    case 'mapmode': S.mapMode = el.dataset.day; save(); showMap(null, S.mapMode); break;
    case 'mapclose': selectOnMap(null); break;
    case 'export': {
      const code = packPlan(), io = $('#io');
      io.value = code;
      const sel = () => { io.focus(); io.select(); toast('Código seleccionado: cópialo'); };
      try { navigator.clipboard.writeText(code).then(() => toast('Código copiado'), sel); } catch (err) { sel(); }
      break;
    }
    case 'share': navigator.share({ title: 'Plan Dublín', text: packPlan() }).catch(() => {}); break;
    case 'import': {
      try { const r = unpackPlan($('#io').value); snapshot(); S.days = r.days; S.hotel = r.hotel; save(); renderInfo(); toast('Plan importado', 'Deshacer', restore); }
      catch (err) { toast('Ese texto no es un código de plan válido. Debe empezar por DUBLIN1:'); }
      break;
    }
    case 'reset':
      if (el.dataset.armed) { snapshot(); S.days = defState().days; save(); renderInfo(); toast('Plan borrado', 'Deshacer', restore); }
      else { el.dataset.armed = '1'; el.textContent = 'Pulsa otra vez para borrar'; el.style.color = 'var(--bad)'; }
      break;
  }
});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
$('#q').addEventListener('input', renderList);
$('#q-clear').addEventListener('click', () => { $('#q').value = ''; renderList(); $('#q').focus(); });
$('#ref').addEventListener('change', e => {
  S.ref = e.target.value; save();
  if (S.ref === 'gps') { toast('Buscando tu posición…'); startGPS(renderList); }
  renderList();
});
$('#sort').addEventListener('change', e => { S.sort = e.target.value; save(); renderList(); });
$('#sheet-close').addEventListener('click', () => closeDetail());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
$('#view-plan').addEventListener('change', e => {
  const d = S.days[S.day], t = e.target;
  if (t.id === 'p-start' && toMin(t.value) !== null) d.start = t.value;
  else if (t.id === 'p-limit') d.limit = t.value;
  else if (t.id === 'p-back') d.back = t.checked;
  else if (t.id === 'p-from') { d.from = t.value; if (t.value === 'gps') startGPS(renderPlan); }
  else return;
  save(); renderPlan();
});
$('#view-plan').addEventListener('input', e => { if (e.target.id === 'p-notes') { S.days[S.day].notes = e.target.value; save(); } });
$('#view-info').addEventListener('change', e => { if (e.target.name === 'hotel') { S.hotel = e.target.value; save(); toast(`Hotel: ${HOTELS[S.hotel].name}`); } });
$('#zin').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.5); });
$('#zout').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.5); });
$('#zhotel').addEventListener('click', () => { const h = hotelPt(); centerOn(h.lat, h.lon, 1600); });
$('#zgps').addEventListener('click', () => {
  toast('Buscando tu posición…');
  startGPS(() => { if (!gpsInDublin()) { toast('Estás lejos de Dublín'); return; } renderMarkers(); centerOn(GPS.lat, GPS.lon, 1200); });
});
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);

// ---------- Boot ----------
(function boot() {
  const fromHash = Object.entries(TAB_HASH).find(([, h]) => '#' + h === location.hash);
  setTab(fromHash ? fromHash[0] : (S.tab || 'explore'));
  renderNet();
  if (S.ref === 'gps' || DAYKEYS.some(k => S.days[k].from === 'gps')) startGPS();
  if (PWA && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(renderNet).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', renderNet);
  }
})();
