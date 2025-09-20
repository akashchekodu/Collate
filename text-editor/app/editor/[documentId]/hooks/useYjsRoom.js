// FIXED useYjsRoom.js - Extract roomId from collaboration token
import { useMemo, useEffect, useState } from "react";
import { ensureRoom, releaseRoom } from "../utils/yjsCache";
import { collaborationService } from "@/app/services/collaborationService";

export function useYjsRoom(roomName, options = {}) {
  const [collaborationData, setCollaborationData] = useState(null);
  const [collaborationToken, setCollaborationToken] = useState(null);

  // Add global setCollaborationToken function
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.setCollaborationToken = setCollaborationToken;
      
      return () => {
        if (window.setCollaborationToken === setCollaborationToken) {
          delete window.setCollaborationToken;
        }
      };
    }
  }, [setCollaborationToken]);
  
  // Load collaboration data for the document
  useEffect(() => {
    const loadCollaboration = async () => {
      if (options.documentId) {
        try {
          const collabData = await collaborationService.getCollaborationData(options.documentId);
          if (collabData) {
            console.log('🤝 Found collaboration data:', {
              roomId: collabData.roomId,
              hasLinks: collabData.permanentLinks?.length || 0,
              hasInvitations: collabData.invitations?.length || 0
            });
            setCollaborationData(collabData);
          }
        } catch (error) {
          console.error('Failed to load collaboration data:', error);
        }
      }
    };
    
    loadCollaboration();
  }, [options.documentId]);

  // Protocol handler listener
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.onJoinCollaboration) {
      const handleJoinCollaboration = (collaborationData) => {
        console.log('🤝 Protocol handler join collaboration:', collaborationData);
        
        const { room, token, documentId, source } = collaborationData;
        
        if (documentId && room && token) {
          console.log('🔗 Setting collaboration token from protocol:', {
            documentId,
            room: room.substring(0, 20) + '...',
            hasToken: !!token,
            source
          });
          
          setCollaborationToken(token);
          
          if (options.documentId !== documentId) {
            console.log('📍 Navigating to collaboration document:', documentId);
            window.location.href = `/editor/${documentId}`;
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
  }, [options.documentId, setCollaborationToken]);

  // ✅ FIXED: Extract roomId from collaboration token
  const finalRoomName = useMemo(() => {
    // If we have a collaboration token, extract the roomId from it
    if (collaborationToken) {
      try {
        const payload = JSON.parse(atob(collaborationToken.split('.')[1]));
        const tokenRoomId = payload.roomId;
        
        console.log('🔑 Extracted roomId from token:', tokenRoomId);
        console.log('🔄 Using collaboration room instead of document room');
        
        return tokenRoomId; // ✅ Use roomId from token
      } catch (error) {
        console.error('Failed to decode collaboration token:', error);
      }
    }
    
    // Fallback to collaboration data room or original room name
    const fallbackRoom = collaborationData?.roomId || roomName;
    console.log('🏠 Using fallback room:', fallbackRoom);
    return fallbackRoom;
  }, [collaborationToken, collaborationData, roomName]);

  console.log('🔍 FINAL ROOM NAME:', finalRoomName);

  const { ydoc, provider } = useMemo(() => {
    if (!finalRoomName) return { ydoc: null, provider: null };
    
    console.log(`🏠 Creating Y.js room: ${finalRoomName}${collaborationToken ? ' (authenticated)' : ''}`);
    
    const roomOptions = {
      ...options,
      token: collaborationToken
    };
    
    return ensureRoom(finalRoomName, roomOptions);
  }, [finalRoomName, collaborationToken, options]);

  useEffect(() => {
    return () => {
      if (finalRoomName) {
        const cacheKey = collaborationToken ? `${finalRoomName}_authenticated` : finalRoomName;
        releaseRoom(cacheKey);
      }
    };
  }, [finalRoomName, collaborationToken]);

  // Debug logging
  console.log('🔍 ROOM DEBUG:', {
    originalRoomName: roomName,
    finalRoomName: finalRoomName,
    hasCollaborationData: !!collaborationData,
    collaborationRoomId: collaborationData?.roomId,
    collaborationToken: collaborationToken ? 'present' : 'null',
    extractedFromToken: collaborationToken ? 'roomId extracted' : 'no token',
    timestamp: new Date().toISOString(),
    platform: typeof window.electronAPI !== 'undefined' ? 'Electron' : 'Browser'
  });

  return { 
    ydoc, 
    provider, 
    setCollaborationToken, 
    collaborationData,
    roomId: finalRoomName 
  };
}
