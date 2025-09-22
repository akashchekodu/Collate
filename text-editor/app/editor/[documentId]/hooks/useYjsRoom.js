import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { ensureRoom, releaseRoom, switchDocumentMode } from "../utils/yjsCache";

export function useYjsRoom(documentId, options = {}) {
  const [collaborationToken, setCollaborationToken] = useState(null);
  const [isCollaborationMode, setIsCollaborationMode] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  
  const roomDataRef = useRef(null);
  const stableDocumentId = useRef(documentId);

  if (stableDocumentId.current !== documentId) {
    stableDocumentId.current = documentId;
    roomDataRef.current = null;
  }

  // Detect collaboration mode from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token && token !== collaborationToken) {
        console.log('🤝 Collaboration mode detected with new token');
        setCollaborationToken(token);
        setIsCollaborationMode(true);
      } else if (!token && isCollaborationMode) {
        console.log('📝 Solo mode detected');
        setIsCollaborationMode(false);
        setCollaborationToken(null);
      }
    }
  }, [collaborationToken, isCollaborationMode]);

  // Protocol handler for Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.onJoinCollaboration) {
      const handleJoinCollaboration = (collaborationData) => {
        console.log('🤝 Protocol handler join collaboration:', collaborationData);
        
        const { token, documentId: collabDocId } = collaborationData;
        
        if (collabDocId && token) {
          if (documentId === collabDocId) {
            // ✅ SAME DOCUMENT: Switch to collaboration mode
            console.log('🔄 Switching current document to collaboration mode');
            setCollaborationToken(token);
            setIsCollaborationMode(true);
          } else {
            // ✅ DIFFERENT DOCUMENT: Navigate
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

  // ✅ SEAMLESS SWITCHING: Enable collaboration for current document
  const enableCollaboration = useCallback(async (token) => {
    if (isSwitching) return;
    
    console.log('🔄 Enabling collaboration mode for current document');
    setIsSwitching(true);
    
    try {
      setCollaborationToken(token);
      setIsCollaborationMode(true);
      
      // ✅ NAVIGATE: Update URL to include token
      const newUrl = `/editor/${documentId}?token=${token}`;
      window.history.pushState({}, '', newUrl);
      
      console.log('✅ Collaboration mode enabled successfully');
    } catch (error) {
      console.error('❌ Failed to enable collaboration:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [documentId, isSwitching]);

  // ✅ DISABLE COLLABORATION: Switch back to solo mode
  const disableCollaboration = useCallback(async () => {
    if (isSwitching) return;
    
    console.log('🔄 Disabling collaboration mode');
    setIsSwitching(true);
    
    try {
      setIsCollaborationMode(false);
      setCollaborationToken(null);
      
      // ✅ NAVIGATE: Remove token from URL
      const newUrl = `/editor/${documentId}`;
      window.history.pushState({}, '', newUrl);
      
      console.log('✅ Solo mode enabled successfully');
    } catch (error) {
      console.error('❌ Failed to disable collaboration:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [documentId, isSwitching]);

  // ✅ STABLE ROOM DATA: Seamless switching
  const roomData = useMemo(() => {
    if (!documentId) {
      return { ydoc: null, provider: null, standardFieldName: null };
    }

    console.log('🏗️ Room data (seamless switching):', {
      documentId: documentId.slice(0, 8) + '...',
      isCollaborationMode,
      hasToken: !!collaborationToken,
      isSwitching
    });

    const roomOptions = {
      ...options,
      documentId: documentId,
      token: collaborationToken,
      enableWebRTC: isCollaborationMode,
    };
    
    const roomResult = ensureRoom(documentId, roomOptions);
    
    if (roomResult.modeSwitch) {
      console.log('🔄 Seamless mode switch completed:', {
        documentId: documentId.slice(0, 8) + '...',
        newMode: isCollaborationMode ? 'collaboration' : 'solo'
      });
    }
    
    return roomResult;

  }, [documentId, isCollaborationMode, collaborationToken, options]);

  // ✅ CLEANUP: Standard cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 Room cleanup');
      releaseRoom(documentId, { 
        enableWebRTC: isCollaborationMode, 
        token: collaborationToken 
      });
    };
  }, [documentId]);

  return { 
    ydoc: roomData?.ydoc || null, 
    provider: roomData?.provider || null,
    standardFieldName: roomData?.standardFieldName || `editor-${documentId}`,
    
    isCollaborationMode,
    collaborationToken,
    isSwitching,
    
    // ✅ NEW: Seamless switching functions
    enableCollaboration,
    disableCollaboration,
    setCollaborationToken, // Keep for backward compatibility
    
    documentId,
    hasRealTimeSync: !!(isCollaborationMode && roomData?.provider && collaborationToken),
    
    debugInfo: {
      documentId: documentId.slice(0, 8) + '...',
      mode: isCollaborationMode ? 'collaboration' : 'solo',
      hasToken: !!collaborationToken,
      hasProvider: !!roomData?.provider,
      hasYdoc: !!roomData?.ydoc,
      providerType: roomData?.provider?.constructor.name || 'none',
      isSwitching
    }
  };
}
