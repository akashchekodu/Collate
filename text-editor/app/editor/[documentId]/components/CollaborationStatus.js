"use client";
import React, { useCallback } from "react";
import { Users, Wifi, WifiOff, Eye, Edit, Bug, Type, Clock } from "lucide-react";

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

        console.log('🔍 Y.Doc Debug:', {
          clientID: ydoc.clientID,
          fieldName,
          content: ytext.toString(),
          length: ytext.length,
          localUser,
          awarenessStates: Array.from(awareness.getStates().entries()),
          activePeers: activePeers.length,
          connectionStatus
        });
      } catch (error) {
        console.error('❌ Error accessing Y.Doc:', error);
      }
    }
  }, [ydoc, roomName, provider, activePeers, connectionStatus]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'synced':
        return 'text-green-400';
      default:
        return 'text-red-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
      case 'synced':
        return <Wifi size={14} />;
      case 'connecting':
        return <WifiOff size={14} className="animate-pulse" />;
      default:
        return <WifiOff size={14} />;
    }
  };

  // ✅ ENHANCED: Check for typing activity
  const typingPeers = activePeers.filter(peer => {
    return peer.isTyping || (peer.lastSeen && Date.now() - peer.lastSeen < 3000);
  });

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      {/* Left: Connection Status & Peer Count */}
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
          {/* ✅ ENHANCED: Show provider type */}
          {provider && (
            <span className="text-xs text-gray-500">
              ({provider.constructor.name.replace('Provider', '')})
            </span>
          )}
        </div>
      </div>

      {/* Center: Active Peers with Enhanced Info */}
      {activePeers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">
            Active collaborators:
          </span>
          <div className="flex -space-x-2">
            {activePeers.slice(0, 5).map((peer, index) => {
              const isRecentlyActive = peer.lastSeen && Date.now() - peer.lastSeen < 10000;
              const isTyping = peer.isTyping || (peer.lastSeen && Date.now() - peer.lastSeen < 3000);

              return (
                <div
                  key={peer.clientId || index}
                  className="relative w-8 h-8 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs text-white font-medium hover:z-10 hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: peer.color || '#6B7280' }}
                  title={`${peer.name || 'Anonymous'} - ${isTyping ? 'Typing...' : isRecentlyActive ? 'Active' : 'Viewing'}`}
                >
                  {/* ✅ ENHANCED: Show first letter or emoji */}
                  {peer.name ? peer.name.charAt(0).toUpperCase() : '👤'}

                  {/* ✅ ENHANCED: Activity indicator */}
                  <div className="absolute -bottom-1 -right-1">
                    {isTyping ? (
                      <div className="flex items-center justify-center w-3 h-3 bg-green-500 rounded-full">
                        <Type size={8} className="text-white" />
                      </div>
                    ) : isRecentlyActive ? (
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    ) : (
                      <div className="flex items-center justify-center w-3 h-3 bg-gray-500 rounded-full">
                        <Eye size={6} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {activePeers.length > 5 && (
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-xs text-white font-medium"
                title={`${activePeers.length - 5} more collaborators`}
              >
                +{activePeers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ ENHANCED: Typing indicator */}
      {typingPeers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <Type size={12} className="animate-pulse" />
          <span>
            {typingPeers.length === 1
              ? `${typingPeers[0].name || 'Someone'} is typing...`
              : `${typingPeers.length} people are typing...`
            }
          </span>
        </div>
      )}

      {/* Right: Debug & Info */}
      <div className="flex items-center gap-2">
        {/* ✅ ENHANCED: Real-time sync indicator */}
        {connectionStatus === 'connected' && peerCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        )}

        {/* ✅ DEBUG: Development tools */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={debugYjsState}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-400 hover:text-white transition-colors"
            title="Debug Y.js collaboration state"
          >
            <Bug size={12} />
            Debug
          </button>
        )}
      </div>
    </div>
  );
}
