import { LinkGenerator, COLLABORATION_CONFIG } from './linkGenerator';

export class CollaborationService {
  constructor() {
    this.linkGenerator = new LinkGenerator();
    this._initialized = false;
  }

  /**
   * Initialize the collaboration service
   */
  initialize() {
    if (this._initialized) return;
    
    console.log('🚀 Initializing Collaboration Service...');
    this.linkGenerator.initialize();
    this.debugInfo();
    this._initialized = true;
  }

  /**
   * Debug information about the collaboration service
   */
  debugInfo() {
    console.log('🔍 COLLABORATION SERVICE DEBUG:');
    console.log('  - Running in window:', typeof window !== 'undefined');
    console.log('  - electronAPI exists:', typeof window !== 'undefined' && !!window.electronAPI);
    console.log('  - electronAPI.isElectron:', typeof window !== 'undefined' && window.electronAPI?.isElectron);
    console.log('  - electronAPI.documents:', typeof window !== 'undefined' && !!window.electronAPI?.documents);
    console.log('  - SIGNALING_SERVER:', COLLABORATION_CONFIG.SIGNALING_SERVER);
    console.log('  - LinkGenerator initialized:', this.linkGenerator.initialized);
  }

  /**
   * Check if running in Electron environment
   */
  get isElectron() {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron;
  }

  /**
   * Get browser-based storage for collaboration data
   * @returns {Map} - Map containing collaboration documents
   */
  getBrowserStorage() {
    if (typeof localStorage === 'undefined') return new Map();
    
    try {
      const stored = localStorage.getItem('collaboration_documents');
      return stored ? new Map(JSON.parse(stored)) : new Map();
    } catch (error) {
      console.error('Failed to parse collaboration storage:', error);
      return new Map();
    }
  }

  /**
   * Save collaboration documents to browser storage
   * @param {Map} docs - Map of collaboration documents
   */
  setBrowserStorage(docs) {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem('collaboration_documents', JSON.stringify([...docs]));
    } catch (error) {
      console.error('Failed to save collaboration storage:', error);
    }
  }

  /**
   * Enable collaboration for a document
   * @param {string} documentId - The document ID
   * @param {string} documentTitle - The document title (optional)
   * @returns {Promise<Object|null>} - The collaboration data or null if failed
   */
  async enableCollaboration(documentId, documentTitle = 'Untitled') {
    if (!this._initialized) this.initialize();
    
    console.log('🔍 EnableCollaboration called with:', { documentId, documentTitle });

    if (!documentId) {
      console.warn('❌ No documentId provided');
      return null;
    }

    try {
      let collaborationData;

      // Try to load existing collaboration data
      if (this.isElectron) {
        console.log('📱 Using Electron document storage');
        const currentDoc = await window.electronAPI.documents.load(documentId);
        collaborationData = currentDoc?.metadata?.collaboration;
      } else {
        console.log('🌐 Using browser fallback storage');
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId);
        collaborationData = docData?.collaboration;
      }
      
      // Create new collaboration if none exists
      if (!collaborationData) {
        console.log('🆕 Creating new collaboration for document:', documentId);
        
        const permanentLink = await this.linkGenerator.generatePermanentLink(documentId);
        
        collaborationData = {
          enabled: true,
          roomId: permanentLink.roomId,
          owner: await this.getDeviceId(),
          createdAt: Date.now(),
          permanentLinks: [permanentLink],
          invitations: [],
          collaborators: [],
          lastActivity: Date.now()
        };

        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
        console.log('✅ Collaboration enabled successfully');
        console.log('🔍 Collaboration data created:', collaborationData);
      } else {
        console.log('📄 Collaboration already exists for document:', documentId);
        console.log('🔍 Existing collaboration data:', collaborationData);
        
        // Update last activity
        collaborationData.lastActivity = Date.now();
        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
      }

      return collaborationData;
    } catch (error) {
      console.error('❌ Failed to enable collaboration:', error);
      return null;
    }
  }

  /**
   * Generate a new permanent link for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<Object|null>} - The permanent link or null if failed
   */
  async generatePermanentLink(documentId) {
    const collaboration = await this.enableCollaboration(documentId);
    if (!collaboration) return null;

    try {
      const link = await this.linkGenerator.generatePermanentLink(documentId, collaboration.roomId);
      collaboration.permanentLinks.push(link);
      collaboration.lastActivity = Date.now();
      await this.saveCollaborationMetadata(documentId, collaboration);

      console.log('✅ Generated permanent link:', link.linkId);
      return link;
    } catch (error) {
      console.error('❌ Failed to generate permanent link:', error);
      return null;
    }
  }

  /**
   * Generate an invitation link for a document
   * @param {string} documentId - The document ID
   * @param {string[]} permissions - Array of permissions ['read', 'write']
   * @param {string} recipientName - Optional recipient name
   * @returns {Promise<Object|null>} - The invitation link or null if failed
   */
  async generateInvitationLink(documentId, permissions = ['read', 'write'], recipientName = null) {
    const collaboration = await this.enableCollaboration(documentId);
    if (!collaboration) return null;

    try {
      const invitation = await this.linkGenerator.generateInvitationLink(
        documentId, 
        collaboration.roomId, 
        permissions, 
        recipientName
      );

      collaboration.invitations.push(invitation);
      collaboration.lastActivity = Date.now();
      await this.saveCollaborationMetadata(documentId, collaboration);

      console.log('✅ Generated invitation link:', invitation.invitationId);
      return invitation;
    } catch (error) {
      console.error('❌ Failed to generate invitation link:', error);
      return null;
    }
  }

  /**
   * Save collaboration metadata to storage
   * @param {string} documentId - The document ID
   * @param {Object} collaborationData - The collaboration data
   * @param {string} documentTitle - The document title
   */
  async saveCollaborationMetadata(documentId, collaborationData, documentTitle = 'Untitled') {
    try {
      if (this.isElectron && window.electronAPI?.documents) {
        console.log('💾 Saving to Electron storage');
        const currentDoc = await window.electronAPI.documents.load(documentId);
        if (currentDoc) {
          const updatedMetadata = {
            ...currentDoc.metadata,
            collaboration: collaborationData,
            lastModified: Date.now()
          };
          await window.electronAPI.documents.save(documentId, currentDoc.state, updatedMetadata);
        }
      } else {
        console.log('💾 Saving to browser storage');
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId) || { 
          title: documentTitle, 
          created: Date.now() 
        };
        
        docData.collaboration = collaborationData;
        docData.lastModified = Date.now();
        
        browserDocs.set(documentId, docData);
        this.setBrowserStorage(browserDocs);
      }
      
      console.log('💾 Collaboration metadata saved successfully');
    } catch (error) {
      console.error('❌ Failed to save collaboration metadata:', error);
    }
  }

  /**
   * Get a unique device ID
   * @returns {Promise<string>} - The device ID
   */
  async getDeviceId() {
    if (this.isElectron && window.electronAPI?.getDeviceId) {
      try {
        return await window.electronAPI.getDeviceId();
      } catch (error) {
        console.warn('Failed to get device ID from Electron, using fallback');
      }
    }
    
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Get collaboration data for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<Object|null>} - The collaboration data or null
   */
  async getCollaborationData(documentId) {
    if (!documentId) return null;

    try {
      if (this.isElectron && window.electronAPI?.documents) {
        const doc = await window.electronAPI.documents.load(documentId);
        const collaboration = doc?.metadata?.collaboration || null;
        console.log('📋 Retrieved collaboration data (Electron):', collaboration);
        return collaboration;
      } else {
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId);
        const collaboration = docData?.collaboration || null;
        console.log('📋 Retrieved collaboration data (Browser):', collaboration);
        return collaboration;
      }
    } catch (error) {
      console.error('Failed to get collaboration data:', error);
      return null;
    }
  }

  /**
   * Get the collaboration token for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<string|null>} - The collaboration token or null
   */
  async getCollaborationToken(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);
    if (collaborationData && collaborationData.permanentLinks?.length > 0) {
      const token = collaborationData.permanentLinks[0].token;
      
      // Check if token is still valid
      if (this.linkGenerator.isTokenValid(token)) {
        console.log('🎫 Retrieved valid collaboration token:', token.substring(0, 30) + '...');
        return token;
      } else {
        console.log('⚠️ Collaboration token expired, generating new one...');
        // Generate a new permanent link if the token is expired
        const newLink = await this.generatePermanentLink(documentId);
        return newLink?.token || null;
      }
    }
    console.log('❌ No collaboration token found for document:', documentId);
    return null;
  }

  /**
   * Get the collaboration room ID for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<string|null>} - The collaboration room ID or null
   */
  async getCollaborationRoomId(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);
    if (collaborationData && collaborationData.roomId) {
      console.log('🏠 Retrieved collaboration roomId:', collaborationData.roomId);
      return collaborationData.roomId;
    }
    console.log('❌ No collaboration roomId found for document:', documentId);
    return null;
  }

  /**
   * Check if collaboration is enabled for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<boolean>} - True if collaboration is enabled
   */
  async isCollaborationEnabled(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);
    return collaborationData?.enabled === true;
  }

  /**
   * Disable collaboration for a document
   * @param {string} documentId - The document ID
   * @returns {Promise<boolean>} - True if successfully disabled
   */
  async disableCollaboration(documentId) {
    try {
      const collaborationData = await this.getCollaborationData(documentId);
      if (!collaborationData) return true; // Already disabled

      collaborationData.enabled = false;
      collaborationData.disabledAt = Date.now();
      
      await this.saveCollaborationMetadata(documentId, collaborationData);
      console.log('✅ Collaboration disabled for document:', documentId);
      return true;
    } catch (error) {
      console.error('❌ Failed to disable collaboration:', error);
      return false;
    }
  }

  /**
   * Get all collaboration documents
   * @returns {Promise<Array>} - Array of collaboration documents
   */
  async getAllCollaborationDocuments() {
    try {
      if (this.isElectron) {
        // TODO: Implement Electron-specific method
        console.log('📱 Getting all documents from Electron storage');
        return [];
      } else {
        const browserDocs = this.getBrowserStorage();
        const documents = Array.from(browserDocs.entries()).map(([id, data]) => ({
          id,
          title: data.title,
          collaboration: data.collaboration,
          created: data.created,
          lastModified: data.lastModified
        })).filter(doc => doc.collaboration?.enabled);
        
        console.log('📋 Retrieved all collaboration documents:', documents.length);
        return documents;
      }
    } catch (error) {
      console.error('Failed to get all collaboration documents:', error);
      return [];
    }
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();
