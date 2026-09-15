require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const folderRoutes = require('./routes/folders');
const uploadRoutes = require('./routes/uploads');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/collab-notes';

// ── Connect to MongoDB ───────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('🟢 MongoDB connected successfully:', MONGO_URI);
    // Ensure all existing legacy users created prior to email verification remain verified
    try {
      const result = await mongoose.connection.db.collection('users').updateMany(
        { otp: { $exists: false }, isVerified: { $ne: true } },
        { $set: { isVerified: true } }
      );
      if (result.modifiedCount > 0) {
        console.log(`ℹ️ Marked ${result.modifiedCount} existing legacy user(s) as verified.`);
      }
    } catch (migErr) {
      console.warn('⚠️ Legacy user verification check notice:', migErr.message);
    }
  })
  .catch((err) => {
    console.error('🔴 MongoDB connection error:', err.message);
  });

// ── Middleware ────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Files (Uploads) ────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 404 Handler for API routes ────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔴 Global error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// ── Socket.IO Real-Time Collaboration Setup ───────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Socket.IO authentication middleware (authenticates via JWT sent from frontend getSocket())
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // If no token, allow connection with guest/anonymous or reject
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.sub });
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    };
    next();
  } catch (err) {
    return next(new Error('Invalid or expired authentication token'));
  }
});

// Map of noteId -> Map of socketId -> { socketId, id, username }
const activeRooms = new Map();

const getUniqueActiveUsers = (noteId) => {
  const roomMap = activeRooms.get(noteId);
  if (!roomMap) return [];
  const uniqueUsers = new Map();
  for (const user of roomMap.values()) {
    if (!uniqueUsers.has(user.id)) {
      uniqueUsers.set(user.id, { id: user.id, username: user.username });
    }
  }
  return Array.from(uniqueUsers.values());
};

io.on('connection', (socket) => {
  console.log(`⚡ Socket connected: ${socket.id} (user: ${socket.user?.username || 'unknown'})`);

  // Join a note's collaborative room
  socket.on('join-note', (noteId) => {
    if (!noteId) return;
    socket.join(noteId);

    if (!activeRooms.has(noteId)) {
      activeRooms.set(noteId, new Map());
    }

    activeRooms.get(noteId).set(socket.id, {
      socketId: socket.id,
      id: socket.user.id,
      username: socket.user.username,
    });

    const users = getUniqueActiveUsers(noteId);
    io.to(noteId).emit('active-users', users);
  });

  // Leave a note's room
  socket.on('leave-note', (noteId) => {
    if (!noteId) return;
    socket.leave(noteId);

    if (activeRooms.has(noteId)) {
      const room = activeRooms.get(noteId);
      room.delete(socket.id);
      if (room.size === 0) {
        activeRooms.delete(noteId);
      } else {
        io.to(noteId).emit('active-users', getUniqueActiveUsers(noteId));
      }
    }
  });

  // Live content & title update broadcast
  socket.on('note-update', ({ noteId, content, title }) => {
    if (!noteId) return;
    // Broadcast to everyone in the room except the sender
    socket.to(noteId).emit('note-updated', { content, title });
  });

  // Typing indicators
  socket.on('typing-start', (noteId) => {
    if (!noteId) return;
    socket.to(noteId).emit('user-typing', { username: socket.user.username });
  });

  socket.on('typing-stop', (noteId) => {
    if (!noteId) return;
    socket.to(noteId).emit('user-stopped-typing', { username: socket.user.username });
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    for (const [noteId, room] of activeRooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        if (room.size === 0) {
          activeRooms.delete(noteId);
        } else {
          io.to(noteId).emit('active-users', getUniqueActiveUsers(noteId));
        }
      }
    }
  });
});

// ── Start Server ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 CollabNotes Node.js + Express Backend running on http://localhost:${PORT}`);
});
