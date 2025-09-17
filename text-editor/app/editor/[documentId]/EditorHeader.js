// app/editor/[documentId]/EditorHeader.js
"use client";

import { useState } from "react";
import {
  ArrowLeft, Share2, Download, Users, Wifi, WifiOff,
  MoreHorizontal, Copy, Link
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useYjsRoom } from "./hooks/useYjsRoom";
import { useAwareness } from "./hooks/useAwareness";
import ClientOnly from "./components/ClientOnly";      // <-- guard

export default function EditorHeader({ documentId }) {
  /* -------- state -------- */
  const [title, setTitle]        = useState("Untitled Document");
  const [showShare, setShowShare] = useState(false);
  const router                   = useRouter();

  /* -------- realtime status (safe in ClientOnly) -------- */
  const roomName                 = documentId || "default-room";
  const { provider }             = useYjsRoom(roomName);
  const { peerCount, connectionStatus, activePeers } =
    useAwareness(provider, roomName);

  /* -------- helpers -------- */
  const connectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi size={16} className="text-green-400" />;
      case "connecting":
        return <WifiOff size={16} className="text-yellow-400 animate-pulse" />;
      default:
        return <WifiOff size={16} className="text-red-400" />;
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      alert("📋 Link copied to clipboard!");
    }
  };

  const handleExport = () => alert("🚀 Export feature coming soon!");

  /* ============ RENDER ============ */
  return (
    <ClientOnly
      /* skeleton shown during SSR / hydration */
      fallback={
        <header className="flex items-center px-6 py-4 bg-gray-900 border-b border-gray-700">
          <div className="h-8 w-24 bg-gray-800 rounded animate-pulse" />
        </header>
      }
    >
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
        {/* ---------- Left side ---------- */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            title="Back to home"
          >
            <ArrowLeft size={20} />
          </button>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-medium bg-transparent border-none focus:outline-none text-white placeholder-gray-400 min-w-[200px] max-w-[400px]"
            placeholder="Untitled Document"
          />

          <div className="flex items-center gap-3 text-sm text-gray-400 ml-4">
            <div className="flex items-center gap-2">
              {connectionIcon()}
              <span className="capitalize hidden sm:inline">
                {connectionStatus}
              </span>
            </div>

            {peerCount > 0 && (
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">
                  {peerCount} {peerCount === 1 ? "peer" : "peers"}
                </span>

                {/* tiny avatars on mobile */}
                <div className="flex -space-x-2 sm:hidden">
                  {activePeers.slice(0, 3).map((p, i) => (
                    <div
                      key={p.clientId || i}
                      className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs text-white"
                      style={{ backgroundColor: p.color || "#6B7280" }}
                      title={p.name || "Anonymous"}
                    >
                      {p.name ? p.name.slice(0, 2).toUpperCase() : "👤"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Right side ---------- */}
        <div className="flex items-center gap-2">
          {/* Share dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowShare(!showShare)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {showShare && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Copy size={16} />
                  Copy Link
                </button>
                <button
                  onClick={() => alert("🔗 One-time link coming soon!")}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Link size={16} />
                  One-time Link
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* More */}
          <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>
    </ClientOnly>
  );
}
