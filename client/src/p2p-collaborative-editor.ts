import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface P2PDocument {
  id: string;
  title: string;
  shareCode: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
}
export interface P2PDocument {
  id: string;
  title: string;
  shareCode: string;
  ownerId: string;
  createdAt: Date | string;  // ✅ Allow both Date and string
  updatedAt: Date | string;  // ✅ Allow both Date and string
  isShared: boolean;
}

// client/src/p2p-collaborative-editor.ts (DocumentManager section)

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface P2PDocument {
  id: string;
  title: string;
  shareCode: string;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isShared: boolean;
}

export class P2PDocumentManager {
  private db: IDBDatabase | null = null;
  private static instance: P2PDocumentManager;
  private static readonly DB_NAME = 'P2PNotebookDB';
  private static readonly DOC_STORE = 'documents';

  static getInstance(): P2PDocumentManager {
    if (!P2PDocumentManager.instance) {
      P2PDocumentManager.instance = new P2PDocumentManager();
    }
    return P2PDocumentManager.instance;
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing P2P Document Manager...');
    
    // Start fresh - delete existing database to avoid version conflicts
    await this.deleteExistingDatabase();
    
    // Create new database with proper schema
    const db = await this.createDatabase();
    this.attachDb(db);
    
    console.log('✅ P2P Document Manager initialized successfully');
  }

  private deleteExistingDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(P2PDocumentManager.DB_NAME);
      
      deleteReq.onsuccess = () => {
        console.log('🗑️ Cleared existing database');
        resolve();
      };
      
      deleteReq.onerror = () => {
        console.warn('Could not delete existing database:', deleteReq.error);
        resolve(); // Continue anyway
      };
      
      deleteReq.onblocked = () => {
        console.warn('Database deletion blocked - close other tabs');
        setTimeout(() => resolve(), 1000); // Continue after timeout
      };
    });
  }

  private createDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(P2PDocumentManager.DB_NAME, 1);
      
      req.onerror = () => {
        console.error('Failed to open database:', req.error);
        reject(req.error);
      };
      
      req.onblocked = () => {
        console.warn('Database creation blocked');
      };
      
      req.onupgradeneeded = (event) => {
        console.log('🔧 Creating database schema...');
        const db = req.result;
        
        // Create documents store with indexes
        if (!db.objectStoreNames.contains(P2PDocumentManager.DOC_STORE)) {
          const store = db.createObjectStore(P2PDocumentManager.DOC_STORE, { 
            keyPath: 'id' 
          });
          
          store.createIndex('shareCode', 'shareCode', { unique: true });
          store.createIndex('ownerId', 'ownerId', { unique: false });
          
          console.log('✅ Created documents store with indexes');
        }
      };
      
      req.onsuccess = () => {
        const db = req.result;
        
        // Handle version changes from other tabs
        db.onversionchange = () => {
          console.warn('Database version changed - closing connection');
          db.close();
        };
        
        console.log('📦 Database opened successfully');
        resolve(db);
      };
    });
  }

  private attachDb(db: IDBDatabase) {
    this.db = db;
  }

  async createDocument(user: User, title = 'Untitled Document'): Promise<P2PDocument> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const now = new Date().toISOString();
    const doc: P2PDocument = {
      id: crypto.randomUUID(),
      title,
      shareCode: crypto.randomUUID().slice(0, 8),
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
      isShared: false
    };

    await this.saveDocument(doc);
    console.log('📄 Created new document:', doc.title);
    return doc;
  }

  async getDocument(id: string): Promise<P2PDocument | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
        const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
        const req = store.get(id);
        
        req.onsuccess = () => {
          resolve(req.result || null);
        };
        
        req.onerror = () => {
          console.error('Error getting document:', req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async getDocumentByShareCode(shareCode: string): Promise<P2PDocument | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
        const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
        const index = store.index('shareCode');
        const req = index.get(shareCode);
        
        req.onsuccess = () => {
          resolve(req.result || null);
        };
        
        req.onerror = () => {
          console.error('Error getting document by share code:', req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async getUserDocuments(userId: string): Promise<P2PDocument[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
        const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
        const index = store.index('ownerId');
        const req = index.getAll(userId);
        
        req.onsuccess = () => {
          const docs = req.result || [];
          // Sort by updated date (newest first)
          docs.sort((a, b) => {
            const dateA = new Date(a.updatedAt).getTime();
            const dateB = new Date(b.updatedAt).getTime();
            return dateB - dateA;
          });
          resolve(docs);
        };
        
        req.onerror = () => {
          console.error('Error getting user documents:', req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error('Transaction error:', error);
        resolve([]); // Return empty array on error
      }
    });
  }

  async saveDocument(doc: P2PDocument): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readwrite');
        const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
        const payload = { ...doc, updatedAt: new Date().toISOString() };
        const req = store.put(payload);
        
        req.onsuccess = () => {
          resolve();
        };
        
        req.onerror = () => {
          console.error('Error saving document:', req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async updateDocumentTitle(id: string, title: string): Promise<void> {
    const doc = await this.getDocument(id);
    if (doc) {
      doc.title = title;
      await this.saveDocument(doc);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readwrite');
        const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
        const req = store.delete(id);
        
        req.onsuccess = () => {
          resolve();
        };
        
        req.onerror = () => {
          console.error('Error deleting document:', req.error);
          reject(req.error);
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  generateShareLink(shareCode: string): string {
    return `${window.location.origin}?share=${shareCode}`;
  }
}


export class P2PCollaborativeEditor {
  private ydoc: Y.Doc | null = null;
  private webrtcProvider: WebrtcProvider | null = null;
  private indexedDbProvider: IndexeddbPersistence | null = null;
  private textArea: HTMLTextAreaElement | null = null;
  private currentDocument: P2PDocument | null = null;
  private user: User | null = null;
  private collaborators: Map<string, any> = new Map();
  private signalingWs: WebSocket | null = null;
  private peerId: string;
  private isConnected: boolean = false;
  private documentManager: P2PDocumentManager;

  constructor() {
    this.peerId = crypto.randomUUID();
    this.documentManager = P2PDocumentManager.getInstance(); // This is already an instance
  }

async initialize(documentId: string, user: User): Promise<void> {
    console.log('🔄 Initializing P2P editor for:', documentId);
    this.user = user;

    // Get or create document
    let document = await this.documentManager.getDocument(documentId);
    if (!document) {
        document = await this.documentManager.getDocumentByShareCode(documentId);
        if (!document) {
        throw new Error('Document not found');
        }
  }
  this.currentDocument = document;
  const roomId = this.currentDocument.shareCode;
  console.log(`🏠 Using room ID for P2P: ${roomId}`);

  // Setup editor UI
  this.setupEditor();

  // Initialize Y.js document
  this.ydoc = new Y.Doc();

  // Setup IndexedDB persistence
  this.indexedDbProvider = new IndexeddbPersistence(roomId, this.ydoc);

  await new Promise<void>(resolve => {
    this.indexedDbProvider!.once('synced', () => {
      console.log('📦 Document loaded from local storage');
      resolve();
    });
  });

  // 🔑 FIX: Use public Y.js signaling servers for WebRTC, not your custom server
  this.webrtcProvider = new WebrtcProvider(roomId, this.ydoc, {
  signaling: ['ws://localhost:4444'],  // Use your server
  password: `p2p-${roomId}`,
  maxConns: 20,
  filterBcConns: false
});

console.log('🔗 Using local signaling server for Yjs WebRTC');

  // Setup awareness for collaborative cursors
  this.webrtcProvider.awareness.setLocalStateField('user', {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    color: this.getUserColor(user.id),
    roomId: roomId
  });

  // Listen for WebRTC provider events
  this.webrtcProvider.on('status', (event: any) => {
    console.log('🔗 WebRTC status:', event.status);
    this.updateConnectionStatus(event.status);
  });

  // Listen for awareness changes (peer join/leave)
  this.webrtcProvider.awareness.on('change', () => {
    this.updateWebRTCCollaborators();
  });

  // Setup collaborative text
  this.setupCollaborativeText();

  // Connect to your signaling server for additional peer discovery
  this.connectToSignalingServer(roomId);

  console.log('✅ P2P editor initialized for room:', roomId);
}
  

// Add this method to P2PCollaborativeEditor
private updateWebRTCCollaborators(): void {
  if (!this.webrtcProvider) return;

  const awarenessStates = this.webrtcProvider.awareness.getStates();
  const peers = Array.from(awarenessStates.entries())
    .filter(([clientId]) => clientId !== this.webrtcProvider!.awareness.clientID)
    .map(([clientId, state]) => ({
      id: clientId.toString(),
      ...state.user
    }))
    .filter(peer => peer.name); // Only peers with user info

  console.log('🎯 WebRTC peers found:', peers.length, peers.map(p => p.name));

  // Update collaborators map
  this.collaborators.clear();
  peers.forEach(peer => {
    this.collaborators.set(peer.id, peer);
  });

  // Update UI
  this.updatePeerCount(peers.length);
  this.renderCollaborators();

  // Update connection status
  if (peers.length > 0) {
    this.updateP2PStatus(`Connected to ${peers.length} peer${peers.length === 1 ? '' : 's'}`);
  } else {
    this.updateP2PStatus('Searching for peers...');
  }
}

private updateConnectionStatus(status: string): void {
  console.log('🔗 WebRTC connection status:', status);
  
  switch (status) {
    case 'connected':
      this.updateP2PStatus('WebRTC Connected');
      break;
    case 'connecting':
      this.updateP2PStatus('Connecting to peers...');
      break;
    case 'disconnected':
      this.updateP2PStatus('Disconnected');
      break;
  }
}
private setupCollaborativeText(): void {
  if (!this.ydoc || !this.textArea) return;

  const ytext = this.ydoc.getText('content');
  console.log('📝 Setting up collaborative text, initial content length:', ytext.length);

  // Initialize textarea with Y.js content
  this.textArea.value = ytext.toString();
  this.updateWordCount();

  // Listen for Y.js changes and update textarea
  ytext.observe(event => {
    console.log('🔄 Y.js text changed, delta length:', event.changes.delta.length);
    
    const currentContent = this.textArea!.value;
    const newContent = ytext.toString();
    
    if (currentContent !== newContent) {
      console.log('📝 Updating textarea with new content');
      const cursorPos = this.textArea!.selectionStart;
      this.textArea!.value = newContent;
      this.textArea!.setSelectionRange(cursorPos, cursorPos);
      this.updateWordCount();
      this.updateSyncStatus('synced');
    }
  });

  // Listen for textarea changes and update Y.js
  let isUpdating = false;
  this.textArea.addEventListener('input', (e) => {
    if (isUpdating) return;
    
    const newContent = this.textArea!.value;
    const currentYContent = ytext.toString();
    
    if (newContent !== currentYContent) {
      console.log('⌨️ Textarea changed, updating Y.js');
      isUpdating = true;
      this.updateSyncStatus('syncing');
      
      // Replace entire content (simple approach)
      ytext.delete(0, ytext.length);
      ytext.insert(0, newContent);
      
      setTimeout(() => {
        this.updateSyncStatus('synced');
        isUpdating = false;
      }, 500);
    }
  });

  console.log('✅ Collaborative text setup complete');
}


  private connectToSignalingServer(roomId: string): void {
    const wsUrl = 'ws://localhost:3003/signal';
    console.log('📡 Connecting to signaling server:', wsUrl);

    this.signalingWs = new WebSocket(wsUrl);

    this.signalingWs.onopen = () => {
      console.log('📡 Connected to signaling server');
      this.isConnected = true;
      this.updateP2PStatus('Connected to peers');

      // 🔑 KEY FIX: Join document room using SHARE CODE
      this.signalingWs!.send(JSON.stringify({
        type: 'join_document',
        documentId: roomId, // Use share code as room identifier
        peerId: this.peerId,
        peerInfo: {
          id: this.user!.id,
          name: this.user!.name,
          email: this.user!.email,
          picture: this.user!.picture,
          roomId: roomId
        }
      }));

      // Send heartbeat every 30 seconds
      setInterval(() => {
        if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
          this.signalingWs.send(JSON.stringify({
            type: 'peer_heartbeat',
            peerId: this.peerId
          }));
        }
      }, 30000);
    }}
private getUserColor(userId: string): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

  private setupEditor(): void {
    const container = document.getElementById('editor');
    if (!container) {
      throw new Error('Editor container not found');
    }

    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; background: white;">
        <!-- Toolbar -->
        <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; gap: 8px; align-items: center;">
          <button id="bold-btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">B</button>
          <button id="italic-btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-style: italic;">I</button>
          <button id="h1-btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">H1</button>
          <button id="h2-btn" style="padding: 6px 12px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">H2</button>
          <div style="flex: 1;"></div>
          <div id="p2p-status" style="font-size: 12px; color: #64748b;">Connecting...</div>
        </div>
        
        <!-- Editor -->
        <textarea id="p2p-textarea" 
          style="flex: 1; border: none; outline: none; padding: 24px; font-size: 16px; font-family: Inter, sans-serif; line-height: 1.6; resize: none;"
          placeholder="Start writing... Changes sync automatically with other peers"></textarea>
          
        <!-- Status Bar -->
        <div style="padding: 8px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; color: #64748b; display: flex; justify-content: space-between;">
          <div id="peer-list">0 peers</div>
          <div>
            <span id="word-count">0 words</span> • 
            <span id="sync-status">Synced locally</span>
          </div>
        </div>
      </div>
    `;

    this.textArea = document.getElementById('p2p-textarea') as HTMLTextAreaElement;

    // Setup toolbar handlers
    document.getElementById('bold-btn')?.addEventListener('click', () => this.formatText('**'));
    document.getElementById('italic-btn')?.addEventListener('click', () => this.formatText('*'));
    document.getElementById('h1-btn')?.addEventListener('click', () => this.insertText('# '));
    document.getElementById('h2-btn')?.addEventListener('click', () => this.insertText('## '));

    // Setup text change handlers
    this.textArea?.addEventListener('input', () => {
      this.updateWordCount();
    });
  }
// Add this inside P2PCollaborativeEditor, alongside other private methods:

/**
 * Updates the peer count display and collaborator avatars in the UI.
 */
private renderCollaborators(): void {
  // Convert the collaborators Map to an array of collaborator objects
  const collaboratorsList = Array.from(this.collaborators.values());

  // Update the peer count text
  const peerCountEl = document.getElementById('peer-list');
  if (peerCountEl) {
    const count = collaboratorsList.length;
    peerCountEl.textContent = `${count} peer${count === 1 ? '' : 's'} connected`;
    peerCountEl.style.color = count > 0 ? '#10b981' : '#64748b';
  }

  // Update the collaborator avatars container (if you have one in your HTML)
  const collaboratorsEl = document.getElementById('collaborators');
  if (collaboratorsEl) {
    collaboratorsEl.innerHTML = collaboratorsList.slice(0, 5).map(collab => `
      <div class="collaborator-avatar"
           style="background-color: ${this.getUserColor(collab.id)}; 
                  color: white; font-size: 10px; display: flex; 
                  align-items: center; justify-content: center; 
                  font-weight: 500; width: 24px; height: 24px; 
                  border-radius: 50%; margin-left: -4px; border: 2px solid white;"
           title="${collab.name} (${collab.email})">
        ${collab.picture
          ? `<img src="${collab.picture}" style="width:100%;height:100%;border-radius:50%">`
          : collab.name.charAt(0).toUpperCase()}
      </div>
    `).join('');

    // If more than 5 peers, show +N
    if (collaboratorsList.length > 5) {
      const extra = collaboratorsList.length - 5;
      collaboratorsEl.innerHTML += `
        <div class="collaborator-avatar" 
             style="background-color:#6b7280; color:white; font-size:10px; 
                    display:flex; align-items:center; justify-content:center; 
                    font-weight:500; width:24px; height:24px; 
                    border-radius:50%; margin-left:-4px; border:2px solid white;"
             title="${extra} more peers">
          +${extra}
        </div>
      `;
    }
  }
}

  private formatText(wrapper: string): void {
    if (!this.textArea) return;

    const start = this.textArea.selectionStart;
    const end = this.textArea.selectionEnd;
    const selectedText = this.textArea.value.substring(start, end);
    
    if (selectedText) {
      const beforeText = this.textArea.value.substring(0, start);
      const afterText = this.textArea.value.substring(end);
      const newText = beforeText + wrapper + selectedText + wrapper + afterText;
      
      this.textArea.value = newText;
      this.textArea.focus();
      this.textArea.setSelectionRange(
        start + wrapper.length, 
        end + wrapper.length
      );
      
      // Trigger input event to sync with Y.js
      this.textArea.dispatchEvent(new Event('input'));
    }
  }

  private insertText(text: string): void {
    if (!this.textArea) return;

    const start = this.textArea.selectionStart;
    const beforeText = this.textArea.value.substring(0, start);
    const afterText = this.textArea.value.substring(start);
    
    this.textArea.value = beforeText + text + afterText;
    this.textArea.focus();
    this.textArea.setSelectionRange(start + text.length, start + text.length);
    
    // Trigger input event to sync with Y.js
    this.textArea.dispatchEvent(new Event('input'));
  }

  private updateWordCount(): void {
    if (!this.textArea) return;

    const text = this.textArea.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    
    const wordCountEl = document.getElementById('word-count');
    if (wordCountEl) {
      wordCountEl.textContent = `${words} words`;
    }
  }

  private updateP2PStatus(status: string): void {
    const statusEl = document.getElementById('p2p-status');
    if (statusEl) {
      statusEl.textContent = status;
    }
  }

  private updateSyncStatus(status: string): void {
    const syncEl = document.getElementById('sync-status');
    if (syncEl) {
      switch (status) {
        case 'syncing':
          syncEl.textContent = 'Syncing...';
          syncEl.style.color = '#f59e0b';
          break;
        case 'synced':
          syncEl.textContent = 'Synced with peers';
          syncEl.style.color = '#10b981';
          break;
        default:
          syncEl.textContent = 'Synced locally';
          syncEl.style.color = '#64748b';
      }
    }
  }

  private updatePeerCount(count: number): void {
    const peerEl = document.getElementById('peer-list');
    if (peerEl) {
      peerEl.textContent = `${count} peer${count === 1 ? '' : 's'} connected`;
    }
  }

  private showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 16px;
      background: #3b82f6;
      color: white;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1001;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Public methods
  getContent(): string {
    return this.textArea?.value || '';
  }

  getCurrentDocument(): P2PDocument | null {
    return this.currentDocument;
  }

  async updateDocumentTitle(title: string): Promise<void> {
    if (this.currentDocument) {
      this.currentDocument.title = title;
      await this.documentManager.saveDocument(this.currentDocument);
    }
  }

  generateShareLink(): string {
    if (!this.currentDocument) return '';
    return this.documentManager.generateShareLink(this.currentDocument.shareCode);
  }

  cleanup(): void {
    console.log('🧹 Cleaning up P2P editor...');

    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }

    if (this.webrtcProvider) {
      this.webrtcProvider.destroy();
      this.webrtcProvider = null;
    }

    if (this.indexedDbProvider) {
      this.indexedDbProvider.destroy();
      this.indexedDbProvider = null;
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    this.collaborators.clear();
    this.isConnected = false;
  }
}