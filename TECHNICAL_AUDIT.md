# VIT Connect — Technical Audit and Root Cause Analysis

Audit date: 2026-11-15. Written before any code was changed.

Evidence levels used below:

- **Confirmed (code)** — the defect is provable by reading the code path; no runtime guess involved.
- **Confirmed (production probe)** — observed against the live deployment with read-only requests.
- **Inferred** — strongly implied by the code and platform, but needs dashboard access or a device I do not have to prove.

---

## 1. Architecture as found

| Layer | Implementation |
|---|---|
| Frontend | React 19 + Vite + Tailwind, SPA on Vercel (`https://udp-based-video-conferencing.vercel.app`) |
| Backend | Flask 3 + Flask-SocketIO (`async_mode='threading'`), served by the Werkzeug dev server on Render (`https://udp-based-video-conferencing.onrender.com`), Python 3.14 |
| Signaling | Socket.IO events `join_meeting`, `offer`, `answer`, `ice_candidate`, relayed by socket id |
| Media | WebRTC full mesh, **two** `RTCPeerConnection`s per peer pair ("dual mesh"): one for camera/mic, one for screen share. STUN only, no TURN |
| Meeting state | Python dicts in process memory (`active_meetings`, `meeting_state_store`) keyed by whatever string the client sent as `meetingId` |
| Database | Flask-SQLAlchemy; `DATABASE_URL` defaults to `sqlite:///vit_connect.db`; tables `users`, `meetings`, `participants`, `messages` |
| Auth | JWT (30-day access token) in `localStorage`; passwords hashed with PBKDF2-SHA256 (not plain text) |
| Email | `smtplib` straight to Gmail SMTP (port 587/465) inside the HTTP request |
| Virtual backgrounds | A Tailwind `backdrop-blur` class on the local `<video>` element |
| Captions | Browser Web Speech API, relayed over Socket.IO |
| Deployment config | None in the repo (no `render.yaml`, `Procfile`, or start command); `vercel.json` SPA rewrite only |

Lifecycle of a call as found: `Dashboard`/`CreateMeeting`/`JoinMeeting` navigate to `/conference/:meetingId` → `ConferenceRoom` opens the camera and fetches meeting metadata → the lobby renders → "Join now" opens a **new** socket, emits `join_meeting` → server replies `current_users` → the joiner creates one media peer connection per existing user and sends offers → on leave the socket is disconnected.

Mesh vs SFU: the architecture is a full mesh. That is appropriate for the small meetings this project targets (comfortable to about 4–6 video participants; each client uploads N−1 copies of its video). An SFU needs a media server with public UDP ports, which Render web services do not provide, so it cannot be added on the current hosting. Decision: keep the mesh, fix it, cap per-peer bitrate as the room grows, and document the ceiling.

---

## 2. Shared root causes

Most of the ten reported bugs come from five underlying defects.

### RC-A. The meeting has no canonical identity (Confirmed, code)

The socket room is keyed by the raw URL parameter. Different entry points put different strings in the URL:

- `src/pages/CreateMeeting.jsx:27` navigates to `/conference/<uuid>`
- `src/pages/Dashboard.jsx:130,436,502` navigates to `/conference/<MEETINGCODE>`
- `Dashboard.jsx:114` builds a share link with a dashed code (`ABC-DEFG-HIJ`), and `Dashboard.jsx:143` keeps dashes and case as typed
- email links use the undashed code

`events/socket_events.py:57-58` calls `join_room(meeting_id)` with that string unmodified. Two people in the "same" meeting who arrived by different routes are in different rooms and never signal each other. This alone produces "participants cannot see each other", wrong counts, and differing participant lists. The dashed share link is worse: it is truncated to 10 of the 12 code characters (`slice(7, 10)`), so that link can never resolve to the meeting in the database.

### RC-B. Participant identity is the socket id, and there is no authoritative roster (Confirmed, code)

- A participant *is* a Socket.IO `sid`. Every reconnect (network blip, mobile tab resume, refresh) gets a new `sid` and re-emits `join_meeting`, so the same person is added again. The old entry survives until the server notices the dead socket.
- Dead-socket detection uses the defaults seen in production (`pingInterval` 25 s + `pingTimeout` 20 s), so a closed mobile browser stays in the meeting for up to 45 s.
- Clients build their list from deltas (`user_joined` / `user_left`) and never reconcile against the server, so one missed event leaves a permanent ghost or a missing tile.
- "Rejoin" on the ended screen reuses stale React state.
- The lobby count is `participants.length` (`ConferenceRoom.jsx:901`), but `participants` is only filled after the socket connects, which only happens after "Join now". The lobby can therefore only ever say "No one else is in this meeting yet". There is no API to ask who is in a meeting.

### RC-C. Fragile WebRTC negotiation and stream handling (Confirmed, code; the TURN part is Inferred)

1. **No renegotiation path.** A peer connection is offered exactly once. Tracks are added only if `localStreamRef.current` already exists when the connection is created (`ConferenceRoom.jsx:242`). If the camera prompt is still open, was denied, or a device is changed later, the connection permanently has no video and nothing ever fixes it.
2. **One shared, mutated `MediaStream` per peer.** `ontrack` adds tracks into a long-lived stream and puts the *same object* back into React state (`ConferenceRoom.jsx:249-261`). React sees no change, so effects do not re-run, and WebKit (all iOS browsers) does not reliably start rendering a video track added to a stream after it was assigned to `srcObject`. Audio usually arrives first, so video is the track that goes missing. This is a direct cause of black tiles and black screen share on phones.
3. **No TURN server.** Only Google STUN is configured (`ConferenceRoom.jsx:111`). Two users behind symmetric NAT (most mobile carriers, many campus networks) cannot connect at all. `ontrack` still fires, so the UI shows a tile with a stream that never carries a frame: a silent black rectangle.
4. **Double audio.** Each remote tile plays the same stream through an unmuted `<video>` and an `<audio>` element (`ParticipantTile.jsx`), which causes echo and phasing.
5. **Unmuted autoplay swallowed.** `play().catch(() => {})` hides autoplay rejections, which are common on mobile for unmuted video. The result is a black element with no explanation.
6. **Stale closures.** Socket handlers are registered once inside `enterMeetingCall` and close over the first render's state (`presenterInfo`, `activeDrawer`).
7. **React StrictMode double-mount** runs `initLocalMedia()` twice and races two `getUserMedia` streams; one can leak with the camera light on.
8. **Signaling is unauthenticated per room.** The relay forwards to any `sid` without checking that sender and target share a meeting.
9. Screen share lives on a second peer connection per peer, doubling ICE work and failure surface. It also depends on message ordering between `offer(screen)` and `peer_screen_share_changed`.

### RC-D. Production infrastructure (Confirmed by probe where stated)

- **Email.** Render blocks outbound SMTP ports 25/465/587 on free web services (in force since 2025-09-26, per Render's changelog). The app sends mail only through `smtplib`. On a free instance every send times out no matter how correct the SMTP variables are. Separately, when credentials are *missing* the code returns `success: True, simulated: True` (`services/mail_service.py:190-205`), and the UI prints "Reminders dispatched" without reading the result at all (`ScheduleModal.jsx:195-207`, `Dashboard.jsx:153-160`). The system therefore reports success in both failure modes.
- **Database.** `DATABASE_URL` falls back to a SQLite file. Render web services have an ephemeral filesystem: the file is recreated on every deploy and restart, and free instances restart after idle spin-down. `requirements.txt` has no PostgreSQL driver and `database.py` runs SQLite-only `PRAGMA` statements, so the app as written cannot run on Render Postgres. Conclusion: production is on SQLite and loses all users on restart. *Inferred* — I cannot read the Render environment — but the code leaves no other working option on Render.
- **Server.** Production runs the Werkzeug development server (probe: `x-render-origin-server: Werkzeug/3.1.8 Python/3.14.3`). `app.py` runs with `debug=True` when started directly, which would expose the interactive debugger.
- **Transport is fine.** Probe: polling handshake succeeds, WebSocket upgrade returns `101`, CORS preflight from the Vercel origin succeeds. Signaling connectivity is not the cause of the reported bugs.
- All in-memory meeting state is lost on restart and requires a single server process.

### RC-E. Features that are presentational only (Confirmed, code)

- **Virtual backgrounds.** `backdrop-filter` blurs what is *behind* an element, so applying it to the `<video>` does nothing visible. Image backgrounds have no implementation: selecting one only stores an id. Nothing is ever applied to the outgoing track, so remote users could never see an effect.
- **Captions.** Only clients that switched captions on run speech recognition, and they transcribe only their own microphone. If A turns captions on, A sees A's own words and nothing from B. Each interim result is appended as a new line, so text repeats.
- **Host controls.** The server broadcasts `host_command` but no client listens for it, and the server never checks that the sender is the host. Mute, mute all, and end-for-all do nothing.
- **Active speaker** is never computed (`activeSpeakerId` is never set).
- **Audio level meters** in the lobby and settings are `Math.random()`.
- **Device selection** in settings is not wired to anything.
- **Recording** toggles a flag and shows "REC" without recording.
- **Breakout rooms** shuffle names locally and move nobody.
- **Camera fallback** substitutes an animated canvas labelled "Simulated Feed" when the camera is unavailable, in production too.

---

## 3. Per-issue analysis

### 1.1 Incorrect participant count before joining
1. **Observed:** lobby always says nobody has joined.
2. **Suspected:** stale state.
3. **Actual (Confirmed, code):** RC-B — no presence source exists before joining; the count reads an empty array.
4. **Frontend:** `ConferenceRoom.jsx`, `GreenRoomLobby.jsx`.
5. **Backend:** `events/socket_events.py`.
6. **APIs/events/models:** none exist for presence; needs a new one.
7. **Depends on:** RC-A (a count is meaningless until rooms are canonical).
8. **Fix:** one server-side presence registry keyed by the meeting's database id; the lobby subscribes over the socket (`watch_meeting` → `presence_update`); a REST `GET /api/meetings/<id>/presence` reads the same registry.
9. **Risk:** lobby now needs a socket before joining; must not count watchers as participants.

### 1.2 Mobile responsiveness
1. **Observed:** overflow, clipped content, controls covering video.
2. **Suspected/Actual (Confirmed, code):** every drawer hard-codes `w-80` (320 px) inside a full-width mobile container; the dock has up to 8 fixed buttons in one row at 360 px; captions and reactions use fixed `bottom-24` and ignore safe areas; `MeetingEndedScreen` uses `min-h-screen` (100vh, taller than the visible viewport on mobile); the 2-tile grid forces `grid-rows-2` with `min-h` that overflows in landscape; `user-scalable=no` blocks zoom.
4. **Frontend:** `ControlDock`, all drawers, `VideoGrid`, `LiveCaptions`, `ReactionsOverlay`, `GreenRoomLobby`, `MeetingEndedScreen`, `index.css`, `index.html`.
5–6. No backend involvement.
7. **Depends on:** the presentation layout (1.4).
8. **Fix:** dynamic-viewport sizing with fallbacks, safe-area insets on dock and overlays, a mobile dock with five primary controls and a sheet for the rest, fluid drawers, grid computed from tile count and orientation.
9. **Risk:** visual regressions on desktop; verified by viewport emulation only, not on physical phones.

### 1.3 Mobile screen share is black
1. **Observed:** remote screen share is black on phones.
2. **Suspected:** codec or track attachment.
3. **Actual:** RC-C items 2, 3 and 5. Mutated stream (Confirmed, code), swallowed autoplay rejection (Confirmed, code), no TURN on carrier NAT (Inferred — needs two real networks). Codec is unlikely: both sides negotiate VP8/H.264 normally, though very large captures can exceed mobile decoder limits, so capture is capped at 1080p.
4. **Frontend:** `ConferenceRoom.jsx`, `VideoGrid.jsx`.
5. **Backend:** signaling relay; new ICE configuration endpoint.
7. **Depends on:** RC-C entirely; shares its fix with 1.6.
8. **Fix:** new immutable stream per track change, video always played muted with audio on a separate element, explicit states ("connecting", "tap to play", "no video received") instead of a bare black box, TURN support via environment.
9. **Risk:** without a TURN service configured, cross-network calls can still fail; the UI now says so.

### 1.4 Screen share plus presenter video
1. **Observed:** camera disappears when sharing.
3. **Actual:** the layout does render a camera strip, so the intent exists; the failures are RC-A/RC-C upstream (camera never arrives), plus the strip squeezing tiles to nothing on mobile. No way to switch layouts while presenting.
8. **Fix:** screen share becomes extra tracks on the existing connection; presentation layout with filmstrip; user toggle between presentation and gallery.
9. **Risk:** renegotiation glare when two people act at once — handled with the perfect-negotiation pattern.

### 1.5 Invitation emails not sent
1. **Observed:** no email arrives despite SMTP variables on Render.
3. **Actual:** RC-D. SMTP blocked on Render free instances (Confirmed for the platform; that this service is on a free instance is Inferred), success reported regardless (Confirmed, code). Also there is no invitation feature inside a meeting: "Add people" only opens the info drawer.
4. **Frontend:** `ScheduleModal.jsx`, `Dashboard.jsx`, `MeetingDetailsDrawer.jsx`.
5. **Backend:** `services/mail_service.py`, `routes/meetings.py`, `config.py`.
6. **APIs:** `POST /api/meetings/schedule`, `POST /api/meetings/<id>/send-reminder`; new `POST /api/meetings/<id>/invite`.
8. **Fix:** provider abstraction — HTTPS email API (Brevo or Resend, port 443) when a key is set, SMTP otherwise; never report success without provider acceptance; per-recipient results surfaced in the UI; duplicate suppression via an `invitations` table.
9. **Risk:** requires the owner to create an email-API key and set it on Render (cannot be done from here). "Accepted by provider" is not "landed in inbox".

### 1.6 Two cameras cannot stay on
3. **Actual:** RC-A (different rooms) and RC-C items 1–3.
8. **Fix:** canonical rooms; one connection per peer with perfect negotiation so tracks can be added, replaced and removed at any time; immutable streams; TURN support.
9. **Risk:** this replaces the dual-connection design, the largest change in the project. Justified because the existing design has no renegotiation, which several requirements need (device switching, backgrounds, late camera permission).

### 1.7 Participants remain after leaving; duplicates on rejoin
3. **Actual:** RC-B.
8. **Fix:** stable per-tab `clientId` (sessionStorage) sent on join; the server evicts any older socket with the same `clientId`; faster heartbeat (10 s / 15 s); `pagehide` sends an explicit leave; server broadcasts the full roster after every change and clients reconcile against it; join/leave times persisted in `participants`.
9. **Risk:** the same account in two tabs is still two participants by design (as in Google Meet).

### 1.8 Virtual backgrounds
3. **Actual:** RC-E — never implemented.
8. **Fix:** real person segmentation (MediaPipe Image Segmenter, WASM/GPU) composited on a canvas; the canvas track replaces the camera track on every connection, so remote users see it. Options: none, light blur, strong blur, preset images, custom upload. Falls back to the raw camera with a message if the model cannot load.
9. **Risk:** new dependency (`@mediapipe/tasks-vision`) with model and WASM fetched from a CDN at runtime; CPU cost on low-end phones.

### 1.9 Live captions
3. **Actual:** RC-E.
8. **Fix:** room-level caption demand — when anyone turns captions on, every capable client transcribes its own microphone and relays it; display is per-viewer; interim text replaces in place per speaker.
9. **Risk:** depends on the browser's speech service. Firefox has none; iOS Safari is partial; Android Chrome can pause recognition while the mic is in a call. Documented rather than hidden.

### 1.10 Database forgets users
3. **Actual:** RC-D (Inferred as described).
8. **Fix:** PostgreSQL support (driver, URL normalisation, portable migrations, pooled connections with pre-ping), startup log and `/api/health` stating which database is in use and whether it is durable, indexes and uniqueness constraints, case-insensitive email.
9. **Risk:** the owner must create a Postgres database and set `DATABASE_URL`; existing SQLite accounts on Render are already lost at each restart and cannot be migrated.

---

## 4. Fixing strategy

Order of work, shared causes first:

1. **Backend reliability** — config, portable database layer, health endpoint, honest mail service.
2. **Canonical meeting identity and presence registry** (RC-A, RC-B) — the single source of truth for who is in a meeting.
3. **WebRTC layer** (RC-C) — one module owning peer connections, negotiation, tracks and ICE; `ConferenceRoom` becomes a consumer of it.
4. **Participant lifecycle** on top of 2 and 3.
5. **Camera, mic, screen share, device switching, layouts.**
6. **Mobile layout.**
7. **Virtual backgrounds and captions.**
8. **Invitations UI.**
9. **UI polish, build, multi-session testing, documentation, push.**

Rules applied: no second copy of participant state; server roster is authoritative; nothing reports success it did not observe; simulated behaviour is removed or labelled.

## 5. What cannot be verified from this machine

- Render environment variables, instance type, and the production database (no dashboard access).
- Real email delivery (needs the owner's provider key).
- Physical Android/iOS devices, Firefox, Edge, and calls across two different networks.

These are listed again, with what was and was not tested, in `IMPLEMENTATION_AND_CHANGELOG.md`.

---

## 6. Post-implementation verification (added 2026-11-15)

Status of the root causes above after implementation and testing (details in `IMPLEMENTATION_AND_CHANGELOG.md`):

| Root cause | Status |
|---|---|
| RC-A canonical meeting identity | Confirmed and fixed. Rooms are keyed by meeting id; id, code and dashed code all join the same room (backend test B4, browser test E5). |
| RC-B roster/identity | Confirmed and fixed. A single presence registry, full-roster broadcasts, per-page client id, 25 s heartbeat bound, `pagehide` leave (B5, B7, B8, E15–E19). |
| RC-C negotiation/streams | Confirmed and fixed, plus **two additional causes found during testing** that were not visible from the code alone: (1) simultaneous initial offers made Chrome stop gathering ICE candidates on the side that rolled back, leaving pairs stuck at `iceConnectionState: "new"`; fixed with a deterministic first offerer. (2) Two overlapping camera requests (React StrictMode) shared one capture session, and stopping the discarded one ended the live camera; fixed by sharing a single in-flight request. |
| RC-C TURN | Still inferred. TURN is now configurable and failures are shown, but it was not tested across real NATs. |
| RC-D email | SMTP-blocking assessment unchanged (platform-documented). Fake success removed and HTTPS providers added. Real delivery needs the owner's API key. |
| RC-D database | Still inferred for production (no dashboard access). PostgreSQL support added and verified by DDL compilation, not against a live server. |
| RC-E presentational features | Fixed: backgrounds, captions, host controls, active speaker, meters, devices, recording. Breakout rooms removed. |
