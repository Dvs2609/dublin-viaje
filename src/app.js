const PWA = /*__PWA__*/false;
const KEY = 'dublin-bolsillo-v1';
const BYID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const DAYKEYS = ['jue', 'vie', 'sab'];
const TRIP_DATES = { '2026-11-05': 'jue', '2026-11-06': 'vie', '2026-11-07': 'sab' };
const TRIP_START = [2026, 10, 5], TRIP_END = [2026, 10, 7];
const TAB_HASH = { trip: 'mi-viaje', explore: 'buscar', map: 'mapa', info: 'info' };
const OLD_HASH = { '#hoy': 'trip', '#plan': 'trip', '#explorar': 'explore' };
const AIRPORT_AT = '13:15';
// The Friday excursion is assumed to keep you out of Dublin until about this time.
const EXC_BACK = '19:00';
// Starting list for a fresh install: the places nobody wants to miss.
const MUST = ['trinity', 'templebar', 'hapenny', 'grafton', 'stephens', 'molly', 'christchurch', 'stpatricks', 'castle', 'guinness', 'oconnell', 'merrion'];
const CHECKLIST = [
  'DNI o pasaporte en vigor', 'Tarjetas de embarque (o check-in online hecho)', 'Tarjeta Sanitaria Europea',
  'Seguro de viaje, si lo hay', 'Adaptador de enchufe tipo G (británico)', 'Chubasquero con capucha y calzado que no cale',
  'Cargador y batería externa', 'Tarjeta bancaria y monedas para el bus', 'Entradas con hora: Libro de Kells y Guinness',
  'Excursión del viernes reservada y punto de encuentro apuntado', 'Mapa de Dublín descargado en Apple Maps (sin conexión)',
  'Esta app en la pantalla de inicio y abierta una vez con internet'
];
const MODES = [['auto', 'Todo'], ['ver', 'Ver'], ['comer', 'Comer'], ['beber', 'Tomar algo'], ['rain', 'Si llueve']];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const catVar = c => `var(--c-${c})`;
const uid = () => Math.random().toString(36).slice(2, 9);

const IC = {
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l2-4 4-1 3 4 3 1M11 15l1-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 11 21 3l-8 18-2-8z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.8 6.6 19.6l1.1-6L3.2 9.4l6.1-.8z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.8 6.6 19.6l1.1-6L3.2 9.4l6.1-.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

// ---------- Time & geo ----------
const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const fromMin = n => { n = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
const fmtMin = n => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) : ''}`;
const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
// Straight-line distance × 1.25 for real streets, at ~4.7 km/h.
const walkMin = m => Math.max(1, Math.round(m * 1.25 / 78));
const safeUrl = u => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href.slice(0, 500) : ''; } catch (e) { return ''; } };
// Test hook: window.DEBUG_NOW = '2026-11-05T15:20'.
const nowDate = () => (window.DEBUG_NOW ? new Date(window.DEBUG_NOW) : new Date());
const nowMin = () => { const d = nowDate(); return d.getHours() * 60 + d.getMinutes(); };
const stamp = () => { const d = nowDate(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${fromMin(nowMin())}`; };
const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const appleMaps = (p, name) => `https://maps.apple.com/?daddr=${p.lat.toFixed(5)},${p.lon.toFixed(5)}&dirflg=w${name ? '&q=' + encodeURIComponent(name) : ''}`;
const gmapsPlace = p => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function todayKey() {
  const d = nowDate();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return TRIP_DATES[iso] || null;
}
const dayIndex = ([y, m, d]) => Math.round(new Date(y, m, d).getTime() / 86400000);
const todayIndex = () => { const d = nowDate(); return dayIndex([d.getFullYear(), d.getMonth(), d.getDate()]); };

// ---------- State ----------
// List items: { id, day ('jue'|'vie'|'sab'|null, only for a booked time), at ('HH:MM'|''), bought, note, visited, visitedAt }.
function normItem(x) {
  const day = DAYKEYS.includes(x.day) ? x.day : null;
  const at = day && toMin(x.at) !== null ? String(x.at).slice(0, 5) : '';
  return { id: x.id, day, at, bought: !!x.bought, note: String(x.note || '').slice(0, 500), visited: !!x.visited,
    visitedAt: x.visited && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(x.visitedAt || '') ? x.visitedAt : '' };
}
function normList(arr) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (!x || !BYID[x.id] || seen.has(x.id)) continue;
    seen.add(x.id); out.push(normItem(x));
  }
  return out;
}
// Old saved states and DUBLIN1 codes had a plan per day; each place becomes one list entry.
// If a place was booked on two days, the first booking wins and the other is kept in the note.
function migrateDaysToList(days) {
  const map = new Map();
  for (const k of DAYKEYS) for (const s of ((days || {})[k] || {}).stops || []) {
    if (!s || !BYID[s.id]) continue;
    const it = { id: s.id, day: s.reservedAt ? k : null, at: s.reservedAt || '', bought: !!s.ticketBought, note: s.note || '', visited: !!s.done };
    const prev = map.get(s.id);
    if (!prev) { map.set(s.id, it); continue; }
    if (it.at && !prev.at) Object.assign(prev, { day: it.day, at: it.at });
    else if (it.at) prev.note = [prev.note, `También reservado: ${DAYS[k].short} ${it.at}`].filter(Boolean).join(' · ');
    prev.bought = prev.bought || it.bought; prev.visited = prev.visited || it.visited;
    if (it.note && it.note !== prev.note) prev.note = [prev.note, it.note].filter(Boolean).join(' · ');
  }
  return normList([...map.values()]);
}
function normExcursion(e) {
  e = e && typeof e === 'object' ? e : {};
  const str = (v, n) => String(v || '').slice(0, n);
  return { name: str(e.name, 120), time: toMin(e.time) !== null ? str(e.time, 5) : '', meetingPoint: str(e.meetingPoint, 200), url: safeUrl(e.url) };
}
function defState() {
  return { hotel: 'christchurch', list: normList(MUST.map(id => ({ id }))), cat: 'all', sort: 'rel', mode: 'auto', mapMode: 'all', tab: 'trip', largeText: false,
    checklist: CHECKLIST.map(text => ({ id: uid(), text, checked: false })), excursion: normExcursion({}) };
}
function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* storage unavailable */ }
  const d = defState();
  if (!o || typeof o !== 'object') return d;
  const list = Array.isArray(o.list) ? normList(o.list) : o.days ? migrateDaysToList(o.days) : d.list;
  const st = { ...d, ...o, list,
    hotel: HOTELS[o.hotel] ? o.hotel : 'christchurch',
    mode: MODES.some(([k]) => k === o.mode) ? o.mode : 'auto',
    mapMode: o.mapMode === 'list' ? 'list' : 'all',
    checklist: Array.isArray(o.checklist) ? o.checklist.filter(c => c && c.text).map(c => ({ id: String(c.id || uid()), text: String(c.text).slice(0, 200), checked: !!c.checked })) : d.checklist,
    excursion: normExcursion(o.excursion) };
  delete st.days; delete st.day; delete st.ref;
  return st;
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }, 120); }
let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify({ list: S.list, hotel: S.hotel, checklist: S.checklist, excursion: S.excursion }); }
function restore() { if (!undoSnap) return; Object.assign(S, JSON.parse(undoSnap)); undoSnap = null; save(); renderAll(); }
const listItem = id => S.list.find(x => x.id === id);

// ---------- Where and when ----------
let GPS = null;
const hotel = () => HOTELS[S.hotel] || HOTELS.christchurch;
const hotelPt = () => ({ lat: hotel().lat, lon: hotel().lon, n: 'el hotel' });
const gpsInDublin = () => GPS && dist(GPS, hotelPt()) < 30000;
// Context for suggestions: your position (GPS), else the last place you ticked off today, else the hotel.
// Before the trip it previews Thursday 12:30 from the hotel.
function here() {
  const dk = todayKey();
  if (!dk) return { dk: 'jue', t: 12 * 60 + 30, from: hotelPt(), label: 'el hotel', live: false };
  if (gpsInDublin()) return { dk, t: nowMin(), from: { lat: GPS.lat, lon: GPS.lon }, label: 'tu posición', live: true, gps: true };
  const today = stamp().slice(0, 10);
  const last = S.list.filter(x => x.visited && x.visitedAt.startsWith(today)).sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0];
  if (last) return { dk, t: nowMin(), from: BYID[last.id], label: BYID[last.id].n, live: true };
  return { dk, t: nowMin(), from: hotelPt(), label: 'el hotel', live: true };
}
function hoursOn(p, dk) {
  if (!p.h) return null;
  if (dk && dk in p.h) return p.h[dk];
  return 'all' in p.h ? p.h.all : null;
}
const alwaysOpen = p => !p.h && /^(siempre|exterior)/i.test(p.ht || '');
// Can you get there and visit it? Unknown hours are allowed but flagged; parks are out after dark.
function fitNow(p, dk, arr, dur) {
  const sun = toMin(SUNSET);
  if (p.c === 'parque' && arr >= sun) return { ok: false, txt: 'de noche, cerrado' };
  const h = hoursOn(p, dk);
  if (h === false) return { ok: false, txt: 'cerrado hoy' };
  if (h === null || h === undefined) {
    if (alwaysOpen(p)) return { ok: true, full: true, txt: p.out && arr >= sun ? 'de noche' : '' };
    return { ok: true, unknown: true, txt: 'horario sin confirmar' };
  }
  const o = toMin(h[0]), c = toMin(h[1]);
  if (arr >= c || arr + Math.min(dur, 30) > c) return { ok: false, txt: `cierra ${h[1]}` };
  if (arr < o) return o - arr <= 30 ? { ok: true, warn: true, txt: `abre a las ${h[0]}` } : { ok: false, txt: `abre a las ${h[0]}` };
  const full = arr + dur <= c;
  return { ok: true, full, warn: !full, txt: full ? `abierto hasta ${h[1]}` : `cierra a las ${h[1]}` };
}
function hoursLabel(p) {
  const dk = todayKey();
  const h = hoursOn(p, dk || 'jue');
  if (h === null || h === undefined) return null;
  if (h === false) return { cls: 'bad', txt: dk ? 'cerrado hoy' : 'cerrado el jueves' };
  if (!dk) return { cls: 'neutral', txt: `${h[0]}–${h[1]}` };
  const now = nowMin(), o = toMin(h[0]), c = toMin(h[1]);
  if (now < o) return { cls: 'warn', txt: `abre ${h[0]}` };
  if (now >= c) return { cls: 'bad', txt: 'cerrado ya' };
  if (c - now <= 45) return { cls: 'warn', txt: `cierra ${h[1]}` };
  return { cls: 'good', txt: `abierto · cierra ${h[1]}` };
}
function mealNow(t) {
  if (t >= 12 * 60 + 15 && t < 15 * 60 + 30) return 'comida';
  if (t >= 18 * 60 + 45 && t < 22 * 60) return 'cena';
  if (t >= 8 * 60 && t < 11 * 60) return 'desayuno';
  if (t >= 16 * 60 && t < 18 * 60) return 'merienda';
  return null;
}
const isFood = p => p.c === 'comer' || !!p.meal;
const MEAL_WHY = { comida: 'Para comer', cena: 'Para cenar', desayuno: 'Para desayunar', merienda: 'Para merendar' };
// Fixed-time things for a day: bookings, the Friday excursion and the Saturday airport run.
function timedItems(dk) {
  const out = S.list.filter(x => x.day === dk && x.at && !x.visited).map(x => ({ t: toMin(x.at), at: x.at, txt: BYID[x.id].n + (x.bought ? ' · entrada comprada' : ''), id: x.id }));
  if (dk === 'vie') out.push({ t: toMin(S.excursion.time) ?? 8 * 60 + 30, end: toMin(EXC_BACK), at: S.excursion.time || '', txt: S.excursion.name ? `Excursión: ${S.excursion.name}` : 'Excursión (sin apuntar)', exc: true });
  if (dk === 'sab') out.push({ t: toMin(AIRPORT_AT), end: 24 * 60, at: AIRPORT_AT, txt: 'Salir hacia el aeropuerto', air: true });
  return out.sort((a, b) => a.t - b.t);
}
// Suggestions: filtered by the chosen chip, then scored (+40 saved, +30 right meal, +20 open the whole visit,
// −1 per walking minute, −15 unknown hours). Places that would clash with the next fixed time are skipped.
// While on the excursion or once it is time for the airport there is nothing to suggest in town.
function busyNow(c) {
  return timedItems(c.dk).find(x => x.end && c.t >= x.t && c.t < x.end) || null;
}
function rankSuggestions(mode, c) {
  if (busyNow(c)) return [];
  const meal = mealNow(c.t), night = c.t >= toMin(SUNSET);
  const next = timedItems(c.dk).find(x => x.t > c.t);
  const out = [];
  for (const p of PLACES) {
    const it = listItem(p.id);
    if (it && it.visited) continue;
    if (mode === 'ver' && (p.c === 'comer' || p.c === 'pub')) continue;
    if (mode === 'comer' && !isFood(p)) continue;
    if (mode === 'beber' && p.c !== 'pub' && !/merienda|postre/i.test(p.meal || '')) continue;
    if (mode === 'rain' && p.out) continue;
    const m = dist(c.from, p), w = walkMin(m);
    if (w > 40) continue;
    const f = fitNow(p, c.dk, c.t + w, p.dur);
    if (!f.ok) continue;
    const booked = next && next.id === p.id;
    if (booked && c.t + w > next.t) continue;
    if (next && !booked && c.t + w + Math.min(p.dur, 45) > next.t - 10) continue;
    let sc = -w, why = '';
    if (it) { sc += 40; why = 'De vuestra lista'; }
    if (isFood(p)) {
      if (meal && norm(p.meal).includes(meal)) { sc += 30; why = why || MEAL_WHY[meal]; }
      else if (mode !== 'comer') sc -= 45;
    }
    if (p.c === 'pub') sc += c.t >= 17 * 60 ? 12 : -30;
    if (f.full) sc += 20;
    if (f.unknown) sc -= 15;
    if (night && p.out && !isFood(p)) sc += norm(p.k).includes('noche') ? 10 : -15;
    if (MUST.includes(p.id)) { sc += 8; why = why || 'Imprescindible'; }
    if (booked) { sc += 100; why = `Reserva a las ${next.at}`; }
    out.push({ p, w, m, f, sc, why: why || (w <= 5 ? 'Aquí al lado' : '') });
  }
  out.sort((a, b) => (b.sc - a.sc) || (a.m - b.m) || a.p.id.localeCompare(b.p.id));
  // At meal times the best places to eat go first and fourth, so they are not buried under saved sights.
  if (meal && mode === 'auto' && !(next && out[0] && out[0].p.id === next.id && out[0].why.startsWith('Reserva'))) {
    const food = out.filter(x => isFood(x.p) && norm(x.p.meal).includes(meal)).slice(0, 2);
    const rest = out.filter(x => !food.includes(x));
    if (food[0]) rest.splice(0, 0, food[0]);
    if (food[1]) rest.splice(3, 0, food[1]);
    return rest.slice(0, 8);
  }
  return out.slice(0, 8);
}

// ---------- UI helpers ----------
let toastT;
function toast(msg, act, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button type="button">${esc(act)}</button>` : '');
  t.hidden = false;
  if (act) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, act ? 6000 : 3000);
}
const pill = st => st ? `<span class="pill ${st.cls}">${esc(st.txt)}</span>` : '';
const firstSentence = t => { const m = /^(.+?[.!?])(\s|$)/.exec(t); return m ? m[1] : t; };
function toggleSave(id) {
  snapshot();
  const it = listItem(id);
  if (it) { S.list = S.list.filter(x => x !== it); toast('Quitado de vuestra lista', 'Deshacer', restore); }
  else { S.list.push(normItem({ id })); toast('Guardado en vuestra lista', 'Deshacer', restore); }
  save(); renderAll();
}
function toggleSeen(id) {
  snapshot();
  let it = listItem(id);
  if (!it) { it = normItem({ id }); S.list.push(it); }
  it.visited = !it.visited;
  it.visitedAt = it.visited ? stamp() : '';
  save(); renderAll();
  if (it.visited) toast(`Visto: ${BYID[id].n}`, 'Deshacer', restore);
}

// ---------- Mi viaje ----------
function installCard() {
  if (!PWA || isStandalone()) return '';
  return `<details class="install-mini"><summary><b>Instalar en el iPhone</b> para usarla sin internet</summary>
    <ol><li>Abajo en Safari, botón Compartir (cuadrado con flecha).</li><li>"Añadir a pantalla de inicio".</li><li>Abrid la app desde el icono "Dublín".</li></ol></details>`;
}
function doorCard({ p, w, f, why }) {
  const it = listItem(p.id);
  const price = p.c === 'comer' && p.pr ? p.pr : p.p;
  return `<article class="door" data-c="${p.c}">
    <span class="kind">${esc(CATS[p.c].one)} · ${w} min a pie</span>
    <h3>${esc(p.n)}</h3>
    <div class="facts2">${f.txt ? `<span class="${f.warn || f.unknown ? 'warn' : ''}">${esc(f.txt)}</span>` : ''}<span>${esc(price)}</span>${p.meal ? '' : `<span>${fmtMin(p.dur)}</span>`}</div>
    <p>${esc(firstSentence(p.t))}</p>
    <span class="spacer"></span>
    ${why ? `<span class="why">${esc(why)}</span>` : ''}
    <div class="dbtns">
      <a class="go" href="${appleMaps(p, p.n)}" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>
      <button class="ghost ${it ? 'on' : ''}" data-act="save" data-id="${p.id}">${it ? IC.star + 'Guardado' : IC.starO + 'Guardar'}</button>
      <button class="ghost" data-act="seen" data-id="${p.id}">${IC.check}Visto</button>
      <button class="ghost" data-act="open" data-id="${p.id}">Ficha</button>
    </div>
  </article>`;
}
function renderTrip() {
  const c = here(), sun = toMin(SUNSET);
  let html = installCard();
  if (!c.live) {
    const left = dayIndex(TRIP_START) - todayIndex(), after = todayIndex() > dayIndex(TRIP_END);
    html += `<div class="trip-head"><div class="when"><span class="big-clock">${after ? 'Viaje terminado' : left <= 1 ? 'Mañana, a Dublín' : `Faltan ${left} días`}</span><span class="day">Jueves 5 – sábado 7 de noviembre</span></div></div>`;
    const booked = DAYKEYS.flatMap(k => timedItems(k).filter(x => x.at || x.exc).map(x => ({ ...x, k })));
    if (booked.length) html += `<div class="fixedrow">${booked.map(x => `<button class="fixed" ${x.id ? `data-act="open" data-id="${x.id}"` : `data-act="goto" data-id="${x.exc ? 'sec-exc' : 'sec-air'}"`}><time>${DAYS[x.k].short} ${esc(x.at || '—')}</time><span>${esc(x.txt)}</span></button>`).join('')}</div>`;
  } else {
    const light = c.t < sun ? `<span class="lightchip">${IC.sun}Luz hasta ${SUNSET}</span>` : `<span class="lightchip night">${IC.moon}De noche</span>`;
    html += `<div class="trip-head"><div class="when"><span class="big-clock">${fromMin(c.t)}</span><span class="day">${esc(DAYS[c.dk].label.split(' ·')[0])}</span></div>${light}</div>`;
    const items = timedItems(c.dk).filter(x => (x.end || x.t + 15) >= c.t);
    if (items.length) html += `<div class="fixedrow">${items.map(x => { const left = x.t - c.t; return `<button class="fixed ${left <= 45 && left >= -15 ? 'urgent' : ''}" ${x.id ? `data-act="open" data-id="${x.id}"` : `data-act="goto" data-id="${x.exc ? 'sec-exc' : 'sec-air'}"`}><time>${esc(x.at || '—')}</time><span>${esc(x.txt)}${left > 0 && left <= 120 ? ` · en ${fmtMin(left)}` : ''}</span></button>`; }).join('')}</div>`;
  }
  const busy = c.live && busyNow(c);
  if (busy) html += busyCard(busy);
  const sugg = rankSuggestions(S.mode, c);
  if (!busy) html += `<div class="sec-title"><h2>¿Y ahora qué?</h2><small>${c.live ? (c.label === 'el hotel' ? 'cerca del hotel' : `cerca de ${esc(c.label)}`) : 'así lo veréis el jueves a las 12:30'}</small></div>
    <div class="chips modes">${MODES.map(([k, n]) => `<button class="chip" data-act="mode" data-id="${k}" aria-pressed="${S.mode === k}">${n}</button>`).join('')}</div>
    <div class="carousel" id="carousel">${sugg.length ? sugg.map(doorCard).join('') : `<article class="door empty-door"><h3>Nada abierto cerca ahora mismo</h3><p>Probad con otra opción de arriba o mirad el mapa.</p><span class="spacer"></span><div class="dbtns"><button class="go" data-act="tab" data-id="map">${IC.map}Ver el mapa</button></div></article>`}</div>
    ${c.live && !c.gps ? `<p><button class="btn small" data-act="gps">${IC.pin}Usar mi posición</button></p>` : ''}`;
  const pending = S.list.filter(x => !x.visited).map(x => ({ x, p: BYID[x.id], m: dist(c.from, BYID[x.id]) })).sort((a, b) => a.m - b.m);
  const seen = S.list.filter(x => x.visited);
  html += `<div class="sec-title"><h2>Nuestra lista</h2><small>${pending.length} por ver${seen.length ? ` · ${seen.length} vistos` : ''}</small></div>
    <ul class="wish">${pending.map(({ x, p, m }) => wishRow(x, p, m, c)).join('') || '<li class="empty">Guardad sitios con la estrella y saldrán aquí.</li>'}</ul>
    ${seen.length ? `<details class="box"><summary>Ya vistos (${seen.length})</summary><ul class="wish">${seen.map(x => wishRow(x, BYID[x.id], dist(c.from, BYID[x.id]), c)).join('')}</ul></details>` : ''}
    <p><button class="btn" data-act="tab" data-id="explore">${IC.plus}Añadir más sitios</button></p>`;
  const hm = dist(c.from, hotelPt());
  html += `<div class="homebar"><div><b>Leonardo ${esc(hotel().name.replace('Leonardo ', ''))}</b><small>${esc(hotel().addr)}${c.live && hm > 150 ? ` · ${walkMin(hm)} min a pie` : ''}</small></div><a class="btn" href="${appleMaps(hotelPt(), 'Leonardo Hotel Dublin ' + hotel().name.replace('Leonardo ', ''))}" target="_blank" rel="noopener">${IC.nav}Volver</a></div>`;
  if (!c.live) { const done = S.checklist.filter(x => x.checked).length; html += `<p style="margin-top:12px"><button class="btn" data-act="goto" data-id="sec-check">Maleta y papeles: ${done} de ${S.checklist.length}</button></p>`; }
  const scroll = $('#carousel') ? $('#carousel').scrollLeft : 0;
  $('#view-trip').innerHTML = html;
  if (scroll && $('#carousel')) $('#carousel').scrollLeft = scroll;
}
function busyCard(b) {
  if (b.air) return `<article class="door busy" data-c="ver"><span class="kind">Sábado</span><h3>Hora de ir al aeropuerto</h3>
    <p>Vuelo sobre las 16:00: lo ideal es estar allí a las 14:00.</p><span class="spacer"></span>
    <div class="dbtns"><a class="go" href="${appleMaps(hotelPt(), 'Leonardo Hotel Dublin ' + hotel().name.replace('Leonardo ', ''))}" target="_blank" rel="noopener">${IC.nav}Volver al hotel</a><button class="ghost wide" data-act="goto" data-id="sec-air">Cómo ir al aeropuerto</button></div></article>`;
  const e = S.excursion;
  return `<article class="door busy" data-c="parque"><span class="kind">Viernes · excursión</span><h3>${esc(e.name || 'Día de excursión')}</h3>
    <p>${e.meetingPoint ? `Punto de encuentro: ${esc(e.meetingPoint)}` : 'Apuntad el punto de encuentro en Info.'}${e.time ? ` · salida ${esc(e.time)}` : ''}</p><span class="spacer"></span>
    <div class="dbtns">${e.meetingPoint ? `<a class="go" href="https://maps.apple.com/?q=${encodeURIComponent(e.meetingPoint + ', Dublin')}&dirflg=w" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>` : ''}${e.url ? `<a class="ghost wide" href="${esc(e.url)}" target="_blank" rel="noopener">${IC.ext}Ver la reserva</a>` : `<button class="ghost wide" data-act="goto" data-id="sec-exc">Apuntar la excursión</button>`}</div></article>`;
}
function wishRow(x, p, m, c) {
  const f = x.visited ? null : fitNow(p, c.dk, c.t + walkMin(m), p.dur);
  const od = !f ? '' : !f.ok ? 'bad' : f.warn || f.unknown ? 'warn' : 'good';
  const state = !f ? 'visto' : !f.ok ? (f.txt || 'cerrado ahora') : (f.txt || 'abierto');
  return `<li class="${x.visited ? 'seen' : ''}"><button class="main" data-act="open" data-id="${p.id}"><span class="od ${od}"></span><span><b>${esc(p.n)}</b><small>${walkMin(m)} min a pie · ${esc(state)}${x.at ? ` · reserva ${DAYS[x.day].short} ${esc(x.at)}` : ''}</small></span></button>
    <button class="tick" data-act="seen" data-id="${p.id}" aria-label="${x.visited ? 'Desmarcar' : 'Marcar como visto'}: ${esc(p.n)}"><span>${x.visited ? IC.check : ''}</span></button></li>`;
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
const FILTERS = [['all', 'Todo'], ['saved', 'Nuestra lista'], ['free', 'Gratis'], ['rain', 'Si llueve'], ...Object.entries(CATS).map(([k, v]) => [k, v.n])];
function renderCats() {
  $('#cats').innerHTML = FILTERS.map(([k, n]) => `<button class="chip" data-act="cat" data-id="${k}" aria-pressed="${S.cat === k}">${CATS[k] ? `<span class="dot" style="--c:${catVar(k)}"></span>` : ''}${esc(n)}</button>`).join('');
}
function renderList() {
  const q = norm($('#q').value.trim());
  $('#q-clear').hidden = !q;
  const c = here();
  let items = PLACES.map((p, i) => ({ p, i, sc: score(p, q), m: dist(c.from, p) })).filter(x => x.sc > 0);
  if (S.cat === 'free') items = items.filter(x => x.p.free);
  else if (S.cat === 'saved') items = items.filter(x => listItem(x.p.id));
  else if (S.cat === 'rain') items = items.filter(x => !x.p.out);
  else if (S.cat !== 'all') items = items.filter(x => x.p.c === S.cat);
  items.sort(S.sort === 'near' ? (a, b) => a.m - b.m : (a, b) => (b.sc - a.sc) || (a.i - b.i));
  $('#reflabel').textContent = `Minutos a pie desde ${c.label}`;
  $('#list').innerHTML = items.length ? items.map(({ p, m }) => {
    const it = listItem(p.id);
    const meta = [`<span class="district">${p.d}</span>`, p.meal ? esc(p.meal) : fmtMin(p.dur), esc(p.pr && p.c === 'comer' ? p.pr : p.p)];
    return `<li class="item" style="--c:${catVar(p.c)}"><span class="bar"></span>
      <button class="item-main" data-act="open" data-id="${p.id}"><div class="item-name">${esc(p.n)}</div>
      <div class="item-meta">${meta.join('<span aria-hidden="true">·</span>')} ${pill(hoursLabel(p))}${it && it.visited ? ' <span class="pill neutral">visto</span>' : ''}</div></button>
      <div class="item-side"><span class="walk">${walkMin(m)} min</span>
      <button class="add ${it ? 'in' : ''}" data-act="save" data-id="${p.id}" aria-label="${it ? 'Quitar de' : 'Guardar en'} vuestra lista">${it ? IC.star : IC.starO}</button></div></li>`;
  }).join('') : `<li class="empty">Nada con "${esc($('#q').value)}". Probad con otra palabra, por ejemplo "pub", "gratis" o "catedral".</li>`;
}
function renderExplore() {
  $('#sortseg').innerHTML = [['rel', 'Recomendados'], ['near', 'Más cerca']].map(([k, n]) => `<button type="button" data-act="sort" data-id="${k}" aria-pressed="${S.sort === k}">${n}</button>`).join('');
  renderCats(); renderList();
}

// ---------- Place sheet ----------
let sheetPushed = false, sheetId = null;
function nearList(p, food) {
  return PLACES.filter(x => x.id !== p.id && (food ? isFood(x) : (x.c !== 'comer' && x.c !== 'pub')))
    .map(x => ({ x, m: dist(p, x) })).sort((a, b) => a.m - b.m).slice(0, 4)
    .map(({ x, m }) => `<button data-act="open" data-id="${x.id}"><span class="dot" style="--c:${catVar(x.c)}"></span><span class="n">${esc(x.n)}</span><span class="walk">${walkMin(m)} min</span></button>`).join('');
}
function renderSheet() {
  const p = BYID[sheetId];
  if (!p) return;
  const c = here(), m = dist(c.from, p), it = listItem(p.id);
  $('#sheet-label').textContent = CATS[p.c].one;
  $('#sheet-body').innerHTML = `
    <div>
      <div class="d-cat"><span class="dot" style="--c:${catVar(p.c)}"></span>${esc(CATS[p.c].one)} <span class="district">${p.d}</span>${p.meal ? ` · ${esc(p.meal)}` : ''}</div>
      <h2 class="d-title" id="d-title">${esc(p.n)}</h2>
    </div>
    <div class="facts">
      <div><span>Visita</span><b>${fmtMin(p.dur)}</b></div>
      <div><span>Precio</span><b>${esc(p.p)}</b></div>
      <div><span>A pie</span><b>${walkMin(m)} min</b><small class="muted">desde ${esc(c.label)}</small></div>
    </div>
    <div class="bigbtns">
      <a class="btn big primary" href="${appleMaps(p, p.n)}" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>
      <button class="btn big ${it ? 'in' : ''}" data-act="save" data-id="${p.id}">${it ? IC.star + 'En la lista' : IC.starO + 'Guardar'}</button>
      <button class="btn big ${it && it.visited ? 'in' : ''}" data-act="seen" data-id="${p.id}">${IC.check}${it && it.visited ? 'Visto' : 'Ya lo vimos'}</button>
      <button class="btn big" data-act="mapfocus" data-id="${p.id}">${IC.map}En el mapa</button>
    </div>
    <div class="row">${pill(hoursLabel(p))}<span class="muted">${esc(p.ht)}</span></div>
    <p class="prose">${esc(p.t)}</p>
    <p class="prose tipbox">${esc(p.tip)}</p>
    ${p.c !== 'calle' && !alwaysOpen(p) ? `<details class="box" ${it && it.at ? 'open' : ''}><summary>¿Tenéis entrada con hora?</summary>
      <div class="ed">
        <div class="bookrow">
          <label for="b-day">Día<select id="b-day"><option value="">—</option>${DAYKEYS.map(k => `<option value="${k}" ${it && it.day === k ? 'selected' : ''}>${esc(DAYS[k].label.split(' ·')[0])}</option>`).join('')}</select></label>
          <label for="b-at">Hora<input type="time" id="b-at" value="${esc(it ? it.at : '')}"></label>
        </div>
        <label class="check" for="b-bought"><input type="checkbox" id="b-bought" ${it && it.bought ? 'checked' : ''}>Entrada ya comprada</label>
        <label for="b-note" class="label">Nota</label><textarea id="b-note" placeholder="Por ejemplo: localizador ABC123">${esc(it ? it.note : '')}</textarea>
        <p class="muted">Sale arriba en "Mi viaje" ese día, con aviso cuando se acerque la hora.</p>
      </div></details>` : ''}
    ${p.l.length ? `<div class="links"><div class="label">Entradas e información (con internet)</div>${p.l.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(t)}</span><small>${esc(new URL(u).hostname.replace('www.', ''))} ↗</small></a>`).join('')}</div>` : ''}
    <div class="near"><div class="label">Para comer o beber cerca</div>${nearList(p, true)}</div>
    <div class="near"><div class="label">Para ver cerca</div>${nearList(p, false)}</div>
    <p><a class="btn small" href="${gmapsPlace(p)}" target="_blank" rel="noopener">${IC.ext}Abrir en Google Maps</a></p>`;
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
  renderAll();
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
// Booking fields: setting any of them saves the place to the list.
function editBooking(fn) {
  let it = listItem(sheetId);
  if (!it) { it = normItem({ id: sheetId }); S.list.push(it); }
  fn(it);
  Object.assign(it, normItem(it));
  save();
}

// ---------- Info ----------
// DUBLIN1 codes. v2 carries the list (w); v1 codes carried a plan per day (d) and are converted on import.
function packPlan() {
  const o = { v: 2, h: S.hotel, w: S.list.map(x => [x.id, x.day || '', x.at, x.bought ? 1 : 0, x.note, x.visited ? 1 : 0, x.visitedAt]), c: S.checklist.map(c => [c.text, c.checked ? 1 : 0]), e: S.excursion };
  return 'DUBLIN1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function unpackPlan(txt) {
  const m = /DUBLIN1:([A-Za-z0-9+/=]+)/.exec(txt || '');
  if (!m) throw new Error('code');
  const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  if (!o || typeof o !== 'object') throw new Error('code');
  let list;
  if (Array.isArray(o.w)) list = normList(o.w.filter(Array.isArray).map(w => ({ id: w[0], day: w[1], at: w[2], bought: !!w[3], note: w[4], visited: !!w[5], visitedAt: w[6] })));
  else {
    const days = {};
    for (const k of DAYKEYS) {
      const x = (o.d || {})[k] || {};
      days[k] = { stops: (Array.isArray(x.x) ? x.x : []).filter(Array.isArray).map(s => { const e = s[3] && typeof s[3] === 'object' ? s[3] : {}; return { id: s[0], done: !!s[2], reservedAt: e.r, ticketBought: !!e.t, note: e.n }; }) };
    }
    list = migrateDaysToList(days);
  }
  const out = { hotel: HOTELS[o.h] ? o.h : S.hotel, list };
  if (Array.isArray(o.c)) out.checklist = o.c.filter(c => Array.isArray(c) && c[0]).slice(0, 60).map(c => ({ id: uid(), text: String(c[0]).slice(0, 200), checked: !!c[1] }));
  if (o.e) out.excursion = normExcursion(o.e);
  return out;
}
function offlineLine() {
  if (!PWA) return 'Esta copia funciona sin conexión mientras la página siga abierta. Para tenerla siempre, usad la versión instalable.';
  if (navigator.serviceWorker && navigator.serviceWorker.controller) return '✓ Guardada en este móvil: ya funciona sin conexión.';
  return 'Guardándose para usar sin conexión… Si no cambia, cerrad y abrid la app una vez con internet.';
}
function renderChecklist() {
  const ck = S.checklist, done = ck.filter(c => c.checked).length;
  return `<div class="meter"><span style="width:${ck.length ? Math.round(done / ck.length * 100) : 0}%"></span></div>
    <p class="muted">${done} de ${ck.length} listos</p>
    <ul class="checklist">${ck.map(c => `<li class="${c.checked ? 'on' : ''}"><label for="ck-${c.id}"><input type="checkbox" id="ck-${c.id}" data-ck="${c.id}" ${c.checked ? 'checked' : ''}><span>${esc(c.text)}</span></label><button class="x" data-act="ckdel" data-id="${c.id}" aria-label="Borrar «${esc(c.text)}»">${IC.x}</button></li>`).join('')}</ul>
    <form class="row addck" id="ck-form"><input type="text" id="ck-new" placeholder="Añadir otra cosa…" maxlength="200" aria-label="Nueva cosa para la lista"><button class="btn" type="submit">Añadir</button></form>`;
}
function renderInfo() {
  const e = S.excursion;
  $('#view-info').innerHTML = `<div class="info">
    <section><h2 class="h2">Tamaño de la letra</h2>
      <div class="seg big" role="group"><button type="button" data-act="text" data-id="0" aria-pressed="${!S.largeText}">Normal</button><button type="button" data-act="text" data-id="1" aria-pressed="${!!S.largeText}">Grande</button></div></section>
    <section id="sec-check"><h2 class="h2">Maleta y papeles</h2>${renderChecklist()}</section>
    <section id="sec-exc"><h2 class="h2">Excursión del viernes</h2>
      <div class="form">
        <label for="x-name">Cuál<input type="text" id="x-name" value="${esc(e.name)}" placeholder="Por ejemplo: Cork y Roca de Cashel" maxlength="120"></label>
        <label for="x-time">Hora de salida<input type="time" id="x-time" value="${esc(e.time)}"></label>
        <label for="x-meet">Punto de encuentro<input type="text" id="x-meet" value="${esc(e.meetingPoint)}" placeholder="Por ejemplo: George's Quay" maxlength="200"></label>
        <label for="x-url">Enlace de la reserva<input type="url" id="x-url" value="${esc(e.url)}" placeholder="https://…" inputmode="url"></label>
      </div>
      <details class="box"><summary>Opciones en Civitatis</summary>
      ${TRIPS.map((t, i) => `<div class="trip"><b><span>${esc(t.n)}</span><span>${esc(t.p)}</span></b><span>${esc(t.t)}</span>
        <div class="row"><button class="btn small ${e.url === t.u ? 'primary' : ''}" data-act="pickexc" data-i="${i}">${e.url === t.u ? '✓ Elegida' : 'Elegir'}</button><a class="btn small" href="${esc(t.u)}" target="_blank" rel="noopener">${IC.ext}Civitatis</a></div></div>`).join('')}
      </details>
    </section>
    <section id="sec-air"><h2 class="h2">Al aeropuerto el sábado</h2>
      <p>Salid sobre las <b>${AIRPORT_AT}</b> para estar a las 14:00 (vuelo ~16:00). Irlanda no está en Schengen: hay control de documentación.</p>
      <ul>
        <li><b>Taxi o app FREENOW:</b> 25–40 min, unos 30–40 €. Lo más cómodo con maletas.</li>
        <li><b>Aircoach o Dublin Express:</b> desde O'Connell Street y otras paradas, unos 10 € por persona.</li>
        <li><b>Bus 16 o 41:</b> unos 2–3 €, pero 45–60 min y poco sitio para maletas.</li>
      </ul></section>
    <details class="box"><summary>Luz, tiempo y moverse</summary>
      <dl class="kv"><dt>${SUNRISE}</dt><dd>Amanece</dd><dt>${SUNSET}</dt><dd>Anochece; los parques cierran</dd><dt>6–11 °C</dt><dd>Chubascos y viento: chubasquero mejor que paraguas</dd></dl>
      <ul style="margin-top:10px">
        <li>El centro se recorre a pie: de Christ Church a Merrion Square hay unos 25 min.</li>
        <li>Luas (tranvía morado del mapa): billete en la máquina de la parada.</li>
        <li>Bus: app TFI Go o tarjeta Leap; en efectivo solo monedas, sin cambio.</li>
        <li>Se conduce por la izquierda: mirad a la derecha al cruzar.</li>
      </ul></details>
    <details class="box"><summary>Consejos</summary>
      <ul>
        <li>Enchufes tipo G (británico): llevad adaptador.</li>
        <li>En los pubs se pide y se paga en la barra, sin propina. En restaurantes, un 10 % si os ha gustado.</li>
        <li>Muchas cocinas de pub cierran sobre las 21:00; la música tradicional empieza sobre esa hora.</li>
        <li>Emergencias: 112 o 999.</li>
      </ul></details>
    <details class="box"><summary>Usar sin internet</summary>
      <p id="offline-status"><b>${esc(offlineLine())}</b></p>
      <ul>
        <li>En Safari: botón Compartir → "Añadir a pantalla de inicio". Abrid siempre la app desde ese icono.</li>
        <li><b>Cómo llegar</b> abre Apple Maps. Para usarlo sin datos, descargad antes Dublín: en Apple Maps, vuestra foto → Mapas sin conexión.</li>
      </ul></details>
    <details class="box"><summary>Pasar la lista a otro móvil</summary>
      <div class="row"><button class="btn primary" data-act="export">Copiar código</button>${navigator.share ? '<button class="btn" data-act="share">Compartir</button>' : ''}</div>
      <textarea id="io" aria-label="Código" placeholder="Pega aquí un código DUBLIN1:…" style="margin-top:8px"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn" data-act="import">Importar</button><button class="btn" data-act="reset">Volver a la lista inicial</button></div>
    </details>
    <details class="box"><summary>Hotel</summary>
      <div class="hotelpick">${Object.entries(HOTELS).map(([k, h]) => `<label for="h-${k}"><input type="radio" name="hotel" id="h-${k}" value="${k}" ${S.hotel === k ? 'checked' : ''}><span><b>${esc(h.name)}</b><small>${esc(h.addr)}</small></span></label>`).join('')}</div></details>
    <p class="muted fine">Horarios y precios orientativos de noviembre (preparados el 3-nov-2026). Mapa © colaboradores de OpenStreetMap.</p>
  </div>`;
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
      toast('No se pudo saber dónde estáis. Revisad el permiso de ubicación.');
    }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 25000 });
  } catch (e) { watchId = null; toast('No se pudo saber dónde estáis'); }
}
function flushGPS() { const w = gpsWaiters; gpsWaiters = []; w.forEach(f => f()); }
function onGPSMove() {
  if (!gpsInDublin()) { toast('Estáis lejos de Dublín: las distancias se miden desde el hotel'); return; }
  if ($('#sheet').hidden) renderAll();
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
  } else renderView(t);
  $('#main').scrollTop = 0;
}
function renderView(t) {
  if (t === 'trip') renderTrip();
  else if (t === 'info') renderInfo();
  else if (t === 'explore') renderExplore();
  else if (t === 'map') renderMarkers();
}
function renderAll() {
  renderView(S.tab);
  if (!$('#sheet').hidden) renderSheet();
}
function applyText() { document.documentElement.classList.toggle('big', !!S.largeText); }
function renderNet() {
  const n = $('#net');
  n.textContent = navigator.onLine ? 'Con conexión' : 'Sin conexión';
  n.classList.toggle('on', !navigator.onLine);
  const os = $('#offline-status');
  if (os) os.innerHTML = `<b>${esc(offlineLine())}</b>`;
}
function gotoSection(id) {
  setTab('info');
  requestAnimationFrame(() => { const el = document.getElementById(id); if (!el) return; if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView({ block: 'start' }); });
}

// ---------- Events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, i = +el.dataset.i;
  switch (a) {
    case 'open': openDetail(id); break;
    case 'save': toggleSave(id); break;
    case 'seen': toggleSeen(id); break;
    case 'mode': S.mode = id; save(); renderTrip(); if ($('#carousel')) $('#carousel').scrollLeft = 0; break;
    case 'tab': closeDetail(false, () => setTab(id)); break;
    case 'gps': toast('Buscando dónde estáis…'); startGPS(renderAll); break;
    case 'cat': S.cat = id; save(); renderCats(); renderList(); break;
    case 'sort':
      S.sort = id; save();
      if (id === 'near' && todayKey()) startGPS(renderList);
      renderExplore(); break;
    case 'goto': closeDetail(false, () => gotoSection(id)); break;
    case 'text': S.largeText = id === '1'; save(); applyText(); renderInfo(); break;
    case 'mapfocus': closeDetail(false, () => showMap(id)); break;
    case 'mapmode': S.mapMode = id; if (id === 'list' && selId && !listItem(selId)) selId = null; save(); renderMarkers(); break;
    case 'mapclose': selectOnMap(null); break;
    case 'ckdel': S.checklist = S.checklist.filter(c => c.id !== id); save(); renderInfo(); break;
    case 'pickexc': { const t = TRIPS[i]; S.excursion = { ...S.excursion, name: t.n, url: t.u }; save(); renderInfo(); toast('Excursión apuntada'); break; }
    case 'export': {
      const code = packPlan(), io = $('#io');
      io.value = code;
      const sel = () => { io.focus(); io.select(); toast('Código seleccionado: copiadlo'); };
      try { navigator.clipboard.writeText(code).then(() => toast('Código copiado'), sel); } catch (err) { sel(); }
      break;
    }
    case 'share': navigator.share({ title: 'Dublín', text: packPlan() }).catch(() => {}); break;
    case 'import': {
      try {
        const r = unpackPlan($('#io').value);
        snapshot();
        S.list = r.list; S.hotel = r.hotel;
        if (r.checklist) S.checklist = r.checklist;
        if (r.excursion) S.excursion = r.excursion;
        save(); renderInfo(); toast('Lista importada', 'Deshacer', restore);
      } catch (err) { toast('Ese texto no es un código válido. Debe empezar por DUBLIN1:'); }
      break;
    }
    case 'reset':
      if (el.dataset.armed) { snapshot(); S.list = defState().list; save(); renderInfo(); toast('Lista inicial recuperada', 'Deshacer', restore); }
      else { el.dataset.armed = '1'; el.textContent = 'Pulsad otra vez para confirmar'; el.classList.add('danger'); }
      break;
  }
});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
$('#q').addEventListener('input', renderList);
$('#q-clear').addEventListener('click', () => { $('#q').value = ''; renderList(); $('#q').focus(); });
$('#sheet-close').addEventListener('click', () => closeDetail());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
$('#sheet-body').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'b-day') editBooking(it => { it.day = t.value || null; if (!it.day) it.at = ''; });
  else if (t.id === 'b-at') editBooking(it => { it.at = t.value; if (it.at && !it.day) it.day = todayKey() || 'jue'; });
  else if (t.id === 'b-bought') editBooking(it => { it.bought = t.checked; });
  else return;
  renderSheet();
  const det = $('#sheet-body details'); if (det) det.open = true;
});
$('#sheet-body').addEventListener('input', e => { if (e.target.id === 'b-note') editBooking(it => { it.note = e.target.value.slice(0, 500); }); });
$('#view-info').addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'hotel') { S.hotel = t.value; save(); toast(`Hotel: ${HOTELS[S.hotel].name}`); return; }
  if (t.dataset.ck) { const c = S.checklist.find(x => x.id === t.dataset.ck); if (c) { c.checked = t.checked; save(); renderInfo(); const el = document.getElementById('ck-' + c.id); if (el) el.focus(); } return; }
  const ex = S.excursion;
  if (t.id === 'x-name') ex.name = t.value.slice(0, 120);
  else if (t.id === 'x-time') ex.time = toMin(t.value) !== null ? t.value : '';
  else if (t.id === 'x-meet') ex.meetingPoint = t.value.slice(0, 200);
  else if (t.id === 'x-url') { ex.url = safeUrl(t.value); if (t.value && !ex.url) toast('El enlace debe empezar por https://'); }
  else return;
  save();
});
$('#view-info').addEventListener('submit', e => {
  if (e.target.id !== 'ck-form') return;
  e.preventDefault();
  const v = $('#ck-new').value.trim();
  if (!v) return;
  S.checklist.push({ id: uid(), text: v.slice(0, 200), checked: false });
  save(); renderInfo();
  $('#ck-new').focus();
});
$('#zin').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.5); });
$('#zout').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.5); });
$('#zhotel').addEventListener('click', () => { const h = hotelPt(); centerOn(h.lat, h.lon, 1600); });
$('#zgps').addEventListener('click', () => {
  toast('Buscando dónde estáis…');
  startGPS(() => { if (!gpsInDublin()) { toast('Estáis lejos de Dublín'); return; } renderMarkers(); centerOn(GPS.lat, GPS.lon, 1200); });
});
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);
// Mi viaje depends on the clock: refresh it every minute while visible.
setInterval(() => { if (S.tab === 'trip' && $('#sheet').hidden && !document.hidden) renderTrip(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tab === 'trip') renderTrip(); });

// ---------- Boot ----------
const S = load();
(function boot() {
  applyText();
  const fromHash = Object.entries(TAB_HASH).find(([, h]) => '#' + h === location.hash);
  setTab(fromHash ? fromHash[0] : OLD_HASH[location.hash] || 'trip');
  renderNet();
  if (todayKey()) startGPS();
  save();
  if (PWA && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(renderNet).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', renderNet);
  }
})();
