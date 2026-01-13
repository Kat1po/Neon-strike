const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// IMPORTANT: Use PORT environment variable (Render provides this)
const PORT = process.env.PORT || 3000;

// Serve static files (your HTML, CSS, JS)
app.use(express.static('public'));
app.use(express.json());

// In-memory storage for rooms and users
const rooms = new Map();
const quickPlayQueue = [];

// Simple auth mock (you can integrate real OAuth later)
app.get('/api/auth/user', (req, res) => {
  res.json({ firstName: 'Guest', email: 'guest@example.com' });
});

app.get('/api/login', (req, res) => {
  res.send('Login not implemented yet');
});

app.get('/api/logout', (req, res) => {
  res.redirect('/');
});

// Leaderboard endpoints
const leaderboard = [];

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard.slice(0, 20));
});

app.post('/api/leaderboard/record', (req, res) => {
  const { won, combo } = req.body;
  // Mock implementation
  res.json({ success: true });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    handleDisconnect(ws);
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'create_room':
      createRoom(ws);
      break;
    case 'join_room':
      joinRoom(ws, data.code);
      break;
    case 'quick_play':
      quickPlay(ws);
      break;
    case 'cancel_quick_play':
      cancelQuickPlay(ws);
      break;
    case 'select_mode':
      selectMode(ws, data.mode);
      break;
    case 'select_ability':
      selectAbility(ws, data.ability);
      break;
    case 'start_game':
      startGame(ws);
      break;
    case 'input':
      handleInput(ws, data.keys);
      break;
    case 'dash':
      handleDash(ws);
      break;
    case 'ability':
      handleAbility(ws);
      break;
    case 'leave_room':
      leaveRoom(ws);
      break;
  }
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(ws) {
  const code = generateRoomCode();
  const room = {
    code,
    players: [ws],
    playerIds: { [ws.id = Date.now()]: 1 },
    state: null,
    mode: null
  };
  
  rooms.set(code, room);
  ws.roomCode = code;
  
  ws.send(JSON.stringify({
    type: 'room_created',
    code,
    playerId: 1
  }));
}

function joinRoom(ws, code) {
  const room = rooms.get(code);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }
  
  if (room.players.length >= 2) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room is full'
    }));
    return;
  }
  
  ws.id = Date.now();
  room.players.push(ws);
  room.playerIds[ws.id] = 2;
  ws.roomCode = code;
  
  ws.send(JSON.stringify({
    type: 'room_joined',
    code,
    playerId: 2
  }));
  
  room.players[0].send(JSON.stringify({
    type: 'opponent_joined'
  }));
}

function quickPlay(ws) {
  quickPlayQueue.push(ws);
  
  ws.send(JSON.stringify({
    type: 'quick_searching'
  }));
  
  if (quickPlayQueue.length >= 2) {
    const p1 = quickPlayQueue.shift();
    const p2 = quickPlayQueue.shift();
    
    const code = generateRoomCode();
    const room = {
      code,
      players: [p1, p2],
      playerIds: { [p1.id = Date.now()]: 1, [p2.id = Date.now() + 1]: 2 },
      state: null,
      mode: 'competitive'
    };
    
    rooms.set(code, room);
    p1.roomCode = code;
    p2.roomCode = code;
    
    p1.send(JSON.stringify({
      type: 'quick_matched',
      code,
      playerId: 1
    }));
    
    p2.send(JSON.stringify({
      type: 'quick_matched',
      code,
      playerId: 2
    }));
  }
}

function cancelQuickPlay(ws) {
  const index = quickPlayQueue.indexOf(ws);
  if (index > -1) {
    quickPlayQueue.splice(index, 1);
  }
}

function selectMode(ws, mode) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.mode = mode;
  room.players.forEach(player => {
    player.send(JSON.stringify({
      type: 'mode_selected',
      mode
    }));
  });
}

function selectAbility(ws, ability) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  if (!room.abilities) room.abilities = {};
  room.abilities[ws.id] = ability;
  
  const opponent = room.players.find(p => p !== ws);
  if (opponent) {
    opponent.send(JSON.stringify({
      type: 'opponent_ability_selected'
    }));
  }
  
  if (Object.keys(room.abilities).length === 2) {
    room.players.forEach(player => {
      player.send(JSON.stringify({
        type: 'abilities_ready'
      }));
    });
  }
}

function startGame(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.players.forEach(player => {
    player.send(JSON.stringify({
      type: 'game_started',
      mode: room.mode
    }));
  });
  
  initGameState(room);
}

function initGameState(room) {
  room.state = {
    p1: { x: 250, y: 325, vx: 0, vy: 0, score: 0, radius: 20 },
    p2: { x: 750, y: 325, vx: 0, vy: 0, score: 0, radius: 20 }
  };
}

function handleInput(ws, keys) {
  // Handle player input and update game state
  // This is simplified - you'd need full game logic here
}

function handleDash(ws) {
  // Handle dash action
}

function handleAbility(ws) {
  // Handle ability activation
}

function leaveRoom(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  const opponent = room.players.find(p => p !== ws);
  if (opponent) {
    opponent.send(JSON.stringify({
      type: 'opponent_left'
    }));
  }
  
  rooms.delete(ws.roomCode);
}

function handleDisconnect(ws) {
  leaveRoom(ws);
  cancelQuickPlay(ws);
}

// Start server - CRITICAL: Bind to 0.0.0.0 for Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
