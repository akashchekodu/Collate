import { AuthManager, User } from './auth';
import { P2PCollaborativeEditor, P2PDocumentManager, P2PDocument } from './p2p-collaborative-editor';

class P2PNotebookApp {
  private auth: AuthManager;
  private documentManager: P2PDocumentManager;
  private editor: P2PCollaborativeEditor;
  private currentDocument: P2PDocument | null = null;
  private documents: P2PDocument[] = [];

  constructor() {
    this.auth = AuthManager.getInstance();
    this.documentManager = P2PDocumentManager.getInstance();
    this.editor = new P2PCollaborativeEditor();
    this.init();
  }

  private async init() {
    // Initialize document manager
    try {
      await this.documentManager.initialize();
      console.log('✅ P2P Document Manager initialized');
    } catch (error) {
      console.error('Failed to initialize document manager:', error);
    }

    // Check for shared document in URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareCode = urlParams.get('share');

    this.auth.onAuthChange(async (user) => {
      if (user) {
        if (shareCode) {
          // Handle shared document
          await this.handleSharedDocument(shareCode, user);
        } else {
          // Normal app flow
          await this.onUserLoggedIn(user);
        }
      } else {
        this.showLoginScreen();
      }
    });

    // Check initial auth state
    if (this.auth.isAuthenticated()) {
      const user = this.auth.getUser();
      if (user) {
        if (shareCode) {
          await this.handleSharedDocument(shareCode, user);
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
      console.log('🔗 Handling shared document:', shareCode);
      
      // Try to find document by share code
      let document = await this.documentManager.getDocumentByShareCode(shareCode);
      
      if (!document) {
        // Create a new local reference to the shared document
        document = await this.documentManager.createDocument(user, `Shared Document ${shareCode}`);
        document.shareCode = shareCode;
        document.isShared = true;
        await this.documentManager.saveDocument(document);
        
        this.showNotification('Joining shared document - content will sync from other peers!', 'info');
      }

      // Render UI and open the shared document
      this.renderMainApp(user);
      this.setupEventListeners();
      await this.openDocument(document.id);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Load other documents for sidebar
      await this.loadDocuments();
      this.renderDocumentList();

    } catch (error: any) {
      console.error('Error handling shared document:', error);
      this.showNotification('Failed to join shared document', 'error');
      
      // Fallback to normal flow
      await this.onUserLoggedIn(user);
    }
  }

  private showLoginScreen() {
    document.getElementById('app')!.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="background: white; padding: 48px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 90%;">
          <div style="font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 16px;">📝 P2P Notebook</div>
          <p style="color: #64748b; margin-bottom: 32px; font-size: 16px;">Pure peer-to-peer collaboration<br>No servers, no databases</p>
          <button id="google-login" style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; padding: 12px 24px; background: #4285f4; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;">
            <div style="width: 20px; height: 20px; background: white; color: #4285f4; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-weight: bold;">G</div>
            Continue with Google
          </button>
          <div style="margin-top: 24px; font-size: 12px; color: #94a3b8;">
            <p>🔄 Documents stored locally in your browser</p>
            <p>🌐 Real-time sync via WebRTC P2P</p>
            <p>🔒 No data leaves your control</p>
          </div>
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
        this.documents = await this.documentManager.getUserDocuments(user.id);
      } catch (error) {
        console.error('Error loading documents:', error);
        this.documents = [];
      }
    }
  }

  private renderMainApp(user: User) {
    document.getElementById('app')!.innerHTML = `
      <div style="display: flex; height: 100vh; overflow: hidden; font-family: Inter, sans-serif;">
        <!-- Sidebar -->
        <div style="width: 280px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
          <!-- Header -->
          <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">📝 P2P Notebook</div>
            <div style="font-size: 10px; color: #10b981; background: #f0fdf4; padding: 4px 8px; border-radius: 4px; text-align: center; margin-bottom: 16px;">
              🔄 PURE P2P • NO SERVERS
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f1f5f9; border-radius: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500; font-size: 14px; overflow: hidden;">
                ${user.picture ? `<img src="${user.picture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : user.name.charAt(0).toUpperCase()}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 500; color: #1e293b; truncate;">${user.name}</div>
                <div style="font-size: 12px; color: #64748b; truncate;">${user.email}</div>
              </div>
            </div>
          </div>
          
          <!-- Content -->
          <div style="flex: 1; overflow-y: auto; padding: 20px;">
            <button id="new-doc-btn" style="background: #3b82f6; color: white; border: none; padding: 12px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; margin-bottom: 16px; width: 100%; transition: background-color 0.2s;">
              + New P2P Document
            </button>
            
            <div style="position: relative; margin-bottom: 16px;">
              <input type="text" id="search-input" placeholder="Search documents..." style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; outline: none;">
            </div>
            
            <div>
              <h4 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">My Documents</h4>
              <ul id="document-list" style="list-style: none; padding: 0; margin: 0;">
                <!-- Documents will be inserted here -->
              </ul>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          <!-- Header -->
          <div style="background: white; border-bottom: 1px solid #e2e8f0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <input type="text" id="document-title" placeholder="Untitled Document" style="font-size: 18px; font-weight: 600; border: none; outline: none; background: transparent; flex: 1; color: #1e293b;">
            
            <div style="display: flex; gap: 12px; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #64748b;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                <span id="connection-status">P2P Connected</span>
              </div>
              
              <button id="share-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                Share P2P
              </button>
              <button id="export-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                Export
              </button>
              <button id="logout-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                Logout
              </button>
            </div>
          </div>

          <!-- Editor Container -->
          <div style="flex: 1; background: white; margin: 24px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column;">
            <div id="editor" style="flex: 1;"></div>
          </div>
        </div>
      </div>

      <!-- Share Modal -->
      <div id="share-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background: white; padding: 32px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
          <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #1e293b;">Share P2P Document</h3>
          <p style="color: #64748b; margin-bottom: 20px;">Share this link for real-time P2P collaboration:</p>
          <input type="text" id="share-link" readonly style="width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #f8fafc; margin-bottom: 20px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
            <div style="font-size: 12px; color: #166534; font-weight: 500; margin-bottom: 4px;">🔄 Pure P2P Sharing</div>
            <div style="font-size: 11px; color: #15803d;">• No servers store your document<br>• Direct browser-to-browser connection<br>• Content syncs when peers are online</div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="copy-link-btn" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; cursor: pointer;">
              Copy Link
            </button>
            <button id="close-modal-btn" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 6px; font-weight: 500; cursor: pointer;">
              Close
            </button>
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
      this.cleanup();
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
      const newDoc = await this.documentManager.createDocument(user, 'Untitled Document');
      await this.loadDocuments();
      this.renderDocumentList();
      await this.openDocument(newDoc.id);
      
      this.showNotification('New P2P document created!', 'success');
    } catch (error) {
      console.error('Error creating document:', error);
      this.showNotification('Failed to create document', 'error');
    }
  }

  private async openDocument(documentId: string) {
    const user = this.auth.getUser();
    if (!user) return;

    try {
      this.cleanup(); // Clean up previous editor
      
      this.currentDocument = await this.documentManager.getDocument(documentId);
      if (!this.currentDocument) {
        throw new Error('Document not found');
      }

      // Initialize P2P editor
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
          data-doc-id="${doc.id}"
          style="padding: 12px; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; border: 1px solid transparent; margin-bottom: 4px; ${doc.id === this.currentDocument?.id ? 'background: #eff6ff; border-color: #dbeafe; color: #1d4ed8;' : ''}">
        <div class="document-title" style="font-size: 14px; font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          ${doc.isShared ? '🔄' : '📄'} ${doc.title}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          ${new Date(doc.updatedAt).toLocaleDateString()} ${doc.isShared ? '• P2P Shared' : '• Local'}
        </div>
      </li>
    `).join('');

    // Add click listeners
    listElement.addEventListener('click', async (e) => {
      const item = (e.target as Element).closest('.document-item');
      if (item) {
        const docId = item.getAttribute('data-doc-id');
        if (docId && docId !== this.currentDocument?.id) {
          await this.openDocument(docId);
        }
      }
    });

    // Add hover effects
    const items = listElement.querySelectorAll('.document-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) {
          (item as HTMLElement).style.background = '#f8fafc';
          (item as HTMLElement).style.borderColor = '#e2e8f0';
        }
      });
      
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) {
          (item as HTMLElement).style.background = '';
          (item as HTMLElement).style.borderColor = 'transparent';
        }
      });
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
        this.showNotification('P2P share link copied! Others can join for real-time collaboration.', 'success');
      } catch (err) {
        linkInput.select();
        document.execCommand('copy');
        this.showNotification('P2P share link copied! Others can join for real-time collaboration.', 'success');
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

  private cleanup() {
    if (this.editor) {
      this.editor.cleanup();
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      border-radius: 8px;
      font-weight: 500;
      z-index: 1001;
      max-width: 350px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

// Start the P2P application
new P2PNotebookApp();