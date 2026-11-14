// Multi-participant end-to-end test against the local dev stack, using
// Chrome's fake camera/microphone. Each browser context is a separate user.
import { chromium, devices } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const APP = process.env.APP_URL || 'http://localhost:3000'
const API = process.env.API_URL || 'http://localhost:5000'
const OUT = path.resolve('shots')
fs.mkdirSync(OUT, { recursive: true })
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'testpass1' })
  })
  return (await res.json()).token
}

async function newMeeting(token, title) {
  const res = await fetch(`${API}/api/meetings/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title })
  })
  return (await res.json()).meeting
}

async function waitFor(fn, timeout = 20000, interval = 400) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    last = await fn()
    if (last) return last
    await sleep(interval)
  }
  return last
}

const tileState = (page) => page.evaluate(() => {
  const tiles = [...document.querySelectorAll('[data-testid="participant-tile"]')]
  return tiles.map((t) => {
    const v = t.querySelector('video')
    return {
      name: t.dataset.name,
      self: t.dataset.self === 'true',
      connection: t.dataset.connection,
      videoFrames: Boolean(v && v.videoWidth > 0),
      visible: Boolean(v && getComputedStyle(v).opacity !== '0')
    }
  })
})
const diag = (page) => page.evaluate(() => ({ camBtn: [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((l) => /camera/i.test(l)), notices: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent), selfVideo: (() => { const t = document.querySelector('[data-self=true] video'); return t ? (t.srcObject ? t.srcObject.getTracks().map((x) => x.kind + ':' + x.readyState + ':' + x.enabled + ':' + x.muted) : 'nosrc') : 'no-video-el' })() }))
const audioCount = (page) => page.evaluate(() => [...document.querySelectorAll('audio')].filter((a) => a.srcObject && a.srcObject.getAudioTracks().length).length)
const uniqueNames = (tiles) => new Set(tiles.map((t) => t.name)).size === tiles.length

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--autoplay-policy=no-user-gesture-required'
    ]
  })

  const tokens = {
    host: await login('hosta@example.test'),
    guest: await login('guestb@example.test'),
    guest2: await login('guestc@example.test')
  }
  const meeting = await newMeeting(tokens.host, 'E2E run')
  const code = meeting.meeting_code
  const dashed = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`.toLowerCase()
  console.log('meeting', code)

  const consoleErrors = {}
  const traces = {}
  async function open(who, url, contextOptions = {}) {
    const context = await browser.newContext({ permissions: ['camera', 'microphone'], ...contextOptions })
    await context.addInitScript((t) => localStorage.setItem('token', t), tokens[who])
    const page = await context.newPage()
    consoleErrors[who] = []
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors[who].push(msg.text()); if (/[(media|notice)]/.test(msg.text())) (traces[who] ||= []).push(msg.text()) })
    page.on('pageerror', (err) => consoleErrors[who].push(`pageerror: ${err.message}`))
    await page.goto(url)
    return { context, page }
  }

  // ---- 1. Lobby presence before joining ----
  const host = await open('host', `${APP}/conference/${meeting.id}`) // host enters by database id
  const guest = await open('guest', `${APP}/conference/${code}`) // guest by plain code
  await host.page.getByRole('button', { name: 'Join now' }).waitFor()
  await guest.page.getByText('No one else is here yet').waitFor({ timeout: 15000 }).catch(() => {})
  check('Lobby shows empty meeting before anyone joins', await guest.page.getByText('No one else is here yet').isVisible())

  await host.page.getByRole('button', { name: 'Join now' }).click()
  const lobbySeesHost = await waitFor(() => guest.page.getByText('Hosta is in this call').isVisible())
  check('Lobby count updates live when someone joins (1.1)', Boolean(lobbySeesHost))
  await guest.page.screenshot({ path: `${OUT}/01-lobby-presence.png` })

  // ---- 2. Two users, both cameras ----
  await guest.page.getByRole('button', { name: 'Join now' }).click()
  const twoWay = await waitFor(async () => {
    const h = await tileState(host.page)
    const g = await tileState(guest.page)
    return h.length === 2 && g.length === 2 && h.every((t) => t.videoFrames) && g.every((t) => t.videoFrames) ? { h, g } : null
  }, 30000)
  check('Two users see each other with both cameras on (1.6)', Boolean(twoWay), twoWay ? '' : JSON.stringify({ host: await diag(host.page), guest: await diag(guest.page) }))
  if (!twoWay) console.log('TRACES', JSON.stringify(traces, null, 1))
  if (!twoWay) { await host.page.screenshot({ path: OUT + '/fail-host.png' }); process.exit(3) }

  // ---- 3. Third user joins by dashed lower-case code, on a phone viewport ----
  const phone = devices['iPhone 13']
  const guest2 = await open('guest2', `${APP}/conference/${dashed}`, {
    viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor, isMobile: true, hasTouch: true,
    userAgent: phone.userAgent
  })
  await guest2.page.getByText(/Hosta and Guestb are in this call|Guestb and Hosta are in this call/).waitFor({ timeout: 15000 }).catch(() => {})
  check('Lobby lists names of people already in the call', await guest2.page.getByText(/are in this call/).isVisible())
  await guest2.page.screenshot({ path: `${OUT}/02-mobile-lobby.png` })
  await guest2.page.getByRole('button', { name: 'Join now' }).click()

  const three = await waitFor(async () => {
    const all = await Promise.all([host, guest, guest2].map((p) => tileState(p.page)))
    return all.every((tiles) => tiles.length === 3 && tiles.every((t) => t.videoFrames) && uniqueNames(tiles)) ? all : null
  }, 35000)
  check('Three users: everyone receives everyone’s video (mesh, different join links)', Boolean(three),
    three ? '' : JSON.stringify(await Promise.all([host, guest, guest2].map((p) => tileState(p.page)))))
  const audios = await Promise.all([host, guest, guest2].map((p) => audioCount(p.page)))
  check('Each participant plays exactly one audio stream per remote participant', audios.every((n) => n === 2), `audio elements: ${audios}`)

  const overflow = await guest2.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, sh: document.documentElement.scrollHeight, h: window.innerHeight }))
  check('Mobile in-call layout has no horizontal or vertical page overflow (1.2)', overflow.sw <= overflow.w && overflow.sh <= overflow.h + 1, JSON.stringify(overflow))
  await guest2.page.screenshot({ path: `${OUT}/03-mobile-call.png` })
  await host.page.screenshot({ path: `${OUT}/04-desktop-gallery.png` })

  // ---- 4. Camera off reflects everywhere; back on restores video ----
  await guest.page.getByRole('button', { name: /Turn off camera/ }).click()
  const camOffSeen = await waitFor(async () => {
    const t = (await tileState(host.page)).find((x) => x.name === 'Guestb')
    return t && !t.visible
  })
  check('Camera off shows avatar to others', Boolean(camOffSeen))
  await guest.page.getByRole('button', { name: /Turn on camera/ }).click()
  const camBack = await waitFor(async () => {
    const t = (await tileState(host.page)).find((x) => x.name === 'Guestb')
    return t && t.videoFrames && t.visible
  }, 20000)
  check('Camera back on: video resumes for others (replaceTrack/renegotiation)', Boolean(camBack))

  // ---- 5. Screen share with presenter camera still visible ----
  let shareOk = false
  try {
    await host.page.getByRole('button', { name: 'Present now' }).click()
    shareOk = await waitFor(async () => {
      const s = await guest.page.evaluate(() => {
        const stage = [...document.querySelectorAll('video')].find((v) => v.classList.contains('object-contain'))
        const hostTile = [...document.querySelectorAll('[data-testid="participant-tile"]')].find((t) => t.dataset.name === 'Hosta')
        const hv = hostTile?.querySelector('video')
        return { screen: Boolean(stage && stage.videoWidth > 0), presenterCam: Boolean(hv && hv.videoWidth > 0), label: document.body.innerText.includes('Hosta is presenting') }
      })
      return s.screen && s.presenterCam && s.label ? s : null
    }, 25000)
  } catch (err) {
    console.log('screen share error', err.message)
  }
  check('Screen share visible to others with presenter camera in filmstrip (1.4)', Boolean(shareOk))
  const mobileShare = await waitFor(() => guest2.page.evaluate(() => {
    const stage = [...document.querySelectorAll('video')].find((v) => v.classList.contains('object-contain'))
    return Boolean(stage && stage.videoWidth > 0)
  }), 15000)
  check('Mobile-emulated viewer renders the shared screen (not black) (1.3, emulated only)', Boolean(mobileShare))
  await guest.page.screenshot({ path: `${OUT}/05-presentation-desktop.png` })
  await guest2.page.screenshot({ path: `${OUT}/06-presentation-mobile.png` })

  // Gallery toggle while presenting
  await guest.page.getByRole('button', { name: /Gallery/ }).first().click()
  const galleryWhilePresenting = await waitFor(async () => {
    const noStage = await guest.page.evaluate(() => ![...document.querySelectorAll('video')].some((v) => v.classList.contains('object-contain')))
    return noStage && (await tileState(guest.page)).length === 3
  })
  check('Viewer can switch to gallery while someone presents', Boolean(galleryWhilePresenting))
  await guest.page.getByRole('button', { name: /Presentation/ }).first().click()

  await host.page.getByRole('button', { name: 'Stop presenting' }).first().click()
  const shareStopped = await waitFor(() => guest.page.evaluate(() => !document.body.innerText.includes('Hosta is presenting')))
  check('Stopping the share removes the presentation for everyone', Boolean(shareStopped))

  // ---- 6. Chat ----
  await host.page.getByRole('button', { name: 'Chat' }).first().click()
  await host.page.getByLabel('Message', { exact: true }).fill('Hello from the host')
  await host.page.getByLabel('Send message').click()
  const chatSeen = await waitFor(async () => {
    await guest.page.getByRole('button', { name: 'Chat' }).first().click().catch(() => {})
    return guest.page.getByText('Hello from the host').isVisible()
  }, 10000)
  check('Chat message delivered to other participants', Boolean(chatSeen))

  // ---- 7. Refresh mid-call does not duplicate ----
  await guest2.page.reload()
  await guest2.page.getByRole('button', { name: 'Join now' }).click({ timeout: 20000 })
  const afterRefresh = await waitFor(async () => {
    const tiles = await tileState(host.page)
    return tiles.length === 3 && uniqueNames(tiles) && tiles.every((t) => t.videoFrames) ? tiles : null
  }, 30000)
  check('Refresh + rejoin: no duplicate participant, video restored (1.7)', Boolean(afterRefresh), JSON.stringify(await tileState(host.page)))

  // ---- 8. Abrupt disappearance (renderer crash: no leave event, no pagehide) ----
  {
    const cdp = await guest2.context.newCDPSession(guest2.page)
    const crashedAt = Date.now()
    cdp.send('Page.crash').catch(() => {}) // never resolves: the page is gone
    await sleep(500)
    const goneForOthers = await waitFor(async () => (await tileState(host.page)).length === 2, 45000, 500)
    check('Crashed/vanished participant is removed for others by heartbeat', Boolean(goneForOthers), `after ${Math.round((Date.now() - crashedAt) / 1000)} s`)
    await guest2.context.close()
  }
  // Rejoin from a brand-new page after the crash: exactly one tile again.
  const guest2b = await open('guest2', `${APP}/conference/${code}`, {
    viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: phone.userAgent
  })
  await guest2b.page.getByRole('button', { name: 'Join now' }).click({ timeout: 20000 })
  const recovered = await waitFor(async () => {
    const tiles = await tileState(host.page)
    return tiles.length === 3 && uniqueNames(tiles) && tiles.every((t) => t.videoFrames)
  }, 30000, 500)
  check('Rejoining after a crash gives one tile with working video', Boolean(recovered), JSON.stringify(await tileState(host.page)))

  // Offline banner (navigator.onLine); WebSocket teardown is covered by the backend-restart test.
  await guest2b.context.setOffline(true)
  const offlineBanner = await waitFor(() => guest2b.page.getByText('You are offline.', { exact: false }).isVisible(), 8000)
  check('Participant sees an offline banner when the browser goes offline', Boolean(offlineBanner))
  await guest2b.context.setOffline(false)
  await sleep(1500)

  // ---- 9. Leave removes participant immediately ----
  await guest2b.page.getByRole('button', { name: 'Leave call' }).click()
  const leftFast = await waitFor(async () => (await tileState(host.page)).length === 2, 5000, 250)
  check('Leave removes the participant for others within 5 s (1.7)', Boolean(leftFast))
  check('Leaver sees the ended screen', await guest2b.page.getByText('You left the meeting.').isVisible())

  // ---- 10. Virtual background (blur) ----
  await host.page.getByRole('button', { name: 'More options' }).click()
  await host.page.getByRole('button', { name: 'Effects' }).click()
  await host.page.getByRole('button', { name: 'Blur', exact: true }).click()
  const effectDone = await waitFor(async () => {
    const err = await host.page.getByRole('alert').first().textContent().catch(() => null)
    const loading = await host.page.getByText('Loading the background model').isVisible().catch(() => false)
    return !loading ? { err } : null
  }, 45000, 500)
  const effectError = effectDone?.err
  const guestStillSeesHost = await waitFor(async () => {
    const t = (await tileState(guest.page)).find((x) => x.name === 'Hosta')
    return t?.videoFrames
  }, 10000)
  check('Background blur enabled without breaking outgoing video (1.8)', !effectError && Boolean(guestStillSeesHost), effectError || '')
  await sleep(1500)
  await host.page.screenshot({ path: `${OUT}/07-blur-host.png` })
  await guest.page.screenshot({ path: `${OUT}/08-blur-seen-by-guest.png` })
  await host.page.getByRole('button', { name: 'Close panel' }).click()

  // ---- 11. Host moderation ----
  await host.page.getByRole('button', { name: 'People' }).first().click()
  await host.page.getByRole('button', { name: 'Mute Guestb' }).first().click()
  const muted = await waitFor(() => guest.page.getByRole('button', { name: /Turn on microphone/ }).isVisible(), 8000)
  check('Host mute turns off the participant’s microphone', Boolean(muted))

  await host.page.getByRole('button', { name: 'Remove Guestb' }).first().click()
  await host.page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  const removed = await waitFor(() => guest.page.getByText(/removed you from the meeting/).isVisible(), 8000)
  check('Host can remove a participant', Boolean(removed))
  const hostAlone = await waitFor(async () => (await tileState(host.page)).length === 1, 8000)
  check('Removed participant disappears from host view', Boolean(hostAlone))

  // ---- 12. Invite without email configured reports failure honestly ----
  const inviteRes = await host.page.evaluate(async ({ api, id }) => {
    const r = await fetch(`${api}/api/meetings/${id}/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ emails: ['someone@example.test'] })
    })
    return { status: r.status, body: await r.json() }
  }, { api: API, id: meeting.id })
  check('Invite with no email provider returns failure, never fake success (1.5)', inviteRes.status === 502 && inviteRes.body.delivered === 0, JSON.stringify(inviteRes.body).slice(0, 160))

  for (const [who, errs] of Object.entries(consoleErrors)) {
    const relevant = errs.filter((e) => !/favicon|DevTools|Download the React/.test(e))
    check(`No uncaught page errors for ${who}`, !relevant.some((e) => e.startsWith('pageerror')), relevant.slice(0, 3).join(' | '))
  }

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  fs.writeFileSync('results.json', JSON.stringify(results, null, 2))
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  fs.writeFileSync('results.json', JSON.stringify(results, null, 2))
  process.exit(2)
})
