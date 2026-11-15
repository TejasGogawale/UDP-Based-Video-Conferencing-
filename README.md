# VIT Connect — Next-Gen Hybrid UDP & WebRTC Audio-Video Conferencing System

<div align="center">

![VIT Connect](https://img.shields.io/badge/VIT%20Connect-PRO-blue?style=for-the-badge)
![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)
![Vite 8](https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite)
![Flask 3](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask)
![WebRTC + HTTPS Relay](https://img.shields.io/badge/WebRTC-Mesh%20%2B%20443%20Relay-333333?style=for-the-badge&logo=webrtc)
![Android APK & PWA](https://img.shields.io/badge/Android-APK%20%2B%20PWA-3DDC84?style=for-the-badge&logo=android)
![Vercel Ready](https://img.shields.io/badge/Vercel-Compatible-black?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A high-performance, firewall-resilient, real-time video conferencing and collaboration platform for PC, Web, and Android.**

🌐 **Live Web App:** [https://udp-based-video-conferencing.vercel.app](https://udp-based-video-conferencing.vercel.app)  
⚡ **Live Signaling & Media Relay API:** [https://udp-based-video-conferencing.onrender.com/api/health](https://udp-based-video-conferencing.onrender.com/api/health)

</div>

---

## 🚀 Overview & Core Capabilities

**VIT Connect** combines an enterprise-grade WebRTC mesh conferencing suite with a custom **HTTPS WebSocket Media Relay (Port 443)**, **Galois Field $\text{GF}(2^8)$ Reed-Solomon Forward Error Correction (FEC)**, **In-Stream Audio-Video Liveness & Anti-Deepfake Verification**, and **Autonomous Swarm Super-Peer Topology Election**.

### 🎥 Hybrid Video, Audio & Screen Conferencing
* **WebRTC Full-Mesh + Automatic HTTPS Port-443 Relay Fallback**:
  * Uses W3C *Perfect Negotiation* over low-latency UDP (`RTCPeerConnection`) when direct P2P paths are open.
  * Automatically activates a built-in **HTTPS Socket.IO TURN Relay (`media_relay`)** within 2.5 seconds whenever mobile carrier Symmetric NAT (4G/5G) or strict college/corporate firewalls block UDP—streaming camera video, screen shares, 12 kHz PCM16 audio, and presence heartbeats over standard HTTPS port `443` with zero external TURN signup required.
* **Screen Sharing with Unfiltered Tab & System Audio**:
  * Captures 1080p screen shares alongside high-fidelity tab/system audio (`systemAudio: 'include'`, voice suppression disabled).
  * Automatically mixes screen-share audio and microphone voice via the browser's `AudioContext` (`createMediaStreamDestination`) so shared video/music audio continues playing to all participants even when the presenter mutes their microphone.
* **AI Backgrounds & Visual Effects**:
  * Real-time person segmentation (MediaPipe Tasks Vision) for background blur, virtual background presets, custom uploaded backgrounds, and color grading filters.
* **Smart Hardware Management**:
  * Single permission prompt in the Green Room Lobby, hot-swappable microphone/camera/speaker selection, automatic recovery on device unplug, and live active-speaker audio meters.

### 🔬 Patent-Backed Networking & Security Subsystems
1. **Galois Field $\text{GF}(2^8)$ Reed-Solomon Sub-Packet FEC (`(8,6)` & `(10,6)`)**:
   * Implements systematic Vandermonde matrix erasure coding over $\text{GF}(2^8)$ (primitive polynomial $x^8 + x^4 + x^3 + x^2 + 1$, `0x11d`) in both Python (`networking/fec_gf256.py`) and JavaScript (`src/lib/rtc/fecGf256.js`).
   * Reconstructs up to 25%–40% lost packets in **0-RTT** on the receiver without waiting for ARQ retransmission requests.
2. **In-Stream Cryptographic Liveness & Anti-Deepfake Verifier**:
   * Continuously computes optical-flow micro-saccade entropy, temporal skin-luminance variance, and lip-to-audio envelope cross-correlation (`src/lib/media/livenessVerifier.js`).
   * Signs proofs in a rolling **SHA-256 HMAC chain** seeded by the server (`services/liveness.py`) and displays live verification badges (`ShieldCheck` / `ShieldAlert`) on participant tiles and the People drawer.
3. **Composite Channel Impairment Index ($CI$) & Autonomous Swarm Super-Peer Election**:
   * Evaluates link health via $CI = \alpha \cdot \text{PLF} + \beta \cdot (J / J_{\max}) + \gamma \cdot (\text{RTT} / \text{RTT}_{\max})$.
   * Computes each participant's Node Capability Score ($NCS$) from uplink bandwidth, RTT, loss, and CPU headroom (`services/swarm.py`), automatically electing a **Primary Super-Peer** and **Backup Super-Peer** and switching room topology from `FULL_MESH` to `HIERARCHICAL_TREE` when $N > 4$ or network impairment rises.

### 📱 Native Android App (APK) & Installable PWA
* **Installable Progressive Web App (PWA)**: Includes `manifest.webmanifest`, service worker (`sw.js`), and adaptive icons—installable directly from Chrome on Android/Desktop with 1 tap, auto-updating on every git push.
* **Native Android Wrapper (`android/`)**: Full Android WebView project with native camera, microphone, and WebRTC permissions (`MainActivity.java`) plus an automated GitHub Actions APK build pipeline (`.github/workflows/build-android-apk.yml`).

### 🤝 Real-Time Collaboration & Host Moderation
* **Touch-Enabled Collaborative Whiteboard**: Multi-color canvas with pen, highlighter, eraser, clear, and PNG export.
* **Live Polls & Q&A**: Real-time poll creation with animated vote bars and interactive Q&A with participant upvoting.
* **Live Speech Captions (CC)**: Distributed Web Speech API transcription broadcast across the room with speaker attribution.
* **Floating Emoji Reactions & Chat**: Persistent meeting chat with download-to-text and animated stage reactions.
* **Host Control Center**: Server-enforced locks for microphones, cameras, screen sharing, and chat, plus remote mute, participant removal, and end-meeting-for-all.
* **Scheduling & Transactional Email Invites**: Automated email invitations and reminders via **Brevo HTTPS API**, **Resend HTTPS API**, or **SMTP**, with 1-click Google Calendar & `.ics` export.

---

## 📁 Project Architecture

```text
vit-connect/
├── index.html                        # Entry point with mobile viewport & PWA manifest links
├── package.json                      # Frontend dependencies (React 19, Vite 8, Socket.IO, MediaPipe)
├── capacitor.config.json             # Capacitor Android configuration pointing to live deployment
├── public/
│   ├── manifest.webmanifest          # PWA install manifest
│   ├── sw.js                         # Network-first Service Worker
│   ├── icon-192.png / icon-512.png   # App icons
│   └── icon.svg                      # Vector app icon
├── android/                          # Native Android APK project (Gradle + WebRTC WebChromeClient)
├── .github/workflows/
│   └── build-android-apk.yml         # Automated GitHub Actions Android APK builder
│
├── src/                              # React Frontend Source Code
│   ├── config/api.js                 # API & Socket.IO endpoint configuration
│   ├── context/AuthContext.jsx       # JWT authentication context
│   ├── hooks/
│   │   └── useConference.js          # Single owner of meeting state, WebRTC mesh & HTTPS media relay
│   ├── lib/
│   │   ├── rtc/
│   │   │   ├── PeerMesh.js           # W3C Perfect Negotiation WebRTC mesh + data-channel FEC
│   │   │   └── fecGf256.js           # Browser GF(2^8) Reed-Solomon FEC + CI & NCS calculators
│   │   └── media/
│   │       ├── localMedia.js         # Camera, mic & unfiltered screen-audio acquisition
│   │       ├── livenessVerifier.js   # Optical-flow + audio correlation + SHA-256 HMAC liveness prover
│   │       ├── backgroundProcessor.js# MediaPipe person segmentation & visual effects pipeline
│   │       ├── audioLevels.js        # Web Audio active-speaker & level monitor
│   │       └── recorder.js           # Local WebM meeting recorder
│   ├── components/meet/              # Conference Room UI Suite
│   │   ├── VideoGrid.jsx             # Adaptive 16:9 gallery, filmstrip & presentation stage
│   │   ├── ParticipantTile.jsx       # Video/Relay tile with liveness badge, speaking ring & controls
│   │   ├── ControlDock.jsx           # Desktop control bar + responsive Mobile Bottom Sheet
│   │   ├── GreenRoomLobby.jsx        # Pre-join hardware check & live room presence preview
│   │   ├── drawers/                  # People, Chat, Activities, Host Controls, Visual Effects drawers
│   │   └── activities/               # Whiteboard, Polls, and Q&A modals
│   └── pages/                        # Home, Login, Register, Dashboard, ConferenceRoom, etc.
│
├── app.py                            # Flask application factory + /api/health + /api/ice-servers
├── config.py                         # Environment configuration (DB, Brevo/Resend/SMTP, STUN/TURN)
├── database.py                       # SQLAlchemy ORM setup (PostgreSQL & SQLite compatible)
├── run_servers.py                    # Dual launcher (Flask WebSocket server + UDP media server)
├── routes/
│   ├── auth.py                       # JWT register, login, verify & profile routes
│   └── meetings.py                   # Instant/scheduled meetings, email invites & .ics export
├── events/
│   └── socket_events.py              # Socket.IO signaling, HTTPS media_relay, liveness & swarm events
├── services/
│   ├── presence.py                   # Authoritative in-memory meeting roster & presence tracker
│   ├── liveness.py                   # Server-side SHA-256 HMAC liveness chain verifier
│   ├── swarm.py                      # Channel Impairment Index (CI) & Super-Peer election engine
│   └── mail_service.py               # Multi-provider email service (Brevo HTTPS, Resend HTTPS, SMTP)
├── networking/
│   ├── fec_gf256.py                  # Python GF(2^8) Vandermonde Reed-Solomon (8,6)/(10,6) codec
│   ├── udp_server.py                 # Multi-threaded UDP conferencing & FEC packet server
│   └── udp_client.py                 # UDP conferencing client with 0-RTT FEC recovery
└── tests/
    └── test_backend.py               # 24 automated unit & integration tests
```

---

## 🛠️ Local Installation & Development

### Prerequisites
* **Node.js** v18+
* **Python** v3.10+

### 1. Backend Setup (Flask + Socket.IO + UDP Server)
```bash
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Start Flask + Socket.IO signaling server (http://localhost:5000)
python app.py
# Or start both Flask (5000) and UDP media server (5001):
python run_servers.py
```

### 2. Frontend Setup (React + Vite)
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🚢 Production Deployment (Render + Vercel)

### Backend Environment Variables (Render Web Service)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `FLASK_ENV` | Yes | Set to `production` |
| `SECRET_KEY` | Yes | Random secret string for Flask sessions |
| `JWT_SECRET_KEY` | Yes | Random secret string (32+ chars) for JWT tokens |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL (`postgresql://...`). Without this, Render uses ephemeral SQLite which resets on deploy. |
| `FRONTEND_URL` | Yes | `https://udp-based-video-conferencing.vercel.app` |
| `BREVO_API_KEY` | For Email | Brevo (`xkeysib-...`) API key over HTTPS port 443 (works on Render Free tier where SMTP ports 25/465/587 are blocked) |
| `EMAIL_FROM` | For Email | Verified sender email address in Brevo |
| `TURN_URLS` | Optional | Optional external `turn:` / `turns:` URLs (built-in HTTPS `media_relay` works automatically without this) |

### Frontend Environment Variables (Vercel)

| Variable | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://udp-based-video-conferencing.onrender.com` |
| `VITE_SOCKET_URL` | `https://udp-based-video-conferencing.onrender.com` |

Verify live backend health at any time via `GET /api/health`.

---

## 📱 Installing on Android (PWA & Native APK)

1. **Instant PWA Install (Recommended — Auto-Updates)**:
   * Open [https://udp-based-video-conferencing.vercel.app](https://udp-based-video-conferencing.vercel.app) in Chrome on Android.
   * Tap the browser menu (`⋮`) → **Add to Home screen / Install app**.
2. **Native Android APK (GitHub Actions)**:
   * Every push to `main` or `fix/conferencing-overhaul` triggers `.github/workflows/build-android-apk.yml`.
   * Download the compiled **`VIT-Connect-Android-APK`** (`app-debug.apk`) from the repository's **Actions** tab.

---

## 🧪 Running Automated Tests

```bash
# Run all 24 backend & patent subsystem unit tests (Auth, Presence, Signaling, Media Relay, Liveness HMAC, GF(256) FEC, Swarm Election)
.\venv\Scripts\python.exe -m unittest discover -s tests -v

# Verify production frontend bundle build
npm run build
```

---

## 🔌 API & Socket.IO Event Reference

### REST Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT bearer token |
| `GET` | `/api/auth/verify` | Verify current JWT session |
| `PUT` | `/api/auth/profile` | Update user display name |
| `GET` | `/api/health` | Deployment diagnostics (DB durability, email provider, ICE/TURN state) |
| `GET` | `/api/ice-servers` | Authenticated STUN/TURN server list |
| `GET` | `/api/meetings` | List user's created and attended meetings with live participant counts |
| `POST` | `/api/meetings/create` | Create an instant meeting room |
| `POST` | `/api/meetings/schedule` | Schedule a meeting and dispatch transactional email invites |
| `POST` | `/api/meetings/<id>/invite` | Send email invitations to participants from inside a meeting |
| `GET` | `/api/meetings/<id>/calendar.ics` | Download universal iCalendar (`.ics`) event file |

### Real-Time Socket.IO Events
| Event | Direction | Purpose |
| :--- | :---: | :--- |
| `watch_meeting` → `presence_update` | C→S / S→C | Live Green-Room lobby participant counter |
| `join_meeting` → `joined` | C→S / S→C | Join room, receive roster, chat history, state & cryptographic `livenessSeed` |
| `roster_update` | S→C | Authoritative participant list broadcast on join/leave/state change |
| `signal` | C↔S↔C | WebRTC SDP offer/answer & ICE candidate exchange |
| `media_relay` | C↔S↔C | **HTTPS Port-443 TURN Relay** for camera, screen, 12 kHz PCM16 audio & heartbeats |
| `liveness_proof` → `liveness_update` | C→S / S→C | Rolling SHA-256 HMAC anti-deepfake verification proof & status badge |
| `telemetry_report` → `swarm_topology_update` | C→S / S→C | Channel Impairment ($CI$), Node Capability ($NCS$) & Super-Peer election broadcast |
| `media_state` / `screen_share_status` / `toggle_hand` | C→S | Mic, camera, screen-share & raised-hand state updates |
| `send_chat` / `send_reaction` / `live_caption` | C↔S | Real-time chat messages, floating emoji reactions & live speech captions |
| `create_poll` / `submit_qa` / `whiteboard_draw` | C↔S | Collaborative polls, Q&A upvoting & shared whiteboard strokes |
| `host_action` → `host_command` | C→S / S→C | Server-verified host moderation (mute, remove, lock features, end call) |
