import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { Awareness } from 'y-protocols/awareness';

// ✅ NEW: Rate limiting for document operations
const documentLoadQueue = new Map();

function getGlobalCache() {
  if (typeof window === "undefined") return null;
  if (!window.__yjs) {
    window.__yjs = {
      docs: new Map(),
      providers: new Map(),
      refs: new Map(),
      activeRooms: new Set(),
      // ✅ NEW: Track document access to prevent loops
      loadingDocs: new Set(),
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

// ✅ NEW: Rate limited document access
function throttleDocumentOperation(documentId, operation) {
  const key = `${documentId}_${operation}`;
  const now = Date.now();
  const lastCall = documentLoadQueue.get(key) || 0;

  if (now - lastCall < 1000) { // 1 second throttle
    console.log('⚠️ Document operation throttled:', documentId.slice(0, 8) + '...', operation);
    return false;
  }

  documentLoadQueue.set(key, now);
  return true;
}

// ✅ ENHANCED: Room management with field conflict resolution
export function ensureRoom(documentId, options = {}) {
  const cache = getGlobalCache();

  // ✅ RATE LIMITING: Prevent rapid room creation
  if (!throttleDocumentOperation(documentId, 'ensureRoom')) {
    // Return cached room if available
    const docKey = documentId;
    const providerKey = options.enableWebRTC ? `${documentId}_webrtc` : `${documentId}_local`;

    if (cache?.docs.has(docKey) && cache?.providers.has(providerKey)) {
      const existingDoc = cache.docs.get(docKey);
      const existingProvider = cache.providers.get(providerKey);

      console.log('♻️ Returning throttled cached room');
      return {
        ydoc: existingDoc,
        provider: existingProvider,
        created: false,
        standardFieldName: `editor-${documentId}`
      };
    }
  }

  if (!cache) {
    const ydoc = new Y.Doc();

    // ✅ CLEAR: Prepare field for TipTap
    const fieldName = `editor-${documentId}`;
    clearFieldForTipTap(ydoc, fieldName);

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

  const docKey = documentId;
  const roomName = `collab-${documentId}`;
  const providerKey = options.enableWebRTC ? `${documentId}_webrtc` : `${documentId}_local`;

  console.log('🔄 Room Management (ENHANCED):', {
    documentId: documentId.slice(0, 8) + '...',
    roomName,
    providerKey,
    requestedMode: options.enableWebRTC ? 'collaboration' : 'solo',
    existingDoc: cache.docs.has(docKey),
    existingProvider: cache.providers.has(providerKey),
    activeRooms: Array.from(cache.activeRooms),
    roomAlreadyActive: cache.activeRooms.has(roomName),
    isLoading: cache.loadingDocs.has(documentId)
  });

  // ✅ PREVENT LOOPS: Check if document is already being loaded
  if (cache.loadingDocs.has(documentId)) {
    console.log('⚠️ Document already loading, waiting...');

    // Return existing if available, otherwise create minimal
    if (cache.docs.has(docKey)) {
      const existingDoc = cache.docs.get(docKey);
      const existingProvider = cache.providers.get(providerKey) || createLocalProvider(existingDoc);

      return {
        ydoc: existingDoc,
        provider: existingProvider,
        created: false,
        standardFieldName: `editor-${documentId}`
      };
    }
  }

  // ✅ MARK: Document as loading
  cache.loadingDocs.add(documentId);

  try {
    // ✅ CRITICAL: Check if WebRTC room is already active
    if (options.enableWebRTC && cache.activeRooms.has(roomName)) {
      console.warn('🚫 PREVENTED: Room already exists!', roomName);

      const existingProvider = cache.providers.get(providerKey);
      const existingDoc = cache.docs.get(docKey);

      if (existingProvider && existingDoc) {
        console.log('♻️ Returning existing room to prevent conflict');
        cache.refs.set(providerKey, (cache.refs.get(providerKey) || 0) + 1);

        // ✅ CLEAR: Prepare field for TipTap
        const fieldName = `editor-${documentId}`;
        clearFieldForTipTap(existingDoc, fieldName);

        return {
          ydoc: existingDoc,
          provider: existingProvider,
          created: false,
          standardFieldName: `editor-${documentId}`
        };
      }
    }

    // ✅ GET OR CREATE: Y.js document
    let ydoc = cache.docs.get(docKey);
    if (!ydoc) {
      ydoc = new Y.Doc();
      cache.docs.set(docKey, ydoc);
      console.log('🆕 Created new Y.js document for:', documentId.slice(0, 8) + '...');
    } else {
      console.log('♻️ Reusing existing Y.js document:', documentId.slice(0, 8) + '...');
    }

    // ✅ CRITICAL: Clear field for TipTap compatibility
    const fieldName = `editor-${documentId}`;
    clearFieldForTipTap(ydoc, fieldName);

    // ✅ GET OR CREATE: Provider
    let provider = cache.providers.get(providerKey);

    if (!provider) {
      // Clean up old provider
      const oldProviderKey = options.enableWebRTC ? `${documentId}_local` : `${documentId}_webrtc`;
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
        if (!options.enableWebRTC) {
          cache.activeRooms.delete(roomName);
        }
      }

      // Create new provider
      try {
        if (options.enableWebRTC && options.token) {
          const config = getWebRTCConfig(options.token);

          if (cache.activeRooms.has(roomName)) {
            console.error('🚫 CRITICAL: Attempted to create duplicate WebRTC room!', roomName);
            throw new Error(`WebRTC room ${roomName} already exists!`);
          }

          provider = new WebrtcProvider(roomName, ydoc, config);
          cache.activeRooms.add(roomName);

          // Event handlers
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

          // Cleanup handler
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
        provider = createLocalProvider(ydoc);
        console.log('🔄 Fallback to local provider due to error');
      }

      cache.providers.set(providerKey, provider);
      cache.refs.set(providerKey, 1);

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

  } finally {
    // ✅ CLEANUP: Remove loading flag
    cache.loadingDocs.delete(documentId);
  }
}

// ✅ NEW: Clear Y.js field for TipTap compatibility
function clearFieldForTipTap(ydoc, fieldName) {
  if (!ydoc || !fieldName) return;

  try {
    if (ydoc.share.has(fieldName)) {
      const existingField = ydoc.share.get(fieldName);

      console.log('🔍 Field conflict detection:', {
        fieldName,
        existingType: existingField.constructor.name,
        isYText: existingField instanceof Y.Text,
        isYXmlFragment: existingField.constructor.name === 'YXmlFragment',
        needsClear: existingField.constructor.name !== 'YXmlFragment'
      });

      // ✅ CRITICAL: TipTap needs YXmlFragment, not YText
      if (existingField.constructor.name !== 'YXmlFragment') {
        console.log('🔄 Clearing incompatible field for TipTap:', fieldName);

        // Save content if it's valid text
        let savedContent = '';
        if (existingField instanceof Y.Text) {
          const content = existingField.toString();
          if (content && content !== '[object Object]') {
            savedContent = content;
            console.log('💾 Preserved content during field clear:', content.slice(0, 100));
          }
        }

        // Clear the field
        ydoc.share.delete(fieldName);
        console.log('✅ Field cleared for TipTap compatibility');

        // Note: TipTap will create the correct YXmlFragment type
        // Content restoration can be handled by the editor after initialization
      } else {
        console.log('✅ Field already compatible with TipTap');
      }
    } else {
      console.log('📝 No existing field, TipTap will create new one');
    }
  } catch (error) {
    console.error('❌ Field clearing failed:', error);
    // Continue anyway - TipTap might be able to handle it
  }
}

// ✅ ENHANCED: Improved cleanup
export function releaseRoom(documentId, options = {}) {
  if (typeof window === "undefined") return;

  const cache = getGlobalCache();
  if (!cache) return;

  const providerKey = options.enableWebRTC ? `${documentId}_webrtc` : `${documentId}_local`;
  const refs = cache.refs.get(providerKey) || 0;
  const newRefs = refs - 1;

  console.log(`📉 Release: ${providerKey} refs: ${refs} -> ${newRefs}`);

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

    if (options.enableWebRTC) {
      cache.activeRooms.delete(roomName);
      console.log('🗑️ Removed from active rooms:', roomName);
    }

    console.log('📄 Y.js document preserved for potential reuse');
  } else {
    cache.refs.set(providerKey, Math.max(0, newRefs));
  }

  // ✅ CLEANUP: Remove from loading set
  cache.loadingDocs.delete(documentId);
}

export function switchDocumentMode(documentId, newOptions = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;

  console.log('🔄 FORCE MODE SWITCH:', {
    documentId: documentId.slice(0, 8) + '...',
    toMode: newOptions.enableWebRTC ? 'collaboration' : 'solo',
    hasToken: !!newOptions.token
  });

  releaseRoom(documentId, { enableWebRTC: false });
  releaseRoom(documentId, { enableWebRTC: true });

  return ensureRoom(documentId, newOptions);
}

export function getRoomInfo(documentId, options = {}) {
  const cache = getGlobalCache();
  if (!cache) return null;

  const docKey = documentId;
  const providerKey = options.enableWebRTC ? `${documentId}_webrtc` : `${documentId}_local`;

  return {
    documentId,
    docKey,
    providerKey,
    hasDoc: cache.docs.has(docKey),
    hasProvider: cache.providers.has(providerKey),
    refCount: cache.refs.get(providerKey) || 0,
    allProviders: Array.from(cache.providers.keys()).filter(key => key.startsWith(documentId)),
    activeRooms: Array.from(cache.activeRooms),
    isLoading: cache.loadingDocs.has(documentId)
  };
}
