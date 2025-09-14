import { AuthManager, User } from './auth';
import { P2PDocumentManager, P2PDocument, P2PCollaborativeEditor } from './p2p-collaborative-editor';

// Debug logger utility - same as in auth.ts
class DebugLogger {
  private static prefix = '🚀 P2P-DEBUG';
  
  static log(section: string, message: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${this.prefix} [${timestamp}] [${section}] ${message}`, data || '');
  }
  
  static error(section: string, message: string, error?: any) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`${this.prefix} [${timestamp}] [${section}] ERROR: ${message}`, error || '');
  }
  
  static warn(section: string, message: string, data?: any) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.warn(`${this.prefix} [${timestamp}] [${section}] WARNING: ${message}`, data || '');
  }
}

class P2PNotebookApp {
  private auth: AuthManager;
  private documentManager: P2PDocumentManager;
  private editor: P2PCollaborativeEditor;
  private currentDocument: P2PDocument | null = null;
  private documents: P2PDocument[] = [];

  constructor() {
    DebugLogger.log('P2PNotebookApp', '🚀 Starting P2P Notebook App');
    DebugLogger.log('P2PNotebookApp', `Window location: ${window.location.href}`);
    DebugLogger.log('P2PNotebookApp', `User agent: ${navigator.userAgent}`);
    
    try {
      this.auth = AuthManager.getInstance();
      this.documentManager = P2PDocumentManager.getInstance();
      this.editor = new P2PCollaborativeEditor();
      
      DebugLogger.log('P2PNotebookApp', 'All managers initialized successfully');
      
      this.init();
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Failed to initialize app', error);
      this.showErrorScreen('Initialization failed: ' + error.message);
    }
  }

  private async init() {
    DebugLogger.log('P2PNotebookApp', 'Initializing P2P Notebook App');
    
    try {
      // Initialize document manager
      DebugLogger.log('P2PNotebookApp', 'Initializing document manager...');
      await this.documentManager.initialize();
      DebugLogger.log('P2PNotebookApp', '✅ P2P Document Manager initialized');
      
      // Check for shared document in URL
      const urlParams = new URLSearchParams(window.location.search);
      const shareCode = urlParams.get('share');
      
      DebugLogger.log('P2PNotebookApp', `Share code from URL: ${shareCode}`);
      
      // Setup auth change listener
      this.auth.onAuthChange(async (user) => {
        DebugLogger.log('P2PNotebookApp', 'Auth state changed', user);
        
        if (user) {
          DebugLogger.log('P2PNotebookApp', 'User logged in, proceeding with app initialization');
          
          if (shareCode) {
            // Handle shared document after login
            await this.handleSharedDocument(shareCode, user);
          } else {
            // Normal app flow
            await this.onUserLoggedIn(user);
          }
        } else {
          DebugLogger.log('P2PNotebookApp', 'No user, showing login screen');
          this.showLoginScreen();
        }
      });

      // Check initial auth state
      if (this.auth.isAuthenticated()) {
        const user = this.auth.getUser();
        DebugLogger.log('P2PNotebookApp', 'User already authenticated', user);
        
        if (user) {
          if (shareCode) {
            await this.handleSharedDocument(shareCode, user);
          } else {
            await this.onUserLoggedIn(user);
          }
        }
      } else {
        DebugLogger.log('P2PNotebookApp', 'User not authenticated, showing login screen');
        this.showLoginScreen();
      }
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error during app initialization', error);
      this.showErrorScreen('App initialization failed: ' + error.message);
    }
  }

  private async handleSharedDocument(shareCode: string, user: User) {
    DebugLogger.log('P2PNotebookApp', `Handling shared document with code: ${shareCode}`);
    
    try {
      // Try to find existing document by share code
      let document = await this.documentManager.getDocumentByShareCode(shareCode);
      
      if (!document) {
        DebugLogger.log('P2PNotebookApp', 'Shared document not found locally, creating new reference');
        // Create a new local reference using the SAME share code
        document = await this.documentManager.createDocument(user, `Shared Document ${shareCode}`);
        document.shareCode = shareCode; // 🔑 KEY: Use the shared code
        document.isShared = true;
        await this.documentManager.saveDocument(document);
        this.showNotification('Joining shared document - content will sync from other peers!', 'info');
      } else {
        DebugLogger.log('P2PNotebookApp', 'Found existing shared document locally');
      }

      // Render UI and open the shared document
      this.renderMainApp(user);
      this.setupEventListeners();
      
      // 🔑 KEY: Open using the document ID, but P2P will use share code
      await this.openDocument(document.id);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load other documents for sidebar
      await this.loadDocuments();
      this.renderDocumentList();
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error handling shared document', error);
      this.showNotification('Failed to join shared document', 'error');
      await this.onUserLoggedIn(user);
    }
  }

  private showLoginScreen() {
    DebugLogger.log('P2PNotebookApp', 'Rendering login screen');
    
    try {
      document.getElementById('app')!.innerHTML = `
        <div class="login-container">
          <div class="login-card">
            <div class="login-header">
              <div class="login-logo">📝 P2P Notebook</div>
              <div class="platform-badge">ELECTRON</div>
            </div>
            <p class="login-subtitle">Collaborative writing, reimagined</p>
            
            <div class="feature-list">
              <div class="feature">
                <span class="feature-icon">🔄</span>
                <span>Real-time P2P collaboration</span>
              </div>
              <div class="feature">
                <span class="feature-icon">💾</span>
                <span>Local-first document storage</span>
              </div>
              <div class="feature">
                <span class="feature-icon">🔗</span>
                <span>Share documents with links</span>
              </div>
              <div class="feature">
                <span class="feature-icon">🔒</span>
                <span>No servers, your data stays with you</span>
              </div>
            </div>
            
            <button class="google-login-btn" id="google-login">
              <div class="google-icon"></div>
              Continue with Google
            </button>
            
            <div style="margin-top: 16px;">
              <button class="action-btn" id="about-btn">About</button>
            </div>
          </div>
        </div>
      `;

      // Setup event listeners
      document.getElementById('google-login')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'Google login button clicked');
        this.auth.initiateGoogleLogin();
      });

      document.getElementById('about-btn')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'About button clicked');
        this.showAboutModal();
      });
      
      DebugLogger.log('P2PNotebookApp', 'Login screen rendered successfully');
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error rendering login screen', error);
    }
  }

  private async onUserLoggedIn(user: User) {
    DebugLogger.log('P2PNotebookApp', `User logged in: ${user.name} (${user.email})`);
    
    try {
      await this.loadDocuments();
      DebugLogger.log('P2PNotebookApp', `Loaded ${this.documents.length} documents`);
      
      this.renderMainApp(user);
      this.setupEventListeners();
      
      // Load first document or create new one
      if (this.documents.length > 0) {
        DebugLogger.log('P2PNotebookApp', 'Opening first existing document');
        await this.openDocument(this.documents[0].id);
      } else {
        DebugLogger.log('P2PNotebookApp', 'No documents found, creating new one');
        await this.createNewDocument();
      }
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error in onUserLoggedIn', error);
      this.showErrorScreen('Failed to load user data: ' + error.message);
    }
  }

  private async loadDocuments() {
    DebugLogger.log('P2PNotebookApp', 'Loading user documents');
    
    try {
      const user = this.auth.getUser();
      if (user) {
        this.documents = await this.documentManager.getUserDocuments(user.id);
        DebugLogger.log('P2PNotebookApp', `Loaded ${this.documents.length} documents for user ${user.id}`);
      } else {
        DebugLogger.warn('P2PNotebookApp', 'Cannot load documents - no user');
      }
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error loading documents', error);
      this.documents = [];
    }
  }

  private renderMainApp(user: User) {
    DebugLogger.log('P2PNotebookApp', 'Rendering main app interface');
    
    try {
      document.getElementById('app')!.innerHTML = `
        <div class="app-container">
          <div class="sidebar">
            <div class="sidebar-header">
              <div class="logo-container">
                <div class="logo">📝 P2P Notebook</div>
                <div class="platform-badge">ELECTRON</div>
              </div>
              <div class="user-info">
                <div class="user-avatar">
                  ${user.picture ? `<img src="${user.picture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                  <h3>${user.name}</h3>
                  <p>${user.email}</p>
                </div>
              </div>
            </div>
            
            <div class="sidebar-content">
              <div class="actions-group">
                <button class="new-doc-btn" id="new-doc-btn">+ New Document</button>
                <div class="action-buttons">
                  <button class="action-btn" id="share-btn">Share</button>
                  <button class="action-btn" id="export-btn">Export</button>
                </div>
              </div>
              
              <div class="search-container">
                <input type="text" class="search-input" id="search-input" placeholder="Search documents...">
              </div>
              
              <div class="documents-section">
                <h4>Recent Documents</h4>
                <ul class="document-list" id="document-list">
                  <!-- Documents will be inserted here -->
                </ul>
              </div>
            </div>
          </div>

          <div class="main-content">
            <div class="editor-header">
              <input type="text" class="document-title-input" id="document-title" placeholder="Untitled Document">
              
              <div class="editor-actions">
                <div class="collaboration-info">
                  <div class="status-indicator"></div>
                  <span id="connection-status">Connected</span>
                  <div class="collaborators" id="collaborators"></div>
                  <span id="peer-count">0 peers</span>
                </div>
                
                <button class="action-btn" id="logout-btn">Logout</button>
              </div>
            </div>

            <div class="editor-container">
              <div id="editor"></div>
            </div>
          </div>
        </div>

        <!-- Share Modal -->
        <div id="share-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Share Document</h3>
              <button class="close-btn" id="close-modal-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="share-option">
                <label>Share Link</label>
                <div class="input-group">
                  <input type="text" id="share-link" readonly>
                  <button id="copy-link-btn">Copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Modal -->
        <div id="export-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Export Document</h3>
              <button class="close-btn" id="close-export-modal-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="export-buttons">
                <button id="export-md-btn">Export as Markdown</button>
                <button id="export-txt-btn">Export as Text</button>
                <button id="export-json-btn">Export as JSON</button>
              </div>
            </div>
          </div>
        </div>

        <!-- About Modal -->
        <div id="about-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>About P2P Notebook</h3>
              <button class="close-btn" id="close-about-modal-btn">&times;</button>
            </div>
            <div class="modal-body about-modal">
              <h2>📝 P2P Notebook</h2>
              <p>A peer-to-peer collaborative text editor</p>
              <p>Built with Electron, Y.js, and WebRTC</p>
              <p>Version 1.0.0</p>
              <button id="close-about-btn">Close</button>
            </div>
          </div>
        </div>
      `;
      
      DebugLogger.log('P2PNotebookApp', 'Main app interface rendered successfully');
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error rendering main app', error);
    }
  }

  private setupEventListeners() {
    DebugLogger.log('P2PNotebookApp', 'Setting up event listeners');
    
    try {
      // New document
      document.getElementById('new-doc-btn')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'New document button clicked');
        this.createNewDocument();
      });

      // Search
      document.getElementById('search-input')?.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        DebugLogger.log('P2PNotebookApp', `Search query: "${query}"`);
        this.searchDocuments(query);
      });

      // Document title
      document.getElementById('document-title')?.addEventListener('input', (e) => {
        const title = (e.target as HTMLInputElement).value;
        DebugLogger.log('P2PNotebookApp', `Document title changed: "${title}"`);
        this.updateDocumentTitle(title);
      });

      // Share
      document.getElementById('share-btn')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'Share button clicked');
        this.showShareModal();
      });

      // Export
      document.getElementById('export-btn')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'Export button clicked');
        this.showExportModal();
      });

      // Logout
      document.getElementById('logout-btn')?.addEventListener('click', () => {
        DebugLogger.log('P2PNotebookApp', 'Logout button clicked');
        this.auth.logout();
      });

      // Modal handlers
      this.setupModalHandlers();
      
      DebugLogger.log('P2PNotebookApp', 'Event listeners set up successfully');
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error setting up event listeners', error);
    }
  }

  private setupModalHandlers() {
    // Share modal
    document.getElementById('copy-link-btn')?.addEventListener('click', () => {
      DebugLogger.log('P2PNotebookApp', 'Copy link button clicked');
      this.copyShareLink();
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
      this.hideShareModal();
    });

    // Export modal
    document.getElementById('close-export-modal-btn')?.addEventListener('click', () => {
      this.hideExportModal();
    });

    document.getElementById('export-md-btn')?.addEventListener('click', () => {
      DebugLogger.log('P2PNotebookApp', 'Export as Markdown clicked');
      this.exportDocument('md');
    });

    document.getElementById('export-txt-btn')?.addEventListener('click', () => {
      DebugLogger.log('P2PNotebookApp', 'Export as Text clicked');
      this.exportDocument('txt');
    });

    document.getElementById('export-json-btn')?.addEventListener('click', () => {
      DebugLogger.log('P2PNotebookApp', 'Export as JSON clicked');
      this.exportDocument('json');
    });

    // About modal
    document.getElementById('close-about-modal-btn')?.addEventListener('click', () => {
      this.hideAboutModal();
    });

    document.getElementById('close-about-btn')?.addEventListener('click', () => {
      this.hideAboutModal();
    });
  }

  private async createNewDocument() {
    DebugLogger.log('P2PNotebookApp', 'Creating new document');
    
    try {
      const user = this.auth.getUser();
      if (!user) {
        DebugLogger.error('P2PNotebookApp', 'Cannot create document - no user');
        return;
      }

      const doc = await this.documentManager.createDocument(user);
      DebugLogger.log('P2PNotebookApp', `Created new document: ${doc.id}`);
      
      await this.loadDocuments();
      this.renderDocumentList();
      await this.openDocument(doc.id);
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error creating new document', error);
      this.showNotification('Failed to create new document', 'error');
    }
  }

  private async openDocument(documentId: string) {
    DebugLogger.log('P2PNotebookApp', `Opening document: ${documentId}`);
    
    try {
      const doc = await this.documentManager.getDocument(documentId);
      if (!doc) {
        DebugLogger.error('P2PNotebookApp', `Document not found: ${documentId}`);
        this.showNotification('Document not found', 'error');
        return;
      }

      this.currentDocument = doc;
      DebugLogger.log('P2PNotebookApp', `Opened document: ${doc.title} (${doc.id})`);
      
      // Update UI
      const titleInput = document.getElementById('document-title') as HTMLInputElement;
      if (titleInput) {
        titleInput.value = doc.title;
      }

      // Initialize collaborative editor
      const user = this.auth.getUser();
      if (user) {
        DebugLogger.log('P2PNotebookApp', 'Initializing collaborative editor');
        await this.editor.initialize(documentId, user);
        DebugLogger.log('P2PNotebookApp', '✅ Collaborative editor initialized');
      }
      
      // Update document list active state
      this.renderDocumentList();
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error opening document', error);
      this.showNotification('Failed to open document', 'error');
    }
  }

  private async updateDocumentTitle(title: string) {
    DebugLogger.log('P2PNotebookApp', `Updating document title: "${title}"`);
    
    try {
      if (this.currentDocument) {
        await this.documentManager.updateDocumentTitle(this.currentDocument.id, title);
        this.currentDocument.title = title;
        await this.loadDocuments();
        this.renderDocumentList();
        DebugLogger.log('P2PNotebookApp', 'Document title updated successfully');
      }
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error updating document title', error);
    }
  }

  private async searchDocuments(query: string) {
    DebugLogger.log('P2PNotebookApp', `Searching documents with query: "${query}"`);
    
    try {
      const user = this.auth.getUser();
      if (!user) return;

      if (!query.trim()) {
        await this.loadDocuments();
      } else {
        // Simple search implementation
        const allDocs = await this.documentManager.getUserDocuments(user.id);
        this.documents = allDocs.filter(doc => 
          doc.title.toLowerCase().includes(query.toLowerCase())
        );
        DebugLogger.log('P2PNotebookApp', `Search found ${this.documents.length} documents`);
      }
      
      this.renderDocumentList();
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error searching documents', error);
    }
  }

  private renderDocumentList() {
    DebugLogger.log('P2PNotebookApp', `Rendering document list with ${this.documents.length} documents`);
    
    try {
      const listElement = document.getElementById('document-list');
      if (!listElement) {
        DebugLogger.warn('P2PNotebookApp', 'Document list element not found');
        return;
      }

      listElement.innerHTML = this.documents.map(doc => `
        <li class="document-item ${doc.id === this.currentDocument?.id ? 'active' : ''}" 
            data-doc-id="${doc.id}">
          <div class="document-title">${doc.title}</div>
          <div class="document-meta">
            ${new Date(doc.updatedAt).toLocaleDateString()}
            ${doc.isShared ? ' • Shared' : ''}
          </div>
        </li>
      `).join('');

      // Add click listeners
      listElement.addEventListener('click', async (e) => {
        const item = (e.target as Element).closest('.document-item');
        if (item) {
          const docId = item.getAttribute('data-doc-id');
          if (docId) {
            DebugLogger.log('P2PNotebookApp', `Document clicked: ${docId}`);
            await this.openDocument(docId);
          }
        }
      });
      
      DebugLogger.log('P2PNotebookApp', 'Document list rendered successfully');
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error rendering document list', error);
    }
  }

  private async showShareModal() {
    DebugLogger.log('P2PNotebookApp', 'Showing share modal');
    
    try {
      if (!this.currentDocument) {
        DebugLogger.warn('P2PNotebookApp', 'No current document to share');
        return;
      }

      const shareCode = await this.documentManager.shareDocument(this.currentDocument.id);
      if (shareCode) {
        const shareLink = this.documentManager.generateShareLink(shareCode);
        const modal = document.getElementById('share-modal');
        const linkInput = document.getElementById('share-link') as HTMLInputElement;
        
        if (modal && linkInput) {
          linkInput.value = shareLink;
          modal.style.display = 'flex';
          DebugLogger.log('P2PNotebookApp', `Generated share link: ${shareLink}`);
        }
      }
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error showing share modal', error);
    }
  }

  private hideShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private showExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  private hideExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private showAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  private hideAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private async copyShareLink() {
    const linkInput = document.getElementById('share-link') as HTMLInputElement;
    if (linkInput) {
      try {
        await navigator.clipboard.writeText(linkInput.value);
        this.showNotification('Link copied to clipboard!');
        DebugLogger.log('P2PNotebookApp', 'Share link copied to clipboard');
      } catch (err) {
        linkInput.select();
        document.execCommand('copy');
        this.showNotification('Link copied to clipboard!');
        DebugLogger.log('P2PNotebookApp', 'Share link copied using fallback method');
      }
    }
  }

  private exportDocument(format: 'md' | 'txt' | 'json') {
    DebugLogger.log('P2PNotebookApp', `Exporting document as ${format}`);
    
    try {
      if (!this.currentDocument) {
        DebugLogger.warn('P2PNotebookApp', 'No document to export');
        return;
      }

      const content = this.editor.getContent();
      let exportData: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'md':
          exportData = content;
          filename = `${this.currentDocument.title}.md`;
          mimeType = 'text/markdown';
          break;
        case 'txt':
          exportData = content;
          filename = `${this.currentDocument.title}.txt`;
          mimeType = 'text/plain';
          break;
        case 'json':
          exportData = JSON.stringify({
            id: this.currentDocument.id,
            title: this.currentDocument.title,
            content: content,
            createdAt: this.currentDocument.createdAt,
            updatedAt: this.currentDocument.updatedAt,
            shareCode: this.currentDocument.shareCode
          }, null, 2);
          filename = `${this.currentDocument.title}.json`;
          mimeType = 'application/json';
          break;
      }

      const blob = new Blob([exportData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      this.hideExportModal();
      this.showNotification(`Document exported as ${format.toUpperCase()}`);
      DebugLogger.log('P2PNotebookApp', `Document exported as ${format}: ${filename}`);
      
    } catch (error) {
      DebugLogger.error('P2PNotebookApp', 'Error exporting document', error);
      this.showNotification('Export failed', 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    DebugLogger.log('P2PNotebookApp', `Showing notification: ${message} (${type})`);
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 6px;
      font-weight: 500;
      z-index: 1001;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    // Add animation if not exists
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private showErrorScreen(message: string) {
    DebugLogger.error('P2PNotebookApp', `Showing error screen: ${message}`);
    
    document.getElementById('app')!.innerHTML = `
      <div class="loading" style="flex-direction: column; gap: 20px;">
        <div style="font-size: 48px;">⚠️</div>
        <div style="font-size: 24px; font-weight: 600; color: #ef4444;">Application Error</div>
        <div style="max-width: 500px; text-align: center; line-height: 1.6;">${message}</div>
        <button class="action-btn" onclick="location.reload()" style="margin-top: 20px;">Reload Application</button>
        <div style="margin-top: 20px; padding: 20px; background: #f3f4f6; border-radius: 8px; font-family: monospace; font-size: 14px; text-align: left; max-width: 600px; overflow-x: auto;">
          <div style="font-weight: 600; margin-bottom: 10px;">Debug Information:</div>
          <div>Timestamp: ${new Date().toISOString()}</div>
          <div>User Agent: ${navigator.userAgent}</div>
          <div>URL: ${window.location.href}</div>
          <div>Local Storage Available: ${typeof Storage !== "undefined"}</div>
          <div>IndexedDB Available: ${typeof indexedDB !== "undefined"}</div>
        </div>
      </div>
    `;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  DebugLogger.log('MAIN', '📱 DOM Content Loaded - Initializing P2P Notebook App');
  
  try {
    new P2PNotebookApp();
  } catch (error) {
    DebugLogger.error('MAIN', 'Failed to create P2PNotebookApp instance', error);
    
    // Show emergency error screen
    document.getElementById('app')!.innerHTML = `
      <div class="loading" style="flex-direction: column; gap: 20px;">
        <div style="font-size: 48px;">💥</div>
        <div style="font-size: 24px; font-weight: 600; color: #ef4444;">Critical Error</div>
        <div>Failed to initialize application</div>
        <div style="font-family: monospace; background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px;">
          ${error.message}
        </div>
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
  }
});

// Log when script loads
DebugLogger.log('MAIN', '📜 Main script loaded successfully');