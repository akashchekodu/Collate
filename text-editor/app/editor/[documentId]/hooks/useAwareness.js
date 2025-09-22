import { useState, useEffect, useCallback, useRef } from "react";
import { generateClientId, createLocalUser, getActivePeers, setAwarenessUser } from "../utils/userUtils";

export function useAwareness(provider, roomName) {
  const [peerCount, setPeerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activePeers, setActivePeers] = useState([]);
  
  const setupRef = useRef(false);
  const cleanupRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!provider || !provider.awareness || !roomName) {
      console.log('❌ Missing provider, awareness, or roomName');
      setPeerCount(0);
      setActivePeers([]);
      setConnectionStatus('disconnected');
      return;
    }

    if (setupRef.current) {
      console.log('♻️ Awareness already set up');
      return;
    }

    console.log('🚨 CURSOR-FOCUSED AWARENESS SETUP');
    
    const awareness = provider.awareness;
    setupRef.current = true;

    // ✅ SIMPLE: Set user for cursor tracking
    const userData = {
      name: `🐱 Cat${Math.floor(Math.random() * 1000)}`,
      color: '#FF6B6B',
      clientId: generateClientId(),
      lastSeen: Date.now(),
    };

    console.log('👤 Setting cursor user:', userData.name);
    setAwarenessUser(awareness, userData);

    // ✅ SIMPLE: Check peer states
    const checkAwarenessStates = () => {
      try {
        const states = awareness.getStates();
        const localClientId = awareness.clientID;
        const localState = awareness.getLocalState();
        
        console.log('🔍 CURSOR STATE CHECK:', {
          totalStates: states.size,
          hasLocalUser: !!localState?.user,
          localUserName: localState?.user?.name,
        });

        let remotePeerCount = 0;
        const peerList = [];

        states.forEach((state, clientId) => {
          if (clientId !== localClientId && state.user) {
            remotePeerCount++;
            peerList.push({
              clientId,
              name: state.user.name || 'Anonymous',
              color: state.user.color || '#666',
              lastSeen: state.user.lastSeen || Date.now()
            });
          }
        });

        console.log('👥 CURSOR PEERS:', { remotePeerCount, peerNames: peerList.map(p => p.name) });

        setPeerCount(remotePeerCount);
        setActivePeers(peerList);

        // ✅ REFRESH: User if missing
        if (!localState?.user) {
          console.warn('⚠️ Cursor user missing - refreshing');
          const newUserData = {
            name: `🐱 Cat${Math.floor(Math.random() * 1000)}`,
            color: '#FF6B6B',
            clientId: generateClientId(),
            lastSeen: Date.now(),
          };
          setAwarenessUser(awareness, newUserData);
        }

        return remotePeerCount;

      } catch (error) {
        console.error('❌ Cursor state check failed:', error);
        return 0;
      }
    };

    // ✅ INITIAL: First check
    const initialCount = checkAwarenessStates();
    console.log('🔥 INITIAL CURSOR PEER COUNT:', initialCount);

    // ✅ SIMPLE: Event handlers
    const onAwarenessChange = () => {
      console.log('📡 CURSOR AWARENESS CHANGE');
      setTimeout(() => checkAwarenessStates(), 50);
    };

    const onProviderStatus = (event) => {
      console.log('📡 CURSOR Provider Status:', event.status);
      setConnectionStatus(event.status || 'unknown');
      
      if (event.status === 'connected') {
        setTimeout(() => checkAwarenessStates(), 200);
      }
    };

    // ✅ ADD: Event listeners
    try {
      awareness.on('change', onAwarenessChange);
      provider.on('status', onProviderStatus);
      console.log('✅ Cursor event listeners added');
    } catch (error) {
      console.error('❌ Failed to add cursor listeners:', error);
    }

    // ✅ POLLING: Keep user active
    intervalRef.current = setInterval(() => {
      const localState = awareness.getLocalState();
      if (!localState?.user) {
        console.warn('⚠️ Cursor user missing during polling');
        const refreshUserData = {
          name: `🐱 Cat${Math.floor(Math.random() * 1000)}`,
          color: '#FF6B6B',
          clientId: generateClientId(),
          lastSeen: Date.now(),
        };
        setAwarenessUser(awareness, refreshUserData);
      } else {
        // Update timestamp
        setAwarenessUser(awareness, {
          ...localState.user,
          lastSeen: Date.now()
        });
      }
      
      checkAwarenessStates();
    }, 5000); // Every 5 seconds

    // ✅ CLEANUP
    cleanupRef.current = () => {
      console.log('🧹 Cursor awareness cleanup');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      try {
        awareness.off('change', onAwarenessChange);
        provider.off('status', onProviderStatus);
        setAwarenessUser(awareness, null);
        console.log('✅ Cursor cleanup completed');
      } catch (error) {
        console.warn('❌ Cursor cleanup error:', error);
      }
      
      setupRef.current = false;
    };

    return cleanupRef.current;

  }, [provider, roomName]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return { 
    peerCount, 
    connectionStatus, 
    activePeers 
  };
}
