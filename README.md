# VIT Connect - Secure Audio-Video Conferencing System

Welcome to **VIT Connect**, a premium, high-performance real-time audio-video conferencing platform. This project integrates modern WebRTC-based communication, custom UDP conferencing capabilities, a Flask-based backend server, and a sleek React-based dashboard UI styled with Tailwind CSS and Framer Motion.

---

## 🚀 Key Features

* **Real-Time Video & Audio:** Peer-to-peer HD video and audio communication powered by WebRTC.
* **Socket.IO Signaling:** Instant signaling protocol for WebRTC connection setup (`offer`, `answer`, `ice_candidate`).
* **Multi-Threaded UDP Conferencing:** An alternative high-performance UDP-based conferencing daemon supporting broadcast messaging, room joins, and ping/pong heartbeat synchronization.
* **Secure Authentication:** JWT-based user register/login mechanisms with route protection in the React application.
* **Live Meeting Chat:** Interactive text chat embedded directly inside the conference room UI.
* **Persistent History:** Relational database schemas tracking users, active/inactive meetings, participation timestamps, and persistent text messages.
* **Premium UX/UI:** Responsive layout, seamless navigation transitions, and dark-mode gradients designed to feel modern and professional.

---

## 📁 Project Structure

Currently, the workspace contains a flat directory structure. To run the project correctly without import conflicts, files should be organized into the frontend and backend project structure detailed below.

### Intended Directory Structure

```text
vit-connect/
├── client/                     # Frontend Application (React + Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── ProtectedRoute.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       └── pages/
│           ├── Home.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx
│           ├── CreateMeeting.jsx
│           ├── JoinMeeting.jsx
│           ├── ConferenceRoom.jsx
│           └── NotFound.jsx
│
└── server/                     # Backend Application (Flask + SQLite/MySQL)
    ├── app.py
    ├── config.py
    ├── database.py
    ├── run_servers.py
    ├── requirements.txt
    ├── routes/
    │   ├── __init__.py
    │   ├── auth.py
    │   └── meetings.py
    ├── models/
    │   ├── __init__.py
    │   ├── user.py
    │   ├── meeting.py
    │   ├── participant.py
    │   └── message.py
    ├── events/
    │   ├── __init__.py
    │   └── socket_events.py
    └── networking/
        ├── __init__.py
        ├── udp_server.py
        └── udp_client.py
```

---

## 🛠️ Automated Setup & Organization

To easily organize your flat files into the folders shown above, run the following command in your terminal. We have provided a PowerShell script to set up directories and move the files:

```powershell
# Create Frontend Structure
New-Item -ItemType Directory -Force -Path "src/components", "src/context", "src/pages"

# Move Frontend Files
Move-Item -Path "App.jsx", "main.jsx", "index.css" -Destination "src/" -ErrorAction SilentlyContinue
Move-Item -Path "AuthContext.jsx" -Destination "src/context/" -ErrorAction SilentlyContinue
Move-Item -Path "ProtectedRoute.jsx", "Navbar.jsx" -Destination "src/components/" -ErrorAction SilentlyContinue
Move-Item -Path "Home.jsx", "Login.jsx", "Register.jsx", "Dashboard.jsx", "CreateMeeting.jsx", "JoinMeeting.jsx", "ConferenceRoom.jsx", "NotFound.jsx" -Destination "src/pages/" -ErrorAction SilentlyContinue

# Create Backend Structure
New-Item -ItemType Directory -Force -Path "routes", "models", "events", "networking"

# Move Backend Files
Move-Item -Path "auth.py", "meetings.py" -Destination "routes/" -ErrorAction SilentlyContinue
Move-Item -Path "user.py", "meeting.py", "participant.py", "message.py" -Destination "models/" -ErrorAction SilentlyContinue
Move-Item -Path "socket_events.py" -Destination "events/" -ErrorAction SilentlyContinue
Move-Item -Path "udp_server.py", "udp_client.py" -Destination "networking/" -ErrorAction SilentlyContinue
```

*(Note: Make sure that `__init__.py` files inside `routes/`, `models/`, `events/` and `networking/` export their respective blueprints and schemas).*

---

## 🔌 API Endpoints & Routing

### 🔒 Authentication (`/api/auth`)
* `POST /register`: Registers a new user. Expects `name`, `email`, `password`.
* `POST /login`: Logs in a user. Validates credentials and returns a JWT access token.
* `GET /verify`: Verifies the validity of the current JWT token.
* `POST /logout`: Invalidates session context (Client removes JWT).

### 📞 Meetings & Conference (`/api/meetings`)
* `POST /create`: Creates a new meeting workspace with a title, description, and auto-generated 12-character alphanumeric code.
* `GET /`: Lists all active meetings where the logged-in user is a creator or participant.
* `GET /<meeting_id>`: Retreives specific meeting workspace meta-data.
* `POST /<meeting_id>/join`: Registers a user as a participant inside the meeting database context.
* `POST /<meeting_id>/leave`: Updates left-at timestamp for a participant.
* `GET /<meeting_id>/messages`: Retreives persistent text messages sent during the meeting workspace timeline.

---

## 💬 Websocket (Socket.IO) Events

Socket.IO is mounted on port `5000` (co-hosted with Flask) and handles peer routing signaling packets for WebRTC:

| Event | Direction | Description |
| :--- | :--- | :--- |
| `connect` | Incoming | Triggered when a socket connects. Requires JWT authentication. |
| `join_meeting` | Incoming | Subscribes the socket to a room matching the `meetingId`. |
| `offer` | Bi-directional | Forwards session description protocol (SDP) offer to a remote peer. |
| `answer` | Bi-directional | Forwards SDP answer back to the initiating peer. |
| `ice_candidate` | Bi-directional | Exchanges network ice-candidates between peers. |
| `send_chat` | Incoming | Broadcasts chat messages to all participants in the meeting room. |
| `leave_meeting` | Incoming | Unsubscribes socket from the meeting and signals departure. |
| `disconnect` | Internal | Handles unexpected connection closures and cleans up active room tracking. |

---

## 🛰️ UDP Conferencing Daemon

In addition to standard WebRTC signaling, the application comes with a high-performance UDP audio/video conferencing daemon setup.
* **Server (`udp_server.py`)**: Listens on port `5001`. Manages room associations dynamically using an active client roster.
* **Client (`udp_client.py`)**: Interacts with the server via CLI, sending custom protocol action packets:
  * `join`: Associates client connection with a room ID.
  * `leave`: Disassociates client from the room ID.
  * `broadcast`: Sends text or binary media packets to all other participants in the room.
  * `ping`/`pong`: Keepalive packet checking connection latencies.

---

## 💾 Database Schema (ORM Model)

The database layers are implemented using SQLAlchemy. The tables track user relationships:

```mermaid
erDiagram
    users ||--o{ meetings : "creates"
    users ||--o{ participants : "joins"
    users ||--o{ messages : "writes"
    meetings ||--o{ participants : "contains"
    meetings ||--o{ messages : "logs"

    users {
        string(36) id PK
        string(255) name
        string(255) email UK
        string(255) password_hash
        datetime created_at
        datetime updated_at
    }
    meetings {
        string(36) id PK
        string(255) title
        text description
        string(12) meeting_code UK
        string(36) creator_id FK
        boolean is_active
        datetime created_at
        datetime updated_at
    }
    participants {
        string(36) id PK
        string(36) user_id FK
        string(36) meeting_id FK
        datetime joined_at
        datetime left_at
    }
    messages {
        string(36) id PK
        string(36) author_id FK
        string(36) meeting_id FK
        text content
        datetime created_at
    }
```

---

## 🔧 Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.9 or higher)
* **MySQL Database** (Optional, falls back to SQLite default configuration)

---

### Step 1: Backend Setup
1. Open a terminal in the server directory.
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables in a `.env` file (or let it fallback to default development sqlite credentials):
   ```env
   FLASK_ENV=development
   SECRET_KEY=your-custom-secret-key
   DATABASE_URL=mysql+pymysql://root:password@localhost/vit_connect
   JWT_SECRET_KEY=your-jwt-secret-key
   ```
5. Run the servers:
   ```bash
   python run_servers.py
   ```
   * Flask + WebRTC server runs on: `http://localhost:5000`
   * UDP server runs on: `http://localhost:5001`

---

### Step 2: Frontend Setup
1. Open a terminal in the client directory.
2. Install the node modules:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   * The React app will run on: `http://localhost:3000`
   * Proxy configurations inside `vite.config.js` will automatically redirect `/api` requests and `/socket.io` connections to the Flask backend running on port `5000`.

---

## 🛡️ License

This project is licensed under the MIT License. Feel free to modify and expand for academic or commercial conferencing uses!
