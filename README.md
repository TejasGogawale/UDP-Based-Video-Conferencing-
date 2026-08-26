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
* **Dual-Mesh WebRTC Streaming**: Parallel peer connection pipelines for simultaneous HD camera/mic streams and crystal-clear screen sharing with system/tab audio.
* **Smart Device & Camera Handling**: Resilient `getUserMedia` constraints with automatic fallback, mobile front/back camera support (`facingMode: 'user'`), and synthetic fallback tracks.
* **Visual Effects & Camera Filters**: Background blur (`blur-sm`, `blur-lg`) and real-time color grading (Warm, Cool, Noir, Vivid).
* **Audio Visualizer & Sound Effects**: Dynamic speaking ripple indicators, input level meters, join/leave chimes, and hand-raise alerts.

### 📱 Responsive: Mobile & PC Compatible
* **PC & Desktop Layout**: Spacious control dock, 1-to-4+ column adaptive tiled grid, side-by-side docking drawers (`w-80` / `w-96`), and keyboard shortcuts (<kbd>Ctrl+D</kbd> Mic, <kbd>Ctrl+E</kbd> Camera).
* **Mobile & Tablet Layout**: Compact bottom dock, dedicated **Mobile Bottom Sheet** for quick tool access, full-screen slide-over drawer overlays, `100dvh` dynamic viewport height, and iOS notch / home-bar safe-area padding (`pb-safe`).

### 🤝 Live Interactive Collaboration
* **Touch-Enabled Digital Whiteboard**: Real-time collaborative whiteboard with multi-color palettes, eraser, highlighter, PNG export, and full touch drawing support (`onTouchStart`, `onTouchMove`, `onTouchEnd`).
* **Live Interactive Polls**: Create polls with real-time percentage progress bars, multiple choices, and live voting updates.
* **Q&A Module**: Submit questions, upvote popular questions, and mark questions as answered in real-time.
* **Breakout Rooms**: Host-managed breakout room assignments and participant distribution.
* **Floating Emoji Reactions**: Live floating reaction animations (💖, 👍, 👏, 😂, 😮, 🎉, etc.) rendered directly over video stages.
* **Live Closed Captions (CC)**: Automated speech-to-text live subtitles.

### 📅 Scheduling & Google Sync
* **Automated Google Mail Reminders**: Schedule meetings with automated invitation emails dispatched via Gmail SMTP to both the host and invited guests.
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


## 🔌 API Reference & WebSocket Events

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Log in and receive JWT access token |
| `GET` | `/api/auth/verify` | Verify current JWT token session |
| `GET` | `/api/meetings` | List all active/recent meetings for user |
| `POST` | `/api/meetings/create` | Create an instant or named meeting room |
| `POST` | `/api/meetings/schedule` | Schedule meeting with automated Gmail reminders & GCal links |
| `GET` | `/api/meetings/scheduled` | List upcoming scheduled meetings |
| `GET` | `/api/meetings/<id>` | Retrieve meeting metadata & details |
| `POST` | `/api/meetings/<id>/send-reminder` | Trigger reminder emails to participants |
| `GET` | `/api/meetings/<id>/calendar.ics` | Download standard iCalendar invite file |

### Socket.IO Real-Time Events

| Event | Direction | Description |
| :--- | :--- | :--- |
| `join_meeting` | Client -> Server | Join a meeting room by ID |
| `current_users` | Server -> Client | Sends roster of active peers in room |
| `user_joined` / `user_left` | Server -> Client | Participant arrival & departure notifications |
| `offer` / `answer` | Bi-directional | WebRTC SDP negotiation for media & screen streams |
| `ice_candidate` | Bi-directional | WebRTC ICE candidate routing |
| `screen_share_status` | Bi-directional | Broadcast presenter status across room |
| `chat_message` | Bi-directional | Real-time in-call text chat |
| `send_reaction` | Bi-directional | Floating emoji reaction broadcast |
| `whiteboard_draw` / `whiteboard_clear` | Bi-directional | Collaborative whiteboard stroke synchronization |
| `create_poll` / `vote_poll` / `end_poll` | Bi-directional | Interactive live polling events |
| `submit_qa` / `upvote_qa` / `answer_qa` | Bi-directional | Live Q&A questions and upvoting |
| `host_action` | Bi-directional | Host moderation commands (`mute_all`, `mute_user`, `lock_toggle`, `end_meeting_for_all`) |

---

