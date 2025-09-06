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

  // Version-safe initialization: never downgrade; upgrade only if stores are missing
  async initialize(): Promise<void> {
    const db = await this.openLatest(P2PDocumentManager.DB_NAME);
    if (db.objectStoreNames.contains(P2PDocumentManager.DOC_STORE)) {
      this.attachDb(db);
      return;
    }
    const newVersion = db.version + 1;
    db.close();
    const upgradedDb = await this.upgradeDb(
      P2PDocumentManager.DB_NAME,
      newVersion,
      (upgradeDb) => {
        if (!upgradeDb.objectStoreNames.contains(P2PDocumentManager.DOC_STORE)) {
          const store = upgradeDb.createObjectStore(P2PDocumentManager.DOC_STORE, { keyPath: 'id' });
          if (!store.indexNames.contains('shareCode')) {
            store.createIndex('shareCode', 'shareCode', { unique: true });
          }
          if (!store.indexNames.contains('ownerId')) {
            store.createIndex('ownerId', 'ownerId', { unique: false });
          }
        }
      }
    );
    this.attachDb(upgradedDb);
  }

  private openLatest(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.warn('IndexedDB open blocked; another tab may hold an old connection');
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(P2PDocumentManager.DOC_STORE)) {
          const store = db.createObjectStore(P2PDocumentManager.DOC_STORE, { keyPath: 'id' });
          store.createIndex('shareCode', 'shareCode', { unique: true });
          store.createIndex('ownerId', 'ownerId', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          console.warn('IndexedDB version changed; please reload this tab');
        };
        resolve(db);
      };
    });
  }

  private upgradeDb(name: string, version: number, onUpgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.warn('IndexedDB upgrade blocked; close other tabs using this database');
      req.onupgradeneeded = () => {
        const db = req.result;
        onUpgrade(db);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          console.warn('IndexedDB version changed; please reload this tab');
        };
        resolve(db);
      };
    });
  }

  private attachDb(db: IDBDatabase) {
    this.db = db;
  }

  async createDocument(user: { id: string }, title = 'Untitled Document'): Promise<P2PDocument> {
  const now = new Date(); // ✅ Use Date object instead of string
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
    return doc;
  }

  async getDocument(id: string): Promise<P2PDocument | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
      const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getDocumentByShareCode(shareCode: string): Promise<P2PDocument | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
      const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
      const index = store.index('shareCode');
      const req = index.get(shareCode);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getUserDocuments(userId: string): Promise<P2PDocument[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readonly');
      const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
      const index = store.index('ownerId');
      // Prefer getAll with key; fallback to cursor if needed
      const req = (index.getAll as any)?.call(index, IDBKeyRange.only(userId)) as IDBRequest<P2PDocument[]>;
      if (req) {
        req.onsuccess = () => {
          const rows = req.result || [];
          rows.sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime());
          resolve(rows);
        };
        req.onerror = () => reject(req.error);
      } else {
        const results: P2PDocument[] = [];
        index.openCursor(IDBKeyRange.only(userId)).onsuccess = (e: any) => {
          const cursor = e.target.result as IDBCursorWithValue | null;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            results.sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime());
            resolve(results);
          }
        };
        tx.onerror = () => reject(tx.error);
      }
    });
  }

  async saveDocument(doc: P2PDocument): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readwrite');
      const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
      const payload = { ...doc, updatedAt: new Date().toISOString() };
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
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
      const tx = this.db!.transaction([P2PDocumentManager.DOC_STORE], 'readwrite');
      const store = tx.objectStore(P2PDocumentManager.DOC_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
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
    this.peerId = uuidv4();
    this.documentManager = P2PDocumentManager.getInstance();
  }

  async initialize(documentId: string, user: User): Promise<void> {
    console.log('🔄 Initializing P2P editor for:', documentId);
    this.user = user;

    // Get or create document
    let document = await this.documentManager.getDocument(documentId);
    if (!document) {
      // Try to find by share code
      document = await this.documentManager.getDocumentByShareCode(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
    }

    this.currentDocument = document;

    // Setup editor UI
    this.setupEditor();

    // Initialize Y.js document
    this.ydoc = new Y.Doc();

    // Setup IndexedDB persistence (local storage)
    this.indexedDbProvider = new IndexeddbPersistence(documentId, this.ydoc);

    // Wait for local document to load
    await new Promise<void>(resolve => {
      this.indexedDbProvider!.once('synced', () => {
        console.log('📦 Document loaded from local storage');
        resolve();
      });
    });

    // Setup WebRTC provider for P2P collaboration
    this.webrtcProvider = new WebrtcProvider(documentId, this.ydoc, {
      signaling: ['ws://localhost:3003/signal'],
      password: `p2p-${documentId}`,
      maxConns: 20,
      filterBcConns: false
    });

    // Setup collaborative text
    this.setupCollaborativeText();

    // Connect to signaling server
    this.connectToSignalingServer();

    console.log('✅ P2P editor initialized');
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

  private setupCollaborativeText(): void {
    if (!this.ydoc || !this.textArea) return;

    const ytext = this.ydoc.getText('content');

    // Initialize textarea with Y.js content
    this.textArea.value = ytext.toString();
    this.updateWordCount();

    // Listen for Y.js changes and update textarea
    ytext.observe(event => {
      const currentContent = this.textArea!.value;
      const newContent = ytext.toString();
      
      if (currentContent !== newContent) {
        const cursorPos = this.textArea!.selectionStart;
        this.textArea!.value = newContent;
        
        // Restore cursor position (simple approach)
        this.textArea!.setSelectionRange(cursorPos, cursorPos);
        this.updateWordCount();
        this.updateSyncStatus('synced');
      }
    });

    // Listen for textarea changes and update Y.js
    this.textArea.addEventListener('input', (e) => {
      const newContent = this.textArea!.value;
      const currentYContent = ytext.toString();
      
      if (newContent !== currentYContent) {
        // Simple approach: replace entire content
        // In production, you'd want diff-based updates
        ytext.delete(0, ytext.length);
        ytext.insert(0, newContent);
        this.updateSyncStatus('syncing');
      }
    });
  }

  private connectToSignalingServer(): void {
    const wsUrl = 'ws://localhost:3003/signal';
    console.log('📡 Connecting to signaling server:', wsUrl);

    this.signalingWs = new WebSocket(wsUrl);

    this.signalingWs.onopen = () => {
      console.log('📡 Connected to signaling server');
      this.isConnected = true;
      this.updateP2PStatus('Connected to peers');

      // Join document room
      this.signalingWs!.send(JSON.stringify({
        type: 'join_document',
        documentId: this.currentDocument!.id,
        peerId: this.peerId,
        peerInfo: {
          id: this.user!.id,
          name: this.user!.name,
          email: this.user!.email,
          picture: this.user!.picture
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
    };

    this.signalingWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSignalingMessage(message);
      } catch (error) {
        console.error('Error parsing signaling message:', error);
      }
    };

    this.signalingWs.onclose = () => {
      console.log('📡 Disconnected from signaling server');
      this.isConnected = false;
      this.updateP2PStatus('Disconnected - Working offline');
      
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          this.connectToSignalingServer();
        }
      }, 3000);
    };

    this.signalingWs.onerror = (error) => {
      console.error('Signaling server error:', error);
      this.updateP2PStatus('Connection error');
    };
  }

  private handleSignalingMessage(message: any): void {
    switch (message.type) {
      case 'existing_peers':
        console.log('👥 Found existing peers:', message.peers.length);
        this.updatePeerCount(message.peers.length);
        break;
        
      case 'peer_joined':
        console.log('👤 Peer joined:', message.peerInfo.name);
        this.collaborators.set(message.peerId, message.peerInfo);
        this.updatePeerCount(this.collaborators.size);
        this.showNotification(`${message.peerInfo.name} joined`);
        break;
        
      case 'peer_left':
        console.log('👤 Peer left:', message.peerId);
        this.collaborators.delete(message.peerId);
        this.updatePeerCount(this.collaborators.size);
        break;
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