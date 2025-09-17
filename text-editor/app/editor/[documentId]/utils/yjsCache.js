// app/editor/[documentId]/utils/yjsCache.js
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

export function ensureRoom(roomName) {
  const cache = getGlobalCache();
  if (!cache) {
    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider(roomName, ydoc, WEBRTC_CONFIG);
    return { ydoc, provider, created: true };
  }
  
  if (cache.docs.has(roomName) && cache.providers.has(roomName)) {
    cache.refs.set(roomName, (cache.refs.get(roomName) || 0) + 1);
    return { 
      ydoc: cache.docs.get(roomName), 
      provider: cache.providers.get(roomName), 
      created: false 
    };
  }

  const ydoc = new Y.Doc();
  let provider;
  
  try {
    provider = new WebrtcProvider(roomName, ydoc, WEBRTC_CONFIG);
    
    provider.on('status', event => {
      console.log('WebRTC Provider status:', event.status);
    });
    
    provider.on('peers', event => {
      console.log('WebRTC peers changed:', {
        added: event.added,
        removed: event.removed,
        webrtcPeers: event.webrtcPeers,
        bcPeers: event.bcPeers
      });
    });
  } catch (err) {
    if (cache.docs.has(roomName) && cache.providers.has(roomName)) {
      ydoc.destroy();
      cache.refs.set(roomName, (cache.refs.get(roomName) || 0) + 1);
      return { 
        ydoc: cache.docs.get(roomName), 
        provider: cache.providers.get(roomName), 
        created: false 
      };
    }
    throw err;
  }

  cache.docs.set(roomName, ydoc);
  cache.providers.set(roomName, provider);
  cache.refs.set(roomName, 1);
  
  return { ydoc, provider, created: true };
}

export function releaseRoom(roomName) {
    if (typeof window === "undefined") {
      return { ydoc: null, provider: null, created: false };
    }
  const cache = getGlobalCache();
  if (!cache) return;

  const refs = cache.refs.get(roomName) || 0;
  if (refs <= 1) {
    const provider = cache.providers.get(roomName);
    const ydoc = cache.docs.get(roomName);
    
    try { 
      provider?.off('status');
      provider?.off('peers');
      provider?.destroy(); 
    } catch (_) {}
    
    try { 
      ydoc?.destroy(); 
    } catch (_) {}
    
    cache.providers.delete(roomName);
    cache.docs.delete(roomName);
    cache.refs.delete(roomName);
  } else {
    cache.refs.set(roomName, refs - 1);
  }
}
