# VIT Connect: Implementation and Changelog

Date: 2026-11-15. Companion to [`TECHNICAL_AUDIT.md`](TECHNICAL_AUDIT.md), which was written before any change and holds the original root-cause analysis.

Testing claims in this document are limited to what was actually run (section 17). Things that could not be tested from the development machine are listed as such.

---

## 1. Architecture before and after

**Before**

```
Browser ──REST──▶ Flask (Werkzeug dev server, Render)
   │                 └─ SQLite file by default (ephemeral disk on Render)
   └──Socket.IO──▶ in-memory dict keyed by the raw URL string
        offer/answer/ice relayed to any socket id
Browser ◀──WebRTC──▶ Browser   2 peer connections per pair (camera, screen),
                               one-shot negotiation, STUN only
Email: smtplib → Gmail, "success" returned when not configured
Backgrounds: CSS class on <video>   Captions: local only
```

**After**

```
Browser ──REST──▶ Flask
   │                 ├─ PostgreSQL via DATABASE_URL (SQLite only for local dev; warned at startup and in /api/health)
   │                 ├─ /api/health, /api/ice-servers, /presence, /invite
   │                 └─ mail_service: Brevo / Resend (HTTPS) or SMTP, honest per-recipient results
   └──Socket.IO──▶ services/presence.py: ONE registry keyed by meeting DB id
        ├─ roster_update (full list) after every change, lobby presence_update
        ├─ signal relayed only between members of the same meeting
        └─ host actions verified server-side
Browser ◀──WebRTC──▶ Browser   1 peer connection per pair (src/lib/rtc/PeerMesh.js):
                               mic + camera + screen + screen audio, perfect negotiation,
                               deterministic first offer, stream-id tagging, bitrate caps,
                               ICE restart, stats → quality indicator
Frontend state: src/hooks/useConference.js is the single owner of socket, mesh, devices, roster
Backgrounds: MediaPipe segmentation → canvas → the track that is SENT
Captions: room-level demand; each speaker transcribes own mic; relayed with names
```

Mesh vs SFU decision: kept the mesh. The meetings this project targets are small, and an SFU needs a media server with public UDP ports, which Render web services do not offer. The mesh now caps per-peer bitrate as the room grows (`PeerMesh.tuneSenders`), and the UI states the practical ceiling (about 6 people with cameras on). Going beyond that needs an SFU (LiveKit, mediasoup or Janus) on a host with UDP access. That is a separate infrastructure project and is not included here.

---

## 2–4. Bugs, root causes, solutions

Each entry covers: what was wrong → why → what changed → how it works now → how it was tested. Test IDs refer to section 17.

### 1.1 Pre-join screen said nobody had joined
- **Why:** the count came from a participant array that was only filled after joining, and no API could ask who was in a meeting.
- **Change:** one presence registry (`services/presence.py`). The lobby opens a socket and sends `watch_meeting`; the server pushes `presence_update` on every change. `GET /api/meetings/<id>/presence` reads the same registry.
- **Now:** the lobby shows "Asha and 2 more are in this call", live. Watching never counts as being a participant.
- **Tested:** B5 and E1–E2, E4.

### 1.2 Mobile layout overflow
- **Why:** fixed-width drawers (`w-80`) inside full-width containers, an 8-button dock row, `100vh`/`min-h-screen`, fixed overlay offsets that ignored safe areas, a grid with forced row counts, and `user-scalable=no`.
- **Change:**
  - `.h-app` (dvh with vh fallback) on every full-screen stage.
  - A five-button phone dock (mic, camera, chat, more, leave), with everything else in a bottom sheet.
  - `DrawerShell`: full screen on phones, side panel from `sm`.
  - The gallery computes its column count from the measured container size (`bestGrid`), so portrait and landscape both fit.
  - Captions and reactions are positioned inside the stage, never over the controls.
  - Safe-area insets on the top bar, dock, sheets and drawers; zoom re-enabled; inputs at 16 px on phones (prevents iOS focus zoom).
- **Tested:** E7 (no page overflow at 390×664, iPhone 13 emulation) and screenshots. **Not tested on physical phones.**

### 1.3 Remote screen share black on mobile
- **Why (confirmed):**
  - One long-lived `MediaStream` per peer was mutated in place, and the same object was put back into React state, so the element never re-attached. WebKit does not reliably start rendering tracks added later.
  - Unmuted autoplay rejections were swallowed.
  - The screen relied on a separate peer connection and on message ordering.
- **Why (inferred):** no TURN server, so some mobile networks cannot connect at all.
- **Change:**
  - `PeerMesh.emitRemote` builds a new `MediaStream` whenever the track set changes.
  - Video elements are always muted (autoplay is allowed on every browser), and audio plays through `RemoteAudio`, with a "Tap to hear the other participants" banner if blocked.
  - `MediaVideo` shows an explicit "Waiting for…" or "Connecting to the presentation…" state until real frames arrive.
  - Screen tracks travel on the same connection, tagged with a stream id published in the roster.
  - TURN is configurable through env; tiles say when a connection failed and that a TURN relay may be needed.
  - Screen capture is capped at 1080p/15 fps, within phone decoder limits.
- **Tested:** E11 in mobile emulation (Chromium engine). **iOS Safari and Android Chrome on devices not tested.**

### 1.4 Presenter camera disappeared during screen share
- **Why:** upstream failures (cameras never connected, RC-A/RC-C) and a filmstrip that collapsed on phones; there was also no way to switch layouts.
- **Change:**
  - Presentation layout: the screen on stage plus a camera filmstrip, vertical on wide screens and horizontal on portrait.
  - A presentation/gallery switch in the top bar; one presenter at a time (a new share politely stops the previous one).
  - "X is presenting" in the top bar, on the stage, and in the People panel.
- **Tested:** E10, E12, E13.

### 1.5 Invitation emails not delivered
- **Why:**
  - Render free web services block outbound SMTP ports 25/465/587. This is documented by Render; that the deployed service is on a free instance is inferred.
  - The code reported success when credentials were missing, and the UI printed "dispatched" without reading the result.
  - There was no in-meeting invite.
- **Change:**
  - `services/mail_service.py` gained HTTPS providers (Brevo, Resend) alongside SMTP, auto-selected from env.
  - Results come back per recipient; no provider means a failure with an explanatory error. SMTP failures are translated (an auth failure explains Gmail App Passwords; a timeout explains the Render port block).
  - New `POST /api/meetings/<id>/invite`: 200 all sent, 207 partial, 502 none, 400 invalid. Duplicates are skipped via the `invitations` table unless `resend` is set.
  - The email contains the meeting name, link, code, host and joining steps; all user text is HTML-escaped.
  - UI: `InvitePanel` in People and Meeting details shows each address's real outcome, and `ScheduleModal` shows per-recipient results.
- **Tested:** B16–B19 and E25. **Real delivery is not tested**: it needs a provider key on Render (section 15).

### 1.6 Two people could not keep cameras on
- **Why (confirmed):**
  - Different entry points used different room keys (UUID vs code vs a truncated dashed code), so people in the "same" meeting were in different rooms.
  - Peer connections were negotiated once, so a track missing at that moment was missing forever.
  - Found during testing: when both sides offered at the same time, the side that rolled back its offer stopped gathering ICE candidates in Chrome, and the pair stayed at `iceConnectionState: "new"`. Whether it happened depended on socket-id ordering, so it looked random.
- **Change:**
  - The server resolves any identifier to the meeting's database id before joining a room.
  - `PeerMesh` uses perfect negotiation for every later change (camera on/off, device switch, screen share, effects).
  - The first offer of each pair is made by exactly one side; the other attaches its tracks when applying that offer, so its tracks ride in the answer, with a 5 s fallback if no offer arrives.
  - A negotiated data channel guarantees a connection even when nobody sends media.
- **Tested:** E3, E5, E8, E9. A 5-of-5 two-peer probe connected after the change; failures had been intermittent before it.

### 1.7 Ghost participants and duplicates on rejoin
- **Why:**
  - Identity was the socket id, so every reconnect created a new identity.
  - The 45 s default heartbeat left ghosts after a browser closed.
  - Clients built lists from deltas and never reconciled.
- **Change:**
  - A per-page `clientId`: a reconnecting socket from the same page replaces its stale entry, and the old socket is disconnected.
  - Heartbeat set to 10 s ping / 15 s timeout (25 s worst case); `pagehide` sends an explicit leave.
  - The server broadcasts the full roster after every change, and clients replace their list with it.
  - Peer connections are closed and tiles removed by reconciling against the roster.
  - Attendance and leave times are persisted in `participants`.
- **Tested:** B7–B9 and E15–E17, E19.

### 1.8 Virtual backgrounds did nothing
- **Why:** `backdrop-filter` on a `<video>` blurs what is behind the element, not the video; image backgrounds had no implementation; nothing ever reached remote users.
- **Change:** `src/lib/media/backgroundProcessor.js`.
  - The MediaPipe Image Segmenter (selfie model, GPU with CPU fallback, lazily loaded) produces a person mask.
  - The canvas composites the background (downscale blur, or a cover-fit image) with the masked person, plus optional colour filters.
  - The canvas `captureStream` track replaces the camera track on every connection through `replaceTrack`, so no renegotiation is needed.
  - A Worker-driven timer keeps processing in background tabs.
  - Options: off, slight blur, blur, five presets, custom upload (object URL, never uploaded), and colour filters.
  - Failures fall back to the raw camera with a message; per-frame errors never stop outgoing video.
- **Tested:** E21 (blur on, the remote side still receives video, screenshots show the remote view blurred) and an image background screenshot. With the fake camera there is no person in frame, so segmentation quality on real people was **not** verified.

### 1.9 Live captions
- **Why:** only the person who switched captions on ran recognition, and only on their own mic, so they never saw anyone else. Every interim result was appended as a new line.
- **Change:**
  - `captions_toggle` maintains room-level demand. While anyone wants captions, every capable client transcribes its own microphone and relays it with its name.
  - Display is per viewer; an open utterance per speaker is replaced in place; lines expire after 7 s.
  - The recognition service only reports results from `resultIndex` onwards (no repeats), auto-restarts after silence with backoff, and turns errors into readable messages.
  - Firefox and other unsupported browsers say so.
- **Tested:** B13 and a browser probe (demand propagated to the other participant; an interim then a final result produced one line with the speaker's name). Real speech recognition was **not** tested: headless Chrome has no speech service.

### 1.10 Users forgotten after restart
- **Why (inferred, consistent with the code):** with no Postgres driver and SQLite-only migrations, production could only run on a SQLite file on Render's ephemeral disk.
- **Change:**
  - `psycopg2-binary` added; `postgres://` normalised to `postgresql://`.
  - Portable migrations (SQLAlchemy inspector, standard types, `CREATE INDEX IF NOT EXISTS`); pooled connections with pre-ping and recycle.
  - The startup log and `/api/health` state the dialect and whether storage is durable.
  - Emails are lower-cased on registration, login is case-insensitive, and a race on duplicate registration returns 409.
  - Indexes on participants, messages, meetings and invitations.
  - Passwords were already PBKDF2-hashed; that is unchanged and verified by test.
- **Tested:** B1–B2, B20, and a backend restart with live users (E-R). Schema DDL compiled against the PostgreSQL dialect. **Not run against a real PostgreSQL server** (Docker was not available).

### Other defects found and fixed
- Host controls were broadcast-only and unverified: mute, mute-all and end-for-all did nothing, and anyone could send them. They are now checked server-side and implemented on clients, with a new **remove participant** action behind a confirmation in the People panel.
- Host lock toggles wrote the inverse value (`value: !isAllowed`).
- Your own whiteboard strokes vanished on the next remote stroke.
- Each remote voice was played twice (an unmuted `<video>` plus an `<audio>`).
- Signaling could be relayed to sockets in other meetings.
- The "Simulated Feed" canvas replaced a missing camera in production. It is now dev-only and labelled "Development test pattern".
- The lobby and settings mic meters were `Math.random()`. They now use real Web Audio levels, and active speaker detection drives the tile highlight.
- Device pickers were not wired. Microphone, camera and speaker (where `setSinkId` exists) now switch live; unplugged devices are recovered or reported.
- "Recording" only showed a badge. It now records this tab plus everyone's audio locally to a `.webm` file (desktop Chromium), and others see a REC indicator.
- Breakout rooms only shuffled names locally. The feature was removed rather than left fake; implementing it is a separate project.
- StrictMode double-mount could end the live camera: two concurrent `getUserMedia` calls share a capture session in Chrome, and stopping the discarded one ended the live track. Overlapping initialisations now share one request, and a camera that ends unexpectedly is re-acquired once before video is turned off. Found by E3 failing 2 of 8 times; 10 of 10 after the fix.
- `app.py` ran with `debug=True` by default. The debugger is now opt-in (`FLASK_DEBUG=1`) and never on in production.
- `index.html` linked `./src/index.css`, a 404 in production builds. Removed; CSS is imported by `main.jsx`.

---

## 5. Files

**Created**

| File | Purpose |
|---|---|
| `services/presence.py` | Single source of truth for live participants |
| `models/invitation.py` | Per-recipient invitation state and duplicate suppression |
| `src/hooks/useConference.js` | Owns socket, mesh, devices, roster, chat, captions, activities |
| `src/lib/rtc/PeerMesh.js` | WebRTC mesh: negotiation, tracks, ICE recovery, stats |
| `src/lib/media/localMedia.js` | Device acquisition with readable errors, device listing, screen capture |
| `src/lib/media/audioLevels.js` | Real audio levels and active speaker |
| `src/lib/media/backgroundProcessor.js` | Segmentation-based backgrounds |
| `src/lib/media/recorder.js` | Local recording |
| `src/lib/meetingCode.js` | One format/parse for codes and links |
| `src/components/meet/media/MediaVideo.jsx` | Muted video with "no frames yet" fallback |
| `src/components/meet/media/RemoteAudio.jsx` | One audio element per remote stream, speaker selection |
| `src/components/meet/drawers/DrawerShell.jsx` | Responsive panel frame |
| `src/components/meet/drawers/InvitePanel.jsx` | Email invitations with real results |
| `tests/test_backend.py` | 20 backend integration tests |
| `tests/e2e/run.mjs`, `tests/e2e/restart.mjs`, `tests/e2e/README.md` | Browser end-to-end tests |
| `TECHNICAL_AUDIT.md`, `IMPLEMENTATION_AND_CHANGELOG.md` | Documentation |

**Modified:** `app.py`, `config.py`, `database.py`, `events/socket_events.py` (rewritten), `routes/meetings.py`, `routes/auth.py`, `services/mail_service.py` (rewritten), `requirements.txt`, `.env.example`, `index.html`, `package.json` / `package-lock.json`, `README.md`, `src/config/api.js`, `src/index.css`, `src/pages/ConferenceRoom.jsx` (rewritten), `src/pages/Dashboard.jsx`, `src/pages/CreateMeeting.jsx`, `src/pages/JoinMeeting.jsx`, and in `src/components/meet/`: `ControlDock`, `DeviceSettingsModal`, `GreenRoomLobby`, `LiveCaptions`, `MeetingEndedScreen`, `ParticipantTile`, `ReactionsOverlay`, `ScheduleModal`, `VideoGrid`, `activities/PollsModal`, `activities/QAModal`, all six drawers, `utils/speechRecognition.js`, `utils/mediaFallback.js`.

**Deleted:** `src/components/meet/activities/BreakoutRoomsModal.jsx` (non-functional, see above).

**Untouched:** the UDP demo server (`networking/`, `run_servers.py`), auth context, home/login/register pages, the whiteboard, and patent documents.

---

## 6–8. Backend, frontend, WebRTC and signaling

**Backend**
- `socket_events.py`: rooms are keyed by the meeting's database id.
- Every handler reads the caller's room from the registry, never from client input.
- Inputs are length-limited.
- Poll and Q&A votes are keyed by account, so they survive reconnects.
- Chat is persisted and replayed to people who join later (last 100 messages).

**Frontend**
- `ConferenceRoom` is now a view over `useConference`.
- Tiles, people and presentation are derived from the server roster plus received media; nothing duplicates participant state.

**Signaling protocol**

| Old | New |
|---|---|
| `offer`, `answer`, `ice_candidate` with `streamType` | `signal {to, data: {description} or {candidate}}` |
| `current_users`, `user_joined`, `user_left` | `joined` + `roster_update` |
| `toggle_media` | `media_state` |
| (none) | `watch_meeting` / `presence_update`, `captions_toggle` / `captions_demand`, `recording_status`, `session_replaced`, `meeting_ended` |

Old and new clients are not compatible, so deploy the frontend and backend together.

**WebRTC details**
- Perfect negotiation, with politeness by socket-id order.
- A deterministic first offer.
- Stream ids published in the roster (`cameraStreamId`, `screenStreamId`) separate camera from screen.
- `replaceTrack` for same-kind swaps.
- `removeTrack` when the screen stops.
- Encodings capped by peer count: 1.5 Mbps, 700 kbps, 400 kbps or 250 kbps, with downscaling at 4+ peers.
- ICE restart on `failed`, or after 5 s of `disconnected`.
- Stats every 4 s (RTT and loss) drive the good/unstable/poor indicator.
- On a signaling reconnect the mesh is rebuilt with the new socket id; media keeps flowing peer-to-peer while signaling is down.

---

## 9–12. Database, email, mobile, backgrounds and captions

Covered in the bug entries above (1.10, 1.5, 1.2, 1.8, 1.9).

---

## 13. API changes and new endpoints

| Endpoint | Change |
|---|---|
| `GET /api/health` | **New.** Database dialect and durability, email provider, TURN, warnings |
| `GET /api/ice-servers` | **New** (auth). STUN/TURN for browsers |
| `GET /api/meetings/<id>/presence` | **New.** Live participants |
| `POST /api/meetings/<id>/invite` | **New.** Email invitations with per-recipient results |
| `PUT /api/auth/profile` | **New.** Update display name |
| `GET /api/meetings/<id>` | Now accessible to any signed-in user who has the code or link (link-based access, as in Meet). Previously 403 unless already a participant, which broke the lobby for invitees |
| `POST /api/meetings/schedule`, `/send-reminder` | `email_notifications` now `{provider, attempted, delivered, failed, results[]}`; send-reminder returns 502 when nothing was sent |
| Meeting payloads | Add `active_participants` |

---

## 14. Dependencies

| Package | Change | Why |
|---|---|---|
| `@mediapipe/tasks-vision@0.10.14` | Added | Person segmentation. Loaded lazily as its own chunk; WASM and model are fetched from jsDelivr and Google Storage at runtime |
| `psycopg2-binary>=2.9.11` | Added | PostgreSQL driver (version with Python 3.14 wheels) |
| `simple-websocket` | Pinned explicitly | WebSocket transport for Flask-SocketIO in threading mode (it was already present in production as a transitive dependency) |

Nothing was removed or upgraded.

---

## 15. Environment variables

See `.env.example` for the annotated template.

**Backend (Render)**
- **Required:** `FLASK_ENV=production`, `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL` (PostgreSQL), `FRONTEND_URL`.
- **Email:**
  - `BREVO_API_KEY` or `RESEND_API_KEY`, plus `EMAIL_FROM` (a verified sender) and optionally `EMAIL_FROM_NAME`.
  - `EMAIL_PROVIDER` (`auto` by default).
  - SMTP (`SMTP_SERVER`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) only works on paid Render instances.
- **WebRTC:** `TURN_URLS` (comma-separated, include a `turns:` TCP URL), `TURN_USERNAME`, `TURN_CREDENTIAL`; optional `STUN_URLS`.
- **Optional:** `CORS_ORIGINS` (defaults to `*`; auth is by bearer token), `EMAIL_TIMEOUT_SECONDS`, `FLASK_DEBUG` (local only).

**Frontend (Vercel)**
- `VITE_API_URL` and `VITE_SOCKET_URL` (the backend URL); they are baked in at build time, so redeploy after changing them.
- The live frontend bundle was checked and already points at `https://udp-based-video-conferencing.onrender.com`.

---

## 16. Render deployment

No production settings were changed from here; they can only be changed in the Render and Vercel dashboards. Steps for the owner:

1. **Create a database.** Render → New → PostgreSQL (or Neon/Supabase). Copy the *Internal Database URL* into the web service's `DATABASE_URL`. Accounts created before this point lived on Render's temporary disk and cannot be recovered.
2. **Email.**
   - Create a free Brevo account and verify a single sender (it can be the Gmail address already used).
   - Create an API key, then set `BREVO_API_KEY` and `EMAIL_FROM` to that verified address.
   - Alternatively, use Resend with a verified domain.
3. **TURN.** Set `TURN_URLS`, `TURN_USERNAME` and `TURN_CREDENTIAL` from a TURN provider (for example Metered, Twilio or Cloudflare Calls), or a self-hosted coturn.
4. **Start command.** `python app.py`, which serves Socket.IO over WebSocket using Werkzeug in threading mode, as production does today. Keep **one instance**, because live presence is in memory.
5. **Deploy both apps together** (the signaling protocol changed).
6. **Verify.** Open `https://udp-based-video-conferencing.onrender.com/api/health`. Expect `database.dialect: "postgresql"`, `durable: true`, `email.configured: true`, `turn_configured: true`, and an empty `warnings` list.
7. **Free-tier note.** Free instances sleep after 15 minutes idle. The first request then takes around a minute and drops any calls in progress.

Read-only production probe results (before changes):
- The polling handshake works.
- The WebSocket upgrade returns 101.
- CORS preflight from the Vercel origin succeeds.
- The server is `Werkzeug/3.1.8 Python/3.14.3`.

---

## 17. Testing performed

**Backend integration** (`python -m unittest discover -s tests`): **20/20 pass**.

| ID | Test |
|---|---|
| B1–B2 | Registration persists across a second app instance on the same database; password hashed; case-insensitive duplicate email rejected |
| B3 | Socket rejects missing or invalid token |
| B4 | Database id, plain code and dashed lower-case code reach the same room |
| B5 | Lobby presence before joining; REST presence matches; watchers are not participants |
| B6 | Unknown meeting reported |
| B7 | Disconnect without leave removes the participant for everyone |
| B8 | Reconnect from the same page does not duplicate; stale socket dropped |
| B9 | Attendance recorded in history |
| B10 | Signal relayed only within a meeting |
| B11 | Media, hand and screen state in the roster; a second presenter takes over |
| B12 | Chat broadcast, persisted, replayed |
| B13 | Caption demand follows viewers; captions relayed with speaker name |
| B14–B15 | Only the host can mute or remove; host can end for all |
| B16–B19 | Unconfigured email returns 502; duplicates skipped; partial failure returns 207; email content escaped and contains the required details |
| B20 | Health reports database and email state |

**Browser end-to-end** (`tests/e2e/run.mjs`): installed Chrome 157.0.8103.51, headless, Chromium fake camera and mic, 3 separate users (one in iPhone 13 emulation), against the local stack. **28/28 pass** on the final code.

| ID | Check |
|---|---|
| E1–E2, E4 | Lobby: empty → live update → names listed |
| E3 | Two users, both cameras: frames received both ways |
| E5 | Three users via three different link forms; all receive all video |
| E6 | Exactly one audio element per remote participant |
| E7 | Phone layout has no page overflow |
| E8–E9 | Camera off shows avatar to others; camera on resumes video |
| E10 | Screen share visible with presenter camera in filmstrip |
| E11 | Phone-emulated viewer renders the shared screen |
| E12–E13 | Gallery while presenting; stop share clears for all |
| E14 | Chat delivered |
| E15 | Refresh mid-call: no duplicate, video restored |
| E16 | Renderer crash: removed for others (socket closed, ~1 s) |
| E17 | Rejoin after crash: one tile, video works |
| E18 | Offline banner |
| E19–E20 | Leave removes within 5 s; ended screen |
| E21 | Blur on, outgoing video intact |
| E22–E24 | Host mute, remove (with confirmation) |
| E25 | Invite without provider reports failure |
| E26–E28 | No uncaught page errors |

**Restart test** (`tests/e2e/restart.mjs`, E-R):
- Two users in a call, then the backend is stopped for about 6 s and restarted.
- Both clients showed the reconnecting banner and rejoined automatically, and server presence reported 2.
- Video flowed throughout; existing accounts could log in after the restart.

**Other checks**
- `npm run build` succeeds. The bundle-size warning is pre-existing; MediaPipe is split into its own chunk.
- The schema compiles for the PostgreSQL dialect.

**Not tested**
- Real email delivery.
- PostgreSQL server.
- TURN relay.
- Physical Android or iOS devices.
- Firefox, Edge and Safari.
- Real speech recognition.
- Segmentation quality on real people.
- Calls across two different networks.
- The production deployment itself: nothing was deployed from here.

**Known flake:** before the StrictMode fix, E3 failed intermittently. After the fix, 10 consecutive runs and 3 full runs passed.

---

## 18. Browser compatibility

| Feature | Chrome / Edge desktop | Firefox desktop | Safari macOS | Android Chrome | iOS Safari |
|---|---|---|---|---|---|
| Audio/video call | Yes (tested: Chrome) | Expected yes (standard APIs; untested) | Expected yes (untested) | Expected yes (untested) | Expected yes (iOS 14.3+; untested) |
| Share screen | Yes (tested) | Yes (no tab audio) | Yes (no audio) | **No** (browser limitation; the UI says so) | **No** (browser limitation; the UI says so) |
| View a shared screen | Yes | Yes | Yes | Yes (emulation tested) | Expected yes |
| Background effects | Yes (tested) | Expected yes | Expected yes (Safari 15+) | Yes, heavier CPU | Expected yes, heavier CPU |
| Live captions (speaking) | Yes | **No** speech API | Partial | Partial; may pause while the mic is in use | Partial |
| Live captions (reading) | Yes | Yes | Yes | Yes | Yes |
| Speaker selection | Yes | Yes (recent) | No (system output) | No | No |
| Local recording | Yes (Chrome/Edge) | No | No | No | No |

---

## 19. Remaining limitations and external configuration

1. **Owner action required:** `DATABASE_URL` (PostgreSQL), an email API key plus a verified sender, and TURN credentials on Render (section 16). Until then `/api/health` lists exactly what is missing.
2. A mesh topology limits call size (about 6 cameras). Larger meetings need an SFU on infrastructure with UDP.
3. Live meeting state is in memory: one backend instance only; a restart drops calls for a few seconds (clients rejoin automatically).
4. Render free instances sleep after inactivity; the first request after sleeping is slow.
5. Screen sharing from phones is impossible in mobile browsers.
6. Captions depend on the browser's speech service: Chrome/Edge send audio to the vendor's service, and Firefox cannot transcribe.
7. Background effects download about 6 MB (WASM and model) from public CDNs the first time.
8. Breakout rooms were removed (not implemented).
9. Scheduling stores times as entered, without time zones; this behaviour is unchanged.
10. Tracked `__pycache__/*.pyc` files are still in the repository from earlier commits; they are ignored by `.gitignore` but were not removed in this change.
