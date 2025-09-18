// electron/services/DocumentStorage.js
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const Y = require('yjs');

class DocumentStorage {
  constructor() {
    this.documentsPath = path.join(app.getPath('userData'), 'documents');
    this.indexPath = path.join(app.getPath('userData'), 'index.json');
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
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

  // Generate unique document ID
  generateDocumentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  // Save Y.js document state
  async saveDocument(documentId, ydocState, metadata = {}) {
    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const backupPath = path.join(this.documentsPath, `${documentId}.md`);
      
      // Reconstruct Y.js document from state to extract text
      const tempDoc = new Y.Doc();
      if (ydocState && ydocState.length > 0) {
        const state = new Uint8Array(ydocState);
        Y.applyUpdate(tempDoc, state);
      }
      
      // Extract plain text for backup and analysis
      const ytext = tempDoc.getText(`editor-${documentId}`);
      const plainText = ytext.toString();
      
      // Calculate document statistics
      const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      const characters = plainText.length;
      const lines = plainText.split('\n').length;

      // Document data structure
      const documentData = {
        id: documentId,
        title: metadata.title || 'Untitled Document',
        state: ydocState, // Already in array format
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (metadata.version || 0) + 1,
        statistics: {
          words,
          characters,
          lines
        },
        tags: metadata.tags || [],
        favorite: metadata.favorite || false
      };

      // Save main document file
      await fs.writeFile(docPath, JSON.stringify(documentData, null, 2));
      
      // Save readable backup if content exists
      if (plainText.trim()) {
        const backupContent = `# ${documentData.title}\n\nCreated: ${documentData.createdAt}\nUpdated: ${documentData.updatedAt}\n\n---\n\n${plainText}`;
        await fs.writeFile(backupPath, backupContent);
      }
      
      // Update index
      await this.updateIndex(documentId, documentData);
      
      console.log('💾 Document saved:', documentId, `(${words} words)`);
      return documentData;
    } catch (error) {
      console.error('❌ Failed to save document:', error);
      throw error;
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
        ydoc,
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

  // Get all documents list
  async getAllDocuments() {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(indexData);
      
      // Sort by updated date (most recent first)
      const documents = Object.values(index)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      return documents;
    } catch (error) {
      console.error('❌ Failed to get documents:', error);
      return [];
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

  // Export document
  async exportDocument(documentId, format = 'md') {
    try {
      const result = await this.loadDocument(documentId);
      if (!result) return null;

      const { ydoc, metadata } = result;
      const ytext = ydoc.getText(`editor-${documentId}`);
      const content = ytext.toString();
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const safeTitle = metadata.title.replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${timestamp}.${format}`;
      
      return {
        filename,
        content,
        metadata
      };
    } catch (error) {
      console.error('❌ Failed to export document:', error);
      return null;
    }
  }

  // Create new document
  async createDocument(title = 'Untitled Document') {
    const documentId = this.generateDocumentId();
    const ydoc = new Y.Doc();
    
    // Initialize with empty content
    const ytext = ydoc.getText(`editor-${documentId}`);
    
    const metadata = {
      title,
      createdAt: new Date().toISOString(),
      version: 0
    };

    const state = Y.encodeStateAsUpdate(ydoc);
    const savedDoc = await this.saveDocument(documentId, Array.from(state), metadata);
    
    return {
      id: documentId,
      ydoc,
      metadata: savedDoc
    };
  }

  // Duplicate document
  async duplicateDocument(sourceDocumentId, newTitle) {
    try {
      const sourceResult = await this.loadDocument(sourceDocumentId);
      if (!sourceResult) return null;

      const newId = this.generateDocumentId();
      const state = Y.encodeStateAsUpdate(sourceResult.ydoc);
      
      const metadata = {
        title: newTitle || `${sourceResult.metadata.title} (Copy)`,
        createdAt: new Date().toISOString(),
        version: 0
      };

      return await this.saveDocument(newId, Array.from(state), metadata);
    } catch (error) {
      console.error('❌ Failed to duplicate document:', error);
      return null;
    }
  }
}

module.exports = DocumentStorage;
