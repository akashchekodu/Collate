"use client";
import { useState } from "react";
import { ArrowLeft, Share2, Download, Users, Wifi, WifiOff, MoreHorizontal, Copy, FileDown, Link } from "lucide-react";
import { useRouter } from "next/navigation";
import { useYjsRoom } from "./hooks/useYjsRoom";
import { useAwareness } from "./hooks/useAwareness";

export default function EditorHeader({ documentId }) {
  const [title, setTitle] = useState("Untitled Document");
  const [showShareMenu, setShowShareMenu] = useState(false);
  const router = useRouter();
  
  // Get real-time connection status
  const roomName = documentId || "default-room";
  const { provider } = useYjsRoom(roomName);
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName);

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi size={16} className="text-green-400" />;
      case 'connecting':
        return <WifiOff size={16} className="text-yellow-400 animate-pulse" />;
      default:
        return <WifiOff size={16} className="text-red-400" />;
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    // You can add a toast notification here later
    alert("📋 Link copied to clipboard!");
  };

  const handleExport = () => {
    // TODO: Implement actual export functionality
    alert("🚀 Export feature coming soon!");
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
      {/* Left side: Back + Title */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={() => router.push('/')}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          title="Back to home"
        >
          <ArrowLeft size={20} />
        </button>
        
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium bg-transparent border-none focus:outline-none text-white placeholder-gray-400 min-w-[200px] max-w-[400px]"
          placeholder="Untitled Document"
        />
        
        <div className="flex items-center gap-3 text-sm text-gray-400 ml-4">
          <div className="flex items-center gap-2">
            {getConnectionIcon()}
            <span className="capitalize hidden sm:inline">{connectionStatus}</span>
          </div>
          
          {peerCount > 0 && (
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span className="hidden sm:inline">{peerCount} {peerCount === 1 ? 'peer' : 'peers'}</span>
              <div className="flex -space-x-2 sm:hidden">
                {activePeers.slice(0, 3).map((peer, index) => (
                  <div
                    key={peer.clientId || index}
                    className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: peer.color || '#6B7280' }}
                    title={peer.name || 'Anonymous User'}
                  >
                    {peer.name ? peer.name.split(' ')[0] : '🐾'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">Share</span>
          </button>
          
          {showShareMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <Copy size={16} />
                Copy Link
              </button>
              <button
                onClick={() => alert("🔗 One-time link feature coming soon!")}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <Link size={16} />
                One-time Link
              </button>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Export</span>
        </button>
        
        <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
          <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
}
