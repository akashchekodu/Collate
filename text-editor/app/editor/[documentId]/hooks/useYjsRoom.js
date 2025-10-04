import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { ensureRoom, releaseRoom, switchDocumentMode } from "../utils/yjsCache";

export function useYjsRoom(documentId, options = {}) {
  // ✅ SSR SAFETY: Only log on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔄 useYjsRoom called:', {
        documentId: documentId?.slice(0, 8) + '...' || 'undefined',
        timestamp: Date.now(),
        hookCallCount: ++window.yjsRoomCallCount || (window.yjsRoomCallCount = 1)
      });
    }
  });

  const [collaborationToken, setCollaborationToken] = useState(null);
  const [isCollaborationMode, setIsCollaborationMode] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const roomDataRef = useRef(null);
  const stableDocumentId = useRef(documentId);

  if (stableDocumentId.current !== documentId) {
    stableDocumentId.current = documentId;
    roomDataRef.current = null;
    setIsInitialized(false);
  }

  // ✅ SIMPLIFIED: Use passed collaboration data instead of loading
  useEffect(() => {
    if (!documentId) return;

    console.log('🔄 Initializing collaboration mode (SIMPLIFIED):', documentId.slice(0, 8));

    // ✅ USE PASSED DATA: No additional loading needed
    const collaborationMetadata = options.collaborationData;

    let shouldCollaborate = false;
    let existingToken = null;

    if (collaborationMetadata?.enabled && collaborationMetadata?.sessionPersistent) {
      console.log('✅ Document has session-persistent collaboration');
      shouldCollaborate = true;
      existingToken = collaborationMetadata.link?.token || null;
    } else {
      console.log('📋 No session-persistent collaboration found');
    }

    // ✅ SSR SAFETY: Check URL for token only on client side
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      const finalToken = urlToken || existingToken;
      const finalCollabMode = !!finalToken || shouldCollaborate;

      console.log('🎯 Final collaboration state (SIMPLIFIED):', {
        finalCollabMode,
        hasToken: !!finalToken,
        urlToken: !!urlToken,
        existingToken: !!existingToken
      });

      // Set state atomically
      setCollaborationToken(finalToken);
      setIsCollaborationMode(finalCollabMode);
    }

    setIsInitialized(true);

  }, [documentId, options.collaborationData]); // ✅ Only depend on documentId and passed data

  // ✅ FIXED: Only handle URL changes AFTER initialization
  useEffect(() => {
    if (!isInitialized) return;

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (token && token !== collaborationToken) {
        console.log('🤝 URL collaboration mode detected with new token');
        setCollaborationToken(token);
        setIsCollaborationMode(true);
      } else if (!token && isCollaborationMode) {
        // Check if collaboration should persist
        checkCollaborationPersistence();
      }
    }
  }, [isInitialized, collaborationToken, isCollaborationMode]);

  // ✅ NEW: Check if collaboration should persist when URL has no token
  const checkCollaborationPersistence = useCallback(async () => {
    try {
      const { collaborationService } = await import('../../../services/collabService');
      const shouldPersist = await collaborationService.shouldCollaborationPersist(documentId);

      if (!shouldPersist) {
        console.log('📝 No session persistence - switching to solo mode');
        setIsCollaborationMode(false);
        setCollaborationToken(null);
      } else {
        console.log('✅ Session persistence active - staying in collaboration mode');
      }
    } catch (error) {
      console.error('❌ Failed to check collaboration persistence:', error);
    }
  }, [documentId]);

  // Protocol handler for Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.onJoinCollaboration) {
      const handleJoinCollaboration = (collaborationData) => {
        console.log('🤝 Protocol handler join collaboration:', collaborationData);

        const { token, documentId: collabDocId } = collaborationData;

        if (collabDocId && token) {
          if (documentId === collabDocId) {
            console.log('🔄 Switching current document to collaboration mode');
            setCollaborationToken(token);
            setIsCollaborationMode(true);
          } else {
            window.location.href = `/editor/${collabDocId}?token=${token}`;
          }
        }
      };

      window.electronAPI.onJoinCollaboration(handleJoinCollaboration);

      return () => {
        if (window.electronAPI?.removeJoinCollaborationListener) {
          window.electronAPI.removeJoinCollaborationListener();
        }
      };
    }
  }, [documentId]);

  // ✅ UPDATED: Enable collaboration with session persistence
// ✅ UPDATED: Enable collaboration with immediate metadata update
// ✅ UPDATED: Enable collaboration with immediate metadata update
const enableCollaboration = useCallback(async (token) => {
  if (isSwitching) {
    console.log('⚠️ Already switching, ignoring enable collaboration call');
    return;
  }

  console.log('🔄 useYjsRoom: Enabling collaboration mode');
  setIsSwitching(true);

  try {
    // ✅ SIMPLIFIED: Just update UI state - metadata is already saved by ShareControls
    setCollaborationToken(token);
    setIsCollaborationMode(true);

    console.log('✅ useYjsRoom: UI state updated', {
      hasToken: !!token,
      isCollaborationMode: true
    });

    // ✅ Update URL  
    const newUrl = `/editor/${documentId}?token=${token}`;
    window.history.pushState({}, '', newUrl);

    console.log('✅ useYjsRoom: URL updated');

    // ✅ OPTIONAL: Update service state (non-critical)
    try {
      const { collaborationService } = await import('../../../services/collabService');
      await collaborationService.enableCollaboration(documentId);
      console.log('✅ Service state updated');
    } catch (serviceError) {
      console.warn('⚠️ Service update failed (non-critical):', serviceError);
    }

    console.log('✅ useYjsRoom: Collaboration mode enabled successfully');
  } catch (error) {
    console.error('❌ useYjsRoom: Failed to enable collaboration:', error);
    throw error;
  } finally {
    setIsSwitching(false);
  }
}, [documentId, isSwitching]);

// ✅ FIXED: Disable collaboration (remove broken service dependency)
const disableCollaboration = useCallback(async () => {
  if (isSwitching) return;

  console.log('🔄 Disabling collaboration mode');
  setIsSwitching(true);

  try {
    // ✅ SIMPLIFIED: Just update UI state - metadata is handled by ShareControls
    setIsCollaborationMode(false);
    setCollaborationToken(null);

    // Remove token from URL
    const newUrl = `/editor/${documentId}`;
    window.history.pushState({}, '', newUrl);

    // ✅ OPTIONAL: Update service state (non-critical)
    try {
      const { collaborationService } = await import('../../../services/collabService');
      await collaborationService.disableCollaboration(documentId);
      console.log('✅ Service state cleared');
    } catch (error) {
      console.warn('⚠️ Service clear failed (non-critical):', error);
    }

    console.log('✅ Solo mode enabled');
  } catch (error) {
    console.error('❌ Failed to disable collaboration:', error);
  } finally {
    setIsSwitching(false);
  }
}, [documentId, isSwitching]);

  // ✅ STABLE ROOM DATA: Only create after initialization
  const roomData = useMemo(() => {
    if (!documentId || !isInitialized) {
      return { ydoc: null, provider: null, standardFieldName: null };
    }

    console.log('🏗️ Room data (initialized):', {
      documentId: documentId.slice(0, 8) + '...',
      isCollaborationMode,
      hasToken: !!collaborationToken,
      isSwitching,
      isInitialized
    });

    const roomOptions = {
      ...options,
      documentId: documentId,
      token: collaborationToken,
      enableWebRTC: isCollaborationMode,
    };

    const roomResult = ensureRoom(documentId, roomOptions);

    if (roomResult.modeSwitch) {
      console.log('🔄 Mode switch completed:', {
        documentId: documentId.slice(0, 8) + '...',
        newMode: isCollaborationMode ? 'collaboration' : 'solo'
      });
    }

    return roomResult;

  }, [documentId, isCollaborationMode, collaborationToken, options, isInitialized]);

  // ✅ CLEANUP: Fixed cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 Room cleanup');
      releaseRoom(documentId, {
        enableWebRTC: isCollaborationMode
      });
    };
  }, [documentId, isCollaborationMode]);

  return {
    ydoc: roomData?.ydoc || null,
    provider: roomData?.provider || null,
    standardFieldName: roomData?.standardFieldName || `editor-${documentId}`,

    isCollaborationMode,
    collaborationToken,
    isSwitching,
    isInitialized,

    enableCollaboration,
    disableCollaboration,
    setCollaborationToken,

    documentId,
    hasRealTimeSync: !!(isCollaborationMode && roomData?.provider && collaborationToken),

    debugInfo: {
      documentId: documentId.slice(0, 8) + '...',
      mode: isCollaborationMode ? 'collaboration' : 'solo',
      hasToken: !!collaborationToken,
      hasProvider: !!roomData?.provider,
      hasYdoc: !!roomData?.ydoc,
      providerType: roomData?.provider?.constructor.name || 'none',
      isSwitching,
      isInitialized
    }
  };
}
