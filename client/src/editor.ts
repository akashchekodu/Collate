import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror';
import { keymap } from 'prosemirror-keymap';
import { User } from './auth';

// Extended schema with list support
const mySchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks
});

export class CollaborativeEditor {
  private ydoc: Y.Doc | null = null;
  private provider: WebrtcProvider | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private editorView: EditorView | null = null;
  private currentDocId: string = '';
  private user: User | null = null;
  private autoSaveTimeout: number | null = null;
  private isLiveRoom: boolean = false;
  private isInitializing: boolean = false;

  constructor() {
    // Don't create Y.Doc here - create it in initialize()
  }

  async initialize(documentId: string, initialContent: string, user: User, isLiveRoom: boolean = false) {
    // Prevent concurrent initialization
    if (this.isInitializing) {
      console.warn('Editor initialization already in progress...');
      return;
    }

    this.isInitializing = true;
    
    try {
      this.currentDocId = documentId;
      this.user = user;
      this.isLiveRoom = isLiveRoom || documentId.length === 8;

      console.log(`🎯 Initializing ${this.isLiveRoom ? 'live room' : 'document'}:`, documentId);

      // CRITICAL: Complete cleanup before creating new instances
      await this.cleanup();

      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create fresh Y.Doc for this document/room
      this.ydoc = new Y.Doc();

      // Setup offline persistence
      const persistenceKey = this.isLiveRoom ? `room-${documentId}` : documentId;
      this.persistence = new IndexeddbPersistence(persistenceKey, this.ydoc);
      
      await new Promise<void>(resolve => {
        this.persistence!.once('synced', () => {
          console.log(`📦 ${this.isLiveRoom ? 'Room' : 'Document'} loaded from IndexedDB:`, documentId);
          resolve();
        });
      });

      // Setup WebRTC provider for P2P sync
      this.provider = new WebrtcProvider(documentId, this.ydoc, {
        signaling: ['ws://localhost:4444'],
        password: this.isLiveRoom ? 
          `room-${documentId}` : 
          `notebook-${documentId.substring(0, 8)}`,
        maxConns: this.isLiveRoom ? 50 : 20,
        filterBcConns: false
      });

      // Set user information for awareness
      this.provider.awareness.setLocalStateField('user', {
        name: user.name,
        email: user.email,
        picture: user.picture,
        color: this.getUserColor(user.id),
        colorLight: this.getUserColor(user.id) + '33',
        isRoom: this.isLiveRoom
      });

      // Enhanced connection handling
      this.provider.on('status', (event: any) => {
        console.log(`${this.isLiveRoom ? 'Room' : 'Document'} provider status:`, event.status);
        this.updateConnectionStatus(event.status);
      });

      this.provider.awareness.on('change', () => {
        this.updateCollaborators();
        
        if (this.isLiveRoom) {
          this.handleRoomPeerChange();
        }
      });

      // Initialize the ProseMirror editor
      this.initializeProseMirror(initialContent);

      console.log(`🔗 Collaborative editor initialized for ${this.isLiveRoom ? 'room' : 'document'}:`, documentId);

    } catch (error) {
      console.error('Editor initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private handleRoomPeerChange() {
    if (!this.provider) return;
    
    const peerCount = this.provider.awareness.getStates().size || 0;
    
    if (peerCount === 2) {
      this.showConnectionNotification('Another user joined the room!', 'success');
    }
  }

  private showConnectionNotification(message: string, type: 'success' | 'info' | 'warning') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 8px 12px;
      background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 100);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  private initializeProseMirror(initialContent: string) {
    if (!this.ydoc) {
      console.error('Y.Doc not available for ProseMirror initialization');
      return;
    }

    const editorEl = document.getElementById('editor');
    if (!editorEl) {
      console.error('Editor element not found');
      return;
    }

    // Clear existing editor
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }

    const type = this.ydoc.getXmlFragment('prosemirror');

    // Handle initial content for new documents (not rooms)
    if (!this.isLiveRoom && type.length === 0 && initialContent.trim()) {
      const lines = initialContent.split('\n');
      const tempDiv = document.createElement('div');
      
      lines.forEach(line => {
        if (line.trim()) {
          const p = document.createElement('p');
          p.textContent = line;
          tempDiv.appendChild(p);
        }
      });
      
      const parser = DOMParser.fromSchema(mySchema);
      const doc = parser.parse(tempDiv);
      
      const nodes: any[] = [];
      for (let i = 0; i < doc.content.childCount; i++) {
        nodes.push(doc.content.child(i));
      }
      
      type.insertAfter(null, nodes);
    }

    const state = EditorState.create({
      schema: mySchema,
      plugins: [
        ySyncPlugin(type),
        yCursorPlugin(this.provider!.awareness),
        yUndoPlugin(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
          'Mod-s': () => {
            this.saveDocument();
            return true;
          }
        }),
        ...exampleSetup({ 
          schema: mySchema,
          menuBar: true,
          history: false
        })
      ]
    });

    // Create the editor view with proper transaction handling
    this.editorView = new EditorView(editorEl, {
      state,
      dispatchTransaction: (transaction) => {
        if (!this.editorView) {
          console.warn('EditorView not ready yet');
          return;
        }
        
        const newState = this.editorView.state.apply(transaction);
        this.editorView.updateState(newState);
        
        if (transaction.docChanged) {
          this.scheduleAutoSave();
        }
      }
    });

    this.addCollaborativeCursorStyles();
    console.log(`✅ ProseMirror editor initialized for ${this.isLiveRoom ? 'room' : 'document'}`);
  }

  private addCollaborativeCursorStyles() {
    if (document.getElementById('collaborative-editor-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'collaborative-editor-styles';
    style.textContent = `
      .ProseMirror {
        outline: none;
        padding: 24px;
        font-size: 16px;
        line-height: 1.7;
        color: #374151;
      }
      
      .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
        color: #1f2937;
        font-weight: 600;
        margin: 1.5em 0 0.5em;
      }
      
      .ProseMirror h1 { font-size: 2em; }
      .ProseMirror h2 { font-size: 1.5em; }
      .ProseMirror h3 { font-size: 1.25em; }
      
      .ProseMirror p {
        margin: 1em 0;
      }
      
      .ProseMirror ul, .ProseMirror ol {
        padding-left: 24px;
        margin: 1em 0;
      }
      
      .ProseMirror blockquote {
        margin: 1em 0;
        padding-left: 16px;
        border-left: 4px solid #e5e7eb;
        color: #6b7280;
      }
      
      .ProseMirror code {
        background: #f3f4f6;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
      }
      
      .ProseMirror pre {
        background: #1f2937;
        color: #f9fafb;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 1em 0;
      }
      
      .ProseMirror pre code {
        background: none;
        padding: 0;
        color: inherit;
      }
      
      .ProseMirror .yjs-cursor {
        position: relative;
        margin-left: -1px;
        margin-right: -1px;
        border-left: 2px solid;
        border-color: var(--cursor-color);
        word-break: normal;
        pointer-events: none;
        animation: cursorPulse 2s infinite;
      }
      
      @keyframes cursorPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      .ProseMirror .yjs-cursor > .yjs-cursor-caret {
        position: relative;
        border-left: 2px solid;
        border-color: var(--cursor-color);
        height: 1.2em;
        word-break: normal;
        pointer-events: none;
      }
      
      .ProseMirror .yjs-cursor > .yjs-cursor-caret > .yjs-cursor-info {
        position: absolute;
        top: -28px;
        left: -2px;
        background: var(--cursor-color);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .ProseMirror .yjs-cursor:hover > .yjs-cursor-caret > .yjs-cursor-info,
      .ProseMirror .yjs-cursor.yjs-cursor-active > .yjs-cursor-caret > .yjs-cursor-info {
        opacity: 1;
      }
      
      .ProseMirror .yjs-selection {
        background: var(--selection-color);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  private scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      window.clearTimeout(this.autoSaveTimeout);
    }

    const saveDelay = this.isLiveRoom ? 5000 : 2000;
    
    this.autoSaveTimeout = window.setTimeout(() => {
      this.saveDocument();
    }, saveDelay);
  }

  private async saveDocument() {
    if (!this.currentDocId) return;

    try {
      const content = this.getContent();
      
      if (this.isLiveRoom) {
        const { FileManager } = await import('./fileManager');
        const fileManager = FileManager.getInstance();
        const user = this.user;
        
        if (user) {
          await fileManager.saveRoomContent(this.currentDocId, user.id, content);
          this.showSaveStatus('saved');
          console.log('📄 Room content saved to local history');
        }
      } else {
        const { FileManager } = await import('./fileManager');
        const fileManager = FileManager.getInstance();
        
        await fileManager.updateDocument(this.currentDocId, {
          content: content
        });
        
        this.showSaveStatus('saved');
        console.log('📄 Document auto-saved');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      this.showSaveStatus('error');
    }
  }

  private showSaveStatus(status: 'saving' | 'saved' | 'error') {
    const statusEl = document.getElementById('save-status');
    if (statusEl) {
      switch (status) {
        case 'saving':
          statusEl.textContent = 'Saving...';
          statusEl.style.color = '#f59e0b';
          break;
        case 'saved':
          statusEl.textContent = this.isLiveRoom ? 'Synced' : 'Saved';
          statusEl.style.color = '#10b981';
          break;
        case 'error':
          statusEl.textContent = 'Save failed';
          statusEl.style.color = '#ef4444';
          break;
      }
      
      setTimeout(() => {
        if (statusEl.textContent !== 'Saving...') {
          statusEl.textContent = '';
        }
      }, 1500);
    }
  }

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

  private updateConnectionStatus(status: string) {
    const statusEl = document.getElementById('connection-status');
    const indicatorEl = document.querySelector('.status-indicator') as HTMLElement;
    
    if (!statusEl || !indicatorEl) return;

    switch (status) {
      case 'connected':
        statusEl.textContent = this.isLiveRoom ? 'Room Connected' : 'Connected';
        statusEl.style.color = '#10b981';
        indicatorEl.style.backgroundColor = '#10b981';
        break;
      case 'connecting':
        statusEl.textContent = this.isLiveRoom ? 'Joining Room...' : 'Connecting...';
        statusEl.style.color = '#f59e0b';
        indicatorEl.style.backgroundColor = '#f59e0b';
        break;
      default:
        statusEl.textContent = 'Offline';
        statusEl.style.color = '#ef4444';
        indicatorEl.style.backgroundColor = '#ef4444';
    }
  }

  private updateCollaborators() {
    if (!this.provider) return;

    const collaboratorsEl = document.getElementById('collaborators');
    const peerCountEl = document.getElementById('peer-count');
    
    if (!collaboratorsEl || !peerCountEl) return;

    const states = this.provider.awareness.getStates();
    const peers = Array.from(states.entries())
      .filter(([clientId]) => clientId !== this.provider!.awareness.clientID)
      .map(([_, state]) => state.user)
      .filter(user => user);

    const displayLimit = this.isLiveRoom ? 8 : 5;
    
    collaboratorsEl.innerHTML = peers.slice(0, displayLimit).map(user => `
      <div class="collaborator-avatar" 
           style="background-color: ${user.color}; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; ${this.isLiveRoom ? 'border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : ''}"
           title="${user.name} (${user.email})${this.isLiveRoom ? ' - In Room' : ''}">
        ${user.picture ? 
          `<img src="${user.picture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : 
          user.name.charAt(0).toUpperCase()
        }
      </div>
    `).join('');

    if (peers.length > displayLimit) {
      collaboratorsEl.innerHTML += `
        <div class="collaborator-avatar" 
             style="background-color: #6b7280; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; ${this.isLiveRoom ? 'border: 2px solid white;' : ''}"
             title="${peers.length - displayLimit} more ${this.isLiveRoom ? 'in room' : 'collaborators'}">
          +${peers.length - displayLimit}
        </div>
      `;
    }

    const peerText = this.isLiveRoom ? 
      `${peers.length} in room` : 
      `${peers.length} peer${peers.length === 1 ? '' : 's'}`;
    peerCountEl.textContent = peerText;
  }

  getContent(): string {
    if (!this.editorView) return '';
    
    const doc = this.editorView.state.doc;
    let content = '';
    
    doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph') {
        content += node.textContent + '\n\n';
      } else if (node.type.name === 'heading') {
        const level = '#'.repeat(node.attrs.level);
        content += level + ' ' + node.textContent + '\n\n';
      } else if (node.type.name === 'code_block') {
        content += '```\n' + node.textContent + '\n```\n\n';
      } else if (node.type.name === 'blockquote') {
        content += '> ' + node.textContent + '\n\n';
      }
    });
    
    return content.trim();
  }

  insertContent(content: string) {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    const { selection } = state;
    
    const transaction = state.tr.insertText(content, selection.from, selection.to);
    this.editorView.dispatch(transaction);
  }

  focus() {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  getStats() {
    const content = this.getContent();
    const text = content.replace(/[#>*`\-\[\]]/g, '').trim();
    const words = text.split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

    return {
      words,
      characters,
      charactersNoSpaces,
      paragraphs,
      readingTime: Math.ceil(words / 200),
      isLiveRoom: this.isLiveRoom,
      roomId: this.isLiveRoom ? this.currentDocId : null
    };
  }

  exportAsMarkdown(): string {
    return this.getContent();
  }

  exportAsHtml(): string {
    if (!this.editorView) return '';
    
    const content = this.getContent();
    return content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\n\n/g, '</p>\n<p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  exportAsPlainText(): string {
    if (!this.editorView) return '';
    return this.editorView.state.doc.textContent;
  }

  async cleanup() {
    console.log(`🧹 Cleaning up ${this.isLiveRoom ? 'room' : 'document'} editor...`);
    
    if (this.autoSaveTimeout) {
      window.clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }

    // Properly destroy provider
    if (this.provider) {
      try {
        this.provider.destroy();
      } catch (error) {
        console.warn('Provider cleanup error (non-critical):', error);
      }
      this.provider = null;
    }

    // Properly destroy persistence
    if (this.persistence) {
      try {
        this.persistence.destroy();
      } catch (error) {
        console.warn('Persistence cleanup error (non-critical):', error);
      }
      this.persistence = null;
    }

    // Properly destroy editor
    if (this.editorView) {
      try {
        this.editorView.destroy();
      } catch (error) {
        console.warn('EditorView cleanup error (non-critical):', error);
      }
      this.editorView = null;
    }

    // Destroy Y.Doc
    if (this.ydoc) {
      try {
        this.ydoc.destroy();
      } catch (error) {
        console.warn('Y.Doc cleanup error (non-critical):', error);
      }
      this.ydoc = null;
    }

    this.currentDocId = '';
    this.user = null;
    this.isLiveRoom = false;
  }

  async switchDocument(newDocId: string, newContent: string, user: User, isLiveRoom: boolean = false) {
    console.log(`📄 Switching to ${isLiveRoom ? 'room' : 'document'}:`, newDocId);
    await this.initialize(newDocId, newContent, user, isLiveRoom);
  }
}