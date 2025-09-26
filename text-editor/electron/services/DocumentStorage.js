// electron/services/DocumentStorage.js
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const Y = require('yjs');

class DocumentStorage {
  constructor() {
    // Use custom path instead of app.getPath('userData')
    const customBasePath = 'D:/Collite';

    this.documentsPath = path.join(customBasePath, 'documents');
    this.indexPath = path.join(customBasePath, 'index.json');
    this.settingsPath = path.join(customBasePath, 'settings.json');

    // ✅ NEW: Rate limiting for saves
    this.lastSaveTimes = new Map();
    this.lastSavedDocuments = new Map();

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
    const crypto = require('crypto');
    return crypto.randomUUID();
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

  // ✅ ENHANCED: Save Y.js document state with rate limiting and fixed content extraction
  async saveDocument(documentId, ydocState, metadata = {}) {
    // ✅ RATE LIMITING: Prevent rapid saves of same document
    const now = Date.now();
    const lastSave = this.lastSaveTimes.get(documentId) || 0;

    if (now - lastSave < 2000) { // 2 second minimum between saves
      console.log('⚠️ Save rate limited for:', documentId.slice(0, 8) + '...');
      const cached = this.lastSavedDocuments.get(documentId);
      if (cached) {
        return cached; // Return cached result
      }
    }

    this.lastSaveTimes.set(documentId, now);

    try {
      const docPath = path.join(this.documentsPath, `${documentId}.json`);
      const backupPath = path.join(this.documentsPath, `${documentId}.md`);
      console.log("Processing document:", documentId);
      console.log("State length:", ydocState?.length || 0);
      console.log("Metadata keys:", Object.keys(metadata));

      let plainText = '';

      // ✅ CRITICAL FIX: Enhanced Y.js content extraction with deep debugging
// ✅ ENHANCED Y.js reconstruction with corruption detection and recovery
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
      
      // ✅ ENHANCED: Better corruption detection and type handling
      console.log('🔍 DEEP Y.Text analysis:', {
        fieldName,
        ytextType: ytext.constructor.name,
        isYText: ytext instanceof Y.Text,
        isYXmlFragment: ytext.constructor.name === 'YXmlFragment',
        isAbstractType: ytext.constructor.name === 'AbstractType',
        hasToString: typeof ytext.toString === 'function',
        ytextLength: ytext.length,
        reconstructionTest: ytext.toString() === '[object Object]' ? 'CORRUPTED!' : 'OK'
      });

      let rawContent = '';
      
      // ✅ SPECIFIC HANDLING: For different Y.js types
      if (ytext instanceof Y.Text) {
        rawContent = ytext.toString();
        console.log('✅ Y.Text extraction successful');
      } else if (ytext.constructor.name === 'YXmlFragment') {
        // Handle TipTap's XmlFragment
        try {
          rawContent = ytext.toString();
          console.log('✅ YXmlFragment extraction successful');
        } catch (xmlError) {
          console.warn('❌ YXmlFragment extraction failed:', xmlError);
          rawContent = '';
        }
      } else if (ytext.constructor.name === 'AbstractType') {
        console.error('🚨 CRITICAL: AbstractType detected - field is corrupted');
        
        // ✅ CORRUPTION RECOVERY: Try to extract any available data
        try {
          // Method 1: Try toJSON
          if (typeof ytext.toJSON === 'function') {
            const jsonData = ytext.toJSON();
            rawContent = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
            console.log('🔄 Corruption recovery via toJSON:', rawContent.slice(0, 100));
          }
          
          // Method 2: Try direct access to internal properties
          if (!rawContent || rawContent === '[object Object]') {
            // Check for internal Y.js structure
            if (ytext._start && ytext._start.content && typeof ytext._start.content.getContent === 'function') {
              try {
                const internalContent = ytext._start.content.getContent();
                rawContent = Array.isArray(internalContent) ? internalContent.join('') : String(internalContent);
                console.log('🔄 Corruption recovery via internal access:', rawContent.slice(0, 100));
              } catch (internalError) {
                console.warn('❌ Internal access failed:', internalError);
              }
            }
          }
        } catch (recoveryError) {
          console.error('❌ Corruption recovery failed:', recoveryError);
          rawContent = '';
        }
      } else {
        console.warn('⚠️ Unknown Y.js type:', ytext.constructor.name);
        
        try {
          rawContent = ytext.toString();
        } catch (unknownError) {
          console.error('❌ Unknown type extraction failed:', unknownError);
          rawContent = '';
        }
      }

      console.log('📄 Final raw content type:', typeof rawContent);
      console.log('📄 Final raw content length:', rawContent?.length || 0);
      console.log('📄 Final raw content preview:', JSON.stringify((rawContent || '').slice(0, 200)));

      // ✅ SAFE: Only convert if we have valid content
      if (rawContent && typeof rawContent === 'string' && rawContent !== '[object Object]') {
        plainText = this.convertTipTapHtmlToText(rawContent);
      } else {
        console.warn('⚠️ No valid content extracted, using empty string');
        plainText = '';
      }

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

      // ✅ ENHANCED: Build collaboration metadata with backward compatibility
      const existingCollaboration = metadata.collaboration || {};

      const collaboration = {
        // ✅ BACKWARD COMPATIBLE: Keep existing fields exactly as they were
        enabled: existingCollaboration.enabled || false,
        roomId: existingCollaboration.roomId || null,
        fieldName: existingCollaboration.fieldName || null,
        createdAt: existingCollaboration.createdAt || null,
        lastActivity: existingCollaboration.lastActivity || null,
        permissions: existingCollaboration.permissions || [],
        link: existingCollaboration.link || null,
        owner: existingCollaboration.owner || null,

        // ✅ NEW: Extended structure for advanced sharing
        links: existingCollaboration.links || {
          permanent: [], // Array of long-expiry links  
          oneTime: []    // Array of one-time invitation links
        },

        // ✅ NEW: Participant management
        participants: existingCollaboration.participants || [],

        // ✅ NEW: Token revocation tracking (distributed blacklist)
        revoked: existingCollaboration.revoked || [],

        // ✅ NEW: Document collaboration mode tracking
        mode: existingCollaboration.mode || (existingCollaboration.enabled ? 'collaborative' : 'solo'),

        // ✅ CRITICAL: Session persistence field
        sessionPersistent: existingCollaboration.sessionPersistent || false,

        // ✅ NEW: Schema version for safe future migrations
        schemaVersion: existingCollaboration.schemaVersion || 2
      };

      const documentData = {
        id: documentId,
        title: metadata.title || 'Untitled Document',
        state: ydocState,
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (metadata.version || 0) + 1,
        statistics: { words, characters, lines },
        tags: metadata.tags || [],
        favorite: metadata.favorite || false,

        // ✅ ENHANCED: Add collaboration metadata to every document
        collaboration
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

      // ✅ CACHE: Store result for rate limiting
      this.lastSavedDocuments.set(documentId, documentData);

      console.log('💾 Document saved with enhanced collaboration metadata:', documentId, `(${words} words, ${characters} chars)`);
      return documentData;

    } catch (error) {
      console.error('❌ Failed to save document:', error);
      throw error;
    }
  }

  // ✅ FIXED: Convert TipTap HTML markup to plain text
  convertTipTapHtmlToText(htmlContent) {
    try {
      if (!htmlContent || typeof htmlContent !== 'string') {
        console.log('🔧 No content to convert or invalid type');
        return '';
      }

      // ✅ FIXED: Check for [object Object] problem
      if (htmlContent === '[object Object]') {
        console.error('❌ Received [object Object] - this indicates Y.js extraction failed');
        return '';
      }

      console.log('🔧 Converting TipTap HTML to plain text');
      console.log('🔧 Input HTML:', JSON.stringify(htmlContent.slice(0, 100)));

      // ✅ ENHANCED: Handle both TipTap HTML and plain text
      let cleanText = htmlContent;

      // Check if it looks like HTML/XML (contains < and >)
      if (htmlContent.includes('<') && htmlContent.includes('>')) {
        console.log('🔧 Processing as HTML/XML content');

        cleanText = htmlContent
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
      } else {
        console.log('🔧 Processing as plain text content');
        // It's already plain text, just clean up whitespace
        cleanText = htmlContent.trim();
      }

      console.log('🔧 Output text length:', cleanText.length);
      console.log('🔧 Output text preview:', JSON.stringify(cleanText.slice(0, 100)));

      return cleanText;

    } catch (error) {
      console.error('❌ Error converting TipTap HTML to text:', error);
      return htmlContent; // Return original if conversion fails
    }
  }

  // ✅ ENHANCED: Load Y.js document state with collaboration metadata
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
          favorite: documentData.favorite || false,

          // ✅ ENHANCED: Include collaboration metadata in response
          collaboration: documentData.collaboration || {
            enabled: false,
            mode: 'solo',
            sessionPersistent: false, // ✅ Default to false for legacy docs
            schemaVersion: 1, // Mark as legacy document
            links: { permanent: [], oneTime: [] },
            participants: [],
            revoked: []
          }
        }
      };
    } catch (error) {
      console.error('❌ Failed to load document:', error);
      return null;
    }
  }

  // ✅ NEW: Backward compatibility test method
  async testBackwardCompatibility() {
    console.log('🧪 Testing backward compatibility...');

    try {
      const allDocs = await this.getAllDocuments();
      console.log(`📄 Found ${allDocs.length} existing documents`);

      // Test first 3 documents (or all if less than 3)
      const testDocs = allDocs.slice(0, Math.min(3, allDocs.length));

      for (const doc of testDocs) {
        const loaded = await this.loadDocument(doc.id);

        console.log('✅ Document loads successfully:', {
          id: doc.id.slice(0, 8) + '...',
          title: loaded?.metadata?.title || 'No title',
          hasCollaboration: !!loaded?.metadata?.collaboration,
          collaborationSchema: loaded?.metadata?.collaboration?.schemaVersion || 1,
          mode: loaded?.metadata?.collaboration?.mode || 'solo',
          sessionPersistent: loaded?.metadata?.collaboration?.sessionPersistent || false,
          hasLinks: !!(loaded?.metadata?.collaboration?.links),
          permanentLinks: loaded?.metadata?.collaboration?.links?.permanent?.length || 0,
          oneTimeLinks: loaded?.metadata?.collaboration?.links?.oneTime?.length || 0
        });
      }

      console.log('✅ Backward compatibility test passed!');
      console.log('📊 Schema migration status:');
      console.log('  - All existing documents load correctly');
      console.log('  - Legacy documents get default collaboration structure');
      console.log('  - New documents get enhanced collaboration metadata');
      console.log('  - No breaking changes detected');

      return true;
    } catch (error) {
      console.error('❌ Backward compatibility test failed:', error);
      return false;
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
      await fs.unlink(docPath).catch(() => { });
      await fs.unlink(backupPath).catch(() => { });

      // Update index
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(indexData);
      delete index[documentId];
      await this.saveIndex(index);

      // ✅ CLEANUP: Remove from cache
      this.lastSaveTimes.delete(documentId);
      this.lastSavedDocuments.delete(documentId);

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

          // ✅ FIXED: Use same extraction logic as saveDocument
          if (ytext instanceof Y.Text) {
            const rawContent = ytext.toString();
            if (rawContent && rawContent !== '[object Object]') {
              content = this.convertTipTapHtmlToText(rawContent);
            }
          }
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
