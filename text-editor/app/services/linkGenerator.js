import jwt from 'jsonwebtoken';
import { COLLABORATION_CONFIG } from '../config/collaboration';
import { generateRoomId, generatePeerId } from '../utils/documentUtils';
import { nanoid } from 'nanoid';

export class LinkGenerator {
  constructor() {
    this.isElectron = false;
  }

  initialize() {
    this.isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  }

  // Simple token generator for development (no crypto dependencies)
  generateSimpleToken(payload) {
    const header = {
      alg: 'none',
      typ: 'JWT'
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    
    // Simple signature for development - NOT secure for production
    const signature = btoa(`dev-signature-${Date.now()}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async generatePermanentLink(documentId, roomId = null, permissions = ['read', 'write']) {
    // Generate room ID if not provided
    if (!roomId) {
      roomId = generateRoomId();
    }

    const payload = {
      type: 'permanent',
      roomId,
      documentId,
      permissions,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      iat: Math.floor(Date.now() / 1000),
      dev: true // Mark as development token
    };

    let token;
    
    if (this.isElectron && window.electronAPI.generateJWT) {
      // Use Electron main process for secure JWT generation
      try {
        token = await window.electronAPI.generateJWT(payload);
      } catch (error) {
        console.warn('Electron JWT generation failed, using fallback:', error);
        token = this.generateSimpleToken(payload);
      }
    } else {
      // Fallback to simple token for browser/development
      token = this.generateSimpleToken(payload);
    }

    const url = `${COLLABORATION_CONFIG.WEB_CLIENT_URL}/join?room=${roomId}&token=${token}&doc=${documentId}`;

    return {
      type: 'permanent',
      roomId,
      url,
      token,
      permissions,
      expiresAt: Date.now() + COLLABORATION_CONFIG.TOKEN_EXPIRY.PERMANENT,
      linkId: `perm_${nanoid(10)}`
    };
  }

  async generateInvitationLink(documentId, roomId, permissions = ['read', 'write'], recipientName = null) {
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
      dev: true // Mark as development token
    };

    let token;
    
    if (this.isElectron && window.electronAPI.generateJWT) {
      // Use Electron main process for secure JWT generation
      try {
        token = await window.electronAPI.generateJWT(payload);
      } catch (error) {
        console.warn('Electron JWT generation failed, using fallback:', error);
        token = this.generateSimpleToken(payload);
      }
    } else {
      // Fallback to simple token for browser/development
      token = this.generateSimpleToken(payload);
    }

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

  // Helper to decode simple tokens
  decodeSimpleToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }
}