export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  shareCode: string;
  isPublic: boolean;
  collaborators: Collaborator[];
  userPermission: 'owner' | 'edit' | 'view';
  createdAt: string;
  updatedAt: string;
}

export interface Collaborator {
  userId: string;
  userName: string;
  userEmail: string;
  userPicture?: string;
  permission: 'owner' | 'edit' | 'view';
}

export class DocumentAPI {
  private baseUrl = 'http://localhost:3002/api';

  async createDocument(user: User, title: string = 'Untitled Document'): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content: '',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userPicture: user.picture
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create document');
    }

    return response.json();
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    const response = await fetch(`${this.baseUrl}/documents/user/${userId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch documents');
    }

    return response.json();
  }

  async getDocument(idOrCode: string, userId: string): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/documents/${idOrCode}?userId=${userId}`);
    
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error('Document not found');
      }
      if (response.status === 403) {
        throw new Error('Access denied');
      }
      throw new Error(error.error || 'Failed to fetch document');
    }

    return response.json();
  }

  async updateDocument(documentId: string, userId: string, updates: { title?: string; content?: string }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...updates,
        userId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update document');
    }
  }

  async joinDocument(shareCodeOrId: string, user: User): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/documents/${shareCodeOrId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userPicture: user.picture
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error('Document not found');
      }
      if (response.status === 403) {
        throw new Error('Document is private');
      }
      throw new Error(error.error || 'Failed to join document');
    }

    return response.json();
  }
}

export class CollaborativeEditor {
  private documentApi: DocumentAPI;
  private ws: WebSocket | null = null;
  private editorElement: HTMLDivElement | null = null;
  private textArea: HTMLTextAreaElement | null = null;
  private currentDocument: Document | null = null;
  private user: User | null = null;
  private collaborators: Map<string, Collaborator> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private autoSaveTimer: number | null = null;
  private lastSavedContent: string = '';
  private typingUsers: Set<string> = new Set();

  constructor() {
    this.documentApi = new DocumentAPI();
  }

  async initialize(documentId: string, user: User): Promise<void> {
    console.log('🎯 Initializing collaborative editor for:', documentId);
    this.user = user;
    
    try {
      // First, try to get the document (user might already have access)
      try {
        this.currentDocument = await this.documentApi.getDocument(documentId, user.id);
      } catch (error: any) {
        if (error.message === 'Access denied' || error.message === 'Document not found') {
          // Try to join the document using the ID as a share code
          this.currentDocument = await this.documentApi.joinDocument(documentId, user);
        } else {
          throw error;
        }
      }

      // Setup editor
      this.setupEditor();
      
      // Connect to WebSocket for real-time collaboration
      this.connectWebSocket();

      console.log('📄 Collaborative editor initialized for:', this.currentDocument.title);
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      throw error;
    }
  }

  private setupEditor(): void {
    const container = document.getElementById('editor');
    if (!container) {
      throw new Error('Editor container not found');
    }

    // Clear existing content
    container.innerHTML = '';

    // Create editor wrapper
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'collaborative-editor';
    this.editorElement.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
    `;

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    `;

    // Toolbar buttons
    const toolbarButtons = [
      { name: 'Bold', action: () => this.formatText('bold'), style: 'font-weight: bold' },
      { name: 'Italic', action: () => this.formatText('italic'), style: 'font-style: italic' },
      { name: 'H1', action: () => this.insertText('# '), style: 'font-weight: bold; font-size: 18px' },
      { name: 'H2', action: () => this.insertText('## '), style: 'font-weight: bold; font-size: 16px' },
      { name: '•', action: () => this.insertText('- '), style: 'font-weight: bold' },
      { name: '1.', action: () => this.insertText('1. '), style: 'font-weight: bold' }
    ];

    toolbarButtons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.name;
      button.style.cssText = `
        padding: 6px 12px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        ${btn.style};
        transition: all 0.2s;
      `;
      button.addEventListener('mouseenter', () => {
        button.style.background = '#f3f4f6';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'white';
      });
      button.addEventListener('click', btn.action);
      toolbar.appendChild(button);
    });

    // Create text area
    this.textArea = document.createElement('textarea');
    this.textArea.style.cssText = `
      flex: 1;
      border: none;
      outline: none;
      padding: 24px;
      font-size: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      resize: none;
      background: white;
    `;
    this.textArea.placeholder = 'Start writing your document...';

    // Set initial content
    if (this.currentDocument) {
      this.textArea.value = this.currentDocument.content;
      this.lastSavedContent = this.currentDocument.content;
    }

    // Create status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'editor-status';
    statusBar.style.cssText = `
      padding: 8px 16px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 12px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const leftStatus = document.createElement('div');
    leftStatus.id = 'typing-status';
    leftStatus.style.display = 'none';

    const rightStatus = document.createElement('div');
    rightStatus.innerHTML = `
      <span id="word-count">0 words</span> •
      <span id="char-count">0 characters</span> •
      <span id="auto-save-status"></span>
    `;

    statusBar.appendChild(leftStatus);
    statusBar.appendChild(rightStatus);

    // Assemble editor
    this.editorElement.appendChild(toolbar);
    this.editorElement.appendChild(this.textArea);
    this.editorElement.appendChild(statusBar);
    container.appendChild(this.editorElement);

    // Setup event listeners
    this.setupEventListeners();

    // Update word count initially
    this.updateWordCount();

    console.log('✅ Editor setup complete');
  }

  private setupEventListeners(): void {
    if (!this.textArea) return;

    let typingTimer: number | null = null;
    
    this.textArea.addEventListener('input', () => {
      this.handleTextChange();
      this.updateWordCount();
      
      // Send typing indicator
      this.sendTypingStart();
      
      // Clear existing timer and set new one
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => {
        this.sendTypingStop();
      }, 1000);
    });

    this.textArea.addEventListener('selectionchange', () => {
      this.handleSelectionChange();
    });

    // Keyboard shortcuts
    this.textArea.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this.saveDocument();
            break;
          case 'b':
            e.preventDefault();
            this.formatText('bold');
            break;
          case 'i':
            e.preventDefault();
            this.formatText('italic');
            break;
        }
      }
    });
  }

  private formatText(format: string): void {
    if (!this.textArea) return;

    const start = this.textArea.selectionStart;
    const end = this.textArea.selectionEnd;
    const selectedText = this.textArea.value.substring(start, end);
    const beforeText = this.textArea.value.substring(0, start);
    const afterText = this.textArea.value.substring(end);

    let formattedText = selectedText;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
    }

    this.textArea.value = beforeText + formattedText + afterText;
    this.textArea.focus();
    
    // Update selection
    const newStart = start + (format === 'bold' ? 2 : 1);
    const newEnd = newStart + selectedText.length;
    this.textArea.setSelectionRange(newStart, newEnd);
    
    // Trigger change event
    this.handleTextChange();
  }

  private insertText(text: string): void {
    if (!this.textArea) return;

    const start = this.textArea.selectionStart;
    const end = this.textArea.selectionEnd;
    const beforeText = this.textArea.value.substring(0, start);
    const afterText = this.textArea.value.substring(end);

    this.textArea.value = beforeText + text + afterText;
    this.textArea.focus();
    this.textArea.setSelectionRange(start + text.length, start + text.length);
    
    this.handleTextChange();
  }

  private updateWordCount(): void {
    if (!this.textArea) return;

    const text = this.textArea.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = this.textArea.value.length;

    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');

    if (wordCountEl) wordCountEl.textContent = `${words} words`;
    if (charCountEl) charCountEl.textContent = `${chars} characters`;
  }

  private connectWebSocket(): void {
    if (!this.currentDocument || !this.user) return;

    const wsUrl = 'ws://localhost:3002/collaborate';
    console.log('🔌 Connecting to WebSocket:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🔌 Connected to collaboration server');
      this.isConnected = true;
      this.updateConnectionStatus('connected');

      // Join the document room
      this.ws?.send(JSON.stringify({
        type: 'join_document',
        documentId: this.currentDocument!.id,
        userId: this.user!.id,
        user: {
          id: this.user!.id,
          name: this.user!.name,
          email: this.user!.email,
          picture: this.user!.picture
        }
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('🔌 Disconnected from collaboration server');
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus('error');
    };
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'current_collaborators':
        this.updateCollaborators(message.users);
        break;
      
      case 'user_joined':
        this.addCollaborator(message.user);
        this.showNotification(`${message.user.name} joined the document`);
        break;
      
      case 'document_updated':
        if (message.userId !== this.user?.id) {
          this.handleRemoteDocumentUpdate(message);
        }
        break;
      
      case 'cursor_update':
        this.updateRemoteCursor(message);
        break;
      
      case 'typing_start':
        this.showTypingIndicator(message.user);
        break;
      
      case 'typing_stop':
        this.hideTypingIndicator(message.userId);
        break;
    }
  }

  private handleTextChange(): void {
    if (!this.textArea || !this.currentDocument) return;

    // Schedule auto-save
    this.scheduleAutoSave();

    // Send text operation to other users (simple approach)
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'text_operation',
        documentId: this.currentDocument.id,
        userId: this.user!.id,
        content: this.textArea.value,
        timestamp: Date.now()
      }));
    }
  }

  private handleSelectionChange(): void {
    if (!this.textArea || !this.ws || !this.isConnected) return;

    const selectionStart = this.textArea.selectionStart;
    const selectionEnd = this.textArea.selectionEnd;

    this.ws.send(JSON.stringify({
      type: 'cursor_update',
      documentId: this.currentDocument!.id,
      userId: this.user!.id,
      cursor: selectionStart,
      selection: selectionEnd !== selectionStart ? { start: selectionStart, end: selectionEnd } : null,
      user: this.user
    }));
  }

  private sendTypingStart(): void {
    if (this.ws && this.isConnected && this.currentDocument) {
      this.ws.send(JSON.stringify({
        type: 'typing_start',
        documentId: this.currentDocument.id,
        userId: this.user!.id,
        user: this.user
      }));
    }
  }

  private sendTypingStop(): void {
    if (this.ws && this.isConnected && this.currentDocument) {
      this.ws.send(JSON.stringify({
        type: 'typing_stop',
        documentId: this.currentDocument.id,
        userId: this.user!.id,
        user: this.user
      }));
    }
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setTimeout(() => {
      this.saveDocument();
    }, 2000);
  }

  private async saveDocument(): Promise<void> {
    if (!this.textArea || !this.currentDocument || !this.user) return;

    const currentContent = this.textArea.value;
    
    // Only save if content has changed
    if (currentContent === this.lastSavedContent) return;

    try {
      this.showSaveStatus('saving');
      
      await this.documentApi.updateDocument(
        this.currentDocument.id,
        this.user.id,
        { content: currentContent }
      );

      this.lastSavedContent = currentContent;
      this.showSaveStatus('saved');
      
      console.log('📄 Document saved to server');
    } catch (error) {
      console.error('Save failed:', error);
      this.showSaveStatus('error');
    }
  }

  private handleRemoteDocumentUpdate(message: any): void {
    if (!this.textArea || message.userId === this.user?.id) return;

    // Save current cursor position
    const cursorPos = this.textArea.selectionStart;
    
    // Update content
    this.textArea.value = message.content;
    this.lastSavedContent = message.content;
    this.updateWordCount();
    
    // Restore cursor position (simple approach)
    this.textArea.setSelectionRange(cursorPos, cursorPos);

    // Show brief update indicator
    this.showNotification('Document updated');
  }

  private updateCollaborators(users: any[]): void {
    this.collaborators.clear();
    users.forEach(user => {
      if (user.id !== this.user?.id) {
        this.collaborators.set(user.id, {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userPicture: user.picture,
          permission: 'edit'
        });
      }
    });
    this.renderCollaborators();
  }

  private addCollaborator(user: any): void {
    if (user.id !== this.user?.id) {
      this.collaborators.set(user.id, {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userPicture: user.picture,
        permission: 'edit'
      });
      this.renderCollaborators();
    }
  }

  private renderCollaborators(): void {
    const collaboratorsEl = document.getElementById('collaborators');
    const peerCountEl = document.getElementById('peer-count');
    
    if (collaboratorsEl) {
      const collaboratorsList = Array.from(this.collaborators.values());
      
      collaboratorsEl.innerHTML = collaboratorsList.slice(0, 5).map(collab => `
        <div class="collaborator-avatar" 
             style="background-color: ${this.getUserColor(collab.userId)}; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; width: 24px; height: 24px; border-radius: 50%; margin-left: -4px; border: 2px solid white;"
             title="${collab.userName} (${collab.userEmail})">
          ${collab.userPicture ? 
            `<img src="${collab.userPicture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : 
            collab.userName.charAt(0).toUpperCase()
          }
        </div>
      `).join('');

      if (collaboratorsList.length > 5) {
        collaboratorsEl.innerHTML += `
          <div class="collaborator-avatar" 
               style="background-color: #6b7280; color: white; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: 500; width: 24px; height: 24px; border-radius: 50%; margin-left: -4px; border: 2px solid white;"
               title="${collaboratorsList.length - 5} more collaborators">
            +${collaboratorsList.length - 5}
          </div>
        `;
      }
    }

    if (peerCountEl) {
      const count = this.collaborators.size;
      peerCountEl.textContent = `${count} collaborator${count === 1 ? '' : 's'}`;
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

  private updateRemoteCursor(message: any): void {
    // In a full implementation, you'd show cursor positions visually
    console.log(`${message.user.name} cursor at position ${message.cursor}`);
  }

  private showTypingIndicator(user: any): void {
    this.typingUsers.add(user.id);
    this.updateTypingStatus();
  }

  private hideTypingIndicator(userId: string): void {
    this.typingUsers.delete(userId);
    this.updateTypingStatus();
  }

  private updateTypingStatus(): void {
    const statusEl = document.getElementById('typing-status');
    if (!statusEl) return;

    if (this.typingUsers.size === 0) {
      statusEl.style.display = 'none';
      return;
    }

    const typingNames = Array.from(this.typingUsers).map(userId => {
      const collab = this.collaborators.get(userId);
      return collab?.userName || 'Someone';
    });

    let message = '';
    if (typingNames.length === 1) {
      message = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      message = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else {
      message = `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
    }

    statusEl.textContent = message;
    statusEl.style.display = 'block';
  }

  private updateConnectionStatus(status: 'connected' | 'disconnected' | 'error'): void {
    const statusEl = document.getElementById('connection-status');
    const indicatorEl = document.querySelector('.status-indicator') as HTMLElement;
    
    if (statusEl) {
      switch (status) {
        case 'connected':
          statusEl.textContent = 'Connected';
          statusEl.style.color = '#10b981';
          if (indicatorEl) indicatorEl.style.backgroundColor = '#10b981';
          break;
        case 'disconnected':
          statusEl.textContent = 'Disconnected';
          statusEl.style.color = '#ef4444';
          if (indicatorEl) indicatorEl.style.backgroundColor = '#ef4444';
          break;
        case 'error':
          statusEl.textContent = 'Connection Error';
          statusEl.style.color = '#ef4444';
          if (indicatorEl) indicatorEl.style.backgroundColor = '#ef4444';
          break;
      }
    }
  }

  private showSaveStatus(status: 'saving' | 'saved' | 'error'): void {
    const statusEl = document.getElementById('auto-save-status');
    if (statusEl) {
      switch (status) {
        case 'saving':
          statusEl.textContent = 'Saving...';
          statusEl.style.color = '#f59e0b';
          break;
        case 'saved':
          statusEl.textContent = 'Saved';
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.connectWebSocket();
    }, 3000);
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
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(20px)';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Public methods
  getContent(): string {
    return this.textArea?.value || '';
  }

  getCurrentDocument(): Document | null {
    return this.currentDocument;
  }

  async updateDocumentTitle(title: string): Promise<void> {
    if (!this.currentDocument || !this.user) return;

    try {
      await this.documentApi.updateDocument(
        this.currentDocument.id,
        this.user.id,
        { title }
      );
      
      this.currentDocument.title = title;
      console.log('📝 Document title updated');
    } catch (error) {
      console.error('Failed to update title:', error);
      throw error;
    }
  }

  generateShareLink(): string {
    if (!this.currentDocument) return '';
    return `${window.location.origin}?doc=${this.currentDocument.shareCode}`;
  }

  focus(): void {
    if (this.textArea) {
      this.textArea.focus();
    }
  }

  cleanup(): void {
    console.log('🧹 Cleaning up collaborative editor...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.collaborators.clear();
    this.typingUsers.clear();
    this.isConnected = false;
    this.currentDocument = null;
    this.user = null;
  }
}