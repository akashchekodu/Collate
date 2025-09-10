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
  private yXmlFragment: Y.XmlFragment | null = null;

  constructor() {
    // Don't create Y.Doc here - create it in initialize()
  }

  async initialize(documentId: string, initialContent: string, user: User, isLiveRoom: boolean = false) {
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

      // Complete cleanup before creating new instances
      await this.cleanup();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create fresh Y.Doc
      this.ydoc = new Y.Doc();

      // Setup persistence
      const persistenceKey = this.isLiveRoom ? `room-${documentId}` : documentId;
      this.persistence = new IndexeddbPersistence(persistenceKey, this.ydoc);
      
      await new Promise<void>(resolve => {
        this.persistence!.once('synced', () => {
          console.log(`📦 ${this.isLiveRoom ? 'Room' : 'Document'} loaded from IndexedDB:`, documentId);
          resolve();
        });
      });

      // Setup WebRTC provider
      this.provider = new WebrtcProvider(documentId, this.ydoc, {
        signaling: ['ws://localhost:4444'],
        password: this.isLiveRoom ? 
          `room-${documentId}` : 
          `notebook-${documentId.substring(0, 8)}`,
        maxConns: this.isLiveRoom ? 50 : 20,
        filterBcConns: false
      });

      // Set user awareness
      this.provider.awareness.setLocalStateField('user', {
        name: user.name,
        email: user.email,
        picture: user.picture,
        color: this.getUserColor(user.id),
        colorLight: this.getUserColor(user.id) + '33',
        isRoom: this.isLiveRoom
      });

      // Connection handling
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

      // Initialize ProseMirror AFTER Y.js is ready
      await this.initializeProseMirror(initialContent);

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
    const peerCount = this.provider.awareness.getStates().size - 1;
    if (peerCount === 1) {
      this.showConnectionNotification('Another user joined the room!', 'success');
    }
  }

  private showConnectionNotification(message: string, type: 'success' | 'info' | 'warning') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 80px; right: 20px; padding: 8px 12px;
      background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white; border-radius: 4px; font-size: 12px; font-weight: 500;
      z-index: 1000; opacity: 0; transition: opacity 0.3s; pointer-events: none;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.style.opacity = '1', 100);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  private async initializeProseMirror(initialContent: string) {
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

    // Get Y.js XML fragment
    this.yXmlFragment = this.ydoc.getXmlFragment('prosemirror');

    // Only set initial content if document is empty
    const isEmpty = this.yXmlFragment.length === 0;
    
    if (isEmpty && !this.isLiveRoom && initialContent.trim()) {
      console.log('📝 Setting initial content for new document');
      
      const tempDiv = document.createElement('div');
      const lines = initialContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        lines.push('');
      }
      
      lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line.trim() || ' ';
        tempDiv.appendChild(p);
      });
      
      const parser = DOMParser.fromSchema(mySchema);
      const doc = parser.parse(tempDiv);
      
      const nodes: any[] = [];
      for (let i = 0; i < doc.content.childCount; i++) {
        nodes.push(doc.content.child(i));
      }
      
      if (nodes.length > 0) {
        this.yXmlFragment.insertAfter(null, nodes);
      }
    }

    // Create ProseMirror state with cursor debugging
    const state = EditorState.create({
      schema: mySchema,
      plugins: [
        ySyncPlugin(this.yXmlFragment),
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

    // 🔍 DEBUGGING: Create EditorView with transaction logging
    this.editorView = new EditorView(editorEl, {
      state,
      dispatchTransaction: (transaction) => {
        if (!this.editorView) return;
        
        // 📊 LOG CURSOR POSITIONS BEFORE TRANSACTION
        const beforeSelection = this.editorView.state.selection;
        const beforeFrom = beforeSelection.from;
        const beforeTo = beforeSelection.to;
        const beforeAnchor = beforeSelection.anchor;
        const beforeHead = beforeSelection.head;
        
        console.log('🔍 BEFORE TRANSACTION:', {
          from: beforeFrom,
          to: beforeTo,
          anchor: beforeAnchor,
          head: beforeHead,
          empty: beforeSelection.empty,
          docChanged: transaction.docChanged,
          selectionSet: transaction.selectionSet,
          transactionSteps: transaction.steps.length
        });
        
        // Apply the transaction
        const newState = this.editorView.state.apply(transaction);
        this.editorView.updateState(newState);
        
        // 📊 LOG CURSOR POSITIONS AFTER TRANSACTION
        const afterSelection = this.editorView.state.selection;
        const afterFrom = afterSelection.from;
        const afterTo = afterSelection.to;
        const afterAnchor = afterSelection.anchor;
        const afterHead = afterSelection.head;
        
        console.log('🔍 AFTER TRANSACTION:', {
          from: afterFrom,
          to: afterTo,
          anchor: afterAnchor,
          head: afterHead,
          empty: afterSelection.empty,
          documentLength: this.editorView.state.doc.content.size
        });
        
        // 🚨 CURSOR POSITION CHANGE DETECTION
        if (beforeFrom !== afterFrom || beforeTo !== afterTo) {
          console.log('🎯 CURSOR MOVED:', {
            fromChange: `${beforeFrom} → ${afterFrom}`,
            toChange: `${beforeTo} → ${afterTo}`,
            anchorChange: `${beforeAnchor} → ${afterAnchor}`,
            headChange: `${beforeHead} → ${afterHead}`
          });
          
          // 🚨 DETECT CURSOR JUMPING TO POSITION 0
          if (afterFrom === 0 && beforeFrom > 0) {
            console.error('🚨 CURSOR JUMPED TO POSITION 0!', {
              previousPosition: beforeFrom,
              transactionMeta: transaction.meta,
              transactionTime: transaction.time,
              isYjsTransaction: transaction.getMeta('y-sync$') !== undefined,
              docChanges: transaction.changes.toString()
            });
          }
        }
        
        // 📝 LOG DOCUMENT CHANGES
        if (transaction.docChanged) {
          console.log('📝 DOCUMENT CHANGED:', {
            contentLength: this.editorView.state.doc.content.size,
            textContent: this.editorView.state.doc.textContent.substring(0, 50) + '...',
            changeCount: transaction.changes.size
          });
          
          this.scheduleAutoSave();
        }
        
        // 🔄 LOG Y.js SYNC TRANSACTIONS
        if (transaction.getMeta('y-sync$')) {
          console.log('🔄 Y.js SYNC TRANSACTION detected:', {
            origin: transaction.getMeta('y-sync$'),
            beforeCursor: beforeFrom,
            afterCursor: afterFrom,
            cursorChanged: beforeFrom !== afterFrom
          });
        }
      }
    });

    // Set up auto-save listener on Y.js document changes
    this.yXmlFragment.observe((event) => {
      console.log('🔄 Y.js FRAGMENT CHANGED:', {
        eventType: event.constructor.name,
        fragmentLength: this.yXmlFragment!.length,
        currentCursor: this.editorView?.state.selection.from || 'no-cursor'
      });
      this.scheduleAutoSave();
    });

    this.addCollaborativeCursorStyles();
    
    // Focus after a brief delay with cursor logging
    setTimeout(() => {
      if (this.editorView) {
        console.log('🎯 FOCUSING EDITOR...');
        this.editorView.focus();
        
        const { doc } = this.editorView.state;
        const endPos = doc.content.size;
        
        console.log('🎯 MOVING CURSOR TO END:', {
          documentSize: doc.content.size,
          targetPosition: endPos,
          currentPosition: this.editorView.state.selection.from
        });
        
        const tr = this.editorView.state.tr.setSelection(
          this.editorView.state.selection.constructor.atEnd(doc)
        );
        this.editorView.dispatch(tr);
        
        console.log('🎯 CURSOR POSITIONED AT:', this.editorView.state.selection.from);
      }
    }, 200);

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
        min-height: 200px;
        cursor: text;
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
      
      /* Y.js collaborative cursors */
      .ProseMirror .yjs-cursor {
        position: relative;
        margin-left: -1px;
        margin-right: -1px;
        border-left: 2px solid;
        border-color: var(--cursor-color);
        word-break: normal;
        pointer-events: none;
      }
      
      .ProseMirror .yjs-cursor::after {
        content: '';
        position: absolute;
        top: 0;
        left: -1px;
        width: 2px;
        height: 1.2em;
        background: var(--cursor-color);
        animation: cursorBlink 1s infinite;
      }
      
      @keyframes cursorBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
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
        z-index: 1000;
      }
      
      .ProseMirror .yjs-cursor:hover > .yjs-cursor-caret > .yjs-cursor-info {
        opacity: 1;
      }
      
      .ProseMirror .yjs-selection {
        background-color: var(--selection-color, rgba(59, 130, 246, 0.2));
        border-radius: 2px;
      }
      
      /* Menu bar */
      .ProseMirror-menubar {
        border-bottom: 1px solid #e5e7eb;
        padding: 8px;
        background: #f8fafc;
        border-radius: 8px 8px 0 0;
      }
      
      .ProseMirror-menubar .ProseMirror-menu {
        margin: 0;
      }
      
      .ProseMirror-menubar .ProseMirror-menuitem {
        margin-right: 4px;
      }
      
      .ProseMirror:focus {
        outline: none;
      }
      
      .ProseMirror ::selection {
        background: rgba(59, 130, 246, 0.2);
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
           style="background-color: ${user.color}; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; width: 24px; height: 24px; border-radius: 50%; margin-left: -4px; border: 2px solid white;"
           title="${user.name} (${user.email})">
        ${user.picture ? 
          `<img src="${user.picture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : 
          user.name.charAt(0).toUpperCase()
        }
      </div>
    `).join('');

    if (peers.length > displayLimit) {
      collaboratorsEl.innerHTML += `
        <div class="collaborator-avatar" 
             style="background-color: #6b7280; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; width: 24px; height: 24px; border-radius: 50%; margin-left: -4px; border: 2px solid white;"
             title="${peers.length - displayLimit} more">
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
    
    doc.descendants((node) => {
      if (node.type.name === 'paragraph') {
        const text = node.textContent.trim();
        content += text + '\n\n';
      } else if (node.type.name === 'heading') {
        const level = '#'.repeat(node.attrs.level);
        content += level + ' ' + node.textContent + '\n\n';
      } else if (node.type.name === 'code_block') {
        content += '```\n' + node.textContent + '\n```\n\n';
      } else if (node.type.name === 'blockquote') {
        content += '> ' + node.textContent + '\n\n';
      } else if (node.type.name === 'bullet_list') {
        node.forEach(listItem => {
          content += '- ' + listItem.textContent + '\n';
        });
        content += '\n';
      } else if (node.type.name === 'ordered_list') {
        let counter = 1;
        node.forEach(listItem => {
          content += `${counter}. ` + listItem.textContent + '\n';
          counter++;
        });
        content += '\n';
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

    if (this.provider) {
      try {
        this.provider.destroy();
      } catch (error) {
        console.warn('Provider cleanup error (non-critical):', error);
      }
      this.provider = null;
    }

    if (this.persistence) {
      try {
        this.persistence.destroy();
      } catch (error) {
        console.warn('Persistence cleanup error (non-critical):', error);
      }
      this.persistence = null;
    }

    if (this.editorView) {
      try {
        this.editorView.destroy();
      } catch (error) {
        console.warn('EditorView cleanup error (non-critical):', error);
      }
      this.editorView = null;
    }

    this.yXmlFragment = null;

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