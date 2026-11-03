const PWA = /*__PWA__*/false;
const KEY = 'dublin-bolsillo-v1';
const BYID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const DAYKEYS = ['jue', 'vie', 'sab'];
const TRIP_DATES = { '2026-11-05': 'jue', '2026-11-06': 'vie', '2026-11-07': 'sab' };
const TRIP_START = [2026, 10, 5], TRIP_END = [2026, 10, 7];
const TAB_HASH = { today: 'hoy', plan: 'plan', explore: 'explorar', map: 'mapa', info: 'info' };
// Route loaded on first launch for each day (index into TEMPLATES), chosen for the Christchurch hotel.
const PRELOAD = { jue: 0, vie: 1, sab: 1 };
const DUR_CHIPS = [15, 30, 45, 60, 75, 90, 120, 150, 180];
const CHECKLIST = [
  'DNI o pasaporte en vigor', 'Tarjetas de embarque (o check-in online hecho)', 'Tarjeta Sanitaria Europea',
  'Seguro de viaje, si lo hay', 'Adaptador de enchufe tipo G (británico)', 'Chubasquero con capucha y calzado que no cale',
  'Cargador y batería externa', 'Tarjeta bancaria y monedas para el bus', 'Entradas con hora: Libro de Kells y Guinness',
  'Excursión del viernes reservada y punto de encuentro apuntado', 'Mapa de Dublín descargado en Apple Maps (sin conexión)',
  'Esta app en la pantalla de inicio y abierta una vez con internet'
];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const catVar = c => `var(--c-${c})`;
const uid = () => Math.random().toString(36).slice(2, 9);

const IC = {
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l2-4 4-1 3 4 3 1M11 15l1-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/></svg>',
  nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 11 21 3l-8 18-2-8z"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 5 8 7-8 7zM17 5v14"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z" transform="translate(0 -1)"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

// ---------- State ----------
// Stops: { id, dur, done, skipped, reservedAt ('HH:MM' or ''), ticketBought, note }.
function emptyDays() {
  const days = {};
  for (const k of DAYKEYS) days[k] = { start: DAYS[k].start, from: 'hotel', back: true, limit: DAYS[k].limit || '', stops: [], notes: '' };
  return days;
}
function defState(preload) {
  const days = emptyDays();
  if (preload) for (const k of DAYKEYS) days[k].stops = (TEMPLATES[k][PRELOAD[k]]?.s || []).filter(([id]) => BYID[id]).map(([id, dur]) => normStop({ id, dur }));
  return {
    hotel: 'christchurch', day: 'jue', days, cat: 'all', sort: 'rel', mapMode: 'all', tab: 'today', largeText: false,
    checklist: CHECKLIST.map(text => ({ id: uid(), text, checked: false })),
    excursion: { name: '', time: '', meetingPoint: '', url: '' }
  };
}
function normStop(s) {
  return { id: s.id, dur: clampDur(+s.dur || BYID[s.id].dur), done: !!s.done, skipped: !!s.skipped,
    reservedAt: toMin(s.reservedAt) !== null ? String(s.reservedAt).slice(0, 5) : '', ticketBought: !!s.ticketBought, note: String(s.note || '').slice(0, 500) };
}
function normExcursion(e) {
  e = e && typeof e === 'object' ? e : {};
  const str = (v, n) => String(v || '').slice(0, n);
  return { name: str(e.name, 120), time: toMin(e.time) !== null ? str(e.time, 5) : '', meetingPoint: str(e.meetingPoint, 200), url: safeUrl(e.url) };
}
function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* storage unavailable */ }
  if (!o || typeof o !== 'object') return defState(true);
  // Saved v1 state: keep its stops, fill in anything newer versions added.
  const d = defState(false);
  const days = {};
  for (const k of DAYKEYS) {
    const x = (o.days || {})[k] || {};
    days[k] = { ...d.days[k], ...x, stops: (Array.isArray(x.stops) ? x.stops : []).filter(s => s && BYID[s.id]).map(normStop) };
  }
  return {
    ...d, ...o, days,
    hotel: HOTELS[o.hotel] ? o.hotel : 'christchurch',
    checklist: Array.isArray(o.checklist) ? o.checklist.filter(c => c && c.text).map(c => ({ id: String(c.id || uid()), text: String(c.text).slice(0, 200), checked: !!c.checked })) : d.checklist,
    excursion: normExcursion(o.excursion)
  };
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }, 120); }

let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify({ days: S.days, hotel: S.hotel }); }
function restore() { if (!undoSnap) return; const u = JSON.parse(undoSnap); S.days = u.days; S.hotel = u.hotel; undoSnap = null; save(); renderAll(); }

// ---------- Geo & time ----------
let GPS = null;
const hotel = () => HOTELS[S.hotel] || HOTELS.christchurch;
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
const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const fromMin = n => { n = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
const gpsInDublin = () => GPS && dist(GPS, hotelPt()) < 30000;
const safeUrl = u => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href.slice(0, 500) : ''; } catch (e) { return ''; } };
// Test hook: window.DEBUG_NOW = '2026-11-05T15:20'.
const nowDate = () => (window.DEBUG_NOW ? new Date(window.DEBUG_NOW) : new Date());
const nowMin = () => { const d = nowDate(); return d.getHours() * 60 + d.getMinutes(); };
const appleMaps = (p, name) => `https://maps.apple.com/?daddr=${p.lat.toFixed(5)},${p.lon.toFixed(5)}&dirflg=w${name ? '&q=' + encodeURIComponent(name) : ''}`;
const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

function startPt(dk) {
  if (S.days[dk].from === 'gps' && gpsInDublin()) return { lat: GPS.lat, lon: GPS.lon, n: 'Tu posición' };
  return hotelPt();
}
function refPt() {
  if (S.sort === 'near' && gpsInDublin()) return { lat: GPS.lat, lon: GPS.lon, n: 'tu posición' };
  return hotelPt();
}
const refLabel = () => (S.sort === 'near' && gpsInDublin() ? 'tu posición' : 'el hotel');

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
  const d = nowDate();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return TRIP_DATES[iso] || null;
}
function hoursLabel(p) {
  const dk = todayKey();
  const h = hoursOn(p, dk || S.day);
  if (h === null || h === undefined) return null;
  if (h === false) return { cls: 'bad', txt: dk ? 'cerrado hoy' : `cerrado el ${DAYS[S.day].short.toLowerCase()}` };
  if (!dk) return { cls: 'neutral', txt: `${h[0]}–${h[1]}` };
  const now = nowMin(), o = toMin(h[0]), c = toMin(h[1]);
  if (now < o) return { cls: 'warn', txt: `abre ${h[0]}` };
  if (now >= c) return { cls: 'bad', txt: 'cerrado ya' };
  if (c - now <= 45) return { cls: 'warn', txt: `cierra ${h[1]}` };
  return { cls: 'good', txt: `abierto · cierra ${h[1]}` };
}

// ---------- Plan logic ----------
// Walks a list of {s, i} entries from a point and time. A reserved time is a minimum start: you wait if early.
function walkPlan(dk, entries, from, t0, back) {
  let t = t0, prev = from, walkTot = 0, mTot = 0;
  const rows = [];
  for (const { s, i } of entries) {
    const p = BYID[s.id];
    if (!p) continue;
    const m = dist(prev, p), w = walkMin(m);
    t += w; walkTot += w; mTot += m;
    const arr = t, r = toMin(s.reservedAt);
    const start = r !== null && arr < r ? r : arr;
    const late = r !== null && arr > r ? arr - r : 0;
    const dep = start + s.dur;
    rows.push({ i, s, p, m, w, arr, start, wait: start - arr, late, dep, st: statusAt(p, dk, start, dep) });
    t = dep; prev = p;
  }
  let backRow = null;
  if (back && rows.length) {
    const m = dist(prev, hotelPt()), w = walkMin(m);
    backRow = { m, w, arr: t + w };
    walkTot += w; mTot += m; t += w;
  }
  return { rows, back: backRow, end: t, walkTot, mTot };
}
const entriesOf = (stops, keep) => stops.map((s, i) => ({ s, i })).filter(e => keep(e.s) && BYID[e.s.id]);
function computeDay(dk) {
  const d = S.days[dk];
  const start = startPt(dk);
  const startT = toMin(d.start) ?? toMin(DAYS[dk].start);
  return { start, startT, ...walkPlan(dk, entriesOf(d.stops, s => !s.skipped), start, startT, d.back) };
}
// Live view for "Hoy": pending stops only, from now and from where you are (GPS, last finished stop or the hotel).
function computeLive(dk) {
  const d = S.days[dk];
  const lastDone = [...d.stops].reverse().find(s => s.done && BYID[s.id]);
  const from = gpsInDublin() ? { lat: GPS.lat, lon: GPS.lon, n: 'tu posición' } : lastDone ? BYID[lastDone.id] : startPt(dk);
  const t0 = Math.max(nowMin(), toMin(d.start) ?? 0);
  return { from, ...walkPlan(dk, entriesOf(d.stops, s => !s.done && !s.skipped), from, t0, d.back) };
}
function planHits(id) {
  const out = [];
  for (const k of DAYKEYS) { const i = S.days[k].stops.findIndex(s => s.id === id); if (i >= 0) out.push([k, i + 1]); }
  return out;
}
const dayName = dk => DAYS[dk].label.split(' ·')[0].toLowerCase();
function toggleStop(id, dk) {
  const d = S.days[dk], p = BYID[id];
  const idx = d.stops.findIndex(s => s.id === id);
  snapshot();
  if (idx >= 0) { d.stops.splice(idx, 1); toast(`Quitado del ${dayName(dk)}`, 'Deshacer', restore); }
  else { d.stops.push(normStop({ id, dur: p.dur })); toast(`Añadido al ${dayName(dk)} · parada ${d.stops.length}`, 'Deshacer', restore); }
  save(); renderAll();
}
// Entrance-fee estimate: sights only (food and pubs excluded), per person. "Gratis" = 0, "21–28 €" = range.
function parsePrice(p) {
  if (p.c === 'comer' || p.c === 'pub') return null;
  if (/gratis/i.test(p.p)) return [0, 0];
  const m = /(\d+(?:,\d+)?)(?:\s*[–-]\s*(\d+(?:,\d+)?))?\s*€/.exec(p.p || '');
  if (!m) return null;
  const n = x => parseFloat(x.replace(',', '.'));
  return [n(m[1]), n(m[2] || m[1])];
}
function dayFees(dk) {
  let lo = 0, hi = 0;
  for (const s of S.days[dk].stops) {
    if (s.skipped || !BYID[s.id]) continue;
    const pr = parsePrice(BYID[s.id]);
    if (pr) { lo += pr[0]; hi += pr[1]; }
  }
  return { lo: Math.round(lo), hi: Math.round(hi) };
}
const feeText = f => f.hi === 0 ? 'gratis' : f.lo === f.hi ? `≈ ${f.lo} €` : `≈ ${f.lo}–${f.hi} €`;

// Meals, visited/skipped stops and stops with a booked time stay put; the sights between them are
// reordered to minimise walking, with penalties for closed places, late bookings and darkness.
const isFixed = s => s.done || s.skipped || !!BYID[s.id].meal || toMin(s.reservedAt) !== null;
function dayCost(dk, stops) {
  const d = S.days[dk];
  const r = walkPlan(dk, entriesOf(stops, s => !s.skipped), startPt(dk), toMin(d.start) ?? toMin(DAYS[dk].start), d.back);
  let c = r.mTot;
  for (const row of r.rows) {
    if (row.s.done) continue;
    if (row.st) c += { bad: 5000, warn: 800, neutral: 400 }[row.st.cls] || 0;
    if (row.late) c += 3000;
  }
  return c;
}
function optimize(dk) {
  const d = S.days[dk];
  const list = d.stops.filter(s => BYID[s.id]);
  const movable = list.map(s => !isFixed(s));
  if (movable.filter(Boolean).length < 2) { toast('Hacen falta al menos dos visitas sin hora fija para ordenar'); return; }
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
  toast('Orden mejorado. Comidas y horas reservadas no se mueven.', 'Deshacer', restore);
}
function loadTemplate(dk, ti, append) {
  const tpl = TEMPLATES[dk][ti];
  snapshot();
  const d = S.days[dk];
  const fresh = tpl.s.filter(([id]) => BYID[id]).map(([id, dur]) => normStop({ id, dur }));
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
  toastT = setTimeout(() => { t.hidden = true; }, act ? 6000 : 3000);
}
const pill = st => st ? `<span class="pill ${st.cls}">${esc(st.txt)}</span>` : '';
const daySeg = (act, cur, extra = '') => `<div class="seg" role="group" ${extra}>${DAYKEYS.map(k => `<button type="button" data-act="${act}" data-day="${k}" aria-pressed="${cur === k}">${DAYS[k].short}</button>`).join('')}</div>`;
function stopBadges(s, row) {
  const b = [];
  if (s.reservedAt) b.push(`<span class="badge">${IC.clock}Reserva ${esc(s.reservedAt)}</span>`);
  if (s.ticketBought) b.push(`<span class="badge good">${IC.ticket}Entrada comprada</span>`);
  if (row && row.late) b.push(`<span class="pill bad">llegáis ${fmtMin(row.late)} tarde a la reserva</span>`);
  if (row && row.wait >= 5) b.push(`<span class="pill neutral">esperáis ${fmtMin(row.wait)}</span>`);
  if (s.note) b.push(`<span class="badge">${IC.note}${esc(s.note.length > 40 ? s.note.slice(0, 40) + '…' : s.note)}</span>`);
  return b.join('');
}

// ---------- Today ----------
function dayIndex(ymd) { const [y, m, d] = ymd; return Math.round(new Date(y, m, d).getTime() / 86400000); }
function installCard() {
  if (!PWA || isStandalone()) return '';
  return `<div class="banner install"><div><b>Instálala en el iPhone para usarla sin internet</b></div>
    <ol><li>Abajo en Safari, toca el botón Compartir (el cuadrado con una flecha hacia arriba).</li><li>Elige "Añadir a pantalla de inicio" y pulsa Añadir.</li><li>Abre la app desde el nuevo icono "Dublín".</li></ol>
    <p class="muted">Hazlo antes de cambiar el plan: lo que cambies aquí en Safari no pasa a la app instalada.</p></div>`;
}
function excursionLine() {
  const e = S.excursion;
  if (!e.name) return 'Excursión por decidir. Apúntala en Info cuando la reservéis.';
  return [e.name, e.time && `salida ${e.time}`, e.meetingPoint && `en ${e.meetingPoint}`].filter(Boolean).join(' · ');
}
function daySummaryCard(dk) {
  const c = computeDay(dk), d = S.days[dk];
  const names = c.rows.map(r => esc(r.p.n));
  const warn = c.rows.filter(r => r.st && r.st.cls === 'bad').length + c.rows.filter(r => r.late).length;
  return `<div class="sumcard">
    <div class="r1"><b>${esc(DAYS[dk].label)}</b>${c.rows.length ? `<span class="tnum">${fromMin(c.startT)}–${fromMin(c.end)}</span>` : ''}</div>
    ${dk === 'vie' ? `<p class="exc">${esc(excursionLine())}</p>` : ''}
    <p>${names.length ? names.join(' → ') : 'Sin paradas todavía.'}</p>
    <div class="row">${c.rows.length ? `<span class="pill neutral">${c.rows.length} paradas · ${fmtDist(c.mTot)} a pie</span><span class="pill neutral">Entradas ${feeText(dayFees(dk))} por persona</span>` : ''}${warn ? `<span class="pill bad">${warn} aviso${warn > 1 ? 's' : ''} de horario</span>` : ''}</div>
    <button class="btn" data-act="goplan" data-day="${dk}">Ver o cambiar el ${esc(DAYS[dk].short.toLowerCase())}</button>
  </div>`;
}
function hotelCard() {
  const h = hotel();
  return `<div class="hotelcard"><div class="label">Vuestro hotel</div><b>Leonardo Hotel Dublin ${esc(h.name.replace('Leonardo ', ''))}</b><span>${esc(h.addr)}</span>
    <div class="row"><a class="btn" href="${appleMaps(h)}" target="_blank" rel="noopener">${IC.nav}Cómo volver al hotel</a></div>
    <p class="muted">Para un taxi, enseñad esta dirección.</p></div>`;
}
function renderToday() {
  const dk = todayKey();
  const today = dayIndex([nowDate().getFullYear(), nowDate().getMonth(), nowDate().getDate()]);
  let html = '';
  if (!dk) {
    const left = dayIndex(TRIP_START) - today;
    const ck = S.checklist, done = ck.filter(c => c.checked).length;
    if (left > 0) {
      html += `<h2 class="hero">${left === 1 ? 'Mañana os vais a Dublín' : `Faltan ${left} días para Dublín`}</h2>
        <p class="lead">El plan ya está preparado. Revisadlo y cambiad lo que queráis: todo se puede mover.</p>${installCard()}
        <div class="sumcard"><div class="r1"><b>Maleta y papeles</b><span class="tnum">${done} de ${ck.length}</span></div>
        <div class="meter"><span style="width:${ck.length ? Math.round(done / ck.length * 100) : 0}%"></span></div>
        <button class="btn" data-act="goto" data-id="sec-check">Ver la lista</button></div>`;
    } else if (today > dayIndex(TRIP_END)) {
      html += `<h2 class="hero">Viaje terminado</h2><p class="lead">Aquí tenéis cómo quedó cada día.</p>`;
    } else html += `<h2 class="hero">Dublín</h2>`;
    html += DAYKEYS.map(daySummaryCard).join('');
  } else html += renderTripDay(dk) + installCard();
  html += hotelCard();
  $('#view-today').innerHTML = html;
}
function renderTripDay(dk) {
  const d = S.days[dk], now = nowMin();
  const live = computeLive(dk), plan = computeDay(dk);
  let html = `<div class="todayhead"><span class="label">Hoy · ${esc(DAYS[dk].label)}</span><span class="clock tnum">${fromMin(now)}</span></div>`;
  if (dk === 'vie' && now < toMin(d.start)) {
    const e = S.excursion;
    html += `<div class="sumcard"><div class="label">Excursión</div><b>${esc(e.name || 'Excursión del viernes')}</b>
      ${e.time ? `<p>Salida a las <b>${esc(e.time)}</b></p>` : ''}${e.meetingPoint ? `<p>Punto de encuentro: <b>${esc(e.meetingPoint)}</b></p>` : ''}
      <div class="row">${e.meetingPoint ? `<a class="btn" href="https://maps.apple.com/?q=${encodeURIComponent(e.meetingPoint + ', Dublin')}&dirflg=w" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>` : ''}${e.url ? `<a class="btn" href="${esc(e.url)}" target="_blank" rel="noopener">${IC.ext}Ver la reserva</a>` : ''}</div>
      <p class="muted">Después: el plan de la noche empieza a las ${esc(d.start)}.</p></div>`;
  }
  const lim = toMin(d.limit);
  if (lim !== null) {
    const left = lim - now;
    html += `<div class="banner ${left < 30 ? 'urgent' : ''}"><div><b>Salida al aeropuerto a las ${esc(d.limit)}</b>${left > 0 ? ` · quedan ${fmtMin(left)}` : ' · ¡es la hora!'}</div><div class="muted">Vuelo sobre las 16:00. Mirad "Al aeropuerto" en Info.</div></div>`;
  }
  const next = live.rows[0];
  if (!next) {
    html += `<div class="nowcard done"><span class="label">Plan del día</span><h2 class="nowtitle">${d.stops.length ? 'Todo hecho' : 'Sin paradas para hoy'}</h2>
      <p>${d.stops.length ? '¡Buen trabajo! Si queréis más, buscad algo cerca en Explorar.' : 'Añadid sitios desde Explorar o cargad una ruta sugerida en Plan.'}</p>
      <div class="row"><button class="btn primary" data-act="nearme">Qué hay cerca</button></div></div>`;
    return html;
  }
  const planned = plan.rows.find(r => r.i === next.i);
  const behind = planned ? next.start - planned.start : 0;
  html += `<div class="nowcard" style="--c:${catVar(next.p.c)}">
    <span class="label">Próxima parada · ${next.i + 1} de ${d.stops.length}</span>
    <h2 class="nowtitle">${esc(next.p.n)}</h2>
    <p class="nowtime tnum">${fromMin(next.start)}–${fromMin(next.dep)}</p>
    <p class="nowmeta">${IC.walk}<span>${next.w} min a pie desde ${esc(live.from.n || 'aquí')} · llegada ${fromMin(next.arr)}</span></p>
    <div class="row">${pill(next.st)}${stopBadges(next.s, next)}</div>
    ${behind > 20 ? `<p class="behind">Vais ${fmtMin(behind)} más tarde que el plan. Si falta tiempo, saltad alguna parada.</p>` : ''}
    <div class="bigbtns">
      <a class="btn big primary" href="${appleMaps(next.p, next.p.n)}" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>
      <button class="btn big" data-act="hdone" data-day="${dk}" data-i="${next.i}">${IC.check}Hecho</button>
      <button class="btn big" data-act="hskip" data-day="${dk}" data-i="${next.i}">${IC.skip}Saltar</button>
      <button class="btn big" data-act="open" data-id="${next.p.id}">Ver ficha</button>
    </div>
    <p class="muted hint">Pulsad Hecho al terminar la visita: las horas de lo que queda se recalculan.</p>
  </div>`;
  const rest = live.rows.slice(1);
  if (rest.length) {
    html += `<div class="label" style="margin-top:4px">Después</div><ol class="mini">${rest.map(r => `<li><button data-act="edit" data-day="${dk}" data-i="${r.i}"><time class="tnum">${fromMin(r.start)}</time><span class="n">${esc(r.p.n)}</span>${pill(r.st && r.st.cls !== 'good' ? r.st : null)}${r.late ? '<span class="pill bad">tarde</span>' : ''}</button></li>`).join('')}</ol>`;
  }
  if (live.back) html += `<p class="muted">Vuelta al hotel prevista a las <b class="tnum">${fromMin(live.back.arr)}</b>.</p>`;
  return html;
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
  $('#reflabel').textContent = `Minutos a pie desde ${refLabel()}`;
  $('#list').innerHTML = items.length ? items.map(({ p, m }) => {
    const idx = S.days[dk].stops.findIndex(s => s.id === p.id);
    const other = planHits(p.id).filter(([k]) => k !== dk).map(([k, n]) => `${DAYS[k].short} ${n}`).join(', ');
    const meta = [`<span class="district">${p.d}</span>`, p.meal ? esc(p.meal) : fmtMin(p.dur), esc(p.pr && p.c === 'comer' ? p.pr : p.p)];
    return `<li class="item" style="--c:${catVar(p.c)}"><span class="bar"></span>
      <button class="item-main" data-act="open" data-id="${p.id}"><div class="item-name">${esc(p.n)}</div>
      <div class="item-meta">${meta.join('<span aria-hidden="true">·</span>')} ${pill(hoursLabel(p))} ${other ? `<span class="pill neutral">En plan: ${other}</span>` : ''}</div></button>
      <div class="item-side"><span class="walk">${walkMin(m)} min</span>
      <button class="add ${idx >= 0 ? 'in' : ''}" data-act="add" data-id="${p.id}" aria-label="${idx >= 0 ? 'Quitar del' : 'Añadir al'} ${esc(DAYS[dk].label)}">${idx >= 0 ? `${IC.check}${DAYS[dk].short}` : IC.plus}</button></div></li>`;
  }).join('') : `<li class="empty">Nada con "${esc($('#q').value)}". Prueba con otra palabra, por ejemplo "pub", "gratis" o "catedral".</li>`;
}
function renderExplore() {
  $('#sortseg').innerHTML = [['rel', 'Recomendados'], ['near', 'Más cerca de mí']].map(([k, n]) => `<button type="button" data-act="sort" data-id="${k}" aria-pressed="${S.sort === k}">${n}</button>`).join('');
  $('#dayline').innerHTML = `<span>El botón + añade al día</span>${daySeg('day', S.day, 'style="grid-auto-columns:auto"')}`;
  renderCats(); renderList();
}

// ---------- Sheet: place detail or stop editor ----------
let sheetPushed = false, sheet = null; // sheet = { kind: 'place', id } | { kind: 'stop', dk, id }
function nearList(p, food) {
  return PLACES.filter(x => x.id !== p.id && (food ? (x.c === 'comer' || x.meal) : (x.c !== 'comer' && x.c !== 'pub')))
    .map(x => ({ x, m: dist(p, x) })).sort((a, b) => a.m - b.m).slice(0, 4)
    .map(({ x, m }) => `<button data-act="open" data-id="${x.id}"><span class="dot" style="--c:${catVar(x.c)}"></span><span class="n">${esc(x.n)}</span><span class="walk">${walkMin(m)} min</span></button>`).join('');
}
function renderPlaceSheet(p) {
  const m = dist(refPt(), p);
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
    <div class="row">${pill(hoursLabel(p))}<span class="muted">${esc(p.ht)}</span></div>
    <p class="prose">${esc(p.t)}</p>
    <p class="prose tipbox">${esc(p.tip)}</p>
    <div><div class="label" style="margin-bottom:6px">Añadir al plan</div>
      <div class="addrow">${DAYKEYS.map(k => { const h = hits.find(([d]) => d === k); return `<button class="btn ${h ? 'in' : ''}" data-act="add" data-id="${p.id}" data-day="${k}">${h ? `✓ ${DAYS[k].short} · ${h[1]}` : `+ ${DAYS[k].short}`}</button>`; }).join('')}</div>
    </div>
    <div class="row">
      <a class="btn primary" href="${appleMaps(p, p.n)}" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>
      <button class="btn" data-act="mapfocus" data-id="${p.id}">${IC.map}Ver en el mapa</button>
      <a class="btn" href="${gmapsPlace(p)}" target="_blank" rel="noopener">${IC.ext}Google Maps</a>
    </div>
    ${p.l.length ? `<div class="links"><div class="label">Entradas e información (con internet)</div>${p.l.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(t)}</span><small>${esc(new URL(u).hostname.replace('www.', ''))} ↗</small></a>`).join('')}</div>` : ''}
    <div class="near"><div class="label">Para comer o beber cerca</div>${nearList(p, true)}</div>
    <div class="near"><div class="label">Para ver cerca</div>${nearList(p, false)}</div>`;
}
function renderStopSheet(dk, id) {
  const d = S.days[dk], i = d.stops.findIndex(s => s.id === id);
  if (i < 0) { closeDetail(); return; }
  const s = d.stops[i], p = BYID[s.id];
  const row = computeDay(dk).rows.find(r => r.i === i);
  $('#sheet-label').textContent = `Parada ${i + 1} · ${DAYS[dk].label}`;
  $('#sheet-body').innerHTML = `
    <div>
      <div class="d-cat"><span class="dot" style="--c:${catVar(p.c)}"></span>${esc(CATS[p.c].one)} <span class="district">${p.d}</span></div>
      <h2 class="d-title" id="d-title">${esc(p.n)}</h2>
      <p class="muted" style="margin:6px 0 0">${row ? `Prevista de <b class="tnum">${fromMin(row.start)}</b> a <b class="tnum">${fromMin(row.dep)}</b>` : 'Saltada: no cuenta en el horario.'}</p>
      <div class="row" style="margin-top:6px">${row ? pill(row.st) + stopBadges({}, row) : ''}</div>
    </div>
    <section class="ed"><div class="label">¿Cuánto tiempo queréis estar?</div>
      <div class="durchips">${DUR_CHIPS.map(n => `<button class="chip" data-act="edur" data-v="${n}" aria-pressed="${s.dur === n}">${fmtMin(n)}</button>`).join('')}</div>
      <div class="ctrl"><button class="btn" data-act="edurd" data-v="-5" aria-label="5 minutos menos">−5</button><b class="tnum">${fmtMin(s.dur)}</b><button class="btn" data-act="edurd" data-v="5" aria-label="5 minutos más">+5</button></div>
    </section>
    <section class="ed"><div class="label">Hora reservada</div>
      <p class="muted">Si tenéis entrada con hora, ponedla: la ruta espera hasta esa hora y avisa si llegáis tarde.</p>
      <div class="row"><input type="time" id="e-res" value="${esc(s.reservedAt)}" aria-label="Hora reservada">${s.reservedAt ? '<button class="btn" data-act="eresclear">Quitar la hora</button>' : ''}</div>
      <label class="check" for="e-ticket"><input type="checkbox" id="e-ticket" ${s.ticketBought ? 'checked' : ''}>Entrada ya comprada</label>
    </section>
    <section class="ed"><div class="label">Nota</div>
      <textarea id="e-note" placeholder="Por ejemplo: localizador ABC123, pedir mesa junto a la ventana…">${esc(s.note)}</textarea>
    </section>
    <section class="ed"><div class="label">Orden</div>
      <div class="row"><button class="btn" data-act="emv" data-v="-1" ${i === 0 ? 'disabled' : ''}>↑ Antes</button><button class="btn" data-act="emv" data-v="1" ${i === d.stops.length - 1 ? 'disabled' : ''}>↓ Después</button></div>
      <div class="label" style="margin-top:10px">Pasar a otro día</div>
      <div class="row">${DAYKEYS.filter(k => k !== dk).map(k => `<button class="btn" data-act="emoveday" data-day="${k}">Al ${esc(dayName(k))}</button>`).join('')}</div>
    </section>
    <section class="ed">
      <div class="row">
        <button class="btn ${s.done ? 'primary' : ''}" data-act="edone">${IC.check}${s.done ? 'Hecho' : 'Marcar como hecho'}</button>
        <button class="btn ${s.skipped ? 'primary' : ''}" data-act="eskip">${IC.skip}${s.skipped ? 'Saltada (volver a incluir)' : 'Saltar esta parada'}</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn" data-act="open" data-id="${p.id}">Ver ficha del sitio</button>
        <button class="btn danger" data-act="edel">Quitar del plan</button>
      </div>
    </section>`;
}
function renderSheet() {
  if (!sheet) return;
  if (sheet.kind === 'stop') renderStopSheet(sheet.dk, sheet.id);
  else if (BYID[sheet.id]) renderPlaceSheet(BYID[sheet.id]);
}
function openSheet(next) {
  sheet = next;
  renderSheet();
  const sh = $('#sheet');
  if (sh.hidden) {
    sh.hidden = false;
    try { history.pushState({ sheet: 1 }, ''); sheetPushed = true; } catch (e) { sheetPushed = false; }
  }
  $('#sheet-body').scrollTop = 0;
}
const openDetail = id => openSheet({ kind: 'place', id });
let afterPop = null;
function closeDetail(fromPop, then) {
  if ($('#sheet').hidden) { if (then) then(); return; }
  $('#sheet').hidden = true; sheet = null;
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
function editStop(fn) {
  const d = S.days[sheet.dk], s = d.stops.find(x => x.id === sheet.id);
  if (!s) return;
  fn(s, d);
  save(); renderSheet();
}

// ---------- Plan view ----------
function renderPlan() {
  const dk = S.day, d = S.days[dk], c = computeDay(dk);
  const sun = toMin(SUNSET);
  let sunShown = c.startT >= sun;
  const sunRow = t => { if (sunShown || t < sun) return ''; sunShown = true; return `<li class="tl-sun">Anochece sobre las ${SUNSET}: los parques cierran</li>`; };
  const walkRow = (w, m) => `<li class="tl-walk">${IC.walk}<span>${w} min a pie · ${fmtDist(m)}</span>${w > 25 ? '<span class="far">lejos: mejor bus, Luas o taxi</span>' : ''}</li>`;
  let tl = `<li class="tl-node"><span class="ic">${d.from === 'gps' && gpsInDublin() ? '•' : 'H'}</span><div><time>${fromMin(c.startT)}</time> · Salida desde <b>${esc(c.start.n)}</b></div></li>`;
  const byIndex = new Map(c.rows.map(r => [r.i, r]));
  d.stops.forEach((s, i) => {
    const p = BYID[s.id];
    if (!p) return;
    const r = byIndex.get(i);
    if (!r) {
      tl += `<li class="tl-stop skipped" style="--c:${catVar(p.c)}"><span class="num">${i + 1}</span><button class="card" data-act="edit" data-day="${dk}" data-i="${i}"><span class="r1"><span class="pill neutral">Saltada</span></span><span class="sname">${esc(p.n)}</span></button></li>`;
      return;
    }
    tl += walkRow(r.w, r.m) + sunRow(r.start);
    tl += `<li class="tl-stop ${s.done ? 'done' : ''}" style="--c:${catVar(p.c)}"><span class="num">${s.done ? '✓' : i + 1}</span>
      <button class="card" data-act="edit" data-day="${dk}" data-i="${i}">
        <span class="r1"><time>${fromMin(r.start)}–${fromMin(r.dep)}</time>${pill(r.st)}</span>
        <span class="sname">${esc(p.n)}</span>
        <span class="row">${stopBadges(s, r)}<span class="tapedit">Cambiar ›</span></span>
      </button></li>`;
  });
  if (c.back) tl += walkRow(c.back.w, c.back.m) + sunRow(c.back.arr) + `<li class="tl-node"><span class="ic">H</span><div><time>${fromMin(c.back.arr)}</time> · De vuelta en el hotel</div></li>`;
  else if (c.rows.length) tl += sunRow(c.end);

  const lim = toMin(d.limit);
  let limitMsg = '';
  if (lim !== null && c.rows.length) {
    const diff = c.end - lim;
    limitMsg = diff > 0
      ? `<div class="banner urgent limitmsg"><div><b>Os pasáis ${fmtMin(diff)}</b> de la hora límite (${d.limit}). Quitad o acortad alguna parada.</div></div>`
      : `<p class="muted limitmsg">Margen de ${fmtMin(-diff)} antes de las ${d.limit}.</p>`;
  }
  const urls = gmapsRoutes(dk);
  const tpls = TEMPLATES[dk].map((t, i) => `<div class="tpl-item"><b>${esc(t.n)}</b><p>${esc(t.d)}</p>
      <p>${t.s.map(([id]) => esc(BYID[id]?.n || id)).join(' → ')}</p>
      <div class="row"><button class="btn small primary" data-act="tpl" data-i="${i}">Usar esta ruta</button><button class="btn small" data-act="tpladd" data-i="${i}">Añadir al final</button></div></div>`).join('');

  $('#view-plan').innerHTML = `
    <div class="plan-head">
      ${daySeg('day', S.day, 'class="seg big"')}
      <p class="day-note">${esc(DAYS[dk].note)}</p>
      ${dk === 'vie' ? `<p class="day-note"><b>Excursión:</b> ${esc(excursionLine())} <button class="linkbtn" data-act="goto" data-id="sec-exc">Cambiar</button></p>` : ''}
    </div>
    ${c.rows.length || d.stops.length ? `<ol class="tl">${tl}</ol>
      <div class="totals">
        <div><b>${fromMin(c.end)}</b><span>${c.back ? 'en el hotel' : 'fin'}</span></div>
        <div><b>${fmtDist(c.mTot)}</b><span>${fmtMin(c.walkTot)} a pie</span></div>
        <div><b>${feeText(dayFees(dk))}</b><span>entradas p. p.</span></div>
      </div>${limitMsg}
      <p class="muted fine">Entradas: estimación por persona con los precios orientativos de cada ficha.</p>`
    : `<div class="empty">Todavía no hay paradas para el ${esc(dayName(dk))}.<br>Añadid sitios desde Explorar o usad una ruta sugerida.</div>`}
    <div class="actions">
      <button class="btn" data-act="addmore">${IC.plus}Añadir un sitio</button>
      ${c.rows.length > 1 ? `<button class="btn" data-act="opt">${IC.shuffle}Mejorar el orden</button>` : ''}
      ${c.rows.length ? `<button class="btn" data-act="mapday">${IC.map}Ver en el mapa</button>` : ''}
      ${urls.map((u, n) => `<a class="btn" href="${u}" target="_blank" rel="noopener">${IC.ext}Ruta en Google Maps${urls.length > 1 ? ` (${n + 1}/${urls.length})` : ''}</a>`).join('')}
    </div>
    <details class="box" ${c.rows.length ? '' : 'open'}><summary>Rutas sugeridas para el ${esc(DAYS[dk].short.toLowerCase())}</summary><div class="tpl">${tpls}</div></details>
    <details class="box"><summary>Hora de salida y vuelta</summary>
      <div class="settings">
        <label for="p-start">Salida<input type="time" id="p-start" value="${esc(d.start)}"></label>
        <label for="p-from">Desde<select id="p-from"><option value="hotel">el hotel</option><option value="gps" ${d.from === 'gps' ? 'selected' : ''}>mi posición</option></select></label>
        ${DAYS[dk].limit ? `<label for="p-limit">Hora límite<input type="time" id="p-limit" value="${esc(d.limit)}"></label>` : ''}
        <label class="check" for="p-back"><input type="checkbox" id="p-back" ${d.back ? 'checked' : ''}>Terminar volviendo al hotel</label>
      </div></details>
    <details class="box" ${d.notes ? 'open' : ''}><summary>Notas del día</summary><textarea id="p-notes" placeholder="Reservas, horas de entradas, ideas…">${esc(d.notes)}</textarea></details>
    ${d.stops.length ? `<p style="margin-top:12px"><button class="btn small" data-act="clear">Vaciar este día</button></p>` : ''}`;
}

// ---------- Info view ----------
// Export format DUBLIN1: stops are [id, dur, done] plus an optional 4th element with the newer fields.
function packPlan() {
  const o = { v: 1, h: S.hotel, d: {}, c: S.checklist.map(c => [c.text, c.checked ? 1 : 0]), e: S.excursion };
  for (const k of DAYKEYS) {
    const d = S.days[k];
    o.d[k] = { s: d.start, f: d.from, b: d.back ? 1 : 0, l: d.limit, n: d.notes, x: d.stops.map(s => {
      const extra = {};
      if (s.skipped) extra.k = 1;
      if (s.reservedAt) extra.r = s.reservedAt;
      if (s.ticketBought) extra.t = 1;
      if (s.note) extra.n = s.note;
      return Object.keys(extra).length ? [s.id, s.dur, s.done ? 1 : 0, extra] : [s.id, s.dur, s.done ? 1 : 0];
    }) };
  }
  return 'DUBLIN1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function unpackPlan(txt) {
  const m = /DUBLIN1:([A-Za-z0-9+/=]+)/.exec(txt || '');
  if (!m) throw new Error('code');
  const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  if (!o || typeof o !== 'object') throw new Error('code');
  const days = {}, def = emptyDays();
  for (const k of DAYKEYS) {
    const x = (o.d || {})[k] || {};
    days[k] = { start: toMin(x.s) !== null ? x.s : def[k].start, from: x.f === 'gps' ? 'gps' : 'hotel', back: x.b !== 0, limit: typeof x.l === 'string' ? x.l : def[k].limit, notes: String(x.n || '').slice(0, 2000),
      stops: (Array.isArray(x.x) ? x.x : []).filter(s => Array.isArray(s) && BYID[s[0]]).map(s => {
        const e = s[3] && typeof s[3] === 'object' ? s[3] : {};
        return normStop({ id: s[0], dur: +s[1], done: !!s[2], skipped: !!e.k, reservedAt: e.r, ticketBought: !!e.t, note: e.n });
      }) };
  }
  const out = { hotel: HOTELS[o.h] ? o.h : S.hotel, days };
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
      <p class="muted">Apuntad aquí la que reservéis: sale en Hoy el viernes por la mañana.</p>
      <div class="form">
        <label for="x-name">Cuál<input type="text" id="x-name" value="${esc(e.name)}" placeholder="Por ejemplo: Cork y Roca de Cashel" maxlength="120"></label>
        <label for="x-time">Hora de salida<input type="time" id="x-time" value="${esc(e.time)}"></label>
        <label for="x-meet">Punto de encuentro<input type="text" id="x-meet" value="${esc(e.meetingPoint)}" placeholder="Por ejemplo: George's Quay" maxlength="200"></label>
        <label for="x-url">Enlace de la reserva<input type="url" id="x-url" value="${esc(e.url)}" placeholder="https://…" inputmode="url"></label>
      </div>
      <div class="label" style="margin-top:6px">Opciones en Civitatis (toca "Elegir" para apuntarla)</div>
      ${TRIPS.map((t, i) => `<div class="trip"><b><span>${esc(t.n)}</span><span>${esc(t.p)}</span></b><span>${esc(t.t)}</span>
        <div class="row"><button class="btn small ${e.url === t.u ? 'primary' : ''}" data-act="pickexc" data-i="${i}">${e.url === t.u ? '✓ Elegida' : 'Elegir'}</button><a class="btn small" href="${esc(t.u)}" target="_blank" rel="noopener">${IC.ext}Ver en Civitatis</a></div></div>`).join('')}
    </section>
    <section><h2 class="h2">Al aeropuerto el sábado</h2>
      <p>Con vuelo hacia las 16:00, estad en el aeropuerto sobre las 14:00. Irlanda no está en Schengen: hay control de documentación.</p>
      <ul>
        <li><b>Taxi o app FREENOW:</b> 25–40 min, unos 30–40 € desde el centro. Lo más cómodo con maletas.</li>
        <li><b>Aircoach o Dublin Express:</b> salen del centro (O'Connell Street y otras paradas) cada 15–30 min, unos 30–45 min, alrededor de 10 € por persona.</li>
        <li><b>Dublin Bus 16 o 41:</b> desde O'Connell Street, unos 2–3 €, pero 45–60 min y poco sitio para maletas.</li>
      </ul>
      <p class="muted">Precios y paradas aproximados: comprobad la parada más cercana al hotel antes del sábado.</p></section>
    <section><h2 class="h2">Luz y tiempo</h2>
      <dl class="kv"><dt>${SUNRISE}</dt><dd>Amanece</dd><dt>${SUNSET}</dt><dd>Anochece. Los parques cierran a esa hora: dejad museos y pubs para la tarde.</dd><dt>6–11 °C</dt><dd>Chubascos y viento. Mejor chubasquero con capucha que paraguas, y calzado que aguante agua.</dd></dl></section>
    <section><h2 class="h2">Moverse</h2>
      <ul>
        <li>El centro se recorre a pie: de Christ Church a Merrion Square hay unos 25 min.</li>
        <li><b>Luas (tranvía):</b> la línea roja va por los muelles del norte hasta Heuston, útil para la Guinness y Kilmainham. Billete en la máquina de la parada.</li>
        <li><b>Bus:</b> billete en la app TFI Go o con tarjeta Leap. En efectivo solo monedas y sin cambio.</li>
        <li>Se conduce por la izquierda: mirad a la derecha al cruzar.</li>
      </ul></section>
    <section><h2 class="h2">Consejos</h2>
      <ul>
        <li>Enchufes tipo G (británico): llevad adaptador.</li>
        <li>En los pubs se pide y se paga en la barra, sin propina. En restaurantes con mesa, un 10 % si os ha gustado.</li>
        <li>Muchas cocinas de pub cierran sobre las 21:00. La música tradicional suele empezar a partir de las 21:00.</li>
        <li>Con DNI basta. La tarjeta se acepta casi en todas partes. Emergencias: 112 o 999.</li>
      </ul></section>
    <section><h2 class="h2">Usar sin internet</h2>
      <p id="offline-status"><b>${esc(offlineLine())}</b></p>
      <ul>
        <li><b>iPhone:</b> en Safari, botón Compartir → "Añadir a pantalla de inicio". Abrid siempre la app desde ese icono.</li>
        <li>Funcionan sin internet: Hoy, el plan, el buscador, las fichas y el mapa. Necesitan internet: los enlaces de entradas.</li>
        <li><b>Cómo llegar</b> abre Apple Maps. Para que funcione sin datos, descargad antes el mapa de Dublín: en Apple Maps, toca tu foto → Mapas sin conexión → Descargar nuevo mapa.</li>
      </ul></section>
    <section><h2 class="h2">Pasar el plan a otro móvil</h2>
      <p class="muted">Copiad el código y mandadlo por WhatsApp. En el otro móvil, pegadlo abajo y pulsad Importar.</p>
      <div class="row"><button class="btn primary" data-act="export">Copiar código del plan</button>${navigator.share ? '<button class="btn" data-act="share">Compartir</button>' : ''}</div>
      <textarea id="io" aria-label="Código del plan" placeholder="Pega aquí un código DUBLIN1:…"></textarea>
      <div class="row"><button class="btn" data-act="import">Importar plan</button><button class="btn" data-act="reset">Volver al plan inicial</button></div>
    </section>
    <section><h2 class="h2">Hotel</h2>
      <div class="hotelpick">${Object.entries(HOTELS).map(([k, h]) => `<label for="h-${k}"><input type="radio" name="hotel" id="h-${k}" value="${k}" ${S.hotel === k ? 'checked' : ''}><span><b>${esc(h.name)}</b><small>${esc(h.addr)}</small></span></label>`).join('')}</div></section>
    <p class="muted fine">Horarios y precios orientativos de noviembre, preparados el 3 de noviembre de 2026. Pueden cambiar: comprobadlos en la web oficial antes de ir.</p>
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
      toast('No se pudo saber dónde estás. Revisa el permiso de ubicación.');
    }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 25000 });
  } catch (e) { watchId = null; toast('No se pudo saber dónde estás'); }
}
function flushGPS() { const w = gpsWaiters; gpsWaiters = []; w.forEach(f => f()); }
function onGPSMove() {
  if (!gpsInDublin()) { toast('Estás lejos de Dublín: las distancias se miden desde el hotel'); return; }
  renderAll();
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
  if (t === 'today') renderToday();
  else if (t === 'plan') renderPlan();
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
  requestAnimationFrame(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); });
}

// ---------- Events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, i = +el.dataset.i, v = +el.dataset.v;
  const d = S.days[S.day];
  switch (a) {
    case 'open': openDetail(id); break;
    case 'edit': { const dk = el.dataset.day, s = S.days[dk].stops[i]; if (s) openSheet({ kind: 'stop', dk, id: s.id }); break; }
    case 'add': toggleStop(id, el.dataset.day || S.day); break;
    case 'cat': S.cat = id; save(); renderCats(); renderList(); break;
    case 'sort':
      S.sort = id; save();
      if (id === 'near') { toast('Buscando dónde estás…'); startGPS(renderList); }
      renderExplore(); break;
    case 'day': S.day = el.dataset.day; save(); renderAll(); break;
    case 'goplan': S.day = el.dataset.day; setTab('plan'); break;
    case 'goto': closeDetail(false, () => gotoSection(id)); break;
    case 'addmore': setTab('explore'); break;
    case 'nearme': S.sort = 'near'; S.cat = 'all'; setTab('explore'); startGPS(renderList); break;
    case 'text': S.largeText = id === '1'; save(); applyText(); renderInfo(); break;
    case 'hdone': case 'hskip': {
      const s = S.days[el.dataset.day].stops[i];
      if (!s) break;
      snapshot();
      if (a === 'hdone') s.done = true; else s.skipped = true;
      save(); renderAll();
      toast(a === 'hdone' ? `Hecho: ${BYID[s.id].n}` : `Saltada: ${BYID[s.id].n}`, 'Deshacer', restore);
      break;
    }
    // Stop editor
    case 'edur': editStop(s => { s.dur = clampDur(v); }); break;
    case 'edurd': editStop(s => { s.dur = clampDur(s.dur + v); }); break;
    case 'eresclear': editStop(s => { s.reservedAt = ''; }); break;
    case 'emv': editStop((s, dd) => { const k = dd.stops.indexOf(s), j = k + v; if (j >= 0 && j < dd.stops.length) [dd.stops[k], dd.stops[j]] = [dd.stops[j], dd.stops[k]]; }); break;
    case 'edone': editStop(s => { s.done = !s.done; if (s.done) s.skipped = false; }); break;
    case 'eskip': editStop(s => { s.skipped = !s.skipped; if (s.skipped) s.done = false; }); break;
    case 'emoveday': {
      const from = S.days[sheet.dk], to = S.days[el.dataset.day], k = from.stops.findIndex(s => s.id === sheet.id);
      if (k < 0) break;
      snapshot();
      const [s] = from.stops.splice(k, 1);
      if (!to.stops.some(x => x.id === s.id)) to.stops.push(s);
      save(); closeDetail();
      toast(`Pasado al ${dayName(el.dataset.day)}`, 'Deshacer', restore);
      break;
    }
    case 'edel': {
      const from = S.days[sheet.dk], k = from.stops.findIndex(s => s.id === sheet.id);
      if (k < 0) break;
      snapshot(); from.stops.splice(k, 1); save(); closeDetail();
      toast('Parada quitada', 'Deshacer', restore);
      break;
    }
    case 'opt': optimize(S.day); break;
    case 'tpl': loadTemplate(S.day, i, false); break;
    case 'tpladd': loadTemplate(S.day, i, true); break;
    case 'clear': snapshot(); d.stops = []; save(); renderPlan(); toast('Día vaciado', 'Deshacer', restore); break;
    case 'mapday': showMap(null, S.day); break;
    case 'mapfocus': closeDetail(false, () => showMap(id)); break;
    case 'mapmode': S.mapMode = el.dataset.day; save(); showMap(null, S.mapMode); break;
    case 'mapclose': selectOnMap(null); break;
    case 'ckdel': S.checklist = S.checklist.filter(c => c.id !== id); save(); renderInfo(); break;
    case 'pickexc': { const t = TRIPS[i]; S.excursion = { ...S.excursion, name: t.n, url: t.u }; save(); renderInfo(); toast('Excursión apuntada'); break; }
    case 'export': {
      const code = packPlan(), io = $('#io');
      io.value = code;
      const sel = () => { io.focus(); io.select(); toast('Código seleccionado: cópialo'); };
      try { navigator.clipboard.writeText(code).then(() => toast('Código copiado'), sel); } catch (err) { sel(); }
      break;
    }
    case 'share': navigator.share({ title: 'Plan Dublín', text: packPlan() }).catch(() => {}); break;
    case 'import': {
      try {
        const r = unpackPlan($('#io').value);
        snapshot();
        S.days = r.days; S.hotel = r.hotel;
        if (r.checklist) S.checklist = r.checklist;
        if (r.excursion) S.excursion = r.excursion;
        save(); renderInfo(); toast('Plan importado', 'Deshacer', restore);
      } catch (err) { toast('Ese texto no es un código de plan válido. Debe empezar por DUBLIN1:'); }
      break;
    }
    case 'reset':
      if (el.dataset.armed) { snapshot(); S.days = defState(true).days; save(); renderInfo(); toast('Plan inicial recuperado', 'Deshacer', restore); }
      else { el.dataset.armed = '1'; el.textContent = 'Pulsa otra vez para confirmar'; el.classList.add('danger'); }
      break;
  }
});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
$('#q').addEventListener('input', renderList);
$('#q-clear').addEventListener('click', () => { $('#q').value = ''; renderList(); $('#q').focus(); });
$('#sheet-close').addEventListener('click', () => closeDetail());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
$('#sheet-body').addEventListener('change', e => {
  if (!sheet || sheet.kind !== 'stop') return;
  if (e.target.id === 'e-res') editStop(s => { s.reservedAt = toMin(e.target.value) !== null ? e.target.value : ''; });
  else if (e.target.id === 'e-ticket') editStop(s => { s.ticketBought = e.target.checked; });
});
$('#sheet-body').addEventListener('input', e => {
  if (e.target.id !== 'e-note' || !sheet) return;
  const s = S.days[sheet.dk].stops.find(x => x.id === sheet.id);
  if (s) { s.note = e.target.value.slice(0, 500); save(); }
});
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
  toast('Buscando dónde estás…');
  startGPS(() => { if (!gpsInDublin()) { toast('Estás lejos de Dublín'); return; } renderMarkers(); centerOn(GPS.lat, GPS.lon, 1200); });
});
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);
// Hoy depends on the clock: refresh it every minute while visible.
setInterval(() => { if (S.tab === 'today' && $('#sheet').hidden && !document.hidden) renderToday(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tab === 'today') renderToday(); });

// ---------- Boot ----------
const S = load();
(function boot() {
  applyText();
  const fromHash = Object.entries(TAB_HASH).find(([, h]) => '#' + h === location.hash);
  setTab(fromHash ? fromHash[0] : 'today');
  renderNet();
  if (S.sort === 'near' || DAYKEYS.some(k => S.days[k].from === 'gps') || todayKey()) startGPS();
  save();
  if (PWA && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(renderNet).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', renderNet);
  }
})();
