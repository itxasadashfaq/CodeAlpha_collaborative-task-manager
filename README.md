# Task 3: BoardSync (Collaborative Task Manager)

BoardSync is a professional, high-fidelity collaborative project management workspace (Trello/Asana style) built with React and powered by real-time WebSockets synchronization. It supports group workspaces, customizable accent themes, interactive Kanban boards, activity logging, and task assignment details.

---

## 🎨 Design & Experience
* **Design Philosophy:** Sleek Glassmorphism panels, high-contrast dark backgrounds, and visual priority badges.
* **Workspace Themes:** Live customizable accent layouts:
  1. **Royal Indigo:** Elegant purple accents
  2. **Sunset Amber:** Hot orange and red hues
  3. **Emerald Teal:** Fresh green and cyan shades
  4. **Cyberpunk Rose:** Electric pink and magenta
  5. **Electric Blue:** Neon blue elements
* **Responsiveness:** Auto-wrapping task cards, responsive dashboard analytics, and mobile-friendly layouts.

---

## 🛠️ Technology Stack
* **Frontend:**
  * React (v19) using Vite as the bundler.
  * Lucide React for consistent modern icon styling.
  * Custom responsive pure CSS sheets (glass elements, keyframe loading loops).
  * Socket.io-client for real-time WebSocket listening.
* **Backend:**
  * Node.js & Express.js server exposing project, card, activity, and notification REST APIs.
  * Socket.io for managing client rooms, syncing card column relocations, and pushing user-specific alerts.
* **Database & Security:**
  * SQLite3 database storing boards, cards, users, projects, comments, logs, and notification rows.
  * JWT session tokens and BcryptJS login password security.

---

## ✨ Features
1. **Interactive Workspace Hub:**
   * Create, update, and manage multiple group projects.
   * Project status dashboards listing task completion progress bars and stats.
2. **Dynamic Kanban Boards:**
   * Custom categories: **Backlog**, **To Do**, **In Progress**, **Review**, and **Done**.
   * Drag-and-drop or prompt actions to relocate cards in real-time.
   * Add, edit, or delete task cards containing subtasks list, descriptions, priority tags (Low, Medium, High), deadlines, and assignees.
3. **Real-Time WebSockets Collaboration:**
   * Synchronized task moves: when a user relocates or edits a task card, all other users connected to the project board see the change instantly.
   * Activity logs: automatically logs actions (e.g., "Asad created task", "User moved task to Done") in the project log.
   * Instant notifications sent via Socket.io when a user is assigned a task or mentioned.
4. **Task Level Communication:**
   * Contextual comment drawers inside tasks for direct team communication.
   * Nested checklist/subtasks manager with instant completion percentage meters.

---

## 📁 Directory Structure
```text
collaborative-task-manager/
├── backend/                  # Server-side REST API & Socket server
│   ├── database.sqlite       # Relational SQLite database
│   ├── db.js                 # SQLite database query configuration
│   ├── server.js             # Main server execution file
│   ├── middleware/           # JWT and auth verification middleware
│   ├── routes/               # Modular Express routes (auth, boards, projects, notifications)
│   └── sockets/              # Socket.io connection handlers (socketHandler.js)
├── frontend/                 # Client React application
│   ├── index.html            # Entry layout file
│   ├── package.json          # Node scripts and dependencies
│   ├── vite.config.js        # Vite compilation rules
│   └── src/                  # React source files
│       ├── App.jsx           # Root wrapper & Navigation Header
│       ├── App.css           # Grid layouts and structural styles
│       ├── index.css         # Theme palettes and Tailwind-like utility styles
│       ├── components/       # Login, Dashboard, Kanban, and task modals
│       └── context/          # React AuthContext providing user/session states
└── README.md                 # Project main documentation
```

---

## 🚀 Setup & Execution

To run BoardSync, you must execute both the backend server and the frontend client simultaneously.

### 📦 1. Start the Backend API Server
Navigate into the `backend` directory:
```bash
cd backend
npm install
```
Create or configure the `.env` file inside `backend/`:
```env
PORT=5000
JWT_SECRET=super-secret-boardsync-key-5566
```
Start the backend server:
```bash
# Production run
npm start

# Development watch mode
npm run dev
```
The backend API server will list on **http://localhost:5000**.

---

### 💻 2. Start the Frontend React Client
Open a new terminal window/tab and navigate into the `frontend` directory:
```bash
cd frontend
npm install
```
Start the development server:
```bash
npm run dev
```
The React SPA client will start on **http://localhost:5173**. Open this URL in your web browser.

---

## 📡 API Routing Overview
* `POST /api/auth/register` - Create user credentials.
* `POST /api/auth/login` - Obtain JWT access tokens.
* `GET /api/projects` - Get all authorized user projects.
* `POST /api/projects` - Start a new collaborative project.
* `GET /api/boards/:projectId` - Get cards, columns, and history for a project board.
* `POST /api/boards/:projectId/tasks` - Add a new task card to a project.
* `PUT /api/boards/tasks/:taskId` - Update card details (title, priority, deadline, status).
* `POST /api/boards/tasks/:taskId/comments` - Append comments to a task card.
* `GET /api/notifications` - Retrieve incoming notification feed.
