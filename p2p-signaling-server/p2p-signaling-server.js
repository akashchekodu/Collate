import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Middleware
// Replace your existing CORS configuration with this:
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Handle preflight OPTIONS requests
app.options('*', cors());


app.use(express.json());

// Create HTTP server
const server = createServer(app);

// WebSocket server for P2P signaling only (no document storage)
const wss = new WebSocketServer({ 
  server,
  path: '/signal'
});
// Serve collaboration page
app.get('/collaborate', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Join Collaboration</title>
      <script src="https://unpkg.com/yjs@^13.0.0/dist/yjs.js"></script>
      <script src="https://unpkg.com/y-webrtc@^10.0.0/dist/y-webrtc.js"></script>
    </head>
    <body>
      <h1>Joining Collaborative Session...</h1>
      <div id="editor"></div>
      <script>
        // Extract parameters from URL
        const params = new URLSearchParams(window.location.search);
        const room = params.get('room');
        const token = params.get('token');
        const doc = params.get('doc');
        
        if (room && token) {
          // Initialize Y.js
          const ydoc = new Y.Doc();
          const provider = new WebrtcProvider(room, ydoc, {
            signaling: ['wss://signaling-server-production-af26.up.railway.app/signal?token=' + token]
          });
          
          const ytext = ydoc.getText('content');
          
          // Simple text editor
          const editor = document.getElementById('editor');
          const textarea = document.createElement('textarea');
          textarea.style.width = '100%';
          textarea.style.height = '400px';
          
          textarea.value = ytext.toString();
          
          ytext.observe(() => {
            textarea.value = ytext.toString();
          });
          
          textarea.addEventListener('input', () => {
            const content = textarea.value;
            ytext.delete(0, ytext.length);
            ytext.insert(0, content);
          });
          
          editor.appendChild(textarea);
          
          document.body.innerHTML += '<p>✅ Connected to room: ' + room + '</p>';
        } else {
          document.body.innerHTML = '<p>❌ Invalid collaboration link</p>';
        }
      </script>
    </body>
    </html>
  `);
});

// In-memory tracking for peer discovery (no persistence)
const documentRooms = new Map(); // documentId -> Set of peer connections
const peerSessions = new Map(); // peerId -> { ws, documentId, peerInfo }

console.log('🔄 P2P Signaling Server - NO DATABASE, PURE P2P');

// WebSocket handling for peer signaling and discovery
// Enhanced WebSocket connection with better error logging
wss.on('connection', (ws, request) => {
  console.log('📡 New peer connection attempt');
  
  // Extract token from query params
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  
  console.log('🔍 Token received:', token ? `${token.substring(0, 20)}...` : 'null');
  
  if (!token) {
    console.log('❌ No token provided');
    ws.close(1008, 'Token required');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    ws.authData = decoded;
    console.log('✅ Peer authenticated successfully:', decoded.peerId || 'anonymous');
    console.log('🔐 Token payload:', JSON.stringify(decoded, null, 2));
    
    // Send authentication success message
    ws.send(JSON.stringify({
      type: 'auth_success',
      peerId: decoded.peerId,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    console.log('❌ Token validation failed:', error.message);
    console.log('🔍 Token that failed:', token.substring(0, 50) + '...');
    console.log('🔑 Expected JWT_SECRET prefix:', JWT_SECRET.substring(0, 10) + '...');
    
    ws.close(1008, `Invalid token: ${error.message}`);
    return;
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 Received message:', message.type, 'from peer:', message.peerId);
      handleSignalingMessage(ws, message);
    } catch (error) {
      console.error('Invalid signaling message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid JSON message' 
      }));
    }
  });

  ws.on('close', () => handlePeerDisconnect(ws));
});

function handlePeerDisconnect(ws) {
  console.log('📡 Peer connection closing...');
  
  // Find and remove this peer
  let disconnectedPeerId = null;
  let disconnectedRoom = null;
  
  for (const [peerId, session] of peerSessions) {
    if (session.ws === ws) {
      disconnectedPeerId = peerId;
      disconnectedRoom = session.documentId;
      peerSessions.delete(peerId);
      break;
    }
  }

  // Remove peer from all rooms
  for (const [documentId, peers] of documentRooms) {
    if (peers.delete(ws)) {
      console.log(`🚪 Removed peer from room ${documentId}, ${peers.size} peers remaining`);
      
      // Notify other peers in this room
      if (disconnectedPeerId && peers.size > 0) {
        broadcastToPeers(documentId, {
          type: 'peer_left',
          peerId: disconnectedPeerId,
          timestamp: Date.now()
        }, null);
      }
      
      // Clean up empty rooms
      if (peers.size === 0) {
        documentRooms.delete(documentId);
        console.log(`🗑️ Removed empty room: ${documentId}`);
      }
    }
  }

  if (disconnectedPeerId) {
    console.log(`📡 Peer ${disconnectedPeerId} disconnected from room ${disconnectedRoom}`);
  } else {
    console.log('📡 Unknown peer disconnected');
  }
}

function handleSignalingMessage(ws, message) {
  try {
    const { type, documentId, peerId, peerInfo } = message;

    // Validate required fields
    if (!type) {
      ws.send(JSON.stringify({ type: 'error', message: 'Message type required' }));
      return;
    }

    switch (type) {
      case 'join_document':
        if (!documentId || !peerId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'documentId and peerId required for join_document' 
          }));
          return;
        }
        joinDocumentRoom(ws, documentId, peerId, peerInfo);
        break;
      
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        console.log(`🔄 Relaying ${type} message`);
        relaySignalingMessage(message);
        break;
      
      case 'request_document_state':
        console.log(`📋 Document state requested for room ${documentId}`);
        requestDocumentFromPeers(documentId, peerId);
        break;
      
      case 'peer_heartbeat':
        updatePeerHeartbeat(peerId);
        break;
      
      case 'rotate_document_key':
        handleDKRotation(message);
        break;

      default:
        console.log(`❓ Unknown message type: ${type}`);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: `Unknown message type: ${type}` 
        }));
    }
  } catch (error) {
    console.error('Error handling message:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Server error processing message' 
    }));
  }
}

function joinDocumentRoom(ws, documentId, peerId, peerInfo) {
  console.log(`🏠 Adding peer ${peerInfo?.name || 'Anonymous'} (${peerId}) to room ${documentId}`);
  
  // Add to document room
  if (!documentRooms.has(documentId)) {
    documentRooms.set(documentId, new Set());
    console.log(`🆕 Created new room: ${documentId}`);
  }
  documentRooms.get(documentId).add(ws);

  // Track peer session
  peerSessions.set(peerId, { 
    ws, 
    documentId, 
    peerInfo,
    lastHeartbeat: Date.now()
  });

  // Get list of existing peers in this document
  const existingPeers = Array.from(peerSessions.values())
    .filter(session => session.documentId === documentId && session.ws !== ws)
    .map(session => {
      const sessionPeerId = Array.from(peerSessions.entries())
        .find(([id, sess]) => sess === session)?.[0];
      return {
        peerId: sessionPeerId,
        peerInfo: session.peerInfo
      };
    });

  console.log(`👥 Found ${existingPeers.length} existing peers in room ${documentId}:`, existingPeers.map(p => p.peerInfo?.name));

  // Send existing peers to new peer
  const existingPeersMessage = {
    type: 'existing_peers',
    documentId,
    peers: existingPeers,
    timestamp: Date.now()
  };
  
  console.log(`📤 Sending existing_peers to new peer:`, existingPeersMessage);
  ws.send(JSON.stringify(existingPeersMessage));

  // Notify existing peers about new peer
  if (existingPeers.length > 0) {
    const peerJoinedMessage = {
      type: 'peer_joined',
      documentId,
      peerId,
      peerInfo,
      timestamp: Date.now()
    };
    
    console.log(`📢 Broadcasting peer_joined to ${existingPeers.length} existing peers:`, peerJoinedMessage);
    broadcastToPeers(documentId, peerJoinedMessage, ws);
  } else {
    console.log(`🔇 No existing peers to notify about new peer ${peerInfo?.name || peerId}`);
  }

  // Send success confirmation to joining peer
  ws.send(JSON.stringify({
    type: 'join_success',
    documentId,
    peerId,
    roomSize: documentRooms.get(documentId)?.size || 0,
    timestamp: Date.now()
  }));

  // Log current room state
  const roomSize = documentRooms.get(documentId)?.size || 0;
  console.log(`📊 Room ${documentId} now has ${roomSize} connected peers`);
  console.log(`✅ Peer ${peerInfo?.name || peerId} successfully joined room ${documentId}`);
}

function handleDKRotation(message) {
  const {documentId, newDKEncrypted, revokedPeers = []} = message;

  // Remove revoked peers
  revokedPeers.forEach(peerId => {
    const session = peerSessions.get(peerId);
    if(session) {
      const peers = documentRooms.get(documentId);
      peers?.delete(session.ws);
      peerSessions.delete(peerId);
      if(session.ws.readyState === 1) {
        session.ws.close(1000, 'Access revoked');
      }
    }
  });

  // Send new key to remaining peers
  const peers = documentRooms.get(documentId);
  if(!peers) return;
  
  peers.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'dk_rotation',
        documentId,
        newDKEncrypted,
        timestamp: Date.now()
      }));
    }
  });

  console.log(`🔑 DK rotated for document ${documentId}, revoked:`, revokedPeers);
}

function relaySignalingMessage(message) {
  const { targetPeerId } = message;
  
  if (!targetPeerId) {
    console.log('❌ No targetPeerId in relay message');
    return;
  }
  
  const targetSession = peerSessions.get(targetPeerId);
  if (targetSession) {
    console.log(`📨 Relaying message to peer ${targetPeerId}`);
    targetSession.ws.send(JSON.stringify(message));
  } else {
    console.log(`❌ Target peer ${targetPeerId} not found for relay`);
  }
}

function requestDocumentFromPeers(documentId, requestingPeerId) {
  const peers = documentRooms.get(documentId);
  if (!peers) {
    console.log(`❌ No peers found in room ${documentId} for document request`);
    return;
  }

  console.log(`📋 Requesting document state from peers in room ${documentId}`);
  broadcastToPeers(documentId, {
    type: 'document_state_request',
    requestingPeerId,
    timestamp: Date.now()
  });
}

function updatePeerHeartbeat(peerId) {
  const session = peerSessions.get(peerId);
  if (session) {
    session.lastHeartbeat = Date.now();
  }
}

function broadcastToPeers(documentId, message, excludeWs = null) {
  const peers = documentRooms.get(documentId);
  if (!peers) {
    console.log(`❌ No peers in room ${documentId} to broadcast to`);
    return;
  }

  const messageStr = JSON.stringify(message);
  let successCount = 0;
  let totalPeers = 0;
  
  peers.forEach(peerWs => {
    totalPeers++;
    if (peerWs !== excludeWs && peerWs.readyState === 1) {
      try {
        peerWs.send(messageStr);
        successCount++;
      } catch (error) {
        console.error('Error sending to peer:', error);
      }
    }
  });
  
  console.log(`📡 Broadcast ${message.type} to ${successCount}/${totalPeers} peers in room ${documentId}`);
}

// Enhanced cleanup with logging
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute timeout

  let cleanedCount = 0;
  for (const [peerId, session] of peerSessions) {
    if (now - session.lastHeartbeat > timeout) {
      console.log(`🧹 Cleaning up inactive peer: ${peerId}`);
      cleanedCount++;
      
      // Remove from rooms
      for (const [documentId, peers] of documentRooms) {
        peers.delete(session.ws);
        if (peers.size === 0) {
          documentRooms.delete(documentId);
          console.log(`🗑️ Removed empty room during cleanup: ${documentId}`);
        }
      }
      
      // Remove session
      peerSessions.delete(peerId);
      
      // Close connection
      if (session.ws.readyState === 1) {
        session.ws.close();
      }
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} inactive peers`);
  }
}, 30000);

// Enhanced status endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    type: 'P2P Signaling Server',
    activeDocuments: documentRooms.size,
    activePeers: peerSessions.size,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/status', (req, res) => {
  const documents = Array.from(documentRooms.entries()).map(([docId, peers]) => ({
    documentId: docId,
    peerCount: peers.size,
    peers: Array.from(peerSessions.values())
      .filter(session => session.documentId === docId)
      .map(session => ({
        peerId: Array.from(peerSessions.entries()).find(([id, sess]) => sess === session)?.[0],
        name: session.peerInfo?.name || 'Anonymous',
        lastSeen: new Date(session.lastHeartbeat).toISOString()
      }))
  }));

  res.json({
    server: 'P2P Signaling Only - No Document Storage',
    activeDocuments: documents,
    totalPeers: peerSessions.size,
    uptime: process.uptime(),
    rooms: Array.from(documentRooms.keys())
  });
});

// Generate test JWT endpoint (development only)
// Add this to your p2p-signaling-server.js - BEFORE server.listen()
if (process.env.NODE_ENV !== 'production') {
  app.post('/generate-test-token', (req, res) => {
    const { peerId, documentId } = req.body;
    
    console.log('🔑 Generating test token for:', { peerId, documentId });
    
    const token = jwt.sign({
      peerId: peerId || `test-peer-${Date.now()}`,
      documentId: documentId || 'test-document',
      permissions: ['read', 'write'],
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000)
    }, JWT_SECRET);

    console.log('✅ Generated token successfully');
    res.json({ 
      token, 
      decoded: jwt.decode(token),
      expiresIn: '1 hour'
    });
  });

  // Add a simple GET endpoint for easy testing
  app.get('/generate-test-token/:peerId/:documentId', (req, res) => {
    const { peerId, documentId } = req.params;
    
    const token = jwt.sign({
      peerId,
      documentId,
      permissions: ['read', 'write'],
      exp: Math.floor(Date.now() / 1000) + (60 * 60),
      iat: Math.floor(Date.now() / 1000)
    }, JWT_SECRET);

    res.json({ token, decoded: jwt.decode(token) });
  });
}


// Start server
server.listen(PORT, () => {
  console.log(`📡 P2P Signaling server running on http://localhost:${PORT}`);
  console.log(`🔄 WebSocket signaling on ws://localhost:${PORT}/signal`);
  console.log('🚫 NO DATABASE - Pure P2P with browser storage');
  console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
});

export default app;
