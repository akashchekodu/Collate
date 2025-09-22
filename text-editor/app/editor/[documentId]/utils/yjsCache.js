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
  return {
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

// ✅ SEAMLESS MODE SWITCHING: Keep same document, upgrade provider
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

  // ✅ CRITICAL: Always use same document for same documentId
  const docKey = documentId; // Single document per documentId
  const providerKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  console.log('🔄 SEAMLESS MODE CHECK:', {
    documentId: documentId.slice(0, 8) + '...',
    docKey,
    providerKey,
    requestedMode: options.enableWebRTC ? 'collaboration' : 'solo',
    existingDoc: cache.docs.has(docKey),
    existingProvider: cache.providers.has(providerKey),
    needsModeSwitch: cache.docs.has(docKey) && !cache.providers.has(providerKey)
  });

  // ✅ GET OR CREATE: Y.js document (always preserve existing)
  let ydoc = cache.docs.get(docKey);
  if (!ydoc) {
    ydoc = new Y.Doc();
    cache.docs.set(docKey, ydoc);
    console.log('🆕 Created new Y.js document for:', documentId.slice(0, 8) + '...');
  } else {
    console.log('♻️ Reusing existing Y.js document:', documentId.slice(0, 8) + '...');
  }

  // ✅ GET OR CREATE: Provider (may need switching)
  let provider = cache.providers.get(providerKey);
  
  if (!provider) {
    // ✅ MODE SWITCHING: Destroy old provider if switching modes
    const oldProviderKey = options.enableWebRTC ? 
      `${documentId}_local` : 
      `${documentId}_webrtc_${options.token || 'none'}`;
    
    const oldProvider = cache.providers.get(oldProviderKey);
    if (oldProvider) {
      console.log('🔄 SEAMLESS MODE SWITCH:', {
        from: options.enableWebRTC ? 'solo' : 'collaboration',
        to: options.enableWebRTC ? 'collaboration' : 'solo',
        documentId: documentId.slice(0, 8) + '...'
      });
      
      try {
        // ✅ GRACEFUL: Disconnect old provider
        if (oldProvider.disconnect) oldProvider.disconnect();
        if (oldProvider.destroy) oldProvider.destroy();
      } catch (error) {
        console.warn('❌ Old provider cleanup warning:', error);
      }
      
      cache.providers.delete(oldProviderKey);
      cache.refs.delete(oldProviderKey);
    }

    // ✅ CREATE NEW: Provider for new mode
    try {
      if (options.enableWebRTC && options.token) {
        const config = getWebRTCConfig(options.token);
        const roomName = `collab-${documentId}`;
        
        provider = new WebrtcProvider(roomName, ydoc, config);
        
        provider.on('status', event => {
          console.log('🌐 WebRTC Status:', {
            status: event.status,
            documentId: documentId.slice(0, 8) + '...'
          });
        });

        provider.on('peers', event => {
          console.log('👥 WebRTC Peers:', {
            documentId: documentId.slice(0, 8) + '...',
            webrtcPeers: event.webrtcPeers?.length || 0,
            bcPeers: event.bcPeers?.length || 0
          });
        });
        
        console.log('🌐 ✅ WebRTC provider created (seamless switch)');
      } else {
        provider = createLocalProvider(ydoc);
        console.log('📝 ✅ Local provider created (seamless switch)');
      }
    } catch (err) {
      console.error('❌ Provider creation failed:', err);
      provider = createLocalProvider(ydoc);
    }

    // ✅ CACHE: New provider
    cache.providers.set(providerKey, provider);
    cache.refs.set(providerKey, 1);
    
    console.log('✅ Seamless mode switch completed');
    
    return { 
      ydoc, 
      provider, 
      created: false, // Document wasn't created, just provider switched
      modeSwitch: true,
      standardFieldName: `editor-${documentId}`
    };
  }

  // ✅ REUSE: Existing provider
  cache.refs.set(providerKey, (cache.refs.get(providerKey) || 0) + 1);
  
  console.log('♻️ Reusing existing provider');
  return { 
    ydoc, 
    provider, 
    created: false,
    standardFieldName: `editor-${documentId}`
  };
}

export function releaseRoom(documentId, options = {}) {
  if (typeof window === "undefined") return;
  
  const cache = getGlobalCache();
  if (!cache) return;

  const providerKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  const refs = cache.refs.get(providerKey) || 0;
  const newRefs = refs - 1;
  
  console.log(`📉 Release: ${providerKey.slice(0, 30)}... refs: ${refs} -> ${newRefs}`);
  
  // ✅ GENTLE: Only cleanup when refs go negative
  if (newRefs <= -1) {
    const provider = cache.providers.get(providerKey);
    
    console.log(`🧹 Cleaning up provider: ${providerKey.slice(0, 30)}...`);
    
    try { 
      if (provider?.destroy) provider.destroy();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
    
    cache.providers.delete(providerKey);
    cache.refs.delete(providerKey);
    
    // ✅ IMPORTANT: Don't delete Y.js document - keep for mode switching
    console.log('📄 Y.js document preserved for seamless switching');
  } else {
    cache.refs.set(providerKey, newRefs);
  }
}

// ✅ NEW: Force mode switch for existing document
export function switchDocumentMode(documentId, newOptions = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;
  
  console.log('🔄 FORCE MODE SWITCH:', {
    documentId: documentId.slice(0, 8) + '...',
    toMode: newOptions.enableWebRTC ? 'collaboration' : 'solo',
    hasToken: !!newOptions.token
  });
  
  // ✅ FORCE: Release current provider but keep document
  releaseRoom(documentId, { enableWebRTC: false }); // Release local
  releaseRoom(documentId, newOptions); // Release collaboration if exists
  
  // ✅ CREATE: New mode
  return ensureRoom(documentId, newOptions);
}

export function getRoomInfo(documentId, options = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;
  
  const docKey = documentId;
  const providerKey = options.enableWebRTC ? 
    `${documentId}_webrtc_${options.token || 'none'}` : 
    `${documentId}_local`;
  
  return {
    documentId,
    docKey,
    providerKey,
    hasDoc: cache.docs.has(docKey),
    hasProvider: cache.providers.has(providerKey),
    refCount: cache.refs.get(providerKey) || 0,
    allProviders: Array.from(cache.providers.keys()).filter(key => key.startsWith(documentId))
  };
}
