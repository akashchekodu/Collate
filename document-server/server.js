import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/collaborate'
});

// SQLite Database Setup
const db = new sqlite3.Database('./documents.db');

// Initialize database
db.serialize(() => {
  // Documents table
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      owner_id TEXT NOT NULL,
      share_code TEXT UNIQUE,
      is_public BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Collaborators table
  db.run(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      user_picture TEXT,
      permission TEXT DEFAULT 'edit',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents (id)
    )
  `);
});

// Connected clients tracking
const documentRooms = new Map(); // documentId -> Set of WebSocket connections
const userSessions = new Map(); // userId -> { ws, user, documentId }

// API Routes

// Create a new document
app.post('/api/documents', async (req, res) => {
  try {
    const { title, content = '', userId, userName, userEmail, userPicture } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const documentId = uuidv4();
    const shareCode = uuidv4().substring(0, 8);

    db.run(
      'INSERT INTO documents (id, title, content, owner_id, share_code, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [documentId, title || 'Untitled Document', content, userId, shareCode, 1],
      function(err) {
        if (err) {
          console.error('Error creating document:', err);
          return res.status(500).json({ error: 'Failed to create document' });
        }

        // Add creator as collaborator
        db.run(
          'INSERT INTO collaborators (document_id, user_id, user_name, user_email, user_picture, permission) VALUES (?, ?, ?, ?, ?, ?)',
          [documentId, userId, userName, userEmail, userPicture, 'owner'],
          (err) => {
            if (err) console.error('Error adding creator as collaborator:', err);
          }
        );

        res.json({
          id: documentId,
          title: title || 'Untitled Document',
          content,
          shareCode,
          ownerId: userId,
          isPublic: true,
          userPermission: 'owner',
          collaborators: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    console.error('Error in document creation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's documents
app.get('/api/documents/user/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT d.*, c.permission 
     FROM documents d 
     JOIN collaborators c ON d.id = c.document_id 
     WHERE c.user_id = ? 
     ORDER BY d.updated_at DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching user documents:', err);
        return res.status(500).json({ error: 'Failed to fetch documents' });
      }

      const documents = rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        ownerId: row.owner_id,
        shareCode: row.share_code,
        isPublic: row.is_public === 1,
        permission: row.permission,
        userPermission: row.permission,
        collaborators: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      res.json(documents);
    }
  );
});

// Get document by ID or share code
app.get('/api/documents/:idOrCode', (req, res) => {
  const { idOrCode } = req.params;
  const { userId } = req.query;

  console.log(`Fetching document: ${idOrCode} for user: ${userId}`);

  // Try to find by ID first, then by share code
  db.get(
    'SELECT * FROM documents WHERE id = ? OR share_code = ?',
    [idOrCode, idOrCode],
    (err, document) => {
      if (err) {
        console.error('Error fetching document:', err);
        return res.status(500).json({ error: 'Failed to fetch document' });
      }

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if user has access
      db.get(
        'SELECT * FROM collaborators WHERE document_id = ? AND user_id = ?',
        [document.id, userId],
        (err, collaborator) => {
          if (err) {
            console.error('Error checking access:', err);
            return res.status(500).json({ error: 'Access check failed' });
          }

          // If not a collaborator and document is not public, deny access
          if (!collaborator && !document.is_public) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Get all collaborators for this document
          db.all(
            'SELECT user_id, user_name, user_email, user_picture, permission FROM collaborators WHERE document_id = ?',
            [document.id],
            (err, collaborators) => {
              if (err) console.error('Error fetching collaborators:', err);

              res.json({
                id: document.id,
                title: document.title,
                content: document.content,
                ownerId: document.owner_id,
                shareCode: document.share_code,
                isPublic: document.is_public === 1,
                collaborators: collaborators || [],
                userPermission: collaborator?.permission || 'edit',
                createdAt: document.created_at,
                updatedAt: document.updated_at
              });
            }
          );
        }
      );
    }
  );
});

// Update document - FIXED VERSION
app.put('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, userId } = req.body;

  console.log(`Updating document ${id} by user ${userId}`);
  console.log('Update data:', { title: title || 'no title change', content: content ? `${content.length} chars` : 'no content change' });

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Check if user has edit permission
  db.get(
    'SELECT permission FROM collaborators WHERE document_id = ? AND user_id = ?',
    [id, userId],
    (err, collaborator) => {
      if (err) {
        console.error('Error checking permission:', err);
        return res.status(500).json({ error: 'Permission check failed' });
      }

      if (!collaborator) {
        return res.status(403).json({ error: 'No access to document' });
      }

      if (collaborator.permission !== 'edit' && collaborator.permission !== 'owner') {
        return res.status(403).json({ error: 'No edit permission' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
      }

      if (content !== undefined) {
        updates.push('content = ?');
        values.push(content);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id); // for WHERE clause

      const query = `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`;

      db.run(query, values, function(err) {
        if (err) {
          console.error('Error updating document:', err);
          return res.status(500).json({ error: 'Failed to update document' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Document not found' });
        }

        console.log(`✅ Document ${id} updated successfully`);

        // Broadcast changes to all connected clients
        broadcastToDocument(id, {
          type: 'document_updated',
          documentId: id,
          title,
          content,
          userId,
          timestamp: new Date().toISOString()
        });

        res.json({ success: true });
      });
    }
  );
});

// Join document as collaborator
app.post('/api/documents/:idOrCode/join', (req, res) => {
  const { idOrCode } = req.params;
  const { userId, userName, userEmail, userPicture } = req.body;

  console.log(`User ${userName} (${userId}) joining document: ${idOrCode}`);

  // Find document
  db.get(
    'SELECT * FROM documents WHERE id = ? OR share_code = ?',
    [idOrCode, idOrCode],
    (err, document) => {
      if (err) {
        console.error('Error finding document:', err);
        return res.status(500).json({ error: 'Failed to find document' });
      }

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if user is already a collaborator
      db.get(
        'SELECT * FROM collaborators WHERE document_id = ? AND user_id = ?',
        [document.id, userId],
        (err, existing) => {
          if (err) {
            console.error('Error checking existing collaborator:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (existing) {
            // User already has access
            console.log(`✅ User ${userName} already has access to document ${document.id}`);
            return res.json({
              id: document.id,
              title: document.title,
              content: document.content,
              ownerId: document.owner_id,
              shareCode: document.share_code,
              isPublic: document.is_public === 1,
              userPermission: existing.permission,
              collaborators: [],
              createdAt: document.created_at,
              updatedAt: document.updated_at
            });
          }

          // Add as new collaborator
          db.run(
            'INSERT INTO collaborators (document_id, user_id, user_name, user_email, user_picture, permission) VALUES (?, ?, ?, ?, ?, ?)',
            [document.id, userId, userName, userEmail, userPicture, 'edit'],
            function(err) {
              if (err) {
                console.error('Error adding collaborator:', err);
                return res.status(500).json({ error: 'Failed to add collaborator' });
              }

              console.log(`✅ User ${userName} added as collaborator to document ${document.id}`);

              // Broadcast new collaborator joined
              broadcastToDocument(document.id, {
                type: 'collaborator_joined',
                documentId: document.id,
                user: { userId, userName, userEmail, userPicture },
                timestamp: new Date().toISOString()
              });

              res.json({
                id: document.id,
                title: document.title,
                content: document.content,
                ownerId: document.owner_id,
                shareCode: document.share_code,
                isPublic: document.is_public === 1,
                userPermission: 'edit',
                collaborators: [],
                createdAt: document.created_at,
                updatedAt: document.updated_at
              });
            }
          );
        }
      );
    }
  );
});

// WebSocket handling for real-time collaboration
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message);
    } catch (error) {
      console.error('Invalid WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    // Remove from all rooms and user sessions
    for (const [documentId, clients] of documentRooms) {
      clients.delete(ws);
      if (clients.size === 0) {
        documentRooms.delete(documentId);
      }
    }

    // Remove from user sessions
    for (const [userId, session] of userSessions) {
      if (session.ws === ws) {
        userSessions.delete(userId);
        break;
      }
    }

    console.log('🔌 WebSocket connection closed');
  });
});

function handleWebSocketMessage(ws, message) {
  const { type, documentId, userId, user } = message;

  switch (type) {
    case 'join_document':
      joinDocument(ws, documentId, userId, user);
      break;
    
    case 'cursor_update':
      broadcastToDocumentExcept(documentId, ws, {
        type: 'cursor_update',
        userId,
        cursor: message.cursor,
        selection: message.selection,
        user
      });
      break;
    
    case 'text_operation':
      // Broadcast text operations to other clients
      broadcastToDocumentExcept(documentId, ws, {
        type: 'text_operation',
        userId,
        content: message.content,
        timestamp: message.timestamp,
        user
      });
      break;
    
    case 'typing_start':
      broadcastToDocumentExcept(documentId, ws, {
        type: 'typing_start',
        userId,
        user
      });
      break;
    
    case 'typing_stop':
      broadcastToDocumentExcept(documentId, ws, {
        type: 'typing_stop',
        userId,
        user
      });
      break;
  }
}

function joinDocument(ws, documentId, userId, user) {
  // Add to document room
  if (!documentRooms.has(documentId)) {
    documentRooms.set(documentId, new Set());
  }
  documentRooms.get(documentId).add(ws);

  // Track user session
  userSessions.set(userId, { ws, user, documentId });

  // Notify others that user joined
  broadcastToDocumentExcept(documentId, ws, {
    type: 'user_joined',
    documentId,
    user
  });

  // Send current collaborators to the new user
  const currentUsers = Array.from(userSessions.values())
    .filter(session => session.documentId === documentId)
    .map(session => session.user);

  ws.send(JSON.stringify({
    type: 'current_collaborators',
    documentId,
    users: currentUsers
  }));

  console.log(`👤 User ${user.name} joined document ${documentId}`);
}

function broadcastToDocument(documentId, message) {
  const clients = documentRooms.get(documentId);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    });
  }
}

function broadcastToDocumentExcept(documentId, excludeWs, message) {
  const clients = documentRooms.get(documentId);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client !== excludeWs && client.readyState === 1) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    });
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`📚 Document server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/collaborate`);
});

export default app;