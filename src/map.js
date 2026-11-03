'use strict';
// Schematic offline map: projected SVG with pan/pinch zoom. Uses state and helpers from app.js.
// ---------- Map ----------
const LAT0 = 53.345, LON0 = -6.265, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
const WATER_LABELS = [{ n: 'Río Liffey', lat: 53.3474, lon: -6.2520 }, { n: 'Río Liffey', lat: 53.3462, lon: -6.2810 }];
// Real-world widths (m) and minimum on-screen widths (px) per road class; drawn bottom to top.
const ROADS = [['foot', 3, 1.2], ['res', 8, 2], ['ped', 8, 2.5], ['ter', 11, 2.5], ['sec', 14, 3.5], ['major', 18, 4]];
// Street labels: font size and the largest zoom (m per px) at which each class is labelled.
const LBL = { major: [12.5, 9], sec: [12, 8], ter: [11.5, 4], ped: [11.5, 3.6], res: [11, 2.2], foot: [10, 1.2] };
let mapReady = false, view = null, svg, markers = [], selId = null;
const SVGNS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const pathD = (pts, close) => pts.map(([la, lo], i) => { const [x, y] = proj(la, lo); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + (close ? 'Z' : '');
const flatD = (lines, close) => lines.map(a => { let d = `M${a[0]} ${a[1]}`; for (let i = 2; i < a.length; i += 2) d += `L${a[i]} ${a[i + 1]}`; return close ? d + 'Z' : d; }).join('');
let riverEl, canalEl, roadEls = [];

function initMap() {
  svg = $('#map');
  const base = mk('g', {}, svg);
  mk('path', { d: flatD(OSM.parks, true), class: 'park' }, base);
  canalEl = mk('path', { d: flatD(OSM.canal), class: 'canal' }, base);
  riverEl = mk('path', { d: flatD(OSM.river), class: 'river' }, base);
  roadEls = [];
  for (const [c] of ROADS) roadEls.push([c, 'edge', mk('path', { d: flatD(OSM.roads[c] || []), class: `rd-edge rd-${c}` }, base)]);
  for (const [c] of ROADS) roadEls.push([c, 'fill', mk('path', { d: flatD(OSM.roads[c] || []), class: `rd rd-${c}` }, base)]);
  mk('path', { d: flatD(OSM.tram), class: 'tram' }, base);
  mk('g', { id: 'lblg' }, svg);
  mk('g', { id: 'routeg' }, svg);
  mk('g', { id: 'mkg' }, svg);
  mk('g', { id: 'topg' }, svg);
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
  for (const [c, kind, el] of roadEls) {
    const [, real, min] = ROADS.find(x => x[0] === c);
    const w = Math.min(40, Math.max(min, real / s));
    el.style.strokeWidth = (kind === 'edge' ? w + 2 : w) + 'px';
  }
  riverEl.style.strokeWidth = Math.max(5, 42 / s) + 'px';
  canalEl.style.strokeWidth = Math.max(2, 14 / s) + 'px';
  svg.classList.toggle('labels', s < 1.2);
  scheduleLabels();
}
// Street names are laid out after the view settles: highest-class streets first, skipping any that would overlap.
let lblT = null;
function scheduleLabels() { clearTimeout(lblT); lblT = setTimeout(layoutLabels, 90); }
function layoutLabels() {
  const r = svg.getBoundingClientRect();
  if (!r.width) return;
  const s = view.w / r.width, h = view.w * r.height / r.width;
  const x0 = view.x, y0 = view.y, x1 = x0 + view.w, y1 = y0 + h;
  const placed = [], out = [];
  const hit = b => placed.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  // POI markers reserve their own spot.
  for (const m of markers) if (m.kind === 'poi' && m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1) placed.push([m.x - 5 * s, m.y - 5 * s, m.x + 5 * s, m.y + 5 * s]);
  for (const [n, c, cand] of OSM.labels) {
    const [fs, maxS] = LBL[c];
    if (s > maxS) continue;
    const w = n.length * fs * 0.56 * s / 2 + 4 * s, hh = fs * 0.7 * s;
    for (let k = 0; k < cand.length; k += 3) {
      const x = cand[k], y = cand[k + 1], ang = cand[k + 2];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const ra = Math.abs(ang) * Math.PI / 180;
      const bw = w * Math.cos(ra) + hh * Math.sin(ra), bh = w * Math.sin(ra) + hh * Math.cos(ra);
      const box = [x - bw, y - bh, x + bw, y + bh];
      if (hit(box)) continue;
      placed.push(box);
      out.push(`<text class="sl sl-${c}" transform="translate(${x} ${y}) rotate(${ang}) scale(${s.toFixed(4)})" text-anchor="middle" dy="0.35em">${esc(n)}</text>`);
      break;
    }
    if (out.length > 240) break;
  }
  for (const w of WATER_LABELS) {
    const [x, y] = proj(w.lat, w.lon);
    if (x > x0 && x < x1 && y > y0 && y < y1) out.push(`<text class="sl water" transform="translate(${x} ${y}) rotate(-8) scale(${s.toFixed(4)})" text-anchor="middle" dy="0.35em">${w.n}</text>`);
  }
  $('#lblg').innerHTML = out.join('');
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
  markers = [];
  const g = $('#mkg'), top = $('#topg'), rg = $('#routeg');
  g.innerHTML = ''; top.innerHTML = ''; rg.innerHTML = '';
  const onlyList = S.mapMode === 'list';
  const saved = new Map(S.list.map(x => [x.id, x]));
  // Saved places are drawn last so they sit on top.
  const ordered = PLACES.slice().sort((a, b) => (saved.has(a.id) ? 1 : 0) - (saved.has(b.id) ? 1 : 0));
  for (const p of ordered) {
    const it = saved.get(p.id);
    if (onlyList && !it) continue;
    const [x, y] = proj(p.lat, p.lon);
    const cls = ['mk', it ? 'stop saved' : '', it && it.visited ? 'seen' : '', selId === p.id ? 'sel' : ''].join(' ');
    const el = mk('g', { class: cls, 'data-id': p.id }, g);
    mk('circle', { r: it ? 10 : 7, fill: catVar(p.c) }, el);
    mk('circle', { r: 18, class: 'hit' }, el);
    if (it) { const t = mk('text', { class: 'num', 'text-anchor': 'middle', y: 4 }, el); t.textContent = it.visited ? '✓' : '★'; }
    const t = mk('text', { class: 'name', x: it ? 13 : 10, y: 4 }, el); t.textContent = p.n;
    markers.push({ el, x, y, kind: 'poi' });
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
  $('#mapmode').innerHTML = [['all', 'Todos los sitios'], ['list', 'Nuestra lista']].map(([k, n]) => `<button type="button" data-act="mapmode" data-id="${k}" aria-pressed="${S.mapMode === k}">${n}</button>`).join('');
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
  const m = dist(here().from, p);
  const it = listItem(p.id);
  card.hidden = false;
  card.innerHTML = `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="t">${esc(p.n)}</span><button class="btn small" data-act="mapclose" aria-label="Cerrar">${IC.x}</button></div>
    <div class="item-meta"><span class="dot" style="--c:${catVar(p.c)}"></span>${esc(CATS[p.c].one)} · ${walkMin(m)} min a pie ${pill(hoursLabel(p))}</div>
    <div class="row"><a class="btn small primary" href="${appleMaps(p, p.n)}" target="_blank" rel="noopener">${IC.nav}Cómo llegar</a>
    <button class="btn small" data-act="open" data-id="${p.id}">Ficha</button>
    <button class="btn small" data-act="save" data-id="${p.id}">${it ? '★ En la lista' : '☆ Guardar'}</button></div>`;
}
function showMap(focusId) {
  setTab('map');
  if (focusId) selId = focusId;
  renderMarkers();
  if (focusId) { const p = BYID[focusId]; centerOn(p.lat, p.lon, Math.min(view.w, 1400)); }
}
