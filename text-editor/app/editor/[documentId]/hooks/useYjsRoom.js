// UPDATED useYjsRoom.js - Fixed with proper Y.js integration and owner mode
import { useMemo, useEffect, useState } from "react";
import * as Y from "yjs"; // ✅ ADD: Import Y.js for owner state handling
import { ensureRoom, releaseRoom } from "../utils/yjsCache";
import { collaborationService } from '../../../services/collabService';

export function useYjsRoom(roomName, options = {}) {
  const [collaborationData, setCollaborationData] = useState(null);
  const [collaborationToken, setCollaborationToken] = useState(null);
  const [isLoadingCollaboration, setIsLoadingCollaboration] = useState(false);
  const [collaborationError, setCollaborationError] = useState(null);
  const [ownerStateApplied, setOwnerStateApplied] = useState(false);

  // ✅ FIXED: Detect owner mode early
  const isOwnerMode = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const hidden = urlParams.get('hidden');
      
      const isOwner = mode === 'owner' || hidden === 'true' || 
             window.electronCollaboration?.isOwner;
             
      if (isOwner) {
        console.log('👑 Running in owner mode - Electron collaboration window');
      }
      
      return isOwner;
    }
    return false;
  }, []);

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

  // ✅ ENHANCED: Load collaboration data with proper error handling
  useEffect(() => {
    // Skip collaboration loading in owner mode - token comes from Electron
    if (isOwnerMode) {
      console.log('👑 Owner mode: Skipping collaboration service loading');
      return;
    }
    
    const loadCollaboration = async () => {
      if (!options.documentId) return;

      setIsLoadingCollaboration(true);
      setCollaborationError(null);
      
      try {
        console.log('🔍 Loading collaboration for document:', options.documentId);
        
        // Initialize collaboration service
        collaborationService.initialize();
        
        // Try to get existing collaboration data
        let collabData = await collaborationService.getCollaborationData(options.documentId);
        
        // If no collaboration exists, try to enable it
        if (!collabData) {
          console.log('🆕 No collaboration found, enabling for document:', options.documentId);
          collabData = await collaborationService.enableCollaboration(
            options.documentId, 
            options.documentTitle || 'Untitled Document'
          );
        }
        
        if (collabData) {
          console.log('🤝 Collaboration data loaded:', {
            roomId: collabData.roomId,
            hasLinks: collabData.permanentLinks?.length || 0,
            hasInvitations: collabData.invitations?.length || 0,
            enabled: collabData.enabled
          });
          
          setCollaborationData(collabData);
          
          // ✅ NEW: Automatically get the collaboration token
          const token = await collaborationService.getCollaborationToken(options.documentId);
          if (token) {
            console.log('🎫 Auto-loaded collaboration token for real-time sync');
            setCollaborationToken(token);
          }
        } else {
          console.log('📝 No collaboration available for document');
        }
      } catch (error) {
        console.error('❌ Failed to load collaboration:', error);
        setCollaborationError(error.message);
      } finally {
        setIsLoadingCollaboration(false);
      }
    };
    
    loadCollaboration();
  }, [options.documentId, options.documentTitle, isOwnerMode]);

  // Protocol handler listener for external collaboration invites
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
          
          // Navigate to the collaboration document if different
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
  }, [options.documentId]);

  // ✅ ENHANCED: Extract roomId with better error handling
  const finalRoomName = useMemo(() => {
    // ✅ PRIORITY 1: Check URL parameters first (most important for joining!)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get('room');
      
      if (urlRoom) {
        console.log('🔗 Using room from URL parameters:', urlRoom);
        return urlRoom;
      }
    }
    
    // ✅ PRIORITY 2: Use roomId from collaboration token
    if (collaborationToken) {
      try {
        const tokenParts = collaborationToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const tokenRoomId = payload.roomId;
          const peerId = payload.peerId;
          
          console.log('🔑 Extracted from collaboration token:', {
            roomId: tokenRoomId,
            peerId: peerId,
            type: payload.type,
            documentId: payload.documentId
          });
          
          return tokenRoomId;
        }
      } catch (error) {
        console.error('❌ Failed to decode collaboration token:', error);
        setCollaborationError('Invalid collaboration token format');
      }
    }
    
    // ✅ PRIORITY 3: Use roomId from collaboration data (for own documents)
    if (collaborationData?.roomId) {
      console.log('🏠 Using collaboration data roomId:', collaborationData.roomId);
      return collaborationData.roomId;
    }
    
    // ✅ PRIORITY 4: Fallback to provided room name
    console.log('🔄 Using fallback room name:', roomName);
    return roomName;
  }, [collaborationToken, collaborationData, roomName]);

  // ✅ NEW: Validate token with signaling server
  useEffect(() => {
    const validateToken = async () => {
      if (!collaborationToken || !finalRoomName) return;
      
      try {
        console.log('🔍 Validating collaboration token with signaling server...');
        
        const response = await fetch('https://signaling-server-production-af26.up.railway.app/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: collaborationToken })
        });
        
        const result = await response.json();
        
        if (result.valid) {
          console.log('✅ Collaboration token validated successfully');
          console.log('🎯 Ready for P2P collaboration in room:', finalRoomName);
        } else {
          console.error('❌ Invalid collaboration token:', result.error);
          setCollaborationError(`Invalid collaboration token: ${result.error}`);
        }
      } catch (error) {
        console.warn('⚠️ Could not validate token with signaling server:', error);
        // Don't set as error since token might still work locally
      }
    };
    
    validateToken();
  }, [collaborationToken, finalRoomName]);

  // ✅ ENHANCED: Create Y.js room with signaling server support
  const { ydoc, provider } = useMemo(() => {
    if (!finalRoomName) {
      console.log('⏳ Waiting for room name...');
      return { ydoc: null, provider: null };
    }
    
    console.log('🏗️ Creating Y.js room:', {
      roomName: finalRoomName,
      hasCollaborationToken: !!collaborationToken,
      hasSignalingServer: !!collaborationToken,
      documentId: options.documentId,
      isOwnerMode
    });
    
    const roomOptions = {
      ...options,
      // ✅ NEW: Pass collaboration token for signaling server auth
      token: collaborationToken,
      // ✅ NEW: Include signaling server URL if we have a token
      signalingServer: collaborationToken ? 
        'wss://signaling-server-production-af26.up.railway.app/signal' : undefined,
      // ✅ NEW: Enable WebRTC for real-time collaboration
      enableWebRTC: !!collaborationToken,
      // Pass room ID for proper identification
      roomId: finalRoomName,
      // Mark as owner mode
      isOwner: isOwnerMode
    };
    
    const roomData = ensureRoom(finalRoomName, roomOptions);
    
    // ✅ NEW: Log successful room creation
    if (roomData.provider && collaborationToken) {
      console.log('🎉 WebRTC-enabled collaboration room created!');
      console.log('🔗 Signaling server:', roomOptions.signalingServer);
      console.log('🏠 Room ID:', finalRoomName);
      console.log('👑 Owner mode:', isOwnerMode);
    }
    
    return roomData;
  }, [finalRoomName, collaborationToken, options, isOwnerMode]);

  // ✅ FIXED: Owner initialization (after ydoc is created)
  useEffect(() => {
    if (isOwnerMode && ydoc && typeof window !== 'undefined' && 
        window.electronCollaboration?.onInitOwnerState && !ownerStateApplied) {
      
      console.log('👑 Setting up owner state listener...');
      
      window.electronCollaboration.onInitOwnerState((ownerData) => {
        console.log('👑 Initializing as document owner:', {
          documentId: ownerData.documentId,
          room: ownerData.room,
          hasState: !!ownerData.state,
          stateLength: ownerData.state?.length || 0
        });
        
        // Apply owner's document state to Y.js
        if (ownerData.state && ownerData.state.length > 0) {
          try {
            const state = new Uint8Array(ownerData.state);
            Y.applyUpdate(ydoc, state, 'owner-init');
            console.log('✅ Owner state applied to Y.js document');
            setOwnerStateApplied(true);
          } catch (error) {
            console.error('❌ Failed to apply owner state:', error);
          }
        }
        
        // Set collaboration token
        if (ownerData.token) {
          setCollaborationToken(ownerData.token);
        }
      });
    }
  }, [isOwnerMode, ydoc, ownerStateApplied]);

  // ✅ FIXED: Send updates back to Electron (owner mode only)
  useEffect(() => {
    if (isOwnerMode && ydoc && typeof window !== 'undefined' && 
        window.electronCollaboration?.sendUpdate && ownerStateApplied) {
      
      console.log('👑 Setting up owner update handler...');
      
      const handleUpdate = (update, origin) => {
        // Don't send back owner-init updates to prevent loops
        if (origin !== 'owner-init') {
          console.log('👑 Sending update back to Electron:', {
            origin,
            updateSize: update.length
          });
          
          try {
            const state = Y.encodeStateAsUpdate(ydoc);
            window.electronCollaboration.sendUpdate({
              documentId: options.documentId,
              state: Array.from(state),
              metadata: { 
                updatedAt: new Date().toISOString(),
                source: 'collaboration'
              }
            });
          } catch (error) {
            console.error('❌ Failed to send update to Electron:', error);
          }
        }
      };

      ydoc.on('update', handleUpdate);
      
      return () => {
        console.log('👑 Cleaning up owner update handler');
        ydoc.off('update', handleUpdate);
      };
    }
  }, [isOwnerMode, ydoc, options.documentId, ownerStateApplied]);

  // ✅ ENHANCED: Cleanup with proper cache key
  useEffect(() => {
    return () => {
      if (finalRoomName) {
        // Create consistent cache key
        const cacheKey = collaborationToken ? 
          `${finalRoomName}_authenticated` : 
          finalRoomName;
        
        console.log('🧹 Cleaning up Y.js room:', cacheKey);
        releaseRoom(cacheKey);
      }
    };
  }, [finalRoomName, collaborationToken]);

  // ✅ ENHANCED: Comprehensive debug logging
  const debugInfo = {
    // Room information
    originalRoomName: roomName,
    finalRoomName: finalRoomName,
    
    // Owner mode
    isOwnerMode,
    ownerStateApplied,
    
    // Collaboration state
    hasCollaborationData: !!collaborationData,
    collaborationEnabled: collaborationData?.enabled,
    collaborationRoomId: collaborationData?.roomId,
    
    // Token information
    hasCollaborationToken: !!collaborationToken,
    tokenSource: collaborationToken ? 'loaded' : 'none',
    
    // Document information
    documentId: options.documentId,
    documentTitle: options.documentTitle,
    
    // Provider state
    hasProvider: !!provider,
    hasYDoc: !!ydoc,
    
    // Loading states
    isLoadingCollaboration,
    collaborationError,
    
    // Environment
    platform: typeof window !== 'undefined' && window.electronAPI ? 'Electron' : 'Browser',
    timestamp: new Date().toISOString()
  };

  if (isOwnerMode) {
    console.log('👑 OWNER MODE - useYjsRoom DEBUG:', debugInfo);
  } else {
    console.log('🔍 useYjsRoom DEBUG:', debugInfo);
  }

  // ✅ NEW: Enhanced return object with more useful data
  return { 
    // Core Y.js objects
    ydoc, 
    provider,
    
    // Room information
    roomId: finalRoomName,
    
    // Collaboration state
    collaborationData,
    collaborationToken,
    setCollaborationToken,
    
    // Loading states
    isLoadingCollaboration,
    collaborationError,
    
    // Owner mode info
    isOwnerMode,
    ownerStateApplied,
    
    // Helper properties
    isCollaborationEnabled: !!collaborationToken,
    hasRealTimeSync: !!(collaborationToken && provider),
    
    // Debug information
    debugInfo,
    collaborationService: isOwnerMode ? 'electron-owner' : 'web-client'
  };
}
