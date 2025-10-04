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
    console.log('  - Has updateCollaborationMetadata:', typeof window !== 'undefined' && !!window.electronAPI?.documents?.updateCollaborationMetadata);
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

      // ✅ ENHANCED: Save with immediate metadata update method
      await this.saveCollaborationMetadataImmediate(documentId, {
        enabled: true,
        mode: 'collaborative',
        roomId: linkData.roomId,
        fieldName: linkData.fieldName,
        createdAt: linkData.createdAt,
        lastActivity: new Date().toISOString(),
        permissions: permissions,
        link: linkData,
        sessionPersistent: true, // ✅ Critical for persistence
        links: { permanent: [], oneTime: [] },
        participants: [],
        revoked: [],
        schemaVersion: 2
      });

      console.log('✅ Collaboration link generated successfully:', linkData.url);
      return linkData;
    } catch (error) {
      console.error('❌ Failed to generate collaboration link:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: Disable collaboration (clear session persistence)
   */
  async disableCollaboration(documentId) {
    if (!this._initialized) this.initialize();

    console.log('🔄 Disabling collaboration for document:', documentId);

    try {
      // ✅ ENHANCED: Use immediate metadata update
      const success = await this.saveCollaborationMetadataImmediate(documentId, {
        enabled: false,
        mode: 'solo',
        sessionPersistent: false,
        disabledAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        link: null, // Clear the link
        schemaVersion: 2
      });

      if (success) {
        console.log('✅ Collaboration disabled successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to disable collaboration:', error);
      return false;
    }
  }

  /**
   * ✅ NEW: Check if collaboration should persist in session
   */
  async shouldCollaborationPersist(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);

    const shouldPersist = !!(
      collaborationData?.enabled &&
      collaborationData?.sessionPersistent &&
      collaborationData?.link?.token
    );

    console.log('🔍 Session persistence check:', {
      documentId: documentId.slice(0, 8) + '...',
      enabled: collaborationData?.enabled || false,
      sessionPersistent: collaborationData?.sessionPersistent || false,
      hasToken: !!(collaborationData?.link?.token),
      shouldPersist
    });

    return shouldPersist;
  }

  /**
   * ✅ ENHANCED: Immediate metadata saving with new IPC method
   */
  async saveCollaborationMetadataImmediate(documentId, collaborationData) {
    if (!documentId) {
      console.error('❌ No documentId provided for metadata save');
      return false;
    }

    try {
      console.log('💾 Saving collaboration metadata immediately:', {
        documentId: documentId.slice(0, 8) + '...',
        mode: collaborationData.mode,
        enabled: collaborationData.enabled,
        sessionPersistent: collaborationData.sessionPersistent
      });

      if (this.isElectron && window.electronAPI?.documents?.updateCollaborationMetadata) {
        // ✅ PREFERRED: Use new immediate IPC method
        const success = await window.electronAPI.documents.updateCollaborationMetadata(
          documentId, 
          collaborationData
        );

        if (success) {
          console.log('✅ Immediate metadata save via IPC successful');
          return true;
        } else {
          console.warn('⚠️ IPC metadata save failed, trying fallback');
          // Fall through to legacy method
        }
      }

      // ✅ FALLBACK: Use legacy save method
      if (this.isElectron && window.electronAPI?.documents) {
        console.log('💾 Using legacy Electron save method');
        const currentDoc = await window.electronAPI.documents.load(documentId);
        if (currentDoc) {
          const updatedMetadata = {
            ...currentDoc.metadata,
            collaboration: {
              ...currentDoc.metadata?.collaboration,
              ...collaborationData
            },
            lastModified: new Date().toISOString()
          };
          await window.electronAPI.documents.save(documentId, currentDoc.state, updatedMetadata);
          console.log('✅ Legacy Electron save successful');
          return true;
        }
      } else {
        // ✅ BROWSER: Use browser storage
        console.log('💾 Saving to browser storage');
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId) || {
          title: 'Untitled Document',
          created: Date.now()
        };

        docData.collaboration = collaborationData;
        docData.lastModified = Date.now();

        browserDocs.set(documentId, docData);
        this.setBrowserStorage(browserDocs);
        console.log('✅ Browser storage save successful');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to save collaboration metadata immediately:', error);
      return false;
    }
  }

  /**
   * ✅ SIMPLIFIED: Enable collaboration with session persistence
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

      if (!collaborationData || !collaborationData.link?.token) {
        // ✅ Generate new collaboration link if no valid token exists
        console.log('🔗 Generating new collaboration link...');
        return await this.generateCollaborationLink(documentId);
      } else {
        console.log('📄 Collaboration already exists, ensuring session persistence');
        // ✅ ENSURE: Session persistence is enabled
        const success = await this.saveCollaborationMetadataImmediate(documentId, {
          ...collaborationData,
          enabled: true,
          sessionPersistent: true,
          lastActivity: new Date().toISOString()
        });

        if (success) {
          return collaborationData;
        }
      }

      return null;
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

  /**
   * ✅ LEGACY: Keep original save method for backward compatibility
   */
  async saveCollaborationMetadata(documentId, collaborationData, documentTitle = 'Untitled') {
    // Delegate to immediate save method
    return await this.saveCollaborationMetadataImmediate(documentId, collaborationData);
  }

  // ✅ Keep all other existing methods unchanged...
  getBrowserStorage() {
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

  async getDeviceId() {
    if (this.isElectron && window.electronAPI?.getDeviceId) {
      try {
        return await window.electronAPI.getDeviceId();
      } catch (error) {
        console.warn('Failed to get device ID from Electron, using fallback');
      }
    }

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
        console.log('📋 Retrieved collaboration data (Electron):', {
          documentId: documentId.slice(0, 8) + '...',
          hasCollaboration: !!collaboration,
          mode: collaboration?.mode,
          enabled: collaboration?.enabled,
          sessionPersistent: collaboration?.sessionPersistent
        });
        return collaboration;
      } else {
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId);
        const collaboration = docData?.collaboration || null;
        console.log('📋 Retrieved collaboration data (Browser):', {
          documentId: documentId.slice(0, 8) + '...',
          hasCollaboration: !!collaboration,
          mode: collaboration?.mode,
          enabled: collaboration?.enabled,
          sessionPersistent: collaboration?.sessionPersistent
        });
        return collaboration;
      }
    } catch (error) {
      console.error('Failed to get collaboration data:', error);
      return null;
    }
  }

  // ✅ Keep all other methods like generateOneTimeInvitation, generateLongExpiryLink, etc.
  async generateOneTimeInvitation(documentId, recipientName = null) {
    if (!this._initialized) this.initialize();

    console.log('🎫 Generating one-time invitation for:', documentId, 'recipient:', recipientName);

    try {
      const linkData = await this.linkGenerator.generateOneTimeLink(documentId, recipientName);
      let collaborationData = await this.getCollaborationData(documentId);

      if (!collaborationData) {
        collaborationData = await this.enableCollaboration(documentId);
      }

      if (!collaborationData.links) {
        collaborationData.links = { permanent: [], oneTime: [] };
      }

      collaborationData.links.oneTime.push(linkData);
      collaborationData.lastActivity = new Date().toISOString();

      await this.saveCollaborationMetadataImmediate(documentId, collaborationData);

      console.log('✅ One-time invitation created and saved');
      return linkData;

    } catch (error) {
      console.error('❌ Failed to generate one-time invitation:', error);
      return null;
    }
  }

  async generateLongExpiryLink(documentId, permissions = ['read', 'write']) {
    if (!this._initialized) this.initialize();

    console.log('🔗 Generating long-expiry link for:', documentId, 'permissions:', permissions);

    try {
      const linkData = await this.linkGenerator.generateLongExpiryLink(documentId, permissions);
      let collaborationData = await this.getCollaborationData(documentId);

      if (!collaborationData) {
        collaborationData = await this.enableCollaboration(documentId);
      }

      if (!collaborationData.links) {
        collaborationData.links = { permanent: [], oneTime: [] };
      }

      collaborationData.links.permanent.push(linkData);
      collaborationData.lastActivity = new Date().toISOString();

      await this.saveCollaborationMetadataImmediate(documentId, collaborationData);

      console.log('✅ Long-expiry link created and saved');
      return linkData;

    } catch (error) {
      console.error('❌ Failed to generate long-expiry link:', error);
      return null;
    }
  }

  async getEnhancedCollaborationData(documentId) {
    const collaborationData = await this.getCollaborationData(documentId);

    if (!collaborationData) {
      return {
        enabled: false,
        mode: 'solo',
        sessionPersistent: false,
        links: { permanent: [], oneTime: [] },
        participants: [],
        revoked: []
      };
    }

    // Ensure all required fields exist
    if (!collaborationData.links) {
      collaborationData.links = { permanent: [], oneTime: [] };
    }
    if (!collaborationData.participants) {
      collaborationData.participants = [];
    }
    if (!collaborationData.revoked) {
      collaborationData.revoked = [];
    }

    return collaborationData;
  }

  // ✅ Legacy compatibility methods
  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    console.log('🔗 generatePermanentLink called - delegating to generateCollaborationLink');
    return await this.generateCollaborationLink(documentId, permissions);
  }

  async generateInvitationLink(documentId, roomId = null, permissions = ['read', 'write'], recipientName = null) {
    console.log('🔗 generateInvitationLink called - delegating to generateCollaborationLink');
    return await this.generateCollaborationLink(documentId, permissions);
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();
