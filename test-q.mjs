import { spawn } from 'node:child_process';
const OUT = new URL('./test-out/', import.meta.url).pathname;
const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9334', '--user-data-dir=' + OUT + 'profile-q', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 40; i++) { try { const t = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8791/' }); await sleep(1200);
await ev(`document.querySelector('[data-act=open][data-id=guinness]').click()`); await sleep(200);
console.log(await ev(`(()=>{const c=document.querySelector('.facts div');const s=getComputedStyle(c);return [s.display,s.height,s.overflow,s.position,s.fontSize,s.contain, getComputedStyle(document.querySelector('.facts')).height, getComputedStyle(document.querySelector('.facts')).overflow].join(' ')})()`)); console.log(await ev(`(()=>{const f=document.querySelector('.facts');const cs=getComputedStyle(f);return f.outerHTML.slice(0,400)+' | h='+f.getBoundingClientRect().height+' cols='+cs.gridTemplateColumns})()`));
ws.close(); chrome.kill(); process.exit(0);
