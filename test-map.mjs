// Screenshots of the map at several zoom levels.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = new URL('./test-out/', import.meta.url).pathname;
const dark = process.argv.includes('--dark');
const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9335', '--user-data-dir=' + OUT + 'profile-m', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), logs = [];
for (let i = 0; i < 40; i++) { try { const t = (await (await fetch('http://127.0.0.1:9335/json')).json()).find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push(JSON.stringify(d.params.exceptionDetails.exception?.description)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT + n + '.png', Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
await send('Page.navigate', { url: 'http://127.0.0.1:8791/#mapa' }); await sleep(1500);
const sfx = dark ? '-dark' : '';
await shot('m1-overview' + sfx);
for (const [n, lat, lon, w] of [['m2-templebar', 53.3452, -6.2640, 900], ['m3-north', 53.3495, -6.2620, 900], ['m4-close', 53.3440, -6.2650, 420]]) {
  await ev(`centerOn(${lat}, ${lon}, ${w})`); await sleep(400); await shot(n + sfx);
}
const t0 = Date.now(); for (let i = 0; i < 30; i++) await ev(`view.x += 5; applyView()`); console.log('30 pans ms', Date.now() - t0);
console.log('labels', await ev(`document.querySelectorAll('#lblg text').length`), 'logs', logs.join(' | '));
ws.close(); chrome.kill(); spawnSync('pkill', ['-f', '[r]emote-debugging-port=9335']); process.exit(0);
