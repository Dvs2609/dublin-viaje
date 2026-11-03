// Headless smoke test over the Chrome DevTools Protocol: loads the PWA, exercises the plan, screenshots each tab.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = new URL('./test-out/', import.meta.url).pathname;
const dark = process.argv.includes('--dark');
const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9333', '--no-first-run', '--user-data-dir=' + OUT + 'profile' + (dark ? '-d' : ''), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:9333/json'); const t = (await r.json()).find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + JSON.stringify(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) logs.push('EVAL ERR ' + expr.slice(0, 60) + ': ' + r.result.exceptionDetails.exception?.description); return r.result.result?.value; };
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT + name + '.png', Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
const go = async (hash = '') => { await send('Page.navigate', { url: 'http://127.0.0.1:8791/' + hash }); await sleep(1300); };
const click = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no '+${JSON.stringify(sel)}); e.click()})()`);
const sfx = dark ? '-dark' : '';
let failures = 0;
const check = (name, ok, extra = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
const cards = () => ev(`[...document.querySelectorAll('#carousel .door h3')].map(h=>h.innerText).join(' | ')`);
const at = async t => { await ev(`window.DEBUG_NOW=${JSON.stringify(t)}; renderTrip()`); await sleep(120); };
await go();
check('opens on Mi viaje', await ev(`S.tab`) === 'trip');
check('starts with the must-see list', await ev(`S.list.length`) === 12 && await ev(`S.hotel`) === 'christchurch');
check('preview before trip has cards', (await ev(`document.querySelectorAll('#carousel .door').length`)) > 3, await cards());
await shot('b1-before' + sfx);
await at('2026-11-05T13:10');
const lunch = await ev(`rankSuggestions('auto', here()).slice(0,8).map(s=>s.p.id+':'+s.why).join(', ')`);
check('lunchtime suggests food first', /^[a-z]+:Para comer/.test(lunch), lunch);
await shot('b2-lunch' + sfx);
await at('2026-11-05T19:30');
const night = await ev(`rankSuggestions('auto', here()).map(s=>s.p.c+':'+s.p.id).join(', ')`);
check('no parks at night', !/parque:/.test(night), night);
check('dinner or pubs at night', /comer:|pub:/.test(night), night);
await shot('b3-night' + sfx);
await at('2026-11-05T15:00');
await click('[data-act=mode][data-id=comer]'); await sleep(100);
check('Comer chip only food', await ev(`rankSuggestions('comer', here()).every(s=>s.p.c==='comer'||!!s.p.meal)`));
await click('[data-act=mode][data-id=rain]'); await sleep(100);
check('Si llueve chip only indoor', await ev(`rankSuggestions('rain', here()).every(s=>!s.p.out)`));
await click('[data-act=mode][data-id=auto]'); await sleep(100);
await at('2026-11-05T16:40');
check('closing places excluded', !(await ev(`rankSuggestions('auto', here()).some(s=>s.p.id==='trinity')`)) && await ev(`rankSuggestions('auto', here()).find(s=>s.p.id==='castle')?.f.txt`) === 'cierra a las 17:15');
// Booking Trinity at 15:00 on Thursday from its sheet.
await at('2026-11-05T14:20');
await ev(`openDetail('trinity')`); await sleep(150);
await ev(`document.querySelector('#sheet-body details').open=true`);
await ev(`(()=>{const d=document.querySelector('#b-day');d.value='jue';d.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(80);
await ev(`(()=>{const d=document.querySelector('#b-at');d.value='15:00';d.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(80);
await ev(`(()=>{const d=document.querySelector('#b-bought');d.checked=true;d.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(80);
await shot('b4-sheet' + sfx);
await click('#sheet-close'); await sleep(700);
check('booking saved', await ev(`JSON.stringify(listItem('trinity'))`) === JSON.stringify({ id: 'trinity', day: 'jue', at: '15:00', bought: true, note: '', visited: false, visitedAt: '' }), await ev(`JSON.stringify(listItem('trinity'))`));
check('booking shows urgent in the fixed strip', await ev(`!!document.querySelector('.fixed.urgent')`));
const withBooking = await ev(`rankSuggestions('auto', here()).map(s=>s.p.id+':'+s.w+':'+s.p.dur).join(', ')`);
check('booked place first', withBooking.startsWith('trinity'), withBooking);
await shot('b5-booking' + sfx);
// Seen: moves to "Ya vistos" and becomes the starting point.
await click('#carousel .door [data-act=seen]'); await sleep(150);
check('seen item becomes the reference point', await ev(`here().label`) === 'Trinity College y Libro de Kells', await ev(`here().label`));
check('seen item listed under Ya vistos', await ev(`document.querySelectorAll('details.box .wish li').length`) === 1);
await at('2026-11-07T12:50');
check('Saturday airport is urgent', await ev(`[...document.querySelectorAll('.fixed.urgent')].some(x=>x.innerText.includes('aeropuerto'))`));
await shot('b6-sab' + sfx);
await ev(`window.DEBUG_NOW=''`);
// Explore: star toggles the list.
await ev(`setTab('explore')`); await sleep(100);
const before = await ev(`S.list.length`);
await click('[data-act=save][data-id=cobblestone]'); await sleep(100);
check('star saves to list', await ev(`S.list.length`) === before + 1);
await shot('b7-explore' + sfx);
// Map list mode.
await ev(`S.mapMode='list'; setTab('map')`); await sleep(400);
check('map list mode shows only saved', await ev(`document.querySelectorAll('#mkg .mk').length`) === await ev(`S.list.length`));
await shot('b8-map-list' + sfx);
await ev(`S.mapMode='all'; save()`);
// Info + large text
await ev(`setTab('info')`); await sleep(100);
await click('[data-act=text][data-id="1"]'); await sleep(100);
for (const t of ['trip','explore','map','info']) { await ev(`setTab('${t}')`); await sleep(150); if (await ev(`document.documentElement.scrollWidth > innerWidth`)) check('no overflow with big text on ' + t, false); }
await ev(`window.DEBUG_NOW='2026-11-05T13:10'; setTab('trip')`); await sleep(200); await shot('b9-trip-big' + sfx);
await ev(`window.DEBUG_NOW=''; S.largeText=false; applyText()`);
// Codes: new round trip, old v1 plan codes, undo.
const code = await ev(`packPlan()`);
check('round trip', await ev(`(()=>{const r=unpackPlan(${JSON.stringify(code)});const t=r.list.find(x=>x.id==='trinity');return t.at==='15:00'&&t.bought&&t.visited&&r.list.length===S.list.length})()`));
const old = 'DUBLIN1:' + Buffer.from(JSON.stringify({ v: 1, h: 'parnell', d: { jue: { x: [['trinity', 60, 0, { r: '15:00', t: 1 }], ['castle', 45, 1]] }, sab: { x: [['trinity', 60, 0, { r: '10:00' }], ['gpo', 60, 0]] } } })).toString('base64');
const oi = await ev(`(()=>{const r=unpackPlan(${JSON.stringify(old)});return r.hotel+'|'+r.list.map(x=>x.id+':'+(x.day||'')+':'+x.at+':'+x.bought+':'+x.visited+':'+x.note).join(',')})()`);
check('old v1 code becomes a list', oi === 'parnell|trinity:jue:15:00:true:false:También reservado: Sáb 10:00,castle::00:false:true:,gpo:::false:false:'.replace('castle::00','castle::'), oi);
await ev(`(()=>{S.excursion.name='Antes';document.querySelector('#io')||setTab('info');})()`); await ev(`setTab('info')`); await sleep(100);
await ev(`(()=>{document.querySelector('#io').value=${JSON.stringify(old)};document.querySelector('[data-act=import]').click();})()`); await sleep(150);
await ev(`document.querySelector('#toast button').click()`); await sleep(150);
check('undo import restores', await ev(`S.excursion.name==='Antes' && S.hotel==='christchurch' && !!listItem('cobblestone')`));
// Saved state from earlier versions (plan per day) migrates once and keeps working.
await ev(`localStorage.setItem('dublin-bolsillo-v1', JSON.stringify({hotel:'christchurch',day:'sab',days:{jue:{stops:[{id:'trinity',dur:60,reservedAt:'15:00',ticketBought:true},{id:'zzz'}]},sab:{stops:[{id:'gpo',dur:60,done:true}]}},tab:'plan'}))`);
await ev(`history.replaceState(null,'','/#plan')`); await send('Page.reload'); await sleep(1300);
const mig = await ev(`[S.tab, S.list.map(x=>x.id+':'+(x.day||'')+':'+x.at+':'+x.visited).join(','), 'days' in S].join('|')`);
check('old saved state migrates', mig === 'trip|trinity:jue:15:00:false,gpo:::true|false', mig);
console.log('overflow-x', await ev(`document.documentElement.scrollWidth > innerWidth`));
await sleep(800);
console.log('sw controller', await ev(`!!navigator.serviceWorker.controller`));
console.log('LOGS:\n' + logs.join('\n'));
ws.close(); chrome.kill(); if (failures) { console.log(failures + ' FAILURES'); } (await import('node:child_process')).spawnSync('pkill', ['-f', '[r]emote-debugging-port=93']);
process.exit(failures ? 1 : 0);
