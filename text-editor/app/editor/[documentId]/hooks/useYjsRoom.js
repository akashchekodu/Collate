import { useMemo, useEffect, useState, useRef } from "react";
import { ensureRoom, releaseRoom } from "../utils/yjsCache";

export function useYjsRoom(documentId, options = {}) {
  const [collaborationToken, setCollaborationToken] = useState(null);
  const [isCollaborationMode, setIsCollaborationMode] = useState(false);
  
  // ✅ CRITICAL: Stable room data with ref
  const roomDataRef = useRef(null);
  const stableDocumentId = useRef(documentId);

  // Update stable document ID only when it actually changes
  if (stableDocumentId.current !== documentId) {
    stableDocumentId.current = documentId;
    roomDataRef.current = null; // Force recreation
  }

  // Detect collaboration mode from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        console.log('🤝 Collaboration mode detected');
        setCollaborationToken(token);
        setIsCollaborationMode(true);
      } else {
        console.log('📝 Solo mode detected');
        setIsCollaborationMode(false);
        setCollaborationToken(null);
      }
    }
  }, []);

  // ✅ STABLE: Only create room when key parameters change
  const roomKey = `${documentId}_${isCollaborationMode ? 'collab' : 'solo'}_${collaborationToken || 'none'}`;
  
  const roomData = useMemo(() => {
    if (!documentId) {
      console.log('⏳ No document ID');
      return { ydoc: null, provider: null, fieldSuffix: '0' };
    }

    // ✅ REUSE: Return existing room data if key hasn't changed
    if (roomDataRef.current && roomDataRef.current.roomKey === roomKey) {
      console.log('♻️ Reusing existing room data:', roomKey);
      return roomDataRef.current;
    }

    console.log('🆕 Creating new room data:', roomKey);

    const roomOptions = {
      ...options,
      documentId: documentId,
      token: collaborationToken,
      enableWebRTC: isCollaborationMode,
    };
    
    const roomResult = ensureRoom(documentId, roomOptions);
    
    // ✅ STABLE: Store with room key for reuse detection
    const stableRoomData = {
      ...roomResult,
      roomKey,
      createdAt: Date.now()
    };

    roomDataRef.current = stableRoomData;
    
    console.log('✅ Room data created and cached');
    return stableRoomData;

  }, [roomKey]); // ✅ ONLY roomKey dependency

  // ✅ CLEANUP: Only when document ID actually changes
  useEffect(() => {
    return () => {
      if (stableDocumentId.current) {
        console.log('🧹 Cleaning up room for:', stableDocumentId.current);
        try {
          releaseRoom(stableDocumentId.current, { token: collaborationToken });
        } catch (error) {
          console.warn('❌ Cleanup error:', error);
        }
      }
    };
  }, [documentId]); // ✅ Only cleanup when documentId changes

  return { 
    ydoc: roomData?.ydoc || null, 
    provider: roomData?.provider || null,
    fieldSuffix: roomData?.fieldSuffix || '0',
    isCollaborationMode,
    collaborationToken,
    setCollaborationToken,
    documentId,
    hasRealTimeSync: !!(isCollaborationMode && roomData?.provider && collaborationToken)
  };
}
