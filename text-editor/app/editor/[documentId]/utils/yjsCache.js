import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { WEBRTC_CONFIG } from "./constants";

/**
 * Global cache on window to avoid duplicate Y.Doc/Provider instances.
 */
function getGlobalCache() {
  if (typeof window === "undefined") return null;
  if (!window.__yjs) {
    window.__yjs = {
      docs: new Map(),
      providers: new Map(),
      refs: new Map(),
    };
  }
  return window.__yjs;
}

/**
 * Generate WebRTC configuration with optional token
 */
function getWebRTCConfig(token = null) {
  const baseConfig = {
    signaling: token 
      ? [`wss://signaling-server-production-af26.up.railway.app/signal?token=${token}`]
      : ["wss://signaling-server-production-af26.up.railway.app/signal"],
    maxConn: 20,
    filterBcConns: true,
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    }
  };

  // Merge with any existing WEBRTC_CONFIG
  return {
    ...WEBRTC_CONFIG,
    ...baseConfig
  };
}

export function ensureRoom(roomName, options = {}) {
  // Add this right before: provider = new WebrtcProvider(roomName, ydoc, config);


  const cache = getGlobalCache();
  if (!cache) {
    const ydoc = new Y.Doc();
    const config = options.token ? getWebRTCConfig(options.token) : getWebRTCConfig();
    const provider = new WebrtcProvider(roomName, ydoc, config);
    return { ydoc, provider, created: true };
  }
  
  // Use token-specific cache key if token provided
  const cacheKey = options.token ? `${roomName}_authenticated` : roomName;
  
  if (cache.docs.has(cacheKey) && cache.providers.has(cacheKey)) {
    cache.refs.set(cacheKey, (cache.refs.get(cacheKey) || 0) + 1);
    return { 
      ydoc: cache.docs.get(cacheKey), 
      provider: cache.providers.get(cacheKey), 
      created: false 
    };
  }



  const ydoc = new Y.Doc();
  let provider;
  
  try {
    const config = options.token ? getWebRTCConfig(options.token) : getWebRTCConfig();

      console.log('🔍 PROVIDER DEBUG:', {
    roomName: roomName,
    cacheKey: cacheKey,
    hasToken: !!options.token,
    config: config,
    timestamp: new Date().toISOString(),
    platform: typeof window.electronAPI !== 'undefined' ? 'Electron' : 'Browser'
});

    provider = new WebrtcProvider(roomName, ydoc, config);
    
// Replace the existing provider.on('status') and provider.on('peers') with:
provider.on('status', event => {
  console.log(`🔍 WebRTC Provider status (${options.token ? 'authenticated' : 'anonymous'}):`, {
    status: event.status,
    roomName: roomName,
    timestamp: new Date().toISOString(),
    platform: typeof window.electronAPI !== 'undefined' ? 'Electron' : 'Browser'
  });
});

provider.on('peers', event => {
  console.log('🔍 WebRTC peers changed:', {
    roomName: roomName,
    added: event.added,
    removed: event.removed,
    webrtcPeersCount: event.webrtcPeers?.length || 0,
    bcPeersCount: event.bcPeers?.length || 0,
    totalPeers: (event.webrtcPeers?.length || 0) + (event.bcPeers?.length || 0),
    timestamp: new Date().toISOString(),
    platform: typeof window.electronAPI !== 'undefined' ? 'Electron' : 'Browser'
  });
});
  } catch (err) {
    console.error('Failed to create WebRTC provider:', err);
    
    // Fallback to cached version if exists
    if (cache.docs.has(cacheKey) && cache.providers.has(cacheKey)) {
      ydoc.destroy();
      cache.refs.set(cacheKey, (cache.refs.get(cacheKey) || 0) + 1);
      return { 
        ydoc: cache.docs.get(cacheKey), 
        provider: cache.providers.get(cacheKey), 
        created: false 
      };
    }
    throw err;
  }

  cache.docs.set(cacheKey, ydoc);
  cache.providers.set(cacheKey, provider);
  cache.refs.set(cacheKey, 1);
  return { ydoc, provider, created: true };
}

export function releaseRoom(roomName, options = {}) {
  if (typeof window === "undefined") {
    return { ydoc: null, provider: null, created: false };
  }
  
  const cache = getGlobalCache();
  if (!cache) return;

  // Use same cache key logic as ensureRoom
  const cacheKey = options.token ? `${roomName}_authenticated` : roomName;
  
  const refs = cache.refs.get(cacheKey) || 0;
  if (refs <= 1) {
    const provider = cache.providers.get(cacheKey);
    const ydoc = cache.docs.get(cacheKey);
    
    console.log(`🧹 Cleaning up Y.js room: ${cacheKey}`);
    
    try { 
      provider?.off('status');
      provider?.off('peers');
      provider?.destroy(); 
    } catch (error) {
      console.warn('Error destroying provider:', error);
    }
    
    try { 
      ydoc?.destroy(); 
    } catch (error) {
      console.warn('Error destroying ydoc:', error);
    }
    
    cache.providers.delete(cacheKey);
    cache.docs.delete(cacheKey);
    cache.refs.delete(cacheKey);
  } else {
    cache.refs.set(cacheKey, refs - 1);
    console.log(`📉 Decreased ref count for ${cacheKey}: ${refs - 1}`);
  }
}

// Helper function to get current room info (for debugging)
export function getRoomInfo(roomName, options = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;
  
  const cacheKey = options.token ? `${roomName}_authenticated` : roomName;
  
  return {
    cacheKey,
    hasDoc: cache.docs.has(cacheKey),
    hasProvider: cache.providers.has(cacheKey),
    refCount: cache.refs.get(cacheKey) || 0,
    totalRooms: cache.docs.size
  };
}
