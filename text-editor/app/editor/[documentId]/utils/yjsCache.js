import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { Awareness } from 'y-protocols/awareness';

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

function getWebRTCConfig(token = null) {
  const baseConfig = {
    signaling: token 
      ? [`ws://localhost:3003/signal?token=${encodeURIComponent(token)}`]
      : ["ws://localhost:3003/signal"],
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

  return baseConfig;
}

function createLocalProvider(ydoc) {
  return {
    awareness: new Awareness(ydoc),
    connected: true,
    connect: () => {},
    disconnect: () => {},
    destroy: () => {},
    on: (event, callback) => {
      if (event === 'status') {
        setTimeout(() => callback({ status: 'connected' }), 0);
      }
    },
    off: () => {},
    emit: () => {}
  };
}

// ✅ WORKING VERSION - Restore text sync first
export function ensureRoom(documentId, options = {}) {
  const cache = getGlobalCache();
  
  if (!cache) {
    const ydoc = new Y.Doc();
    let provider;
    
    if (options.enableWebRTC && options.token) {
      const config = getWebRTCConfig(options.token);
      const roomName = `collab-${documentId}`;
      provider = new WebrtcProvider(roomName, ydoc, config);
    } else {
      provider = createLocalProvider(ydoc);
    }
    
    return { ydoc, provider, created: true, standardFieldName: `editor-${documentId}` };
  }

  // ✅ BACK TO ORIGINAL: Use mode in cache key to prevent conflicts
  const cacheKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  console.log('🔍 RESTORED CACHE STRATEGY:', {
    documentId: documentId.slice(0, 8) + '...',
    cacheKey,
    enableWebRTC: options.enableWebRTC,
    hasToken: !!options.token,
    exists: cache.docs.has(cacheKey)
  });
  
  // ✅ REUSE: Existing document
  if (cache.docs.has(cacheKey) && cache.providers.has(cacheKey)) {
    const existingProvider = cache.providers.get(cacheKey);
    const existingDoc = cache.docs.get(cacheKey);
    
    cache.refs.set(cacheKey, (cache.refs.get(cacheKey) || 0) + 1);
    
    console.log('♻️ Reusing existing document and provider');
    return { 
      ydoc: existingDoc, 
      provider: existingProvider, 
      created: false,
      standardFieldName: `editor-${documentId}`
    };
  }

  // ✅ CREATE: Fresh document
  const ydoc = new Y.Doc();
  let provider;
  
  try {
    if (options.enableWebRTC && options.token) {
      const config = getWebRTCConfig(options.token);
      const roomName = `collab-${documentId}`;
      
      provider = new WebrtcProvider(roomName, ydoc, config);
      
      provider.on('status', event => {
        console.log('📡 WebRTC status:', event.status);
      });

      provider.on('peers', event => {
        console.log('👥 WebRTC peers:', {
          webrtcPeers: event.webrtcPeers?.length || 0,
          bcPeers: event.bcPeers?.length || 0
        });
      });
      
      console.log('🌐 WebRTC provider created');
    } else {
      provider = createLocalProvider(ydoc);
      console.log('📝 Local provider created');
    }
  } catch (err) {
    console.error('❌ Provider creation failed:', err);
    provider = createLocalProvider(ydoc);
  }

  // ✅ CACHE
  cache.docs.set(cacheKey, ydoc);
  cache.providers.set(cacheKey, provider);
  cache.refs.set(cacheKey, 1);
  
  console.log('✅ Document cached');
  
  return { 
    ydoc, 
    provider, 
    created: true,
    standardFieldName: `editor-${documentId}`
  };
}

// ✅ GENTLE CLEANUP: Only cleanup after multiple decreases
export function releaseRoom(documentId, options = {}) {
  if (typeof window === "undefined") return;
  
  const cache = getGlobalCache();
  if (!cache) return;

  const cacheKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  const refs = cache.refs.get(cacheKey) || 0;
  const newRefs = refs - 1;
  
  console.log(`📉 Release: ${cacheKey.slice(0, 20)}... refs: ${refs} -> ${newRefs}`);
  
  // ✅ GENTLE: Only cleanup when refs go negative (extra protection)
  if (newRefs <= -1) {
    const provider = cache.providers.get(cacheKey);
    const ydoc = cache.docs.get(cacheKey);
    
    console.log(`🧹 Cleaning up: ${cacheKey.slice(0, 20)}...`);
    
    try { 
      if (provider?.destroy) provider.destroy();
      if (ydoc?.destroy) ydoc.destroy();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
    
    cache.providers.delete(cacheKey);
    cache.docs.delete(cacheKey);
    cache.refs.delete(cacheKey);
  } else {
    cache.refs.set(cacheKey, newRefs);
  }
}

export function getRoomInfo(documentId, options = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;
  
  const cacheKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  return {
    documentId,
    cacheKey,
    hasDoc: cache.docs.has(cacheKey),
    hasProvider: cache.providers.has(cacheKey),
    refCount: cache.refs.get(cacheKey) || 0
  };
}
