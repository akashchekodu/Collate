import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 4444;
const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebRTC Signaling Server running on ws://localhost:${PORT}`);

const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('New client connected');
  
  let currentRoom = null;
  
  ws.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle room joining
      if (message.type === 'join') {
        currentRoom = message.room;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
        console.log(`Client joined room: ${currentRoom}`);
        return;
      }
      
      // Broadcast to all clients in the same room
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).forEach(function each(client) {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(data);
          }
        });
      }
    } catch (err) {
      console.error('Message handling error:', err);
    }
  });

  ws.on('close', function() {
    console.log('Client disconnected');
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});
