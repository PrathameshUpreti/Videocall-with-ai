const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add middleware to help with WebRTC connections
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve mobile-test.html for testing
app.get('/mobile-test.html', (req, res) => {
  res.sendFile(__dirname + '/mobile-test.html');
});

// Add a route for health checking
app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server running' });
});

// Add a route to check current rooms (helpful for debugging)
app.get('/rooms', (req, res) => {
  const roomsList = Array.from(rooms.entries()).map(([roomId, users]) => ({
    roomId,
    users: Array.from(users.entries()).map(([userId, username]) => ({ userId, username })),
    userCount: users.size
  }));
  res.status(200).json({ rooms: roomsList });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  // These settings are important for mobile connections
  pingTimeout: 60000,   // 60 seconds ping timeout
  pingInterval: 25000,  // 25 seconds ping interval
  transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
  allowUpgrades: true,
  perMessageDeflate: true,
  maxHttpBufferSize: 1e8 // 100 MB
});

// Log all socket connections and disconnections
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.code, err.message, err.context);
});

const rooms = new Map();
const connectionStates = new Map(); // Track connection states

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'from address:', socket.handshake.address);

  // Log client information for debugging
  socket.on('client-info', (info) => {
    console.log('Client info from', socket.id + ':', JSON.stringify(info));
  });

  // Send client info automatically on connection
  if (socket.handshake.query && socket.handshake.query.userAgent) {
    console.log('Client info from handshake:', socket.handshake.query);
  }

  // Add ping/pong handler to check connection
  let lastPong = new Date().getTime();
  const pingInterval = setInterval(() => {
    socket.emit('ping');
    
    // Check if we haven't received a pong in a while
    const now = new Date().getTime();
    if (now - lastPong > 60000) { // 1 minute
      console.log(`Connection to ${socket.id} appears to be lost (no pong)`);
    }
  }, 10000);
  
  socket.on('ping', () => {
    // Reply with pong when we get a ping
    socket.emit('pong');
    lastPong = new Date().getTime();
  });
  
  socket.on('pong', () => {
    lastPong = new Date().getTime();
  });

  socket.on('join-room', ({ roomId, username }) => {
    // Normalize the room ID by removing whitespace
    const normalizedRoomId = roomId.trim();
    
    console.log(`[${socket.id}] Joining room ${normalizedRoomId} as ${username}`);
    
    // Leave any existing rooms
    Array.from(socket.rooms).forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    socket.join(normalizedRoomId);
    
    // Check if this is a new room or existing
    const isNewRoom = !rooms.has(normalizedRoomId);
    if (isNewRoom) {
      console.log(`[${socket.id}] Creating new room: ${normalizedRoomId}`);
      rooms.set(normalizedRoomId, new Map());
    } else {
      console.log(`[${socket.id}] Joining existing room: ${normalizedRoomId}`);
    }
    
    const roomUsers = rooms.get(normalizedRoomId);
    roomUsers.set(socket.id, username);

    // Get all other users in the room
    const usersInRoom = Array.from(roomUsers.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({
        userId: id,
        username: name
      }));

    // Notify the new user about existing users in the room
    if (usersInRoom.length > 0) {
      console.log(`Sending ${usersInRoom.length} users to ${socket.id}`);
      socket.emit('room-users', usersInRoom);
    }

    // Notify others in the room about the new user
    socket.to(normalizedRoomId).emit('user-connected', { 
      userId: socket.id, 
      username 
    });
    
    console.log(`Room ${normalizedRoomId} users:`, Array.from(roomUsers.entries()));
  });

  // Enhanced signal handling for better debugging and reliability
  socket.on('send-signal', ({ userToSignal, signal, from, username }) => {
    console.log(`[${from}] Sending signal to ${userToSignal}, signal type: ${signal.type || 'unknown'}`);
    
    // Log more details about the signal (helpful for debugging)
    if (signal.type === 'offer' || signal.type === 'answer') {
      console.log(`Signal details: ${signal.type} from ${from} to ${userToSignal}`);
    }
    
    // Verify the target user exists before sending
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomId) {
      const roomUsers = rooms.get(roomId);
      if (roomUsers && roomUsers.has(userToSignal)) {
        io.to(userToSignal).emit('user-joined', { 
          signal, 
          from, 
          username 
        });
      } else {
        // Notify sender that target user is not in the room
        socket.emit('signal-error', {
          error: 'User not found in room',
          target: userToSignal
        });
      }
    }
  });

  // Enhanced returning-signal handler
  socket.on('returning-signal', ({ userToSignal, signal, from }) => {
    console.log(`[${from}] Returning signal to ${userToSignal}, signal type: ${signal.type || 'unknown'}`);
    
    // Add more detailed logging
    if (signal.type === 'answer') {
      console.log(`Answer signal from ${from} to ${userToSignal}`);
    }
    
    // Verify the target user exists
    const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomId) {
      const roomUsers = rooms.get(roomId);
      if (roomUsers && roomUsers.has(userToSignal)) {
        io.to(userToSignal).emit('receiving-returned-signal', { 
          signal, 
          from 
        });
      } else {
        socket.emit('signal-error', {
          error: 'User not found in room',
          target: userToSignal
        });
      }
    }
  });

  // Track connection state changes to help diagnose black video issues
  socket.on('connection-status', ({ peerId, status }) => {
    console.log(`Connection status: ${socket.id} -> ${peerId} is ${status}`);
    
    // Store the connection state
    if (!connectionStates.has(socket.id)) {
      connectionStates.set(socket.id, new Map());
    }
    connectionStates.get(socket.id).set(peerId, status);
    
    // Notify the peer about the connection status
    io.to(peerId).emit('peer-connection-status', {
      from: socket.id,
      status
    });
  });

  // Track ICE connection state changes
  socket.on('ice-state-change', ({ state, peerId }) => {
    console.log(`ICE state change: ${socket.id} -> ${peerId}: ${state}`);
    
    // If the state is "connected", send a notification to both peers to check video
    if (state === 'connected' || state === 'completed') {
      // Notify both peers to check and possibly restart video elements
      socket.emit('check-video-display', { peerId });
      io.to(peerId).emit('check-video-display', { peerId: socket.id });
    }
  });

  // Add video stream status tracking to help with black video issues
  socket.on('video-stream-status', ({ peerId, status }) => {
    console.log(`Video stream status: ${socket.id} -> ${peerId}: ${status}`);
    
    // If video is black, notify the peer to try restarting their stream
    if (status === 'black') {
      io.to(peerId).emit('restart-video-stream', { 
        requestedBy: socket.id 
      });
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    // Normalize the room ID here too
    const normalizedRoomId = roomId.trim();
    handleUserLeaving(socket, normalizedRoomId);
  });

  // Add chat message handling
  socket.on('chat-message', ({ roomId, message }) => {
    // Normalize the room ID
    const normalizedRoomId = roomId.trim();
    
    console.log(`[${socket.id}] Sending chat message to room ${normalizedRoomId}`);
    // Forward the message to all users in the room except the sender
    socket.to(normalizedRoomId).emit('chat-message', {
      sender: socket.id,
      message: message
    });
  });

  socket.on('user-joined', data => {
    console.log('User joined event received:', data);
    // Existing code...
  });
  
  socket.on('receiving-signal', data => {
    console.log('Receiving signal from:', data.from);
    // Existing code...
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clear the ping interval
    clearInterval(pingInterval);
    
    // Clean up connection states
    connectionStates.delete(socket.id);
    
    // Clean up all rooms the user was in
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        handleUserLeaving(socket, roomId);
      }
    });
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

function handleUserLeaving(socket, roomId) {
  const roomUsers = rooms.get(roomId);
  if (roomUsers) {
    const username = roomUsers.get(socket.id);
    roomUsers.delete(socket.id);
    
    // Remove room if emm pty
    if (roomUsers.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }

    socket.to(roomId).emit('user-disconnected', { 
      userId: socket.id, 
      username 
    });
    socket.leave(roomId);
    console.log(`User ${username} (${socket.id}) left room ${roomId}`);
    if (roomUsers.size > 0) {
      console.log(`Remaining users in room ${roomId}:`, Array.from(roomUsers.entries()));
    }
  }
}

const PORT = process.env.PORT || 3001;

// Get the local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (let k in interfaces) {
    for (let k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

function startServer(port) {
  try {
    server.listen(port, '0.0.0.0', () => {
      const addresses = getLocalIPs();
      console.log('Available local IPs:', addresses);
      console.log(`Socket.IO server running on port ${port}`);
      console.log(`Access from web browsers using:`);
      console.log(`  - http://localhost:${port}`);
      if (addresses.length > 0) {
        addresses.forEach(ip => {
          console.log(`  - http://${ip}:${port}`);
        });
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    }
  }
}

startServer(PORT);
