import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import Heading from '@tiptap/extension-heading'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Highlight from '@tiptap/extension-highlight'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'

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
    await this.deleteExistingDatabase();
    const db = await this.createDatabase();
    this.db = db;
    console.log('✅ P2P Document Manager initialized successfully');
  }

  private deleteExistingDatabase(): Promise<void> {
    return new Promise((resolve) => {
      const deleteReq = indexedDB.deleteDatabase(P2PDocumentManager.DB_NAME);
      deleteReq.onsuccess = () => {
        console.log('🗑️ Cleared existing database');
        resolve();
      };
      deleteReq.onerror = () => {
        console.warn('Could not delete existing database:', deleteReq.error);
        resolve();
      };
      deleteReq.onblocked = () => {
        console.warn('Database deletion blocked - close other tabs');
        setTimeout(() => resolve(), 1000);
      };
    });
  }

  private createDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(P2PDocumentManager.DB_NAME, 1);
      req.onerror = () => reject(req.error);
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
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }

  async createDocument(user: User, title = 'Untitled Document'): Promise<P2PDocument> {
    if (!this.db) throw new Error('Database not initialized');
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
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const docs = req.result || [];
        docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(docs);
      };
      req.onerror = () => reject(req.error);
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

  generateShareLink(shareCode: string): string {
    return `${window.location.origin}?share=${shareCode}`;
  }
}



export class P2PCollaborativeEditor {
  private ydoc: Y.Doc;
  private editor: Editor | null = null;
  private webrtcProvider: WebrtcProvider | null = null;
  private indexedDbProvider: IndexeddbPersistence | null = null;
  private currentDocument: P2PDocument | null = null;
  private user: User | null = null;
  private documentManager: P2PDocumentManager;

  constructor() {
    this.ydoc = new Y.Doc();
    this.documentManager = P2PDocumentManager.getInstance();
  }

  async initialize(documentId: string, user: User, container: HTMLElement) {
    this.user = user;

    let document = await this.documentManager.getDocument(documentId);
    if (!document) {
      document = await this.documentManager.getDocumentByShareCode(documentId);
      if (!document) throw new Error('Document not found');
    }
    this.currentDocument = document;

    const roomId = document.shareCode;

    // IndexedDB persistence
    this.indexedDbProvider = new IndexeddbPersistence(roomId, this.ydoc);
    await new Promise<void>((resolve) => {
      this.indexedDbProvider!.once('synced', () => resolve());
    });

    // WebRTC provider
    this.webrtcProvider = new WebrtcProvider(roomId, this.ydoc, {
      signaling: ['ws://localhost:4444'],
      password: `p2p-${roomId}`,
      maxConns: 20,
      filterBcConns: false,
    });

    this.webrtcProvider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      picture: user.picture,
      color: this.getUserColor(user.id),
    });

    // Initialize TipTap editor with all extensions
    this.editor = new Editor({
      element: container,
      extensions: [
        StarterKit.configure({
          heading: false, // We'll use the separate Heading extension
        }),
        Heading.configure({
          levels: [1, 2, 3],
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Superscript,
        Subscript,
        Highlight.configure({
          multicolor: true,
        }),
        Collaboration.configure({ 
          document: this.ydoc 
        }),
        CollaborationCursor.configure({
          provider: this.webrtcProvider,
          user: {
            name: user.name,
            color: this.getUserColor(user.id),
            picture: user.picture,
          },
        }),
      ],
      content: '<p>Start writing...</p>',
      autofocus: true,
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
          style: 'padding: 20px; min-height: 300px; line-height: 1.6;',
        },
      },
    });

    // Setup toolbar event listeners
    this.setupToolbar();

    console.log('✅ P2P Collaborative Rich-Text Editor initialized');
  }

  private setupToolbar() {
    if (!this.editor) return;

    // Heading selector
    const headingSelect = document.getElementById('heading-select') as HTMLSelectElement;
    if (headingSelect) {
      headingSelect.addEventListener('change', (e) => {
        const level = (e.target as HTMLSelectElement).value;
        if (level === '') {
          this.editor?.chain().focus().setParagraph().run();
        } else {
          this.editor?.chain().focus().toggleHeading({ level: parseInt(level) as any }).run();
        }
      });

      // Update select when editor selection changes
      this.editor.on('selectionUpdate', () => {
        if (this.editor?.isActive('heading', { level: 1 })) {
          headingSelect.value = '1';
        } else if (this.editor?.isActive('heading', { level: 2 })) {
          headingSelect.value = '2';
        } else if (this.editor?.isActive('heading', { level: 3 })) {
          headingSelect.value = '3';
        } else {
          headingSelect.value = '';
        }
      });
    }

    // Command buttons
    const commandButtons = document.querySelectorAll('[data-command]');
    commandButtons.forEach(button => {
      const command = button.getAttribute('data-command');
      if (!command) return;

      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.executeCommand(command);
      });

      // Update button states
      this.editor.on('selectionUpdate', () => {
        this.updateButtonState(button as HTMLElement, command);
      });
    });

    // Custom link button handler
    const linkButton = document.querySelector('[data-command="toggleLink"]');
    if (linkButton) {
      linkButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLinkToggle();
      });
    }
  }

  private executeCommand(command: string) {
    if (!this.editor) return;

    switch (command) {
      case 'toggleBold':
        this.editor.chain().focus().toggleBold().run();
        break;
      case 'toggleItalic':
        this.editor.chain().focus().toggleItalic().run();
        break;
      case 'toggleUnderline':
        this.editor.chain().focus().toggleUnderline().run();
        break;
      case 'toggleStrike':
        this.editor.chain().focus().toggleStrike().run();
        break;
      case 'toggleBulletList':
        this.editor.chain().focus().toggleBulletList().run();
        break;
      case 'toggleOrderedList':
        this.editor.chain().focus().toggleOrderedList().run();
        break;
      case 'toggleCode':
        this.editor.chain().focus().toggleCode().run();
        break;
      case 'setSuperscript':
        this.editor.chain().focus().toggleSuperscript().run();
        break;
      case 'setSubscript':
        this.editor.chain().focus().toggleSubscript().run();
        break;
      case 'alignLeft':
        this.editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        this.editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        this.editor.chain().focus().setTextAlign('right').run();
        break;
    }
  }

  private handleLinkToggle() {
    if (!this.editor) return;

    if (this.editor.isActive('link')) {
      this.editor.chain().focus().unsetLink().run();
    } else {
      const url = prompt('Enter URL:');
      if (url) {
        this.editor.chain().focus().setLink({ href: url }).run();
      }
    }
  }

  private updateButtonState(button: HTMLElement, command: string) {
    if (!this.editor) return;

    let isActive = false;
    
    switch (command) {
      case 'toggleBold':
        isActive = this.editor.isActive('bold');
        break;
      case 'toggleItalic':
        isActive = this.editor.isActive('italic');
        break;
      case 'toggleUnderline':
        isActive = this.editor.isActive('underline');
        break;
      case 'toggleStrike':
        isActive = this.editor.isActive('strike');
        break;
      case 'toggleBulletList':
        isActive = this.editor.isActive('bulletList');
        break;
      case 'toggleOrderedList':
        isActive = this.editor.isActive('orderedList');
        break;
      case 'toggleCode':
        isActive = this.editor.isActive('code');
        break;
      case 'toggleLink':
        isActive = this.editor.isActive('link');
        break;
      case 'setSuperscript':
        isActive = this.editor.isActive('superscript');
        break;
      case 'setSubscript':
        isActive = this.editor.isActive('subscript');
        break;
      case 'alignLeft':
        isActive = this.editor.isActive({ textAlign: 'left' });
        break;
      case 'alignCenter':
        isActive = this.editor.isActive({ textAlign: 'center' });
        break;
      case 'alignRight':
        isActive = this.editor.isActive({ textAlign: 'right' });
        break;
    }

    // Apply active styling
    if (isActive) {
      button.style.backgroundColor = '#3b82f6';
      button.style.color = 'white';
    } else {
      button.style.backgroundColor = '';
      button.style.color = '';
    }
  }

  private getUserColor(userId: string): string {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
      '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
      '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getContent(): string {
    return this.editor?.getHTML() || '';
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
    this.editor?.destroy();
    this.webrtcProvider?.destroy();
    this.indexedDbProvider?.destroy();
    this.ydoc.destroy();
  }
}
