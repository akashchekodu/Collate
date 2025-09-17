// app/editor/[documentId]/utils/userUtils.js
import { ANIMAL_USERS } from "./constants";

export function generateClientId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createLocalUser(roomName, clientId) {
  let localUser;
  
  try {
    const raw = localStorage.getItem(`collab.user.${roomName}`);
    if (raw) {
      localUser = JSON.parse(raw);
      localUser.clientId = clientId;
      localUser.timestamp = Date.now();
    }
  } catch (_) {}

  if (!localUser) {
    const animalUser = ANIMAL_USERS[Math.floor(Math.random() * ANIMAL_USERS.length)];
    const userId = Math.floor(Math.random() * 10000);
    
    localUser = {
      name: animalUser.name,
      color: animalUser.color,
      clientId,
      userId,
      timestamp: Date.now()
    };
    
    try { 
      localStorage.setItem(`collab.user.${roomName}`, JSON.stringify(localUser)); 
    } catch (_) {}
  }

  return localUser;
}

export function getActivePeers(awareness) {
  const states = awareness.getStates();
  const peers = [];
  
  states.forEach((state, clientId) => {
    if (clientId !== awareness.clientID && state.user) {
      peers.push({
        clientId,
        ...state.user,
        cursor: state.cursor || null,
        selection: state.selection || null,
        lastSeen: Date.now()
      });
    }
  });
  
  return peers;
}
