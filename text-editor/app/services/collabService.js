import { LinkGenerator, COLLABORATION_CONFIG } from './linkGenerator';

export class CollaborationService {
  constructor() {
    this.linkGenerator = new LinkGenerator();
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) return;
    
    console.log('🚀 Initializing Collaboration Service...');
    this.linkGenerator.initialize();
    this.debugInfo();
    this._initialized = true;
  }

  debugInfo() {
    console.log('🔍 COLLABORATION SERVICE DEBUG:');
    console.log('  - Running in window:', typeof window !== 'undefined');
    console.log('  - electronAPI exists:', typeof window !== 'undefined' && !!window.electronAPI);
    console.log('  - electronAPI.isElectron:', typeof window !== 'undefined' && window.electronAPI?.isElectron);
    console.log('  - electronAPI.documents:', typeof window !== 'undefined' && !!window.electronAPI?.documents);
    console.log('  - SIGNALING_SERVER:', COLLABORATION_CONFIG.SIGNALING_SERVER);
    console.log('  - LinkGenerator initialized:', this.linkGenerator.initialized);
  }

  get isElectron() {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron;
  }

  /**
   * ✅ Main collaboration link generation method
   */
  async generateCollaborationLink(documentId, permissions = ['read', 'write']) {
    if (!this._initialized) this.initialize();
    
    console.log('🔗 Generating collaboration link for document:', documentId);

    try {
      const linkData = await this.linkGenerator.generateCollaborationLink(documentId, permissions);
      
      // Save collaboration metadata
      await this.saveCollaborationMetadata(documentId, {
        enabled: true,
        roomId: linkData.roomId,
        fieldName: linkData.fieldName,
        createdAt: linkData.createdAt,
        lastActivity: Date.now(),
        permissions: permissions,
        link: linkData
      });

      console.log('✅ Collaboration link generated successfully:', linkData.url);
      return linkData;
    } catch (error) {
      console.error('❌ Failed to generate collaboration link:', error);
      return null;
    }
  }

  /**
   * ✅ ADD: Generate permanent link (legacy compatibility method)
   */
  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    console.log('🔗 generatePermanentLink called - delegating to generateCollaborationLink');
    return await this.generateCollaborationLink(documentId, permissions);
  }

  /**
   * ✅ ADD: Generate invitation link (legacy compatibility method)  
   */
  async generateInvitationLink(documentId, roomId = null, permissions = ['read', 'write'], recipientName = null) {
    console.log('🔗 generateInvitationLink called - delegating to generateCollaborationLink');
    return await this.generateCollaborationLink(documentId, permissions);
  }

  /**
   * ✅ SIMPLIFIED: Enable collaboration with direct link generation
   */
  async enableCollaboration(documentId, documentTitle = 'Untitled') {
    if (!this._initialized) this.initialize();
    
    console.log('🔍 EnableCollaboration called with:', { documentId, documentTitle });

    if (!documentId) {
      console.warn('❌ No documentId provided');
      return null;
    }

    try {
      // Check if collaboration already exists
      let collaborationData = await this.getCollaborationData(documentId);
      
      if (!collaborationData) {
        // Generate new collaboration link
        const linkData = await this.generateCollaborationLink(documentId);
        
        collaborationData = {
          enabled: true,
          roomId: linkData.roomId,
          fieldName: linkData.fieldName,
          owner: await this.getDeviceId(),
          createdAt: linkData.createdAt,
          link: linkData,
          lastActivity: Date.now()
        };

        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
        console.log('✅ Collaboration enabled successfully');
      } else {
        console.log('📄 Collaboration already exists for document:', documentId);
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
   * Get collaboration token for URL detection
   */
  async getCollaborationToken(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);
    if (collaborationData && collaborationData.link?.token) {
      const token = collaborationData.link.token;
      
      // Check if token is still valid
      if (this.linkGenerator.isTokenValid(token)) {
        console.log('🎫 Retrieved valid collaboration token');
        return token;
      } else {
        console.log('⚠️ Collaboration token expired, generating new one...');
        // Generate a new link if the token is expired
        const newLink = await this.generateCollaborationLink(documentId);
        return newLink?.token || null;
      }
    }
    console.log('❌ No collaboration token found for document:', documentId);
    return null;
  }

  // Keep all other existing methods...
getBrowserStorage() {
  // ✅ CRITICAL FIX: Server-side safety
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.log('🖥️ Server-side execution - returning empty storage');
    return new Map();
  }
  
  try {
    const stored = localStorage.getItem('collaboration_documents');
    return stored ? new Map(JSON.parse(stored)) : new Map();
  } catch (error) {
    console.error('Failed to parse collaboration storage:', error);
    return new Map();
  }
}

setBrowserStorage(docs) {
  // ✅ CRITICAL FIX: Server-side safety
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.log('🖥️ Server-side execution - skipping storage');
    return;
  }
  
  try {
    localStorage.setItem('collaboration_documents', JSON.stringify([...docs]));
  } catch (error) {
    console.error('Failed to save collaboration storage:', error);
  }
}


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

async getDeviceId() {
  if (this.isElectron && window.electronAPI?.getDeviceId) {
    try {
      return await window.electronAPI.getDeviceId();
    } catch (error) {
      console.warn('Failed to get device ID from Electron, using fallback');
    }
  }
  
  // ✅ CRITICAL FIX: Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.log('🖥️ Running on server - generating temporary device ID');
    return `server_device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}


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
}

// Export singleton instance
export const collaborationService = new CollaborationService();
