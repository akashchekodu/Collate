// Import CSS
import './styles.css';

import { AuthManager, User } from './auth';
import { CollaborativeEditor, DocumentAPI, Document } from './server-based-editor';

class GoogleDocsCloneApp {
  private auth: AuthManager;
  private documentAPI: DocumentAPI;
  private editor: CollaborativeEditor;
  private currentDocument: Document | null = null;
  private documents: Document[] = [];

  constructor() {
    this.auth = AuthManager.getInstance();
    this.documentAPI = new DocumentAPI();
    this.editor = new CollaborativeEditor();
    this.init();
  }

  private async init() {
    // Check for shared document in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedDocCode = urlParams.get('doc');

    this.auth.onAuthChange(async (user) => {
      if (user) {
        if (sharedDocCode) {
          // User clicked on a shared link
          await this.handleSharedDocument(sharedDocCode, user);
        } else {
          // Normal app flow
          await this.onUserLoggedIn(user);
        }
      } else {
        this.showLoginScreen();
      }
    });

    if (this.auth.isAuthenticated()) {
      const user = this.auth.getUser();
      if (user) {
        if (sharedDocCode) {
          await this.handleSharedDocument(sharedDocCode, user);
        } else {
          await this.onUserLoggedIn(user);
        }
      }
    } else {
      this.showLoginScreen();
    }
  }

  private async handleSharedDocument(shareCode: string, user: User) {
    try {
      console.log('🔗 Opening shared document:', shareCode);
      
      // Join the shared document
      this.currentDocument = await this.documentAPI.joinDocument(shareCode, user);
      
      // Render the UI with the shared document
      this.renderMainApp(user);
      this.setupEventListeners();
      
      // Initialize the editor with the shared document
      await this.editor.initialize(this.currentDocument.id, user);
      
      // Update the title input
      const titleInput = document.getElementById('document-title') as HTMLInputElement;
      if (titleInput) {
        titleInput.value = this.currentDocument.title;
      }
      
      // Show success notification
      this.showNotification(`Joined "${this.currentDocument.title}" - you can now collaborate in real-time!`, 'success');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load user's other documents in sidebar
      await this.loadDocuments();
      this.renderDocumentList();
      
    } catch (error: any) {
      console.error('Error opening shared document:', error);
      this.showNotification(error.message || 'Failed to open shared document', 'error');
      
      // Fall back to normal flow
      await this.onUserLoggedIn(user);
    }
  }

  private showLoginScreen() {
    document.getElementById('app')!.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo">📄 Collaborative Notebook</div>
          <p class="login-subtitle">Real-time collaboration like Google Docs</p>
          <button class="google-login-btn" id="google-login">
            <div class="google-icon">G</div>
            Continue with Google
          </button>
        </div>
      </div>
    `;

    document.getElementById('google-login')?.addEventListener('click', () => {
      this.auth.initiateGoogleLogin();
    });
  }

  private async onUserLoggedIn(user: User) {
    await this.loadDocuments();
    this.renderMainApp(user);
    this.setupEventListeners();
    
    // Open first document or create new one
    if (this.documents.length > 0) {
      await this.openDocument(this.documents[0].id);
    } else {
      await this.createNewDocument();
    }
  }

  private async loadDocuments() {
    const user = this.auth.getUser();
    if (user) {
      try {
        this.documents = await this.documentAPI.getUserDocuments(user.id);
      } catch (error) {
        console.error('Error loading documents:', error);
        this.documents = [];
      }
    }
  }

  private renderMainApp(user: User) {
    document.getElementById('app')!.innerHTML = `
      <div class="app-container">
        <div class="sidebar">
          <div class="sidebar-header">
            <div class="logo">📄 Collaborative Notebook</div>
            <div class="user-info">
              <div class="user-avatar">
                ${user.picture ? `<img src="${user.picture}" alt="">` : user.name.charAt(0).toUpperCase()}
              </div>
              <div class="user-details">
                <h3>${user.name}</h3>
                <p>${user.email}</p>
              </div>
            </div>
          </div>
          
          <div class="sidebar-content">
            <button class="new-doc-btn" id="new-doc-btn">+ New Document</button>
            
            <div class="search-container">
              <input type="text" class="search-input" id="search-input" placeholder="Search documents...">
            </div>
            
            <div class="documents-section">
              <h4>My Documents</h4>
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
                <span id="peer-count">0 collaborators</span>
                <span id="save-status"></span>
              </div>
              
              <button class="action-btn" id="share-btn">Share</button>
              <button class="action-btn" id="export-btn">Export</button>
              <button class="action-btn" id="logout-btn">Logout</button>
            </div>
          </div>

          <div class="editor-container">
            <div id="editor"></div>
            <div id="typing-status" style="display: none; padding: 8px 24px; font-size: 12px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0;"></div>
          </div>
        </div>
      </div>

      <!-- Share Modal -->
      <div id="share-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <h3>Share Document</h3>
          <p>Anyone with this link can view and edit this document:</p>
          <input type="text" id="share-link" readonly class="share-link-input">
          <div class="modal-actions">
            <button id="copy-link-btn" class="primary-btn">Copy Link</button>
            <button id="close-modal-btn" class="secondary-btn">Close</button>
          </div>
        </div>
      </div>
    `;

    this.renderDocumentList();
  }

  private setupEventListeners() {
    // New document
    document.getElementById('new-doc-btn')?.addEventListener('click', () => {
      this.createNewDocument();
    });

    // Search documents
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.filterDocuments(query);
    });

    // Document title
    document.getElementById('document-title')?.addEventListener('input', (e) => {
      const title = (e.target as HTMLInputElement).value;
      this.updateDocumentTitle(title);
    });

    // Share button
    document.getElementById('share-btn')?.addEventListener('click', () => {
      this.showShareModal();
    });

    // Export button
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.exportDocument();
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.auth.logout();
    });

    // Share modal
    document.getElementById('copy-link-btn')?.addEventListener('click', () => {
      this.copyShareLink();
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
      this.hideShareModal();
    });

    // Close modal when clicking outside
    document.getElementById('share-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('share-modal')) {
        this.hideShareModal();
      }
    });
  }

  private async createNewDocument() {
    const user = this.auth.getUser();
    if (!user) return;

    try {
      const newDoc = await this.documentAPI.createDocument(user);
      await this.loadDocuments();
      this.renderDocumentList();
      await this.openDocument(newDoc.id);
    } catch (error) {
      console.error('Error creating document:', error);
      this.showNotification('Failed to create document', 'error');
    }
  }

  private async openDocument(documentId: string) {
    const user = this.auth.getUser();
    if (!user) return;

    try {
      this.currentDocument = await this.documentAPI.getDocument(documentId, user.id);
      
      // Initialize editor
      await this.editor.initialize(documentId, user);
      
      // Update UI
      const titleInput = document.getElementById('document-title') as HTMLInputElement;
      if (titleInput) {
        titleInput.value = this.currentDocument.title;
      }
      
      // Update active state in document list
      this.renderDocumentList();
      
    } catch (error) {
      console.error('Error opening document:', error);
      this.showNotification('Failed to open document', 'error');
    }
  }

  private async updateDocumentTitle(title: string) {
    if (!this.currentDocument) return;

    try {
      await this.editor.updateDocumentTitle(title);
      this.currentDocument.title = title;
      
      // Update document list
      await this.loadDocuments();
      this.renderDocumentList();
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }

  private filterDocuments(query: string) {
    const listItems = document.querySelectorAll('#document-list .document-item');
    listItems.forEach(item => {
      const title = item.querySelector('.document-title')?.textContent?.toLowerCase() || '';
      const shouldShow = title.includes(query) || query === '';
      (item as HTMLElement).style.display = shouldShow ? 'block' : 'none';
    });
  }

  private renderDocumentList() {
    const listElement = document.getElementById('document-list');
    if (!listElement) return;

    listElement.innerHTML = this.documents.map(doc => `
      <li class="document-item ${doc.id === this.currentDocument?.id ? 'active' : ''}" 
          data-doc-id="${doc.id}">
        <div class="document-title">${doc.title}</div>
        <div class="document-meta">
          ${new Date(doc.updatedAt).toLocaleDateString()} • ${doc.userPermission}
        </div>
      </li>
    `).join('');

    // Add click listeners
    listElement.addEventListener('click', async (e) => {
      const item = (e.target as Element).closest('.document-item');
      if (item) {
        const docId = item.getAttribute('data-doc-id');
        if (docId) {
          await this.openDocument(docId);
        }
      }
    });
  }

  private showShareModal() {
    if (!this.currentDocument) return;

    const shareLink = this.editor.generateShareLink();
    const modal = document.getElementById('share-modal');
    const linkInput = document.getElementById('share-link') as HTMLInputElement;
    
    if (modal && linkInput) {
      linkInput.value = shareLink;
      modal.style.display = 'flex';
    }
  }

  private hideShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private async copyShareLink() {
    const linkInput = document.getElementById('share-link') as HTMLInputElement;
    if (linkInput) {
      try {
        await navigator.clipboard.writeText(linkInput.value);
        this.showNotification('Link copied! Share it with others to collaborate.', 'success');
      } catch (err) {
        linkInput.select();
        document.execCommand('copy');
        this.showNotification('Link copied! Share it with others to collaborate.', 'success');
      }
    }
  }

  private exportDocument() {
    const content = this.editor.getContent();
    const filename = `${this.currentDocument?.title || 'document'}.md`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Start the application
new GoogleDocsCloneApp();