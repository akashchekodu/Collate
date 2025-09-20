// electron/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Y = require('yjs'); // ✅ Add this import for Y.js
const DocumentStorage = require('./services/DocumentStorage');

// Set custom userData path
app.setPath('userData', 'D:/Collite');


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
function handleCollaborationUrl(url) {
  try {
    console.log('🤝 Handling collaboration URL:', url);
    
    // Parse: collate://collaborate?room=ABC&token=JWT&doc=DOC
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
    
    // Validate required parameters
    if (!room || !token || !doc) {
      console.error('❌ Invalid collaboration URL - missing required parameters');
      showErrorDialog('Invalid collaboration link', 'This collaboration link is missing required information.');
      return;
    }
    
    // Send to renderer process to join collaboration
    if (mainWindow) {
      mainWindow.webContents.send('join-collaboration', {
        room,
        token,
        documentId: doc,
        timestamp: Date.now(),
        source: 'protocol-handler'
      });
      
      // Show and focus window
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      
      console.log('✅ Collaboration join request sent to renderer');
    } else {
      console.error('❌ No main window available for collaboration');
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

// ✅ Single app.whenReady() - removed duplicate
app.whenReady().then(async () => {
  console.log('⚡ App ready, initializing document storage...');
  
  try {
    documentStorage = new DocumentStorage();
    console.log('✅ DocumentStorage initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize DocumentStorage:', error);
  }

  createWindow();

  // ✅ Fixed IPC Handlers with proper Y.js usage
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

  ipcMain.handle('documents:load', async (event, documentId) => {
    try {
      const result = await documentStorage.loadDocument(documentId);
      if (result) {
        // ✅ Now Y is properly imported, this works
        return {
          state: result.state, // Already serialized as array
          metadata: result.metadata
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error loading document:', error);
      return null; // Don't throw, return null instead
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
  // Add this IPC handler to main.js after existing handlers
ipcMain.handle('collaboration:test-join', async (event, testParams) => {
  try {
    console.log('🧪 Manual collaboration test triggered:', testParams);
    
    const { room, token, documentId } = testParams;
    
    // Validate test parameters
    if (!room || !token || !documentId) {
      console.error('❌ Missing test parameters');
      return { success: false, error: 'Missing required parameters' };
    }
    
    // Use existing handleCollaborationUrl logic
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


  ipcMain.handle('documents:delete', async (event, documentId) => {
    try {
      const success = await documentStorage.deleteDocument(documentId);
      return { success };
    } catch (error) {
      console.error('❌ Error deleting document:', error);
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

  // electron/main.js - Add debug IPC handler
ipcMain.handle('documents:debug', async (event, documentId) => {
  try {
    console.log('🔍 Debug request for document:', documentId);
    
    // Check if document file exists
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
