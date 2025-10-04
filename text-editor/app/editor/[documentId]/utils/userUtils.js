// ✅ SIMPLIFIED userUtils.js - CURSORS ONLY
import { ANIMAL_USERS } from "./constants";

export function generateClientId() {
  return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createLocalUser(roomName, clientId) {
  let localUser;
  
  try {
    const raw = localStorage.getItem(`collab.user.${roomName}`);
    if (raw) {
      localUser = JSON.parse(raw);
      localUser.clientId = clientId;
      localUser.lastSeen = Date.now();
      console.log('👤 Restored user from localStorage:', localUser.name);
    }
  } catch (error) {
    console.warn('❌ Failed to restore user from localStorage:', error);
  }

  if (!localUser) {
    const animalUser = ANIMAL_USERS[Math.floor(Math.random() * ANIMAL_USERS.length)];
    
    localUser = {
      name: animalUser.name,
      color: animalUser.color,
      clientId,
      lastSeen: Date.now(),
    };
    
    try { 
      localStorage.setItem(`collab.user.${roomName}`, JSON.stringify(localUser)); 
      console.log('👤 Created new user:', localUser.name);
    } catch (error) {
      console.warn('❌ Failed to save user to localStorage:', error);
    }
  }

  return localUser;
}

export function getActivePeers(awareness) {
  if (!awareness || typeof awareness.getStates !== 'function') {
    return [];
  }

  try {
    const states = awareness.getStates();
    const localClientId = awareness.clientID;
    const peers = [];
    
    states.forEach((state, clientId) => {
      if (clientId !== localClientId && state.user) {
        const peer = {
          clientId,
          name: state.user.name || 'Anonymous',
          color: state.user.color || '#6B7280',
          avatar: state.user.name?.charAt(0)?.toUpperCase() || '👤',
          lastSeen: state.user.lastSeen || Date.now()
        };
        
        // ✅ SIMPLE: Active within last 30 seconds
        const timeSinceLastSeen = Date.now() - peer.lastSeen;
        if (timeSinceLastSeen < 30000) {
          peers.push(peer);
        }
      }
    });

    return peers;
  } catch (error) {
    console.warn('❌ Error getting active peers:', error);
    return [];
  }
}

// ✅ SIMPLE: Set awareness user for CURSORS ONLY
export function setAwarenessUser(awareness, userData) {
  if (userData === null) {
    try {
      awareness.setLocalStateField('user', null);
      return true;
    } catch (error) {
      return false;
    }
  }

  try {
    awareness.setLocalStateField('user', userData);
    console.log('✅ Cursor user set:', userData.name);
    return true;
  } catch (error) {
    try {
      awareness.setLocalState({ user: userData });
      console.log('✅ Cursor user set (fallback):', userData.name);
      return true;
    } catch (error2) {
      console.error('❌ Failed to set cursor user:', error2);
      return false;
    }
  }
}

// ✅ REMOVED: All typing status functions - CURSORS ONLY!
