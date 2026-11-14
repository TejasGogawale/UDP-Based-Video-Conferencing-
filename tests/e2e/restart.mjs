// Two users in a call; the backend is restarted externally while this runs.
// Passes if both clients notice, reconnect, rejoin and get video again.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const APP = process.env.APP_URL || 'http://localhost:3000', API = process.env.API_URL || 'http://localhost:5000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = async (e) => (await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: 'testpass1' }) })).json()).token
const tiles = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid=participant-tile]')].map((t) => ({ name: t.dataset.name, frames: (t.querySelector('video')?.videoWidth || 0) > 0 })))
const ok = (t) => t.length === 2 && t.every((x) => x.frames)

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const th = await login('hosta@example.test'), tg = await login('guestb@example.test')
const m = (await (await fetch(`${API}/api/meetings/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${th}` }, body: JSON.stringify({ title: 'restart' }) })).json()).meeting
const open = async (t) => { const c = await browser.newContext({ permissions: ['camera', 'microphone'] }); await c.addInitScript((x) => localStorage.setItem('token', x), t); const p = await c.newPage(); await p.goto(`${APP}/conference/${m.meeting_code}`); await p.getByRole('button', { name: 'Join now' }).click(); return p }
const host = await open(th)
const guest = await open(tg)
for (let i = 0; i < 40 && !(ok(await tiles(host)) && ok(await tiles(guest))); i++) await sleep(500)
console.log('BEFORE', JSON.stringify(await tiles(host)), JSON.stringify(await tiles(guest)))
fs.writeFileSync('restart.ready', '1')
console.log('READY_FOR_RESTART')

let sawBanner = false, recoveredAt = null
const start = Date.now()
// Wait until the outage is observed, then until both are back with video.
while (Date.now() - start < 150000) {
  const banner = await host.getByText('Connection lost. Reconnecting').isVisible().catch(() => false)
  if (banner) sawBanner = true
  let serverCount = -1
  if (sawBanner && !banner) { try { serverCount = (await (await fetch(API + '/api/meetings/' + m.meeting_code + '/presence', { headers: { Authorization: 'Bearer ' + th } })).json()).count } catch {} }
  if (sawBanner && !banner && serverCount === 2 && ok(await tiles(host)) && ok(await tiles(guest))) { recoveredAt = Date.now(); break }
  await sleep(500)
}
console.log('SAW_RECONNECTING_BANNER', sawBanner)
console.log('RECOVERED', Boolean(recoveredAt), recoveredAt ? `${Math.round((recoveredAt - start) / 1000)}s after ready` : '')
console.log('AFTER', JSON.stringify(await tiles(host)), JSON.stringify(await tiles(guest)))
const relogin = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'guestb@example.test', password: 'testpass1' }) })
console.log('LOGIN_AFTER_RESTART', relogin.status)
await browser.close()
