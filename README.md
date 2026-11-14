# VIT Connect - Next-Gen Audio-Video Conferencing System

<div align="center">

![VIT Connect](https://img.shields.io/badge/VIT%20Connect-PRO-blue?style=for-the-badge)
![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask)
![WebRTC](https://img.shields.io/badge/WebRTC-Dual--Mesh-333333?style=for-the-badge&logo=webrtc)
![Vercel Ready](https://img.shields.io/badge/Vercel-Compatible-black?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A high-performance, secure, real-time video conferencing and collaboration platform designed for PC and mobile browsers. Try it on - (https://udp-based-video-conferencing.vercel.app/)**

</div>

---

## 🚀 Overview & Key Features

**VIT Connect** provides an enterprise-grade video conferencing experience inspired by modern communication platforms, enriched with advanced real-time collaboration features, automated email notifications, and dual WebRTC mesh streaming.

### 🎥 Video & Audio Conferencing
* **WebRTC Mesh Streaming**: One peer connection per participant pair carries microphone, camera and screen share (with tab audio). Tracks can be added or swapped at any time (perfect negotiation). Best with up to about 6 people on camera.
* **Device Handling**: Single permission prompt, clear permission/device errors, live microphone/camera/speaker switching, automatic recovery when a device is unplugged.
* **Backgrounds & Effects**: Real person segmentation (MediaPipe) for background blur, preset and uploaded background images, and colour filters. The processed video is what other participants receive.
* **Audio Levels & Active Speaker**: Real microphone level meters, active-speaker highlight, join/leave chimes and hand-raise alerts.

### 📱 Responsive: Mobile & PC Compatible
* **PC & Desktop Layout**: Spacious control dock, 1-to-4+ column adaptive tiled grid, side-by-side docking drawers (`w-80` / `w-96`), and keyboard shortcuts (<kbd>Ctrl+D</kbd> Mic, <kbd>Ctrl+E</kbd> Camera).
* **Mobile & Tablet Layout**: Compact bottom dock, dedicated **Mobile Bottom Sheet** for quick tool access, full-screen slide-over drawer overlays, `100dvh` dynamic viewport height, and iOS notch / home-bar safe-area padding (`pb-safe`).

### 🤝 Live Interactive Collaboration
* **Touch-Enabled Digital Whiteboard**: Real-time collaborative whiteboard with multi-color palettes, eraser, highlighter, PNG export, and full touch drawing support (`onTouchStart`, `onTouchMove`, `onTouchEnd`).
* **Live Interactive Polls**: Create polls with real-time percentage progress bars, multiple choices, and live voting updates.
* **Q&A Module**: Submit questions, upvote popular questions, and mark questions as answered in real-time.
* **Floating Emoji Reactions**: Live floating reaction animations (💖, 👍, 👏, 😂, 😮, 🎉, etc.) rendered directly over video stages.
* **Live Captions (CC)**: Each speaker's browser transcribes their own microphone (Web Speech API) so captions carry the right name. Chrome, Edge and Safari; not Firefox.

### 📅 Scheduling & Google Sync
* **Email Invitations & Reminders**: Invite people from inside a meeting or when scheduling. Sent through Brevo or Resend (HTTPS, works on Render) or SMTP; every recipient's delivery result is shown, never a fake success.
* **Google Calendar & .ics Sync**: 1-click Google Calendar web event creation and universal `.ics` calendar file downloads.

### 🛡️ Host Moderation & Security
* **Host Control Center**: Mute all participants, mute individual peers, lock chat, disable screen sharing, disable microphones/cameras, or end meeting for all.
* **Authentication**: JWT-based user register/login mechanisms with protected route guards and session management.

---

## 📁 Project Architecture

```text
vit-connect/
├── index.html                  # Main entry point with mobile viewport & PWA meta tags
├── package.json                # Frontend dependencies (React 19, Vite, Socket.IO, Lucide, Framer Motion)
├── vite.config.js              # Vite bundler & development proxy configuration
├── tailwind.config.js          # Tailwind CSS styling configuration
├── vercel.json                 # Vercel SPA routing rewrites configuration
├── .env.example                # Template environment variables for frontend & backend
│
├── src/                        # React Frontend Source Code
│   ├── main.jsx                # Application root mounting
│   ├── App.jsx                 # Client-side router & route protection
│   ├── index.css               # Global styles, mobile safe-area insets & utilities
│   ├── config/
│   │   └── api.js              # Centralized API endpoints & WebSocket URL configuration
│   ├── context/
│   │   └── AuthContext.jsx     # User authentication state & token verification
│   ├── components/
│   │   ├── Navbar.jsx          # Top navigation bar with live clock & profile menu
│   │   ├── ProtectedRoute.jsx  # Authentication route guard
│   │   └── meet/               # Conference Room Component Suite
│   │       ├── ControlDock.jsx         # Adaptive control dock (Desktop dock + Mobile Bottom Sheet)
│   │       ├── VideoGrid.jsx           # Dynamic tiled video grid & presentation stage
│   │       ├── ParticipantTile.jsx     # Video tile with audio reactive ripple & pin controls
│   │       ├── GreenRoomLobby.jsx      # Pre-call hardware test lobby & preview
│   │       ├── LiveCaptions.jsx        # Floating real-time speech subtitles
│   │       ├── ReactionsOverlay.jsx    # Floating emoji reaction animations
│   │       ├── ScheduleModal.jsx       # Google Mail & Calendar scheduling modal
│   │       ├── DeviceSettingsModal.jsx # Audio/Video device configuration modal
│   │       ├── MeetingEndedScreen.jsx  # Post-meeting duration summary & feedback
│   │       ├── drawers/                # Slide-Over & Mobile Overlay Drawers
│   │       │   ├── ChatDrawer.jsx
│   │       │   ├── PeopleDrawer.jsx
│   │       │   ├── ActivitiesDrawer.jsx
│   │       │   ├── HostControlsDrawer.jsx
│   │       │   ├── MeetingDetailsDrawer.jsx
│   │       │   └── VisualEffectsDrawer.jsx
│   │       ├── activities/             # Collaboration Modals
│   │       │   ├── WhiteboardModal.jsx # Touch & mouse collaborative canvas
│   │       │   ├── PollsModal.jsx      # Real-time polls & voting
│   │       │   ├── QAModal.jsx         # Interactive Q&A with upvoting
│   │       │   └── BreakoutRoomsModal.jsx
│   │       └── utils/                  # Speech recognition, sound effects & fallbacks
│   └── pages/
│       ├── Home.jsx            # Landing page
│       ├── Login.jsx           # User login page
│       ├── Register.jsx        # Account registration
│       ├── Dashboard.jsx       # Meeting management & scheduled calendar events
│       ├── CreateMeeting.jsx   # Instant meeting creation
│       ├── JoinMeeting.jsx     # Room code input
│       ├── ConferenceRoom.jsx  # Core WebRTC audio/video conference room
│       └── NotFound.jsx        # 404 handler
│
├── app.py                      # Flask backend application with permissive CORS & Socket.IO
├── config.py                   # Backend configuration & environment loading
├── database.py                 # SQLAlchemy database setup & ORM initialization
├── run_servers.py              # Dual server runner (Flask + UDP daemon)
├── requirements.txt            # Python dependencies
├── routes/                     # REST API Blueprints
│   ├── auth.py                 # Registration, login, token verification
│   └── meetings.py             # Meeting creation, scheduling, reminders, .ics calendar
├── models/                     # SQLAlchemy Models
│   ├── user.py
│   ├── meeting.py
│   ├── participant.py
│   └── message.py
├── events/
│   └── socket_events.py        # Socket.IO WebRTC signaling & real-time events
└── networking/
    ├── udp_server.py           # Multi-threaded UDP conference server
    └── udp_client.py           # UDP CLI conferencing client
```

---

## 🛠️ Local Installation & Development

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.9 or higher)

---

### Step 1: Backend Setup (Flask API + Socket.IO)

1. Open a terminal in the project directory.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your `.env` file (refer to `.env.example`):
   ```env
   FLASK_ENV=development
   SECRET_KEY=your-custom-secret-key
   DATABASE_URL=sqlite:///vit_connect.db
   JWT_SECRET_KEY=your-jwt-secret-key
   FRONTEND_URL=http://localhost:3000

   # Gmail SMTP Settings for reminder emails (Optional):
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-gmail-app-password
   ```
5. Start the backend server:
   ```bash
   python run_servers.py
   # Or directly:
   python app.py
   ```
   * Flask + WebRTC Signaling server runs at: `http://localhost:5000`
   * UDP Conference Server runs at: `udp://localhost:5001`

---

### Step 2: Frontend Setup (React + Vite)

1. In a second terminal in the project directory, install Node dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser at: `http://localhost:3000`


## 🚢 Production Deployment (Render backend + Vercel frontend)

Full details, including why each setting matters, are in
[`IMPLEMENTATION_AND_CHANGELOG.md`](IMPLEMENTATION_AND_CHANGELOG.md#16-render-deployment).

**Render (backend web service)**

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `FLASK_ENV` | yes | `production` |
| `SECRET_KEY`, `JWT_SECRET_KEY` | yes | Long random strings. Changing `JWT_SECRET_KEY` logs everyone out. |
| `DATABASE_URL` | **yes** | PostgreSQL URL (e.g. Render PostgreSQL "Internal Database URL"). Without it the app uses SQLite on Render's temporary disk and **loses all accounts on every restart/deploy**. |
| `FRONTEND_URL` | yes | Public frontend URL, used in invitation links. |
| `BREVO_API_KEY` or `RESEND_API_KEY` | for email | Render free instances block SMTP ports, so Gmail SMTP cannot work there. |
| `EMAIL_FROM` | for email | Sender address verified with the email provider. |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | recommended | Needed for calls between strict/mobile networks. |

Start command: `python app.py` (single process; live meeting state is held in memory).
After deploying, open `https://<backend>/api/health`: it reports the database type,
whether email is configured, whether TURN is configured, and any configuration warnings.

**Vercel (frontend)**: set `VITE_API_URL` and `VITE_SOCKET_URL` to the backend URL and redeploy.

## 🧪 Tests

```bash
python -m unittest discover -s tests -v   # backend: auth, presence, signaling, host controls, email
npm run build                              # frontend production build
```

Browser end-to-end tests (three users, fake camera/mic): see [`tests/e2e/README.md`](tests/e2e/README.md).

## 🔌 API Reference & WebSocket Events

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Log in and receive JWT access token (email is case-insensitive) |
| `GET` | `/api/auth/verify` | Verify current JWT token session |
| `PUT` | `/api/auth/profile` | Update display name |
| `GET` | `/api/health` | Deployment self-check (database, email, TURN, warnings) |
| `GET` | `/api/ice-servers` | STUN/TURN configuration for WebRTC (authenticated) |
| `GET` | `/api/meetings` | Meetings the user created or attended (with live participant count) |
| `POST` | `/api/meetings/create` | Create an instant meeting |
| `POST` | `/api/meetings/schedule` | Schedule a meeting; reports per-recipient email results |
| `GET` | `/api/meetings/scheduled` | List scheduled meetings |
| `GET` | `/api/meetings/<id-or-code>` | Meeting details (accepts id, code, or dashed code) |
| `GET` | `/api/meetings/<id-or-code>/presence` | Who is in the live call right now |
| `POST` | `/api/meetings/<id-or-code>/invite` | Email invitations (`emails`, `resend`); 200 / 207 partial / 502 failed |
| `POST` | `/api/meetings/<id>/send-reminder` | Re-send scheduling emails (host only) |
| `GET` | `/api/meetings/<id>/calendar.ics` | iCalendar invite file |

### Socket.IO Real-Time Events

| Event | Direction | Description |
| :--- | :--- | :--- |
| `watch_meeting` → `presence_update` | C→S / S→C | Pre-join lobby: live list of who is in the call |
| `join_meeting` → `joined` | C→S / S→C | Join (by id, code or dashed code); reply has roster, chat history, activity state |
| `roster_update` | S→C | Full authoritative participant list after every change |
| `leave_meeting` | C→S | Leave immediately (also sent on page hide) |
| `signal` | C↔S↔C | WebRTC SDP/ICE relay, only between members of the same meeting |
| `media_state` / `toggle_hand` / `screen_share_status` | C→S | Per-participant state, reflected in `roster_update` |
| `send_chat` → `chat_message` | C→S / S→C | Chat (persisted) |
| `captions_toggle` → `captions_demand`, `live_caption` → `caption_received` | both | Live captions |
| `send_reaction` → `user_reaction` | both | Emoji reactions |
| `create_poll` / `vote_poll` / `end_poll` → `poll_updated` | both | Polls |
| `submit_qa` / `upvote_qa` / `answer_qa` → `qa_updated` | both | Q&A |
| `whiteboard_draw` / `whiteboard_clear` | both | Whiteboard |
| `recording_status` → `recording_state_changed` | both | Local recording notice |
| `host_action` → `host_command` / `meeting_ended` / `host_locks_updated` | both | Host moderation (verified server-side) |

---
