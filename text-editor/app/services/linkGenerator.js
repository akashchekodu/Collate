import { nanoid } from 'nanoid';

// JWT_SECRET must match signaling server
const JWT_SECRET = '41db8ba3fa459485fc41b2a98a2d705ea32ffe41600200506949fb70f5046f02db54eeff';

// Configuration
export const COLLABORATION_CONFIG = {
  SIGNALING_SERVER: 'wss://signaling-server-production-af26.up.railway.app',
  WEB_CLIENT_URL: 'https://text-editor-nine-beta.vercel.app',
  TOKEN_EXPIRY: {
    PERMANENT: 30 * 24 * 60 * 60 * 1000, // 30 days
    INVITATION: 7 * 24 * 60 * 60 * 1000   // 7 days
  }
};

// Utility functions
export const generateRoomId = () => `room_${Date.now()}_${nanoid(8)}`;
export const generatePeerId = () => `peer_${Date.now()}_${nanoid(8)}`;

// HMAC-SHA256 implementation for browser
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
  
  console.warn('🚨 Using insecure token signing - crypto.subtle not available');
  return btoa(`fallback-${Date.now()}`);
}

// Base64URL encoding
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class LinkGenerator {
  constructor() {
    this.isElectron = false;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    this.isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
    this.initialized = true;
    
    console.log('🔗 LinkGenerator initialized:', {
      isElectron: this.isElectron,
      hasElectronJWT: this.isElectron && !!window.electronAPI?.generateJWT,
      jwtSecret: JWT_SECRET.substring(0, 10) + '...'
    });
  }

  /**
   * Generate a proper JWT token with peerId and real signature
   * @param {Object} payload - The JWT payload
   * @returns {Promise<string>} - The signed JWT token
   */
  async generateValidToken(payload) {
    // ✅ ALWAYS include peerId field (required by server)
    const enhancedPayload = {
      ...payload,
      peerId: payload.peerId || generatePeerId(),
    };
    
    console.log('🔍 Generated token payload with peerId:', enhancedPayload);
    
    const header = { 
      alg: 'HS256',  // ✅ SECURE: Use proper algorithm
      typ: 'JWT' 
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(enhancedPayload));
    
    // ✅ SECURE: Create real signature using JWT_SECRET
    const signature = await hmacSha256(JWT_SECRET, `${encodedHeader}.${encodedPayload}`);
    
    const finalToken = `${encodedHeader}.${encodedPayload}.${signature}`;
    console.log('✅ Generated valid JWT token:', finalToken.substring(0, 50) + '...');
    
    return finalToken;
  }

  /**
   * Fallback simple token for development ONLY - NOT SECURE
   * @param {Object} payload - The JWT payload
   * @returns {string} - The unsigned JWT token
   */
  generateSimpleToken(payload) {
    console.warn('🚨 Using INSECURE simple token - for development only!');
    
    const header = {
      alg: 'none',
      typ: 'JWT'
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(`dev-signature-${Date.now()}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Generate a permanent collaboration link
   * @param {string} documentId - The document ID
   * @param {string} roomId - Optional room ID (will be generated if not provided)
   * @param {string[]} permissions - Array of permissions ['read', 'write']
   * @returns {Promise<Object>} - The permanent link object
   */
  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    if (!this.initialized) this.initialize();
    
    if (!roomId) roomId = generateRoomId();
    const linkId = `perm_${nanoid(10)}`;

    const payload = {
      type: 'permanent',
      linkId,
      roomId,
      documentId,
      permissions,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      iat: Math.floor(Date.now() / 1000),
      dev: true
    };

    let token;
    
    if (this.isElectron && window.electronAPI?.generateJWT) {
      // Use Electron main process for secure JWT generation
      try {
        console.log('🔐 Using Electron JWT generation');
        token = await window.electronAPI.generateJWT(payload);
      } catch (error) {
        console.warn('Electron JWT generation failed, using browser JWT:', error);
        token = await this.generateValidToken(payload);
      }
    } else {
      // Use browser JWT generation with proper signature
      console.log('🌐 Using browser JWT generation');
      token = await this.generateValidToken(payload);
    }

    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/join?room=${roomId}&token=${token}&doc=${documentId}`;

    const linkData = {
      type: 'permanent',
      linkId,
      roomId,
      url,
      token,
      permissions,
      expiresAt: Date.now() + COLLABORATION_CONFIG.TOKEN_EXPIRY.PERMANENT,
      createdAt: Date.now()
    };

    console.log('✅ Generated permanent link:', linkData.linkId);
    return linkData;
  }

  /**
   * Generate an invitation collaboration link
   * @param {string} documentId - The document ID
   * @param {string} roomId - The room ID to join
   * @param {string[]} permissions - Array of permissions ['read', 'write']
   * @param {string} recipientName - Optional recipient name
   * @returns {Promise<Object>} - The invitation link object
   */
  async generateInvitationLink(documentId, roomId, permissions = ['read', 'write'], recipientName = null) {
    if (!this.initialized) this.initialize();
    
    const invitationId = `invite_${nanoid(10)}`;

    const payload = {
      type: 'invitation',
      invitationId,
      roomId,
      documentId,
      permissions,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iat: Math.floor(Date.now() / 1000),
      singleUse: true,
      dev: true
    };

    let token;
    
    if (this.isElectron && window.electronAPI?.generateJWT) {
      try {
        console.log('🔐 Using Electron JWT generation for invitation');
        token = await window.electronAPI.generateJWT(payload);
      } catch (error) {
        console.warn('Electron JWT generation failed, using browser JWT:', error);
        token = await this.generateValidToken(payload);
      }
    } else {
      console.log('🌐 Using browser JWT generation for invitation');
      token = await this.generateValidToken(payload);
    }

    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/join?invite=${invitationId}&token=${token}&doc=${documentId}`;

    const invitationData = {
      type: 'invitation',
      invitationId,
      roomId,
      url,
      token,
      permissions,
      recipientName,
      expiresAt: Date.now() + COLLABORATION_CONFIG.TOKEN_EXPIRY.INVITATION,
      createdAt: Date.now(),
      used: false
    };

    console.log('✅ Generated invitation link:', invitationData.invitationId);
    return invitationData;
  }

  /**
   * Decode a JWT token to inspect its contents
   * @param {string} token - The JWT token to decode
   * @returns {Object|null} - Decoded token with header and payload, or null if invalid
   */
  decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('Invalid token format - expected 3 parts');
        return null;
      }
      
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      console.log('📋 Decoded token:', { header, payload });
      return { header, payload, signature: parts[2] };
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Validate if a token is expired
   * @param {string} token - The JWT token to check
   * @returns {boolean} - True if token is valid and not expired
   */
  isTokenValid(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.payload) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const isNotExpired = decoded.payload.exp > now;
    
    console.log('🔍 Token validation:', {
      expired: !isNotExpired,
      expiresAt: new Date(decoded.payload.exp * 1000),
      currentTime: new Date(),
      valid: isNotExpired
    });
    
    return isNotExpired;
  }
}
