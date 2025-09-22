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

      // Save collaboration metadata with session persistence
      await this.saveCollaborationMetadata(documentId, {
        enabled: true,
        mode: 'collaborative', // ✅ CHANGED: Remove "permanently-" prefix
        roomId: linkData.roomId,
        fieldName: linkData.fieldName,
        createdAt: linkData.createdAt,
        lastActivity: Date.now(),
        permissions: permissions,
        link: linkData,
        sessionPersistent: true // ✅ NEW: Track session persistence
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
      let collaborationData = await this.getCollaborationData(documentId);

      if (collaborationData) {
        // ✅ CLEAR: Session persistence and collaboration state
        collaborationData.enabled = false;
        collaborationData.mode = 'solo';
        collaborationData.sessionPersistent = false;
        collaborationData.disabledAt = Date.now();

        await this.saveCollaborationMetadata(documentId, collaborationData);
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
   * ✅ NEW: Generate one-time invitation link
   */
  async generateOneTimeInvitation(documentId, recipientName = null) {
    if (!this._initialized) this.initialize();

    console.log('🎫 Generating one-time invitation for:', documentId, 'recipient:', recipientName);

    try {
      // Generate the link
      const linkData = await this.linkGenerator.generateOneTimeLink(documentId, recipientName);

      // Get current collaboration data
      let collaborationData = await this.getCollaborationData(documentId);

      if (!collaborationData) {
        // Enable collaboration if not already enabled
        collaborationData = await this.enableCollaboration(documentId);
      }

      // Ensure links structure exists
      if (!collaborationData.links) {
        collaborationData.links = { permanent: [], oneTime: [] };
      }

      // Add to one-time links array
      collaborationData.links.oneTime.push(linkData);
      collaborationData.lastActivity = Date.now();

      // Save to storage
      await this.saveCollaborationMetadata(documentId, collaborationData);

      console.log('✅ One-time invitation created and saved');
      return linkData;

    } catch (error) {
      console.error('❌ Failed to generate one-time invitation:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: Generate long-expiry permanent link
   */
  async generateLongExpiryLink(documentId, permissions = ['read', 'write']) {
    if (!this._initialized) this.initialize();

    console.log('🔗 Generating long-expiry link for:', documentId, 'permissions:', permissions);

    try {
      // Generate the link
      const linkData = await this.linkGenerator.generateLongExpiryLink(documentId, permissions);

      // Get current collaboration data
      let collaborationData = await this.getCollaborationData(documentId);

      if (!collaborationData) {
        // Enable collaboration if not already enabled
        collaborationData = await this.enableCollaboration(documentId);
      }

      // Ensure links structure exists
      if (!collaborationData.links) {
        collaborationData.links = { permanent: [], oneTime: [] };
      }

      // Add to permanent links array
      collaborationData.links.permanent.push(linkData);
      collaborationData.lastActivity = Date.now();

      // Save to storage
      await this.saveCollaborationMetadata(documentId, collaborationData);

      console.log('✅ Long-expiry link created and saved');
      return linkData;

    } catch (error) {
      console.error('❌ Failed to generate long-expiry link:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: Mark one-time link as used
   */
  async markOneTimeLinkAsUsed(documentId, linkId, usedBy = 'unknown') {
    console.log('✅ Marking one-time link as used:', linkId, 'by:', usedBy);

    try {
      const collaborationData = await this.getCollaborationData(documentId);
      if (!collaborationData?.links?.oneTime) return false;

      // Find and mark the link as used
      const linkIndex = collaborationData.links.oneTime.findIndex(
        link => link.linkId === linkId
      );

      if (linkIndex !== -1) {
        collaborationData.links.oneTime[linkIndex].used = true;
        collaborationData.links.oneTime[linkIndex].usedAt = Date.now();
        collaborationData.links.oneTime[linkIndex].usedBy = usedBy;

        // Save updated data
        await this.saveCollaborationMetadata(documentId, collaborationData);

        console.log('✅ One-time link marked as used successfully');
        return true;
      }

      console.warn('⚠️ One-time link not found:', linkId);
      return false;

    } catch (error) {
      console.error('❌ Failed to mark one-time link as used:', error);
      return false;
    }
  }

  /**
   * ✅ NEW: Get enhanced collaboration data with links
   */
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

  /**
   * ✅ SIMPLIFIED: Enable collaboration with session persistence
   */
  // ✅ ENHANCED: Make sure enableCollaboration always generates a link
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
        // ✅ ALWAYS: Generate new collaboration link if no valid token exists
        console.log('🔗 Generating new collaboration link...');
        const linkData = await this.generateCollaborationLink(documentId);

        collaborationData = {
          enabled: true,
          mode: 'collaborative',
          roomId: linkData.roomId,
          fieldName: linkData.fieldName,
          owner: await this.getDeviceId(),
          createdAt: linkData.createdAt,
          link: linkData,
          lastActivity: Date.now(),
          sessionPersistent: true
        };

        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
        console.log('✅ New collaboration enabled successfully');
      } else {
        console.log('📄 Collaboration already exists for document:', documentId);
        // ✅ ENSURE: Session persistence is enabled
        collaborationData.enabled = true;
        collaborationData.sessionPersistent = true;
        collaborationData.lastActivity = Date.now();
        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
      }

      // ✅ VERIFY: Always return collaboration data with valid link
      if (!collaborationData.link?.token) {
        throw new Error('Collaboration data missing valid token');
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
