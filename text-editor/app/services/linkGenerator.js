import { nanoid } from 'nanoid';

// JWT_SECRET must match signaling server
const JWT_SECRET = '41db8ba3fa459485fc41b2a98a2d705ea32ffe41600200506949fb70f5046f02db54eeff';

// Configuration - UPDATED for unified architecture
export const COLLABORATION_CONFIG = {
  SIGNALING_SERVER: 'ws://localhost:3003/signal',
  WEB_CLIENT_URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
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
      baseUrl: COLLABORATION_CONFIG.WEB_CLIENT_URL,
      jwtSecret: JWT_SECRET.substring(0, 10) + '...'
    });
  }

  /**
   * Generate a proper JWT token with unified architecture payload
   */
  async generateValidToken(payload) {
    // ✅ UPDATED: Simplified payload for unified architecture
    const enhancedPayload = {
      documentId: payload.documentId,          // Document GUID
      roomId: `collab-${payload.documentId}`,  // Collaboration room
      fieldName: `editor-${payload.documentId}`, // Y.js field name
      permissions: payload.permissions || ['read', 'write'],
      peerId: payload.peerId || generatePeerId(),
      type: payload.type || 'collaboration',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (payload.expiryHours || 24 * 30) * 3600, // 30 days default
      dev: true
    };

    console.log('🔍 Generated unified token payload:', enhancedPayload);

    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(enhancedPayload));

    const signature = await hmacSha256(JWT_SECRET, `${encodedHeader}.${encodedPayload}`);

    const finalToken = `${encodedHeader}.${encodedPayload}.${signature}`;
    console.log('✅ Generated unified JWT token:', finalToken.substring(0, 50) + '...');

    return finalToken;
  }

  /**
   * Generate a collaboration link using unified architecture
   */
  async generateCollaborationLink(documentId, permissions = ['read', 'write'], expiryHours = 24 * 30) {
    if (!this.initialized) this.initialize();

    console.log('🔗 Generating collaboration link for document:', documentId);

    const payload = {
      documentId: documentId,
      permissions: permissions,
      type: 'collaboration',
      expiryHours: expiryHours
    };

    let token;

    if (this.isElectron && window.electronAPI?.generateJWT) {
      try {
        console.log('🔐 Using Electron JWT generation');
        token = await window.electronAPI.generateJWT(payload);
      } catch (error) {
        console.warn('Electron JWT generation failed, using browser JWT:', error);
        token = await this.generateValidToken(payload);
      }
    } else {
      console.log('🌐 Using browser JWT generation');
      token = await this.generateValidToken(payload);
    }

    // ✅ UPDATED: Use unified architecture URL structure
    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/editor/${documentId}?token=${token}`;

    const linkData = {
      documentId: documentId,
      url: url,
      token: token,
      permissions: permissions,
      roomId: `collab-${documentId}`,
      fieldName: `editor-${documentId}`,
      expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
      createdAt: Date.now()
    };

    console.log('✅ Generated collaboration link:', url);
    return linkData;
  }

  /**
   * Generate a permanent collaboration link (30 days)
   */
  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    console.log('🔗 Generating permanent link for document:', documentId);
    return await this.generateCollaborationLink(documentId, permissions, 24 * 30); // 30 days
  }

  /**
   * Generate an invitation collaboration link (7 days)
   */
  async generateInvitationLink(documentId, roomId, permissions = ['read', 'write'], recipientName = null) {
    console.log('🔗 Generating invitation link for document:', documentId);
    return await this.generateCollaborationLink(documentId, permissions, 24 * 7); // 7 days
  }
  // Add to app/services/linkGenerator.js - INSERT after existing methods

  /**
   * ✅ NEW: Generate one-time invitation link
   */
  async generateOneTimeLink(documentId, recipientName = null) {
    if (!this.initialized) this.initialize();

    console.log('🔗 Generating ONE-TIME link for:', documentId, 'recipient:', recipientName);

    const linkId = `onetime_${Date.now()}_${nanoid(8)}`;

    const payload = {
      documentId: documentId,
      type: 'one-time',
      linkId: linkId,
      permissions: ['read', 'write'],
      recipientName: recipientName,
      expiryHours: 24 * 7, // 7 days to use the link
      peerId: generatePeerId()
    };

    const token = await this.generateValidToken(payload);

    const linkData = {
      documentId: documentId,
      linkId: linkId,
      url: `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/editor/${documentId}?token=${token}`,
      token: token,
      type: 'one-time',
      recipientName: recipientName || 'Anonymous',
      used: false,
      usedAt: null,
      usedBy: null,
      roomId: `collab-${documentId}`,
      fieldName: `editor-${documentId}`,
      expiresAt: Date.now() + (24 * 7 * 60 * 60 * 1000), // 7 days
      createdAt: Date.now()
    };

    console.log('✅ One-time link generated:', linkData.url);
    return linkData;
  }

  /**
   * ✅ NEW: Generate long-expiry permanent link
   */
  async generateLongExpiryLink(documentId, permissions = ['read', 'write']) {
    if (!this.initialized) this.initialize();

    console.log('🔗 Generating LONG-EXPIRY link for:', documentId, 'permissions:', permissions);

    const linkId = `permanent_${Date.now()}_${nanoid(8)}`;

    const payload = {
      documentId: documentId,
      type: 'permanent',
      linkId: linkId,
      permissions: permissions,
      expiryHours: 24 * 30, // 30 days
      peerId: generatePeerId()
    };

    const token = await this.generateValidToken(payload);

    const linkData = {
      documentId: documentId,
      linkId: linkId,
      url: `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/editor/${documentId}?token=${token}`,
      token: token,
      type: 'permanent',
      permissions: permissions,
      roomId: `collab-${documentId}`,
      fieldName: `editor-${documentId}`,
      expiresAt: Date.now() + (24 * 30 * 60 * 60 * 1000), // 30 days
      createdAt: Date.now()
    };

    console.log('✅ Long-expiry link generated:', linkData.url);
    return linkData;
  }

  /**
   * ✅ ENHANCED: Token validation with one-time usage checking
   */
  validateTokenWithUsage(token, collaborationData = null) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.payload) {
      return { valid: false, reason: 'invalid-token' };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp <= now) {
      return { valid: false, reason: 'expired' };
    }

    // Check if token is revoked
    if (collaborationData?.revoked?.includes(decoded.payload.linkId)) {
      return { valid: false, reason: 'revoked' };
    }

    // ✅ NEW: Check one-time usage
    if (decoded.payload.type === 'one-time') {
      const oneTimeLink = collaborationData?.links?.oneTime?.find(
        link => link.linkId === decoded.payload.linkId
      );

      if (oneTimeLink?.used) {
        return {
          valid: false,
          reason: 'already-used',
          usedAt: oneTimeLink.usedAt,
          usedBy: oneTimeLink.usedBy
        };
      }
    }

    return {
      valid: true,
      payload: decoded.payload,
      linkType: decoded.payload.type,
      linkId: decoded.payload.linkId
    };
  }

  /**
   * Decode a JWT token to inspect its contents
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
