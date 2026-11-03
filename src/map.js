'use strict';
// Schematic offline map: projected SVG with pan/pinch zoom. Uses state and helpers from app.js.
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

