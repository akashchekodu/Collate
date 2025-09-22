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
      activeRooms: new Set(), // ✅ NEW: Track active room names
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
    connect: () => { },
    disconnect: () => { },
    destroy: () => { },
    on: (event, callback) => {
      if (event === 'status') {
        setTimeout(() => callback({ status: 'connected' }), 0);
      }
    },
    off: () => { },
    emit: () => { }
  };
}

// ✅ FIXED: Simplified room management to prevent conflicts
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

  // ✅ SIMPLIFIED: One document per documentId, one provider per mode
  const docKey = documentId;
  const roomName = `collab-${documentId}`;

  // ✅ KEY FIX: Provider key doesn't include token - prevents duplicate rooms
  const providerKey = options.enableWebRTC ?
    `${documentId}_webrtc` : // ✅ FIXED: No token in key
    `${documentId}_local`;

  console.log('🔄 Room Management (FIXED):', {
    documentId: documentId.slice(0, 8) + '...',
    roomName,
    providerKey,
    requestedMode: options.enableWebRTC ? 'collaboration' : 'solo',
    existingDoc: cache.docs.has(docKey),
    existingProvider: cache.providers.has(providerKey),
    activeRooms: Array.from(cache.activeRooms),
    roomAlreadyActive: cache.activeRooms.has(roomName)
  });

  // ✅ CRITICAL: Check if WebRTC room is already active
  if (options.enableWebRTC && cache.activeRooms.has(roomName)) {
    console.warn('🚫 PREVENTED: Room already exists!', roomName);

    // ✅ RETURN EXISTING: Don't create duplicate
    const existingProvider = cache.providers.get(providerKey);
    const existingDoc = cache.docs.get(docKey);

    if (existingProvider && existingDoc) {
      console.log('♻️ Returning existing room to prevent conflict');
      cache.refs.set(providerKey, (cache.refs.get(providerKey) || 0) + 1);
      return {
        ydoc: existingDoc,
        provider: existingProvider,
        created: false,
        standardFieldName: `editor-${documentId}`
      };
    }
  }

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
    // ✅ MODE SWITCHING: Clean up old provider before creating new one
    const oldProviderKey = options.enableWebRTC ?
      `${documentId}_local` :
      `${documentId}_webrtc`;

    const oldProvider = cache.providers.get(oldProviderKey);
    if (oldProvider) {
      console.log('🔄 MODE SWITCH: Cleaning up old provider');

      try {
        if (oldProvider.disconnect) oldProvider.disconnect();
        if (oldProvider.destroy) oldProvider.destroy();
      } catch (error) {
        console.warn('❌ Old provider cleanup warning:', error);
      }

      cache.providers.delete(oldProviderKey);
      cache.refs.delete(oldProviderKey);

      // ✅ REMOVE: Old room from active set
      if (!options.enableWebRTC) {
        cache.activeRooms.delete(roomName);
      }
    }

    // ✅ CREATE NEW: Provider for new mode
    try {
      if (options.enableWebRTC && options.token) {
        const config = getWebRTCConfig(options.token);

        // ✅ PREVENT DUPLICATE: Check one more time before creating
        if (cache.activeRooms.has(roomName)) {
          console.error('🚫 CRITICAL: Attempted to create duplicate WebRTC room!', roomName);
          throw new Error(`WebRTC room ${roomName} already exists!`);
        }

        provider = new WebrtcProvider(roomName, ydoc, config);

        // ✅ TRACK: Mark room as active
        cache.activeRooms.add(roomName);

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

        // ✅ CLEANUP: Remove from active set when destroyed
        const originalDestroy = provider.destroy.bind(provider);
        provider.destroy = () => {
          cache.activeRooms.delete(roomName);
          console.log('🗑️ Removed room from active set:', roomName);
          originalDestroy();
        };

        console.log('🌐 ✅ WebRTC provider created (conflict-free)');
      } else {
        provider = createLocalProvider(ydoc);
        console.log('📝 ✅ Local provider created (conflict-free)');
      }
    } catch (err) {
      console.error('❌ Provider creation failed:', err);

      // ✅ FALLBACK: Create local provider if WebRTC fails
      provider = createLocalProvider(ydoc);
      console.log('🔄 Fallback to local provider due to error');
    }

    // ✅ CACHE: New provider
    cache.providers.set(providerKey, provider);
    cache.refs.set(providerKey, 1);

    console.log('✅ Provider created successfully');

    return {
      ydoc,
      provider,
      created: false,
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

// ✅ ENHANCED: Improved cleanup
export function releaseRoom(documentId, options = {}) {
  if (typeof window === "undefined") return;

  const cache = getGlobalCache();
  if (!cache) return;

  const providerKey = options.enableWebRTC ?
    `${documentId}_webrtc` : // ✅ FIXED: No token in key
    `${documentId}_local`;

  const refs = cache.refs.get(providerKey) || 0;
  const newRefs = refs - 1;

  console.log(`📉 Release: ${providerKey} refs: ${refs} -> ${newRefs}`);

  // ✅ CLEANUP: When no more references
  if (newRefs <= 0) {
    const provider = cache.providers.get(providerKey);
    const roomName = `collab-${documentId}`;

    console.log(`🧹 Cleaning up provider: ${providerKey}`);

    try {
      if (provider?.destroy) provider.destroy();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }

    cache.providers.delete(providerKey);
    cache.refs.delete(providerKey);

    // ✅ CLEANUP: Remove from active rooms
    if (options.enableWebRTC) {
      cache.activeRooms.delete(roomName);
      console.log('🗑️ Removed from active rooms:', roomName);
    }

    console.log('📄 Y.js document preserved for potential reuse');
  } else {
    cache.refs.set(providerKey, Math.max(0, newRefs));
  }
}

// Keep existing helper functions unchanged...
export function switchDocumentMode(documentId, newOptions = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;

  console.log('🔄 FORCE MODE SWITCH:', {
    documentId: documentId.slice(0, 8) + '...',
    toMode: newOptions.enableWebRTC ? 'collaboration' : 'solo',
    hasToken: !!newOptions.token
  });

  // ✅ FORCE: Release current provider but keep document
  releaseRoom(documentId, { enableWebRTC: false });
  releaseRoom(documentId, { enableWebRTC: true });

  // ✅ CREATE: New mode
  return ensureRoom(documentId, newOptions);
}

export function getRoomInfo(documentId, options = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;

  const docKey = documentId;
  const providerKey = options.enableWebRTC ?
    `${documentId}_webrtc` :
    `${documentId}_local`;

  return {
    documentId,
    docKey,
    providerKey,
    hasDoc: cache.docs.has(docKey),
    hasProvider: cache.providers.has(providerKey),
    refCount: cache.refs.get(providerKey) || 0,
    allProviders: Array.from(cache.providers.keys()).filter(key => key.startsWith(documentId)),
    activeRooms: Array.from(cache.activeRooms)
  };
}
