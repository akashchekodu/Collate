import { nanoid } from 'nanoid';

// JWT_SECRET must match signaling server
const JWT_SECRET = '41db8ba3fa459485fc41b2a98a2d705ea32ffe41600200506949fb70f5046f02db54eeff'; // ⚠️ MUST match signaling server

// Inline configuration
const COLLABORATION_CONFIG = {
  SIGNALING_SERVER: 'wss://signaling-server-production-af26.up.railway.app',
  WEB_CLIENT_URL: 'https://collate-p2p-landing.vercel.app',
  TOKEN_EXPIRY: {
    PERMANENT: 30 * 24 * 60 * 60 * 1000, // 30 days
    INVITATION: 7 * 24 * 60 * 60 * 1000   // 7 days
  }
};

const generateRoomId = () => `room_${Date.now()}_${nanoid(8)}`;
const generatePeerId = () => `peer_${Date.now()}_${nanoid(8)}`;

// Simple HMAC-SHA256 implementation for browser
async function hmacSha256(key, data) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  
  // Fallback for environments without crypto.subtle
  console.warn('Using insecure token signing - crypto.subtle not available');
  return btoa(`fallback-${Date.now()}`);
}

// Base64URL encoding
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

class LinkGenerator {
  // ✅ FIXED: Generate proper JWT tokens with peerId and real signature
  async generateValidToken(payload) {
    // Add required peerId field
    const enhancedPayload = {
      ...payload,
      peerId: generatePeerId(), // ✅ REQUIRED by signaling server
    };
    
    const header = { 
      alg: 'HS256',  // ✅ FIXED: Use proper algorithm instead of 'none'
      typ: 'JWT' 
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(enhancedPayload));
    
    // ✅ FIXED: Create real signature using JWT_SECRET
    const signature = await hmacSha256(JWT_SECRET, `${encodedHeader}.${encodedPayload}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    if (!roomId) roomId = generateRoomId();
    const linkId = `perm_${nanoid(10)}`;

    const payload = {
      type: 'permanent',
      linkId,
      roomId,
      documentId,  // ✅ KEPT: Required by signaling server
      permissions,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      iat: Math.floor(Date.now() / 1000),
      dev: true
    };

    // ✅ FIXED: Use proper JWT token generation
    const token = await this.generateValidToken(payload);
    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/join?room=${roomId}&token=${token}&doc=${documentId}`;

    return {
      type: 'permanent',
      linkId,
      roomId,
      url,
      token,
      permissions,
      expiresAt: Date.now() + COLLABORATION_CONFIG.TOKEN_EXPIRY.PERMANENT
    };
  }

  async generateInvitationLink(documentId, roomId, permissions = ['read', 'write'], recipientName = null) {
    const invitationId = `invite_${nanoid(10)}`;

    const payload = {
      type: 'invitation',
      invitationId,
      roomId,
      documentId,  // ✅ KEPT: Required by signaling server
      permissions,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
      iat: Math.floor(Date.now() / 1000),
      singleUse: true,
      dev: true
    };

    // ✅ FIXED: Use proper JWT token generation
    const token = await this.generateValidToken(payload);
    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/join?invite=${invitationId}&token=${token}&doc=${documentId}`;

    return {
      type: 'invitation',
      invitationId,
      roomId,
      url,
      token,
      permissions,
      recipientName,
      expiresAt: Date.now() + COLLABORATION_CONFIG.TOKEN_EXPIRY.INVITATION,
      used: false
    };
  }
}

export class CollaborationService {
  constructor() {
    this.linkGenerator = new LinkGenerator();
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) return;
    
    console.log('🚀 Initializing Collaboration Service...');
    this.debugInfo();
    this._initialized = true;
  }

  debugInfo() {
    console.log('🔍 COLLABORATION SERVICE DEBUG:');
    console.log('  - Running in window:', typeof window !== 'undefined');
    console.log('  - electronAPI exists:', typeof window !== 'undefined' && !!window.electronAPI);
    console.log('  - electronAPI.isElectron:', typeof window !== 'undefined' && window.electronAPI?.isElectron);
    console.log('  - electronAPI.documents:', typeof window !== 'undefined' && !!window.electronAPI?.documents);
    console.log('  - JWT_SECRET configured:', JWT_SECRET.substring(0, 10) + '...');
  }

  get isElectron() {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron;
  }

  getBrowserStorage() {
    if (typeof localStorage === 'undefined') return new Map();
    
    const stored = localStorage.getItem('collaboration_documents');
    return stored ? new Map(JSON.parse(stored)) : new Map();
  }

  setBrowserStorage(docs) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('collaboration_documents', JSON.stringify([...docs]));
  }

  async enableCollaboration(documentId, documentTitle) {
    if (!this._initialized) this.initialize();
    
    console.log('🔍 EnableCollaboration called with:', { documentId, documentTitle });

    if (!documentId) {
      console.warn('❌ No documentId provided');
      return null;
    }

    try {
      let collaborationData;

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
          collaborators: []
        };

        await this.saveCollaborationMetadata(documentId, collaborationData, documentTitle);
        console.log('✅ Collaboration enabled successfully');
      } else {
        console.log('📄 Collaboration already exists for document:', documentId);
      }

      return collaborationData;
    } catch (error) {
      console.error('❌ Failed to enable collaboration:', error);
      return null;
    }
  }

  async generatePermanentLink(documentId) {
    const collaboration = await this.enableCollaboration(documentId);
    if (!collaboration) return null;

    try {
      const link = await this.linkGenerator.generatePermanentLink(documentId, collaboration.roomId);
      collaboration.permanentLinks.push(link);
      await this.saveCollaborationMetadata(documentId, collaboration);

      console.log('✅ Generated permanent link:', link.linkId);
      return link;
    } catch (error) {
      console.error('❌ Failed to generate permanent link:', error);
      return null;
    }
  }

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
      await this.saveCollaborationMetadata(documentId, collaboration);

      console.log('✅ Generated invitation link:', invitation.invitationId);
      return invitation;
    } catch (error) {
      console.error('❌ Failed to generate invitation link:', error);
      return null;
    }
  }

  async saveCollaborationMetadata(documentId, collaborationData, documentTitle = 'Untitled') {
    try {
      if (this.isElectron && window.electronAPI.documents) {
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
      
      console.log('💾 Collaboration metadata saved');
    } catch (error) {
      console.error('❌ Failed to save collaboration metadata:', error);
    }
  }

  async getDeviceId() {
    if (this.isElectron && window.electronAPI.getDeviceId) {
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

  async getCollaborationData(documentId) {
    if (!documentId) return null;

    try {
      if (this.isElectron && window.electronAPI.documents) {
        const doc = await window.electronAPI.documents.load(documentId);
        return doc?.metadata?.collaboration || null;
      } else {
        const browserDocs = this.getBrowserStorage();
        const docData = browserDocs.get(documentId);
        return docData?.collaboration || null;
      }
    } catch (error) {
      console.error('Failed to get collaboration data:', error);
      return null;
    }
  }
}

export const collaborationService = new CollaborationService();
