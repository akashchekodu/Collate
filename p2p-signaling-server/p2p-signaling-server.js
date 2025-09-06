import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Create HTTP server
const server = createServer(app);

// WebSocket server for P2P signaling only (no document storage)
const wss = new WebSocketServer({ 
  server,
  path: '/signal'
});

// In-memory tracking for peer discovery (no persistence)
const documentRooms = new Map(); // documentId -> Set of peer connections
const peerSessions = new Map(); // peerId -> { ws, documentId, peerInfo }

console.log('🔄 P2P Signaling Server - NO DATABASE, PURE P2P');

// WebSocket handling for peer signaling and discovery
wss.on('connection', (ws) => {
  console.log('📡 New peer connection for signaling');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleSignalingMessage(ws, message);
    } catch (error) {
      console.error('Invalid signaling message:', error);
    }
  });

  ws.on('close', () => {
    // Remove peer from all rooms
    for (const [documentId, peers] of documentRooms) {
      peers.delete(ws);
      if (peers.size === 0) {
        documentRooms.delete(documentId);
      }
    }

    // Remove from peer sessions
    for (const [peerId, session] of peerSessions) {
      if (session.ws === ws) {
        peerSessions.delete(peerId);
        
        // Notify other peers that this peer disconnected
        if (session.documentId) {
          broadcastToPeers(session.documentId, {
            type: 'peer_left',
            peerId: peerId,
            timestamp: Date.now()
          }, ws);
        }
        break;
      }
    }

    console.log('📡 Peer disconnected from signaling');
  });
});

function handleSignalingMessage(ws, message) {
  const { type, documentId, peerId, peerInfo } = message;

  switch (type) {
    case 'join_document':
      joinDocumentRoom(ws, documentId, peerId, peerInfo);
      break;
    
    case 'webrtc_offer':
    case 'webrtc_answer':
    case 'webrtc_ice_candidate':
      // Relay WebRTC signaling messages between peers
      relaySignalingMessage(message);
      break;
    
    case 'request_document_state':
      // Request full document state from existing peers
      requestDocumentFromPeers(documentId, peerId);
      break;
    
    case 'peer_heartbeat':
      // Keep track of active peers
      updatePeerHeartbeat(peerId);
      break;
  }
}

function joinDocumentRoom(ws, documentId, peerId, peerInfo) {
  // Add to document room
  if (!documentRooms.has(documentId)) {
    documentRooms.set(documentId, new Set());
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
    .map(session => ({
      peerId: Array.from(peerSessions.entries()).find(([id, sess]) => sess === session)?.[0],
      peerInfo: session.peerInfo
    }));

  // Send existing peers to new peer
  ws.send(JSON.stringify({
    type: 'existing_peers',
    documentId,
    peers: existingPeers,
    timestamp: Date.now()
  }));

  // Notify existing peers about new peer
  broadcastToPeers(documentId, {
    type: 'peer_joined',
    documentId,
    peerId,
    peerInfo,
    timestamp: Date.now()
  }, ws);

  console.log(`📡 Peer ${peerInfo.name} joined document room: ${documentId}`);
}

function relaySignalingMessage(message) {
  const { targetPeerId } = message;
  
  if (!targetPeerId) return;
  
  const targetSession = peerSessions.get(targetPeerId);
  if (targetSession) {
    targetSession.ws.send(JSON.stringify(message));
  }
}

function requestDocumentFromPeers(documentId, requestingPeerId) {
  const peers = documentRooms.get(documentId);
  if (!peers) return;

  // Ask any existing peer to send document state
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
  if (!peers) return;

  const messageStr = JSON.stringify(message);
  peers.forEach(peerWs => {
    if (peerWs !== excludeWs && peerWs.readyState === 1) {
      try {
        peerWs.send(messageStr);
      } catch (error) {
        console.error('Error sending to peer:', error);
      }
    }
  });
}

// Cleanup inactive peers every 30 seconds
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute timeout

  for (const [peerId, session] of peerSessions) {
    if (now - session.lastHeartbeat > timeout) {
      console.log(`🧹 Cleaning up inactive peer: ${peerId}`);
      
      // Remove from rooms
      for (const [documentId, peers] of documentRooms) {
        peers.delete(session.ws);
        if (peers.size === 0) {
          documentRooms.delete(documentId);
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
}, 30000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    type: 'P2P Signaling Server',
    activeDocuments: documentRooms.size,
    activePeers: peerSessions.size,
    timestamp: new Date().toISOString()
  });
});

// Server status
app.get('/status', (req, res) => {
  const documents = Array.from(documentRooms.entries()).map(([docId, peers]) => ({
    documentId: docId,
    peerCount: peers.size
  }));

  res.json({
    server: 'P2P Signaling Only - No Document Storage',
    activeDocuments: documents,
    totalPeers: peerSessions.size,
    uptime: process.uptime()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`📡 P2P Signaling server running on http://localhost:${PORT}`);
  console.log(`🔄 WebSocket signaling on ws://localhost:${PORT}/signal`);
  console.log('🚫 NO DATABASE - Pure P2P with browser storage');
});

export default app;