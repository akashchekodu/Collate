import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { ensureRoom, releaseRoom, switchDocumentMode } from "../utils/yjsCache";

export function useYjsRoom(documentId, options = {}) {
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

  // ✅ FIXED: Check session-persistent collaboration mode
  useEffect(() => {
    async function initializeCollaborationMode() {
      if (!documentId) return;

      console.log('🔄 Initializing collaboration mode for:', documentId.slice(0, 8));

      let existingToken = null;
      let shouldCollaborate = false;
      let collaborationMetadata = null;

      // ✅ STEP 1: Check if document has session-persistent collaboration
      if (typeof window !== 'undefined' && window.electronAPI?.documents) {
        try {
          console.log('📋 Loading document from storage...');
          const doc = await window.electronAPI.documents.load(documentId);
          collaborationMetadata = doc?.metadata?.collaboration;

          console.log('📋 Raw collaboration metadata:', collaborationMetadata);

          // ✅ CHECK: Session-persistent collaboration
          if (collaborationMetadata?.enabled && collaborationMetadata?.sessionPersistent) {
            console.log('✅ Document has session-persistent collaboration');
            shouldCollaborate = true;
            existingToken = collaborationMetadata.link?.token || null;
          } else {
            console.log('📋 Document has no active collaboration session');
          }
        } catch (error) {
          console.error('❌ Failed to check collaboration mode:', error);
        }
      }

      // ✅ STEP 2: Check URL for token (higher priority)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      // ✅ STEP 3: Determine final state (URL token overrides stored state)
      const finalToken = urlToken || existingToken;
      const finalCollabMode = !!finalToken || shouldCollaborate;

      console.log('🎯 Final collaboration state determination:', {
        documentId: documentId.slice(0, 8) + '...',
        hasUrlToken: !!urlToken,
        hasStoredToken: !!existingToken,
        shouldCollaborate,
        finalToken: !!finalToken,
        finalCollabMode,
        metadataEnabled: collaborationMetadata?.enabled,
        metadataSessionPersistent: collaborationMetadata?.sessionPersistent
      });

      // ✅ STEP 4: Set state atomically
      setCollaborationToken(finalToken);
      setIsCollaborationMode(finalCollabMode);
      setIsInitialized(true);

      console.log('✅ Collaboration mode initialized with state:', {
        isCollaborationMode: finalCollabMode,
        hasToken: !!finalToken
      });
    }

    initializeCollaborationMode();
  }, [documentId]);

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
        // ✅ CHANGED: Check if collaboration should persist
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
  const enableCollaboration = useCallback(async (token) => {
    if (isSwitching) {
      console.log('⚠️ Already switching, ignoring enable collaboration call');
      return;
    }

    console.log('🔄 useYjsRoom: Enabling collaboration mode with session persistence');
    setIsSwitching(true);

    try {
      // ✅ STEP 1: Ensure service has session persistence saved
      try {
        const { collaborationService } = await import('../../../services/collabService');
        await collaborationService.enableCollaboration(documentId);
        console.log('✅ Service session persistence confirmed');
      } catch (serviceError) {
        console.error('❌ Service enableCollaboration failed:', serviceError);
        // Continue anyway - UI state is more important
      }

      // ✅ STEP 2: Set UI state
      setCollaborationToken(token);
      setIsCollaborationMode(true);

      console.log('✅ useYjsRoom: UI state updated', {
        hasToken: !!token,
        isCollaborationMode: true
      });

      // ✅ STEP 3: Update URL  
      const newUrl = `/editor/${documentId}?token=${token}`;
      window.history.pushState({}, '', newUrl);

      console.log('✅ useYjsRoom: URL updated to', newUrl);

      // ✅ STEP 4: Verify session persistence (debugging)
      setTimeout(async () => {
        try {
          const { collaborationService } = await import('../../../services/collabService');
          const shouldPersist = await collaborationService.shouldCollaborationPersist(documentId);
          console.log('🔍 Session persistence verification:', shouldPersist);
        } catch (error) {
          console.error('❌ Session persistence verification failed:', error);
        }
      }, 500);

      console.log('✅ useYjsRoom: Collaboration mode enabled successfully');
    } catch (error) {
      console.error('❌ useYjsRoom: Failed to enable collaboration:', error);
      throw error; // Re-throw so EditorHeader can show the error
    } finally {
      setIsSwitching(false); // ✅ Always clear switching state
    }
  }, [documentId, isSwitching]);

  // ✅ UPDATED: Disable collaboration and clear session persistence
  const disableCollaboration = useCallback(async () => {
    if (isSwitching) return;

    console.log('🔄 Disabling collaboration mode and clearing session persistence');
    setIsSwitching(true);

    try {
      // ✅ CLEAR: Session persistence in storage
      try {
        const { collaborationService } = await import('../../../services/collabService');
        await collaborationService.disableCollaboration(documentId);
        console.log('✅ Session persistence cleared from storage');
      } catch (error) {
        console.error('❌ Failed to clear session persistence:', error);
      }

      setIsCollaborationMode(false);
      setCollaborationToken(null);

      // Remove token from URL
      const newUrl = `/editor/${documentId}`;
      window.history.pushState({}, '', newUrl);

      console.log('✅ Solo mode enabled successfully');
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
