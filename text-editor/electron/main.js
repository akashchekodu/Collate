// electron/main.js - FIXED: Import app before using it
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const Y = require('yjs');

const DocumentStorage = require('./services/DocumentStorage');
const CollaborationService = require('./services/CollaborationService'); // ✅ ADD: Import collaboration service

const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');

// ✅ FIXED: Set custom userData path AFTER importing app
app.setPath('userData', path.join(dataHome, 'Collite'));

// Register custom protocol handler
app.setAsDefaultProtocolClient('collate');

// Handle protocol URLs when app is already running (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('🔗 Protocol URL received (macOS):', url);
  handleCollaborationUrl(url);
});

// Handle protocol URLs when app starts from protocol (Windows/Linux)
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  
  // Check if there's a protocol URL in the command line
  const url = commandLine.find(arg => arg.startsWith('collate://'));
  if (url) {
    console.log('🔗 Protocol URL from second instance:', url);
    handleCollaborationUrl(url);
  }
});

// Ensure single instance (required for protocol handling)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let documentStorage;
let collaborationService; // ✅ ADD: Collaboration service variable
let mainWindow;

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// ✅ UPDATED: Enhanced collaboration URL handler
function handleCollaborationUrl(url) {
  try {
    console.log('🤝 Handling collaboration URL:', url);
    
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    const room = params.get('room');
    const token = params.get('token');
    const doc = params.get('doc');
    
    console.log('🔍 Extracted collaboration params:', {
      room: room ? `${room.substring(0, 20)}...` : 'missing',
      token: token ? 'present' : 'missing',
      doc: doc ? doc : 'missing'
    });
    
    if (!room || !token || !doc) {
      console.error('❌ Invalid collaboration URL - missing required parameters');
      showErrorDialog('Invalid collaboration link', 'This collaboration link is missing required information.');
      return;
    }

    // ✅ NEW: Start collaboration session as owner
    if (collaborationService) {
      collaborationService.startCollaboration(doc, { room, token })
        .then(result => {
          if (result.success) {
            console.log('✅ Collaboration started successfully');
            
            // Navigate main window to document
            if (mainWindow) {
              mainWindow.webContents.send('navigate-to-document', {
                documentId: doc,
                collaborationActive: true,
                room: room,
                token: token
              });
              
              if (!mainWindow.isVisible()) {
                mainWindow.show();
              }
              mainWindow.focus();
            }
          } else {
            console.error('❌ Failed to start collaboration:', result.error);
            showErrorDialog('Collaboration Error', `Failed to start collaboration: ${result.error}`);
          }
        })
        .catch(error => {
          console.error('❌ Collaboration error:', error);
          showErrorDialog('Collaboration Error', 'An error occurred while starting collaboration.');
        });
    } else {
      console.error('❌ Collaboration service not initialized');
      
      // Fallback: Send to renderer process directly
      if (mainWindow) {
        mainWindow.webContents.send('join-collaboration', {
          room,
          token,
          documentId: doc,
          timestamp: Date.now(),
          source: 'protocol-handler'
        });
        
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      }
    }
    
  } catch (error) {
    console.error('❌ Error handling collaboration URL:', error);
    showErrorDialog('Protocol Error', 'Failed to process collaboration link.');
  }
}

function showErrorDialog(title, message) {
  const { dialog } = require('electron');
  dialog.showErrorBox(title, message);
}

function createWindow() {
  console.log('📱 Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    titleBarStyle: 'default',
    show: true
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('🔥 Loading development server: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../out/index.html');
    console.log('📦 Loading production build:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ✅ ENHANCED: Single app.whenReady() with collaboration service
app.whenReady().then(async () => {
  console.log('⚡ App ready, initializing services...');
  
  try {
    // Initialize document storage
    documentStorage = new DocumentStorage();
    console.log('✅ DocumentStorage initialized successfully');
    
    // Initialize collaboration service
    collaborationService = new CollaborationService(documentStorage);
    console.log('✅ CollaborationService initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }

  createWindow();

  // ✅ EXISTING: IPC Handlers (keep all your existing ones)
  ipcMain.handle('documents:create', async (event, title) => {
    try {
      const docData = await documentStorage.createDocument(title);
      console.log('✅ Document created:', docData.id);
      
      return {
        id: docData.id,
        title: docData.title,
        createdAt: docData.createdAt,
        updatedAt: docData.updatedAt,
        version: docData.version
      };
    } catch (error) {
      console.error('❌ Error creating document:', error);
      throw error;
    }
  });

  ipcMain.handle('documents:save', async (event, documentId, state, metadata) => {
    try {
      const result = await documentStorage.saveDocument(documentId, state, metadata);
      return {
        id: result.id,
        title: result.title,
        updatedAt: result.updatedAt,
        version: result.version
      };
    } catch (error) {
      console.error('❌ Error saving document:', error);
      throw error;
    }
  });
// ✅ MODIFIED: Load document (handle both internal and external)
  ipcMain.handle('documents:load', async (event, idOrPath) => {
    if (await fs.access(idOrPath).then(() => true).catch(() => false)) {
      return await documentStorage.loadExternalDocument(idOrPath);
    } else {
      return await documentStorage.loadDocument(idOrPath);
    }
  });
  // ✅ NEW: Save external document
  ipcMain.handle('documents:saveExternal', async (event, filePath, state) => {
    try {
      return await documentStorage.saveExternalDocument(filePath, state);
    } catch (error) {
      console.error('❌ Error saving external document:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:getAll', async () => {
    try {
      const documents = await documentStorage.getAllDocuments();
      return documents;
    } catch (error) {
      console.error('❌ Error getting all documents:', error);
      return [];
    }
  });

  // ✅ NEW: Collaboration IPC handlers
  ipcMain.handle('collaboration:start', async (event, documentId, collaborationData) => {
    try {
      if (!collaborationService) {
        throw new Error('Collaboration service not initialized');
      }
      return await collaborationService.startCollaboration(documentId, collaborationData);
    } catch (error) {
      console.error('❌ Error starting collaboration:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('collaboration:stop', async (event, documentId) => {
    try {
      if (!collaborationService) {
        throw new Error('Collaboration service not initialized');
      }
      return await collaborationService.stopCollaboration(documentId);
    } catch (error) {
      console.error('❌ Error stopping collaboration:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('collaboration:getActive', async () => {
    try {
      if (!collaborationService) {
        return [];
      }
      return collaborationService.getActiveCollaborations();
    } catch (error) {
      console.error('❌ Error getting active collaborations:', error);
      return [];
    }
  });

  // ✅ NEW: Handle collaboration updates from hidden window
  ipcMain.on('collaboration-update', (event, updateData) => {
    console.log('📡 Received collaboration update:', updateData.documentId);
    if (collaborationService) {
      collaborationService.handleCollaborationUpdate(updateData.documentId, updateData);
    }
  });

  // ✅ EXISTING: Keep all your other IPC handlers
  ipcMain.handle('collaboration:test-join', async (event, testParams) => {
    try {
      console.log('🧪 Manual collaboration test triggered:', testParams);
      
      const { room, token, documentId } = testParams;
      
      if (!room || !token || !documentId) {
        console.error('❌ Missing test parameters');
        return { success: false, error: 'Missing required parameters' };
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('join-collaboration', {
          room,
          token,
          documentId,
          timestamp: Date.now(),
          source: 'manual-test'
        });
        
        console.log('✅ Manual collaboration join request sent to renderer');
        return { success: true };
      } else {
        console.error('❌ No main window available');
        return { success: false, error: 'No main window' };
      }
    } catch (error) {
      console.error('❌ Error in manual collaboration test:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ EXISTING: Keep all your other handlers (delete, duplicate, export, debug)
  ipcMain.handle('documents:delete', async (event, documentId) => {
    try {
      const success = await documentStorage.deleteDocument(documentId);
      return { success };
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      return { success: false, error: error.message };
    }
  });
  // Add this IPC handler for development testing
  ipcMain.handle('collaboration:test-dev', async (event, params) => {
    console.log('🧪 DEV: Testing collaboration with params:', params);
    
    try {
      if (collaborationService) {
        const result = await collaborationService.startCollaboration(params.documentId, {
          room: params.room, 
          token: params.token
        });
        
        console.log('🎯 DEV: Collaboration result:', result);
        return result;
      }
      return { success: false, error: 'No collaboration service' };
    } catch (error) {
      console.error('❌ DEV: Collaboration test failed:', error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle('documents:duplicate', async (event, documentId, newTitle) => {
    try {
      const result = await documentStorage.duplicateDocument(documentId, newTitle);
      return result;
    } catch (error) {
      console.error('❌ Error duplicating document:', error);
      throw error;
    }
  });

  ipcMain.handle('documents:debug', async (event, documentId) => {
    try {
      console.log('🔍 Debug request for document:', documentId);
      
      const docPath = path.join(documentStorage.documentsPath, `${documentId}.json`);
      const exists = await fs.access(docPath).then(() => true).catch(() => false);
      
      if (exists) {
        const data = await fs.readFile(docPath, 'utf-8');
        const doc = JSON.parse(data);
        
        return {
          exists: true,
          fileSize: data.length,
          stateLength: doc.state ? doc.state.length : 0,
          statistics: doc.statistics,
          title: doc.title,
          version: doc.version
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.error('❌ Debug error:', error);
      return { exists: false, error: error.message };
    }
  });

  ipcMain.handle('documents:export', async (event, documentId, format) => {
    try {
      const result = await documentStorage.exportDocument(documentId, format);
      if (result) {
        const { filePath } = await dialog.showSaveDialog({
          defaultPath: result.filename,
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'HTML', extensions: ['html'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (filePath) {
          await fs.writeFile(filePath, result.content);
          return { success: true, path: filePath };
        }
      }
      return { success: false };
    } catch (error) {
      console.error('❌ Error exporting document:', error);
      return { success: false, error: error.message };
    }
  });

    // ✅ NEW: Open file dialog handler
  ipcMain.handle('documents:openFile', async (event) => {
    try {
      console.log('📁 Opening file dialog...');
      
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Text Documents', extensions: ['txt', 'md', 'markdown', 'text'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Open Document'
      });
      
      console.log('📁 File dialog result:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const folderPath = path.dirname(filePath);
        
        // Set the current folder to the file's directory
        documentStorage.setCurrentFolder(folderPath);
        console.log('📁 Current folder set to:', folderPath);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error opening file dialog:', error);
      return { canceled: true, error: error.message };
    }
  });


  // ✅ NEW: Import file handler
  ipcMain.handle('documents:importFile', async (event, filePath) => {
    try {
      console.log('📄 Importing file:', filePath);
      
      // Check if file exists
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        throw new Error('File does not exist');
      }
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      console.log('📄 File content length:', content.length);
      
      // Extract filename without extension for title
      const fileName = path.basename(filePath, path.extname(filePath));
      const fileExtension = path.extname(filePath);
      
      // Generate new document ID
      const documentId = documentStorage.generateDocumentId();
      
      // Create Y.js document with the imported content
      const ydoc = new Y.Doc();
      const fieldName = `editor-${documentId}`;
      const ytext = ydoc.getText(fieldName);
      
      // Insert content into Y.js document
      ytext.insert(0, content);
      
      // Encode the state
      const state = Y.encodeStateAsUpdate(ydoc);
      
      // Prepare metadata
      const metadata = {
        title: fileName || 'Imported Document',
        createdAt: new Date().toISOString(),
        version: 0,
        imported: true,
        originalPath: filePath,
        originalExtension: fileExtension,
        tags: ['imported']
      };
      
      // Save the document
      const savedDoc = await documentStorage.saveDocument(documentId, Array.from(state), metadata);
      console.log('✅ Document imported successfully:', savedDoc.id);
      
      return {
        id: documentId,
        title: savedDoc.title,
        createdAt: savedDoc.createdAt,
        updatedAt: savedDoc.updatedAt,
        version: savedDoc.version,
        imported: true,
        originalPath: filePath
      };
      
    } catch (error) {
      console.error('❌ Error importing file:', error);
      throw error;
    }
  });

  // ✅ NEW: Update document title handler (if not already present)
  ipcMain.handle('documents:updateTitle', async (event, documentId, newTitle) => {
    try {
      console.log('📝 Updating document title:', documentId, '->', newTitle);
      
      const result = await documentStorage.updateDocumentTitle(documentId, newTitle);
      
      if (result.success) {
        console.log('✅ Document title updated successfully');
        return { success: true, title: result.title };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error updating document title:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NEW: Get recent documents handler (if you want a separate endpoint)
  ipcMain.handle('documents:getRecent', async (event, limit = 10) => {
    try {
      console.log('📚 Getting recent documents, limit:', limit);
      
      const recentDocs = await documentStorage.getRecentDocuments(limit);
      console.log('✅ Retrieved recent documents:', recentDocs.length);
      
      return recentDocs;
    } catch (error) {
      console.error('❌ Error getting recent documents:', error);
      return [];
    }
  });

  // ✅ NEW: Search documents handler
  ipcMain.handle('documents:search', async (event, query) => {
    try {
      console.log('🔍 Searching documents for:', query);
      
      const results = await documentStorage.searchDocuments(query);
      console.log('✅ Search completed, found:', results.length, 'documents');
      
      return results;
    } catch (error) {
      console.error('❌ Error searching documents:', error);
      return [];
    }
  });

  // ✅ NEW: Get document statistics
  ipcMain.handle('documents:getStats', async (event) => {
    try {
      console.log('📊 Getting document statistics');
      
      const allDocs = await documentStorage.getAllDocuments();
      
      const stats = {
        totalDocuments: allDocs.length,
        totalWords: allDocs.reduce((sum, doc) => sum + (doc.statistics?.words || 0), 0),
        totalCharacters: allDocs.reduce((sum, doc) => sum + (doc.statistics?.characters || 0), 0),
        averageWords: 0,
        oldestDocument: null,
        newestDocument: null,
        mostRecentlyUpdated: null
      };
      
      if (allDocs.length > 0) {
        stats.averageWords = Math.round(stats.totalWords / allDocs.length);
        
        // Sort by creation date
        const sortedByCreation = [...allDocs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        stats.oldestDocument = sortedByCreation[0];
        stats.newestDocument = sortedByCreation[sortedByCreation.length - 1];
        
        // Sort by update date
        const sortedByUpdate = [...allDocs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        stats.mostRecentlyUpdated = sortedByUpdate[0];
      }
      
      console.log('✅ Document statistics calculated:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error getting document statistics:', error);
      return null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('🚪 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
