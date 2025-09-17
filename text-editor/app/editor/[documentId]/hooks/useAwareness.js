// app/editor/[documentId]/hooks/useAwareness.js
import { useState, useEffect } from "react";
import { generateClientId, createLocalUser, getActivePeers } from "../utils/userUtils";

export function useAwareness(provider, roomName) {
  const [peerCount, setPeerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activePeers, setActivePeers] = useState([]);

  useEffect(() => {
    if (!provider) return;
    
    const awareness = provider.awareness;
    const clientId = generateClientId();
    const localUser = createLocalUser(roomName, clientId);

    awareness.setLocalStateField("user", {
      ...localUser,
      cursor: null,
      selection: null
    });

    const onAwarenessChange = () => {
      const states = awareness.getStates();
      const total = states.size;
      const remote = Math.max(0, total - 1);
      setPeerCount(remote);
      
      const peers = getActivePeers(awareness);
      setActivePeers(peers);
      
      console.log('Active peers:', peers);
    };

    const onStatusChange = (event) => {
      setConnectionStatus(event.status);
      console.log('Connection status changed:', event.status);
    };

    awareness.on("change", onAwarenessChange);
    provider.on('status', onStatusChange);
    
    onAwarenessChange();

    return () => {
      awareness.off("change", onAwarenessChange);
      provider.off('status', onStatusChange);
      
      try { 
        awareness.setLocalStateField("user", null); 
      } catch (_) {}
    };
  }, [provider, roomName]);

  return { peerCount, connectionStatus, activePeers };
}
