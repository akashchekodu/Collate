// app/editor/[documentId]/components/CollaborationStatus.js
"use client";
import React, { useCallback } from "react";

export default function CollaborationStatus({ 
  peerCount, 
  activePeers, 
  connectionStatus, 
  ydoc, 
  provider, 
  roomName 
}) {
  const debugYjsState = useCallback(() => {
    if (ydoc && provider) {
      try {
        const fieldName = `editor-${roomName}`;
        const ytext = ydoc.getText(fieldName);
        const awareness = provider.awareness;
        const localUser = awareness.getLocalState()?.user;
        
        console.log('Y.Doc Debug:', {
          clientID: ydoc.clientID,
          fieldName,
          content: ytext.toString(),
          length: ytext.length,
          localUser,
          awarenessStates: Array.from(awareness.getStates().entries())
        });
      } catch (error) {
        console.error('Error accessing Y.Doc:', error);
      }
    }
  }, [ydoc, roomName, provider]);

  return (
    <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
      <div className="flex items-center gap-4">
        <div className="font-medium">
          {peerCount} connected peer{peerCount !== 1 ? "s" : ""}
        </div>
        
        {activePeers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Active:</span>
            <div className="flex -space-x-2">
              {activePeers.slice(0, 3).map((peer) => (
                <div
                  key={peer.clientId}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm font-medium text-white shadow-sm"
                  style={{ backgroundColor: peer.color || '#6B7280' }}
                  title={peer.name || 'Anonymous User'}
                >
                  {peer.name ? peer.name.split(' ')[0] : '🐾'}
                </div>
              ))}
              {activePeers.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-500 flex items-center justify-center text-xs font-medium text-white shadow-sm">
                  +{activePeers.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
          connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {connectionStatus}
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <button 
            onClick={debugYjsState}
            className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200 transition-colors"
          >
            Debug
          </button>
        )}
      </div>
    </div>
  );
}
