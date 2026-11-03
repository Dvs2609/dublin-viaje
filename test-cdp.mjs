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
const check = (name, ok, extra = '') => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
await go();
check('opens on Hoy', await ev(`S.tab`) === 'today');
check('hotel fixed', await ev(`S.hotel`) === 'christchurch');
check('plan preloaded', await ev(`DAYKEYS.map(k=>S.days[k].stops.length).join(',')`) === '9,1,4', await ev(`DAYKEYS.map(k=>S.days[k].stops.length).join(',')`));
await shot('a1-hoy-before' + sfx);
await click('[data-tab=plan]'); await sleep(200);
await shot('a2-plan' + sfx);
check('no bad status in preloaded jue', await ev(`computeDay('jue').rows.filter(r=>r.st&&r.st.cls==='bad').length`) === 0, await ev(`computeDay('jue').rows.map(r=>r.p.id+':'+(r.st&&r.st.txt)).join(' | ')`));
// Stop editor: book Trinity at 15:00
await ev(`document.querySelectorAll('.tl-stop .card')[2].click()`); await sleep(200);
await ev(`(()=>{const i=document.querySelector('#e-res');i.value='15:00';i.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(100);
await click('[data-act=edur][data-v="90"]'); await sleep(100);
await ev(`(()=>{const i=document.querySelector('#e-ticket');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(100);
await ev(`(()=>{const t=document.querySelector('#e-note');t.value='Localizador K-4821';t.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(100);
await shot('a3-editor' + sfx);
const tr = await ev(`(()=>{const r=computeDay('jue').rows.find(r=>r.p.id==='trinity');return {start:fromMin(r.start),wait:r.wait,dur:r.s.dur,t:r.s.ticketBought,n:r.s.note}})()`);
check('reservation sets start', tr.start === '15:00' && tr.dur === 90 && tr.t && tr.n === 'Localizador K-4821', JSON.stringify(tr));
await click('#sheet-close'); await sleep(700);
check('editor closed', await ev(`document.querySelector('#sheet').hidden`));
await click('[data-act=opt]'); await sleep(200);
check('optimizer keeps reserved/meal stops', await ev(`(()=>{const st=S.days.jue.stops.map(s=>s.id);return st.indexOf('queenoftarts')===1 && st.indexOf('trinity')===2 && st[st.length-1]==='oldstorehouse'})()`), await ev(`S.days.jue.stops.map(s=>s.id).join('>')`));
// Trip day view
await ev(`window.DEBUG_NOW='2026-11-05T13:10'; setTab('today')`); await sleep(200);
await shot('a4-hoy-trip' + sfx);
const first = await ev(`document.querySelector('.nowtitle').innerText`);
await click('[data-act=hdone]'); await sleep(150);
const second = await ev(`document.querySelector('.nowtitle').innerText`);
check('Hecho advances to next stop', first !== second, first + ' -> ' + second);
await click('[data-act=hskip]'); await sleep(150);
check('Saltar marks skipped', await ev(`S.days.jue.stops.some(s=>s.skipped)`));
await ev(`window.DEBUG_NOW='2026-11-07T12:50'; renderToday()`); await sleep(100);
check('Saturday airport banner urgent', await ev(`!!document.querySelector('.banner.urgent')`));
await shot('a5-hoy-sab' + sfx);
await ev(`window.DEBUG_NOW=''; renderToday()`);
// Info: large text, checklist, excursion
await click('[data-tab=info]'); await sleep(150);
await click('[data-act=text][data-id="1"]'); await sleep(100);
check('large text on', await ev(`document.documentElement.classList.contains('big')`));
await ev(`(()=>{const c=document.querySelector('.checklist input');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(100);
await ev(`(()=>{document.querySelector('#ck-new').value='Gafas de leer';document.querySelector('#ck-form').requestSubmit()})()`); await sleep(100);
check('checklist toggled and added', await ev(`S.checklist[0].checked && S.checklist.at(-1).text==='Gafas de leer'`));
await click('[data-act=pickexc][data-i="0"]'); await sleep(100);
await ev(`(()=>{const i=document.querySelector('#x-meet');i.value="George's Quay";i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await ev(`(()=>{const i=document.querySelector('#x-url');i.value='javascript:alert(1)';i.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(100);
check('excursion saved, unsafe url rejected', await ev(`S.excursion.name.startsWith('Cork') && S.excursion.meetingPoint==="George's Quay" && S.excursion.url===''`), await ev(`JSON.stringify(S.excursion)`));
await shot('a6-info-big' + sfx);
for (const t of ['today','plan','explore','map','info']) { await ev(`setTab('${t}')`); await sleep(150); const o = await ev(`document.documentElement.scrollWidth > innerWidth`); if (o) check('no overflow with big text on ' + t, false); }
await ev(`setTab('plan')`); await sleep(150); await shot('a7-plan-big' + sfx);
await ev(`setTab('explore')`); await sleep(150); await shot('a8-explore-big' + sfx);
// Export/import round trip keeps the new fields; old v1 codes still import.
const code = await ev(`packPlan()`);
const rt = await ev(`(()=>{const r=unpackPlan(${JSON.stringify(code)});const t=r.days.jue.stops.find(s=>s.id==='trinity');return t.reservedAt+'|'+t.ticketBought+'|'+t.note+'|'+r.checklist.length+'|'+r.excursion.meetingPoint})()`);
check('round trip', rt === "15:00|true|Localizador K-4821|13|George's Quay", rt);
const old = 'DUBLIN1:' + Buffer.from(JSON.stringify({ v: 1, h: 'parnell', d: { jue: { s: '12:00', f: 'hotel', b: 1, l: '', n: 'nota', x: [['trinity', 60, 0], ['castle', 45, 1]] } } })).toString('base64');
const oi = await ev(`(()=>{const r=unpackPlan(${JSON.stringify(old)});return r.hotel+'|'+r.days.jue.stops.map(s=>s.id+':'+s.dur+':'+s.done+':'+s.reservedAt).join(',')+'|'+(r.checklist===undefined)})()`);
check('old v1 code imports', oi === 'parnell|trinity:60:false:,castle:45:true:|true', oi);
check('import clamps', await ev(`unpackPlan('DUBLIN1:'+btoa(JSON.stringify({v:1,d:{jue:{x:[['trinity',-50],['castle',99999],['nope',10],'bad']}}}))).days.jue.stops.map(s=>s.dur).join(',')`) === '5,360');
check('gmaps splits long routes', await ev(`(()=>{S.days.vie.stops=PLACES.filter(p=>p.c!=='comer').slice(0,12).map(p=>normStop({id:p.id,dur:20}));return gmapsRoutes('vie').length})()`) === 2);
check('fees parse', await ev(`[parsePrice(BYID.trinity),parsePrice(BYID.castle),parsePrice(BYID.molly),parsePrice(BYID.leoburdock)].map(String).join(' ')`) === '21,28 8,8 0,0 null');
// Saved v1 state from the first version keeps its stops after reload.
await ev(`localStorage.setItem('dublin-bolsillo-v1', JSON.stringify({hotel:null,day:'sab',days:{sab:{start:'09:00',stops:[{id:'gpo',dur:60},{id:'zzz',dur:5}]}},ref:'hotel',sort:'rel',tab:'explore'}))`);
await ev(`history.replaceState(null,'',location.pathname)`); await send('Page.reload'); await sleep(1300);
const v1 = await ev(`[S.hotel, S.days.sab.stops.map(s=>s.id+':'+s.dur+':'+s.reservedAt).join(','), S.days.jue.stops.length, S.checklist.length, S.tab].join('|')`);
check('v1 state migrates', v1 === 'christchurch|gpo:60:|0|12|today', v1);
await ev(`setTab('explore')`); await click('[data-act=open][data-id=castle]'); await sleep(150);
await click('[data-act=mapfocus]'); await sleep(900);
check('detail -> map keeps hash', await ev(`location.hash`) === '#mapa' && await ev(`S.tab`) === 'map');
console.log('overflow-x', await ev(`document.documentElement.scrollWidth > innerWidth`));
await sleep(800);
console.log('sw controller', await ev(`!!navigator.serviceWorker.controller`));
console.log('LOGS:\n' + logs.join('\n'));
ws.close(); chrome.kill(); (await import('node:child_process')).spawnSync('pkill', ['-f', '[r]emote-debugging-port=93']);
process.exit(0);
