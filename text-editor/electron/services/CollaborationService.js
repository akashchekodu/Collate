// electron/services/CollaborationService.js
const { BrowserWindow } = require('electron');
const path = require('path');

class CollaborationService {
  constructor(documentStorage) {
    this.documentStorage = documentStorage;
    this.activeSessions = new Map(); // documentId -> collaboration session
    this.collaborationWindows = new Map(); // documentId -> hidden window
  }

  async startCollaboration(documentId, collaborationData) {
    console.log('🤝 Starting collaboration for document:', documentId);
    
    try {
      // Load the document to get initial state
      const docResult = await this.documentStorage.loadDocument(documentId);
      if (!docResult) {
        throw new Error('Document not found');
      }

      // Create hidden browser window for WebRTC
      const collabWindow = new BrowserWindow({
        show: false, // Hidden window
        width: 400,
        height: 300,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../collaboration-preload.js')
        }
      });

      // Store the collaboration session
      this.activeSessions.set(documentId, {
        room: collaborationData.room,
        token: collaborationData.token,
        isOwner: true,
        peers: new Set(),
        documentState: docResult.state
      });

      this.collaborationWindows.set(documentId, collabWindow);

      // Load collaboration interface in hidden window
      const collaborationUrl = `https://text-editor-nine-beta.vercel.app/editor/${documentId}?room=${collaborationData.room}&token=${collaborationData.token}&mode=owner&hidden=true`;
      
      console.log('🌐 Loading collaboration in hidden window:', collaborationUrl);
      await collabWindow.loadURL(collaborationUrl);

      // Set up communication with hidden window
      this.setupCollaborationBridge(documentId, collabWindow);

      return { success: true, sessionId: documentId };
    } catch (error) {
      console.error('❌ Failed to start collaboration:', error);
      return { success: false, error: error.message };
    }
  }

// Add debugging in setupCollaborationBridge
setupCollaborationBridge(documentId, collabWindow) {
  console.log('🌉 Setting up collaboration bridge for:', documentId);
  
  // Debug navigation
  collabWindow.webContents.on('did-start-loading', () => {
    console.log('🔄 Hidden window started loading...');
  });
  
  collabWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Hidden window finished loading');
    console.log('📍 Current URL:', collabWindow.webContents.getURL());
    
    const session = this.activeSessions.get(documentId);
    if (session) {
      setTimeout(() => {
        collabWindow.webContents.send('init-owner-state', {
          documentId,
          state: session.documentState,
          room: session.room,
          token: session.token
        });
        console.log('📤 Sent owner state to hidden window');
      }, 1000); // Give it time to initialize
    }
  });

  collabWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Hidden window failed to load:', {
      errorCode,
      errorDescription,
      url: validatedURL
    });
  });
}

  async handleCollaborationUpdate(documentId, updateData) {
    console.log('🔄 Handling collaboration update for:', documentId);
    
    try {
      // Update local document with collaboration changes
      await this.documentStorage.saveDocument(
        documentId, 
        updateData.state, 
        updateData.metadata
      );

      // Notify main window of changes
      const mainWindow = require('electron').BrowserWindow.getAllWindows()
        .find(win => !this.collaborationWindows.has(documentId) || 
                     this.collaborationWindows.get(documentId) !== win);
      
      if (mainWindow) {
        mainWindow.webContents.send('document-updated', {
          documentId,
          source: 'collaboration'
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle collaboration update:', error);
    }
  }

  async stopCollaboration(documentId) {
    console.log('🛑 Stopping collaboration for:', documentId);
    
    const collabWindow = this.collaborationWindows.get(documentId);
    if (collabWindow) {
      collabWindow.close();
      this.collaborationWindows.delete(documentId);
    }

    this.activeSessions.delete(documentId);
  }

  getActiveCollaborations() {
    return Array.from(this.activeSessions.keys());
  }
}

module.exports = CollaborationService;
