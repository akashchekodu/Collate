// electron/services/DocumentStorage.js
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const Y = require('yjs');

const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');


class DocumentStorage {
  constructor() {
    // Use custom path instead of app.getPath('userData')
    const customBasePath = path.join(dataHome, 'Collite');
    
    this.documentsPath = path.join(customBasePath, 'documents');
    this.indexPath = path.join(customBasePath, 'index.json');
    this.settingsPath = path.join(customBasePath, 'settings.json');
    this.currentFolderPath = null;
    this.init();
  }

  async init() {
    try {
      // Create documents directory if it doesn't exist
      await fs.mkdir(this.documentsPath, { recursive: true });
      console.log('📁 Document storage path:', this.documentsPath);
      
      // Initialize index file if it doesn't exist
      try {
        await fs.access(this.indexPath);
      } catch {
        await this.saveIndex({});
        console.log('📋 Created new document index');
      }

      // Initialize settings file
      try {
        await fs.access(this.settingsPath);
      } catch {
        await this.saveSettings({
          autoSaveInterval: 2000,
          backupEnabled: true,
          maxRecentDocuments: 20
        });
      }
      
      console.log('✅ Document storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize document storage:', error);
    }
  }
 setCurrentFolder(folderPath) {
    this.currentFolderPath = folderPath;
    console.log('📁 Current folder set to:', folderPath);
  }
    getCurrentFolder() {
    return this.currentFolderPath;
  }

  // Generate unique document ID
  generateDocumentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  async updateDocumentTitle(documentId, newTitle) {
  try {
    const docPath = path.join(this.documentsPath, `${documentId}.json`);
    const data = await fs.readFile(docPath, 'utf-8');
    const documentData = JSON.parse(data);
    
    // Update title and timestamp
    documentData.title = newTitle;
    documentData.updatedAt = new Date().toISOString();
    documentData.version = (documentData.version || 0) + 1;
    
    // Save updated document
    await fs.writeFile(docPath, JSON.stringify(documentData, null, 2));
    
    // Update index
    await this.updateIndex(documentId, documentData);
    
    console.log('📝 Document title updated:', documentId, '->', newTitle);
    return { success: true, title: newTitle };
  } catch (error) {
    console.error('❌ Failed to update document title:', error);
    return { success: false, error: error.message };
  }
}


  // Save Y.js document state with TipTap HTML conversion
  async saveDocument(documentId, ydocState, metadata = {}) {
    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const backupPath = path.join(this.documentsPath, `${documentId}.md`);
      console.log( "SOmethig ascasc", documentId)
      console.log( "SOmethig ascasc", ydocState)
      console.log( "SOmethig ascasc", metadata)
      let plainText = '';
      
      if (ydocState && ydocState.length > 0) {
        try {
          console.log('🔍 Processing state array length:', ydocState.length);
          const state = new Uint8Array(ydocState);
          const tempDoc = new Y.Doc();
          Y.applyUpdate(tempDoc, state);
          
          const fieldName = `editor-${documentId}`;
          console.log('🔍 Reconstructing field:', fieldName);
          console.log('🔍 Available shared types:', Array.from(tempDoc.share.keys()));
          
          if (tempDoc.share.has(fieldName)) {
            const ytext = tempDoc.share.get(fieldName);
            const rawContent = ytext.toString();
            
            console.log('📄 Raw content type:', typeof rawContent);
            console.log('📄 Raw content length:', rawContent.length);
            console.log('📄 Raw content preview:', JSON.stringify(rawContent.slice(0, 200)));
            
            // Convert TipTap HTML markup to plain text
            plainText = this.convertTipTapHtmlToText(rawContent);
            
            console.log('📄 Final extracted text length:', plainText.length);
            console.log('📄 Final extracted text preview:', JSON.stringify(plainText.slice(0, 200)));
            
          } else {
            console.warn('⚠️ Field not found in reconstructed document:', fieldName);
          }
          
        } catch (error) {
          console.error('❌ Error reconstructing Y.js state:', error);
          plainText = '';
        }
      }
      
      // Calculate statistics
      const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      const characters = plainText.length;
      const lines = plainText.split('\n').length;

      const documentData = {
        id: documentId,
        title: metadata.title || 'Untitled Document',
        state: ydocState,
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (metadata.version || 0) + 1,
        statistics: { words, characters, lines },
        tags: metadata.tags || [],
        favorite: metadata.favorite || false
      };

      await fs.writeFile(docPath, JSON.stringify(documentData, null, 2));
      
      // Save backup with cleaned text content
      if (plainText.trim()) {
        const backupContent = `# ${documentData.title}\n\nCreated: ${documentData.createdAt}\nUpdated: ${documentData.updatedAt}\n\n---\n\n${plainText}`;
        await fs.writeFile(backupPath, backupContent);
        console.log('📝 Created backup file with', plainText.length, 'characters');
      } else {
        console.warn('⚠️ No content to backup - plainText is empty after extraction');
      }
      
      await this.updateIndex(documentId, documentData);
      console.log('💾 Document saved:', documentId, `(${words} words, ${characters} chars)`);
      return documentData;
      
    } catch (error) {
      console.error('❌ Failed to save document:', error);
      throw error;
    }
  }

  // Convert TipTap HTML markup to plain text
  convertTipTapHtmlToText(htmlContent) {
    try {
      if (!htmlContent || typeof htmlContent !== 'string') {
        return '';
      }
      
      console.log('🔧 Converting TipTap HTML to plain text');
      console.log('🔧 Input HTML:', JSON.stringify(htmlContent.slice(0, 100)));
      
      // Convert TipTap's specific HTML markup to plain text
      let cleanText = htmlContent
        // Replace paragraph tags with newlines
        .replace(/<paragraph[^>]*>/g, '')
        .replace(/<\/paragraph>/g, '\n')
        
        // Replace heading tags
        .replace(/<heading[^>]*>/g, '')
        .replace(/<\/heading>/g, '\n')
        
        // Replace list items
        .replace(/<listItem[^>]*>/g, '• ')
        .replace(/<\/listItem>/g, '\n')
        
        // Replace any remaining HTML tags
        .replace(/<[^>]+>/g, '')
        
        // Clean up extra whitespace and newlines
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple+ newlines with double
        .replace(/\n\s*\n/g, '\n\n')      // Normalize double newlines
        .trim();
      
      console.log('🔧 Output text length:', cleanText.length);
      console.log('🔧 Output text preview:', JSON.stringify(cleanText.slice(0, 100)));
      
      return cleanText;
      
    } catch (error) {
      console.error('❌ Error converting TipTap HTML to text:', error);
      return htmlContent; // Return original if conversion fails
    }
  }

  // Load Y.js document state
  async loadDocument(documentId) {
    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const data = await fs.readFile(docPath, 'utf-8');
      const documentData = JSON.parse(data);
      
      // Create new Y.Doc and apply state
      const ydoc = new Y.Doc();
      if (documentData.state && documentData.state.length > 0) {
        const state = new Uint8Array(documentData.state);
        Y.applyUpdate(ydoc, state);
      }
      
      console.log('📖 Document loaded:', documentId);
      return {
        state: documentData.state, // Return raw state for IPC
        metadata: {
          id: documentData.id,
          title: documentData.title,
          createdAt: documentData.createdAt,
          updatedAt: documentData.updatedAt,
          version: documentData.version,
          statistics: documentData.statistics,
          tags: documentData.tags || [],
          favorite: documentData.favorite || false
        }
      };
    } catch (error) {
      console.error('❌ Failed to load document:', error);
      return null;
    }
  }

  async getAllDocuments() {
    try {
      // If no current folder is set, use Collite internal storage
      if (!this.currentFolderPath) {
        console.log('📋 Loading from Collite storage...');
        const indexData = await fs.readFile(this.indexPath, 'utf-8');
        const index = JSON.parse(indexData);
        
        const documents = Object.values(index)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        console.log('📋 Retrieved Collite documents, count:', documents.length);
        return documents;
      }

      // ✅ NEW: Load documents from browsed folder
      console.log('📁 Loading documents from browsed folder:', this.currentFolderPath);
      
      const files = await fs.readdir(this.currentFolderPath);
      const textFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.txt', '.md', '.markdown', '.text'].includes(ext);
      });

      console.log('📄 Found text files:', textFiles.length);

      const documents = [];
      for (const fileName of textFiles) {
        const filePath = path.join(this.currentFolderPath, fileName);
        
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Calculate basic statistics
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          const characters = content.length;
          const lines = content.split('\n').length;

          documents.push({
            id: filePath, // Use file path as ID for browsed files
            title: path.basename(fileName, path.extname(fileName)),
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
            version: 1,
            statistics: { words, characters, lines },
            tags: ['external'],
            favorite: false,
            isExternal: true, // Mark as external file
            filePath: filePath // Store original path
          });
        } catch (error) {
          console.warn('⚠️ Failed to read file:', fileName, error.message);
        }
      }

      // Sort by modification date
      documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      console.log('📁 Retrieved browsed folder documents, count:', documents.length);
      return documents;
      
    } catch (error) {
      console.error('❌ Failed to get documents:', error);
      return [];
    }
  }

  // ✅ NEW: Load external file as document
  async loadExternalDocument(filePath) {
    try {
      console.log('📖 Loading external document:', filePath);
      
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));

      // Create a temporary Y.js document with the content
      const documentId = filePath;  // use absolute path as the ID
      const ydoc = new Y.Doc();
      const fieldName = `editor-${documentId}`;
      const ytext = ydoc.getText(fieldName);
      ytext.insert(0, content);
      
      const state = Array.from(Y.encodeStateAsUpdate(ydoc));
      
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const characters = content.length;
      const lines = content.split('\n').length;

      ytext.insert(0, content);
           
      console.log('📖 External document loaded:', filePath);
      return {
        state,
        metadata: {
          id: documentId,
          title: fileName,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          version: 1,
          statistics: { words, characters, lines }, // use defined vars
          tags: ['external'],
          favorite: false,
          isExternal: true,
          filePath
        }
      };
    } catch (error) {
      console.error('❌ Failed to load external document:', error);
      return null;
    }
  }

  // ✅ NEW: Save external document back to its original location
  async saveExternalDocument(filePath, ydocState) {
    try {
      console.log('💾 Saving external document:', filePath);
      
      // Reconstruct content from Y.js state
      let content = '';
      if (ydocState && ydocState.length > 0) {
        const tempDoc = new Y.Doc();
        const state = new Uint8Array(ydocState);
        Y.applyUpdate(tempDoc, state);
        
        const documentId = `external-${path.basename(filePath)}`;
        const fieldName = `editor-${documentId}`;
        
        if (tempDoc.share.has(fieldName)) {
          const ytext = tempDoc.share.get(fieldName);
          content = ytext.toString();
        }
      }

      // Save back to original file
      await fs.writeFile(filePath, content, 'utf-8');
      console.log('✅ External document saved:', filePath);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to save external document:', error);
      return { success: false, error: error.message };
    }
  }


  // Get recent documents
  async getRecentDocuments(limit = 10) {
    const allDocs = await this.getAllDocuments();
    return allDocs.slice(0, limit);
  }

  // Search documents
  async searchDocuments(query) {
    try {
      const allDocs = await this.getAllDocuments();
      const lowercaseQuery = query.toLowerCase();
      
      return allDocs.filter(doc => 
        doc.title.toLowerCase().includes(lowercaseQuery) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)))
      );
    } catch (error) {
      console.error('❌ Failed to search documents:', error);
      return [];
    }
  }

  // Update document index
  async updateIndex(documentId, documentData) {
    try {
      let index = {};
      try {
        const indexData = await fs.readFile(this.indexPath, 'utf-8');
        index = JSON.parse(indexData);
      } catch {
        // Index doesn't exist, start fresh
      }

      index[documentId] = {
        id: documentData.id,
        title: documentData.title,
        createdAt: documentData.createdAt,
        updatedAt: documentData.updatedAt,
        version: documentData.version,
        statistics: documentData.statistics,
        tags: documentData.tags,
        favorite: documentData.favorite
      };

      await this.saveIndex(index);
    } catch (error) {
      console.error('❌ Failed to update index:', error);
    }
  }

  async saveIndex(index) {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  async saveSettings(settings) {
    await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
  }

  // Delete document
  async deleteDocument(documentId) {
    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const backupPath = path.join(this.documentsPath, `${documentId}.md`);
      
      // Remove files
      await fs.unlink(docPath).catch(() => {});
      await fs.unlink(backupPath).catch(() => {});
      
      // Update index
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(indexData);
      delete index[documentId];
      await this.saveIndex(index);
      
      console.log('🗑️ Document deleted:', documentId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete document:', error);
      return false;
    }
  }

  // Export document with HTML conversion
  async exportDocument(documentId, format = 'md') {
    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const data = await fs.readFile(docPath, 'utf-8');
      const documentData = JSON.parse(data);
      
      if (!documentData) return null;

      // Reconstruct content and convert to plain text
      let content = '';
      if (documentData.state && documentData.state.length > 0) {
        const tempDoc = new Y.Doc();
        const state = new Uint8Array(documentData.state);
        Y.applyUpdate(tempDoc, state);
        
        const fieldName = `editor-${documentId}`;
        if (tempDoc.share.has(fieldName)) {
          const ytext = tempDoc.share.get(fieldName);
          const rawContent = ytext.toString();
          content = this.convertTipTapHtmlToText(rawContent);
        }
      }
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const safeTitle = documentData.title.replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${timestamp}.${format}`;
      
      return {
        filename,
        content,
        metadata: {
          title: documentData.title,
          createdAt: documentData.createdAt,
          updatedAt: documentData.updatedAt,
          version: documentData.version,
          statistics: documentData.statistics
        }
      };
    } catch (error) {
      console.error('❌ Failed to export document:', error);
      return null;
    }
  }

  // Create new document
  async createDocument(title = 'Untitled Document') {
    const documentId = this.generateDocumentId();
    
    const metadata = {
      title,
      createdAt: new Date().toISOString(),
      version: 0
    };

    // Save with empty state initially
    const savedDoc = await this.saveDocument(documentId, [], metadata);
    
    // Return only serializable data
    return {
      id: documentId,
      title: savedDoc.title,
      createdAt: savedDoc.createdAt,
      updatedAt: savedDoc.updatedAt,
      version: savedDoc.version
    };
  }

  // Duplicate document
  async duplicateDocument(sourceDocumentId, newTitle) {
    try {
      const sourceResult = await this.loadDocument(sourceDocumentId);
      if (!sourceResult) return null;

      const newId = this.generateDocumentId();
      const state = sourceResult.state; // Use the raw state
      
      const metadata = {
        title: newTitle || `${sourceResult.metadata.title} (Copy)`,
        createdAt: new Date().toISOString(),
        version: 0
      };

      return await this.saveDocument(newId, state, metadata);
    } catch (error) {
      console.error('❌ Failed to duplicate document:', error);
      return null;
    }
  }
}

module.exports = DocumentStorage;
