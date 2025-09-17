// app/editor/[documentId]/components/CollaborationStatus.js
"use client";
import React, { useCallback } from "react";
import { Users, Wifi, WifiOff, Eye, Edit, Bug } from "lucide-react";

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

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi size={14} />;
      case 'connecting':
        return <WifiOff size={14} className="animate-pulse" />;
      default:
        return <WifiOff size={14} />;
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      {/* Left: Connection Status */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="capitalize font-medium">{connectionStatus}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users size={14} />
          <span className="font-medium">
            {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
          </span>
        </div>
      </div>

      {/* Center: Active Peers */}
      {activePeers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">Active collaborators:</span>
          <div className="flex -space-x-2">
            {activePeers.slice(0, 5).map((peer, index) => (
              <div
                key={peer.clientId || index}
                className="relative w-8 h-8 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs text-white font-medium hover:z-10 hover:scale-110 transition-transform cursor-pointer"
                style={{ backgroundColor: peer.color || '#6B7280' }}
                title={`${peer.name || 'Anonymous'} - ${peer.lastEdit ? 'Editing' : 'Viewing'}`}
              >
                {peer.name ? peer.name.split(' ')[0] : '🐾'}
                {/* Activity indicator */}
                <div className="absolute -bottom-1 -right-1">
                  {peer.lastEdit && Date.now() - peer.lastEdit < 5000 ? (
                    <Edit size={10} className="text-green-400 bg-gray-800 rounded-full p-0.5" />
                  ) : (
                    <Eye size={10} className="text-gray-400 bg-gray-800 rounded-full p-0.5" />
                  )}
                </div>
              </div>
            ))}
            {activePeers.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-xs text-white font-medium">
                +{activePeers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right: Debug (Development only) */}
      {/* <div className="flex items-center gap-2">
        {process.env.NODE_ENV === 'development' && (
          <button 
            onClick={debugYjsState}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-400 hover:text-white transition-colors"
            title="Debug Y.js state"
          >
            <Bug size={12} />
            Debug
          </button>
        )}
      </div> */}
    </div>
  );
}
