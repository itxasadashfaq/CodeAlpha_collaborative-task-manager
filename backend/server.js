require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initDb } = require('./db');

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const boardsRouter = require('./routes/boards');
const notificationsRouter = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: '*', // In development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/notifications', notificationsRouter);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Share socket instance with express routes
app.set('io', io);

// Initialize Socket event handlers
require('./sockets/socketHandler')(io);

// Server entry point and database initialization
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
